const automator = require('miniprogram-automator');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
  console.log('Connected!');

  console.log('Navigating to /pages/game/game via evaluate...');
  await mp.evaluate(() => {
    wx.navigateTo({ url: '/pages/game/game?level=2' });
  });
  await sleep(4000);

  await mp.screenshot({ path: 'devtools_shots/06_game_live.png' });
  console.log('Saved 06_game_live.png');

  // Trigger tool refill
  await mp.evaluate(() => {
    // In game.vue, open tool buy modal
    const curPages = getCurrentPages();
    const p = curPages[curPages.length - 1];
    if (p && p.$vm && p.$vm.openBuyToolModal) {
      p.$vm.openBuyToolModal('shuffle');
    }
  });
  await sleep(1500);
  await mp.screenshot({ path: 'devtools_shots/07_game_refill_live.png' });
  console.log('Saved 07_game_refill_live.png');

  // Close modal and navigate to cards
  console.log('Navigating to /pages/cards/cards...');
  await mp.evaluate(() => {
    wx.navigateTo({ url: '/pages/cards/cards' });
  });
  await sleep(3000);
  await mp.screenshot({ path: 'devtools_shots/08_cards_live.png' });
  console.log('Saved 08_cards_live.png');

  console.log('Completed successfully!');
  await mp.disconnect();
})().catch(console.error);
