const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../devtools_shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Connecting to WeChat DevTools automator on port 9420...');
  const mp = await automator.connect({
    wsEndpoint: 'ws://127.0.0.1:9420',
    timeout: 120000
  });
  console.log('Connected successfully!');

  // 1. 首页测试与截图
  console.log('Navigating to pages/index/index...');
  const homePage = await mp.reLaunch('/pages/index/index');
  await sleep(3000); // 等待图片和样式渲染稳定

  const homeShot = path.join(OUT_DIR, '01_home.png');
  await mp.screenshot({ path: homeShot });
  console.log('Saved home screenshot:', homeShot);

  // 2. 点击幸运礼包
  console.log('Testing Lucky Bag modal...');
  const luckyBtn = await homePage.$('.hotspot-lucky-gift');
  if (luckyBtn) {
    await luckyBtn.tap();
    await sleep(1000);
    const luckyShot = path.join(OUT_DIR, '02_lucky_bag.png');
    await mp.screenshot({ path: luckyShot });
    console.log('Saved lucky bag screenshot:', luckyShot);
    const closeBtn = await homePage.$('.modal-close-circle');
    if (closeBtn) await closeBtn.tap();
    await sleep(500);
  }

  // 3. 点击存钱罐 (金库银行)
  console.log('Testing Piggy Bank modal...');
  const piggyBtn = await homePage.$('.hotspot-piggy-bank');
  if (piggyBtn) {
    await piggyBtn.tap();
    await sleep(1000);
    const piggyShot = path.join(OUT_DIR, '03_piggy_bank.png');
    await mp.screenshot({ path: piggyShot });
    console.log('Saved piggy bank screenshot:', piggyShot);
    const closeBtn = await homePage.$('.modal-close-btn-ribbon');
    if (closeBtn) await closeBtn.tap();
    await sleep(500);
  }

  // 4. 点击每日任务
  console.log('Testing Daily Tasks modal...');
  const taskBtn = await homePage.$('.hotspot-daily-task');
  if (taskBtn) {
    await taskBtn.tap();
    await sleep(1000);
    const taskShot = path.join(OUT_DIR, '04_daily_tasks.png');
    await mp.screenshot({ path: taskShot });
    console.log('Saved daily tasks screenshot:', taskShot);
    const closeBtn = await homePage.$('.modal-close-task');
    if (closeBtn) await closeBtn.tap();
    await sleep(500);
  }

  // 5. 点击商店
  console.log('Testing Shop modal...');
  const shopBtn = await homePage.$('.hotspot-shop');
  if (shopBtn) {
    await shopBtn.tap();
    await sleep(1000);
    const shopShot = path.join(OUT_DIR, '05_shop.png');
    await mp.screenshot({ path: shopShot });
    console.log('Saved shop screenshot:', shopShot);
    const closeBtn = await homePage.$('.modal-close-task');
    if (closeBtn) await closeBtn.tap();
    await sleep(500);
  }

  // 6. 测试进入游戏 (开始游戏)
  console.log('Testing Start Game...');
  const startBtn = await homePage.$('.hotspot-start-game');
  if (startBtn) {
    await startBtn.tap();
    await sleep(4000); // 等待发牌动画完成
    const gameShot = path.join(OUT_DIR, '06_game.png');
    await mp.screenshot({ path: gameShot });
    console.log('Saved game screen screenshot:', gameShot);

    // 测试道具补给弹窗
    const gamePage = await mp.currentPage();
    console.log('Current page:', gamePage.path);
    const plusBtn = await gamePage.$('.tool-add-plus');
    if (plusBtn) {
      await plusBtn.tap();
      await sleep(1000);
      const refillShot = path.join(OUT_DIR, '07_game_refill.png');
      await mp.screenshot({ path: refillShot });
      console.log('Saved tool refill screenshot:', refillShot);
      const closeRefill = await gamePage.$('.refill-close-btn');
      if (closeRefill) await closeRefill.tap();
      await sleep(500);
    }
  }

  // 7. 测试集卡中心 (pages/cards/cards)
  console.log('Testing Cards page...');
  const cardsPage = await mp.reLaunch('/pages/cards/cards');
  await sleep(3000);
  const cardsShot = path.join(OUT_DIR, '08_cards.png');
  await mp.screenshot({ path: cardsShot });
  console.log('Saved cards page screenshot:', cardsShot);

  console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
  await mp.disconnect();
})().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
