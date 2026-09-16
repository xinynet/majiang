const automator = require('miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 120000 });
  const log = [];
  mp.on('console', m => log.push(m.type + ': ' + (m.args || []).map(a => { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return '?'; } }).join(' ')));
  mp.on('exception', e => log.push('EXCEPTION ' + (e && (e.message || JSON.stringify(e)))));
  await mp.reLaunch('/pages/game/game');
  await sleep(10000);
  const page = await mp.currentPage();
  console.log('route:', page.path);
  for (const sel of ['.game', '.g-top', '.board-wrap', '#board', '.g-status', '.g-tray', '.g-dock']) {
    const el = await page.$(sel);
    let size = '';
    if (el) { try { const s = await el.size(); size = ` ${Math.round(s.width)}x${Math.round(s.height)}`; } catch (e) {} }
    console.log((el ? 'FOUND ' : 'MISSING ') + sel + size);
  }
  console.log('console:', JSON.stringify(log.slice(0, 10), null, 1));
  await mp.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
