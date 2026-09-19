'use strict';
/* 微信开发者工具「代码质量检测」的离线预检。
 *
 *   node mp-tools/audit-precheck.cjs
 *
 * 检测面板本身只存在于开发者工具的 GUI 里，cli.bat 没有对应子命令，
 * 无人值守环境下跑不出来。但它扣分的规则里有相当一部分是纯静态的——
 * 资源体积、分包体积、明文 HTTP、废弃接口、图片尺寸相对渲染尺寸是否过大。
 * 这个脚本直接量构建产物 dist/build/mp-weixin，把这些先兜住，
 * 免得每次都要人工开一次 IDE 才发现「某张图又超了 200K」。
 *
 * 它**不能**代替 GUI 面板：setData 体积与频率、渲染层节点数、首屏耗时
 * 这类运行期指标必须真机或模拟器跑起来才有，末尾会列出来。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'majiang-mp', 'dist', 'build', 'mp-weixin');

let fails = 0;
let passed = 0;
const notes = [];

function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
}
function section(t) { console.log('\n' + t); }
function note(t) { notes.push(t); }

if (!fs.existsSync(DIST)) {
  console.error('找不到构建产物 ' + path.relative(ROOT, DIST) + '，先跑 npm run build:mp-weixin');
  process.exit(1);
}

/** 递归列出 dist 下的所有文件，返回相对 dist 的路径。 */
function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

const files = walk(DIST);
const kb = (n) => (n / 1024).toFixed(1) + 'K';
const sizeOf = (rel) => fs.statSync(path.join(DIST, rel)).size;

/* ------------------------------------------------------------------ */
section('一、图片和音频资源不应超过 200K');

const MEDIA = /\.(png|jpe?g|webp|gif|bmp|mp3|wav|m4a|aac|ogg|silk)$/i;
const media = files.filter((f) => MEDIA.test(f));
ok(media.length > 0, `构建产物里找到 ${media.length} 个图片/音频资源`);
const over = media.filter((f) => sizeOf(f) > 200 * 1024);
ok(over.length === 0,
  '没有资源超过 200K' + (over.length ? '（超标：' + over.map((f) => `${f} ${kb(sizeOf(f))}`).join('，') + '）' : ''));
const biggest = media.slice().sort((a, b) => sizeOf(b) - sizeOf(a))[0];
if (biggest) note(`最大的一个资源：${biggest} ${kb(sizeOf(biggest))}`);

/* ------------------------------------------------------------------ */
section('二、代码包体积');

/* 主包 2MB、单个分包 2MB、整包 20MB 是微信的硬上限，超了直接不让上传。 */
const appJson = JSON.parse(fs.readFileSync(path.join(DIST, 'app.json'), 'utf8'));
const roots = (appJson.subPackages || []).map((p) => p.root.replace(/\/$/, ''));
const bucket = { main: 0 };
roots.forEach((r) => { bucket[r] = 0; });
for (const f of files) {
  const r = roots.find((x) => f === x || f.startsWith(x + '/'));
  bucket[r || 'main'] += sizeOf(f);
}
const LIMIT = 2 * 1024 * 1024;
for (const [name, bytes] of Object.entries(bucket)) {
  ok(bytes <= LIMIT, `${name === 'main' ? '主包' : '分包 ' + name} ${kb(bytes)} ≤ 2MB`);
}
const total = Object.values(bucket).reduce((a, b) => a + b, 0);
ok(total <= 20 * 1024 * 1024, `整包合计 ${kb(total)} ≤ 20MB`);

/* ------------------------------------------------------------------ */
section('三、网络请求必须走 HTTPS');

const code = files.filter((f) => /\.(js|json|wxml|wxss|wxs)$/i.test(f));
const httpHits = [];
for (const f of code) {
  const text = fs.readFileSync(path.join(DIST, f), 'utf8');
  // 本机调试地址不算：localhost / 127.0.0.1 在真机上本来就连不通，也不会被审核看到
  for (const m of text.matchAll(/http:\/\/(?!localhost|127\.0\.0\.1)[\w.-]+/g)) httpHits.push(`${f}: ${m[0]}`);
}
ok(httpHits.length === 0,
  '没有明文 http:// 请求' + (httpHits.length ? '（' + httpHits.slice(0, 5).join('；') + '）' : ''));

/* ------------------------------------------------------------------ */
section('四、废弃接口');

/* 这几个在基础库 2.20.1 起标记为废弃，检测面板会扣分。
 * uni-app 的运行时（common/vendor.js）里也有，那部分改不动，只统计业务代码。 */
const DEPRECATED = ['getSystemInfoSync', 'getSystemInfoAsync', 'getSystemInfo', 'getUserInfo'];
const ours = code.filter((f) => !f.startsWith('common/') && !f.includes('vendor'));
const hits = [];
for (const f of ours) {
  const text = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const api of DEPRECATED) {
    if (new RegExp('[.\\b]' + api + '\\s*\\(').test(text)) hits.push(`${f}: ${api}`);
  }
}
ok(hits.length === 0,
  '业务代码没有直接调用废弃接口' + (hits.length ? '（' + hits.join('；') + '）' : ''));
note('uni-app 运行时 common/vendor.js 内部仍会调 wx.getSystemInfoSync，属框架实现，业务侧改不动；'
  + 'GUI 面板若仍提示这一条，来源就是它。项目自己的代码已全部改用 uni.getWindowInfo。');

/* ------------------------------------------------------------------ */
section('五、图片原始尺寸相对渲染尺寸是否过大');

/* 检测面板会提示「图片尺寸过大」：原图像素数明显超过实际渲染像素数就是白占体积和解码时间。
 * 首页的几何是可算的，这里按主流机型 1080 物理像素宽、19.5:9 屏来估。 */
let layout = null;
try { layout = require('./home-layout.cjs'); } catch (e) { /* 布局表不在就跳过这一节 */ }
if (!layout) {
  console.log('  SKIP  home-layout.cjs 不可用，跳过首页图片尺寸估算');
} else {
  const DEV_W = 1080, DEV_H = 2340;
  for (const it of layout.buildLayout()) {
    const renderW = (it.css.width / 100) * DEV_W;
    const renderH = (it.css.height / 100) * DEV_H;
    const ratio = (it.src.w * it.src.h) / (renderW * renderH);
    // 面积超过渲染面积 2 倍（即边长 1.41 倍）才算浪费，1:1 附近都是健康的
    ok(ratio <= 2,
      `${it.file} 原图 ${it.src.w}x${it.src.h} vs 渲染 ${Math.round(renderW)}x${Math.round(renderH)}`
      + `（面积比 ${ratio.toFixed(2)}，≤2 为宜）`);
  }
}

/* ------------------------------------------------------------------ */
section('六、只有 GUI 面板才测得了的项（本脚本不覆盖）');
[
  'setData 单次数据量 / 调用频率——需要运行期采样',
  '渲染层节点数量、首屏渲染耗时——需要真机或模拟器跑起来',
  '图片实际解码是否成功（WebP 在低版本 iOS 基础库上的兼容性）——需要真机',
  '代码包是否开启了压缩混淆——属上传时的勾选项，不在构建产物里'
].forEach((s) => console.log('  SKIP  ' + s));

if (notes.length) {
  console.log('\n备注：');
  notes.forEach((n) => console.log('  · ' + n));
}

console.log('\n' + (fails ? '✗ ' : '✓ ') + passed + ' 项通过，' + fails + ' 项不通过');
process.exit(fails ? 1 : 0);
