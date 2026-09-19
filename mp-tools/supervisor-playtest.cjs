// supervisor-playtest.cjs -> 驻守进程：拉起 IDE -> 开自动化独立端口 -> 完整试玩 -> 保活待追加测试
const automator = require('miniprogram-automator');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const QA_OUT = 'C:/Users/Administrator/WorkBuddy AI/2026-09-18-01-19-11';
const DIST = 'C:/mydev/majiang/majiang-mp/dist/build/mp-weixin';
const IDE_EXE = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\微信开发者工具.exe';
const CLI_BAT = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const result = { steps: [], errors: [], consoleEvents: [] };
const log = (name, ok, detail) => {
  result.steps.push({ name, ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' | ' + String(detail) : ''));
  fs.writeFileSync(path.join(QA_OUT, 'playtest-result.json'), JSON.stringify(result, null, 2));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.on('unhandledRejection', (e) => console.log('[supervisor] unhandledRejection kept alive:', (e && e.message) || e));
// RPC 重试：etimes 次内任一成功即返回；每次调用上限 15s
const tryRpc = async (fn, times = 6, gap = 3000) => {
  let lastErr;
  for (let i = 0; i < times; i++) {
    try {
      return await Promise.race([fn(), new Promise((_, rj) => setTimeout(() => rj(new Error('rpc-timeout')), 15000))]);
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

async function waitPort(port, timeoutSec, tag) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutSec * 1000) {
    if (await portOpen(port)) { log('port-' + tag, true, ':' + port); return true; }
    await sleep(2500);
  }
  log('port-' + tag, false, '等待 ' + port + ' 超时');
  return false;
}

async function runPlaytest(mp) {
  mp.on('exception', (e) => { result.errors.push({ src: 'app', msg: (e && e.message) || 'exception' }); fs.writeFileSync(path.join(QA_OUT, 'playtest-result.json'), JSON.stringify(result, null, 2)); });
  mp.on('console', (e) => {
    if (e.type === 'error') result.consoleEvents.push({ type: e.type, args: (e.args || []).map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)).slice(0, 150)) });
  });
  await sleep(5000); // 服务刚起，稳一稳再发首条 RPC

  let path0 = '';
  try { path0 = await tryRpc(() => mp.currentPage().then((p) => p && p.path), 8, 3000); } catch (e) { log('first-rpc', false, 'EXC ' + e.message); }
  if (!/pages\/index\/index/.test(path0 || '')) {
    try {
      await tryRpc(() => mp.reLaunch('/pages/index/index'), 3, 3000);
      await sleep(2500);
    } catch (e) { log('reLaunch-home', false, 'EXC ' + e.message); }
  }
  let page = null;
  try { page = await tryRpc(() => mp.currentPage(), 6, 3000); } catch (e) { /* handled below */ }
  log('home-page', !!page && /pages\/index\/index/.test(page.path), (page && page.path) || path0 || 'none');
  if (!page) { log('playtest-abort', false, '首页 RPC 始终无响应'); return false; }
  await sleep(1500);
  try { await tryRpc(() => mp.screenshot({ path: path.join(QA_OUT, 'after-home.png') }), 3, 2000); log('screenshot-home', true, 'after-home.png'); } catch (e) { log('screenshot-home', false, 'EXC ' + e.message); }

  // 1) 关卡宝箱弹窗
  try {
    const home = await mp.currentPage();
    const chestBtn = await home.$('.spr-chestLevel');
    if (chestBtn) {
      await chestBtn.tap();
      await home.waitFor(1000);
      const dlg = await home.$('.reward-dialog');
      log('level-chest-modal', !!dlg, dlg ? 'reward-dialog 出现' : '未出现 .reward-dialog');
      await mp.screenshot({ path: path.join(QA_OUT, 'after-level-chest.png') });
      const close = await home.$('.modal-close-circle');
      if (close) { await close.tap(); await sleep(700); log('level-chest-close', true); }
    } else log('level-chest-modal', false, '未找到 .spr-chestLevel');
  } catch (e) { log('level-chest-modal', false, 'EXC ' + e.message); }

  // 2) 幸运礼包弹窗
  try {
    const home = await mp.currentPage();
    const btn = await home.$('.spr-tileLucky');
    if (btn) {
      await btn.tap();
      await home.waitFor(1000);
      const art = await home.$('.lucky-header-art');
      const src = art ? await art.attribute('src') : null;
      log('lucky-modal', true, 'header-src=' + src);
      if (src) {
        const rel = src.replace(/^\//, '').split('?')[0];
        log('lucky-modal-img-exists', fs.existsSync(path.join(DIST, rel)), rel);
      }
      await mp.screenshot({ path: path.join(QA_OUT, 'after-lucky.png') });
      const close = await home.$('.modal-close-circle');
      if (close) { await close.tap(); await sleep(700); log('lucky-close', true); }
    } else log('lucky-modal', false, '未找到 .spr-tileLucky');
  } catch (e) { log('lucky-modal', false, 'EXC ' + e.message); }

  // 3) 开始游戏 -> 游戏页
  try {
    const home = await mp.currentPage();
    const start = await home.$('.spr-btnStart');
    if (start) {
      await start.tap();
      await sleep(3200);
      const now = await mp.currentPage();
      log('start-game-navigate', /(pkg-game|game)/.test(now.path), now.path);
      if (/game/.test(now.path)) {
        await sleep(2600);
        await mp.screenshot({ path: path.join(QA_OUT, 'after-game.png') });
        log('screenshot-game', true, 'after-game.png');
        try { await mp.navigateBack(); await sleep(1600); } catch (e) { await mp.reLaunch('/pages/index/index'); await sleep(2200); }
      }
    } else log('start-game-navigate', false, '未找到 .spr-btnStart');
  } catch (e) { log('start-game-navigate', false, 'EXC ' + e.message); }

  // 4) 集卡页图片完整性
  try {
    await mp.reLaunch('/pkg-cards/pages/cards/cards');
    await sleep(2800);
    const cards = await mp.currentPage();
    log('cards-page', /cards/.test(cards.path), cards && cards.path);
    const imgs = await cards.$$('image');
    let missing = 0; let checked = 0; const sample = [];
    for (const img of imgs.slice(0, 60)) {
      let src = '';
      try { src = (await img.attribute('src')) || ''; } catch (e) { continue; }
      if (!/\.(png|jpe?g|gif|webp)/i.test(src)) continue;
      checked++;
      if (/^https?:/i.test(src)) continue;
      const rel = src.replace(/^\//, '').split('?')[0];
      if (!fs.existsSync(path.join(DIST, rel))) { missing++; if (sample.length < 10) sample.push(rel); }
    }
    log('cards-images', missing === 0, `checked=${checked} missing=${missing} ${sample.join(' | ')}`);
    await mp.screenshot({ path: path.join(QA_OUT, 'after-cards.png') });
  } catch (e) { log('cards-page', false, 'EXC ' + e.message); }

  result.errorsCount = result.errors.length;
  result.consoleErrorCount = result.consoleEvents.length;
  const fails = result.steps.filter((s) => !s.ok);
  fs.writeFileSync(path.join(QA_OUT, 'playtest-result.json'), JSON.stringify(result, null, 2));
  console.log('===SUMMARY=== PASS=' + result.steps.filter((s) => s.ok).length + ' FAIL=' + fails.length + ' APP_EXCEPTIONS=' + result.errors.length + ' CONSOLE_ERRORS=' + result.consoleEvents.length);
  if (result.consoleEvents.length) console.log('CONSOLE_ERRS ' + JSON.stringify(result.consoleEvents.slice(0, 12)));
  if (result.errors.length) console.log('APP_EXCS ' + JSON.stringify(result.errors.slice(0, 10)));
  return fails.length === 0;
}

(async () => {
  // 若 IDE 已在跑则复用，否则拉起
  if (await portOpen(42922)) {
    log('port-42922', true, 'already listening, reuse');
  } else {
    console.log('[supervisor] spawn IDE ...');
    const ide = spawn(IDE_EXE, [], { stdio: 'ignore', cwd: path.dirname(IDE_EXE) });
    ide.on('exit', (c) => console.log('[supervisor] ide-proc exited', c));
    if (!(await waitPort(42922, 180, '42922'))) {
      console.error('[supervisor] IDE HTTP portal not listening, abort');
      process.exit(3);
    }
  }

  let pass = null;
  for (let attempt = 1; attempt <= 3 && pass === null; attempt++) {
    console.log('[supervisor] cli auto (wrapper bat) attempt ' + attempt + ' ...');
    const cli = spawn('cmd.exe', ['/c', 'C:\\mydev\\majiang\\mp-tools\\go-auto.bat'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let cliOut = '';
    cli.stdout.on('data', (d) => { cliOut += d.toString(); });
    cli.stderr.on('data', (d) => { cliOut += d.toString(); });
    cli.on('exit', (c) => { console.log('[supervisor] cli auto exit ' + c + '\n' + cliOut.slice(-600)); });

    // 90 秒内等 9420（项目窗口可能要登录/信任弹窗后才能开）
    const t0 = Date.now();
    let opened = false;
    while (Date.now() - t0 < 90000) {
      if (await portOpen(9420)) { opened = true; break; }
      await sleep(3000);
    }
    if (opened) {
      log('port-9420', true, 'attempt ' + attempt);
      try {
        const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
        log('connect', true, 'ws://127.0.0.1:9420');
        pass = await runPlaytest(mp);
      } catch (e) {
        console.error('[supervisor] connect/playtest FAIL: ' + e.message);
        pass = false;
      }
    } else {
      console.log('[supervisor] attempt ' + attempt + ' 结束，9420 仍未开放（若工具窗口有登录码/弹窗，请处理后我会自动接上）');
    }
  }

  if (pass === null) {
    console.log('[supervisor] 长驻探测模式：每 5 秒探测 9420，最长 45 分钟。若窗口弹了登录二维码请扫码；弹了信任提示请点击信任');
    const t1 = Date.now();
    while (Date.now() - t1 < 45 * 60 * 1000) {
      if (await portOpen(9420)) {
        console.log('[supervisor] 9420 迟到开放，立刻开跑试玩 ...');
        try {
          const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 30000 });
          log('connect', true, 'ws://127.0.0.1:9420 (late)');
          pass = await runPlaytest(mp);
        } catch (e) { console.error('[supervisor] late playtest FAIL: ' + e.message); }
        break;
      }
      await sleep(5000);
    }
  }

  console.log('[supervisor] KEEPALIVE 60min，连接保持供追加测试（此进程不退出，IDE 不被收割）');
  await sleep(60 * 60 * 1000);
  process.exit(pass ? 0 : 2);
})();
