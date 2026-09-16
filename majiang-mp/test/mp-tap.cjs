const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  const seen = [];
  mp.on('console', m => seen.push(m.type + ': ' + (m.args || []).map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return '?'; }
  }).join(' ')));
  mp.on('exception', e => seen.push('EXCEPTION ' + (e && (e.message || JSON.stringify(e)))));

  await mp.reLaunch('/pages/game/game');
  await sleep(9000);
  const page = await mp.currentPage();
  const board = await page.$('#board');
  const size = await board.size();
  console.log('board size:', JSON.stringify(size));

  // what does a synthesized tap actually deliver to the handler?
  await board.tap();
  await sleep(600);
  // and an explicit touch with coordinates
  await board.touchstart({ touches: [{ identifier: 0, pageX: 120, pageY: 300, x: 120, y: 300 }],
                           changedTouches: [{ identifier: 0, pageX: 120, pageY: 300, x: 120, y: 300 }] });
  await sleep(900);
  const filled = (await page.$$('.slot .slot-face')).length;
  console.log('filled slots after tap + touchstart:', filled);
  console.log('console:', JSON.stringify(seen.slice(0, 8), null, 1));
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
