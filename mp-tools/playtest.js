/* 提交前功能验收：真实点击走一遍首页 -> 集卡 -> 对局，
 * 全程收集控制台报错和资源 404（分包改造后最容易坏的就是静态资源路径）。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cdp = require('./cdp');

const H5_DIR = path.join(__dirname, '..', 'majiang-mp', 'dist', 'build', 'h5');
const PORT = 8901, CDP_PORT = 9224, DSF = 2;
const VIEW = { width: 390, height: 844 };
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fails++; };

function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(H5_DIR, urlPath);
    if (!file.startsWith(path.resolve(H5_DIR))) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(H5_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}

const boxOf = (s, sel) => s.eval(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, width: r.width, height: r.height };
})()`);

async function tapAt(s, x, y) {
  const tp = [{ x: Math.round(x), y: Math.round(y), id: 0 }];
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp });
  await sleep(60);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tap(s, sel, wait = 1200) {
  const b = await boxOf(s, sel);
  if (!b) return false;
  await tapAt(s, b.x, b.y);
  await sleep(wait);
  return true;
}
async function waitFor(s, sel, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await boxOf(s, sel)) return true; await sleep(350); }
  return false;
}
const text = (s, sel) => s.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent.trim() : null; })()`);
const clearOverlays = s => s.eval(`(() => { document.querySelectorAll('uni-toast, uni-modal, .uni-mask').forEach(n => n.remove()); return true; })()`);

/* uni-app H5 的 <image> 编译成 <uni-image>，内部同时挂着一个 background-image 的
 * div 和一个 <img>，哪个先就绪取决于加载时机——两个都认，再把 URL 拿回来解码一次，
 * 确认文件真在、能解出像素（分包改造最容易踩的就是静态资源路径）。 */
async function imgProbe(s, sel, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await s.eval(`(async () => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      let url = img && img.getAttribute('src');
      if (!url) {
        for (const n of [el, ...el.querySelectorAll('div')]) {
          const m = (getComputedStyle(n).backgroundImage || '').match(/url\("?(.+?)"?\)/);
          if (m) { url = m[1]; break; }
        }
      }
      if (!url) return null;
      const probe = new Image();
      probe.src = url;
      await probe.decode().catch(() => {});
      return JSON.stringify({ src: url, w: probe.naturalWidth, h: probe.naturalHeight });
    })()`);
    if (r) return r;
    await sleep(300);
  }
  return 'not-resolved';
}

async function main() {
  const server = await serve();
  const profile = path.join(os.tmpdir(), 'playtest-chrome-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile, `--window-size=${VIEW.width},${VIEW.height}`,
    `http://127.0.0.1:${PORT}/`], { stdio: 'ignore' });

  const s = await cdp.connect(CDP_PORT);
  await s.send('Page.enable'); await s.send('Runtime.enable'); await s.send('Network.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: DSF, mobile: true });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  /* 启动页 1800ms 后自动跳首页，探针来不及跑。在任何页面脚本之前装好 setTimeout
   * 包装：只在 splash 路由上丢弃长延时回调，跳转的定时器因此永不触发。 */
  await s.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__holdSplash = location.hash.indexOf('splash') !== -1;
      const __st = window.setTimeout;
      window.setTimeout = function (fn, d, ...rest) {
        if (window.__holdSplash && d >= 250) return 0;
        return __st(fn, d, ...rest);
      };
    `,
  });

  const errors = [], http404 = [];
  s.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') errors.push(p.args.map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 200));
  });
  s.on('Runtime.exceptionThrown', p => errors.push('EXCEPTION: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 200)));
  /* 记下 requestId -> url，否则 loadingFailed 只有一句 errorText，分不清是真的
   * 资源缺失还是整页导航把上一批请求取消了（ERR_ABORTED）。 */
  const reqUrl = new Map();
  s.on('Network.requestWillBeSent', p => reqUrl.set(p.requestId, p.request.url));
  s.on('Network.loadingFailed', p => {
    // 本脚本用 Page.navigate 整页跳到启动页，会把首个文档请求掐掉；
    // 这种「被导航取消的文档请求」是脚本自己造成的，不是资源缺失。
    if (p.canceled && p.type === 'Document') return;
    http404.push(`LOAD FAILED ${p.errorText} type=${p.type} ${(reqUrl.get(p.requestId) || '?').replace(`http://127.0.0.1:${PORT}`, '')}`);
  });
  s.on('Network.responseReceived', p => { if (p.response.status >= 400) http404.push(p.response.status + ' ' + p.response.url.replace(`http://127.0.0.1:${PORT}`, '')); });

  console.log('[1] 启动页');
  await s.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?t=${Date.now()}#/pages/splash/splash` });
  await sleep(1500);
  ok(await waitFor(s, '.splash-bg', 15000), '启动页渲染');
  const badge = await imgProbe(s, '.age-badge');
  ok(String(badge).includes('12plus'), `适龄标识用的是 12+ 资源: ${badge}`);
  ok(/"w":\s*\d{2,}/.test(String(badge)), '适龄标识图片真实解码成功（naturalWidth > 0）');

  console.log('\n[2] 首页与各入口弹窗');
  await s.eval(`location.hash = '#/pages/index/index'; true`); await sleep(600);
  await s.eval(`location.reload(); true`).catch(() => {});
  await sleep(5200);
  ok(await waitFor(s, '.hotspot-piggy-bank'), '首页热区渲染');
  const modals = [
    ['.hotspot-lucky-gift', '.modal-close-circle', '幸运礼包'],
    ['.hotspot-daily-task', '.modal-close-task', '每日任务'],
    ['.hotspot-shop', '.modal-close-task', '商店'],
    ['.hotspot-piggy-bank', '.modal-close-btn-ribbon', '存钱罐'],
  ];
  for (const [open, close, name] of modals) {
    const opened = await tap(s, open, 1300);
    const visible = opened && !!(await boxOf(s, close));
    ok(visible, `${name}弹窗能打开`);
    if (visible) ok(await tap(s, close, 900), `${name}弹窗能关闭`);
    await clearOverlays(s);
  }

  console.log('\n[3] 集卡页（pkg-cards 分包）');
  ok(await tap(s, '.hotspot-cards', 2600), '点集卡入口');
  ok(await waitFor(s, '.cards-page-container', 12000), '集卡页渲染');
  const disc = await imgProbe(s, '.disc-hero-img');
  ok(/"w":\s*[1-9]/.test(String(disc)), `集卡页分包图片加载成功: ${disc}`);
  ok(await tap(s, '.hotspot-back', 2400), '集卡页返回');
  ok(await waitFor(s, '.hotspot-piggy-bank', 12000), '返回首页成功');

  console.log('\n[4] 对局（pkg-game 分包）');
  ok(await tap(s, '.hotspot-start-game', 3000), '点开始游戏');
  const inGame = await waitFor(s, '#board', 15000);
  ok(inGame, '对局页渲染出棋盘 canvas');
  await sleep(6000);
  const painted = await s.eval(`(() => {
    const host = document.querySelector('#board');
    const c = host && (host.tagName === 'CANVAS' ? host : host.querySelector('canvas'));
    if (!c) return 0;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4000) if (d[i + 3] > 0) n++;
    return n;
  })()`);
  ok(painted > 0, `canvas 实际画了内容（${painted} 个采样点非透明）`);
  const remain0 = parseInt(await text(s, '.stat-remain-val'), 10);
  const score0 = parseInt(await text(s, '.star-num'), 10);
  ok(remain0 > 0, `剩余数量初始 ${remain0}`);

  const board = await boxOf(s, '#board');
  let trayFilled = 0;
  for (const [fx, fy] of [[.34, .28], [.55, .42], [.42, .60]]) {
    await tapAt(s, board.left + fx * board.width, board.top + fy * board.height);
    await sleep(700);
  }
  trayFilled = await s.eval(`document.querySelectorAll('.g-slot-custom.filled').length`);
  ok(trayFilled > 0, `点牌进卡槽生效（卡槽已放 ${trayFilled} 张）`);

  // 用「消除」道具走一次完整的三消：能验证消除动画收尾、计分、剩余数量三处联动
  const beforeRemain = parseInt(await text(s, '.stat-remain-val'), 10);
  const beforeScore = parseInt(await text(s, '.star-num'), 10);
  await tap(s, '.tool-capsule:nth-of-type(1)', 1800);
  const afterRemain = parseInt(await text(s, '.stat-remain-val'), 10);
  const afterScore = parseInt(await text(s, '.star-num'), 10);
  ok(afterRemain === beforeRemain - 3, `消除道具清掉三张（剩余 ${beforeRemain} -> ${afterRemain}）`);
  ok(afterScore > beforeScore, `分数增加（${beforeScore} -> ${afterScore}）`);

  const timer1 = await text(s, '.timer-text');
  await sleep(2500);
  const timer2 = await text(s, '.timer-text');
  ok(timer1 !== timer2, `倒计时在走（${timer1} -> ${timer2}）`);

  ok(await tap(s, '.round-pause-btn', 1400), '暂停按钮可点');
  await clearOverlays(s);

  console.log('\n[5] 回首页与存档');
  await s.eval(`location.hash = '#/pages/index/index'; true`);
  await sleep(3000);
  ok(await waitFor(s, '.hotspot-piggy-bank', 12000), '能回到首页');
  const saved = await s.eval(`(() => {
    try {
      const w = JSON.parse(localStorage.getItem('majiang_user_profile_v2'));
      const d = (w && 'data' in w) ? w.data : w;
      return JSON.stringify({ coins: d.coins, stamina: d.stamina, level: d.currentLevel });
    } catch (e) { return 'read-failed'; }
  })()`);
  ok(String(saved).includes('coins'), `存档可读回: ${saved}`);

  console.log('\n[6] 控制台与资源');
  const realErrors = errors.filter(e => !/favicon/i.test(e));
  const real404 = http404.filter(u => !/favicon/i.test(u));
  ok(realErrors.length === 0, `无 JS 报错${realErrors.length ? ':\n        ' + realErrors.slice(0, 8).join('\n        ') : ''}`);
  ok(real404.length === 0, `无资源加载失败${real404.length ? ':\n        ' + real404.slice(0, 8).join('\n        ') : ''}`);

  try { await s.send('Browser.close'); } catch (e) {}
  s.close(); chrome.kill(); server.close();
  console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e.stack || e.message); process.exit(1); });
