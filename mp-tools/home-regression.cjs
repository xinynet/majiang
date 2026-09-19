'use strict';
/* 首页（pages/index/index.vue）回归测试。
 *
 * 和 state-regression.cjs / cards-regression.cjs 一样：纯 Node，直接读磁盘上的源码，
 * 不需要构建产物，也不需要微信开发者工具。
 *
 *   node mp-tools/home-regression.cjs
 *
 * 覆盖三件事：
 *   一、图片引用：模板里写死的 <image src> 与运行时拼出来的动态 src，对应文件都真实存在；
 *   二、事件绑定：模板里 @tap/@change 绑到的每个处理函数，脚本里都定义了（反之亦然，
 *       避免出现“设了状态但没人渲染”“定义了函数但没人调用”的死角）；
 *   三、存档迁移：state.js 能把诊断基线存档 qa-original-profile.json 正确读进来，
 *       且卡册/礼包里的资源文件名不会被老存档里的旧扩展名污染。
 *
 * 需要真机/开发者工具才能验的部分（真实点击命中、渲染层图片实际解码）不在这里做，
 * 见文件末尾的 SKIP 段说明，运行时验证走 mp-tools/repro-home.cjs。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'majiang-mp');
const SRC = path.join(ROOT, 'src');
const INDEX_VUE = path.join(SRC, 'pages', 'index', 'index.vue');
const STATE_JS = path.join(SRC, 'game', 'state.js');
const PAGES_JSON = path.join(SRC, 'pages.json');
const BASELINE = path.join(__dirname, 'fixtures', 'qa-original-profile.json');

const indexSrc = fs.readFileSync(INDEX_VUE, 'utf8');
const stateSrc = fs.readFileSync(STATE_JS, 'utf8');

let fails = 0;
let passed = 0;
const skipped = [];

function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
}

function section(title) { console.log('\n' + title); }

function skip(msg) { skipped.push(msg); console.log('  SKIP  ' + msg); }

/* 取出 <template> / <script> / <style> 三段，避免注释里的字符串串味。 */
function block(src, tag) {
  const open = src.indexOf('<' + tag);
  if (open < 0) return '';
  const start = src.indexOf('>', open) + 1;
  const end = src.lastIndexOf('</' + tag + '>');
  return end > start ? src.slice(start, end) : '';
}

const tpl = block(indexSrc, 'template');
const script = block(indexSrc, 'script');
const style = block(indexSrc, 'style');

/* 小程序里的绝对资源路径以包根为准：/static/... 落在主包，
 * /pkg-xxx/static/... 落在对应分包，两者在源码里都直接挂在 src/ 下面。 */
function assetExists(absPath) {
  return fs.existsSync(path.join(SRC, absPath.replace(/^\//, '')));
}

/* ------------------------------------------------------------------ */
section('一、首页图片引用：模板写死的 src');

const literalSrcs = [...tpl.matchAll(/\bsrc="(\/[^"]+)"/g)].map(m => m[1]);
ok(literalSrcs.length > 0, `模板里解析到 ${literalSrcs.length} 个写死的图片引用`);
[...new Set(literalSrcs)].sort().forEach(p => {
  ok(assetExists(p), `资源存在：${p}`);
});

section('二、首页图片引用：运行时拼出来的动态 src');

/* 动态 src 都是 '<前缀>' + <数据字段> 的形式，前缀在模板里、取值在脚本里。
 * 这里把两边对上，逐个校验拼出来的完整路径。 */
const dynamicPrefixes = [...tpl.matchAll(/:src="'(\/[^']+\/)'\s*\+/g)].map(m => m[1]);
ok(dynamicPrefixes.includes('/static/icons/'), '商城道具图标走 /static/icons/ 前缀拼接');

// 商城商品表：shopItems 里每个 icon 都要能拼出真实文件
const shopBlock = script.slice(script.indexOf('const shopItems'), script.indexOf('// 广告模拟状态'));
const shopIcons = [...shopBlock.matchAll(/icon:\s*'([^']+)'/g)].map(m => m[1]);
ok(shopIcons.length === 5, `商城商品表解析到 ${shopIcons.length} 个道具图标（应为 5）`);
shopIcons.forEach(icon => {
  ok(assetExists('/static/icons/' + icon), `商城图标存在：/static/icons/${icon}`);
});

// 宝箱弹窗里的道具图标同样是拼出来的
const chestIcons = [...script.matchAll(/toolIcon:\s*'([^']+)'/g)].map(m => m[1]);
ok(chestIcons.length > 0, `宝箱奖励解析到 ${chestIcons.length} 个道具图标`);
[...new Set(chestIcons)].forEach(icon => {
  ok(assetExists('/static/icons/' + icon), `宝箱奖励图标存在：/static/icons/${icon}`);
});

/* ------------------------------------------------------------------ */
section('三、首页分层素材：干净背景 + 逐元素透明精灵');

/* 首页原本是「一整张烤死的位图」，经历过两版：
 *   v1  bg_home_1~5.jpg 五张竖向切片，flex: 1 均分容器高度拼成一屏。切片纯粹是为了
 *       让每个文件都低于微信代码质量扫描的 200K 线。代价是「开始游戏」按钮上方
 *       （第 4、5 片交界）有一条肉眼可见的白色横线——线不在像素里，是 5 个独立
 *       <image> 各自缩放到非整数高度、边缘抗锯齿各自向外发白叠出来的。
 *   v2  bg_home_full.webp 整幅 1260x2800 压到 178K，接缝消失，但 178K 已经贴着红线，
 *       而且顶栏右侧那个仿微信胶囊和仿游戏圈图标还烤在图里，数值也还是死的。
 *   v3（当前）拆成「纯风景背景 + 14 张带 alpha 的 UI 精灵 + <text> 数值」。
 *       单文件最大 60K，仿系统 UI 的两块直接不抠进来，数字全部动态。
 *
 * 几何由 mp-tools/home-layout.cjs 算、由 build-home-layers.cjs 回写进 index.vue，
 * 所以这一节除了查文件，还要查「源码里的 CSS 和布局表算出来的是同一份数字」——
 * 不然有人手改了 AUTOGEN 段，素材和坐标就悄悄对不上了。 */
const { buildLayout, DROPPED } = require('./home-layout.cjs');
const layout = buildLayout();
const HOME_BG = '/static/ui/home/bg_home.webp';

ok(assetExists(HOME_BG), `背景素材存在：${HOME_BG}`);
ok(literalSrcs.filter(p => p === HOME_BG).length === 1,
  '模板里恰好引用一次背景（单个 <image>，没有切片拼接，接缝按构造不存在）');
ok(!/bg_home_[1-5]\.jpg/.test(tpl), '模板不再引用任何 v1 切片 bg_home_1~5.jpg');
ok(!/bg_home_full\.webp/.test(tpl), '模板不再引用 v2 整幅底图 bg_home_full.webp');
ok(!fs.existsSync(path.join(SRC, 'static/ui/bg_home_full.webp')),
  'v2 整幅底图已从仓库删除（没有引用就是死重，主包里白占 178K）');

ok(DROPPED.length === 2,
  `母版上有 ${DROPPED.length} 块被刻意丢弃（仿微信胶囊 / 仿游戏圈），未抠进小程序`);
ok(!layout.some(it => /capsule|gamecircle/.test(it.key)),
  '精灵清单里没有任何仿系统 UI 的元素，右上角完整让给真正的微信胶囊');

layout.forEach(it => {
  const p = '/static/ui/home/' + it.file;
  ok(assetExists(p), `精灵素材存在：${p}`);
  ok(literalSrcs.filter(s => s === p).length === 1, `模板里恰好引用一次：${p}`);
});

/* 闪屏的预热清单必须和精灵清单一致，否则进首页时按钮会一个个蹦出来。 */
const splashSrc = fs.readFileSync(path.join(SRC, 'pages', 'splash', 'splash.vue'), 'utf8');
const preloaded = new Set([...splashSrc.matchAll(/'(\/static\/ui\/home\/[^']+)'/g)].map(m => m[1]));
ok(preloaded.has(HOME_BG), '闪屏预热了首页背景');
layout.forEach(it => {
  ok(preloaded.has('/static/ui/home/' + it.file), `闪屏预热了精灵：${it.file}`);
});
ok(preloaded.size === layout.length + 1,
  `闪屏预热清单不多不少（${preloaded.size} 项 = 背景 1 + 精灵 ${layout.length}）`);

/* 微信代码质量扫描：单个图片/音频资源不应超过 200K。首页引用到的每一张都得达标，
 * 换素材时最容易在这里翻车，所以逐个量一遍而不是只量背景。 */
const LIMIT_KB = 200;
[...new Set(literalSrcs)].sort().forEach(p => {
  const f = path.join(SRC, p.replace(/^\//, ''));
  if (!fs.existsSync(f)) return; // 缺文件在第一节已经报过 FAIL 了
  const kb = fs.statSync(f).size / 1024;
  ok(kb <= LIMIT_KB, `体积在 200K 以内：${p}（${kb.toFixed(1)}K）`);
});

/* ------------------------------------------------------------------ */
section('四、事件绑定：模板绑到的处理函数都有定义');

/* @tap="fn(x)" / @tap.stop="fn" / @change="fn('k')" 里取出被调用的标识符；
 * 形如 @tap.self="a.b = false" 的内联赋值不是函数调用，跳过。 */
const handlerNames = new Set();
for (const m of tpl.matchAll(/@(?:tap|click|change|longpress|input|confirm)(?:\.[a-z]+)*="([^"]+)"/g)) {
  const expr = m[1].trim();
  const call = expr.match(/^([A-Za-z_$][\w$]*)\s*(\(|$)/);
  if (call) handlerNames.add(call[1]);
}
ok(handlerNames.size > 0, `模板里解析到 ${handlerNames.size} 个事件处理函数`);

const definedFns = new Set(
  [...script.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])
);
[...script.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm)]
  .forEach(m => definedFns.add(m[1]));

[...handlerNames].sort().forEach(name => {
  ok(definedFns.has(name), `事件处理函数已定义：${name}()`);
});

section('五、没有“设了状态却没人渲染”的死角');

/* modals.xxx 每一个键都必须有一个 v-if 在消费它。宝箱奖励弹窗此前就是
 * 只有 modals.chestReward = true、模板里却没有对应节点，点下去毫无反馈。 */
const modalKeys = [...script.slice(script.indexOf('const modals = reactive('))
  .slice(0, script.slice(script.indexOf('const modals = reactive(')).indexOf('});'))
  .matchAll(/^\s*([A-Za-z_$][\w$]*):\s*(?:true|false)/gm)].map(m => m[1]);
ok(modalKeys.length >= 6, `弹窗状态表解析到 ${modalKeys.length} 个开关`);
modalKeys.forEach(key => {
  ok(new RegExp('v-if="modals\\.' + key + '"').test(tpl), `弹窗 modals.${key} 在模板里有对应节点`);
});

section('六、UI 精灵：几何与布局表一致、互不遮挡、图不变形');

/* 分层之后不再有独立标定的透明热区——精灵盒子自己就是热区（@tap 挂在 .spr 上），
 * 所以「看到的」和「点得到的」按构造就是同一个矩形，不会再出现
 * 「换了美术稿、热区没跟着挪、按钮压在旁边」这种上一版记录里点名的风险。 */
ok(!/class="hotspot /.test(tpl),
  '模板里不再有独立的 .hotspot 透明热区（改为精灵自身即热区）');

function cssRect(cls) {
  const at = style.indexOf('.' + cls + ' {');
  if (at < 0) return null;
  const body = style.slice(at, style.indexOf('}', at));
  const num = key => {
    const at2 = body.indexOf(key + ':');
    if (at2 < 0) return null;
    const v = parseFloat(body.slice(at2 + key.length + 1));
    return Number.isFinite(v) ? v : null;
  };
  const r = { left: num('left'), top: num('top'), width: num('width'), height: num('height') };
  return (r.left === null || r.top === null || r.width === null || r.height === null) ? null : r;
}

const rects = {};
const close = (a, b) => Math.abs(a - b) < 0.002;

layout.forEach(it => {
  const cls = 'spr-' + it.key;
  const r = cssRect(cls);
  ok(!!r, `精灵有完整的 left/top/width/height 定义：.${cls}`);
  if (!r) return;
  rects[cls] = r;
  /* AUTOGEN 段是 build-home-layers.cjs 从 home-layout.cjs 生成的。手改过、
   * 或者改了布局表却忘了重跑构建，都会在这里被抓住。 */
  ok(close(r.left, it.css.left) && close(r.top, it.css.top)
    && close(r.width, it.css.width) && close(r.height, it.css.height),
    `.${cls} 的坐标与 home-layout.cjs 算出来的一致（未手改 AUTOGEN 段）`);
});

/* 精灵一律 mode="scaleToFill"。只有当盒子宽高比 === 图片宽高比时它才等价于等比缩放；
 * 一旦有人只改了 width 没改 height，图就会被拉扁，而且图上的数值槽位会跟着错位。 */
const DESIGN_RATIO = 1260 / 2800;
layout.forEach(it => {
  const boxRatio = (it.css.width * DESIGN_RATIO) / it.css.height;
  const imgRatio = it.src.w / it.src.h;
  ok(Math.abs(boxRatio - imgRatio) < 0.01,
    `.spr-${it.key} 盒子宽高比与图片一致，scaleToFill 不会让图变形`
    + `（盒 ${boxRatio.toFixed(3)} / 图 ${imgRatio.toFixed(3)}）`);
});

ok(new RegExp('mode="scaleToFill"').test(tpl), '精灵使用 scaleToFill');
ok(!/class="spr-img[^"]*"\s+mode="aspectFit"/.test(tpl),
  '精灵没有用 aspectFit（会在盒子里居中留白，留白量随设备比例变化，数值就会飘）');

const names = Object.keys(rects);
const overlaps = [];
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = rects[names[i]], b = rects[names[j]];
    const dx = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    const dy = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
    // 留 0.05% 容差：相邻精灵共用一条边不算遮挡
    if (dx > 0.05 && dy > 0.05) overlaps.push(`${names[i]} × ${names[j]}`);
  }
}
ok(overlaps.length === 0, '精灵两两不重叠' + (overlaps.length ? '（重叠：' + overlaps.join('，') + '）' : ''));

/* 每个精灵都得能点。顶栏是特例：一张图上有金币、体力两段，
 * 所以 @tap 挂在两个子热区 .spr-tap 上而不是外层盒子。 */
layout.forEach(it => {
  const cls = 'spr-' + it.key;
  const at = tpl.indexOf('class="spr ' + cls + '"');
  ok(at >= 0, `模板里有精灵节点：.${cls}`);
  if (at < 0) return;
  const node = tpl.slice(at, tpl.indexOf('>', at));
  const inner = tpl.slice(at, tpl.indexOf('</view>', at));
  ok(/@tap="/.test(node) || /class="spr-tap/.test(inner),
    `.${cls} 可点击（自身绑了 @tap，或内部划分了子热区）`);
});
ok((tpl.match(/class="spr-tap /g) || []).length === 2,
  '顶栏拆出金币段 / 体力段两个子热区');

/* 数值文字层必须 pointer-events: none，否则它会盖住下面的精灵热区。 */
ok(/\.slot\s*\{[^}]*pointer-events:\s*none/.test(style),
  '数值层 .slot 设了 pointer-events: none，不吃掉精灵的点击');
ok(/\.level-pill\s*\{[^}]*pointer-events:\s*none/.test(style),
  '关卡胶囊 .level-pill 设了 pointer-events: none，不挡住「开始游戏」');

/* 所有数值槽位都得在模板里被消费掉，否则就是白算一遍坐标。 */
layout.forEach(it => {
  Object.keys(it.slots).forEach(name => {
    const cls = `slot-${it.key}-${name}`;
    ok(tpl.includes(cls), `数值槽位在模板里有对应节点：.${cls}`);
    ok(cssRect(cls), `数值槽位有完整几何定义：.${cls}`);
  });
});

section('七、页面跳转路径与 pages.json 一致');

const pagesJson = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf8'));
const known = new Set();
(pagesJson.pages || []).forEach(p => known.add('/' + p.path));
(pagesJson.subPackages || []).forEach(pkg => {
  (pkg.pages || []).forEach(p => known.add('/' + pkg.root + '/' + p.path));
});
const navTargets = [...indexSrc.matchAll(/'(\/p[\w/-]+)(?:\?|')/g)]
  .map(m => m[1])
  .filter(p => p.startsWith('/pages/') || p.startsWith('/pkg-'));
ok(navTargets.length >= 3, `首页解析到 ${navTargets.length} 个跳转目标`);
[...new Set(navTargets)].sort().forEach(p => {
  ok(known.has(p), `跳转目标已在 pages.json 注册：${p}`);
});

/* 分包改造后对局页搬到了 /pkg-game，跳转失败时 uni 默认只打控制台，
 * 界面上什么也不发生 —— 必须有 fail 兜底把失败暴露给玩家。 */
ok(/navigateTo\([\s\S]{0,400}?fail:/.test(script), 'navigateTo 带 fail 兜底，跳转失败不再静默');

/* 分包首次进入要等下载（弱网下 3~8 秒），这期间没有任何反馈就是「点了没反应」。
 * 关闭必须走 success / fail 两条腿：navigateTo 必定只命中其中一个，覆盖完整；
 * 而放在 complete 里会排在 fail 之后，把 fail 刚弹的 toast 一起掐掉
 * （微信的 loading 与 toast 共用一个通道）。 */
ok(/showLoading\(/.test(script), '跳转前给出加载提示 uni.showLoading');
const navBlock = script.slice(script.indexOf('function navigateOrWarn'));
const navBody = navBlock.slice(0, navBlock.indexOf('\n}\n') + 1);
ok(/success:\s*\(\)\s*=>\s*\{[^}]*hideLoading\(\)/.test(navBody),
  '跳转成功后关掉加载提示（success 分支）');
ok(/fail:\s*\(\)\s*=>\s*\{[^}]*hideLoading\(\)/.test(navBody),
  '跳转失败后也关掉加载提示（fail 分支），不会卡住一个转圈');
ok(!/complete:/.test(navBody),
  'hideLoading 不放在 complete 里（会把 fail 分支的 toast 一起关掉）');

/* 预下载：进首页就把两个分包拉下来，尽量让玩家点「开始游戏」时分包已经就位。 */
ok(!!pagesJson.preloadRule, 'pages.json 配了分包预下载 preloadRule');
const preload = (pagesJson.preloadRule || {})['pages/index/index'];
ok(!!preload, '预下载规则挂在首页 pages/index/index 上');
if (preload) {
  ok(preload.network === 'all', `预下载不限网络类型：network = ${preload.network}`);
  const roots = (pagesJson.subPackages || []).map(p => p.root);
  roots.forEach(r => {
    ok((preload.packages || []).includes(r), `分包已进预下载名单：${r}`);
  });
}

/* ------------------------------------------------------------------ */
section('八、存档迁移：state.js 读得动诊断基线存档');

/* state.js 是 ESM 且 import 了 vue，Node 里不能直接 require；
 * 沿用 state-regression.cjs 的做法把它编译成一个可注入依赖的工厂函数。 */
function loadState(stored) {
  const exported = [];
  let code = stateSrc.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  code = code.replace(/^export\s+(const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm,
    (m, kind, name) => { exported.push(name); return kind + ' ' + name; });
  const body = code + '\nreturn { ' + exported.map(n => n + ': ' + n).join(', ') + ' };';
  // eslint-disable-next-line no-new-func
  const factory = new Function('reactive', 'watch', 'uni', 'setInterval', body);
  const store = new Map([['majiang_user_profile_v2', stored]]);
  const uni = {
    getStorageSync: k => (store.has(k) ? store.get(k) : ''),
    setStorageSync: (k, v) => store.set(k, v),
  };
  return factory(v => v, () => () => {}, uni, () => 0);
}

if (!fs.existsSync(BASELINE)) {
  skip('基线存档 mp-tools/fixtures/qa-original-profile.json 缺失，跳过存档迁移断言');
} else {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const { gameState } = loadState(baseline);

  ok(gameState.coins === 1200, `金币保留：${gameState.coins}（基线 1200）`);
  ok(gameState.stamina === 5 && gameState.maxStamina === 5,
    `体力保留：${gameState.stamina}/${gameState.maxStamina}（基线 5/5）`);
  ok(gameState.staminaTimer === 0, '满体力时恢复计时归零');
  ok(gameState.stars === 3, `星星保留：${gameState.stars}（基线 3）`);
  ok(gameState.currentLevel === 2, `关卡保留：${gameState.currentLevel}（基线 2）`);
  ok(gameState.settings.gmMode === true, 'GM 开关保留：基线为开');
  ok(gameState.tools.clear === 3 && gameState.tools.shuffle === 4 && gameState.tools.undo === 4,
    '道具持有量保留：消除3 / 洗牌4 / 翻牌4');
  ok(gameState.piggyBank.coins === 25, `存钱罐保留：${gameState.piggyBank.coins}`);
  ok(gameState.levelChest.current === 1 && gameState.levelChest.target === 5,
    '关卡宝箱进度保留：1/5');
  ok(gameState.cardsAlbum.length === 9, `卡册条目 ${gameState.cardsAlbum.length} 套`);
  ok(gameState.cardsAlbum.find(c => c.id === 'sweet_potato').count === 1,
    '卡册已有进度保留：暖心红薯 1 张');
  ok(gameState.longTasks.find(t => t.id === 'long_win100').current === 2,
    '长期任务进度保留：麻将宗师 2/100');

  section('九、老存档不能把图片路径带坏（集卡页裂图的根因）');

  /* 基线存档里卡册图片存的是 .png（美术换版前的老文件名），而仓库里的素材
   * 已经是 .jpg。若 mergeStored 按“存档里有值就保留”把它带进来，集卡页九张
   * 卡片会全部裂图。state.js 读档后必须把资源文件名改回代码里的默认值。 */
  ok(baseline.cardsAlbum.every(c => /\.png$/.test(c.image)),
    '基线存档确实带着老的 .png 卡册文件名（回归前提成立）');
  gameState.cardsAlbum.forEach(c => {
    ok(assetExists('/pkg-cards/static/ui/' + c.image),
      `卡册素材存在：/pkg-cards/static/ui/${c.image}`);
  });

  // 主包数据只能引主包资源：分包的 pkg-game/static 在首页是取不到的
  const ICON_ROOTS = ['/static/ui/', '/static/icons/'];
  gameState.luckyBag.rewards.forEach(r => {
    ok(ICON_ROOTS.some(root => assetExists(root + r.icon)),
      `幸运礼包图标存在：${r.icon}`);
  });

  // 空存档（新玩家）走同一条路，资源名同样要落在真实文件上
  const fresh = loadState('').gameState;
  ok(fresh.cardsAlbum.every(c => assetExists('/pkg-cards/static/ui/' + c.image)),
    '新玩家（空存档）卡册素材同样全部存在');
}

/* ------------------------------------------------------------------ */
section('十、需要运行时环境的部分（本脚本不覆盖）');
skip('真机/开发者工具下的实际点击命中与渲染层图片解码：需开发者工具开 9420 自动化端口，走 mp-tools/repro-home.cjs');
skip('底图热区与美术坐标的像素级比对：需要当次构建的真机截图，属人工验收项');

/* ------------------------------------------------------------------ */
console.log('\n' + (fails ? '✗ ' : '✓ ') + passed + ' 个断言通过，' + fails + ' 个失败，'
  + skipped.length + ' 个跳过');
process.exit(fails ? 1 : 0);
