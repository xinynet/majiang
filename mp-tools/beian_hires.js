/* 小程序备案截图重拍：3 倍像素密度渲染，解决"图片质量差/无法辨识图内文本"退回。
 *
 * 本机物理显示只有 1024x768，开发者工具模拟器被压缩到 0.61 倍，
 * App.captureScreenshot 只能截到 238x515 —— 这正是备案被退回的原因，
 * 且放大已有截图无法还原笔画。改用 headless Chrome 渲染 H5 构建产物，
 * deviceScaleFactor=3；页面全部是 rpx 布局，因此是真实 3 倍渲染。
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cdp = require('./cdp');

const H5_DIR = path.join(__dirname, '..', 'majiang-mp', 'dist', 'build', 'h5');
const OUT_DIR = path.join(__dirname, '..', 'devtools_shots', '小程序备案截图_hires');
const PORT = 8899;
const CDP_PORT = 9222;
const DSF = 3;
const VIEW = { width: 390, height: 844 };
const STORAGE_KEY = 'majiang_user_profile_v2';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const seen = new Map();
const warnings = [];

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.woff': 'font/woff',
};

function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(H5_DIR, urlPath);
    if (!file.startsWith(H5_DIR)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(H5_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}

async function shot(s, relName, allowDup = false) {
  const file = path.join(OUT_DIR, relName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { data } = await s.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(data, 'base64');
  fs.writeFileSync(file, buf);
  // 近乎纯色的一帧说明截早了（页面还没画完或已经跳走），这种图交上去就是废的
  if (buf.length < 40 * 1024) warnings.push(`BLANK-LOOKING frame (${(buf.length / 1024).toFixed(0)}K): ${relName}`);
  const hash = crypto.createHash('md5').update(buf).digest('hex');
  const dupe = seen.get(hash);
  if (dupe && !allowDup) warnings.push(`DUPLICATE: ${relName} is pixel-identical to ${dupe}`);
  if (!dupe) seen.set(hash, relName);
  const tag = dupe ? (allowDup ? '   (same screen as ' + dupe + ', intentional)' : '   <-- DUPLICATE') : '';
  console.log(`  ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}  ${(buf.length / 1024).toFixed(0)}K  ${relName}${tag}`);
}

const boxOf = (s, selector) => s.eval(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, width: r.width, height: r.height };
})()`);

async function tapAt(s, x, y) {
  const tp = [{ x: Math.round(x), y: Math.round(y), id: 0 }];
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp });
  await sleep(60);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function tap(s, selector, waitMs = 1400) {
  const b = await boxOf(s, selector);
  if (!b) { warnings.push(`MISSING selector: ${selector}`); console.log('  (missing) ' + selector); return false; }
  await tapAt(s, b.x, b.y);
  await sleep(waitMs);
  return true;
}

async function waitFor(s, selector, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await boxOf(s, selector)) return true;
    await sleep(400);
  }
  return false;
}

/* uni.showToast / uni.showModal 在 H5 下是全屏遮罩，不清掉会吞掉后续所有点击 */
async function clearNativeOverlays(s) {
  await s.eval(`(() => {
    document.querySelectorAll('uni-toast, uni-modal, .uni-toast, .uni-modal, .uni-mask').forEach(n => n.remove());
    return true;
  })()`);
  await sleep(300);
}

/* 写存档必须和 reload 在同一次 evaluate 里完成：
 * state.js 有 1 秒心跳 + deep watch，中间只要过一个 tick，
 * 内存里的旧状态就会把我们刚写进去的值覆盖掉。 */
async function seedStateAndReload(s, patch, verifyKeys = Object.keys(patch)) {
  const r = await s.eval(`(() => {
    const k = ${JSON.stringify(STORAGE_KEY)};
    let wrapped = null;
    try { wrapped = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    const isWrapped = wrapped && typeof wrapped === 'object' && 'type' in wrapped && 'data' in wrapped;
    const data = isWrapped ? wrapped.data : wrapped;
    if (!data || typeof data !== 'object') return 'no-state';
    Object.assign(data, ${JSON.stringify(patch)});
    localStorage.setItem(k, JSON.stringify(isWrapped ? { ...wrapped, data } : data));
    location.reload();
    return 'ok';
  })()`);
  if (r !== 'ok') warnings.push('seedState failed: ' + r);
  await sleep(5500);
  if (!(await waitFor(s, '.hotspot-piggy-bank'))) throw new Error('home did not come back after seeding');
  await sleep(1800);

  // 回读确认种进去的值真的被应用了：心跳 + deep watch 很容易把它覆盖掉，
  // 覆盖了就会静默截出一张状态不对的图。
  // 只校验 verifyKeys —— 像 staminaTimer 这种倒计时字段本来就该一直在走，
  // 把它算进比对只会产生假告警。
  const after = await s.eval(`(() => {
    try {
      const w = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      const d = (w && 'data' in w) ? w.data : w;
      return JSON.stringify(Object.fromEntries(${JSON.stringify(verifyKeys)}.map(k => [k, d[k]])));
    } catch (e) { return 'read-failed: ' + e.message; }
  })()`);
  const want = JSON.stringify(Object.fromEntries(verifyKeys.map(k => [k, patch[k]])));
  console.log(`  (seed verified: ${after})`);
  if (after !== want) warnings.push(`seed did not stick: got ${after}, wanted ${want}`);
}

async function loadHome(s) {
  await s.eval(`location.hash = '#/pages/index/index'; true`);
  await sleep(800);
  await s.eval(`location.reload(); true`).catch(() => {});
  await sleep(5500);
  if (!(await waitFor(s, '.hotspot-piggy-bank'))) throw new Error('home hotspots never appeared');
  await sleep(1800);
}

async function main() {
  if (!CHROME) throw new Error('Chrome not found');
  if (!fs.existsSync(path.join(H5_DIR, 'index.html'))) throw new Error('H5 build missing: ' + H5_DIR);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = await serve();
  const profile = path.join(os.tmpdir(), 'beian-chrome-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--mute-audio',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile,
    `--window-size=${VIEW.width},${VIEW.height}`,
    `http://127.0.0.1:${PORT}/`,
  ], { stdio: 'ignore' });

  const s = await cdp.connect(CDP_PORT);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Emulation.setDeviceMetricsOverride', {
    width: VIEW.width, height: VIEW.height, deviceScaleFactor: DSF, mobile: true,
  });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  /* 启动页 1800ms 后自动跳首页，来不及截。patch window.uni 没用——uni-app H5 里
   * 页面代码引用的是模块内的 uni 绑定而不是全局对象。改成在任何页面脚本执行前
   * 就装好 setTimeout 包装：只在 splash 路由上丢弃长延时回调，跳转所依赖的
   * MIN_SHOW_MS 等待和 go() 定时器因此永不触发，页面被冻住。
   * 进度条的 setInterval 不受影响，画面仍是真实的加载态。 */
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
  console.log(`rendering ${VIEW.width}x${VIEW.height} @${DSF}x -> ${VIEW.width * DSF}x${VIEW.height * DSF}\n`);

  // ---------- 0. 启动界面 ----------
  // 必须截真实启动页，不能拿美术原图顶替：
  // miniprogram截图/启动界面.png 那版的健康游戏忠告是错的（「遣防受戏上当」，
  // 应为「谨防受骗上当」），且与 App 实际显示的画面不一致。线上这版文案正确。
  console.log('[0] 启动界面（截真实启动页）');
  // 必须用 Page.navigate 整页加载到带 splash 的地址：先改 hash 再 reload 是没用的，
  // 启动页会在 reload 之前就把 hash 改回 index，新文档根本不在 splash 路由上。
  await s.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?t=${Date.now()}#/pages/splash/splash` });
  if (!(await waitFor(s, '.splash-bg', 15000))) {
    warnings.push('splash page never rendered');
  } else {
    await sleep(2000);            // 让底图解码；跳转已被上面的 setTimeout 拦截挡住
    const stillSplash = await boxOf(s, '.splash-bg');
    if (!stillSplash) warnings.push('splash navigated away before capture');
    await shot(s, '0_启动界面.png');
  }

  await loadHome(s);

  // ---------- 1. 主界面风格 ----------
  console.log('\n[1] 提交-主界面风格');
  await shot(s, '提交-主界面风格/1_主界面-首页.png');
  for (const [open, close, name] of [
    ['.hotspot-lucky-gift', '.modal-close-circle', '2_主界面-幸运礼包.png'],
    ['.hotspot-daily-task', '.modal-close-task', '3_主界面-每日任务.png'],
    ['.hotspot-shop', '.modal-close-task', '4_主界面-商店.png'],
    ['.hotspot-piggy-bank', '.modal-close-btn-ribbon', '5_主界面-存钱罐.png'],
  ]) {
    if (!(await tap(s, open, 1600))) continue;
    await shot(s, '提交-主界面风格/' + name);
    await tap(s, close, 1000);
    await clearNativeOverlays(s);
  }

  // ---------- 2. 商城系统（复用首页三个入口）----------
  console.log('\n[2] 提交-系统功能 / 系统3-商城系统');
  // 与「主界面风格」是同一批弹窗，备案按系统分类各要一份，重复是预期的
  for (const [open, close, name] of [
    ['.hotspot-shop', '.modal-close-task', '1_商店金币购买.png'],
    ['.hotspot-lucky-gift', '.modal-close-circle', '2_幸运礼包.png'],
    ['.hotspot-piggy-bank', '.modal-close-btn-ribbon', '3_存钱罐.png'],
  ]) {
    if (!(await tap(s, open, 1600))) continue;
    await shot(s, '提交-系统功能/系统3-商城系统/' + name, true);
    await tap(s, close, 1000);
    await clearNativeOverlays(s);
  }

  // ---------- 3. 体力系统 ----------
  console.log('\n[3] 提交-系统功能 / 系统2-体力系统');
  await shot(s, '提交-系统功能/系统2-体力系统/1_首页体力满值.png');
  await seedStateAndReload(s, { stamina: 3, staminaTimer: 14 * 60 + 2 }, ['stamina']);
  await shot(s, '提交-系统功能/系统2-体力系统/2_体力消耗与恢复倒计时.png');
  if (await tap(s, '.hotspot-stamina', 1800)) {
    if (!(await boxOf(s, 'uni-modal, .uni-modal'))) warnings.push('stamina modal did not appear (stamina may still be full)');
    await shot(s, '提交-系统功能/系统2-体力系统/3_体力说明弹窗.png');
    await clearNativeOverlays(s);
  }

  // ---------- 4. 具体玩法 ----------
  console.log('\n[4] 提交-具体玩法');
  await s.eval(`location.hash = '#/pkg-game/pages/game/game?level=2'; true`);
  await sleep(3000);
  await shot(s, '提交-具体玩法/1_玩法-开局发牌.png');
  await sleep(4500);
  await shot(s, '提交-具体玩法/2_玩法-牌堆就绪.png');

  const board = await boxOf(s, '#board') || await boxOf(s, 'canvas');
  if (!board) throw new Error('#board canvas not found');
  console.log('  board:', JSON.stringify(board));
  for (const [fx, fy] of [[.34, .28], [.55, .42], [.42, .60], [.63, .52], [.50, .74]]) {
    await tapAt(s, board.left + fx * board.width, board.top + fy * board.height);
    await sleep(750);
  }
  await sleep(600);
  await shot(s, '提交-具体玩法/3_玩法-点牌进卡槽.png');

  // ---------- 5. 道具系统 ----------
  console.log('\n[5] 提交-系统功能 / 系统1-道具系统');
  await shot(s, '提交-系统功能/系统1-道具系统/1_对局内道具栏.png');

  // 每局每种道具免费送 1 次，所以先用掉一次把次数打到 0，再点一次才会弹补充弹窗
  const capsules = [['消除', 1], ['洗牌', 2]];
  for (let i = 0; i < capsules.length; i++) {
    const [label, nth] = capsules[i];
    const sel = `.tool-capsule:nth-of-type(${nth})`;
    await tap(s, sel, 1600);            // 第一次：消耗掉这次免费道具
    if (!(await tap(s, sel, 1600))) continue;  // 第二次：次数为 0，弹补充弹窗
    if (await boxOf(s, '.tool-refill-dialog')) {
      await shot(s, `提交-系统功能/系统1-道具系统/${i + 2}_${label}道具补充弹窗.png`);
      await tap(s, '.refill-close-btn', 900);
    } else {
      warnings.push(`refill dialog did not open for ${label}`);
      console.log(`  (no refill dialog) ${label}`);
    }
    await clearNativeOverlays(s);
  }

  // ---------- 6. 暂停菜单 ----------
  console.log('\n[6] 暂停菜单');
  if (await tap(s, '.round-pause-btn', 1200)) {
    await shot(s, '提交-具体玩法/4_玩法-暂停菜单.png');
  }

  await sleep(500);
  try { await s.send('Browser.close'); } catch (e) {}
  s.close();
  chrome.kill();
  server.close();

  console.log('\n' + (warnings.length ? 'WARNINGS:\n  ' + warnings.join('\n  ') : 'No warnings — every shot is distinct.'));
  console.log('\nOutput -> ' + OUT_DIR);
}

main().catch(e => { console.error('Fatal:', e.stack || e.message); process.exit(1); });
