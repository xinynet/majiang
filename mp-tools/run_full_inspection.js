const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../devtools_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getPage(mp) {
  for (let i = 0; i < 15; i++) {
    try {
      const page = await mp.currentPage();
      if (page) return page;
    } catch (e) {
      await sleep(1000);
    }
  }
  throw new Error('Failed to get currentPage after retries');
}

(async () => {
  console.log('Connecting to DevTools automator on 9420...');
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
  console.log('Connected!');

  try {
    await mp.evaluate(() => { try { wx.clearStorageSync(); } catch(e){} });
  } catch (e) {
    console.log('clearStorage eval note:', e.message);
  }

  // 1. Home
  console.log('1. Home page inspection...');
  const page = await getPage(mp);
  console.log('Current page path:', page.path);
  await sleep(1500);
  await mp.screenshot({ path: path.join(OUT, '01_home_live.png') });
  console.log('Saved 01_home_live.png');

  // 2. Lucky Bag
  console.log('2. Lucky Bag modal...');
  const luckyBtn = await page.$('.hotspot-lucky-gift');
  if (luckyBtn) {
    await luckyBtn.tap();
    await sleep(1000);
    await mp.screenshot({ path: path.join(OUT, '02_lucky_bag_live.png') });
    console.log('Saved 02_lucky_bag_live.png');
    const closeBtn = await page.$('.modal-close-circle');
    if (closeBtn) await closeBtn.tap();
    await sleep(600);
  }

  // 3. Piggy Bank
  console.log('3. Piggy Bank modal...');
  const piggyBtn = await page.$('.hotspot-piggy-bank');
  if (piggyBtn) {
    await piggyBtn.tap();
    await sleep(1000);
    await mp.screenshot({ path: path.join(OUT, '03_piggy_bank_live.png') });
    console.log('Saved 03_piggy_bank_live.png');
    const closeBtn = await page.$('.modal-close-btn-ribbon');
    if (closeBtn) await closeBtn.tap();
    await sleep(600);
  }

  // 4. Daily Tasks
  console.log('4. Daily Tasks modal...');
  const taskBtn = await page.$('.hotspot-daily-task');
  if (taskBtn) {
    await taskBtn.tap();
    await sleep(1000);
    await mp.screenshot({ path: path.join(OUT, '04_daily_tasks_live.png') });
    console.log('Saved 04_daily_tasks_live.png');
    const closeBtn = await page.$('.modal-close-task');
    if (closeBtn) await closeBtn.tap();
    await sleep(600);
  }

  // 5. Shop
  console.log('5. Shop modal...');
  const shopBtn = await page.$('.hotspot-shop');
  if (shopBtn) {
    await shopBtn.tap();
    await sleep(1000);
    await mp.screenshot({ path: path.join(OUT, '05_shop_live.png') });
    console.log('Saved 05_shop_live.png');
    const closeBtn = await page.$('.modal-close-task');
    if (closeBtn) await closeBtn.tap();
    await sleep(600);
  }

  // 6. Start Game
  console.log('6. Starting Game...');
  const startBtn = await page.$('.hotspot-start-game');
  if (startBtn) {
    await startBtn.tap();
    await sleep(4000);
    const gamePage = await getPage(mp);
    console.log('Game page path:', gamePage.path);
    await mp.screenshot({ path: path.join(OUT, '06_game_live.png') });
    console.log('Saved 06_game_live.png');

    // 7. Tool refill
    console.log('7. Tool refill modal...');
    const plusBtn = await gamePage.$('.tool-add-plus');
    if (plusBtn) {
      await plusBtn.tap();
      await sleep(1000);
      await mp.screenshot({ path: path.join(OUT, '07_game_refill_live.png') });
      console.log('Saved 07_game_refill_live.png');
      const closeRefill = await gamePage.$('.refill-close-btn');
      if (closeRefill) await closeRefill.tap();
      await sleep(600);
    }
  }

  // 8. Cards Page
  console.log('8. Cards page...');
  await mp.reLaunch('/pages/cards/cards');
  await sleep(3000);
  await mp.screenshot({ path: path.join(OUT, '08_cards_live.png') });
  console.log('Saved 08_cards_live.png');

  console.log('Inspection finished successfully!');
  await mp.disconnect();
})().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
