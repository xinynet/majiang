/* Integration test against the real mini-program runtime.
 * The game rules themselves are covered by the store tests; what matters here is
 * that canvas picking, the tray, the tools and the clock survive the port. */
const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const touch = (el, x, y) => el.touchstart({
  touches: [{ identifier: 0, x, y, pageX: x, pageY: y }],
  changedTouches: [{ identifier: 0, x, y, pageX: x, pageY: y }],
});

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  const errors = [];
  mp.on('console', m => { if (m.type === 'error') errors.push(JSON.stringify(m.args)); });
  mp.on('exception', e => errors.push('EXCEPTION ' + (e && (e.message || JSON.stringify(e)))));

  await mp.reLaunch('/pages/game/game');
  await sleep(9000);
  const page = await mp.currentPage();
  const stats = async () => (await (await page.$('.stats')).text()).replace(/\s+/g, ' ').trim();
  const slots = async () => (await page.$$('.slot .slot-face')).length;
  const tool = async i => (await (await page.$$('.tool'))[i].text()).replace(/\s+/g, ' ').trim();
  const clock = async () => (await (await page.$('.timer')).text()).trim();

  console.log('dealt      :', await stats(), '| tray', await slots(), '| clock', await clock());

  const board = await page.$('#board');
  const size = await board.size();
  for (const [x, y] of [[120, 250], [200, 330], [150, 420], [250, 480]]) {
    await touch(board, x, y);
    await sleep(600);
  }
  console.log('4 taps     :', await stats(), '| tray', await slots());

  const beforeClear = await stats();
  await (await page.$$('.tool'))[0].tap();
  await sleep(1300);
  console.log('clear tool :', beforeClear, '->', await stats(), '| uses', await tool(0));

  await (await page.$$('.tool'))[2].tap();   // undo: put the last tray tile back
  await sleep(900);
  console.log('undo tool  : tray ->', await slots(), '| uses', await tool(2));

  const c1 = await clock();
  await sleep(2500);
  console.log('clock runs :', c1, '->', await clock());

  console.log('board size :', JSON.stringify(size));
  console.log('errors     :', errors.length ? JSON.stringify(errors.slice(0, 4)) : 'none');
  await mp.screenshot({ path: require('path').resolve(__dirname, '../mp-screenshot.png') });
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
