const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../devtools_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('Connecting to DevTools automator...');
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });

  // 1. Home
  console.log('1. Checking home...');
  let page = await mp.currentPage();
  if (page.path !== 'pages/index/index') {
    page = await mp.reLaunch('/pages/index/index');
  }
  await sleep(2000);
  await mp.screenshot({ path: path.join(OUT, '01_home_live.png') });
  console.log('Captured: 01_home_live.png');

  // 2. Lucky Bag
  console.log('2. Tapping lucky bag...');
  const luckyBtn = await page.$('.hotspot-lucky-gift');
  if (luckyBtn) {
    await luckyBtn.tap();
    await sleep(800);
    await mp.screenshot({ path: path.join(OUT, '02_lucky_bag_live.png') });
    console.log('Captured: 02_lucky_bag_live.png');
    const closeLucky = await page.$('.modal-close-circle');
    if (closeLucky) await closeLucky.tap();
    await sleep(500);
  }

  // 3. Piggy Bank
  console.log('3. Tapping piggy bank...');
  const piggyBtn = await page.$('.hotspot-piggy-bank');
  if (piggyBtn) {
    await piggyBtn.tap();
    await sleep(800);
    await mp.screenshot({ path: path.join(OUT, '03_piggy_bank_live.png') });
    console.log('Captured: 03_piggy_bank_live.png');
    const closePiggy = await page.$('.modal-close-btn-ribbon');
    if (closePiggy) await closePiggy.tap();
    await sleep(500);
  }

  // 4. Daily Tasks
  console.log('4. Tapping daily tasks...');
  const taskBtn = await page.$('.hotspot-daily-task');
  if (taskBtn) {
    await taskBtn.tap();
    await sleep(800);
    await mp.screenshot({ path: path.join(OUT, '04_daily_tasks_live.png') });
    console.log('Captured: 04_daily_tasks_live.png');
    const closeTask = await page.$('.modal-close-task');
    if (closeTask) await closeTask.tap();
    await sleep(500);
  }

  // 5. Shop
  console.log('5. Tapping shop...');
  const shopBtn = await page.$('.hotspot-shop');
  if (shopBtn) {
    await shopBtn.tap();
    await sleep(800);
    await mp.screenshot({ path: path.join(OUT, '05_shop_live.png') });
    console.log('Captured: 05_shop_live.png');
    const closeShop = await page.$('.modal-close-task');
    if (closeShop) await closeShop.tap();
    await sleep(500);
  }

  // 6. Game
  console.log('6. Starting game...');
  const startBtn = await page.$('.hotspot-start-game');
  if (startBtn) {
    await startBtn.tap();
    await sleep(3500); // 等待进入页面和发牌
    page = await mp.currentPage();
    console.log('Game page current path:', page.path);
    await mp.screenshot({ path: path.join(OUT, '06_game_live.png') });
    console.log('Captured: 06_game_live.png');

    // 7. Tool Refill
    console.log('7. Tapping tool refill plus button...');
    const plusBtn = await page.$('.tool-add-plus');
    if (plusBtn) {
      await plusBtn.tap();
      await sleep(800);
      await mp.screenshot({ path: path.join(OUT, '07_game_refill_live.png') });
      console.log('Captured: 07_game_refill_live.png');
      const closeRefill = await page.$('.refill-close-btn');
      if (closeRefill) await closeRefill.tap();
      await sleep(500);
    }
  }

  // 8. Cards Page
  console.log('8. Going to cards page...');
  await mp.navigateTo('/pages/cards/cards');
  await sleep(2000);
  await mp.screenshot({ path: path.join(OUT, '08_cards_live.png') });
  console.log('Captured: 08_cards_live.png');

  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  await mp.disconnect();
})().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
