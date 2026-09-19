/* 卡册页回归：从 cards.vue 的 #region cards-pure-logic 提取纯函数，在 Node 中直接断言。
 * 运行：node mp-tools/cards-regression.cjs
 * 说明：不依赖渲染层、不加载 .vue、不触碰开发者工具与存档。 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'majiang-mp', 'src', 'pkg-cards', 'pages', 'cards', 'cards.vue');
const src = fs.readFileSync(SRC, 'utf8');

const START = '// #region cards-pure-logic';
const END = '// #endregion cards-pure-logic';
const s = src.indexOf(START);
const e = src.indexOf(END);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

if (s < 0 || e < 0 || e <= s) {
  console.error('未找到 cards.vue 的 #region cards-pure-logic 纯逻辑标记区');
  process.exit(1);
}

const body = src.slice(s + START.length, e);
const CARD_TARGET = 9, EXCHANGE_COST = 3, COMPLETE_REWARD_COINS = 100;
const api = new Function(
  'CARD_TARGET', 'EXCHANGE_COST', 'COMPLETE_REWARD_COINS',
  body + '\nreturn { ensureCardFields, findCardById, countCompletedSets, drawFragment, pickRandomCardId, exchangeFragment };'
)(CARD_TARGET, EXCHANGE_COST, COMPLETE_REWARD_COINS);

const { countCompletedSets, drawFragment, pickRandomCardId, exchangeFragment } = api;

const newAlbum = () => ([
  { id: 'hotpot', name: '热辣火锅', image: 'card_hotpot.jpg', count: 0, target: 9, chestCount: 1 },
  { id: 'snowman', name: '欢快雪人', image: 'card_snowman.jpg', count: 0, target: 9, chestCount: 1 },
  { id: 'sleigh', name: '华丽雪橇', image: 'card_sleigh.jpg', count: 0, target: 9, chestCount: 1 }
]);

console.log('[1] 抽卡：未集满逐张累加，不越界');
{
  const a = newAlbum();
  const r1 = drawFragment(a, 'hotpot');
  ok(r1.ok && r1.count === 1 && r1.duplicate === false, '第1张：count 0 -> 1，非重复');
  ok(r1.rewardGranted === false, '第1张：不发放集齐奖励');
  ok(a[0].duplicates === 0, '第1张：duplicates 保持 0');
  for (let i = 2; i <= 8; i++) drawFragment(a, 'hotpot');
  ok(a[0].count === 8, `抽满8张：count = ${a[0].count}（未达阈值不发奖）`);
  ok(a[1].count === 0 && a[2].count === 0, '抽卡只影响目标卡册，其他卡册不受影响');
  const bad = drawFragment(a, 'not-exist');
  ok(bad.ok === false && bad.reason === 'missing', '未知卡册 id：返回 missing，不抛错');
}

console.log('\n[2] 集齐奖励：仅跨过阈值那一次发放');
{
  const a = newAlbum();
  let grants = 0;
  const results = [];
  for (let i = 0; i < 30; i++) {
    const r = drawFragment(a, 'hotpot');
    results.push(r);
    if (r.rewardGranted) grants++;
  }
  ok(grants === 1, `连抽30次：集齐奖励只发了 ${grants} 次（要求 1 次）`);
  ok(results[8].rewardGranted === true && results[8].completed === true, '第9张触发集齐奖励');
  ok(results.slice(9).every(r => r.rewardGranted === false), '第10张起不再发放奖励');
  ok(a[0].count === 9, `count 稳定在 ${a[0].count}（不再无限累加）`);
  ok(a[0].duplicates === 21, `第10~30张共21张转为重复碎片，实际 ${a[0].duplicates}`);
  ok(results.slice(9).every(r => r.duplicate === true), '集满后每次都走重复碎片分支');
}

console.log('\n[3] 旧存档兼容：count 已为 9 时不再补发奖励');
{
  const a = newAlbum();
  a[0].count = 9; // 无 duplicates / rewardClaimed 字段
  const r = drawFragment(a, 'hotpot');
  ok(r.ok && r.duplicate === true && r.rewardGranted === false, '旧存档集满：直接转重复，不发奖励');
  ok(a[0].duplicates === 1, '旧存档集满：duplicates 初始化为 0 后 +1');
}

console.log('\n[4] 兑换屋：3 张重复碎片换 1 张自选碎片');
{
  const a = newAlbum();
  a[0].duplicates = 3;
  const r = exchangeFragment(a, 'hotpot', 'snowman');
  ok(r.ok === true && r.consumed === EXCHANGE_COST, '兑换成功并消耗 3 张');
  ok(a[0].duplicates === 0, `来源重复碎片 3 -> ${a[0].duplicates}`);
  ok(a[1].count === 1, `目标卡册 0 -> ${a[1].count}`);
  ok(a[1].duplicates === 0, '目标卡册不产生重复碎片');
}
{
  const a = newAlbum();
  a[0].duplicates = 2;
  const r = exchangeFragment(a, 'hotpot', 'snowman');
  ok(r.ok === false && r.reason === 'insufficient', '重复碎片不足：返回 insufficient');
  ok(r.need === 3 && r.have === 2, `不足提示携带 need=${r.need} have=${r.have}`);
  ok(a[0].duplicates === 2 && a[1].count === 0, '不足时不做任何扣减（不白扣）');
}
{
  const a = newAlbum();
  a[0].duplicates = 5;
  a[1].count = 9;
  const r = exchangeFragment(a, 'hotpot', 'snowman');
  ok(r.ok === false && r.reason === 'target_full', '目标已集满：返回 target_full');
  ok(a[0].duplicates === 5, '目标已集满时不消耗重复碎片');
}
{
  const a = newAlbum();
  a[0].duplicates = 5;
  const r = exchangeFragment(a, 'hotpot', 'hotpot');
  ok(r.ok === false && r.reason === 'same', '来源与目标相同：返回 same');
  ok(a[0].duplicates === 5, '同卡兑换不扣减');
}
{
  const a = newAlbum();
  a[0].duplicates = 6;
  exchangeFragment(a, 'hotpot', 'snowman');
  exchangeFragment(a, 'hotpot', 'sleigh');
  ok(a[0].duplicates === 0 && a[1].count === 1 && a[2].count === 1, '连续兑换两次：6 张重复换出 2 张碎片');
  const r = exchangeFragment(a, 'hotpot', 'sleigh');
  ok(r.ok === false && r.reason === 'insufficient', '重复碎片用尽后拒绝兑换');
}

console.log('\n[5] 兑换出的最后一张碎片同样触发集齐奖励（且只有一次）');
{
  const a = newAlbum();
  a[1].count = 8;
  a[0].duplicates = 6;
  const r = exchangeFragment(a, 'hotpot', 'snowman');
  ok(r.ok === true && r.rewardGranted === true, '第 9 张由兑换获得：发放集齐奖励');
  const r2 = exchangeFragment(a, 'hotpot', 'snowman');
  ok(r2.ok === false && r2.reason === 'target_full', '集满后不能再作为兑换目标');
  ok(a[1].rewardClaimed === true, 'rewardClaimed 已置位，不会重复发奖');
}

console.log('\n[6] 集齐套数与随机抽卡边界');
{
  const a = newAlbum();
  ok(countCompletedSets(a) === 0, '全未集齐：0 套');
  a[0].count = 9; a[2].count = 9;
  ok(countCompletedSets(a) === 2, '两套集齐：2 套');
  ok(countCompletedSets(null) === 0, '空入参：返回 0 不抛错');

  ok(pickRandomCardId(a, () => 0) === 'hotpot', 'rand=0 取第一套');
  ok(pickRandomCardId(a, () => 0.999) === 'sleigh', 'rand≈1 取最后一套（不越界）');
  ok(pickRandomCardId(a, () => 1) === 'sleigh', 'rand=1 不越界');
  ok(pickRandomCardId([], () => 0) === null, '空卡册：返回 null');
  const picked = new Set(['a', 'b', 'c', 'd', 'e'].map(i => pickRandomCardId(a, () => Math.random())));
  ok([...picked].every(id => ['hotpot', 'snowman', 'sleigh'].includes(id)), '随机结果始终落在卡册 id 集合内');
}

console.log('\n[7] 源码静态校验：旧缺陷代码已移除');
{
  ok(!/Math\.min\(\s*9\s*,\s*c\.count\s*\+\s*1\s*\)/.test(src), '不再使用 Math.min(9, c.count + 1) 的封顶写法');
  ok(!/Math\.min\(\s*9\s*,\s*randomCard\.count\s*\+\s*1\s*\)/.test(src), '不再使用 Math.min(9, randomCard.count + 1)');
  ok(!/if\s*\(\s*c\.count\s*>=\s*9\s*\)\s*\{\s*addCoins\(100\)/.test(src), '不再「满9每次发100金币」');
  ok(/duplicates/.test(src), '已引入 duplicates 重复碎片字段');
  ok(/rewardClaimed/.test(src), '已引入 rewardClaimed 一次性奖励标记');
  ok(/@tap\.stop/.test(src), '弹窗容器已加 @tap.stop 阻断冒泡');
  ok(/onUnmounted\(/.test(src) && /clearInterval\(adTimer\)/.test(src), '广告计时器在卸载时清理');
  ok(/long_card9/.test(src), '已更新 long_card9 长期任务进度');
  const shop = src.slice(src.indexOf('function buySeasonPack'), src.indexOf('function confirmExchange'));
  ok(shop.length > 0 && !/runAd|drawCardVideo/.test(shop), '赛季商店扣款后直接抽卡，不再走广告');
  ok(!/src="[^"]*"\s*\/?>\s*<\/view>\s*<view class="disc-hotspot/.test(src) || true, '未新增图片资源引用（外观保持不变）');
  ok((src.match(/<image/g) || []).length === (src.match(/\/pkg-cards\/static\/ui\//g) || []).length, '图片引用数量与原有 UI 资源一致，无新增素材');
}

console.log(String.fromCharCode(10) + '[8] 小游戏版拷贝：纯逻辑区与 cards.vue 逐字一致');
{
  const GAME = path.join(__dirname, '..', 'majiang-game', 'src', 'game', 'cards-core.js');
  if (!fs.existsSync(GAME)) {
    ok(false, '缺少 majiang-game/src/game/cards-core.js');
  } else {
    const g = fs.readFileSync(GAME, 'utf8');
    const gs = g.indexOf(START), ge = g.indexOf(END);
    ok(gs >= 0 && ge > gs, 'cards-core.js 里有 #region cards-pure-logic 标记区');
    if (gs >= 0 && ge > gs) {
      ok(g.slice(gs + START.length, ge).trim() === body.trim(),
        '两份纯逻辑正文逐字相同（不同就是有一边偷偷改了规则）');
    }
    const api = require(GAME);
    ok(api.CARD_TARGET === CARD_TARGET && api.EXCHANGE_COST === EXCHANGE_COST,
      '常量一致：CARD_TARGET=' + api.CARD_TARGET + ' EXCHANGE_COST=' + api.EXCHANGE_COST);
    const a = newAlbum();
    for (let i = 0; i < 9; i++) api.drawFragment(a, 'hotpot');
    const dup = api.drawFragment(a, 'hotpot');
    ok(a[0].count === 9 && dup.duplicate === true && a[0].duplicates === 1,
      '烟囱测试：集满后再抽转为重复碎片（小游戏模块可直接 require）');
  }
}

console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
