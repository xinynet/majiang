/* Burst capture over the deal window, to check the shuffle hands render.
 *
 * The deal is under two seconds at the shipped timings and one automator
 * screenshot costs about two, so this is only useful against a build with
 * DEAL_STAGGER/DEAL_DURATION temporarily stretched. It waits for the splash to
 * hand over before launching the game page, otherwise reLaunch lands on a
 * simulator that has no page yet. */
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
  if (!mp) throw new Error('devtools never accepted a connection on 9420');

  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try { const p = await mp.currentPage(); ready = !!(p && /index/.test(p.path)); } catch (e) {}
    if (!ready) await sleep(2000);
  }
  if (!ready) throw new Error('home page never came up');

  await mp.reLaunch('/pages/game/game?level=2');
  const t0 = Date.now();
  for (let i = 0; i < 8; i++) {
    await mp.screenshot({ path: path.join(SHOTS, `deal_${i}.png`) });
    console.log(i, Date.now() - t0, 'ms');
  }
  await mp.disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
