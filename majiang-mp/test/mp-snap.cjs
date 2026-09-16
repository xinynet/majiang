const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  const errors = [];
  mp.on('console', m => { if (m.type === 'error') errors.push(JSON.stringify(m.args)); });
  await sleep(12000);
  const page = await mp.currentPage();
  console.log('route:', page.path);
  try {
    const stats = await (await page.$('.g-status')).text();
    console.log('status:', stats.replace(/\s+/g, ' ').trim());
    console.log('slots :', (await page.$$('.g-slot')).length, '| tools:', (await page.$$('.g-prop')).length);
  } catch (e) { console.log('dom read:', e.message); }
  await mp.screenshot({ path: require('path').resolve(__dirname, '../mp-screenshot.png') });
  console.log('errors:', errors.length ? errors.slice(0, 3) : 'none');
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
