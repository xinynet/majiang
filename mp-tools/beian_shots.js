/* 小程序备案「系统功能」截图专用。
 *
 * 按备案表单的系统分类实拍：
 *   货币系统（3张）：首页金币栏 / 金库银行 / 每日任务
 *   商城系统（1张）：商城弹窗
 *   道具系统（1张）：对局页底部道具栏
 *   体力系统（1张）：体力说明原生弹窗（最后截，原生弹窗关不掉）
 *
 * 只点真实热区 + 截图，不改任何游戏代码。输出到 ../小程序备案截图/
 */
const automator = require('miniprogram-automator');
const path = require('path');
const fs2 = require('fs');
const WS_ENDPOINT = 'ws://127.0.0.1:9420';
const SHOTS_DIR = path.join(__dirname, '..', '小程序备案截图');
if (!fs2.existsSync(SHOTS_DIR)) fs2.mkdirSync(SHOTS_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOTS_DIR, name) });
  console.log('Shot: ' + name);
}

async function tap(page, selector) {
  const el = await page.$(selector);
  if (!el) { console.log('  (missing) ' + selector); return false; }
  await el.tap();
  return true;
}

async function modal(mp, page, openSel, closeSel, name) {
  if (!await tap(page, openSel)) return;
  await sleep(1200);
  await shot(mp, name);
  if (closeSel) {
    await tap(page, closeSel);
    await sleep(600);
  }
}

async function connect() {
  for (let i = 0; i < 24; i++) {
    try { return await automator.connect({ wsEndpoint: WS_ENDPOINT, timeout: 60000 }); }
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

async function nav(mp, url) {
  try { await mp.reLaunch(url); } catch (e) {}
  await sleep(2000);
  try { await mp.disconnect(); } catch (e) {}
  await sleep(2000);
  return connect();
}

async function main() {
  let mp = await connect();

  // ===== 货币系统（金币）：首页顶部金币栏 =====
  mp = await nav(mp, '/pages/index/index');
  let home = await getPage(mp);
  console.log('home:', home.path);
  await sleep(1000);
  await shot(mp, '货币系统-1-首页金币栏.png');

  // ===== 货币系统：金库银行（金币存取） =====
  await modal(mp, home, '.hotspot-piggy-bank', '.modal-close-btn-ribbon', '货币系统-2-金库银行.png');

  // ===== 货币系统：每日任务（金币奖励） =====
  await modal(mp, home, '.hotspot-daily-task', '.modal-close-task', '货币系统-3-每日任务.png');

  // ===== 商城系统：商城弹窗（金币购买道具） =====
  await modal(mp, home, '.hotspot-shop', '.modal-close-task', '商城系统-商城弹窗.png');

  // ===== 道具系统：对局页底部道具栏 =====
  mp = await nav(mp, '/pages/game/game?level=2');
  await getPage(mp);
  await sleep(4500); // 等发牌动画结束、牌面落定
  await shot(mp, '道具系统-对局道具栏.png');

  // ===== 体力系统：体力说明弹窗（最后截，原生弹窗无法用选择器关） =====
  mp = await nav(mp, '/pages/index/index');
  home = await getPage(mp);
  await sleep(1000);
  if (await tap(home, '.hotspot-stamina')) {
    await sleep(1200);
    await shot(mp, '体力系统-体力说明弹窗.png');
  }

  try { await mp.disconnect(); } catch (e) {}
  console.log('All done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
