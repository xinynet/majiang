// 全局游戏状态管理与持久化 (经济、体力、宝箱、任务、卡册、道具)
import { reactive, watch } from 'vue';

const STORAGE_KEY = 'majiang_user_profile_v2';
// 每点体力的恢复时长。计时口径只在这里定义，避免各处写 15*60 写出偏差。
const STAMINA_REGEN_SECONDS = 15 * 60;

const DEFAULT_STATE = {
  coins: 0,
  stamina: 5,
  maxStamina: 5,
  staminaTimer: 14 * 60 + 2, // 14:02
  stars: 3,
  currentLevel: 2,
  theme: 'meadow',
  desktopRewardClaimed: false,
  levelChest: { current: 1, target: 5 },
  starChest: { current: 3, target: 500 },
  piggyBank: { coins: 25, minClaim: 300, maxCapacity: 600 },
  tools: {
    clear: 1,
    shuffle: 0,
    undo: 0,
    magnet: 0,
    time: 0
  },
  luckyBag: {
    remainingSeconds: 14 * 60 + 42, // 00:14:42
    /* 图标统一指向主包 static/icons 下的商城图标。
     * 原先写的是 tool-*.png —— 那套素材在 pkg-game 分包里（主包数据不该引分包资源），
     * 而且其中 tool-time.png 压根不存在，"加时" 一格必然是空白。
     * static/icons 下五个道具图标齐全，也正是首页幸运礼包弹窗实际渲染用的那套。 */
    rewards: [
      { id: 'undo', name: '翻牌', count: 1, icon: 'shop_tool_undo.jpg' },
      { id: 'clear', name: '消除', count: 1, icon: 'shop_tool_clear.jpg' },
      { id: 'time', name: '加时', count: 1, icon: 'shop_tool_time.jpg' },
      { id: 'shuffle', name: '洗牌', count: 1, icon: 'shop_tool_shuffle.jpg' },
      { id: 'coins', name: '金币', count: 100, icon: 'coin_sack_exact.jpg' }
    ]
  },
  dailyTasks: [
    { id: 'login', title: '每天登陆', desc: '登陆奖励', current: 1, target: 1, rewardType: 'tool_clear', rewardCount: 1, rewardIcon: '💡', claimed: false },
    { id: 'win5', title: '累计通关', desc: '完成5麻将关卡', current: 0, target: 5, rewardType: 'coins', rewardCount: 25, claimed: false },
    { id: 'win10', title: '累计通关', desc: '完成10麻将关卡', current: 0, target: 10, rewardType: 'coins', rewardCount: 50, claimed: false },
    { id: 'win25', title: '累计通关', desc: '完成25麻将关卡', current: 0, target: 25, rewardType: 'coins', rewardCount: 100, claimed: false },
    { id: 'win50', title: '累计通关', desc: '完成50麻将关卡', current: 0, target: 50, rewardType: 'coins', rewardCount: 200, claimed: false },
    { id: 'match100', title: '物品匹配', desc: '匹配100组麻将', current: 0, target: 100, rewardType: 'coins', rewardCount: 50, claimed: false },
    { id: 'match500', title: '物品匹配', desc: '匹配500组麻将', current: 0, target: 500, rewardType: 'coins', rewardCount: 100, claimed: false }
  ],
  longTasks: [
    { id: 'long_win100', title: '麻将宗师', desc: '累计通关100关卡', current: 2, target: 100, rewardType: 'coins', rewardCount: 500, claimed: false },
    { id: 'long_star1000', title: '摘星达人', desc: '累计获得1000颗星星', current: 3, target: 1000, rewardType: 'coins', rewardCount: 800, claimed: false },
    { id: 'long_card9', title: '卡册大满贯', desc: '集齐9套冬日主题卡册', current: 0, target: 9, rewardType: 'coins', rewardCount: 1000, claimed: false }
  ],
  cardsAlbum: [
    { id: 'hotpot', name: '热辣火锅', image: 'card_hotpot.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'snowman', name: '欢快雪人', image: 'card_snowman.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'ice_sculpture', name: '冰雕艺术', image: 'card_ice_sculpture.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'winter_glove', name: '温暖冬日', image: 'card_winter_glove.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'candied_haws', name: '冰糖葫芦', image: 'card_candied_haws.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'sweet_potato', name: '暖心红薯', image: 'card_sweet_potato.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'tangerines', name: '甜甜蜜蜜', image: 'card_tangerines.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'sleigh', name: '华丽雪橇', image: 'card_sleigh.jpg', count: 0, target: 9, chestCount: 1 },
    { id: 'arctic_pet', name: '冰城萌宠', image: 'card_arctic_pet.jpg', count: 0, target: 9, chestCount: 1 }
  ],
  settings: {
    sound: true,
    music: true,
    vibrate: true,
    gmMode: false
  }
};

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/* 深拷贝默认值。
 * 之前是 `{ ...DEFAULT_STATE }`，嵌套对象（settings/tools/levelChest…）在存档缺字段
 * 时会和 DEFAULT_STATE 共用同一个引用，运行时改一处就等于改了“默认值”本身。 */
function cloneValue(v) {
  if (Array.isArray(v)) return v.map(cloneValue);
  if (isPlainObject(v)) {
    const out = {};
    for (const k in v) out[k] = cloneValue(v[k]);
    return out;
  }
  return v;
}

/* 以 DEFAULT_STATE 为骨架深合并旧存档：
 * - 结构合法且有效的原值优先保留（金币、进度、开关都不丢）；
 * - 数组按 id 合并，新增的任务/卡册条目自动补齐、已有进度按 id 落位；
 * - 数字/布尔/字符串类型不符（缺字段、写坏、NaN）时回退默认值；
 * - 默认结构里没有的额外字段原样保留，不抹掉存档里的其它数据。 */
function mergeStored(def, stored) {
  if (Array.isArray(def)) {
    if (!Array.isArray(stored)) return cloneValue(def);
    const byId = new Map();
    for (const item of stored) {
      if (isPlainObject(item) && item.id !== undefined) byId.set(item.id, item);
    }
    return def.map(d => {
      if (!isPlainObject(d) || d.id === undefined) return cloneValue(d);
      const s = byId.get(d.id);
      return s ? mergeStored(d, s) : cloneValue(d);
    });
  }
  if (isPlainObject(def)) {
    if (!isPlainObject(stored)) return cloneValue(def);
    const out = {};
    for (const k in def) out[k] = mergeStored(def[k], stored[k]);
    for (const k in stored) if (!(k in def)) out[k] = cloneValue(stored[k]);
    return out;
  }
  if (typeof def === 'number') {
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : def;
  }
  if (typeof def === 'boolean') {
    return typeof stored === 'boolean' ? stored : def;
  }
  if (typeof def === 'string') {
    return typeof stored === 'string' && stored !== '' ? stored : def;
  }
  return stored === undefined ? def : stored;
}

// 宝箱进度封顶：达到 target 后停在 target，等待领取，不再清零回退
function clampChest(chest) {
  if (!isPlainObject(chest)) return;
  if (!(chest.target > 0)) chest.target = 1;
  if (!(chest.current >= 0)) chest.current = 0;
  if (chest.current > chest.target) chest.current = chest.target;
}

/* 资源文件名归代码所有，不归存档所有。
 *
 * mergeStored 对字符串的规则是“存档里有非空值就保留”，这在图片字段上会出事：
 * 卡册美术曾从 .png 换成 .jpg，老存档里存的还是 card_hotpot.png 这类文件名，
 * 合并后就把代码里正确的 .jpg 覆盖掉，集卡页九张卡片全部裂图（诊断基线存档
 * qa-original-profile.json 就是这种老档）。这里读档后统一按默认值改回来。 */
function restoreAssetPaths(state) {
  const defaults = new Map(DEFAULT_STATE.cardsAlbum.map(c => [c.id, c.image]));
  if (Array.isArray(state.cardsAlbum)) {
    state.cardsAlbum.forEach(c => {
      if (c && defaults.has(c.id)) c.image = defaults.get(c.id);
    });
  }
  const icons = new Map(DEFAULT_STATE.luckyBag.rewards.map(r => [r.id, r.icon]));
  const rewards = state.luckyBag && state.luckyBag.rewards;
  if (Array.isArray(rewards)) {
    rewards.forEach(r => {
      if (r && icons.has(r.id)) r.icon = icons.get(r.id);
    });
  }
  return state;
}

/* 读档后把数值拉回合法范围，坏存档不能把体力/倒计时算崩。
 * 体力满时计时归零（没有可计的东西）；体力不满而计时缺失/非正数时，
 * 从整段 15 分钟重新开始，而不是让它下一秒直接回满。 */
function normalizeState(state) {
  if (!(state.maxStamina >= 1)) state.maxStamina = DEFAULT_STATE.maxStamina;
  if (!(state.stamina >= 0)) state.stamina = DEFAULT_STATE.stamina;
  if (state.stamina > state.maxStamina) state.stamina = state.maxStamina;
  if (state.stamina >= state.maxStamina) {
    state.staminaTimer = 0;
  } else if (!(state.staminaTimer > 0)) {
    state.staminaTimer = STAMINA_REGEN_SECONDS;
  }
  clampChest(state.levelChest);
  clampChest(state.starChest);
  restoreAssetPaths(state);
  return state;
}

function loadStored() {
  let raw = null;
  try {
    raw = uni.getStorageSync(STORAGE_KEY);
  } catch (e) { raw = null; }
  // 兼容历史上被 JSON.stringify 存成字符串的存档
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { raw = null; }
  }
  return normalizeState(mergeStored(DEFAULT_STATE, isPlainObject(raw) ? raw : null));
}

export const gameState = reactive(loadStored());

/* 体力是否处于“满值”状态。满值时 staminaTimer 恒为 0，单看计时无法区分
 * “刚满、还没开始计时”和“计时刚好走完”，所以用一个模块级标记记住状态，
 * 这样外部直接改 gameState.stamina（如首页开始游戏扣体力）也能被正确识别。 */
let staminaWasFull = gameState.stamina >= gameState.maxStamina;

// 自动持久化
watch(
  () => gameState,
  (val) => {
    try {
      uni.setStorageSync(STORAGE_KEY, JSON.parse(JSON.stringify(val)));
    } catch (e) {}
  },
  { deep: true }
);

// 全局心跳倒计时：体力与幸运礼包倒计时
let timerInterval = null;
export function startGlobalTimers() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    // 幸运礼包倒计时
    if (gameState.luckyBag.remainingSeconds > 0) {
      gameState.luckyBag.remainingSeconds--;
    }
    tickStamina();
  }, 1000);
}

/* 体力一秒一跳。
 *
 * 旧实现是“体力不满且 staminaTimer 为 0 → 立刻 +1”，而满体力时 timer 正好是 0，
 * 于是满体力被消耗后（首页直接 stamina--，计时仍是 0）下一秒就白送一点体力，
 * 消耗等于没消耗。现在把“满值”单独记在 staminaWasFull 上：一旦发现体力掉下满值，
 * 先补满一整段 15 分钟计时，再逐秒递减，走完才 +1。 */
function tickStamina() {
  const max = gameState.maxStamina;
  if (gameState.stamina >= max) {
    gameState.stamina = max;
    gameState.staminaTimer = 0;
    staminaWasFull = true;
    return;
  }
  if (staminaWasFull) {
    // 体力刚被消耗：从整段恢复时长重新计时，绝不立即回满
    staminaWasFull = false;
    gameState.staminaTimer = STAMINA_REGEN_SECONDS;
    return;
  }
  if (!(gameState.staminaTimer > 0)) {
    // 计时缺失/写坏：补一整段重新走，绝不凭空加体力
    gameState.staminaTimer = STAMINA_REGEN_SECONDS;
    return;
  }
  gameState.staminaTimer--;
  if (gameState.staminaTimer > 0) return;
  gameState.stamina++;
  gameState.staminaTimer = gameState.stamina < max ? STAMINA_REGEN_SECONDS : 0;
}

/* 扣除体力，并保证扣完立刻开始一段完整的 15 分钟恢复计时。
 * 返回 false 表示体力不足（gmMode 下不扣体力，视为成功）。 */
export function consumeStamina(count = 1) {
  if (gameState.settings && gameState.settings.gmMode) return true;
  const cost = Math.max(1, Math.floor(count) || 1);
  if ((gameState.stamina || 0) < cost) return false;
  const wasFull = gameState.stamina >= gameState.maxStamina;
  gameState.stamina -= cost;
  staminaWasFull = false;
  if (wasFull || !(gameState.staminaTimer > 0)) {
    gameState.staminaTimer = STAMINA_REGEN_SECONDS;
  }
  return true;
}

/* 退还体力（如对局页初始化失败、未真正开始对局时）。
 * 返回 false 表示本来就已经是满体力，没有可退的。 */
export function refundStamina(count = 1) {
  const back = Math.max(1, Math.floor(count) || 1);
  const before = gameState.stamina || 0;
  gameState.stamina = Math.min(gameState.maxStamina, before + back);
  if (gameState.stamina >= gameState.maxStamina) {
    gameState.staminaTimer = 0;
    staminaWasFull = true;
  }
  return gameState.stamina > before;
}

// 格式化秒数为 mm:ss
export function formatSeconds(sec) {
  if (!sec || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// 格式化秒数为 hh:mm:ss
export function formatLongSeconds(sec) {
  if (!sec || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function addCoins(n) {
  gameState.coins = Math.max(0, (gameState.coins || 0) + n);
}

export function spendCoins(n) {
  if ((gameState.coins || 0) >= n) {
    gameState.coins -= n;
    return true;
  }
  return false;
}

export function addTool(tool, count = 1) {
  if (!gameState.tools) gameState.tools = {};
  gameState.tools[tool] = (gameState.tools[tool] || 0) + count;
}

export function useTool(tool) {
  if (gameState.settings.gmMode) return true;
  if (!gameState.tools) gameState.tools = {};
  if ((gameState.tools[tool] || 0) > 0) {
    gameState.tools[tool]--;
    return true;
  }
  return false;
}

/* 通关结算。
 * multiplier 只支持 1（普通，默认）与 2（每日挑战双倍奖励），其余值一律按 1 处理，
 * 保证默认行为与旧版本完全一致。 */
export function winLevelAction(level, matchTriples = 0, multiplier = 1) {
  const mult = multiplier === 2 ? 2 : 1;
  // 增加通关金币
  addCoins(20 * mult);
  // 增加存钱罐金币 (每次通过关卡可存入25金币)
  gameState.piggyBank.coins = Math.min(gameState.piggyBank.maxCapacity, gameState.piggyBank.coins + 25 * mult);
  // 增加星星
  gameState.stars += Math.max(1, matchTriples);
  gameState.starChest.current = Math.min(gameState.starChest.target, gameState.starChest.current + Math.max(1, matchTriples));
  // 推进关卡宝箱：达到 target 后封顶停在 target，等待领取，不再清零丢掉进度
  if (gameState.levelChest.current < gameState.levelChest.target) {
    gameState.levelChest.current++;
  }
  // 关卡晋级
  if (gameState.currentLevel <= level) {
    gameState.currentLevel = level + 1;
  }
  // 更新任务进度
  gameState.dailyTasks.forEach(t => {
    if (t.id.startsWith('win')) t.current++;
    if (t.id.startsWith('match')) t.current += matchTriples;
  });
  gameState.longTasks.forEach(t => {
    if (t.id.includes('win')) t.current++;
    if (t.id.includes('star')) t.current += matchTriples;
  });
}
