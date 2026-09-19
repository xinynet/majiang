'use strict';
/* 首页分层改造的运行期验收：在微信开发者工具里真跑一遍，而不是只读源码。
 *
 *   node mp-tools/verify-home-layers.cjs
 *
 * home-regression.cjs 能证明「坐标算对了、素材都在、热区没重叠」，
 * 但证明不了「渲染层真的把这些 WebP 解出来了」「点下去真的有反应」。
 * 上一轮的遗留缺口就是这个——那次开发者工具在本机起不来，只能靠离线推理。
 *
 * 脚本做四件事：
 *   1. 起 IDE / 连自动化端口，reLaunch 到首页；
 *   2. 逐个查 14 个精灵节点在不在、尺寸是不是非零（尺寸为 0 就说明图没解出来或样式没生效）；
 *   3. 依次点几个按钮，确认弹窗真的弹出来；
 *   4. 截整屏存到 mp-tools/work/home-real.png，供人工与 mock-home.png 对拍。
 *
 * 需要开发者工具已登录，且「设置 → 安全设置 → CLI/HTTP 调用」是开着的。
 */

const path = require('path');
const fs = require('fs');
/* automator 装在仓库根的 node_modules 下（mp-tools 自己没装），
 * 这里显式指到那里，免得 mp-tools 里换个 cwd 就 require 不到。 */
const automator = require('../node_modules/miniprogram-automator');

const ROOT = path.join(__dirname, '..');
const CLI = path.join('C:', 'Program Files (x86)', 'Tencent', '微信web开发者工具', 'cli.bat');
const PROJECT = path.join(ROOT, 'majiang-mp', 'dist', 'build', 'mp-weixin');
const WORK = path.join(__dirname, 'work');
const SHOT = path.join(WORK, 'home-real.png');

const { buildLayout } = require('./home-layout.cjs');

let fails = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 已经有窗口开着自动化端口就直接连，省掉一次冷启动（IDE 冷启要一两分钟）。 */
async function attach() {
  try {
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 8000 });
    console.log('连上了已在运行的自动化端口 9420');
    return mp;
  } catch (e) {
    console.log('9420 没在监听，改为拉起 IDE：' + e.message);
  }
  return automator.launch({ cliPath: CLI, projectPath: PROJECT, port: 9420, timeout: 240000 });
}

/** 轮询等待落到首页；预算用尽还没到就返回 null，由调用方决定要不要主动接管。 */
async function waitForHome(mp, budgetMs) {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    try {
      const p = await mp.currentPage();
      if (p && p.path && p.path.indexOf('pages/index/index') >= 0) return p;
    } catch (e) { /* 编译中拿不到页面是正常的，继续等 */ }
    await sleep(1500);
  }
  return null;
}

async function main() {
  fs.mkdirSync(WORK, { recursive: true });
  const mp = await attach();

  const errors = [];
  mp.on('exception', (e) => errors.push('exception: ' + ((e && e.message) || JSON.stringify(e))));
  mp.on('console', (e) => {
    if (e.type === 'error') errors.push('console.error: ' + (e.args || []).map(String).join(' ').slice(0, 200));
  });

  console.log('\n一、进入首页');
  /* 启动页 splash 预热完素材后会自己 reLaunch 到首页。这时候外部再插一条 reLaunch
   * 会和它撞车，automator 那条请求等不到回包（表现为 timeout waiting for automator response）。
   * 所以先等它自己走完，只有超时还停在 splash 才主动接管。 */
  let page = await waitForHome(mp, 25000);
  if (!page) {
    console.log('  （splash 超过 25s 没跳转，主动 reLaunch 接管）');
    await mp.reLaunch('/pages/index/index');
    page = await waitForHome(mp, 15000);
  }
  ok(!!page, '当前页是首页：' + (page ? page.path : '未到达首页'));
  if (!page) { await mp.disconnect(); process.exit(1); }
  await sleep(1500);

  console.log('\n二、每个 UI 精灵都渲染出来了（节点在 + 尺寸非零）');
  /* 尺寸为 0 有两种成因：样式没命中（AUTOGEN 段被改坏），或者节点压根没渲染。
   * 图片解码失败不会让尺寸归零，所以另外再用截图做人工对拍。 */
  for (const it of buildLayout()) {
    const el = await page.$('.spr-' + it.key);
    ok(!!el, `节点存在：.spr-${it.key}`);
    if (!el) continue;
    const rect = await el.size();
    ok(rect && rect.width > 1 && rect.height > 1,
      `尺寸非零：.spr-${it.key} = ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  }

  console.log('\n三、数值文字确实渲染出内容');
  for (const [cls, label] of [
    ['.slot-topbar-coins', '金币'],
    ['.slot-topbar-stamina', '体力'],
    ['.slot-chestLevel-progress', '关卡宝箱进度'],
    ['.slot-chestStar-progress', '星星宝箱进度'],
    ['.slot-banner-cards', '集卡进度'],
    ['.slot-tileLucky-timer', '幸运礼包倒计时'],
    ['.level-pill', '关卡胶囊']
  ]) {
    const el = await page.$(cls);
    const text = el ? (await el.text()) : null;
    ok(!!text && text.trim().length > 0, `${label} 有文字：${cls} → "${text}"`);
  }

  console.log('\n四、精灵自身即热区，点下去真的有反应');
  for (const [cls, modalSel, label] of [
    ['.spr-tileLucky', '.lucky-bag-dialog', '幸运礼包'],
    ['.spr-tilePiggy', '.piggy-dialog', '存钱罐']
  ]) {
    const btn = await page.$(cls);
    ok(!!btn, `找得到可点节点：${cls}`);
    if (!btn) continue;
    await btn.tap();
    await sleep(900);
    const dialog = await page.$(modalSel);
    ok(!!dialog, `${label}弹窗弹出来了：${modalSel}`);
    if (dialog) {
      // 关掉，免得挡住后面的截图
      const close = await page.$('.modal-close-circle') || await page.$('.modal-close-btn-ribbon');
      if (close) { await close.tap(); await sleep(700); }
    }
  }

  console.log('\n五、整屏截图');
  await sleep(800);
  await mp.screenshot({ path: SHOT });
  ok(fs.existsSync(SHOT) && fs.statSync(SHOT).size > 10000,
    '截图已保存：' + path.relative(ROOT, SHOT));

  console.log('\n六、运行期报错');
  ok(errors.length === 0, '没有未捕获异常 / console.error'
    + (errors.length ? '（' + errors.slice(0, 5).join(' ｜ ') + '）' : ''));

  await mp.disconnect();
  console.log('\n' + (fails ? '✗ ' : '✓ ') + passed + ' 项通过，' + fails + ' 项不通过');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error('\n跑不起来：' + e.message);
  console.error('若提示连不上自动化端口，请在开发者工具「设置 → 安全设置」里打开 CLI/HTTP 调用，'
    + '并确认已登录，然后重跑。');
  process.exit(1);
});
