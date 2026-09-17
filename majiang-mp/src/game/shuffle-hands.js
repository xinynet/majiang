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

/* 三次完整的洗牌动作：伸手进来 → 内扫/外扫 ×3 → 收手退出。
 *
 * 次数是刻意定死的，不是随手排的关键帧：每一次「内扫 + 外扫」算一次洗牌，
 * 下面正好三对。要改次数就整对地加减，并把所有 t 重新摊匀——
 * 只改其中一个 t 会让某一次扫得特别快，看上去就少了一次。
 *
 * 在 DEAL_DURATION(1900ms) 下每次洗牌约 480ms，刚好看得清。
 * 再快就糊成一团，玩家会觉得「只洗了一次」。 */
const FRAMES = [
  // 从画面下方伸进来
  { t: 0.00, x: -10, y: 100, rot: 15, alpha: 0 },
  { t: 0.08, x: -25, y: -20, rot: -8, alpha: 1 },
  // 第 1 次：向内上方大幅扫 → 退回外侧蓄力
  { t: 0.20, x: -62, y: -88, rot: -24, alpha: 1 },
  { t: 0.32, x: 30, y: -28, rot: 20, alpha: 1 },
  // 第 2 次
  { t: 0.46, x: -60, y: -92, rot: -22, alpha: 1 },
  { t: 0.58, x: 28, y: -32, rot: 18, alpha: 1 },
  // 第 3 次
  { t: 0.72, x: -56, y: -86, rot: -20, alpha: 1 },
  { t: 0.84, x: 22, y: -24, rot: 14, alpha: 1 },
  // 收手退出
  { t: 0.92, x: 10, y: -8, rot: 8, alpha: 1 },
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

/* 大范围手掌覆盖整个棋盘：手掌宽 55% 棋盘宽（最大 320px），放在 2:3 的手盒里，
 * 手盒底部探出棋盘 8%；轴心在手腕（boxH * 0.9）而不是盒子中心，所以手是「甩」的。
 * 图本身是 1:3，小臂会伸出手盒跑到屏幕外，看起来就像从画面外伸进来。 */
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
