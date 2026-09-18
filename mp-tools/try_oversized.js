/* 三张仍然超过 200K 的图：在"设备实际显示尺寸"下比画质，找能压进 200K 的方案。
 *
 * 比较基准不是原始像素，而是两者都缩放到显示宽度后的结果 —— 资源本来就比
 * 显示尺寸大时，缩小分辨率并不会让用户看到更差的画面，按原分辨率比会低估它。
 */
const sharp = require('./node_modules/sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const DISPLAY_W = 1170;          // iPhone 12/13 @3x，常见的高端宽度
const LIMIT = 200 * 1024;

// ref 一律取 git HEAD 里的原图：拿已经压过的当前文件再压是叠加世代损失，
// 既冤枉了候选方案，也会把误差算虚高。
const TARGETS = [
  { name: 'bg_home', cur: 'majiang-mp/src/static/ui/bg_home.jpg', ref: 'majiang-mp/src/static/ui/bg_home.jpg' },
  { name: 'cards_top_disc', cur: 'majiang-mp/src/static/ui/cards_top_disc.jpg', ref: 'majiang-mp/src/static/ui/cards_top_disc.png' },
  { name: 'splash_bg', cur: 'majiang-mp/src/static/ui/splash_bg.jpg', ref: 'majiang-mp/src/static/ui/splash_bg.jpg' },
];
const FROM_GIT = true;

function edgeMask(data, w, h) {
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]) > 40) { mask[i] = 1; n++; }
  }
  return { mask, count: n };
}

function compare(a, b, w, h, em) {
  let sa = 0, se = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) { const e = a[p + c] - b[p + c]; d += e * e; }
    sa += d;
    if (em.mask[i]) se += d;
  }
  return { rmseAll: Math.sqrt(sa / (w * h * 3)), rmseEdge: em.count ? Math.sqrt(se / (em.count * 3)) : 0 };
}

const atDisplay = buf => sharp(buf).resize({ width: DISPLAY_W, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

(async () => {
  for (const t of TARGETS) {
    let refBuf;
    if (FROM_GIT) {
      refBuf = execSync(`git show HEAD:${t.ref}`, { cwd: REPO, maxBuffer: 1 << 28, encoding: 'buffer' });
    } else {
      refBuf = fs.readFileSync(path.join(REPO, t.ref));
    }
    console.log(`  (source: git HEAD ${t.ref}, ${Math.round(refBuf.length / 1024)}K)`);

    const curSize = fs.statSync(path.join(REPO, t.cur)).size;
    const meta = await sharp(refBuf).metadata();
    const { data: rd, info } = await atDisplay(refBuf);
    const em = edgeMask(rd, info.width, info.height);
    console.log(`\n=== ${t.name}  src ${meta.width}x${meta.height}  now ${Math.round(curSize / 1024)}K  (display ${info.width}x${info.height}) ===`);

    const cands = [];
    for (const w of [meta.width, 1170, 1080, 960]) {
      if (w > meta.width) continue;
      const base = () => sharp(refBuf).resize({ width: w, kernel: 'lanczos3' });
      for (const q of [95, 92, 90, 87, 84]) {
        cands.push({ label: `jpg q${q} @${w}`, ext: '.jpg', buf: await base().jpeg({ quality: q, chromaSubsampling: '4:4:4', mozjpeg: true, trellisQuantisation: true, overshootDeringing: true }).toBuffer() });
      }
      for (const q of [92, 88, 84]) {
        cands.push({ label: `webp q${q} @${w}`, ext: '.webp', buf: await base().webp({ quality: q, effort: 6, smartSubsample: false }).toBuffer() });
      }
    }

    const rows = [];
    for (const c of cands) {
      const { data: cd } = await atDisplay(c.buf);
      const m = compare(rd, cd, info.width, info.height, em);
      rows.push({ ...c, ...m, size: c.buf.length });
    }
    rows.sort((a, b) => a.size - b.size);
    for (const r of rows) {
      const fits = r.size <= LIMIT;
      const good = r.rmseEdge <= 3.2;
      if (!fits && r.size > LIMIT * 1.6) continue;
      console.log(`  ${fits ? '<=200K' : ' >200K'} ${good ? 'OK  ' : 'soft'}  ${String(Math.round(r.size / 1024)).padStart(4)}K  edge=${r.rmseEdge.toFixed(2)}  all=${r.rmseAll.toFixed(2)}  ${r.label}`);
    }
    const best = rows.filter(r => r.size <= LIMIT && r.rmseEdge <= 3.2).sort((a, b) => a.rmseEdge - b.rmseEdge)[0];
    console.log('  -> best under 200K passing edge gate: ' + (best ? `${best.label} @ ${Math.round(best.size / 1024)}K edge=${best.rmseEdge.toFixed(2)}` : 'NONE'));
  }
})();
