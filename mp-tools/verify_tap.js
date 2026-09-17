/* Real-coordinate tap check.
 *
 * Fires synthetic touches in the SAME coordinate space a real finger produces -
 * viewport clientX/clientY, i.e. offset by the board's own position on screen -
 * and counts how many removed a tile. The board's offset is summed from the
 * elements stacked above it, because automator's Element has no offsetTop.
 *
 * Two things would otherwise make a healthy board look dead: the tray refuses
 * every pick once it holds seven tiles, and taps that land on bare felt are
 * supposed to do nothing. So the round is restarted well before the tray fills,
 * and the grid is reported as a map - what matters is that the O's trace the
 * pile, not that every point hits. */
const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REMAIN = 'k', SLOTS = 'o'; // 剩余数量 / 卡槽, in the compiled data
const LEVEL = '/pages/game/game?level=2';

async function heightOf(page, sel) {
  const el = await page.$(sel);
  if (!el) return 0;
  return (await el.size()).height;
}

(async () => {
  let mp = null;
  for (let a = 0; a < 24 && !mp; a++) {
    try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 60000 }); }
    catch (e) { await sleep(5000); }
  }
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try { const p = await mp.currentPage(); ready = !!(p && /index/.test(p.path)); } catch (e) {}
    if (!ready) await sleep(2000);
  }
  await mp.reLaunch(LEVEL);
  await sleep(4500);
  let page = await mp.currentPage();
  let board = await page.$('#board');
  const rect = await board.size();
  const offTop = await heightOf(page, '.game-top-bar') + await heightOf(page, '.g-status-custom');
  console.log('board', JSON.stringify(rect), 'board top on screen', offTop);

  let hits = 0, tries = 0;
  for (let fy = 0.05; fy < 0.98; fy += 0.07) {
    let row = '';
    for (let fx = 0.05; fx < 0.98; fx += 0.05) {
      const cx = Math.round(rect.width * fx);
      const cy = Math.round(offTop + rect.height * fy); // viewport coords, like a finger
      const r0 = Number(await page.data(REMAIN));
      const t = { identifier: 0, clientX: cx, clientY: cy, pageX: cx, pageY: cy, force: 1 };
      await board.touchstart({ touches: [t], changedTouches: [t] });
      await sleep(150);
      const r1 = Number(await page.data(REMAIN));
      tries++;
      if (r1 !== r0) { hits++; row += 'O'; } else row += '.';
      const slots = (await page.data(SLOTS)) || [];
      if (slots.filter(s => s && s.d).length >= 4 || r1 <= 8) {
        await mp.reLaunch(LEVEL);
        await sleep(4200);
        page = await mp.currentPage();
        board = await page.$('#board');
      }
    }
    console.log(fy.toFixed(2), row);
  }
  console.log(`taps that removed a tile: ${hits}/${tries} = ${(hits / tries * 100).toFixed(0)}%`);
  await mp.disconnect();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
