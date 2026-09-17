/* 重拍体力系统截图 v4（暴力版）：
 * 强制翻转 GM 开关一次 → 逐轮验证跳转 → 拍体力截图。GM 模式保持关闭（上线态）。 */
const automator = require('miniprogram-automator');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'devtools_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOTS, name) });
  console.log('Shot: ' + name);
}
async function tapRetry(page, selector, tries = 5, gap = 1500) {
  for (let i = 0; i < tries; i++) {
    const el = await page.$(selector);
    if (el) { await el.tap(); console.log('tapped ' + selector + ' (try ' + (i + 1) + ')'); return true; }
    await sleep(gap);
  }
  console.log('  (missing) ' + selector);
  return false;
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
async function pathOf(mp) {
  const p = await getPage(mp, 5).catch(() => null);
  return p ? p.path : '(none)';
}

async function main() {
  let mp = await connect();
  mp = await nav(mp, '/pages/index/index');
  let page = await getPage(mp);

  // 1) 强制翻转 GM 开关一次（不管读到的状态是什么）
  if (await tapRetry(page, '.hotspot-gear', 3, 1200)) {
    await sleep(900);
    const switches = await page.$$('.settings-dialog switch');
    console.log('switch count:', switches.length);
    if (switches.length >= 4) {
      console.log('gm attr before:', await switches[3].attribute('checked'));
      await switches[3].tap();
      await sleep(600);
      console.log('gm attr after :', await switches[3].attribute('checked'));
    }
    await tapRetry(page, '.dialog-confirm-btn', 3, 1000);
    await sleep(900);
  }

  // 2) 两轮：开始游戏（必须真的跳转到 game）→ 暂停 → 返回首页
  for (let round = 1; round <= 2; round++) {
    if (!(await pathOf(mp)).includes('index')) { mp = await nav(mp, '/pages/index/index'); page = await getPage(mp); }
    await tapRetry(page, '.hotspot-start-game', 3, 1500);
    await sleep(3000);
    let where = await pathOf(mp);
    console.log('after start tap, at:', where);
    if (!where.includes('game')) {
      // 再试一次
      await tapRetry(page, '.hotspot-start-game', 2, 1500);
      await sleep(3000);
      where = await pathOf(mp);
      console.log('after 2nd start tap, at:', where);
    }
    if (where.includes('game')) {
      await sleep(4000);
      page = await getPage(mp);
      if (await tapRetry(page, '.round-pause-btn')) {
        await sleep(1000);
        await tapRetry(page, '.menu-action-btn.neutral-gradient', 4, 1200);
        await sleep(2000);
      } else {
        mp = await nav(mp, '/pages/index/index');
      }
    } else {
      mp = await nav(mp, '/pages/index/index');
    }
    page = await getPage(mp);
    console.log('round ' + round + ' done, at:', page.path);
  }

  // 3) 拍体力倒计时 + 体力弹窗
  await shot(mp, '27_stamina_countdown.png');
  await tapRetry(page, '.hotspot-stamina', 4, 1500);
  await sleep(1500);
  await shot(mp, '24_stamina_modal.png');

  try { await mp.disconnect(); } catch (e) {}
  console.log('Done! (GM 开发者模式保持关闭)');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
