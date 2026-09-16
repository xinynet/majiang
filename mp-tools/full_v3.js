/* Full-screen capture pass.
 *
 * Drives the real hotspots rather than callMethod: the page's <script setup>
 * functions are not exposed as page methods, so callMethod fails, and tapping
 * is what a player actually does anyway.
 *
 * The WeChat devtools serves a cached compile, so run this only after
 * `cli close` + `cli auto` on the project, otherwise you are shooting a stale
 * bundle. See HANDOFF_v2.md.
 */
const automator = require('miniprogram-automator');
const path = require('path');
const fs2 = require('fs');
const WS_ENDPOINT = 'ws://127.0.0.1:9420';
const SHOTS_DIR = path.join(__dirname, '..', 'devtools_shots');
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
  mp = await nav(mp, '/pages/index/index');
  let home = await getPage(mp);
  console.log('home:', home.path);
  await shot(mp, '01_home_live.png');

  await modal(mp, home, '.hotspot-lucky-gift', '.modal-close-circle', '02_lucky_bag_live.png');
  await modal(mp, home, '.hotspot-piggy-bank', '.modal-close-btn-ribbon', '03_piggy_bank_live.png');
  await modal(mp, home, '.hotspot-daily-task', '.modal-close-task', '04_daily_tasks_live.png');
  await modal(mp, home, '.hotspot-shop', '.modal-close-task', '05_shop_live.png');
  // 截图添加桌面弹窗
  await modal(mp, home, '.hotspot-desktop', '.desktop-close-hotspot', '10_desktop_modal_live.png');

  // 验证集卡页面
  mp = await nav(mp, '/pages/cards/cards');
  let cards = await getPage(mp);
  await sleep(2000);
  await shot(mp, '08_cards_live.png');

  // 验证游戏页面
  mp = await nav(mp, '/pages/game/game?level=2');
  let game = await getPage(mp);
  await shot(mp, '06_game_deal.png');
  await sleep(3000);
  await shot(mp, '06_game_live.png');

  try { await mp.disconnect(); } catch (e) {}
  console.log('All done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
