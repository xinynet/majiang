const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../devtools_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('Connecting...');
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
  const page = await mp.currentPage();
  console.log('Page:', page.path);

  // Lucky bag
  console.log('Opening Lucky Bag...');
  const el1 = await page.$('.hotspot-lucky-gift');
  if (el1) {
    await el1.tap();
    await sleep(1500);
    await mp.screenshot({ path: path.join(OUT, '02_lucky_bag_live.png') });
    console.log('02 saved');
    const c1 = await page.$('.modal-close-circle');
    if (c1) await c1.tap();
    await sleep(800);
  }

  // Piggy bank
  console.log('Opening Piggy Bank...');
  const el2 = await page.$('.hotspot-piggy-bank');
  if (el2) {
    await el2.tap();
    await sleep(1500);
    await mp.screenshot({ path: path.join(OUT, '03_piggy_bank_live.png') });
    console.log('03 saved');
    const c2 = await page.$('.modal-close-btn-ribbon');
    if (c2) await c2.tap();
    await sleep(800);
  }

  // Daily tasks
  console.log('Opening Daily Tasks...');
  const el3 = await page.$('.hotspot-daily-task');
  if (el3) {
    await el3.tap();
    await sleep(1500);
    await mp.screenshot({ path: path.join(OUT, '04_daily_tasks_live.png') });
    console.log('04 saved');
    const c3 = await page.$('.modal-close-task');
    if (c3) await c3.tap();
    await sleep(800);
  }

  // Shop
  console.log('Opening Shop...');
  const el4 = await page.$('.hotspot-shop');
  if (el4) {
    await el4.tap();
    await sleep(1500);
    await mp.screenshot({ path: path.join(OUT, '05_shop_live.png') });
    console.log('05 saved');
    const c4 = await page.$('.modal-close-task');
    if (c4) await c4.tap();
    await sleep(800);
  }

  await mp.disconnect();
  console.log('All modals captured successfully!');
})().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
