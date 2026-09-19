#!/usr/bin/env node
/* 从集卡页头图里去掉仿微信胶囊。
 *
 * 问题：`cards_top_disc.jpg` 右上角烤着一个仿微信胶囊——黑色半透明药丸 + 里面的「···」
 * + 右边一个不透明白色「⊗」。这与 R3 从首页母版剔掉的 `fake_capsule` 是同一类合规风险
 * （模仿系统 UI / 伪造平台入口），而且小游戏里真实胶囊就在同一个位置，两个叠在一起更显眼。
 * 见 HANDOFF_FIX_RECORD 的 R3/R5/R6。
 *
 * 三步，每步都只动该动的像素：
 *
 *   restore  药丸是**常数 alpha 的纯色叠加**，不用猜：直接反算就能把底下的美术一个像素
 *            不差地还原回来（连被压住的「视频宝箱」徽章金色天线一起）。实测叠加色
 *            ≈ rgb(16,16,16)、alpha ≈ 0.301，于是 out = (in - a*16) / (1 - a)。
 *            硬边两侧有几像素 JPEG 振铃，常数 alpha 算不回来，沿法线插值抹平。
 *            只有那几笔**不透明**的白（三个点 + ⊗ 圆环）是真丢了信息，输出成遮罩。
 *   paste    ⊗ 压着徽章的天线和金边，那块得重画：把徽章周围 200x200 裁出来送生图模型
 *            （见 genart.cjs），产物先按「未遮罩像素」做配准 + 逐通道色彩回归，再只把
 *            遮罩里的像素贴回来。三个点落在平涂背景上，用扩散填充比模型更稳。
 *   apply    写回小游戏与小程序两份素材（同一张图，两处在用）。
 *
 * 用法：
 *   node mp-tools/fix-disc-capsule.cjs restore
 *   node mp-tools/genart.cjs edit --image mp-tools/work/disc/badge-in.png --size 1024x1024 \
 *        --out mp-tools/work/disc/badge-out.png --prompt "...去掉白色圆圈叉..."
 *   node mp-tools/fix-disc-capsule.cjs paste
 *   node mp-tools/fix-disc-capsule.cjs apply
 *
 * 原图会在第一次运行时备份到 art-src/cards_top_disc_master.jpg，之后一律以它为输入，
 * 所以整条流程可以反复重跑而不会在已修过的图上再修一遍。
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
/* 同一张图，小游戏和小程序两处在用。 */
const TARGETS = [
  'majiang-game/static/cards/cards_top_disc.jpg',
  'majiang-mp/src/pkg-cards/static/ui/cards_top_disc.jpg',
];
const MASTER = path.join(ROOT, 'mp-tools/art-src/cards_top_disc_master.jpg');
const WORK = path.join(ROOT, 'mp-tools/work/disc');

/* 药丸几何（原图像素）与叠加参数，全部实测，见 R6 记录。 */
const PILL = { l: 946, t: 179, r: 1230, b: 281, radius: 51 };
const OVERLAY = { alpha: 0.301, color: 16 };
/* 不透明白笔画的判定：底图再亮，过了 0.699 的衰减也到不了这个值。 */
const WHITE_LUM = 186;
const DILATE = 5;
/* 送模型重画的窗口：把 ⊗ 连同整个徽章框进去，模型才知道该接回什么。 */
const CROP = { x: 1060, y: 150, w: 200, h: 200 };
/* 这条竖线左边的遮罩（三个点）走扩散填充，右边（⊗）走模型产物。 */
const DOTS_XMAX = 1070;

const f = (...p) => path.join(WORK, ...p);

/** 圆角矩形覆盖率，2x2 超采样，用来让还原的边缘平滑接上原图。 */
function coverage(x, y) {
  let hit = 0;
  for (const dx of [0.25, 0.75]) for (const dy of [0.25, 0.75]) {
    const px = x + dx, py = y + dy;
    if (px < PILL.l || px > PILL.r || py < PILL.t || py > PILL.b) continue;
    const cx = Math.min(Math.max(px, PILL.l + PILL.radius), PILL.r - PILL.radius);
    const cy = Math.min(Math.max(py, PILL.t + PILL.radius), PILL.b - PILL.radius);
    if (Math.hypot(px - cx, py - cy) <= PILL.radius) hit++;
  }
  return hit / 4;
}

/** 圆角矩形的有符号距离，负=内。用来定位那圈接缝并求法线。 */
function sdf(px, py) {
  const cx = (PILL.l + PILL.r) / 2, cy = (PILL.t + PILL.b) / 2;
  const qx = Math.abs(px - cx) - ((PILL.r - PILL.l) / 2 - PILL.radius);
  const qy = Math.abs(py - cy) - ((PILL.b - PILL.t) / 2 - PILL.radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - PILL.radius;
}

/** 第一次跑时把原图存成 master，之后一律以 master 为输入。 */
function sourceImage() {
  if (!fs.existsSync(MASTER)) {
    fs.mkdirSync(path.dirname(MASTER), { recursive: true });
    fs.copyFileSync(path.join(ROOT, TARGETS[0]), MASTER);
    console.log('已备份原图 → mp-tools/art-src/cards_top_disc_master.jpg');
  }
  return MASTER;
}

/* ------------------------------------------------------------------ restore */

async function restore() {
  fs.mkdirSync(WORK, { recursive: true });
  const src = sourceImage();
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info, C = 3;
  const out = Buffer.from(data);
  const maskAlpha = Buffer.alloc(W * H, 255);   // 255 = 保持原样
  const lumAt = (b, x, y) => { const i = (y * W + x) * C; return 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]; };
  let restored = 0, marks = 0;

  for (let y = PILL.t - 2; y <= PILL.b + 2; y++) {
    for (let x = PILL.l - 2; x <= PILL.r + 2; x++) {
      const cov = coverage(x, y);
      if (cov <= 0) continue;
      if (lumAt(data, x, y) > WHITE_LUM && cov > 0.9) { marks++; continue; } // 白笔画另说
      const a = OVERLAY.alpha * cov, i = (y * W + x) * C;
      for (let c = 0; c < 3; c++) {
        out[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - a * OVERLAY.color) / (1 - a))));
      }
      restored++;
    }
  }

  /* 轮廓接缝：药丸是硬边，JPEG 在边两侧留下几像素过冲/欠冲，常数 alpha 算不回来，
   * 沿法线从两侧各取一个干净样本插值补掉。 */
  const band = 3, reach = 7, snapshot = Buffer.from(out);
  const sample = (fx, fy, c) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const at = (x, y) => snapshot[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * C + c];
    return at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty)
         + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
  };
  for (let y = PILL.t - band - 2; y <= PILL.b + band + 2; y++) {
    for (let x = PILL.l - band - 2; x <= PILL.r + band + 2; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      if (Math.abs(d) > band || lumAt(data, x, y) > WHITE_LUM) continue;
      const e = 0.5;
      const nx = (sdf(x + 0.5 + e, y + 0.5) - sdf(x + 0.5 - e, y + 0.5)) / (2 * e);
      const ny = (sdf(x + 0.5, y + 0.5 + e) - sdf(x + 0.5, y + 0.5 - e)) / (2 * e);
      const len = Math.hypot(nx, ny) || 1, ux = nx / len, uy = ny / len;
      const t = (d + reach) / (2 * reach), i = (y * W + x) * C;
      for (let c = 0; c < 3; c++) {
        const inner = sample(x + 0.5 - ux * (d + reach), y + 0.5 - uy * (d + reach), c);
        const outer = sample(x + 0.5 - ux * (d - reach), y + 0.5 - uy * (d - reach), c);
        out[i + c] = Math.max(0, Math.min(255, Math.round(inner * (1 - t) + outer * t)));
      }
    }
  }

  /* 白笔画遮罩：膨胀几像素，把抗锯齿的灰边一起交出去。 */
  for (let y = PILL.t - 2; y <= PILL.b + 2; y++) {
    for (let x = PILL.l - 2; x <= PILL.r + 2; x++) {
      if (lumAt(data, x, y) <= WHITE_LUM || coverage(x, y) <= 0.9) continue;
      for (let dy = -DILATE; dy <= DILATE; dy++) for (let dx = -DILATE; dx <= DILATE; dx++) {
        if (dx * dx + dy * dy > DILATE * DILATE) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) maskAlpha[ny * W + nx] = 0;  // 0 = 要重画
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toFile(f('restored.png'));
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    rgba[p * 4] = data[p * C]; rgba[p * 4 + 1] = data[p * C + 1];
    rgba[p * 4 + 2] = data[p * C + 2]; rgba[p * 4 + 3] = maskAlpha[p];
  }
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toFile(f('mask.png'));
  /* 顺手把送模型的那块裁出来，1024 见方——模型对小图容易糊。 */
  await sharp(f('restored.png')).extract({ left: CROP.x, top: CROP.y, width: CROP.w, height: CROP.h })
    .resize(1024, 1024, { kernel: 'lanczos3' }).png().toFile(f('badge-in.png'));

  console.log('还原 ' + restored + ' 像素，白笔画 ' + marks + ' 像素');
  console.log('产物：work/disc/{restored,mask,badge-in}.png　下一步把 badge-in.png 交给 genart edit');
}

/* -------------------------------------------------------------------- paste */

async function paste() {
  const genFile = f('badge-out.png');
  if (!fs.existsSync(genFile)) {
    console.error('缺 work/disc/badge-out.png：先用 genart.cjs edit 把 badge-in.png 里的白色圆圈叉去掉。');
    process.exit(2);
  }
  const base = f('restored.png');
  const { data: O } = await sharp(base).extract({ left: CROP.x, top: CROP.y, width: CROP.w, height: CROP.h })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const M = await sharp(f('mask.png'))
    .extract({ left: CROP.x, top: CROP.y, width: CROP.w, height: CROP.h }).ensureAlpha().raw().toBuffer();
  const GW = CROP.w * 3;   // 模型产物留 3 倍分辨率，配准时好做亚像素取样
  const G = await sharp(genFile).resize(GW, GW, { fit: 'fill' }).removeAlpha().raw().toBuffer();

  const keep = [];
  for (let y = 0; y < CROP.h; y += 2) for (let x = 0; x < CROP.w; x += 2) {
    if (M[(y * CROP.w + x) * 4 + 3] !== 0) keep.push([x, y]);
  }
  const sampG = (fx, fy, c) => {
    const gx = fx * (GW / CROP.w), gy = fy * (GW / CROP.h);
    const x0 = Math.max(0, Math.min(GW - 2, Math.floor(gx))), y0 = Math.max(0, Math.min(GW - 2, Math.floor(gy)));
    const tx = gx - x0, ty = gy - y0, at = (x, y) => G[(y * GW + x) * 3 + c];
    return at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty)
         + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
  };
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const map = (x, y, s, dx, dy) => [(x - CROP.w / 2) / s + CROP.w / 2 + dx, (y - CROP.h / 2) / s + CROP.h / 2 + dy];

  /* 代价用相关系数而不是差的平方：模型产物整体偏色，这里比的是结构对不对齐。 */
  function cost(s, dx, dy) {
    let n = 0, sa = 0, sb = 0, saa = 0, sab = 0, sbb = 0;
    for (const [x, y] of keep) {
      const [fx, fy] = map(x, y, s, dx, dy);
      if (fx < 1 || fy < 1 || fx > CROP.w - 2 || fy > CROP.h - 2) continue;
      const i = (y * CROP.w + x) * 3;
      const a = lum(O[i], O[i + 1], O[i + 2]);
      const b = lum(sampG(fx, fy, 0), sampG(fx, fy, 1), sampG(fx, fy, 2));
      n++; sa += a; sb += b; saa += a * a; sab += a * b; sbb += b * b;
    }
    if (n < keep.length * 0.6) return Infinity;
    const ma = sa / n, mb = sb / n, cov = sab / n - ma * mb;
    return 1 - (cov * cov) / ((saa / n - ma * ma) * (sbb / n - mb * mb) + 1e-6);
  }

  /* 由粗到细：全空间穷举十几万次评估跑不完，先粗网格定位再局部收敛。 */
  let best = { c: Infinity, s: 1, dx: 0, dy: 0 };
  const passes = [
    { lo: 0.80, hi: 1.25, ss: 0.03, rad: 30, step: 3 },
    { ss: 0.01, rad: 4, step: 1 },
    { ss: 0.004, rad: 1.5, step: 0.4 },
  ];
  for (let i = 0; i < passes.length; i++) {
    const pa = passes[i];
    const sLo = i === 0 ? pa.lo : best.s - 0.03, sHi = i === 0 ? pa.hi : best.s + 0.03;
    const bx = best.dx, by = best.dy;
    let cur = { c: Infinity };
    for (let s = sLo; s <= sHi + 1e-9; s += pa.ss)
      for (let dx = bx - pa.rad; dx <= bx + pa.rad + 1e-9; dx += pa.step)
        for (let dy = by - pa.rad; dy <= by + pa.rad + 1e-9; dy += pa.step) {
          const c = cost(s, dx, dy);
          if (c < cur.c) cur = { c, s, dx, dy };
        }
    if (cur.c < Infinity) best = cur;
  }
  console.log('配准 scale=' + best.s.toFixed(3) + ' dx=' + best.dx.toFixed(2)
    + ' dy=' + best.dy.toFixed(2) + ' 残差=' + best.c.toFixed(4));

  /* 色彩对齐：未遮罩像素上逐通道线性回归，把模型的色调拉回原图。 */
  const gain = [], bias = [];
  for (let c = 0; c < 3; c++) {
    let n = 0, sa = 0, sb = 0, sbb = 0, sab = 0;
    for (const [x, y] of keep) {
      const [fx, fy] = map(x, y, best.s, best.dx, best.dy);
      const a = O[(y * CROP.w + x) * 3 + c], b = sampG(fx, fy, c);
      n++; sa += a; sb += b; sbb += b * b; sab += a * b;
    }
    const g = (n * sab - sa * sb) / (n * sbb - sb * sb);
    gain.push(g); bias.push((sa - g * sb) / n);
  }
  console.log('色彩校正 gain=' + gain.map(v => v.toFixed(3)).join(',') + ' bias=' + bias.map(v => v.toFixed(1)).join(','));

  const { data: baseBuf, info } = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const mFull = await sharp(f('mask.png')).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = 255 - mFull[p * 4 + 3];
  /* 注意：sharp 对单通道 raw 做 blur 会吐回 3 通道 sRGB，按 1 通道取下标会整层拿到 0
   * ——表现就是「贴了个寂寞」，原图一个像素没变。所以按实际通道数取。 */
  const blurred = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .blur(1.2).raw().toBuffer({ resolveWithObject: true });
  const bc = blurred.info.channels, soft = (p) => blurred.data[p * bc];

  const out = Buffer.from(baseBuf);
  let pasted = 0;
  for (let y = CROP.y; y < CROP.y + CROP.h; y++) for (let x = CROP.x; x < CROP.x + CROP.w; x++) {
    const p = y * W + x, a = soft(p);
    if (!a) continue;
    const [fx, fy] = map(x - CROP.x, y - CROP.y, best.s, best.dx, best.dy);
    const i = p * 3, t = a / 255;
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, Math.min(255, sampG(fx, fy, c) * gain[c] + bias[c]));
      out[i + c] = Math.round(baseBuf[i + c] * (1 - t) + v * t);
    }
    pasted++;
  }
  console.log('按遮罩回贴 ' + pasted + ' 像素（徽章那块）');

  /* 三个「···」点落在平涂背景上，扩散填充（反复取邻域均值，收敛到调和解）比模型更稳，
   * 也不会带进色调差。 */
  const hole = new Uint8Array(W * H);
  let dots = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < DOTS_XMAX; x++) {
    if (mFull[(y * W + x) * 4 + 3] === 0) { hole[y * W + x] = 1; dots++; }
  }
  const buf = Float64Array.from(out);
  for (let it = 0; it < 400; it++) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < DOTS_XMAX; x++) {
      if (!hole[y * W + x]) continue;
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        buf[i + c] = (buf[i - 3 + c] + buf[i + 3 + c] + buf[i - W * 3 + c] + buf[i + W * 3 + c]) / 4;
      }
    }
  }
  for (let p = 0; p < W * H; p++) if (hole[p]) for (let c = 0; c < 3; c++)
    out[p * 3 + c] = Math.max(0, Math.min(255, Math.round(buf[p * 3 + c])));
  console.log('扩散填充 ' + dots + ' 像素（三个点）');

  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(f('final.png'));
  console.log('产物：work/disc/final.png　确认没问题后跑 apply');
}

/* -------------------------------------------------------------------- apply */

async function apply() {
  const final = f('final.png');
  if (!fs.existsSync(final)) { console.error('缺 work/disc/final.png，先跑 paste'); process.exit(2); }
  sourceImage();   // 确保 master 已备份，别把修过的图当原图
  for (const t of TARGETS) {
    const dst = path.join(ROOT, t);
    if (!fs.existsSync(dst)) { console.log('跳过（不存在）：' + t); continue; }
    await sharp(final).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(dst + '.tmp');
    fs.renameSync(dst + '.tmp', dst);
    console.log('已写回 ' + t + '  ' + Math.round(fs.statSync(dst).size / 1024) + 'K');
  }
}

const cmd = process.argv[2];
const run = { restore, paste, apply }[cmd];
if (!run) { console.error('用法：fix-disc-capsule.cjs restore | paste | apply（详见文件头注释）'); process.exit(2); }
run().catch((e) => { console.error(e); process.exit(1); });
