/* The pair of hands that sweep over the pile while the board is being dealt.
 *
 * They are painted into the board canvas rather than laid over it as views: a
 * mini-program canvas is a native component and composites above every <view>,
 * so a hand built out of <image> would end up behind the tiles.
 *
 * The motion is the one the H5 build ran as the `shuffleHand` CSS animation,
 * with its keyframes kept in the same units - x as a share of the hand box's
 * width, y as a share of its height, degrees for the turn. Only the right hand
 * is drawn; the left is the same picture mirrored, exactly as the stylesheet
 * did it.
 */

const FRAMES = [
  { t: 0.00, x: -10, y: 100, rot: 15, alpha: 0 },
  // 扫向内侧上方大范围 (扫第1次)
  { t: 0.08, x: -30, y: -25, rot: -10, alpha: 1 },
  { t: 0.18, x: -65, y: -90, rot: -24, alpha: 1 },
  // 扫向外侧下方 (退回蓄力)
  { t: 0.28, x: 30, y: -30, rot: 20, alpha: 1 },
  // 扫向中心高处大范围 (扫第2次)
  { t: 0.38, x: -60, y: -95, rot: -22, alpha: 1 },
  // 扫向外侧
  { t: 0.48, x: 28, y: -35, rot: 18, alpha: 1 },
  // 再次大幅度向内扫 (扫第3次)
  { t: 0.58, x: -58, y: -88, rot: -20, alpha: 1 },
  // 扫向外侧
  { t: 0.68, x: 25, y: -30, rot: 15, alpha: 1 },
  // 最后一次大幅度向内扫 (扫第4次)
  { t: 0.78, x: -50, y: -80, rot: -16, alpha: 1 },
  // 收手退出
  { t: 0.88, x: 10, y: -10, rot: 8, alpha: 1 },
  { t: 1.00, x: 25, y: 115, rot: 20, alpha: 0 },
];

const DEG = Math.PI / 180;
// Stands in for the stylesheet's ease-in-out between one keyframe and the next.
const ease = p => p * p * (3 - 2 * p);

function sample(progress) {
  let i = 1;
  while (i < FRAMES.length - 1 && FRAMES[i].t < progress) i++;
  const a = FRAMES[i - 1], b = FRAMES[i], span = b.t - a.t;
  const k = span > 0 ? ease((progress - a.t) / span) : 1;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    rot: a.rot + (b.rot - a.rot) * k,
    alpha: a.alpha + (b.alpha - a.alpha) * k,
  };
}

/* 大范围手掌覆盖整个棋盘：
 * 手掌尺寸由 44% 增加至 55% 棋盘宽 (最大 320px)，高度 1.5 倍，
 * 手腕轴心随手势大范围深入棋盘上部和中部，4次完整洗牌动作覆盖全桌。 */
export function drawShuffleHands(ctx, img, width, height, progress) {
  if (!img || progress <= 0 || progress >= 1) return;
  const f = sample(progress);
  if (f.alpha <= 0.001) return;
  const boxW = Math.min(width * 0.55, 320), boxH = boxW * 1.5;
  const top = height * 1.05 - boxH;
  for (const side of [-1, 1]) {
    const left = side < 0 ? -width * 0.05 : width - boxW + width * 0.05;
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.translate(left + boxW / 2 + side * f.x / 100 * boxW, top + boxH * 0.9 + f.y / 100 * boxH);
    ctx.rotate(side * f.rot * DEG);
    ctx.scale(side, 1);
    ctx.drawImage(img, -boxW / 2, -boxH * 0.9, boxW, boxW * 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
