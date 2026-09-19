#!/usr/bin/env node
/* 生图工具：OpenAI 兼容的图片接口（generations / edits）+ 局部重绘回贴。
 *
 * 为什么要它：这个项目的美术里有几处必须重出——最典型的是 `cards_top_disc.jpg`
 * 右上角烤死的仿微信胶囊（模仿系统 UI，审核风险，见 HANDOFF_FIX_RECORD 的 R3/R5）。
 * 重出一版比让审核挑出来再改便宜得多。
 *
 * 凭据不写在仓库里，按下面顺序找：
 *   1. 环境变量 GENART_API_KEY / GENART_BASE_URL / GENART_MODEL
 *   2. ~/.config/genart/config.json  { baseUrl, apiKey, model }
 * 所以这个脚本本身可以放心提交。
 *
 * 用法：
 *   node mp-tools/genart.cjs models
 *   node mp-tools/genart.cjs dims    --image src.jpg
 *   node mp-tools/genart.cjs gen     --prompt "..." [--size 1024x1024] --out a.png
 *   node mp-tools/genart.cjs edit    --image src.jpg [--mask m.png] --prompt "..." --out b.png
 *   node mp-tools/genart.cjs mask    --image src.jpg --rect x,y,w,h[;...] --out m.png
 *   node mp-tools/genart.cjs inpaint --image src.jpg --rect x,y,w,h --prompt "..." --out c.jpg
 *                                    [--feather 6] [--quality 86] [--keep-work]
 *                                    [--mask-file m.png]  # 用现成遮罩，按像素回贴
 *
 * ## 为什么要有 inpaint，而不是直接用 edit
 *
 * gpt-image 这类模型的 edit **不是**传统局部重绘：它把整张图重新生成一遍，
 * 未遮罩区域只是「尽量还原」，不保证逐像素一致，输出尺寸还只能从接口支持的几档里选。
 * 直接拿它的产物替换原素材，等于整版美术被悄悄改过一遍——实测过一次，
 * 转盘中央凭空多了个灰圆、比例也从 1.546 变成 1.5。
 *
 * `inpaint` 因此多做三步：把模型产物缩放回原尺寸 → 只把**遮罩矩形那一块**贴回原图
 * → 边缘做羽化过渡。结果是矩形以外的像素和原图完全一致，改动范围就是你指定的那个框。
 *
 * 遮罩沿用 OpenAI 的约定：**透明（alpha=0）的区域是要重画的**，不透明的保持原样。
 * 坐标单位是原图像素，先用 `dims` 量一次再写 --rect。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

/* ------------------------------------------------------------------ 配置与参数 */

function loadConfig() {
  const file = path.join(os.homedir(), '.config', 'genart', 'config.json');
  let fromFile = {};
  try { fromFile = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 没有就算了 */ }
  const cfg = {
    baseUrl: (process.env.GENART_BASE_URL || fromFile.baseUrl || '').replace(/\/+$/, ''),
    apiKey: process.env.GENART_API_KEY || fromFile.apiKey || '',
    model: process.env.GENART_MODEL || fromFile.model || 'gpt-image-2.5-sunburst',
  };
  if (!cfg.baseUrl || !cfg.apiKey) {
    console.error(`没有找到生图凭据。设置 GENART_API_KEY / GENART_BASE_URL，或写 ${file}：`);
    console.error('  { "baseUrl": "https://...", "apiKey": "sk-...", "model": "gpt-image-2.5-sunburst" }');
    process.exit(2);
  }
  return cfg;
}

function argOf(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes('--' + name);

function parseRects(str) {
  if (!str) throw new Error('缺 --rect，格式 x,y,w,h[;x,y,w,h]');
  return str.split(';').filter(Boolean).map((part) => {
    const [x, y, w, h] = part.split(',').map(Number);
    if ([x, y, w, h].some((v) => !Number.isFinite(v))) throw new Error('--rect 格式应为 x,y,w,h[;x,y,w,h]');
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  });
}

/* ------------------------------------------------------------------ 图像操作 */

async function dims(file) {
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height, type: m.format };
}

/** 按矩形挖洞的遮罩：矩形内 alpha=0（要重画），其余不透明（保持原样）。 */
async function buildMask(width, height, rects, out) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (const r of rects) {
    const x1 = Math.min(width, r.x + r.w), y1 = Math.min(height, r.y + r.h);
    for (let y = Math.max(0, r.y); y < y1; y++) {
      for (let x = Math.max(0, r.x); x < x1; x++) rgba[(y * width + x) * 4 + 3] = 0;
    }
  }
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(out);
  return out;
}

/** 矩形羽化遮罩：中间全白、边缘 feather 像素内线性过渡到透明。用来把回贴块柔和地融进原图。 */
function featherMask(w, h, feather) {
  const a = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      a[y * w + x] = feather <= 0 ? 255 : Math.round(255 * Math.min(1, d / feather));
    }
  }
  return a;
}

/* ------------------------------------------------------------------ 接口调用 */

async function callJSON(cfg, urlPath, payload) {
  const res = await fetch(cfg.baseUrl + urlPath, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function callForm(cfg, urlPath, fields, files) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.append(k, String(v));
  for (const [k, file] of Object.entries(files)) {
    if (!file) continue;
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    form.append(k, new Blob([buf], { type }), path.basename(file));
  }
  const res = await fetch(cfg.baseUrl + urlPath, {
    method: 'POST', headers: { Authorization: 'Bearer ' + cfg.apiKey }, body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

/** 接口可能给 b64_json，也可能只给 url，两种都落成文件。 */
async function saveResult(json, out) {
  const item = json.data && json.data[0];
  if (!item) throw new Error('返回里没有 data：' + JSON.stringify(json).slice(0, 400));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (item.b64_json) {
    fs.writeFileSync(out, Buffer.from(item.b64_json, 'base64'));
  } else if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error('下载图片失败 HTTP ' + res.status);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  } else {
    throw new Error('返回里既没有 b64_json 也没有 url');
  }
  const d = await dims(out);
  console.log(`  → ${out}  ${d.w}x${d.h}  ${Math.round(fs.statSync(out).size / 1024)}K`);
  if (item.revised_prompt) console.log('  模型改写后的 prompt:', item.revised_prompt.slice(0, 200));
  return out;
}

/* ------------------------------------------------------------------ 局部重绘 */

async function inpaint(cfg) {
  const src = argOf('image');
  const out = argOf('out', 'inpainted.png');
  const rects = argOf('mask-file', null) ? [] : parseRects(argOf('rect'));
  const feather = Number(argOf('feather', 6));
  const quality = Number(argOf('quality', 86));
  const work = path.join(path.dirname(path.resolve(out)), '.genart-work');
  fs.mkdirSync(work, { recursive: true });

  const { w, h } = await dims(src);
  console.log(`原图 ${w}x${h}，重绘区域 ${argOf('mask-file', null) || rects.map((r) => `${r.x},${r.y} ${r.w}x${r.h}`).join(' / ')}`);

  /* 模型只吃 png/jpeg/webp，并且对带 alpha 的 png 更配合；统一先转一份 png 送上去。 */
  const srcPng = path.join(work, 'src.png');
  await sharp(src).png().toFile(srcPng);
  const maskFile = argOf('mask-file', null);
  const maskPng = maskFile || await buildMask(w, h, rects, path.join(work, 'mask.png'));

  console.log('调用 /v1/images/edits …');
  const json = await callForm(cfg, '/v1/images/edits',
    { model: cfg.model, prompt: argOf('prompt'), n: 1 },
    { image: srcPng, mask: maskPng });
  const genRaw = await saveResult(json, path.join(work, 'generated.png'));

  /* 模型产物的尺寸只能从它支持的那几档里挑，先等比拉回原尺寸再说。
   * fit: 'fill' 是故意的——这里要的是坐标能一一对应，不是保持模型产物的比例。 */
  const genFit = path.join(work, 'generated-fit.png');
  await sharp(genRaw).resize(w, h, { fit: 'fill' }).png().toFile(genFit);

  /* 关键一步：只把矩形那一块贴回原图，其余像素原封不动。
   * 直接整张替换的话，模型会把没让它改的地方也重画一遍（实测转盘中央凭空多了个灰圆）。 */
  const patches = [];
  if (maskFile) {
    /* 有精确遮罩时按遮罩回贴：只有遮罩里透明的那些像素（这里是几笔不透明白色）
     * 取模型产物，其余一律原图。比矩形回贴改动面积小一个数量级。 */
    const { data: mData, info: mInfo } = await sharp(maskFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (mInfo.width !== w || mInfo.height !== h) throw new Error('--mask-file 尺寸和原图不一致');
    const a = Buffer.alloc(w * h);
    for (let p = 0; p < w * h; p++) a[p] = 255 - mData[p * 4 + 3]; // 遮罩透明处 = 要贴过来
    /* sharp 对单通道 raw 做 blur 会吐回 3 通道的 sRGB——按 1 通道取下标会整层拿到 0，
     * 表现就是「贴了个寂寞」，原图一个像素没变。所以这里按实际通道数取。 */
    const blurred = await sharp(a, { raw: { width: w, height: h, channels: 1 } })
      .blur(Math.max(0.3, feather)).raw().toBuffer({ resolveWithObject: true });
    const bc = blurred.info.channels;
    const piece = await sharp(genFit).ensureAlpha().raw().toBuffer();
    for (let p = 0; p < w * h; p++) piece[p * 4 + 3] = blurred.data[p * bc];
    const pieceFile = path.join(work, 'piece-mask.png');
    await sharp(piece, { raw: { width: w, height: h, channels: 4 } }).png().toFile(pieceFile);
    patches.push({ input: pieceFile, left: 0, top: 0 });
  }
  for (const [i, r] of (maskFile ? [] : rects).entries()) {
    const piece = await sharp(genFit)
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .ensureAlpha()
      .raw().toBuffer();
    const alpha = featherMask(r.w, r.h, feather);
    for (let p = 0; p < r.w * r.h; p++) piece[p * 4 + 3] = alpha[p];
    const pieceFile = path.join(work, `piece-${i}.png`);
    await sharp(piece, { raw: { width: r.w, height: r.h, channels: 4 } }).png().toFile(pieceFile);
    patches.push({ input: pieceFile, left: r.x, top: r.y });
  }

  const ext = path.extname(out).toLowerCase();
  let pipeline = sharp(src).composite(patches);
  if (ext === '.jpg' || ext === '.jpeg') pipeline = pipeline.jpeg({ quality });
  else if (ext === '.webp') pipeline = pipeline.webp({ quality });
  else pipeline = pipeline.png();
  await pipeline.toFile(out);

  const d = await dims(out);
  console.log(`已写入 ${out}  ${d.w}x${d.h}  ${Math.round(fs.statSync(out).size / 1024)}K`);
  console.log(`（矩形以外与原图逐像素一致；中间产物在 ${work}）`);
  if (!hasFlag('keep-work')) fs.rmSync(work, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'dims') {
    const d = await dims(argOf('image'));
    console.log(JSON.stringify({ ...d, aspect: +(d.w / d.h).toFixed(3) }));
    return;
  }

  if (cmd === 'mask') {
    const image = argOf('image');
    const outFile = argOf('out', 'mask.png');
    const d = await dims(image);
    await buildMask(d.w, d.h, parseRects(argOf('rect')), outFile);
    console.log(`遮罩已写入 ${outFile}  ${d.w}x${d.h}（矩形内透明＝要重画）`);
    return;
  }

  const cfg = loadConfig();

  if (cmd === 'models') {
    const res = await fetch(cfg.baseUrl + '/v1/models', { headers: { Authorization: 'Bearer ' + cfg.apiKey } });
    const j = await res.json();
    const ids = (j.data || []).map((m) => m.id);
    console.log('图片相关模型：\n  ' + ids.filter((i) => /image|dall|flux|midjourney/i.test(i)).join('\n  '));
    console.log(`\n（共 ${ids.length} 个模型，当前默认 ${cfg.model}）`);
    return;
  }

  if (cmd === 'gen') {
    const json = await callJSON(cfg, '/v1/images/generations', {
      model: cfg.model, prompt: argOf('prompt'),
      n: Number(argOf('n', 1)), size: argOf('size', '1024x1024'),
    });
    await saveResult(json, argOf('out', 'out.png'));
    return;
  }

  if (cmd === 'edit') {
    const fields = { model: cfg.model, prompt: argOf('prompt'), n: Number(argOf('n', 1)) };
    const size = argOf('size', null);
    if (size) fields.size = size;
    const json = await callForm(cfg, '/v1/images/edits', fields,
      { image: argOf('image'), mask: argOf('mask', null) });
    await saveResult(json, argOf('out', 'out.png'));
    return;
  }

  if (cmd === 'inpaint') { await inpaint(cfg); return; }

  console.error('用法：models | dims | gen | edit | mask | inpaint（详见文件头注释）');
  process.exitCode = 2;
}

main().catch((e) => { console.error(String(e.message || e)); process.exitCode = 1; });
