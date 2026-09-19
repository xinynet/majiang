#!/usr/bin/env node
/* 把「本该透明却存成不透明」的小图标抠底。
 *
 * icon_crown_coin.png（天蓝底）和 icon_video_camera.png（青底）都是 96x96 / 64x64 的
 * 扁平图标，但 alpha 通道早被压掉了。小程序里它们贴在同色卡片上还看不出来，
 * 小游戏把它们画到奶油色弹窗和金色按钮上，就是一个突兀的方色块。
 *
 * 两种抠法，按图标自己的配色选：
 *   flood   从四边种子做容差漫水。摄像机图标的主体就是底色那个青，只能这么抠，
 *           否则整个图标一起没了。
 *   chroma  整图按「色向」抠：和底色同方向、亮度不超过底色的像素一律算背景。
 *           金币这张不能只按色差——它底下压着一圈**投影**，那是底色乘了个 0.65，
 *           色差 68 远超容差，于是投影留下来，还把右下角那块纯背景圈死在里面
 *           （边框上那几列也是投影，当不了漫水种子），抠完剩一块蓝角。
 *           而投影与底色的余弦相似度是 0.9995，金币本身只有 0.79，一刀切得干净。
 * 原图备份在 art-src/ 下，可以反复重跑。
 *
 * 用法：node mp-tools/dekey-icons.cjs [--check]
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const BACKUP = path.join(ROOT, 'mp-tools/art-src/icons-master');

/* 每个图标在小游戏和小程序各有一份拷贝，两边一起改。 */
const ICONS = [
  {
    name: 'icon_crown_coin.png',
    mode: 'chroma',
    copies: ['majiang-game/static/ui/icon_crown_coin.png', 'majiang-mp/src/static/ui/icon_crown_coin.png'],
  },
  {
    name: 'icon_video_camera.png',
    mode: 'flood',
    copies: ['majiang-game/static/icons/icon_video_camera.png', 'majiang-mp/src/static/icons/icon_video_camera.png'],
  },
];

const TOLERANCE = 30;   // flood：与底色的欧氏距离，小于它算背景
const SOFT = 46;        // flood：这个距离以内做 alpha 过渡，抠出来的边才不生硬
const COS_BG = 0.995;   // chroma：与底色的余弦相似度高过它就算背景（含投影）
const COS_EDGE = 0.97;  // chroma：这之间是抗锯齿边，alpha 线性过渡

async function dekey(srcFile, mode) {
  const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x, y) => (y * W + x) * 4;
  const bg = [data[0], data[1], data[2]];
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  const alphaFor = (d) => (d <= TOLERANCE ? 0 : Math.round(255 * (d - TOLERANCE) / (SOFT - TOLERANCE)));
  const out = Buffer.from(data);

  if (mode === 'chroma') {
    const bgLen = Math.hypot(bg[0], bg[1], bg[2]);
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      const len = Math.hypot(data[i], data[i + 1], data[i + 2]) || 1;
      const cos = (data[i] * bg[0] + data[i + 1] * bg[1] + data[i + 2] * bg[2]) / (len * bgLen);
      if (len > bgLen * 1.05) continue;               // 比底色还亮的是图标本体
      if (cos >= COS_BG) out[i + 3] = 0;              // 底色，或底色压的投影
      else if (cos > COS_EDGE) out[i + 3] = Math.round(255 * (COS_BG - cos) / (COS_BG - COS_EDGE));
    }
    let n = 0;
    for (let p = 0; p < W * H; p++) if (out[p * 4 + 3] < 255) n++;
    return { buf: out, W, H, cleared: n, bg };
  }

  /* 漫水：只有从边缘连通到的背景像素才抠，图标内部的同色区域保留。 */
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push([x, 0], [x, H - 1]); }
  for (let y = 0; y < H; y++) { stack.push([0, y], [W - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (seen[p]) continue;
    const d = dist(at(x, y));
    if (d > SOFT) continue;
    seen[p] = 1;
    out[at(x, y) + 3] = alphaFor(d);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let cleared = 0;
  for (let p = 0; p < W * H; p++) if (out[p * 4 + 3] < 255) cleared++;
  return { buf: out, W, H, cleared, bg };
}

(async () => {
  fs.mkdirSync(BACKUP, { recursive: true });
  for (const icon of ICONS) {
    const master = path.join(BACKUP, icon.name);
    const first = path.join(ROOT, icon.copies[0]);
    if (!fs.existsSync(master)) fs.copyFileSync(first, master);

    const { buf, W, H, cleared, bg } = await dekey(master, icon.mode);
    const png = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    console.log(`${icon.name}  底色 rgb(${bg.join(',')})  抠掉 ${cleared}/${W * H} 像素  ${Math.round(png.length / 1024)}K`);
    if (process.argv.includes('--check')) continue;
    for (const rel of icon.copies) {
      const dst = path.join(ROOT, rel);
      if (!fs.existsSync(dst)) { console.log('  跳过（不存在）：' + rel); continue; }
      fs.writeFileSync(dst, png);
      console.log('  已写回 ' + rel);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
