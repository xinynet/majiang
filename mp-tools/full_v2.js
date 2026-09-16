const automator = require('miniprogram-automator');
const path = require('path');
const fs2 = require('fs');
const WS_ENDPOINT = 'ws://127.0.0.1:9420';
const SHOTS_DIR = path.join(__dirname, '..', 'devtools_shots');
if (!fs2.existsSync(SHOTS_DIR)) fs2.mkdirSync(SHOTS_DIR, { recursive: true });
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function connectMP() {
  const mp = await automator.connect({ wsEndpoint: WS_ENDPOINT, timeout: 30000 });
  console.log('Connected');
  return mp;
}
async function getPage(mp, retries) {
  retries = retries || 15;
  for (let i=0; i<retries; i++) {
    try { const p = await mp.currentPage(); if(p) return p; } catch(e){}
    console.log('waiting page ' + (i+1));
    await sleep(1000);
  }
  throw new Error('no page');
}
async function shot(mp, name) {
  const p = path.join(SHOTS_DIR, name);
  await mp.screenshot({path: p});
  console.log('Shot: ' + name);
}
async function nav(mp, url) {
  try { await mp.reLaunch(url); } catch(e){}
  await sleep(2000);
  try { await mp.disconnect(); } catch(e){}
  await sleep(2000);
  return connectMP();
}
async function main() {
  let mp = await connectMP();
  mp = await nav(mp, '/pages/index/index');
  await sleep(2000);
  let pg = await getPage(mp);
  await shot(mp, '01_home_live.png');
  try { await pg.callMethod('openLuckyBag'); await sleep(1500); await shot(mp, '02_lucky_bag_live.png'); await pg.callMethod('closeLuckyModal'); await sleep(800); } catch(e){ console.log('02:'+e.message); }
  try { await pg.callMethod('openPiggyBank'); await sleep(1500); await shot(mp, '03_piggy_bank_live.png'); await pg.callMethod('closePiggyModal'); await sleep(800); } catch(e){ console.log('03:'+e.message); }
  try { await pg.callMethod('openDailyTasks'); await sleep(1500); await shot(mp, '04_daily_tasks_live.png'); await pg.callMethod('closeTasksModal'); await sleep(800); } catch(e){ console.log('04:'+e.message); }
  try { await pg.callMethod('openShopAll'); await sleep(1500); await shot(mp, '05_shop_live.png'); await pg.callMethod('closeShopModal'); await sleep(800); } catch(e){ console.log('05:'+e.message); }
  mp = await nav(mp, '/pages/game/game?level=2');
  await sleep(3000);
  pg = await getPage(mp);
  await shot(mp, '06_game_live.png');
  try { await pg.callMethod('openRefill', 'shuffle'); await sleep(1500); await shot(mp, '07_game_refill_live.png'); } catch(e){ console.log('07:'+e.message); }
  mp = await nav(mp, '/pages/cards/cards');
  await sleep(3000);
  await getPage(mp);
  await shot(mp, '08_cards_live.png');
  try { await mp.disconnect(); } catch(e){}
  console.log('All done!');
}
main().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });