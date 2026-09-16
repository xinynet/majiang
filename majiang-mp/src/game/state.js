// 全局游戏状态管理与持久化 (经济、体力、宝箱、任务、卡册、道具)
import { reactive, watch } from 'vue';

const STORAGE_KEY = 'majiang_user_profile_v2';

const DEFAULT_STATE = {
  coins: 0,
  stamina: 5,
  maxStamina: 5,
  staminaTimer: 14 * 60 + 2, // 14:02
  stars: 3,
  currentLevel: 2,
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
    rewards: [
      { id: 'undo', name: '翻牌', count: 1, icon: 'tool-undo.png' },
      { id: 'clear', name: '消除', count: 1, icon: 'tool-clear.png' },
      { id: 'time', name: '加时', count: 1, icon: 'tool-time.png' },
      { id: 'shuffle', name: '洗牌', count: 1, icon: 'tool-shuffle.png' },
      { id: 'coins', name: '金币', count: 100, icon: 'coin_sack.png' }
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
    { id: 'hotpot', name: '热辣火锅', image: 'card_hotpot.png', count: 0, target: 9, chestCount: 1 },
    { id: 'snowman', name: '欢快雪人', image: 'card_snowman.png', count: 0, target: 9, chestCount: 1 },
    { id: 'ice_sculpture', name: '冰雕艺术', image: 'card_ice_sculpture.png', count: 0, target: 9, chestCount: 1 },
    { id: 'winter_glove', name: '温暖冬日', image: 'card_winter_glove.png', count: 0, target: 9, chestCount: 1 },
    { id: 'candied_haws', name: '冰糖葫芦', image: 'card_candied_haws.png', count: 0, target: 9, chestCount: 1 },
    { id: 'sweet_potato', name: '暖心红薯', image: 'card_sweet_potato.png', count: 0, target: 9, chestCount: 1 },
    { id: 'tangerines', name: '甜甜蜜蜜', image: 'card_tangerines.png', count: 0, target: 9, chestCount: 1 },
    { id: 'sleigh', name: '华丽雪橇', image: 'card_sleigh.png', count: 0, target: 9, chestCount: 1 },
    { id: 'arctic_pet', name: '冰城萌宠', image: 'card_arctic_pet.png', count: 0, target: 9, chestCount: 1 }
  ],
  settings: {
    sound: true,
    music: true,
    vibrate: true,
    gmMode: false
  }
};

function loadStored() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'object') {
      return { ...DEFAULT_STATE, ...raw };
    }
  } catch (e) {}
  return { ...DEFAULT_STATE };
}

export const gameState = reactive(loadStored());

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
    // 体力倒计时
    if (gameState.stamina < gameState.maxStamina) {
      if (gameState.staminaTimer > 0) {
        gameState.staminaTimer--;
      } else {
        gameState.stamina++;
        gameState.staminaTimer = gameState.stamina < gameState.maxStamina ? 15 * 60 : 0;
      }
    } else {
      gameState.staminaTimer = 0;
    }
  }, 1000);
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

export function winLevelAction(level, matchTriples = 0) {
  // 增加通关金币
  addCoins(20);
  // 增加存钱罐金币 (每次通过关卡可存入25金币)
  gameState.piggyBank.coins = Math.min(gameState.piggyBank.maxCapacity, gameState.piggyBank.coins + 25);
  // 增加星星
  gameState.stars += Math.max(1, matchTriples);
  gameState.starChest.current = Math.min(gameState.starChest.target, gameState.starChest.current + Math.max(1, matchTriples));
  // 推进关卡宝箱
  gameState.levelChest.current++;
  if (gameState.levelChest.current > gameState.levelChest.target) {
    gameState.levelChest.current = 1;
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
