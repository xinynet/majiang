// 把 H5 的 styles.css + styles-v37..v60 转换成 wxss 兼容样式
import fs from 'fs';
import path from 'path';

const SRC = 'C:/mydev/majiang/majiangxiaoxiaole';
const OUT = 'C:/mydev/majiang/majiang-mp/src/styles/game.css';
const B64 = 'C:/mydev/majiang/mp-tools/static-out/b64';
fs.mkdirSync(path.dirname(OUT), { recursive: true });

let css = '';
for (const f of ['styles.css', ...Array.from({ length: 24 }, (_, i) => `styles-v${37 + i}.css`)]) {
  css += `\n/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(SRC, f), 'utf8');
}

// 1. 剥离 @media 块（wxss 对 media 支持不稳，且这些只是桌面/矮屏微调）
function stripAtBlocks(str, name) {
  let out = '', i = 0;
  while ((i = str.indexOf(name)) !== -1) {
    const braceStart = str.indexOf('{', i);
    let depth = 1, j = braceStart + 1;
    while (j < str.length && depth > 0) { if (str[j] === '{') depth++; else if (str[j] === '}') depth--; j++; }
    out += str.slice(0, i);
    str = str.slice(j);
  }
  return out + str;
}
css = stripAtBlocks(css, '@media');

// 2. 选择器转换（只处理 { 前的选择器段）
const b64 = {};
for (const f of fs.readdirSync(B64)) b64[f.replace('.txt', '')] = fs.readFileSync(path.join(B64, f), 'utf8');

const NOT_MAP = [
  [/:not\(\.deal-in\):not\(\.match-clone\)/g, '.dealt'],
  [/:not\(\.deal-in\)/g, '.dealt'],
  [/:not\(\.journey-profile\)/g, ''],
  [/:not\(:has\(\.tutorial-target\)\)/g, ''],
  [/:not\(\.featured\)/g, ''],
];
const TAG_MAP = { p: 1, b: 1, small: 1, strong: 1, h1: 1, h2: 1, h3: 1, i: 1, em: 1, img: 1, button: 1, input: 1, label: 1, span: 1, div: 1, section: 1, aside: 1, main: 1, header: 1, nav: 1, ul: 1, li: 1, svg: 1, text: 2 };

function convertSelector(sel) {
  sel = sel.replace(/\s+/g, ' ');
  // 特殊处理
  if (sel.includes('button:focus-visible')) return null;
  if (sel.includes('input:checked')) return null; // 开关改为 class 驱动，后面手写补充
  if (sel.trim() === '*') return 'view,image,text,button,input';
  sel = sel.replace(/:root\b/g, 'page');
  sel = sel.replace(/\bhtml\b/g, 'page').replace(/\bbody\b/g, 'page');
  sel = sel.replace(/\[data-motion="off"\]/g, '.motion-off');
  sel = sel.replace(/#game \.baked-art \.tile-art text\b/g, '#game .baked-art .wan-face .wan-txt');
  for (const [re, to] of NOT_MAP) sel = sel.replace(re, to);
  // 语义标签 → 类
  sel = sel.replace(/(^|[\s,>+~(])(p|b|small|strong|h1|h2|h3|i|em|img|button|input|label|span|div|section|aside|main|header|nav|ul|li|svg)(?=[\s,.:#\[>+~)]|$)/g,
    (m, pre, tag) => TAG_MAP[tag] === 2 ? `${pre}.wan-txt` : `${pre}.tag-${tag}`);
  sel = sel.replace(/\.tag-button(?=[\s,.:#\[>+~)]|$)/g, '.tag-btn');
  return sel;
}

// Rule-level walk. Dropping a selector has to drop its whole body too - the old
// version left the declaration block behind with no selector, which is invalid CSS.
// At-rule preludes and keyframe stops must never reach convertSelector.
let dropped = 0;
function transformRules(input) {
  let out = '', i = 0;
  while (i < input.length) {
    const brace = input.indexOf('{', i);
    if (brace === -1) { out += input.slice(i); break; }
    const semi = input.indexOf(';', i);
    if (semi !== -1 && semi < brace) { out += input.slice(i, semi + 1); i = semi + 1; continue; }
    const prelude = input.slice(i, brace);
    let depth = 1, j = brace + 1;
    while (j < input.length && depth > 0) {
      if (input[j] === '{') depth++; else if (input[j] === '}') depth--;
      j++;
    }
    const body = input.slice(brace + 1, j - 1);
    const comments = prelude.match(/\/\*[\s\S]*?\*\//g) || [];
    const sel = prelude.replace(/\/\*[\s\S]*?\*\//g, '');
    out += comments.join('');
    if (sel.trim().startsWith('@')) {
      const isKeyframes = /^@(-\w+-)?keyframes/i.test(sel.trim());
      out += sel + '{' + (isKeyframes ? body : transformRules(body)) + '}';
    } else {
      const converted = convertSelector(sel);
      if (converted === null) { dropped++; out += `/* dropped ${sel.trim()} */
`; }
      else out += converted + '{' + body + '}';
    }
    i = j;
  }
  return out;
}
css = transformRules(css);

// 3. 图片 → base64
// Each image is defined once as a custom property on `page` and referenced by var().
// Inlining the data URI at every use site duplicated ~64KB, and the main package is capped at 2MB.
const IMG = [
  ['table', /url\(["']?assets\/game-table-v1\.png["']?\)/g, 'game-table.jpg'],
  ['tree', /url\(["']?assets\/home-tree-v1\.png["']?\)/g, 'home-tree.jpg'],
  ['lotus', /url\(["']?assets\/lotus-lines\.svg["']?\)/g, 'lotus-lines.png'],
  ['bamboo', /url\(["']?assets\/bamboo-shadow\.svg["']?\)/g, 'bamboo-shadow.png'],
  // Only the DOM board needs this; drop it once the canvas renderer owns the board.
  ['shells', /url\(["']?assets\/tile-poses\/shells\.png["']?\)/g, 'shells.png'],
];
const usedImg = [];
for (const [name, re, key] of IMG) {
  let hit = false;
  css = css.replace(re, () => { hit = true; return `var(--img-${name})`; });
  if (hit) usedImg.push(`--img-${name}:url("${b64[key]}")`);
}
css = `page{${usedImg.join(';')}}
` + css;

// 4. 视口单位
css = css.replace(/100dvh/g, '100vh');

// 5. 追加小程序专用补充样式（开关、万能牌面、图标类等）
css += `
/* ==== mini-program additions ==== */
.tag-btn{font:inherit}
page{width:100%;height:100%;overflow:hidden;background:#f3f8f2}
page,body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif}
/* 开关（原 input:checked+i 改为 class 驱动） */
.toggle-row .tgl{position:relative;width:47px;height:27px;border-radius:30px;background:#cbc5bb;transition:.2s;flex:0 0 47px}
.toggle-row .tgl:after{content:"";position:absolute;left:3px;top:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:.2s}
.toggle-row .tgl.on{background:#8d2d25}
.toggle-row .tgl.on:after{transform:translateX(20px)}
/* 万面（原 svg text 改为 view 排版） */
.wan-face{position:absolute;left:5%;top:5%;width:90%;height:90%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6% 0 4%;mix-blend-mode:multiply}
.wan-txt{font-family:KaiTi,STKaiti,'Kaiti SC',SimSun,serif;font-weight:900;color:#1c1c1c;line-height:1}
.wan-num{color:#b4342c}
.wan-char{color:#1c1c1c}
/* journey 主按钮（原 >button:not(.journey-profile)） */
.step-main{display:flex}
`;

fs.writeFileSync(OUT, css);
console.log(`written ${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
console.log('rules dropped whole:', dropped);
const opens = (css.match(/\{/g) || []).length, closes = (css.match(/\}/g) || []).length;
console.log('braces', opens, '/', closes, opens === closes ? 'balanced' : 'UNBALANCED');
const dangling = css.match(/\*\/\s*\{/g);
console.log('dangling blocks after a comment:', dangling ? dangling.length : 0);
// 报告残留风险
const leftover = css.match(/:not\(|\[data-|@media|:root|dvh/g)?.reduce((a, m) => (a[m] = (a[m] || 0) + 1, a), {});
console.log('leftover risks:', JSON.stringify(leftover ?? {}));
console.log('url( count after inline:', (css.match(/url\(/g) || []).length, ' non-data:', (css.match(/url\((?!"data:)/g) || []).length);
