'use strict';
/* 全局存档/体力/宝箱的回归测试。
 *
 * src/game/state.js 是 ESM 且 import 了 vue，Node 里没法直接 require，所以这里把源码
 * 读进来、剥掉 vue 的 import、把 export 收成返回值，再注入 reactive/watch/uni/setInterval
 * 的替身来求值。这样测的是磁盘上真实的 state.js，不需要构建产物，也不需要微信开发者工具。
 *
 * 运行： <node> mp-tools/state-regression.cjs
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const STORAGE_KEY = 'majiang_user_profile_v2';
const STATE_PATH = path.join(__dirname, '..', 'src', 'game', 'state.js');
const SOURCE = fs.readFileSync(STATE_PATH, 'utf8');

function compileStateModule() {
  const exported = [];
  let code = SOURCE.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  code = code.replace(/^export\s+(const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm,
    (m, kind, name) => { exported.push(name); return kind + ' ' + name; });
  if (/\bexport\b/.test(code)) throw new Error('state.js 里还有未处理的 export 语句');
  const body = code + '\nreturn { ' + exported.map(n => n + ': ' + n).join(', ') + ' };';
  // eslint-disable-next-line no-new-func
  const factory = new Function('reactive', 'watch', 'uni', 'setInterval', body);
  return { factory, exported };
}

const { factory } = compileStateModule();

/* 每个用例都重新求值一次 state.js，拿到彼此隔离的模块实例（等价于重新启动小程序）。 */
function loadState(stored) {
  const store = new Map();
  if (stored !== undefined) store.set(STORAGE_KEY, stored);
  const ticks = [];
  const uni = {
    getStorageSync: key => (store.has(key) ? store.get(key) : ''),
    setStorageSync: (key, value) => { store.set(key, value); },
  };
  const mod = factory(value => value, () => () => {}, uni, fn => { ticks.push(fn); return ticks.length; });
  // 手动推进全局心跳：每次 tick() 等价于过 1 秒
  mod.tick = (seconds = 1) => { for (let i = 0; i < seconds; i++) ticks.forEach(fn => fn()); };
  mod.stored = () => store.get(STORAGE_KEY);
  return mod;
}

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (e) {
    failures.push({ name, e });
    console.log('  FAIL  ' + name + '\n        ' + (e && e.message));
  }
}

function section(title) {
  console.log('\n' + title);
}

/* ------------------------------------------------------------------ */
section('一、旧存档迁移（深合并 / 数字异常 / 按 id 合并）');

test('空存档：全部字段回落到默认值', () => {
  const { gameState } = loadState();
  assert.strictEqual(gameState.coins, 0);
  assert.strictEqual(gameState.currentLevel, 2);
  assert.strictEqual(gameState.theme, 'meadow');
  assert.strictEqual(gameState.desktopRewardClaimed, false);
  assert.strictEqual(gameState.settings.music, true);
  assert.strictEqual(gameState.tools.time, 0);
  assert.strictEqual(gameState.dailyTasks.length, 7);
  assert.strictEqual(gameState.longTasks.length, 3);
  assert.strictEqual(gameState.cardsAlbum.length, 9);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
});

test('浅合并时代的旧存档：settings/tools 等缺字段被补齐', () => {
  const { gameState } = loadState({
    coins: 321,
    stars: 12,
    settings: { sound: false },
    tools: { clear: 4 },
  });
  // 有效原值保留
  assert.strictEqual(gameState.coins, 321);
  assert.strictEqual(gameState.stars, 12);
  assert.strictEqual(gameState.settings.sound, false);
  assert.strictEqual(gameState.tools.clear, 4);
  // 缺失字段补齐为默认值，且不再和默认对象共享引用
  assert.strictEqual(gameState.settings.music, true);
  assert.strictEqual(gameState.settings.vibrate, true);
  assert.strictEqual(gameState.settings.gmMode, false);
  assert.strictEqual(gameState.tools.shuffle, 0);
  assert.strictEqual(gameState.tools.undo, 0);
  assert.strictEqual(gameState.tools.magnet, 0);
  assert.strictEqual(gameState.tools.time, 0);
  assert.strictEqual(gameState.theme, 'meadow');
  assert.strictEqual(gameState.desktopRewardClaimed, false);
  assert.deepStrictEqual(gameState.levelChest, { current: 1, target: 5 });
});

test('数字异常（字符串/null/undefined/0）恢复默认', () => {
  const { gameState } = loadState({
    coins: 'oops',
    stars: null,
    currentLevel: undefined,
    maxStamina: 0,
    stamina: 'x',
    theme: '',
    desktopRewardClaimed: 'yes',
  });
  assert.strictEqual(gameState.coins, 0);
  assert.strictEqual(gameState.stars, 3);
  assert.strictEqual(gameState.currentLevel, 2);
  assert.strictEqual(gameState.maxStamina, 5);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.theme, 'meadow');
  assert.strictEqual(gameState.desktopRewardClaimed, false);
});

test('任务/卡册按 id 合并：已有进度保留，缺失条目补齐', () => {
  const { gameState } = loadState({
    dailyTasks: [
      { id: 'win5', current: 3, claimed: true },
      { id: 'login', current: 1, claimed: true },
      { id: 'legacy_task', current: 9 },
    ],
    longTasks: [{ id: 'long_card9', current: 5 }],
    cardsAlbum: [{ id: 'hotpot', count: 4 }],
  });
  assert.strictEqual(gameState.dailyTasks.length, 7);
  const win5 = gameState.dailyTasks.find(t => t.id === 'win5');
  assert.strictEqual(win5.current, 3);
  assert.strictEqual(win5.claimed, true);
  assert.strictEqual(win5.target, 5);
  assert.strictEqual(win5.rewardCount, 25);
  const win10 = gameState.dailyTasks.find(t => t.id === 'win10');
  assert.strictEqual(win10.current, 0);
  assert.strictEqual(win10.claimed, false);
  const login = gameState.dailyTasks.find(t => t.id === 'login');
  assert.strictEqual(login.claimed, true);
  // 存档里多出来的未知任务不会污染任务列表
  assert.strictEqual(gameState.dailyTasks.some(t => t.id === 'legacy_task'), false);

  assert.strictEqual(gameState.longTasks.length, 3);
  assert.strictEqual(gameState.longTasks.find(t => t.id === 'long_card9').current, 5);
  assert.strictEqual(gameState.longTasks.find(t => t.id === 'long_win100').current, 2);

  assert.strictEqual(gameState.cardsAlbum.length, 9);
  assert.strictEqual(gameState.cardsAlbum.find(c => c.id === 'hotpot').count, 4);
  assert.strictEqual(gameState.cardsAlbum.find(c => c.id === 'snowman').count, 0);
  assert.strictEqual(gameState.cardsAlbum.find(c => c.id === 'snowman').target, 9);
});

test('默认对象不被共享：改一份存档不会污染下一份', () => {
  const first = loadState().gameState;
  first.settings.music = false;
  first.tools.clear = 99;
  first.levelChest.current = 4;
  first.dailyTasks[0].claimed = true;
  first.cardsAlbum[0].count = 7;

  const second = loadState().gameState;
  assert.strictEqual(second.settings.music, true);
  assert.strictEqual(second.tools.clear, 1);
  assert.strictEqual(second.levelChest.current, 1);
  assert.strictEqual(second.dailyTasks[0].claimed, false);
  assert.strictEqual(second.cardsAlbum[0].count, 0);
});

test('体力计时：有效原值保留，缺失/异常时给一整段恢复时间', () => {
  const keep = loadState({ stamina: 3, staminaTimer: 300 }).gameState;
  assert.strictEqual(keep.stamina, 3);
  assert.strictEqual(keep.staminaTimer, 300);

  const missing = loadState({ stamina: 3, staminaTimer: 0 }).gameState;
  assert.strictEqual(missing.stamina, 3);
  assert.strictEqual(missing.staminaTimer, 15 * 60);

  const overflow = loadState({ stamina: 9, maxStamina: 5 }).gameState;
  assert.strictEqual(overflow.stamina, 5);
  assert.strictEqual(overflow.staminaTimer, 0);
});

test('宝箱进度读档时封顶，不会超过 target', () => {
  const { gameState } = loadState({
    levelChest: { current: 7, target: 5 },
    starChest: { current: 900, target: 500 },
  });
  assert.strictEqual(gameState.levelChest.current, 5);
  assert.strictEqual(gameState.starChest.current, 500);
});

test('被 JSON 存成字符串的存档也能读回来', () => {
  const { gameState } = loadState(JSON.stringify({ coins: 88, settings: { sound: false } }));
  assert.strictEqual(gameState.coins, 88);
  assert.strictEqual(gameState.settings.sound, false);
  assert.strictEqual(gameState.settings.music, true);
});

/* ------------------------------------------------------------------ */
section('二、体力（15 分钟恢复 / 不会秒回满）');

test('满体力时计时恒为 0，心跳不会凭空加体力', () => {
  const { gameState, startGlobalTimers, tick } = loadState();
  startGlobalTimers();
  tick(5);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
});

test('首页直接 stamina-- 后不会下一秒回满，且满 15 分钟才 +1', () => {
  const { gameState, startGlobalTimers, tick } = loadState();
  startGlobalTimers();
  tick(1);                       // 先让模块知道当前是满体力
  gameState.stamina--;           // 首页开始游戏就是这么扣的
  tick(1);                       // 关键回归点：旧实现在这里直接 +1 回满
  assert.strictEqual(gameState.stamina, 4);
  assert.strictEqual(gameState.staminaTimer, 15 * 60);
  tick(899);
  assert.strictEqual(gameState.stamina, 4);
  assert.strictEqual(gameState.staminaTimer, 1);
  tick(1);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
});

test('consumeStamina 从满体力扣：立即开始整段 15 分钟计时', () => {
  const { gameState, startGlobalTimers, consumeStamina, tick } = loadState();
  startGlobalTimers();
  assert.strictEqual(consumeStamina(1), true);
  assert.strictEqual(gameState.stamina, 4);
  assert.strictEqual(gameState.staminaTimer, 15 * 60);
  tick(899);
  assert.strictEqual(gameState.stamina, 4);
  assert.strictEqual(gameState.staminaTimer, 1);
  tick(1);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
});

test('计时被清成 0 时补一整段，不会凭空加体力', () => {
  const mod = loadState({ stamina: 3, staminaTimer: 60 });
  mod.startGlobalTimers();
  mod.gameState.staminaTimer = 0;
  mod.tick(1);
  assert.strictEqual(mod.gameState.stamina, 3);
  assert.strictEqual(mod.gameState.staminaTimer, 15 * 60);
});

test('consumeStamina 体力不足返回 false 且不扣', () => {
  const { gameState, consumeStamina } = loadState({ stamina: 0, staminaTimer: 60 });
  assert.strictEqual(consumeStamina(1), false);
  assert.strictEqual(gameState.stamina, 0);
});

test('连续消耗不重置已在走的计时', () => {
  const { gameState, startGlobalTimers, consumeStamina, tick } = loadState();
  startGlobalTimers();
  consumeStamina(1);
  tick(100);
  assert.strictEqual(gameState.staminaTimer, 15 * 60 - 100);
  assert.strictEqual(consumeStamina(1), true);
  assert.strictEqual(gameState.stamina, 3);
  assert.strictEqual(gameState.staminaTimer, 15 * 60 - 100);
});

test('多段恢复：每满 15 分钟 +1，回到满值后计时归零', () => {
  const { gameState, startGlobalTimers, tick } = loadState({ stamina: 2, staminaTimer: 15 * 60 });
  startGlobalTimers();
  tick(15 * 60);
  assert.strictEqual(gameState.stamina, 3);
  assert.strictEqual(gameState.staminaTimer, 15 * 60);
  tick(15 * 60);
  assert.strictEqual(gameState.stamina, 4);
  tick(15 * 60);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
});

test('refundStamina：退回体力，满值时计时归零', () => {
  const { gameState, refundStamina } = loadState({ stamina: 3, staminaTimer: 600 });
  assert.strictEqual(refundStamina(1), true);
  assert.strictEqual(gameState.stamina, 4);
  assert.strictEqual(gameState.staminaTimer, 600);
  assert.strictEqual(refundStamina(1), true);
  assert.strictEqual(gameState.stamina, 5);
  assert.strictEqual(gameState.staminaTimer, 0);
  assert.strictEqual(refundStamina(1), false);
  assert.strictEqual(gameState.stamina, 5);
});

test('gmMode 下 consumeStamina 不扣体力', () => {
  const { gameState, consumeStamina } = loadState({ stamina: 3, staminaTimer: 60, settings: { gmMode: true } });
  assert.strictEqual(consumeStamina(1), true);
  assert.strictEqual(gameState.stamina, 3);
});

/* ------------------------------------------------------------------ */
section('三、宝箱进度（达到 target 后封顶留待领取）');

test('关卡宝箱未满时正常 +1', () => {
  const { gameState, winLevelAction } = loadState();
  assert.strictEqual(gameState.levelChest.current, 1);
  winLevelAction(1, 0);
  assert.strictEqual(gameState.levelChest.current, 2);
});

test('关卡宝箱达到 target 后停在 target，不清零丢进度', () => {
  const { gameState, winLevelAction } = loadState({
    levelChest: { current: 4, target: 5 },
    currentLevel: 10,
  });
  winLevelAction(10, 0);
  assert.strictEqual(gameState.levelChest.current, 5);
  winLevelAction(11, 0);
  assert.strictEqual(gameState.levelChest.current, 5);   // 旧实现会在这里重置成 1
  winLevelAction(12, 0);
  assert.strictEqual(gameState.levelChest.current, 5);
});

test('星星宝箱同样封顶', () => {
  const { gameState, winLevelAction } = loadState({ starChest: { current: 499, target: 500 } });
  winLevelAction(1, 3);
  assert.strictEqual(gameState.starChest.current, 500);
  winLevelAction(2, 3);
  assert.strictEqual(gameState.starChest.current, 500);
});

test('通关默认奖励与旧版本一致（金币 +20 / 存钱罐 +25）', () => {
  const omitted = loadState();       // 不传 multiplier
  const explicit = loadState();      // 显式传 1
  const invalid = loadState();       // 非法值按 1 处理
  omitted.winLevelAction(1, 0);
  explicit.winLevelAction(1, 0, 1);
  invalid.winLevelAction(1, 0, 3);
  for (const mod of [omitted, explicit, invalid]) {
    assert.strictEqual(mod.gameState.coins, 20);
    assert.strictEqual(mod.gameState.piggyBank.coins, 25 + 25);
  }
});

test('每日挑战双倍奖励：金币 +40 / 存钱罐 +50', () => {
  const mod = loadState();
  mod.winLevelAction(1, 0, 2);
  assert.strictEqual(mod.gameState.coins, 40);
  assert.strictEqual(mod.gameState.piggyBank.coins, 25 + 50);
});

test('通关推进关卡与任务进度（未改动行为）', () => {
  const mod = loadState();
  mod.winLevelAction(5, 3);
  assert.strictEqual(mod.gameState.currentLevel, 6);
  assert.strictEqual(mod.gameState.dailyTasks.find(t => t.id === 'win5').current, 1);
  assert.strictEqual(mod.gameState.dailyTasks.find(t => t.id === 'match100').current, 3);
  assert.strictEqual(mod.gameState.longTasks.find(t => t.id === 'long_card9').current, 0);
});

/* ------------------------------------------------------------------ */
console.log('\n' + (failures.length ? '✗ ' : '✓ ') + passed + ' 个用例通过，'
  + failures.length + ' 个失败');
if (failures.length) {
  failures.forEach(f => console.log('\n--- ' + f.name + '\n' + (f.e && f.e.stack)));
  process.exit(1);
}
