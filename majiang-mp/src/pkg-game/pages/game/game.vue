<template>
  <view class="game">
    <!-- 顶部野餐布与绿地背景条 -->
    <image class="g-meadow" src="/pkg-game/static/bg/meadow.png" mode="scaleToFill" />

    <!-- 顶部操作栏 (完全对齐 c5f9f24a490a2422db421d4e9a09ab00.jpg) -->
    <view class="game-top-bar" :style="{ paddingTop: topInset + 'px' }">
      <view class="top-bar-left">
        <!-- 暂停按钮 -->
        <view class="round-pause-btn" @tap="onPause">
          <text class="pause-symbol">⏸</text>
        </view>
        <!-- 星星统计 -->
        <view class="star-badge">
          <text class="star-ico">⭐</text>
          <text class="star-num">{{ view.score }}</text>
        </view>
      </view>

      <view class="top-bar-right" :style="{ marginTop: timerDrop + 'px' }">
        <!-- 倒计时胶囊 -->
        <view class="timer-pill" :class="{ urgent: view.remain < 60 }">
          <text class="timer-ico">🧭</text>
          <text class="timer-text">{{ clock }}</text>
        </view>
      </view>
    </view>

    <!-- 关卡牌堆状态栏 (关卡2 种类22 总数105   剩余数量 105) -->
    <view class="g-status-custom">
      <view class="status-left">
        <text class="stat-bold">关卡{{ view.level }}</text>
        <text class="stat-dim" v-if="isChallenge">每日挑战</text>
        <text class="stat-dim">种类{{ view.types }}</text>
        <text class="stat-dim">总数{{ view.initial }}</text>
      </view>
      <view class="status-right">
        <text class="stat-remain-lbl">剩余数量</text>
        <text class="stat-remain-val">{{ view.remaining }}</text>
      </view>
    </view>

    <!-- Canvas 3D牌阵主体区 -->
    <view class="board-wrap">
      <canvas id="board" type="2d" class="board" :hidden="modalOpen" @touchstart="onTouch"></canvas>
      <view v-if="view.dealing" class="coach"><text class="t-p">发牌中…</text></view>
    </view>

    <!-- 底部卡槽 (7格) -->
    <view class="g-tray-custom" :class="{ danger: view.slots.length >= 6 }">
      <view v-for="i in 7" :key="i" class="g-slot-custom" :class="{ filled: !!view.slots[i - 1] }">
        <image v-if="view.slots[i - 1]" class="g-slot-img" :src="faceSrc(view.slots[i - 1])" mode="aspectFit" />
      </view>
    </view>

    <!-- 连击倍数 -->
    <view class="g-combo-custom">
      <text class="combo-text">x{{ view.combo }}</text>
    </view>

    <!-- 底部4大道具按钮栏 (完全对齐 c5f9f24a490a2422db421d4e9a09ab00.jpg) -->
    <view class="g-dock-custom">
      <!-- 1. 消除 (Clear) -->
      <view class="tool-capsule" @tap="handleToolClick('clear')">
        <image class="tool-art-img" src="/pkg-game/static/tools/tool-clear.png" mode="aspectFit" />
        <text class="tool-name-lbl">消除</text>
        <view class="tool-add-plus" v-if="(view.tools.clear || 0) <= 0" @tap.stop="openRefill('clear')">+</view>
        <view class="tool-count-pill" v-else>
          <text class="tool-count-text">{{ view.tools.clear }}</text>
        </view>
      </view>

      <!-- 2. 洗牌 (Shuffle) -->
      <view class="tool-capsule" @tap="handleToolClick('shuffle')">
        <image class="tool-art-img" src="/pkg-game/static/tools/tool-shuffle.png" mode="aspectFit" />
        <text class="tool-name-lbl">洗牌</text>
        <view class="tool-add-plus" v-if="(view.tools.shuffle || 0) <= 0" @tap.stop="openRefill('shuffle')">+</view>
        <view class="tool-count-pill" v-else>
          <text class="tool-count-text">{{ view.tools.shuffle }}</text>
        </view>
      </view>

      <!-- 3. 翻牌/撤回 (Undo) -->
      <view class="tool-capsule" @tap="handleToolClick('undo')">
        <image class="tool-art-img" src="/pkg-game/static/tools/tool-undo.png" mode="aspectFit" />
        <text class="tool-name-lbl">翻牌</text>
        <view class="tool-add-plus" v-if="(view.tools.undo || 0) <= 0" @tap.stop="openRefill('undo')">+</view>
        <view class="tool-count-pill" v-else>
          <text class="tool-count-text">{{ view.tools.undo }}</text>
        </view>
      </view>

      <!-- 4. 磁铁 (Magnet) -->
      <view class="tool-capsule" @tap="handleToolClick('magnet')">
        <image class="tool-art-img" src="/pkg-game/static/tools/tool-magnet.png" mode="aspectFit" />
        <text class="tool-name-lbl">磁铁</text>
        <view class="tool-add-plus" v-if="(view.tools.magnet || 0) <= 0" @tap.stop="openRefill('magnet')">+</view>
        <view class="tool-count-pill" v-else>
          <text class="tool-count-text">{{ view.tools.magnet }}</text>
        </view>
      </view>
    </view>

    <!-- ==================== 弹窗系统 ==================== -->

    <!-- 1. 道具购买补给弹窗 (完全还原 c5f9f24a490a2422db421d4e9a09ab00.jpg) -->
    <view class="modal-overlay" v-if="refillModal.visible" @tap.self="refillModal.visible = false">
      <view class="tool-refill-dialog animate-pop">
        <view class="refill-header-bar">
          <text class="refill-title">{{ refillModal.title }}</text>
          <view class="refill-close-btn" @tap="refillModal.visible = false">✕</view>
        </view>

        <!-- 道具预览卡片 -->
        <view class="refill-art-card">
          <image class="refill-tool-img" :src="'/pkg-game/static/tools/' + refillModal.icon" mode="aspectFit" />
          <view class="refill-x1-badge">X1</view>
        </view>

        <!-- 说明文案 -->
        <view class="refill-desc-text">{{ refillModal.desc }}</view>

        <!-- 绿色金币购买按钮 -->
        <view class="refill-buy-green-btn" @tap="buyToolWithCoins">
          <text class="btn-buy-lbl">购买</text>
          <view class="coin-num-wrap">
            <image class="btn-coin-ico-img" src="/static/ui/icon_crown_coin.png" mode="aspectFit" />
            <text class="btn-coin-val">{{ refillModal.price }}</text>
          </view>
        </view>

        <!-- 黄色免费看视频按钮 -->
        <view class="refill-free-yellow-btn" @tap="buyToolWithVideo">
          <text class="btn-buy-lbl">购买</text>
          <view class="coin-num-wrap">
            <image class="btn-tv-ico-img" src="/static/icons/icon_video_camera.png" mode="aspectFit" />
            <text class="btn-free-val">免费</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 2. 暂停弹窗 -->
    <view class="modal-overlay" v-if="paused" @tap.self="resumeGame">
      <view class="pause-dialog animate-pop">
        <view class="dialog-title-big">游戏暂停</view>
        <view class="pause-btn-col">
          <button class="menu-action-btn primary-gradient" @tap="resumeGame">继续游戏</button>
          <button class="menu-action-btn warning-gradient" @tap="restartGame">重新开始</button>
          <button class="menu-action-btn neutral-gradient" @tap="exitToHome">返回首页</button>
        </view>
      </view>
    </view>

    <!-- 3. 通关胜利结算弹窗 -->
    <view class="modal-overlay" v-if="isWon">
      <view class="settle-dialog animate-pop">
        <view class="settle-header-win">🎉 恭喜通关！</view>
        <view class="settle-sub-desc" v-if="isChallenge">每日挑战 · 双倍奖励</view>
        <view class="settle-rewards-box">
          <view class="settle-item">
            <text class="settle-icon">🪙</text>
            <text class="settle-lbl">金币 +{{ rewardCoins }}</text>
          </view>
          <view class="settle-item">
            <text class="settle-icon">🐷</text>
            <text class="settle-lbl">存钱罐 +{{ rewardPiggy }}</text>
          </view>
          <view class="settle-item">
            <text class="settle-icon">⭐</text>
            <text class="settle-lbl">得分 +{{ view.score }}</text>
          </view>
        </view>
        <view class="settle-action-row">
          <button class="settle-btn-main" @tap="nextLevel">下一关</button>
          <button class="settle-btn-sub" @tap="exitToHome">返回主页</button>
        </view>
      </view>
    </view>

    <!-- 4. 失败结算/复活弹窗 -->
    <view class="modal-overlay" v-if="isLost">
      <view class="settle-dialog animate-pop">
        <view class="settle-header-lose">挑战遗憾失败</view>
        <view class="settle-sub-desc">卡槽已满或时间耗尽，是否复活继续？</view>
        <view class="revive-btn-wrap" @tap="handleRevive">
          <text class="tv-icon">📺</text>
          <text class="revive-text">免费复活 (移出3张牌+120秒)</text>
        </view>
        <view class="lose-sub-actions">
          <text class="lose-sub-link" @tap="restartGame">重新挑战</text>
          <text class="lose-sub-link" @tap="exitToHome">退出主页</text>
        </view>
      </view>
    </view>

    <!-- 5. 初始化失败提示 (画布/牌面资源加载失败时不再静默卡死) -->
    <view class="modal-overlay" v-if="initError">
      <view class="settle-dialog animate-pop">
        <view class="settle-header-lose">牌桌加载失败</view>
        <view class="settle-sub-desc">{{ initError }}</view>
        <view class="settle-action-row">
          <button class="settle-btn-main" @tap="retryInit">重试</button>
          <button class="settle-btn-sub" @tap="exitToHome">返回</button>
        </view>
      </view>
    </view>

    <!-- 模拟广告播放浮层 -->
    <view class="ad-overlay" v-if="adActive">
      <view class="ad-box">
        <view class="ad-countdown">广告播放中... {{ adCountdown }}s</view>
        <text class="ad-icon">🎬</text>
        <text class="ad-title">正在获取道具补给...</text>
        <view class="ad-progress">
          <view class="ad-progress-bar" :style="{ width: ((3 - adCountdown) / 3 * 100) + '%' }"></view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { reactive, ref, computed, watch, nextTick, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { TileMotion } from '../../../game/tile-motion.js';
import { createGame, boardMetrics, faceKey } from '../../../game/game-core.js';
import { createBoardRenderer } from '../../../game/canvas-board.js';
import { createEmitter, canvasHost, resolveCanvas } from '../../../game/platform.js';
import { drawShuffleHands } from '../../../game/shuffle-hands.js';
import {
  gameState, spendCoins, addTool, winLevelAction,
  consumeStamina, refundStamina
} from '../../../game/state.js';

const instance = getCurrentInstance();

const view = reactive({
  level: 2, score: 0, remain: 600, combo: 1, comboUntil: 0,
  initial: 0, types: 0, remaining: 0, slots: [], dealing: true,
  tools: { clear: 1, shuffle: 0, undo: 0, magnet: 0 },
});

const clock = computed(() => {
  const s = Math.max(0, view.remain);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
});

const faceSrc = tile => '/pkg-game/static/tiles-face/' + faceKey(tile.type) + '.png';

let game = null, renderer = null, host = null, metrics = null;
let boardSize = { width: 0, height: 0 };
// Where the board sits on screen, for turning a touch into a board coordinate.
let boardRect = { left: 0, top: 0 };
let running = false, clockTimer = null, startClockTimer = null, lastFrame = 0;
let handImage = null, dealStart = 0, dealLength = 1;
const paused = ref(false);
const isWon = ref(false);
const isLost = ref(false);
// 每日挑战（首页 mode=challenge 进入）：更短时限、更多花色，结算双倍
const isChallenge = ref(false);
// 初始化失败提示，非空即显示重试弹窗并禁用牌桌交互
const initError = ref('');

// 结算弹窗里的奖励文案必须和 winLevelAction 实际发放的一致
const rewardCoins = computed(() => (isChallenge.value ? 40 : 20));
const rewardPiggy = computed(() => (isChallenge.value ? 50 : 25));

const CHALLENGE = {
  roundSeconds: 480,   // 普通 600 秒
  types: 12,           // 普通按牌数自动取，挑战固定放宽到 12 种
};

// 道具补给弹窗
const refillModal = reactive({
  visible: false,
  tool: 'shuffle',
  title: '洗牌',
  icon: 'tool-shuffle.png',
  desc: '将场上的牌打乱',
  price: 300
});

// 广告模拟
const adActive = ref(false);
const adCountdown = ref(3);
let adCallback = null;
let adTimer = null;

/* WeChat's own capsule menu owns the top-right corner on every device, so the
 * clock is dropped below it rather than sitting underneath it. */
const topInset = ref(0);
const timerDrop = ref(0);

function layoutTopBar() {
  /* 只用 uni.getWindowInfo，不再回退 wx.getSystemInfoSync：后者自基础库 2.20.1 起
     已停止维护，开发者工具的「代码质量检测」会把它当废弃接口扣分。2.20.1 是 2021 年的
     基础库，现网覆盖率已接近满额，而本项目的首页底图本来就要求 2.9.0+ 才能解 WebP，
     门槛并没有因此抬高。 */
  const info = uni.getWindowInfo();
  const status = info.statusBarHeight || 20;
  topInset.value = status;
  try {
    const capsule = uni.getMenuButtonBoundingClientRect();
    if (capsule && capsule.bottom) timerDrop.value = Math.max(0, capsule.bottom - status);
  } catch (e) {
    timerDrop.value = 36;
  }
}

/* A mini-program canvas is a native component: it composites above every
 * <view> whatever the z-index says, so a dialog opened over the board ends up
 * buried under the tiles. Hiding the canvas while a dialog is up is what keeps
 * those buttons visible and tappable. */
const modalOpen = computed(() => paused.value || isWon.value || isLost.value
  || refillModal.visible || adActive.value || !!initError.value);

// Coming back from display:none, the canvas may hand back an empty bitmap.
// 关掉弹窗后同时确认对局时钟还在跑：隐藏页面或广告期间它被停掉了，得在这里接回来。
watch(modalOpen, open => { if (!open) nextTick(() => { paint(); ensureClock(); }); });

function syncView() {
  const s = game.state;
  view.level = s.level; view.score = s.score; view.remain = s.remain;
  view.combo = s.combo; view.comboUntil = s.comboUntil;
  view.initial = s.initial; view.types = s.initialTypeCount;
  view.remaining = s.tiles.filter(t => !t.removed && !t.inTray).length;
  view.slots = s.slots.map(t => ({ type: t.type }));
  view.dealing = s.dealing;
  view.tools = { ...s.tools };
}

function ordered() {
  const s = game.state;
  const maxLayer = Math.max(0, ...s.tiles.map(t => t.layoutZ ?? t.z));
  return s.tiles.filter(t => !t.removed && !t.inTray)
    .sort((a, b) => TileMotion.depth(a.z, a.stand || 0, maxLayer) - TileMotion.depth(b.z, b.stand || 0, maxLayer));
}

function paint() {
  if (!renderer || !game || !metrics) return;
  renderer.draw(ordered(), metrics, { ...boardSize, makeCanvas: host.makeCanvas });
  // Painted after the pile so the hands pass over the tiles, not under them.
  if (game.state.dealing) {
    drawShuffleHands(host.ctx, handImage, boardSize.width, boardSize.height,
      (Date.now() - dealStart) / dealLength);
  }
}

function pump() {
  if (running) return;
  running = true;
  lastFrame = Date.now();
  const tick = () => {
    const now = Date.now(), dt = Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const active = game.stepMotion(dt);
    paint();
    // Keep the frames coming until the hands have withdrawn, even once the
    // last tile has come to rest.
    if (active || game.state.dealing) host.frame(tick); else running = false;
  };
  host.frame(tick);
}

function onEvent(name) {
  if (name === 'board' || name === 'built' || name === 'dealt') {
    syncView();
    paint();
    pump();
  }
  if (name === 'won') {
    stopClock();
    isWon.value = true;
    winLevelAction(view.level, view.score, isChallenge.value ? 2 : 1);
  }
  if (name === 'lost') {
    stopClock();
    isLost.value = true;
  }
}

function startClock() {
  stopClock();
  clockTimer = setInterval(() => {
    // 暂停、购买补给、看广告期间对局倒计时一并冻结，不再只认 paused
    if (modalOpen.value) return;
    if (!game.tick()) stopClock();
    view.remain = game.state.remain;
    view.combo = game.state.combo;
  }, 1000);
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

/* 只在确实需要时补一个时钟：已在跑、弹窗挡着、牌局已结束都不动。
 * 发牌期间不直接起表，而是按发牌剩余时间排一个待启计时（句柄留着以便清理）。
 * 页面隐藏会把这两者都停掉，回到前台时靠它按剩余时间接回来。 */
function ensureClock() {
  if (!game || clockTimer || modalOpen.value || game.state.over) return;
  if (game.state.dealing) {
    if (startClockTimer) return;
    const left = Math.max(100, dealLength - (Date.now() - dealStart) + 100);
    startClockTimer = setTimeout(() => { startClockTimer = null; startClock(); }, left);
    return;
  }
  startClock();
}

/* Open and close are separate rather than one toggle: a tap on the dialog also
 * bubbles to the overlay, and two toggles would leave it right back open. */
function onPause() {
  if (!game || initError.value) return;
  paused.value = true;
}

function resumeGame() {
  paused.value = false;
}

function restartGame() {
  paused.value = false;
  isWon.value = false;
  isLost.value = false;
  start(view.level);
}

function nextLevel() {
  isWon.value = false;
  start(view.level + 1);
}

function exitToHome() {
  stopClock();
  clearTimeout(startClockTimer);
  startClockTimer = null;
  abortAd();
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: '/pages/index/index' });
    }
  });
}

/* Turning a touch into a board coordinate.
 *
 * The old `canvas-id` canvas put canvas-relative `x`/`y` on every touch, but a
 * <canvas type="2d"> does not: it hands back the standard viewport fields, so
 * `clientY` is measured from the top of the screen and includes the status bar,
 * the top bar and the level strip above the board. Feeding that straight to the
 * hit test aimed every tap roughly 150px below where the player pressed, which
 * is why tiles so often did not respond - and why the ones that did were the
 * wrong ones. `boardRect` is the board's own position, measured with the canvas
 * itself, and is what puts the tap back where it belongs. */
function onTouch(e) {
  const p = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!p || !game || !renderer || !metrics || initError.value) return;
  if (game.state.dealing || paused.value || isWon.value || isLost.value) return;
  let x = p.x, y = p.y;
  if (x === undefined) {
    x = (p.clientX ?? p.pageX ?? 0) - boardRect.left;
    y = (p.clientY ?? p.pageY ?? 0) - boardRect.top;
  }
  const hit = renderer.pick(ordered(), metrics, x, y);
  if (hit) game.pick(hit.id);
}

/* 对局里的道具数只是全局存档的一份副本（game-core 自己维护 state.tools），
 * 所以每次消耗都要写回 gameState.tools，否则关掉页面道具就“复活”了。 */
function pushToolsToGlobal() {
  if (!game) return;
  if (!gameState.tools) gameState.tools = {};
  const tools = game.state.tools || {};
  Object.keys(tools).forEach(k => { gameState.tools[k] = tools[k]; });
}

// 发放道具：全局存档与当前牌局同时加，两边保持一致
function grantTool(name, count = 1) {
  addTool(name, count);
  if (game && game.state.tools) {
    game.state.tools[name] = (game.state.tools[name] || 0) + count;
  }
}

function handleToolClick(name) {
  if (!game || initError.value || modalOpen.value) return;
  const count = view.tools[name] || 0;
  if (count <= 0 && !gameState.settings.gmMode) {
    openRefill(name);
    return;
  }
  if (game.useTool(name)) pushToolsToGlobal();
  syncView();
}

function openRefill(name) {
  if (!game || initError.value) return;
  refillModal.tool = name;
  if (name === 'clear') {
    refillModal.title = '消除';
    refillModal.icon = 'tool-clear.png';
    refillModal.desc = '移出卡槽中的前三张牌';
    refillModal.price = 100;
  } else if (name === 'shuffle') {
    refillModal.title = '洗牌';
    refillModal.icon = 'tool-shuffle.png';
    refillModal.desc = '将场上的牌打乱';
    refillModal.price = 300;
  } else if (name === 'undo') {
    refillModal.title = '翻牌';
    refillModal.icon = 'tool-undo.png';
    refillModal.desc = '撤回上一次点击的牌';
    refillModal.price = 100;
  } else if (name === 'magnet') {
    refillModal.title = '磁铁';
    refillModal.icon = 'tool-magnet.png';
    refillModal.desc = '自动吸附消除一组相同牌';
    refillModal.price = 300;
  }
  refillModal.visible = true;
}

function buyToolWithCoins() {
  if (!game) return;
  if (spendCoins(refillModal.price)) {
    grantTool(refillModal.tool, 1);
    refillModal.visible = false;
    syncView();
    uni.showToast({ title: '购买成功！' + refillModal.title + ' +1', icon: 'success' });
  } else {
    uni.showToast({ title: '金币不足，可通过看广告免费获取！', icon: 'none' });
  }
}

function buyToolWithVideo() {
  if (!game) return;
  triggerAd(() => {
    grantTool(refillModal.tool, 1);
    refillModal.visible = false;
    syncView();
    uni.showToast({ title: '获得 ' + refillModal.title + ' +1！', icon: 'success' });
  });
}

function handleRevive() {
  triggerAd(() => {
    game.revive();
    isLost.value = false;
    startClock();
    syncView();
    paint();
    uni.showToast({ title: '复活成功！继续对局！', icon: 'success' });
  });
}

/* 广告倒计时的 interval 必须留下引用：页面卸载或被切到后台时它还在跑，
 * 会拿着已经失效的回调去动牌局。 */
function abortAd() {
  if (adTimer) { clearInterval(adTimer); adTimer = null; }
  adCallback = null;
  adActive.value = false;
  adCountdown.value = 0;
}

function triggerAd(cb) {
  if (adTimer) clearInterval(adTimer);
  adActive.value = true;
  adCountdown.value = 3;
  adCallback = cb;
  adTimer = setInterval(() => {
    adCountdown.value--;
    if (adCountdown.value <= 0) {
      clearInterval(adTimer);
      adTimer = null;
      adActive.value = false;
      const done = adCallback;
      adCallback = null;
      if (done) done();
    }
  }, 1000);
}

/* 每日挑战用更短的时限和更多花色，普通关沿用 game-core 的默认难度。
 * gmMode 必须带进来：game-core 的 useTool 靠它决定是否消耗道具。 */
function buildConfig(level) {
  const config = { gmMode: !!gameState.settings.gmMode };
  if (isChallenge.value) {
    config.roundSeconds = CHALLENGE.roundSeconds;
    const levels = [];
    levels[level - 1] = { time: CHALLENGE.roundSeconds, types: CHALLENGE.types };
    config.levels = levels;
  }
  return config;
}

function start(level) {
  // build() reports how long its deal takes; the clock starts when it lands,
  // and the hands sweep across exactly that window.
  clearTimeout(startClockTimer);
  startClockTimer = null;
  dealStart = Date.now();
  const dealMs = game.build(level, boardSize.width / boardSize.height, buildConfig(level));
  // build 会把 tools 重置成默认值，这里改回玩家存档里的真实持有量
  game.state.tools = { ...gameState.tools };
  dealLength = dealMs;
  metrics = boardMetrics(game.state.tiles, level, boardSize.width, boardSize.height);
  syncView();
  paint();
  ensureClock();
}

// 初始化失败时把首页已经扣掉的体力退回去，避免“没玩成还倒扣体力”
let staminaRefunded = false;
let rechargeOnSuccess = false;

/* 初始化失败不再静默 return：停掉所有计时器、弹出可重试的提示，
 * 并把体力退回（重试成功时再重新扣一次，保证一次对局只扣一点体力）。 */
function failInit(message) {
  stopClock();
  clearTimeout(startClockTimer);
  startClockTimer = null;
  abortAd();
  if (game) { game.destroy(); game = null; }
  renderer = null;
  metrics = null;
  initError.value = message;
  // gmMode 下首页本就没扣体力，不能退
  if (!gameState.settings.gmMode && !staminaRefunded && refundStamina(1)) {
    staminaRefunded = true;
    rechargeOnSuccess = true;
  }
}

async function initGame() {
  initError.value = '';
  try {
    // The top bar pads itself by the status-bar height, which shrinks the board
    // below it. Let that land before measuring, or the pile is laid out for a
    // board taller than the one it is drawn into.
    await nextTick();
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    const options = (cur && cur.options) || {};
    const wanted = parseInt(options.level, 10);
    const startLevel = Number.isFinite(wanted) && wanted > 0 ? wanted : (gameState.currentLevel || 2);
    isChallenge.value = options.mode === 'challenge';

    const found = await resolveCanvas('#board', instance);
    if (!found || !found.canvas) { failInit('牌桌画布初始化失败，请重试'); return; }
    const { canvas, width, height } = found;
    const dpr = uni.getWindowInfo().pixelRatio;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    host = canvasHost(canvas);
    const unit = host.measureUnitScale();
    if (Math.abs(dpr / unit - 1) > 0.01) host.ctx.scale(dpr / unit, dpr / unit);
    boardSize = { width, height };
    boardRect = { left: found.left || 0, top: found.top || 0 };

    game = createGame({ motion: TileMotion, emit: createEmitter({ onEvent }) });

    /* Started before the atlas is awaited, not after, so the two load together.
     * Queued behind the atlas it was still arriving when the deal began, and the
     * hands missed the first stroke of the very first round after a cold start.
     * It is deliberately not awaited: a missing hand must not cost us the deal. */
    host.loadImage('/pkg-game/static/hands/right-hand-long.png')
      .then(img => { handImage = img; })
      .catch(() => {});
    // 牌面图集是牌桌的必需品：加载不到就明确报错，而不是留一块空牌桌
    const atlas = await host.loadImage('/pkg-game/static/tile-poses/shells.png');
    if (!atlas) { failInit('牌面资源加载失败，请重试'); return; }
    const faces = new Map(), pending = new Set();
    const faceFor = type => {
      const key = faceKey(type);
      if (faces.has(key)) return faces.get(key);
      if (!pending.has(key)) {
        pending.add(key);
        host.loadImage('/pkg-game/static/tiles-face/' + key + '.png')
          .then(img => { faces.set(key, img); renderer && renderer.invalidate(); paint(); })
          .catch(() => {});
      }
      return null;
    };
    renderer = createBoardRenderer(host.ctx, atlas, faceFor);
    // 初始化时把全局道具同步进牌局（build 之后 start() 会再同步一次）
    game.state.tools = { ...gameState.tools };
    start(startLevel);
    if (rechargeOnSuccess) {
      rechargeOnSuccess = false;
      consumeStamina(1);
    }
  } catch (e) {
    failInit('牌桌加载失败，请重试');
  }
}

function retryInit() {
  initGame();
}

onMounted(() => {
  layoutTopBar();
  initGame();
});

// 页面被切到后台/卸载后，发牌回调、对局时钟和广告 interval 都必须停掉，
// 否则它们会对着已经失效的牌局继续跑。
onHide(() => {
  stopClock();
  clearTimeout(startClockTimer);
  startClockTimer = null;
  abortAd();
});

onShow(() => {
  ensureClock();
});

onUnmounted(() => {
  stopClock();
  clearTimeout(startClockTimer);
  startClockTimer = null;
  abortAd();
  if (game) game.destroy();
});
</script>

<style>
@import '../../../styles/game-screen.css';

/* 页面根容器 */
.game {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #3b7d71;
}

/* 顶部背景 */
.g-meadow {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  width: 100%;
  height: 200rpx;
}

/* 顶部状态栏 (⏸ ⭐0   🧭09:50) */
.game-top-bar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 30rpx 10rpx;
}

.top-bar-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
}

.round-pause-btn {
  width: 76rpx;
  height: 76rpx;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 38rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pause-symbol {
  color: #ffffff;
  font-size: 32rpx;
}

.star-badge {
  background: rgba(0, 0, 0, 0.45);
  border-radius: 30rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.4);
  padding: 6rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.star-ico { font-size: 32rpx; }
.star-num { color: #ffffff; font-size: 30rpx; font-weight: 900; }

.top-bar-right {
  display: flex;
  align-items: center;
}

.timer-pill {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 30rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.4);
  padding: 8rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.timer-pill.urgent {
  background: rgba(220, 38, 38, 0.7);
  border-color: #ef4444;
}

.timer-ico { font-size: 30rpx; }
.timer-text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
  font-family: monospace;
}

/* 关卡牌堆状态栏 */
.g-status-custom {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 36rpx 6rpx;
  color: #ffffff;
}

.status-left {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.stat-bold { font-size: 32rpx; font-weight: 900; }
.stat-dim { font-size: 24rpx; color: #e2e8f0; }

.status-right {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.stat-remain-lbl { font-size: 24rpx; color: #cbd5e1; }
.stat-remain-val { font-size: 32rpx; font-weight: 900; color: #fef08a; }

/* 3D Canvas Board */
.board-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0 10px;
  overflow: hidden;
  border-radius: 28px;
  z-index: 5;
}

.board {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

/* 7格卡槽 */
.g-tray-custom {
  position: relative;
  z-index: 15;
  width: 680rpx;
  height: 130rpx;
  background: #19463e;
  border-radius: 20rpx;
  border: 6rpx solid #236559;
  box-shadow: inset 0 6rpx 12rpx rgba(0,0,0,0.5), 0 8rpx 16rpx rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: 10rpx auto 6rpx;
  padding: 0 8rpx;
}

.g-slot-custom {
  width: 84rpx;
  height: 112rpx;
  background: #0f302a;
  border-radius: 10rpx;
  border: 2rpx dashed rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.g-slot-img {
  width: 78rpx;
  height: 106rpx;
  background: #fff;
  border-radius: 8rpx;
  box-shadow: 0 4rpx 0 #94a3b8;
}

/* 连击 */
.g-combo-custom {
  position: relative;
  z-index: 15;
  align-self: center;
  background: #113831;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  padding: 2rpx 36rpx;
  border-radius: 18rpx;
  margin-bottom: 12rpx;
  border: 2rpx solid #2a6f62;
}

/* 底部4大道具按钮栏 (完全对齐 c5f9f24a490a2422db421d4e9a09ab00.jpg) */
.g-dock-custom {
  position: relative;
  z-index: 15;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20rpx 40rpx;
}

.tool-capsule {
  position: relative;
  width: 156rpx;
  height: 108rpx;
  background: rgba(16, 68, 60, 0.85);
  border-radius: 20rpx;
  border: 3rpx solid rgba(52, 211, 153, 0.4);
  box-shadow: inset 0 2rpx 4rpx rgba(255,255,255,0.2), 0 6rpx 12rpx rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.tool-art-img {
  width: 58rpx;
  height: 58rpx;
}

.tool-name-lbl {
  font-size: 28rpx;
  font-weight: 900;
  color: #5eead4;
}

.tool-add-plus {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 22rpx;
  background: #22c55e;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #ffffff;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.4);
}

.tool-count-pill {
  position: absolute;
  bottom: -16rpx;
  left: 50%;
  transform: translateX(-50%);
  background: #092621;
  padding: 2rpx 24rpx;
  border-radius: 20rpx;
  border: 2rpx solid #14b8a6;
}

.tool-count-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #fbbf24;
}

/* ================== 弹窗层 ================== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.animate-pop {
  animation: popUp 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes popUp {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* 道具购买补给弹窗 (c5f9f24a490a2422db421d4e9a09ab00.jpg) */
.tool-refill-dialog {
  position: relative;
  width: 580rpx;
  background: #fdfbf3;
  border-radius: 32rpx;
  border: 8rpx solid #facc15;
  padding: 30rpx 30rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.refill-header-bar {
  width: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}

.refill-title {
  background: #fef08a;
  color: #78350f;
  font-size: 40rpx;
  font-weight: 900;
  padding: 8rpx 70rpx;
  border-radius: 24rpx;
}

.refill-close-btn {
  position: absolute;
  right: 0; top: 0;
  width: 54rpx; height: 54rpx;
  border-radius: 27rpx;
  background: #78350f;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
}

.refill-art-card {
  position: relative;
  width: 220rpx; height: 220rpx;
  background: #fae8c8;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #eab308;
  margin-bottom: 24rpx;
}

.refill-tool-img {
  width: 140rpx; height: 140rpx;
}

.refill-x1-badge {
  position: absolute;
  top: 10rpx; right: 10rpx;
  background: #f59e0b;
  color: #fff;
  font-size: 22rpx;
  font-weight: 900;
  width: 44rpx; height: 44rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #fff;
}

.refill-desc-text {
  font-size: 34rpx;
  font-weight: 900;
  color: #451a03;
  margin-bottom: 36rpx;
}

.refill-buy-green-btn {
  width: 460rpx; height: 94rpx;
  background: linear-gradient(to bottom, #22c55e, #16a34a);
  border-radius: 47rpx;
  border: 5rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #15803d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.refill-free-yellow-btn {
  width: 460rpx; height: 94rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 47rpx;
  border: 5rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
}

.btn-buy-lbl { font-size: 38rpx; font-weight: 900; color: #ffffff; }
.coin-num-wrap { display: flex; align-items: center; gap: 8rpx; }
.btn-coin-ico { font-size: 36rpx; }
.btn-coin-ico-img { width: 44rpx; height: 44rpx; }
.btn-coin-val { font-size: 40rpx; font-weight: 900; color: #ffffff; }
.btn-tv-ico { font-size: 36rpx; }
.btn-tv-ico-img { width: 44rpx; height: 44rpx; }
.btn-free-val { font-size: 38rpx; font-weight: 900; color: #ffffff; }

/* 暂停与结算弹窗 */
.pause-dialog, .settle-dialog {
  width: 600rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dialog-title-big { font-size: 44rpx; font-weight: 900; color: #1e293b; margin-bottom: 30rpx; }
.pause-btn-col { width: 100%; display: flex; flex-direction: column; gap: 20rpx; }
.menu-action-btn { width: 100%; height: 84rpx; border-radius: 42rpx; color: #fff; font-size: 32rpx; font-weight: 900; border: none; }
.primary-gradient { background: #10b981; }
.warning-gradient { background: #f59e0b; }
.neutral-gradient { background: #64748b; }

.settle-header-win { font-size: 48rpx; font-weight: 900; color: #10b981; margin-bottom: 30rpx; }
.settle-header-lose { font-size: 48rpx; font-weight: 900; color: #ef4444; margin-bottom: 16rpx; }
.settle-sub-desc { font-size: 26rpx; color: #64748b; margin-bottom: 30rpx; }
.settle-rewards-box { width: 100%; display: flex; justify-content: space-around; margin-bottom: 40rpx; }
.settle-item { display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.settle-icon { font-size: 54rpx; }
.settle-lbl { font-size: 28rpx; font-weight: 800; color: #1e293b; }

.settle-action-row { width: 100%; display: flex; gap: 20rpx; }
.settle-btn-main { flex: 1; height: 84rpx; background: #10b981; color: #fff; font-size: 32rpx; font-weight: 900; border-radius: 42rpx; border: none; }
.settle-btn-sub { flex: 1; height: 84rpx; background: #64748b; color: #fff; font-size: 32rpx; font-weight: 900; border-radius: 42rpx; border: none; }

.revive-btn-wrap {
  width: 90%; height: 94rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 47rpx;
  border: 5rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: 30rpx;
}
.revive-text { font-size: 30rpx; font-weight: 900; color: #78350f; }

.lose-sub-actions { display: flex; gap: 40rpx; }
.lose-sub-link { font-size: 28rpx; color: #64748b; text-decoration: underline; }

/* 广告模拟播放层 */
.ad-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.ad-box { width: 80%; text-align: center; }
.ad-countdown {
  position: absolute;
  top: 80rpx; right: 40rpx;
  background: rgba(255,255,255,0.2);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
}
.ad-icon { font-size: 90rpx; margin-bottom: 20rpx; }
.ad-title { font-size: 34rpx; font-weight: 900; margin-bottom: 30rpx; }
.ad-progress { width: 100%; height: 10rpx; background: #334155; border-radius: 5rpx; overflow: hidden; }
.ad-progress-bar { height: 100%; background: #22c55e; }
</style>
