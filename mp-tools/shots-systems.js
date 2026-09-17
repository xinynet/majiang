/* 提审"系统功能"补拍：体力系统弹窗 + 道具耗尽/补充弹窗。
 * 流程：进局消耗体力 → 用洗牌道具至 0 → 拍耗尽态 → 再点拍补充弹窗 →
 *       关闭 → 暂停退回首页（体力-1）→ 重复一次（体力 5→3）→ 点体力热点拍弹窗。
 */
const automator = require('miniprogram-automator');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'devtools_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOTS, name) });
  console.log('Shot: ' + name);
}
async function tap(page, selector) {
  const el = await page.$(selector);
  if (!el) { console.log('  (missing) ' + selector); return false; }
  await el.tap();
  return true;
}
async function connect() {
  for (let i = 0; i < 24; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(3000); }
  }
  throw new Error('devtools never accepted a connection on 9420');
}
async function nav(mp, url) {
  try { await mp.reLaunch(url); } catch (e) {}
  await sleep(2000);
  try { await mp.disconnect(); } catch (e) {}
  await sleep(2000);
  return connect();
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
  mp = await nav(mp, '/pages/game/game?level=2');
  let game = await getPage(mp);
  console.log('game:', game.path);
  await sleep(4200); // 等发牌

  // 1) 用掉洗牌道具（次数 1→0），拍道具耗尽状态
  const tools = await game.$$('.tool-capsule');
  console.log('tool capsules:', tools.length);
  if (tools.length >= 2) { await tools[1].tap(); await sleep(1000); }
  await shot(mp, '25_tool_depleted.png');

  // 2) 再点洗牌（次数 0）→ 弹出补充弹窗
  if (tools.length >= 2) { await tools[1].tap(); await sleep(1100); }
  await shot(mp, '26_tool_refill.png');
  await tap(game, '.refill-close-btn'); // 关闭弹窗
  await sleep(800);

  // 3) 暂停 → 返回首页（消耗的体力已在进局时扣除：5→4）
  await tap(game, '.round-pause-btn');
  await sleep(900);
  await tap(game, '.menu-action-btn.neutral-gradient');
  await sleep(1800);

  // 4) 再进一局再退（4→3）
  mp = await nav(mp, '/pages/game/game?level=2');
  game = await getPage(mp);
  await sleep(4200);
  await tap(game, '.round-pause-btn');
  await sleep(900);
  await tap(game, '.menu-action-btn.neutral-gradient');
  await sleep(1800);

  // 5) 首页点体力热点 → "体力说明 + 看广告补满"弹窗（体力 3/5）
  let home = await getPage(mp);
  if (!(home.path || '').includes('index')) {
    mp = await nav(mp, '/pages/index/index');
    home = await getPage(mp);
  }
  await tap(home, '.hotspot-stamina');
  await sleep(1500);
  await shot(mp, '24_stamina_modal.png');

  try { await mp.disconnect(); } catch (e) {}
  console.log('Done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
