const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  await mp.reLaunch('/pages/game/game');
  await sleep(9000);
  const page = await mp.currentPage();
  const dbg = async () => (await (await page.$('.dbg')).text()).trim();
  console.log('before tap :', await dbg());
  const board = await page.$('#board');
  await board.tap();
  await sleep(700);
  console.log('after tap  :', await dbg());
  await board.touchstart({ touches: [{ identifier: 0, pageX: 150, pageY: 320, x: 150, y: 320 }],
                           changedTouches: [{ identifier: 0, pageX: 150, pageY: 320, x: 150, y: 320 }] });
  await sleep(800);
  console.log('after touch:', await dbg());
  console.log('slots      :', (await page.$$('.slot .slot-face')).length);
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
