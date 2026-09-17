/* 补拍首页 + 三个首页弹窗（上一轮拍早了页面没挂载）。
 * 关键改动：nav 之后轮询等 .hotspot-piggy-bank 出现再动手。
 */
const automator = require('miniprogram-automator');
const path = require('path');
const SHOTS_DIR = path.join(__dirname, '..', '小程序备案截图');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOTS_DIR, name) });
  console.log('Shot: ' + name);
}

async function waitFor(page, selector, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const el = await page.$(selector); if (el) return el; } catch (e) {}
    await sleep(800);
  }
  return null;
}

async function connect() {
  for (let i = 0; i < 30; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(3000); }
  }
  throw new Error('devtools never accepted a connection on 9420');
}

async function getPage(mp, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try { const p = await mp.currentPage(); if (p) return p; } catch (e) {}
    await sleep(1000);
  }
  throw new Error('no page');
}

async function main() {
  let mp = await connect();

  // 等应用就绪并落到首页：splash 会自动跳 index，必要时补一次 reLaunch
  let home = null;
  for (let i = 0; i < 20 && !home; i++) {
    const p = await getPage(mp);
    if (p.path === 'pages/index/index') { home = p; break; }
    if (i % 4 === 3) { try { await mp.reLaunch('/pages/index/index'); } catch (e) {} }
    await sleep(2000);
  }
  if (!home) throw new Error('never reached pages/index/index');
  console.log('home:', home.path);

  const hotspot = await waitFor(home, '.hotspot-piggy-bank');
  if (!hotspot) throw new Error('home hotspots never appeared');
  await sleep(1500); // 等背景图与顶部栏画完

  await shot(mp, '货币系统-1-首页金币栏.png');

  for (const [openSel, closeSel, name] of [
    ['.hotspot-piggy-bank', '.modal-close-btn-ribbon', '货币系统-2-金库银行.png'],
    ['.hotspot-daily-task', '.modal-close-task', '货币系统-3-每日任务.png'],
    ['.hotspot-shop', '.modal-close-task', '商城系统-商城弹窗.png'],
  ]) {
    const el = await waitFor(home, openSel, 8000);
    if (!el) { console.log('  (missing) ' + openSel); continue; }
    await el.tap();
    await sleep(1500);
    await shot(mp, name);
    const close = await home.$(closeSel);
    if (close) { await close.tap(); await sleep(800); }
  }

  try { await mp.disconnect(); } catch (e) {}
  console.log('Retake done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
