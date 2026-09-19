/* 离线预览首页分层排版，不用起微信开发者工具就能看排版对不对。
 *
 *   node mp-tools/mock-home.cjs [输出路径.png]
 *
 * 按 home-layout.cjs 里的百分比，在 1260x2800 的画布上把背景和各个精灵摆一遍，
 * 再把数值槽位（金币/体力/宝箱进度/集卡进度/礼包倒计时/关卡）画成占位文字。
 * 它复刻的是页面里 position:absolute + 百分比 + scaleToFill 的那套盒模型，
 * 所以这张图和真机渲染的差别只剩字体本身。
 *
 * 这不能代替真机截图（抗锯齿、字体度量都不同），但能在写 CSS 之前就发现
 * 「图块摆错位置」「数值盖到图案上」这类错误，省掉一轮开发者工具往返。
 */

const path = require('path');
const sharp = require('./node_modules/sharp');
const { DESIGN, buildLayout } = require('./home-layout.cjs');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'majiang-mp', 'src', 'static', 'ui', 'home');
const OUT = process.argv[2] || path.join(__dirname, 'work', 'mock-home.png');

/* 字号换算：小程序里 750rpx === 屏幕宽度，所以在 1260 宽的画布上 1rpx = 1.68px。
 * 这里直接抄 index.vue 里各个文字类的 rpx，预览才说明得了「四位数金币会不会顶到加号」
 * 这种真正要看的问题。 */
const RPX = DESIGN.W / 750;
const FONT = {
  num: 30 * RPX,      // .slot-num       金币 / 体力
  numSm: 30 * RPX,    // .slot-num-sm    宝箱进度
  sub: 20 * RPX,      // .slot-sub       体力后缀（max 或恢复倒计时）
  tag: 24 * RPX,      // .slot-tag       横幅上的集卡进度与金币门槛
  timer: 22 * RPX,    // .slot-timer     幸运礼包倒计时
  level: 32 * RPX     // .level-pill-text 关卡胶囊
};

/** 预览用的假数据。金币刻意取四位数，用来看最长的一串会不会溢出凹槽。 */
const SAMPLE = {
  coins: '1280',
  stamina: '3',
  staminaTimer: '14:02',
  levelChest: '1/5',
  starChest: '3/500',
  cards: '0/9',
  coin1: '200', coin2: '300', coin3: '500',
  luckyTimer: '00:14:57',
  level: '关卡2'
};

const pct = (v, total) => (v / 100) * total;

/* 一个数值槽位：底色块 + 居中文字，返回一段 SVG。
 * opt.sub 用来复刻「大号数值 + 小号后缀」那种两段式排版（体力就是这样），
 * 两段各用各的字号，才看得出整串会不会顶出凹槽。 */
function slotSvg(x, y, w, h, text, opt = {}) {
  const fs = Math.round(opt.fontSize || h * 0.62);
  const subFs = opt.sub ? Math.round(opt.subFontSize || fs * 0.6) : 0;
  const fill = opt.bg || 'rgba(0,0,0,0.35)';
  const color = opt.color || '#ffffff';
  const baseline = y + h / 2 + fs * 0.36;

  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;
  if (!opt.sub) {
    return out + `<text x="${x + w / 2}" y="${baseline}" font-size="${fs}" fill="${color}"` +
      ` font-family="Microsoft YaHei, sans-serif" font-weight="700" text-anchor="middle">${text}</text>`;
  }
  // 粗估两段总宽（数字约 0.55em），再按整体居中摆放，和 flex + justify-content: center 等效。
  const gap = fs * 0.24;
  const wMain = text.length * fs * 0.55;
  const wSub = opt.sub.length * subFs * 0.55;
  const startX = x + (w - (wMain + gap + wSub)) / 2;
  out += `<text x="${startX}" y="${baseline}" font-size="${fs}" fill="${color}"` +
    ` font-family="Microsoft YaHei, sans-serif" font-weight="700">${text}</text>`;
  out += `<text x="${startX + wMain + gap}" y="${baseline}" font-size="${subFs}" fill="${opt.subColor || '#fef08a'}"` +
    ` font-family="Microsoft YaHei, sans-serif" font-weight="700">${opt.sub}</text>`;
  return out;
}

async function main() {
  const layout = buildLayout();
  const byKey = Object.fromEntries(layout.map((l) => [l.key, l]));

  // 背景铺满整屏（页面里是 scaleToFill，这里 fit:'fill' 等价）。
  let canvas = await sharp(path.join(UI, 'bg_home.webp'))
    .resize(DESIGN.W, DESIGN.H, { fit: 'fill' }).png().toBuffer();

  const composites = [];
  for (const it of layout) {
    const w = Math.max(1, Math.round(pct(it.css.width, DESIGN.W)));
    const h = Math.max(1, Math.round(pct(it.css.height, DESIGN.H)));
    const buf = await sharp(path.join(UI, it.file)).resize(w, h, { fit: 'fill' }).png().toBuffer();
    composites.push({
      input: buf,
      left: Math.round(pct(it.css.left, DESIGN.W)),
      top: Math.round(pct(it.css.top, DESIGN.H))
    });
  }
  canvas = await sharp(canvas).composite(composites).png().toBuffer();

  /* 数值层。槽位百分比是相对各自精灵 box 的，这里换算回画布绝对像素。 */
  const abs = (key, slot) => {
    const it = byKey[key];
    const bx = pct(it.css.left, DESIGN.W), by = pct(it.css.top, DESIGN.H);
    const bw = pct(it.css.width, DESIGN.W), bh = pct(it.css.height, DESIGN.H);
    const s = it.slots[slot];
    return {
      x: bx + pct(s.left, bw), y: by + pct(s.top, bh),
      w: pct(s.width, bw), h: pct(s.height, bh)
    };
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${DESIGN.W}" height="${DESIGN.H}">`;
  const put = (key, slot, text, opt) => {
    const r = abs(key, slot);
    svg += slotSvg(r.x, r.y, r.w, r.h, text, opt);
  };
  const CLEAR = 'rgba(0,0,0,0)';
  put('topbar', 'coins', SAMPLE.coins, { bg: CLEAR, fontSize: FONT.num });
  put('topbar', 'stamina', SAMPLE.stamina, { bg: CLEAR, fontSize: FONT.num, sub: SAMPLE.staminaTimer, subFontSize: FONT.sub });
  put('chestLevel', 'progress', SAMPLE.levelChest, { bg: CLEAR, fontSize: FONT.numSm });
  put('chestStar', 'progress', SAMPLE.starChest, { bg: CLEAR, fontSize: FONT.numSm });
  put('banner', 'cards', SAMPLE.cards, { bg: CLEAR, fontSize: FONT.tag });
  put('banner', 'coin1', SAMPLE.coin1, { bg: CLEAR, fontSize: FONT.tag });
  put('banner', 'coin2', SAMPLE.coin2, { bg: CLEAR, fontSize: FONT.tag });
  put('banner', 'coin3', SAMPLE.coin3, { bg: CLEAR, fontSize: FONT.tag });
  put('tileLucky', 'timer', SAMPLE.luckyTimer, { bg: '#002d24', color: '#fef08a', fontSize: FONT.timer });

  // 关卡胶囊不是精灵，是纯 CSS 画的，这里按它在 index.vue 里的百分比复刻一份。
  const LEVEL_PILL = { left: 33.7, top: 69.8, width: 32.6, height: 4.1 };
  svg += slotSvg(pct(LEVEL_PILL.left, DESIGN.W), pct(LEVEL_PILL.top, DESIGN.H),
    pct(LEVEL_PILL.width, DESIGN.W), pct(LEVEL_PILL.height, DESIGN.H), SAMPLE.level,
    { bg: '#2b5952', fontSize: FONT.level });
  svg += '</svg>';

  await sharp(canvas).composite([{ input: Buffer.from(svg) }]).png().toFile(OUT);
  console.log('预览已写入 ' + path.relative(ROOT, OUT));
}

main().catch((e) => { console.error(e); process.exit(1); });
