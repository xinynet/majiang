/* 把三张超标图压进 200K，且不牺牲文字清晰度。
 *
 * 关键点：一律从"最无损的可得源"重编码，而不是在已经压过的文件上再压一次。
 *   splash_bg   <- miniprogram截图/启动界面.png (852x1846 无损)
 *   cards_top_disc <- git HEAD 的 cards_top_disc.png (1260x815 无损)
 *   bg_home     <- git HEAD 的 bg_home.jpg (1082K，已是现存最好的源)
 * 再按设备实际显示宽度评估画质，避免用超出显示需求的分辨率白白占体积。
 */
const sharp = require('./node_modules/sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const LIMIT = 200 * 1024;
const DISPLAY_W = 1170;

const TARGETS = [
  {
    name: 'bg_home',
    src: () => execSync('git show HEAD:majiang-mp/src/static/ui/bg_home.jpg', { cwd: REPO, maxBuffer: 1 << 28, encoding: 'buffer' }),
    widths: [1260, 1170, 1125],
  },
  {
    name: 'cards_top_disc',
    src: () => execSync('git show HEAD:majiang-mp/src/static/ui/cards_top_disc.png', { cwd: REPO, maxBuffer: 1 << 28, encoding: 'buffer' }),
    widths: [1260, 1170, 1125],
  },
  {
    name: 'splash_bg',
    src: () => fs.readFileSync(path.join(REPO, 'miniprogram截图', '启动界面.png')),
    widths: [852, 800, 750],
  },
];

function edgeMask(d, w, h) {
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) lum[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]) > 40) { mask[i] = 1; n++; }
  }
  return { mask, count: n };
}

function cmp(a, b, w, h, em) {
  let sa = 0, se = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let dd = 0;
    for (let c = 0; c < 3; c++) { const e = a[p + c] - b[p + c]; dd += e * e; }
    sa += dd;
    if (em.mask[i]) se += dd;
  }
  return { all: Math.sqrt(sa / (w * h * 3)), edge: em.count ? Math.sqrt(se / (em.count * 3)) : 0 };
}

(async () => {
  for (const t of TARGETS) {
    const src = t.src();
    const meta = await sharp(src).metadata();
    const dispW = Math.min(DISPLAY_W, meta.width);
    const norm = b => sharp(b).resize({ width: dispW, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data: rd, info } = await norm(src);
    const em = edgeMask(rd, info.width, info.height);
    console.log(`\n=== ${t.name}  source ${meta.width}x${meta.height} ${meta.format} ${Math.round(src.length / 1024)}K  (compared at ${info.width}x${info.height}) ===`);

    const rows = [];
    for (const w of t.widths) {
      if (w > meta.width) continue;
      for (const q of [92, 90, 88, 86, 84, 82, 80]) {
        const buf = await sharp(src).resize({ width: w, kernel: 'lanczos3' })
          .jpeg({ quality: q, chromaSubsampling: '4:4:4', mozjpeg: true, trellisQuantisation: true, overshootDeringing: true }).toBuffer();
        const { data: cd } = await norm(buf);
        rows.push({ label: `jpg q${q} @${w}`, size: buf.length, buf, ...cmp(rd, cd, info.width, info.height, em) });
      }
    }
    rows.sort((a, b) => b.size - a.size);
    for (const r of rows) {
      if (r.size > LIMIT * 1.35) continue;
      console.log(`  ${r.size <= LIMIT ? '<=200K' : ' >200K'}  ${String(Math.round(r.size / 1024)).padStart(4)}K  edge=${r.edge.toFixed(2)}  all=${r.all.toFixed(2)}  ${r.label}`);
    }
    const best = rows.filter(r => r.size <= LIMIT).sort((a, b) => a.edge - b.edge)[0];
    if (best) {
      console.log(`  -> BEST under 200K: ${best.label}  ${Math.round(best.size / 1024)}K  edge=${best.edge.toFixed(2)}`);
      fs.mkdirSync(path.join(__dirname, 'fit200'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, 'fit200', t.name + '.jpg'), best.buf);
    } else {
      console.log('  -> NOTHING fits under 200K as a single JPEG');
    }
  }
})();
