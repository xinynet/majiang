/* 最终版 v2：轮询等待页面跳转（开发者工具冷启动编译慢）。
 * 开始游戏(扣体力) → 等真正进局 → 等发牌 → 暂停 → 返回首页，两轮后拍图。 */
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
    if (el) { await el.tap(); console.log('tapped ' + selector + ' (try ' + (i + 1) + ')'); return true; }
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
  throw new Error('devtools never accepted a connection on 9420');
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
async function ensureIndex(mp) {
  let page = await getPage(mp, 5).catch(() => null);
  if (page && (page.path || '').includes('index')) return page;
  try { await mp.reLaunch('/pages/index/index'); } catch (e) {}
  page = await waitPath(mp, 'index', 20);
  if (!page) throw new Error('cannot reach index');
  return page;
}

async function main() {
  let mp = await connect();
  let page = await ensureIndex(mp);
  console.log('at index');

  for (let round = 1; round <= 2; round++) {
    if (!(await tapRetry(page, '.hotspot-start-game'))) throw new Error('start hotspot missing');
    page = await waitPath(mp, 'game', 30);
    if (!page) throw new Error('round ' + round + ': never reached game');
    console.log('  round ' + round + ' in game');
    await sleep(4500); // 等发牌结束
    if (await tapRetry(page, '.round-pause-btn')) {
      await sleep(1100);
      await tapRetry(page, '.menu-action-btn.neutral-gradient', 4, 1400);
    }
    page = await ensureIndex(mp);
    await sleep(1500);
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
