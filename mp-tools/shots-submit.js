/* 提交材料补拍：具体玩法需要的"对局中"状态截图。
 * 复用 full_v3.js 的连接/导航模式；canvas 是原生组件，
 * 点牌用坐标 touchstart 派发（onTouch 读 touches[0].clientX/Y）。
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
/* 往 canvas 派发一次点牌触摸 */
async function tapBoard(canvas, off, w, h, fx, fy) {
  const x = Math.round(off.left + fx * w), y = Math.round(off.top + fy * h);
  const touch = { identifier: 0, x, y, clientX: x, clientY: y, pageX: x, pageY: y };
  try {
    await canvas.touchstart({ touches: [touch], changedTouches: [touch] });
    await canvas.touchend({ touches: [], changedTouches: [touch] });
  } catch (e) { console.log('  touchstart failed:', e.message); }
}

async function main() {
  let mp = await connect();
  mp = await nav(mp, '/pages/game/game?level=2');
  let game = await getPage(mp);
  console.log('game:', game.path);

  // 等发牌动画结束（~3.3s）再截"牌堆就绪"
  await sleep(4800);
  await shot(mp, '20_game_ready.png');

  // 点 5 次牌，让卡槽里有牌（任意牌都可点，点中心区域必然命中牌堆）
  const canvas = await game.$('#board');
  if (!canvas) throw new Error('#board canvas not found');
  const off = await canvas.offset();
  const size = await canvas.size();
  const w = size.width, h = size.height;
  console.log('canvas offset:', JSON.stringify(off), 'size:', w + 'x' + h);
  const points = [[.34, .28], [.55, .42], [.42, .60], [.63, .52], [.50, .74]];
  for (const [fx, fy] of points) {
    await tapBoard(canvas, off, w, h, fx, fy);
    await sleep(750);
  }
  await sleep(500);
  await shot(mp, '21_game_tray.png');

  // 暂停菜单 + 继续游戏
  if (await tap(game, '.round-pause-btn')) {
    await sleep(900);
    await shot(mp, '22_pause_menu.png');
    if (await tap(game, '.menu-action-btn.primary-gradient')) {
      await sleep(800);
      await shot(mp, '23_game_resumed.png');
    }
  }
  try { await mp.disconnect(); } catch (e) {}
  console.log('Done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
