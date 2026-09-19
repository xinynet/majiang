/* canvas UI 原语：素材加载、按比例取尺寸、图片/圆角/文字绘制、命中测试。
 *
 * 小程序侧这些事归 WXML + WXSS：一个 <image mode="scaleToFill"> 就把图放好了，
 * 一个 @tap 就把点击接住了。小游戏里两件事都得自己做，而且必须**用同一套矩形**
 * ——画在哪、点哪儿生效，只要两边各算一次迟早对不上。所以这里的约定是：
 * 所有可点元素都走 hit() 登记，绘制和命中用的是同一个 rect 对象。
 */
const { viewport } = require('./screen.js');

/* ------------------------------------------------------------------ 素材 */

const images = new Map();
const failed = new Set();

/** 预加载一批图片，返回 { key: Image }。失败的记名字但不阻断——缺一张图不该让游戏起不来。 */
function loadImages(entries) {
  const jobs = Object.entries(entries).map(([key, src]) => new Promise((resolve) => {
    if (images.has(key)) return resolve();
    const img = wx.createImage();
    img.onload = () => { images.set(key, img); resolve(); };
    img.onerror = () => { failed.add(key + ' <- ' + src); console.warn('[assets] 加载失败', key, src); resolve(); };
    img.src = src;
  }));
  return Promise.all(jobs).then(() => ({ images, failed: [...failed] }));
}

function img(key) { return images.get(key) || null; }

/* ------------------------------------------------------------------ 尺寸 */

/** 屏幕宽度的百分比 → 物理像素。UI 里一切横向尺寸都用它，不写死 px。 */
const vw = (pct) => viewport.W * pct / 100;
/** 屏幕高度的百分比 → 物理像素。 */
const vh = (pct) => viewport.H * pct / 100;
/** 字号基准：取屏幕宽度的 1/26，约等于小程序里 32rpx 的观感。 */
const rem = (mult = 1) => viewport.W / 26 * mult;

/** home-layout.js 的 css 百分比盒子 → 物理像素矩形。 */
function boxOf(css) {
  return {
    x: viewport.W * css.left / 100,
    y: viewport.H * css.top / 100,
    w: viewport.W * css.width / 100,
    h: viewport.H * css.height / 100,
  };
}

/** 某元素 box 内部的百分比槽位 → 物理像素矩形（用来往按钮上盖数值）。 */
function slotOf(box, slot) {
  return {
    x: box.x + box.w * slot.left / 100,
    y: box.y + box.h * slot.top / 100,
    w: box.w * slot.width / 100,
    h: box.h * slot.height / 100,
  };
}

/* ------------------------------------------------------------------ 绘制 */

/** 等价于 CSS 的 object-fit: fill（铺满，可变形）。home-layout 的盒子比例与图一致，所以不会变形。 */
function drawFill(ctx, image, r) {
  if (!image) return;
  ctx.drawImage(image, r.x, r.y, r.w, r.h);
}

/** 等价于 object-fit: contain（等比缩放，居中留白）。 */
function drawContain(ctx, image, r) {
  if (!image) return;
  const k = Math.min(r.w / image.width, r.h / image.height);
  const w = image.width * k, h = image.height * k;
  ctx.drawImage(image, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

/** 等价于 object-fit: cover（等比放大铺满，超出裁切）。背景图用它。 */
function drawCover(ctx, image, r) {
  if (!image) return;
  const k = Math.max(r.w / image.width, r.h / image.height);
  const w = image.width * k, h = image.height * k;
  ctx.drawImage(image, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

function roundRect(ctx, r, radius) {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

/** 一行字。`fit` 给定时会在超宽的情况下自动缩字号，而不是让它溢出盒子。 */
function text(ctx, str, x, y, {
  size = rem(1), color = '#fff', align = 'center', baseline = 'middle',
  weight = 'normal', stroke = null, strokeWidth = 0, fit = 0,
} = {}) {
  let px = size;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (fit > 0) {
    ctx.font = `${weight} ${px}px sans-serif`;
    const measured = ctx.measureText(str).width;
    if (measured > fit) px = Math.max(8, px * fit / measured);
  }
  ctx.font = `${weight} ${px}px sans-serif`;
  if (stroke) {
    ctx.lineWidth = strokeWidth || px * 0.18;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** 把一行字塞进矩形中心（数值槽位专用）。 */
function textIn(ctx, str, r, opts = {}) {
  text(ctx, str, r.x + r.w / 2, r.y + r.h / 2, {
    size: r.h * 0.82, fit: r.w * 0.96, align: 'center', baseline: 'middle', ...opts,
  });
}

/** 进度条。宝箱/集卡的 x/y 进度都用它。 */
function progressBar(ctx, r, ratio, { bg = 'rgba(0,0,0,.28)', fill = '#ffc43d', label = '' } = {}) {
  const k = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = bg;
  roundRect(ctx, r, r.h / 2);
  ctx.fill();
  if (k > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, { x: r.x, y: r.y, w: Math.max(r.h, r.w * k), h: r.h }, r.h / 2);
    ctx.fill();
  }
  if (label) textIn(ctx, label, r, { color: '#fff', stroke: 'rgba(0,0,0,.45)' });
}

/* ------------------------------------------------------------------ 命中测试 */

/* 每帧重建的热区表。绘制时顺手 hit(rect, fn) 登记，触摸时 hitTest 倒着找
 * ——后画的在上层，所以从后往前扫，第一个命中的就是最上面那个。 */
let zones = [];

function beginFrame() { zones = []; }

/** 登记一个热区；返回传入的 rect，方便 `drawFill(ctx, img, hit(r, fn))` 这样串着写。 */
function hit(rect, onTap, meta) {
  zones.push({ rect, onTap, meta });
  return rect;
}

function hitTest(p) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const { rect, onTap } = zones[i];
    if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
      return onTap;
    }
  }
  return null;
}

/** 触摸结束时调一次：命中就执行回调，返回是否命中。 */
function tap(p) {
  const fn = hitTest(p);
  if (!fn) return false;
  fn(p);
  return true;
}

/* ------------------------------------------------------------------ toast */

function drawToast(ctx, str) {
  const pad = rem(0.7);
  ctx.font = `${rem(0.95)}px sans-serif`;
  const w = Math.min(viewport.W * 0.82, ctx.measureText(str).width + pad * 2.4);
  const h = rem(2.3);
  const r = { x: (viewport.W - w) / 2, y: viewport.H * 0.62, w, h };
  ctx.save();
  ctx.fillStyle = 'rgba(20,32,28,.86)';
  roundRect(ctx, r, h / 2);
  ctx.fill();
  text(ctx, str, r.x + r.w / 2, r.y + r.h / 2, { size: rem(0.95), color: '#fff', fit: w - pad * 2 });
  ctx.restore();
}

module.exports = { loadImages, img, boxOf, slotOf, drawFill, drawContain, drawCover, roundRect, text, textIn, progressBar, beginFrame, hit, hitTest, tap, drawToast, vw, vh, rem };
