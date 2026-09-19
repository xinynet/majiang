/* 从美术母版重新生成首页的分层素材。
 *
 *   node mp-tools/build-home-layers.cjs
 *
 * 输入（两张母版都已归档进仓库，不再像上一版那样钉死一个 git blob 哈希——
 * 那样一旦历史被重写素材就再也重建不出来了）：
 *   mp-tools/art-src/home_bg_master.png   941x1672  无按钮的纯背景
 *   mp-tools/art-src/home_ui_master.png  1312x1199  带 alpha 的整版 UI（无数字）
 *
 * 输出：
 *   majiang-mp/src/static/ui/home/bg_home.webp   背景底图
 *   majiang-mp/src/static/ui/home/ui_*.webp      逐元素透明精灵
 *
 * 编码策略：
 *   一律有损 WebP。精灵虽然是硬边描边的矢量风图标，但 alphaQuality 100 把 alpha 通道
 *   单独保成无损，描边不会糊；色彩通道 q88 在 1:1 显示尺寸下肉眼看不出差别。
 *   对照过 near-lossless：15 个精灵合计 826K → q88 合计 292K，观感无差，
 *   而主包只有 2MB 预算，这 500K 不能白花。
 *   每个文件都做 200K 硬校验（微信代码质量扫描的「图片和音频资源不应超过200K」）。
 */

const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');
const { buildLayout, DROPPED } = require('./home-layout.cjs');

const ROOT = path.join(__dirname, '..');
const ART = path.join(__dirname, 'art-src');
const OUT = path.join(ROOT, 'majiang-mp', 'src', 'static', 'ui', 'home');

/** 微信代码质量扫描对单个图片资源的体积上限。 */
const LIMIT = 200 * 1024;

const kb = (n) => (n / 1024).toFixed(1) + 'K';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = [];

  /* ---- 背景 ----
   * 保持母版原始尺寸 941x1672 不做缩放：页面上用 scaleToFill 铺满，
   * 预先缩放到 1260x2800 只会让文件变大，屏幕上的观感一模一样。 */
  const bgSrc = path.join(ART, 'home_bg_master.png');
  const bgOut = path.join(OUT, 'bg_home.webp');
  await sharp(bgSrc).webp({ quality: 88, effort: 6, smartSubsample: true }).toFile(bgOut);
  report.push({ file: 'bg_home.webp', bytes: fs.statSync(bgOut).size, note: '941x1672 背景' });

  /* ---- 逐元素精灵 ---- */
  const uiSrc = path.join(ART, 'home_ui_master.png');
  for (const item of buildLayout()) {
    const dest = path.join(OUT, item.file);
    await sharp(uiSrc)
      .extract({ left: item.src.x, top: item.src.y, width: item.src.w, height: item.src.h })
      .webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(dest);
    report.push({
      file: item.file,
      bytes: fs.statSync(dest).size,
      note: `${item.src.w}x${item.src.h} @ ${item.css.left.toFixed(2)}%,${item.css.top.toFixed(2)}%`
    });
  }

  /* ---- 汇报 ---- */
  let total = 0;
  let over = 0;
  console.log('生成到 ' + path.relative(ROOT, OUT));
  for (const r of report) {
    total += r.bytes;
    const bad = r.bytes > LIMIT;
    if (bad) over++;
    console.log(`  ${bad ? '✗' : '✓'} ${r.file.padEnd(24)} ${kb(r.bytes).padStart(8)}   ${r.note}`);
  }
  console.log(`  ── 合计 ${kb(total)}，共 ${report.length} 个文件，超过 200K 的有 ${over} 个`);

  console.log('\n母版上被刻意丢弃、未进包的区域：');
  for (const d of DROPPED) console.log(`  · ${d.name}  ${d.why}`);

  writeCss();

  if (over > 0) {
    console.error('\n有文件超过 200K，微信代码质量检测不会通过。');
    process.exit(1);
  }
}

/* ---- 把几何写回 index.vue ----
 *
 * 精灵的位置、尺寸，以及数值槽位在精灵内部的位置，全部由 home-layout.cjs 算出来，
 * 手抄一遍必错。所以这里直接改写 index.vue 里 AUTOGEN 标记之间那一段。
 * 标记之外的排版、字号、配色仍然是手写的——自动生成的只有坐标。
 */
const BEGIN = '/* AUTOGEN:HOME-LAYERS:BEGIN';
const END = '/* AUTOGEN:HOME-LAYERS:END */';

function writeCss() {
  const vue = path.join(ROOT, 'majiang-mp', 'src', 'pages', 'index', 'index.vue');
  const text = fs.readFileSync(vue, 'utf8');
  const i = text.indexOf(BEGIN);
  const j = text.indexOf(END);
  if (i < 0 || j < 0) {
    console.warn('\nindex.vue 里找不到 AUTOGEN 标记，跳过 CSS 回写。');
    return;
  }

  const p2 = (v) => String(Math.round(v * 1000) / 1000) + '%';
  const layout = buildLayout();
  const lines = [];
  lines.push(BEGIN + ' —— 由 mp-tools/build-home-layers.cjs 生成，不要手改 */');
  lines.push('');
  lines.push('/* 每个 UI 精灵在屏幕上的盒子。宽高比 === 图片宽高比，配合 scaleToFill 不会变形。 */');
  for (const it of layout) {
    const c = it.css;
    lines.push(`.spr-${it.key} { left: ${p2(c.left)}; top: ${p2(c.top)}; width: ${p2(c.width)}; height: ${p2(c.height)}; }`);
  }
  lines.push('');
  lines.push('/* 数值槽位：百分比相对所属精灵盒子，对准母版图上那些留空的凹槽。 */');
  for (const it of layout) {
    for (const [name, s] of Object.entries(it.slots)) {
      lines.push(`.slot-${it.key}-${name} { left: ${p2(s.left)}; top: ${p2(s.top)}; width: ${p2(s.width)}; height: ${p2(s.height)}; }`);
    }
  }
  lines.push('');
  lines.push(END);

  const out = text.slice(0, i) + lines.join('\n') + text.slice(j + END.length);
  if (out === text) { console.log('\nindex.vue 的 AUTOGEN 几何段无变化。'); return; }
  fs.writeFileSync(vue, out);
  console.log('\n已回写 index.vue 的 AUTOGEN 几何段。');
}

main().catch((e) => { console.error(e); process.exit(1); });
