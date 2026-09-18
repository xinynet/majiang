/* splash_bg 专项：上一轮强制 4:4:4 反而比现有文件还大。
 * 这里把色度采样、质量、尺寸一起铺开，用文字边缘误差挑最优解。 */
const sharp = require('./node_modules/sharp');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'miniprogram截图', '启动界面.png');
const LIMIT = 200 * 1024;

function edgeMask(d, w, h) {
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) lum[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  const mask = new Uint8Array(w * h); let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]) > 40) { mask[i] = 1; n++; }
  }
  return { mask, count: n };
}
function cmp(a, b, w, h, em) {
  let sa = 0, se = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let dd = 0; for (let c = 0; c < 3; c++) { const e = a[p + c] - b[p + c]; dd += e * e; }
    sa += dd; if (em.mask[i]) se += dd;
  }
  return { all: Math.sqrt(sa / (w * h * 3)), edge: em.count ? Math.sqrt(se / (em.count * 3)) : 0 };
}

(async () => {
  const src = fs.readFileSync(SRC);
  const meta = await sharp(src).metadata();
  const CW = 852;
  const norm = b => sharp(b).resize({ width: CW, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: rd, info } = await norm(src);
  const em = edgeMask(rd, info.width, info.height);
  const cur = fs.statSync(path.join(REPO, 'majiang-mp/src/static/ui/splash_bg.jpg')).size;
  console.log(`source ${meta.width}x${meta.height} ${Math.round(src.length / 1024)}K, current splash_bg ${Math.round(cur / 1024)}K`);

  const rows = [];
  for (const w of [852, 800, 750, 700]) {
    for (const cs of ['4:4:4', '4:2:0']) {
      for (const q of [90, 87, 84, 82, 80, 78, 75]) {
        const buf = await sharp(src).resize({ width: w, kernel: 'lanczos3' })
          .jpeg({ quality: q, chromaSubsampling: cs, mozjpeg: true, trellisQuantisation: true, overshootDeringing: true }).toBuffer();
        const { data: cd } = await norm(buf);
        rows.push({ label: `q${q} ${cs} @${w}`, size: buf.length, buf, ...cmp(rd, cd, info.width, info.height, em) });
      }
    }
  }
  const fit = rows.filter(r => r.size <= LIMIT).sort((a, b) => a.edge - b.edge);
  console.log('\ntop 12 under 200K, ranked by text-edge fidelity:');
  for (const r of fit.slice(0, 12)) console.log(`  ${String(Math.round(r.size / 1024)).padStart(4)}K  edge=${r.edge.toFixed(2)}  all=${r.all.toFixed(2)}  ${r.label}`);
  if (fit[0]) {
    fs.mkdirSync(path.join(__dirname, 'fit200'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'fit200', 'splash_bg.jpg'), fit[0].buf);
    console.log(`\n-> chose ${fit[0].label} @ ${Math.round(fit[0].size / 1024)}K edge=${fit[0].edge.toFixed(2)}`);
  }
})();
