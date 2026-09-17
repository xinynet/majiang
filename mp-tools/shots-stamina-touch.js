/* 用坐标触摸翻转 GM 开关（el.tap() 不触发 switch 的 change 事件），
 * 成功后两轮扣体力 → 拍体力倒计时 + 弹窗。 */
const automator = require('miniprogram-automator');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'devtools_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOTS, name) });
  console.log('Shot: ' + name);
}
async function tapRetry(page, selector, tries = 5, gap = 1800) {
  for (let i = 0; i < tries; i++) {
    const el = await page.$(selector);
    if (el) { await el.tap(); console.log('tapped ' + selector); return true; }
    await sleep(gap);
  }
  console.log('  (missing) ' + selector);
  return false;
}
async function connect() {
  for (let i = 0; i < 30; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(3000); }
  }
  throw new Error('no automator on 9420');
}
async function getPage(mp, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try { const p = await mp.currentPage(); if (p) return p; } catch (e) {}
    await sleep(1000);
  }
  return null;
}
async function waitPath(mp, substr, tries = 30, gap = 1500) {
  for (let i = 0; i < tries; i++) {
    const p = await getPage(mp, 3);
    if (p && (p.path || '').includes(substr)) return p;
    await sleep(gap);
  }
  return null;
}
async function touchCenter(el) {
  const off = await el.offset(), size = await el.size();
  const x = Math.round(off.left + size.width / 2), y = Math.round(off.top + size.height / 2);
  const t = { identifier: 0, x, y, clientX: x, clientY: y, pageX: x, pageY: y };
  await el.touchstart({ touches: [t], changedTouches: [t] });
  await sleep(80);
  await el.touchend({ touches: [], changedTouches: [t] });
}

async function main() {
  let mp = await connect();
  let page = await waitPath(mp, 'index', 20);
  if (!page) throw new Error('not on index');

  // 打开设置 → 坐标触摸 GM 开关 → 验证 attr 变化
  await tapRetry(page, '.hotspot-gear', 3, 1200);
  await sleep(900);
  const switches = await page.$$('.settings-dialog switch');
  if (switches.length < 4) throw new Error('switches not found');
  const gm = switches[3];
  console.log('gm before:', await gm.attribute('checked'));
  await touchCenter(gm);
  await sleep(700);
  console.log('gm after :', await gm.attribute('checked'));
  await tapRetry(page, '.dialog-confirm-btn', 3, 1000);
  await sleep(800);

  // 两轮扣体力
  for (let round = 1; round <= 2; round++) {
    if (!(await tapRetry(page, '.hotspot-start-game'))) throw new Error('start missing');
    page = await waitPath(mp, 'game', 30);
    if (!page) throw new Error('round ' + round + ': no game');
    console.log('  round ' + round + ' in game');
    await sleep(4500);
    if (await tapRetry(page, '.round-pause-btn')) {
      await sleep(1100);
      await tapRetry(page, '.menu-action-btn.neutral-gradient', 4, 1400);
    }
    page = await waitPath(mp, 'index', 20);
    await sleep(1200);
    console.log('  round ' + round + ' back home');
  }

  await shot(mp, '27_stamina_countdown.png');
  await tapRetry(page, '.hotspot-stamina', 5, 1800);
  await sleep(1600);
  await shot(mp, '24_stamina_modal.png');

  try { await mp.disconnect(); } catch (e) {}
  console.log('Done!');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
