/* 静态资源压缩：在"文字必须清楚"的前提下取最小体积。
 *
 * 做法是对每张图生成多个候选编码，解码回像素和原图逐点比较，
 * 只接受同时通过两道闸的候选：
 *   rmseAll  —— 全图均方根误差
 *   rmseEdge —— 只统计强梯度像素（文字/描边就落在这些像素上）
 * 通过的候选里取体积最小的。文字糊掉一定会把 rmseEdge 顶上去，
 * 所以这道闸比看总体积或肉眼抽查都可靠。
 *
 * JPEG 一律用 4:4:4 —— 默认的 4:2:0 会把彩色文字边缘的色度减半，
 * 正是中文小字发虚的主因。
 *
 * 用法: node compress_assets.js [--apply]   (默认 dry-run)
 */
const sharp = require('./node_modules/sharp');
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'majiang-mp', 'src');
const STATIC = path.join(SRC_ROOT, 'static');
const APPLY = process.argv.includes('--apply');
const MAX_BYTES = 200 * 1024;      // 微信「图片和音频资源不超过200K」

// 只有一道闸，且绝不为了凑 200K 而放宽：清晰度优先于那条建议项。
// 压完仍然超 200K 的图会单独列出来，由人决定要不要再处理。
const GATE = { rmseAll: 1.6, rmseEdge: 3.2 };
// 省得太少就不值得换编码（避免把 18K 的牌面转成 17K 的 jpg 这种无谓改动）
const MIN_SAVE_RATIO = 0.15;
const MIN_SAVE_BYTES = 3 * 1024;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

/* 强梯度像素掩码：文字、描边、图标边界都在这里 */
function edgeMask(data, w, h) {
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Math.abs(lum[i + 1] - lum[i - 1]);
      const gy = Math.abs(lum[i + w] - lum[i - w]);
      if (gx + gy > 40) { mask[i] = 1; n++; }
    }
  }
  return { mask, count: n };
}

function compare(orig, cand, w, h, em) {
  let sumAll = 0, sumEdge = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) { const e = orig[p + c] - cand[p + c]; d += e * e; }
    const ea = orig[p + 3] - cand[p + 3];
    d += ea * ea;
    sumAll += d;
    if (em.mask[i]) sumEdge += d;
  }
  return {
    rmseAll: Math.sqrt(sumAll / (w * h * 4)),
    rmseEdge: em.count ? Math.sqrt(sumEdge / (em.count * 4)) : 0,
  };
}

const raw = buf => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

async function candidates(file, meta) {
  const hasAlpha = meta.channels === 4 || meta.hasAlpha;
  const out = [];
  const img = () => sharp(file);

  out.push({ ext: '.png', label: 'png-lossless', buf: await img().png({ compressionLevel: 9, effort: 10 }).toBuffer() });
  for (const colors of [256, 128, 64]) {
    out.push({
      ext: '.png', label: `png-pal${colors}`,
      buf: await img().png({ palette: true, colors, quality: 100, dither: 1.0, effort: 10, compressionLevel: 9 }).toBuffer(),
    });
  }
  if (!hasAlpha) {
    for (const q of [95, 92, 90, 87, 84, 80]) {
      out.push({
        ext: '.jpg', label: `jpg-q${q}`,
        buf: await img().jpeg({ quality: q, chromaSubsampling: '4:4:4', mozjpeg: true, trellisQuantisation: true, overshootDeringing: true }).toBuffer(),
      });
    }
  }
  return out;
}

async function main() {
  const files = walk(STATIC).filter(f => /\.(png|jpe?g)$/i.test(f));
  const plan = [];
  let before = 0, after = 0;

  for (const file of files) {
    const origSize = fs.statSync(file).size;
    before += origSize;
    const meta = await sharp(file).metadata();
    const { data: od, info } = await raw(fs.readFileSync(file));
    const em = edgeMask(od, info.width, info.height);

    const cands = await candidates(file, meta);
    const scored = [];
    for (const c of cands) {
      const { data: cd } = await raw(c.buf);
      const m = compare(od, cd, info.width, info.height, em);
      scored.push({ ...c, ...m, size: c.buf.length });
    }

    const saved = c => origSize - c.size;
    const pick = scored
      .filter(c => c.rmseAll <= GATE.rmseAll && c.rmseEdge <= GATE.rmseEdge)
      .filter(c => saved(c) >= MIN_SAVE_BYTES && saved(c) / origSize >= MIN_SAVE_RATIO)
      .sort((a, b) => a.size - b.size)[0];

    const rel = path.relative(STATIC, file).replace(/\\/g, '/');
    if (!pick) {
      after += origSize;
      console.log(`  keep     ${String(Math.round(origSize / 1024)).padStart(5)}K  ${rel}`);
      continue;
    }
    after += pick.size;
    plan.push({ file, rel, pick, origSize });
    const renamed = path.extname(file).toLowerCase() !== pick.ext;
    console.log(
      `  ok       ${String(Math.round(origSize / 1024)).padStart(5)}K -> ${String(Math.round(pick.size / 1024)).padStart(5)}K  ` +
      `${pick.label.padEnd(13)} rmse=${pick.rmseAll.toFixed(2)} edge=${pick.rmseEdge.toFixed(2)}  ${rel}${renamed ? '  [RENAME ' + pick.ext + ']' : ''}`
    );
  }

  console.log(`\ntotal ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB  (-${(100 - after / before * 100).toFixed(0)}%)`);
  const over = plan.filter(p => p.pick.size > MAX_BYTES);
  if (over.length) {
    console.log('\nstill over 200K:');
    for (const p of over) console.log(`  ${Math.round(p.pick.size / 1024)}K  ${p.rel}`);
  }

  const renames = plan.filter(p => path.extname(p.file).toLowerCase() !== p.pick.ext);
  if (renames.length) {
    console.log(`\n${renames.length} file(s) change extension; source references will be rewritten.`);
  }

  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  // 写文件 + 改扩展名
  const renameMap = [];
  for (const p of plan) {
    const target = p.pick.ext === path.extname(p.file).toLowerCase()
      ? p.file
      : p.file.slice(0, -path.extname(p.file).length) + p.pick.ext;
    fs.writeFileSync(target, p.pick.buf);
    if (target !== p.file) {
      fs.unlinkSync(p.file);
      renameMap.push([path.basename(p.file), path.basename(target)]);
    }
  }

  // 改写源码里的文件名引用
  if (renameMap.length) {
    const srcFiles = walk(SRC_ROOT).filter(f => /\.(vue|js|json|ts|scss|css)$/.test(f) && !f.includes(path.sep + 'static' + path.sep));
    let edits = 0;
    for (const sf of srcFiles) {
      let text = fs.readFileSync(sf, 'utf8');
      const orig = text;
      for (const [from, to] of renameMap) {
        text = text.split(from).join(to);
      }
      if (text !== orig) { fs.writeFileSync(sf, text); edits++; console.log('  rewrote refs in ' + path.relative(SRC_ROOT, sf)); }
    }
    console.log(`\nrenamed ${renameMap.length} file(s), updated ${edits} source file(s).`);
  }
  console.log('\napplied.');
}

main().catch(e => { console.error(e); process.exit(1); });
