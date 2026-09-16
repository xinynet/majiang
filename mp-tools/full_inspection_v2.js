/**
 * Full inspection script v2 - 截取所有8个场景
 */
const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const WS_ENDPOINT = 'ws://127.0.0.1:9420';
const SHOTS_DIR = path.join(__dirname, '..', 'devtools_shots');

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectMP() {
  console.log('Connecting to DevTools automator...');
  const mp = await automator.connect({ wsEndpoint: WS_ENDPOINT, timeout: 30000 });
  console.log('Connected!');
  return mp;
}

async function getCurrentPage(mp, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      const page = await mp.currentPage();
      if (page) return page;
    } catch (e) {}
    console.log(Waiting for page... /);
    await sleep(1000);
  }
  throw new Error('Failed to get current page');
}

async function tapElement(page, selector) {
  try {
    const el = await page.;
    if (el) { await el.tap(); return true; }
  } catch (e) { console.warn(Failed to tap : ); }
  return false;
}

async function screenshot(mp, filename) {
  const filepath = path.join(SHOTS_DIR, filename);
  await mp.screenshot({ path: filepath });
  console.log('Screenshot:', filename);
  return filepath;
}

async function navigateTo(mp, url) {
  try { await mp.reLaunch(url); } catch (e) { console.warn('reLaunch err:', e.message); }
  await sleep(2000);
  try { await mp.disconnect(); } catch(e){}
  await sleep(2000);
  return await connectMP();
}

async function main() {
  let mp = await connectMP();

  // 01. 首页
  mp = await navigateTo(mp, '/pages/index/index');
  await sleep(2000);
  let page = await getCurrentPage(mp);
  await screenshot(mp, '01_home_live.png');
  console.log('01 home OK');

  // 02. 幸运礼包
  try {
    await page.callMethod('openLuckyBag');
    await sleep(1500);
    await screenshot(mp, '02_lucky_bag_live.png');
    console.log('02 lucky bag OK');
    await page.callMethod('closeLuckyModal');
    await sleep(800);
  } catch(e) { console.error('02:', e.message); }

  // 03. 金库银行
  try {
    await page.callMethod('openPiggyBank');
    await sleep(1500);
    await screenshot(mp, '03_piggy_bank_live.png');
    console.log('03 piggy bank OK');
    await page.callMethod('closePiggyModal');
    await sleep(800);
  } catch(e) { console.error('03:', e.message); }

  // 04. 每日任务
  try {
    await page.callMethod('openDailyTasks');
    await sleep(1500);
    await screenshot(mp, '04_daily_tasks_live.png');
    console.log('04 daily tasks OK');
    await page.callMethod('closeTasksModal');
    await sleep(800);
  } catch(e) { console.error('04:', e.message); }

  // 05. 商城
  try {
    await page.callMethod('openShopAll');
    await sleep(1500);
    await screenshot(mp, '05_shop_live.png');
    console.log('05 shop OK');
    await page.callMethod('closeShopModal');
    await sleep(800);
  } catch(e) { console.error('05:', e.message); }

  // 06. 游戏页
  mp = await navigateTo(mp, '/pages/game/game?level=2');
  await sleep(3000);
  page = await getCurrentPage(mp);
  await screenshot(mp, '06_game_live.png');
  console.log('06 game OK');

  // 07. 道具补给弹窗
  try {
    await page.callMethod('openRefill', 'shuffle');
    await sleep(1500);
    await screenshot(mp, '07_game_refill_live.png');
    console.log('07 refill OK');
  } catch(e) { console.error('07:', e.message); }

  // 08. 集卡页
  mp = await navigateTo(mp, '/pages/cards/cards');
  await sleep(3000);
  await getCurrentPage(mp);
  await screenshot(mp, '08_cards_live.png');
  console.log('08 cards OK');

  try { await mp.disconnect(); } catch(e) {}
  console.log('All done! Shots in:', SHOTS_DIR);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
