const automator = require('miniprogram-automator');
const path = require('path');
const OUT = path.resolve(__dirname, '../mp-screenshot.png');
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  const errors = [];
  mp.on('console', m => { if (m.type === 'error') errors.push(String(m.args)); });
  mp.on('exception', e => errors.push('EXCEPTION ' + (e && e.message)));
  const page = await mp.currentPage();
  console.log('route:', page.path);
  await new Promise(r => setTimeout(r, 8000));
  // what the page actually holds
  const d = await page.data();
  console.log('data keys:', Object.keys(d || {}).join(','));
  console.log('bindings:', JSON.stringify(d).slice(0, 300));
  await mp.screenshot({ path: OUT });
  console.log('screenshot ->', OUT);
  console.log('errors:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
