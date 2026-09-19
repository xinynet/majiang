// playtest-extra.cjs -> 追测：start-game 跳转时间线 + cards 页真实图片检查
const automator = require('miniprogram-automator');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const QA_OUT = 'C:/Users/Administrator/WorkBuddy AI/2026-09-18-01-19-11';
const DIST = 'C:/mydev/majiang/majiang-mp/dist/build/mp-weixin';
const IDE_EXE = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\微信开发者工具.exe';
const out = { navHookFired: [], timeline: [], cardsImages: null, errors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.on('unhandledRejection', (e) => console.log('[extra] unhandledRejection kept alive:', (e && e.message) || e));
// RPC 重试：竞速的落选方 reject 必须有 catch 吸收，否则进程崩溃
const tryRpc = async (fn, times = 5, gap = 2500) => {
  let lastErr;
  for (let i = 0; i < times; i++) {
    try {
      let rej;
      const tP = new Promise((_, rj) => { rej = rj; });
      tP.catch(() => {});
      const timer = setTimeout(() => rej(new Error('rpc-timeout')), 15000);
      try {
        const winner = await Promise.race([fn(), tP]);
        clearTimeout(timer);
        return winner;
      } catch (e) { clearTimeout(timer); throw e; }
    } catch (e) { lastErr = e; await sleep(gap); }
  }
  throw lastErr;
};
const portOpen = (port) => new Promise((resolve) => {
  const net = require('net');
  const s = net.connect(port, '127.0.0.1', () => { s.end(); resolve(true); });
  s.on('error', () => resolve(false));
  s.setTimeout(1500, () => { s.destroy(); resolve(false); });
});
async function ensureAutomation() {
  if (await portOpen(9420)) { console.log('AUTOMATION_ALREADY_UP'); return; }
  console.log('[extra] spawning IDE ...');
  spawn(IDE_EXE, [], { stdio: 'ignore', cwd: path.dirname(IDE_EXE) });
  const t0 = Date.now();
  while (Date.now() - t0 < 180000 && !(await portOpen(42922))) await sleep(2500);
  if (!(await portOpen(42922))) throw new Error('IDE HTTP 42922 not up');
  // 关键：IDE 冷启动后第一次 cli auto 不开端口，第二次才开（实证规律），最多重试 4 次
  for (let i = 1; i <= 4; i++) {
    console.log('[extra] cli auto attempt ' + i + ' ...');
    spawn('cmd.exe', ['/c', 'C:\\mydev\\majiang\\mp-tools\\go-auto.bat'], { stdio: 'ignore' });
    const t1 = Date.now();
    let up = false;
    while (Date.now() - t1 < 120000) {
      if (await portOpen(9420)) { up = true; break; }
      await sleep(3000);
    }
    if (up) { console.log('[extra] automation ready (attempt ' + i + ')'); return; }
    console.log('[extra] attempt ' + i + ' 未开放 9420，重试');
  }
  throw new Error('automation 9420 not up after 4 attempts (弹窗/登录?)');
}

(async () => {
  await ensureAutomation();
  console.log('[extra] 冷却 25s，等项目窗口把编译产物加载完 ...');
  await sleep(25000);
  let mp;
  for (let round = 1; round <= 4 && !mp; round++) {
    try {
      mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
      console.log('CONNECTED round ' + round);
      // 首条 RPC 长轮询：自动化服务就绪≠调试实例就绪，3 分钟内每 6 秒试一次
      const tRpc = Date.now();
      let firstPage = null;
      while (Date.now() - tRpc < 240000 && !firstPage) {
        try {
          let rj;
          const tP = new Promise((_, r) => { rj = r; });
          tP.catch(() => {});
          const timer = setTimeout(() => rj(new Error('rpc-timeout')), 20000);
          try {
            firstPage = await Promise.race([mp.currentPage(), tP]);
            clearTimeout(timer);
          } catch (e) { clearTimeout(timer); throw e; }
          if (firstPage) console.log('FIRST_RPC_OK', firstPage.path);
        } catch (e) {
          if (Date.now() - tRpc % 30000 < 7000) console.log('... waiting debug instance (' + e.message + ')');
          await sleep(6000);
        }
      }
      if (!firstPage) throw new Error('调试实例 4 分钟无响应');
    } catch (e) {
      console.log('round ' + round + ' 失败: ' + e.message);
      try { if (mp) mp.disconnect(); } catch (q) {}
      mp = null;
      if (round < 4) { console.log('降轮冷却 15s ...'); await sleep(15000); }
    }
  }
  if (!mp) { console.error('FATAL 连续 4 轮首条 RPC 均无响应'); process.exit(1); }
  console.log('CONNECTED');
  mp.on('console', (e) => {
    if (e.type === 'error') out.errors.push({ type: e.type, args: (e.args || []).map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)).slice(0, 150)) });
  });
  await sleep(4000);

  let cur = await tryRpc(() => mp.currentPage());
  console.log('CURPAGE', cur.path);

  // 回首页
  if (!/pages\/index\/index/.test(cur.path)) {
    await tryRpc(() => mp.reLaunch('/pages/index/index'), 3, 3000);
    await sleep(2500);
    cur = await tryRpc(() => mp.currentPage());
    console.log('RELUNCHED', cur.path);
  }

  // 1) 注入 navigateTo fail hook
  try {
    await mp.evaluate(() => {
      const w = typeof wx !== 'undefined' ? wx : window.wx;
      if (!w.__qaHooked) {
        const original = w.navigateTo;
        w.navigateTo = function (opts) {
          return original.call(w, Object.assign({}, opts, {
            fail: (e) => { console.error('QA_NAV_FAILED', opts.url, (e && e.errMsg) || e); if (opts.fail) opts.fail(e); },
          }));
        };
        w.__qaHooked = true;
      }
    });
    console.log('HOOK_SET');
  } catch (e) { console.log('HOOK_FAIL', e.message); }
  mp.on('console', (e) => { if (String(e.args || []).includes('QA_NAV_FAILED')) out.navHookFired.push(e.args); });

  // 2) 点开始游戏，每秒记录页面路径，最长 14s
  const t0 = Date.now();
  const startBtn = await tryRpc(() => mp.currentPage().then((p) => p.$('.spr-btnStart')));
  if (!startBtn) { console.log('NO_START_BTN'); }
  else {
    await startBtn.tap();
    console.log('TAPPED');
    let lastPath = '';
    const seen = new Set();
    while (Date.now() - t0 < 14000) {
      try {
        const p = await tryRpc(() => mp.currentPage(), 2, 1000);
        const pathN = (p && p.path) || 'unknown';
        if (pathN !== lastPath) { lastPath = pathN; out.timeline.push({ at: Date.now() - t0, path: pathN }); if (!seen.has(pathN)) { seen.add(pathN); console.log('T+' + Math.round((Date.now() - t0) / 1000) + 's ' + pathN); } }
        if (/pkg-game/.test(pathN)) break;
      } catch (e) { /* keep polling */ }
      await sleep(900);
    }
  }
  console.log('TIMELINE', JSON.stringify(out.timeline));

  // 3) 游戏页停留 + 截图 + 返回
  let now = await tryRpc(() => mp.currentPage()).catch(() => null);
  console.log('NOWPAGE', now && now.path);
  if (now && /pkg-game/.test(now.path)) {
    await sleep(2600);
    try { await tryRpc(() => mp.screenshot({ path: path.join(QA_OUT, 'after-game.png') }), 3, 2000); console.log('GAME_SHOT_OK'); } catch (e) { console.log('GAME_SHOT_FAIL', e.message); }
    try { await tryRpc(() => mp.navigateBack(), 2, 2000); await sleep(2200); console.log('BACK_OK'); } catch (e) { try { await tryRpc(() => mp.reLaunch('/pages/index/index'), 3, 2000); await sleep(2500); } catch (e2) {} }
  } else {
    try { await tryRpc(() => mp.screenshot({ path: path.join(QA_OUT, 'after-home-again.png') }), 3, 2000); } catch (e) {}
  }

  // 4) 集卡页：reLaunch + 轮询直到真到 cards（最多 15s）
  let arrived = false;
  try {
    await tryRpc(() => mp.reLaunch('/pkg-cards/pages/cards/cards'), 3, 2500);
    const t1 = Date.now();
    while (Date.now() - t1 < 15000) {
      const p = await tryRpc(() => mp.currentPage(), 2, 1000).catch(() => null);
      if (p && /pkg-cards/.test(p.path)) { arrived = true; console.log('CARDS_ARRIVED_T+' + Math.round((Date.now() - t1) / 1000) + 's'); break; }
      await sleep(1000);
    }
  } catch (e) { console.log('CARDS_NAV_FAIL', e.message); }
  if (arrived) {
    await sleep(1500);
    const cards = await tryRpc(() => mp.currentPage());
    const imgs = await tryRpc(() => cards.$$('image'), 3, 2000);
    let checked = 0; const missing = [];
    for (const img of imgs.slice(0, 80)) {
      let src = '';
      try { src = (await img.attribute('src')) || ''; } catch (e) { continue; }
      if (!/\.(png|jpe?g|gif|webp)/i.test(src)) continue;
      checked++;
      if (/^https?:/i.test(src)) continue;
      const rel = src.replace(/^\//, '').split('?')[0];
      if (!fs.existsSync(path.join(DIST, rel))) missing.push(rel);
    }
    out.cardsImages = { checked, missing };
    console.log('CARDS_IMAGES checked=' + checked + ' missing=' + missing.length + (missing.length ? ' -> ' + missing.join(',') : ' ALL_OK'));
    try { await tryRpc(() => mp.screenshot({ path: path.join(QA_OUT, 'after-cards.png') }), 3, 2000); console.log('CARDS_SHOT_OK'); } catch (e) {}
  }

  fs.writeFileSync(path.join(QA_OUT, 'extra-result.json'), JSON.stringify(out, null, 2));
  console.log('===EXTRA_SUMMARY=== navHookFired=' + out.navHookFired.length + ' errors=' + out.errors.length);
  if (out.navHookFired.length) console.log('NAV_HOOK', JSON.stringify(out.navHookFired.slice(0, 6)));
  if (out.errors.length) console.log('ERRS', JSON.stringify(out.errors.slice(0, 10)));
  await mp.disconnect();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
