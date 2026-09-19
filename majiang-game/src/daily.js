/* 每日一关。
 *
 * 弹窗上印着四个会变的东西：挑战人数、通关人数、剩余次数、今日主题。
 * 前两个是给玩家看的「有多少人在玩」，运营自己定，所以放后台（`/api/daily`）下发；
 * 剩余次数是本地状态，按**本地日期**跨 00:00 重置；主题也来自后台。
 *
 * 奖励口径（星星 3 倍、金币 200）必须和弹窗美术上印的一致——它是烤在图里的，
 * 后台改了数值而美术没换，玩家看到的和拿到的就对不上。所以 daily-check.cjs 里
 * 有一条断言盯着这件事。
 *
 * 为什么重置按本地日期而不是服务器时间：这游戏没有账号体系，存档就在本机；
 * 拿服务器时间反而会出现「玩家改了手机时区、次数忽然回不来」的怪事。
 * 代价是改系统时间可以多刷几次——单机休闲游戏，认了。
 */
const { storage, getJSON } = require('./backend.js');
const { gameState } = require('./store.js');

const CACHE_KEY = 'majiang_daily_config_v1';

/* 后台连不上时的兜底。数值要和 server/ 的 DEFAULT_CONFIG.dailyLevel 保持一致。 */
const FALLBACK = {
  theme: '发财啦',
  challengers: 94540,
  clearers: 428,
  attemptsPerDay: 1,
  starMultiplier: 3,
  coinReward: 200,
};

let config = FALLBACK;

/* ------------------------------------------------------------------ 纯逻辑 */
/* 这一段不碰 wx / 网络，mp-tools/daily-check.cjs 直接 require 进去断言。 */

/** 本地日期的 YYYY-MM-DD。用本地时区，和玩家看到的「今天」一致。 */
function todayKey(now) {
  const d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/**
 * 按日期补足次数。返回是否发生了重置。
 * 三种情况都要处理：跨天了、存档里根本没有这个字段（老存档）、字段被写坏了。
 */
function ensureAttempts(daily, key, perDay) {
  if (!daily || typeof daily !== 'object') return false;
  const max = Number.isFinite(perDay) && perDay > 0 ? Math.floor(perDay) : 1;
  if (daily.date !== key) {
    daily.date = key;
    daily.left = max;
    return true;
  }
  if (!Number.isFinite(daily.left) || daily.left < 0) daily.left = max;
  if (daily.left > max) daily.left = max;      // 后台把次数调小了，当天就生效
  return false;
}

/** 扣一次。够扣返回 true，不够返回 false（调用方据此提示）。 */
function consumeAttempt(daily) {
  if (!daily || !Number.isFinite(daily.left) || daily.left <= 0) return false;
  daily.left -= 1;
  return true;
}

/* ------------------------------------------------------------------ 对外接口 */

/** 拉后台的展示数值。永远不 reject。 */
function init() {
  const cached = storage(CACHE_KEY);
  if (cached && typeof cached === 'object') config = { ...FALLBACK, ...cached };

  return new Promise((resolve) => {
    getJSON('/api/daily', {
      tag: 'daily',
      onData: (data) => {
        config = { ...FALLBACK, ...data };
        storage(CACHE_KEY, config);
        console.log('[daily] 配置已更新 主题=' + config.theme + ' 每日次数=' + config.attemptsPerDay);
      },
      done: () => { refresh(); resolve(config); },
    });
  });
}

/** 每次打开弹窗、以及配置更新后都调一次：跨天就把次数补回来。 */
function refresh(now) {
  if (!gameState.dailyLevel || typeof gameState.dailyLevel !== 'object') {
    gameState.dailyLevel = { date: '', left: config.attemptsPerDay };
  }
  return ensureAttempts(gameState.dailyLevel, todayKey(now), config.attemptsPerDay);
}

function attemptsLeft() {
  refresh();
  return gameState.dailyLevel.left;
}

/** 玩家点「前往挑战」：扣次数。扣不动返回 false。 */
function spend() {
  refresh();
  return consumeAttempt(gameState.dailyLevel);
}

module.exports = {
  FALLBACK,
  todayKey,
  ensureAttempts,
  consumeAttempt,
  init,
  refresh,
  attemptsLeft,
  spend,
  current: () => config,
};
