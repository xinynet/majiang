/* 集卡页的纯逻辑：抽碎片、集齐发奖、重复碎片兑换。
 *
 * 这一段是从小程序 pkg-cards/pages/cards/cards.vue 的 #region cards-pure-logic
 * **逐字**搬过来的，不是重写。它本来就写成「只读写传进来的卡册数组、不碰框架」的样子，
 * 就是为了能被 mp-tools/cards-regression.cjs 提取出来单测——现在两边共用同一套断言：
 * 那个脚本会同时跑 .vue 里的那份和这个文件，任何一边改了口径都会被比出来。
 *
 * 所以改规则时请两边一起改（或者干脆把 .vue 那份也换成 require 这个文件——
 * 小程序侧可以，小游戏侧不能反过来引小程序目录，包不在一起）。
 */
const CARD_TARGET = 9;            // 每套卡册集齐所需碎片数
const EXCHANGE_COST = 3;          // 兑换屋：每 3 张重复碎片换 1 张自选碎片
const COMPLETE_REWARD_COINS = 100; // 集齐奖励（仅发放一次）
const SEASON_SHOP_COST = 200;     // 赛季商店卡包售价

// #region cards-pure-logic
// 纯逻辑区：只读写传入的卡册数组，不触碰 uni / gameState，可被 mp-tools/cards-regression.cjs 提取测试。
function ensureCardFields(c) {
  if (!c || typeof c !== 'object') return c;
  if (typeof c.duplicates !== 'number' || !isFinite(c.duplicates) || c.duplicates < 0) {
    c.duplicates = 0;
  }
  if (typeof c.rewardClaimed !== 'boolean') {
    // 兼容旧存档：已经集满的卡册视为已领过奖励，避免重复补发
    c.rewardClaimed = typeof c.count === 'number' && c.count >= CARD_TARGET;
  }
  return c;
}

function findCardById(album, cardId) {
  if (!Array.isArray(album)) return null;
  return album.find(c => c && c.id === cardId) || null;
}

function countCompletedSets(album) {
  if (!Array.isArray(album)) return 0;
  return album.filter(c => c && typeof c.count === 'number' && c.count >= CARD_TARGET).length;
}

// 抽到一张碎片：未集满则 count+1（跨过阈值时一次性发奖）；已集满则记入 duplicates，不再发金币
function drawFragment(album, cardId) {
  const c = findCardById(album, cardId);
  if (!c) return { ok: false, reason: 'missing' };
  ensureCardFields(c);
  if (c.count >= CARD_TARGET) {
    c.duplicates += 1;
    return { ok: true, duplicate: true, card: c, count: c.count, duplicates: c.duplicates, rewardGranted: false };
  }
  c.count += 1;
  let rewardGranted = false;
  if (c.count >= CARD_TARGET && !c.rewardClaimed) {
    c.rewardClaimed = true;
    rewardGranted = true;
  }
  return {
    ok: true,
    duplicate: false,
    card: c,
    count: c.count,
    duplicates: c.duplicates,
    completed: c.count >= CARD_TARGET,
    rewardGranted
  };
}

function pickRandomCardId(album, rand) {
  if (!Array.isArray(album) || album.length === 0) return null;
  const r = typeof rand === 'function' ? rand() : Math.random();
  const idx = Math.min(album.length - 1, Math.max(0, Math.floor(r * album.length)));
  const c = album[idx];
  return c ? c.id : null;
}

// 兑换：消耗 source 的 3 张重复碎片，给 target 增加 1 张碎片；任何失败都不扣减
function exchangeFragment(album, sourceCardId, targetCardId) {
  const src = findCardById(album, sourceCardId);
  const dst = findCardById(album, targetCardId);
  if (!src || !dst) return { ok: false, reason: 'missing' };
  ensureCardFields(src);
  ensureCardFields(dst);
  if (src.id === dst.id) return { ok: false, reason: 'same' };
  if (src.duplicates < EXCHANGE_COST) {
    return { ok: false, reason: 'insufficient', need: EXCHANGE_COST, have: src.duplicates };
  }
  if (dst.count >= CARD_TARGET) return { ok: false, reason: 'target_full' };
  src.duplicates -= EXCHANGE_COST;
  const drawn = drawFragment(album, dst.id);
  return { ok: true, consumed: EXCHANGE_COST, source: src.id, target: dst.id, ...drawn };
}

// #endregion cards-pure-logic

module.exports = {
  CARD_TARGET, EXCHANGE_COST, COMPLETE_REWARD_COINS, SEASON_SHOP_COST,
  ensureCardFields, findCardById, countCompletedSets, drawFragment, pickRandomCardId, exchangeFragment,
};
