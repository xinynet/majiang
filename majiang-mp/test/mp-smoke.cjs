/* Smoke test against the real mini-program runtime in WeChat DevTools.
 * Run after `npm run build:mp-weixin`. Requires DevTools installed and its
 * security setting "服务端口" (CLI port) enabled. */
const automator = require('miniprogram-automator');
const path = require('path');

const CLI = process.env.WX_CLI || 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat';
const PROJECT = path.resolve(__dirname, '../dist/build/mp-weixin');

const PORT = process.env.WX_AUTO_PORT || 9420;

/* Connects to a DevTools instance already running with automation enabled:
 *   cli.bat auto --project <dist> --auto-port 9420
 * automator.launch() wants to start the IDE itself and does not find this
 * install, so the port is opened separately and we just attach. */
(async () => {
  const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}`, timeout: 120000 });
  console.log('connected ok');

  const errors = [];
  mp.on('console', m => { if (m.type === 'error') errors.push(String(m.args)); });
  mp.on('exception', e => errors.push('EXCEPTION ' + (e && e.message)));

  const page = await mp.currentPage();
  console.log('route:', page.path);
  await new Promise(r => setTimeout(r, 7000)); // deal animation

  const data = await page.data();
  const v = data.view || {};
  console.log('view:', JSON.stringify({ level: v.level, initial: v.initial, types: v.types,
    remaining: v.remaining, dealing: v.dealing, slots: (v.slots || []).length, tools: v.tools }));

  console.log('canvas present:', !!(await page.$('#board')));
  console.log('tool buttons:', (await page.$$('.tool')).length);
  console.log('tray slots:', (await page.$$('.slot')).length);

  // tap the board where a tile must be, and check a slot fills
  const before = (await page.data()).view.slots.length;
  const board = await page.$('#board');
  const box = await board.size();
  await board.tap();
  await new Promise(r => setTimeout(r, 900));
  const after = (await page.data()).view.slots.length;
  console.log('board size:', JSON.stringify(box), 'slots', before, '->', after);

  // a tool must consume a use
  const toolsBefore = (await page.data()).view.tools.shuffle;
  const btns = await page.$$('.tool');
  await btns[1].tap();
  await new Promise(r => setTimeout(r, 800));
  console.log('shuffle uses', toolsBefore, '->', (await page.data()).view.tools.shuffle);

  console.log('errors:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await mp.disconnect();
  console.log('done');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
