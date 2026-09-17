/* Catches the splash while it is still on screen.
 * It hands over to the home page after about 2s, so this connects first and
 * then reLaunches to it, shooting immediately. */
const automator = require('miniprogram-automator');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'devtools_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let mp = null;
  for (let a = 0; a < 24 && !mp; a++) {
    try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(5000); }
  }
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try { const p = await mp.currentPage(); ready = !!(p && p.path); } catch (e) {}
    if (!ready) await sleep(2000);
  }
  await mp.reLaunch('/pages/splash/splash');
  for (let i = 0; i < 3; i++) {
    await mp.screenshot({ path: path.join(SHOTS, `00_splash_${i}.png`) });
    console.log('shot', i);
  }
  await mp.disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
