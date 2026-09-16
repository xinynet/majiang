const automator = require('miniprogram-automator');
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 15000 });
  const page = await mp.currentPage();
  console.log('Current page path:', page.path);
  const homeBg = await page.$('.home-bg');
  console.log('Home bg element exists:', !!homeBg);
  const data = await page.data();
  console.log('Page data keys:', Object.keys(data || {}));
  await mp.disconnect();
})().catch(console.error);
