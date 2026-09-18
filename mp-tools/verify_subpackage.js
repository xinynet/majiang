/* 在真实微信开发者工具里验证分包：H5 回归证明不了这一步。
 * uni-app 的 H5 构建基本忽略 subPackages，就是普通路由；
 * 分包下载、子包内资源路径解析都是小程序运行时特有的行为。
 *
 * 检查项：两个分包页能否跳进去、页面元素是否渲染、控制台有无资源加载失败。
 */
const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'subpkg-check');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const results = [];

async function connect() {
  for (let i = 0; i < 20; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(3000); }
  }
  throw new Error('devtools not accepting connections on 9420');
}

async function shot(mp, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, name);
  await mp.screenshot({ path: f });
  const b = fs.readFileSync(f);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

async function check(mp, label, url, selectors) {
  console.log(`\n--- ${label}  ${url}`);
  let page;
  try {
    page = await mp.reLaunch(url);
  } catch (e) {
    console.log('  NAVIGATION FAILED: ' + e.message);
    results.push([label, 'NAV FAILED: ' + e.message]);
    return;
  }
  await sleep(4000);
  try { page = await mp.currentPage(); } catch (e) {}
  const actual = page && page.path;
  console.log('  landed on: ' + actual);
  if (!actual || url.indexOf(actual) === -1) {
    results.push([label, 'WRONG PAGE: ' + actual]);
    return;
  }
  const found = [];
  for (const sel of selectors) {
    let el = null;
    for (let i = 0; i < 12 && !el; i++) {
      try { el = await page.$(sel); } catch (e) {}
      if (!el) await sleep(700);
    }
    found.push(`${sel}=${el ? 'OK' : 'MISSING'}`);
    if (!el) results.push([label, 'selector missing: ' + sel]);
  }
  console.log('  ' + found.join('  '));
  console.log('  screenshot ' + await shot(mp, label + '.png'));
  if (found.every(f => f.endsWith('OK'))) results.push([label, 'OK']);
}

async function main() {
  const mp = await connect();
  mp.on('console', m => {
    const txt = (m.args || []).map(a => String(a && a.value !== undefined ? a.value : a)).join(' ');
    if (m.type === 'error' || /fail|error|404/i.test(txt)) errors.push(`[${m.type}] ${txt}`);
  });
  mp.on('exception', e => errors.push('[exception] ' + (e.message || JSON.stringify(e))));

  const info = await mp.systemInfo();
  console.log('simulator:', info.model, info.windowWidth + 'x' + info.windowHeight, 'SDK', info.SDKVersion);

  await check(mp, '1-home', '/pages/index/index', ['.hotspot-piggy-bank', '.hotspot-start-game']);
  await check(mp, '2-game-subpackage', '/pkg-game/pages/game/game?level=2', ['#board', '.tool-capsule', '.round-pause-btn']);
  await check(mp, '3-cards-subpackage', '/pkg-cards/pages/cards/cards', ['.disc-hero-img', '.card-artwork']);

  console.log('\n================ RESULT ================');
  for (const [label, r] of results) console.log(`  ${r === 'OK' ? 'PASS' : 'FAIL'}  ${label}  ${r === 'OK' ? '' : '-> ' + r}`);
  console.log(`\nconsole errors captured: ${errors.length}`);
  for (const e of errors.slice(0, 25)) console.log('  ' + e);

  try { await mp.disconnect(); } catch (e) {}
  const failed = results.filter(r => r[1] !== 'OK').length;
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
