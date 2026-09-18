<template>
  <view class="home-container">
    <!-- 高清主页全景底图 (1260x2800)。切成 5 条是为了让每个资源文件都低于 200K
         （微信代码质量扫描的「图片和音频资源不应超过200K」），整图单文件到不了这个
         体积又不能降质——底图里烤着所有按钮文字。切片是无损的：总字节数不变，
         flex 均分保证条与条之间不会因为百分比取整露出缝。 -->
    <view class="home-bg">
      <image class="home-bg-slice" src="/static/ui/bg_home_1.jpg" mode="scaleToFill" />
      <image class="home-bg-slice" src="/static/ui/bg_home_2.jpg" mode="scaleToFill" />
      <image class="home-bg-slice" src="/static/ui/bg_home_3.jpg" mode="scaleToFill" />
      <image class="home-bg-slice" src="/static/ui/bg_home_4.jpg" mode="scaleToFill" />
      <image class="home-bg-slice" src="/static/ui/bg_home_5.jpg" mode="scaleToFill" />
    </view>

    <!-- 动态数据覆盖层 (仅在数值改变时无缝覆盖，pointer-events: none，0重影) -->
    <!-- 1. 金币数值动态层 (仅在金币数发生变动大于0时覆盖) -->
    <view class="dyn-overlay dyn-coins-val" v-if="gameState.coins > 0">
      <text class="dyn-val-text">{{ displayCoins }}</text>
    </view>

    <!-- 2. 体力数值与倒计时动态层 (仅在体力不满5点时覆盖) -->
    <view class="dyn-overlay dyn-stamina-val" v-if="gameState.stamina < 5">
      <text class="dyn-val-text">{{ gameState.stamina }}</text>
      <text class="dyn-stamina-sub">{{ displayStaminaTimer }}</text>
    </view>

    <!-- 3. 幸运礼包动态倒计时胶囊 (与原图底色底框100%贴合) -->
    <view class="dyn-overlay dyn-lucky-timer" v-if="gameState.luckyBag.remainingSeconds > 0">
      <text class="dyn-timer-text">{{ displayLuckyTimer }}</text>
    </view>

    <!-- 4. 关卡动态胶囊 (仅在关卡不是默认第2关时覆盖) -->
    <view class="dyn-overlay dyn-level-pill" v-if="gameState.currentLevel !== 2">
      <text class="dyn-level-text">关卡{{ displayLevel }}</text>
    </view>

    <!-- ==================== 像素级精准透明热区按钮 ==================== -->
    <!-- 顶栏 -->
    <view class="hotspot hotspot-gear" @tap="openSettings"></view>
    <view class="hotspot hotspot-coins" @tap="openShopCoins"></view>
    <view class="hotspot hotspot-stamina" @tap="showStaminaTip"></view>

    <!-- 宝箱 -->
    <view class="hotspot hotspot-level-chest" @tap="openLevelChest"></view>
    <view class="hotspot hotspot-star-chest" @tap="openStarChest"></view>

    <!-- 冬日集卡活动 Banner -->
    <view class="hotspot hotspot-winter-banner" @tap="gotoCardsPage"></view>

    <!-- 左侧浮标 -->
    <view class="hotspot hotspot-lucky-gift" @tap="openLuckyBag"></view>
    <view class="hotspot hotspot-daily-task" @tap="openDailyTasks"></view>
    <view class="hotspot hotspot-daily-chal" @tap="openDailyChallenge"></view>

    <!-- 右侧浮标 -->
    <view class="hotspot hotspot-piggy-bank" @tap="openPiggyBank"></view>
    <view class="hotspot hotspot-desktop" @tap="openAddToDesktop"></view>

    <!-- 左下功能 -->
    <view class="hotspot hotspot-theme" @tap="openThemeModal"></view>
    <view class="hotspot hotspot-cards" @tap="gotoCardsPage"></view>

    <!-- 底部中心与商店 -->
    <view class="hotspot hotspot-start-game" @tap="handleStartGame"></view>
    <view class="hotspot hotspot-shop" @tap="openShopAll"></view>

    <!-- ==================== 弹窗系统 ==================== -->

    <!-- 1. 幸运礼包弹窗 (0e5b39aca423980735833fe5710881f2.jpg) -->
    <view class="modal-overlay" v-if="modals.luckyBag" @tap.self="closeLuckyModal">
      <view class="lucky-bag-dialog animate-pop">
        <view class="lucky-header-box">
          <image class="lucky-header-art" src="/static/ui/lucky_chest_header.jpg" mode="aspectFit" />
          <view class="modal-close-circle" @tap="closeLuckyModal">✕</view>
        </view>
        
        <view class="lucky-card-body">
          <view class="lucky-items-row">
            <view class="lucky-item-col">
              <view class="lucky-item-square">
                <image class="lucky-item-img" src="/static/icons/shop_tool_undo.jpg" mode="aspectFit" />
                <view class="lucky-qty-badge">x1</view>
              </view>
              <text class="lucky-name-label">翻牌</text>
            </view>
            <text class="lucky-plus-sign">+</text>

            <view class="lucky-item-col">
              <view class="lucky-item-square">
                <image class="lucky-item-img" src="/static/icons/shop_tool_clear.jpg" mode="aspectFit" />
                <view class="lucky-qty-badge">x1</view>
              </view>
              <text class="lucky-name-label">消除</text>
            </view>
            <text class="lucky-plus-sign">+</text>

            <view class="lucky-item-col">
              <view class="lucky-item-square">
                <image class="lucky-item-img" src="/static/icons/shop_tool_time.jpg" mode="aspectFit" />
                <view class="lucky-qty-badge">x1</view>
              </view>
              <text class="lucky-name-label">加时</text>
            </view>
            <text class="lucky-plus-sign">+</text>

            <view class="lucky-item-col">
              <view class="lucky-item-square">
                <image class="lucky-item-img" src="/static/icons/shop_tool_shuffle.jpg" mode="aspectFit" />
                <view class="lucky-qty-badge">x1</view>
              </view>
              <text class="lucky-name-label">洗牌</text>
            </view>
            <text class="lucky-plus-sign">+</text>

            <view class="lucky-item-col">
              <view class="lucky-item-square">
                <image class="lucky-item-img" src="/static/ui/coin_sack_exact.jpg" mode="aspectFit" />
                <view class="lucky-qty-badge">x100</view>
              </view>
              <text class="lucky-name-label">金币</text>
            </view>
          </view>

          <view class="lucky-time-pill">{{ displayLuckyTimer }}</view>
        </view>

        <view class="unlock-action-btn" @tap="unlockLuckyBag">
          <image class="btn-cam-ico" src="/static/icons/icon_video_camera.png" mode="aspectFit" />
          <text class="unlock-text">立即解锁</text>
          <view class="free-ribbon">限免</view>
        </view>
      </view>
    </view>

    <!-- 2. 金库银行 / 存钱罐 (5f42c2f1cd2a6ff541de042d6025cb7c.jpg) -->
    <view class="modal-overlay" v-if="modals.piggyBank" @tap.self="closePiggyModal">
      <view class="piggy-dialog animate-pop">
        <view class="piggy-title-ribbon">
          <text class="piggy-title-text">金库银行</text>
          <view class="modal-close-btn-ribbon" @tap="closePiggyModal">✕</view>
        </view>

        <view class="piggy-content-row">
          <view class="piggy-meter-col">
            <view class="meter-tag tag-600">600</view>
            <view class="meter-track">
              <view class="meter-fill" :style="{ height: piggyFillHeight }"></view>
            </view>
            <view class="meter-tag tag-300">300</view>
          </view>

          <view class="piggy-art-wrap">
            <view class="piggy-bubble">
              <image class="bubble-coin-ico" src="/static/ui/icon_crown_coin.png" mode="aspectFit" />
              <text class="bubble-coin-val">{{ gameState.piggyBank.coins }}</text>
            </view>
            <image class="piggy-hero-img" src="/static/ui/piggy_hero_exact.jpg" mode="aspectFit" />
          </view>
        </view>

        <view class="piggy-desc-text">
          <text class="desc-line">满300金币可以领取</text>
          <text class="desc-line">最多可存储600金币</text>
        </view>

        <view class="piggy-claim-btn" @tap="claimPiggyReward">
          <image class="btn-cam-ico" src="/static/icons/icon_video_camera.png" mode="aspectFit" />
          <text class="claim-btn-lbl">领取奖励</text>
        </view>

        <view class="piggy-sub-notice">(每次通过关卡可存入25金币)</view>
      </view>
    </view>

    <!-- 3. 每日任务与长线任务 (8c5804076525e732d05f68a710e9e14d.jpg) -->
    <view class="modal-overlay" v-if="modals.dailyTasks" @tap.self="closeTasksModal">
      <view class="tasks-dialog animate-pop">
        <view class="tasks-nav-tabs">
          <view class="modal-close-task" @tap="closeTasksModal">✕</view>
          <view class="task-tab-pill" :class="{ active: activeTaskTab === 'daily' }" @tap="setDailyTab">每日任务</view>
          <view class="task-tab-pill" :class="{ active: activeTaskTab === 'long' }" @tap="setLongTab">长线任务</view>
        </view>

        <scroll-view class="tasks-scroll-list" scroll-y>
          <view class="task-card-row" v-for="(t, i) in currentTaskList" :key="i">
            <view class="task-art-box">
              <image v-if="t.rewardType === 'coins'" class="task-sack-img" src="/static/ui/coin_sack_exact.jpg" mode="aspectFit" />
              <image v-else class="task-bulb-img" src="/static/icons/shop_tool_clear.jpg" mode="aspectFit" />
            </view>

            <view class="task-info-col">
              <text class="task-main-title">{{ t.title }}</text>
              <text class="task-sub-title">{{ t.desc }}</text>
              <view class="task-progress-bar">
                <view class="task-progress-fill" :style="{ width: Math.min(100, (t.current / t.target * 100)) + '%' }"></view>
                <text class="task-progress-txt">{{ t.current }}/{{ t.target }}</text>
              </view>
            </view>

            <view class="task-action-col">
              <view class="task-reward-preview">
                <image v-if="t.rewardType === 'coins'" class="reward-coin-ico" src="/static/ui/icon_crown_coin.png" mode="aspectFit" />
                <image v-else class="reward-tool-ico" src="/static/icons/shop_tool_clear.jpg" mode="aspectFit" />
                <text class="reward-type-val">x{{ t.rewardCount }}</text>
              </view>
              <button 
                class="task-btn" 
                :class="{ 'btn-can-claim': t.current >= t.target && !t.claimed, 'btn-claimed': t.claimed, 'btn-unfinish': t.current < t.target }"
                @tap="handleTaskClick(t)"
              >
                {{ t.claimed ? '已领取' : (t.current >= t.target ? '领取' : '未完成') }}
                <view class="red-dot-micro" v-if="t.current >= t.target && !t.claimed"></view>
              </button>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 4. 商城弹窗 (完全对齐 eb8d66ed2e601b6783973ef0f410d30d.jpg) -->
    <view class="modal-overlay" v-if="modals.shop" @tap.self="closeShopModal">
      <view class="shop-dialog animate-pop">
        <view class="shop-top-header">
          <view class="modal-close-task" @tap="closeShopModal">✕</view>
        </view>

        <scroll-view class="shop-scroll-view" scroll-y>
          <!-- 金币礼包 -->
          <view class="shop-card cyan-card">
            <view class="shop-card-header">金币</view>
            <view class="shop-card-body">
              <image class="shop-bag-img" src="/static/icons/shop_coins_bag.jpg" mode="aspectFit" />
              <text class="shop-qty-lbl">x100</text>
              <view class="shop-free-btn" @tap="buyCoinsWithAd">
                <image class="btn-cam-ico" src="/static/icons/icon_video_camera.png" mode="aspectFit" />
                <text class="btn-free-txt">免费</text>
              </view>
            </view>
          </view>

          <!-- 道具礼包列表 -->
          <view class="shop-card orange-card" v-for="(item, idx) in shopItems" :key="idx">
            <view class="shop-card-header">{{ item.name }}</view>
            <view class="shop-card-body">
              <view class="shop-tool-preview">
                <image class="shop-tool-img" :src="'/static/icons/' + item.icon" mode="aspectFit" />
              </view>
              <text class="shop-qty-lbl">x{{ item.count }}</text>
              <view class="shop-btn-group">
                <view class="shop-coin-btn" @tap="buyItemCoins(item)">
                  <image class="btn-coin-ico" src="/static/ui/icon_crown_coin.png" mode="aspectFit" />
                  <text class="btn-coin-val">{{ item.price }}</text>
                </view>
                <view class="shop-free-btn" @tap="buyItemAd(item)">
                  <image class="btn-cam-ico" src="/static/icons/icon_video_camera.png" mode="aspectFit" />
                  <text class="btn-free-txt">免费</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 5. 设置弹窗 -->
    <view class="modal-overlay" v-if="modals.settings" @tap.self="closeSettingsModal">
      <view class="settings-dialog animate-pop">
        <view class="dialog-header">
          <text class="dialog-title">游戏设置</text>
          <view class="close-btn" @tap="closeSettingsModal">✕</view>
        </view>
        <view class="settings-content">
          <view class="setting-row">
            <text class="setting-label">音效</text>
            <switch :checked="gameState.settings.sound" color="#10b981" @change="toggleSetting('sound')" />
          </view>
          <view class="setting-row">
            <text class="setting-label">背景音乐</text>
            <switch :checked="gameState.settings.music" color="#10b981" @change="toggleSetting('music')" />
          </view>
          <view class="setting-row">
            <text class="setting-label">触感震动</text>
            <switch :checked="gameState.settings.vibrate" color="#10b981" @change="toggleSetting('vibrate')" />
          </view>
          <view class="setting-row">
            <text class="setting-label">GM 开发者模式</text>
            <switch :checked="gameState.settings.gmMode" color="#10b981" @change="toggleSetting('gmMode')" />
          </view>
        </view>
        <button class="dialog-confirm-btn" @tap="closeSettingsModal">确定</button>
      </view>
    </view>

    <!-- 7. 添加桌面有礼弹窗 (完全还原 点添加桌面后的弹窗.jpg) -->
    <view class="modal-overlay" v-if="modals.desktop" @tap.self="closeDesktopModal">
      <view class="desktop-dialog animate-pop">
        <!-- 弹窗主卡片 (彩虹小人+文字+奖励区+右上角关闭X) -->
        <view class="desktop-card-wrap">
          <image class="desktop-card-img" src="/static/ui/desktop_modal_card.png" mode="widthFix" />
          <!-- 右上角关闭按钮热区 -->
          <view class="desktop-close-hotspot" @tap="closeDesktopModal"></view>
        </view>
        <!-- 下方添加桌面按钮 -->
        <view class="desktop-btn-wrap" @tap="handleAddToDesktop">
          <image class="desktop-btn-img" src="/static/ui/desktop_modal_btn.png" mode="widthFix" />
        </view>
      </view>
    </view>

    <!-- 模拟激励视频广告播放浮层 -->
    <view class="ad-overlay" v-if="adState.active">
      <view class="ad-box">
        <view class="ad-countdown">广告播放中... {{ adState.countdown }}s</view>
        <view class="ad-screen">
          <text class="ad-icon">🎬</text>
          <text class="ad-title">【趣味麻将碰】赞助商精彩广告</text>
          <text class="ad-sub">观看完整视频即可获得丰厚道具与金币奖励！</text>
        </view>
        <view class="ad-progress">
          <view class="ad-progress-bar" :style="{ width: ((3 - adState.countdown) / 3 * 100) + '%' }"></view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { 
  gameState, 
  startGlobalTimers, 
  formatSeconds, 
  formatLongSeconds, 
  addCoins, 
  spendCoins, 
  addTool 
} from '../../game/state.js';

// 计算属性，确保在模板中正确渲染字符串而不会触发编译器标识符混淆
const displayCoins = computed(() => String(gameState.coins));
const displayLevel = computed(() => String(gameState.currentLevel));
const displayLuckyTimer = computed(() => formatLongSeconds(gameState.luckyBag.remainingSeconds));
const displayStaminaTimer = computed(() => formatSeconds(gameState.staminaTimer));
const piggyFillHeight = computed(() => Math.min(100, Math.floor(gameState.piggyBank.coins / 600 * 100)) + '%');

// 弹窗状态管理
const modals = reactive({
  luckyBag: false,
  piggyBank: false,
  dailyTasks: false,
  shop: false,
  settings: false,
  chestReward: false,
  desktop: false
});

const activeTaskTab = ref('daily');
function setDailyTab() { activeTaskTab.value = 'daily'; }
function setLongTab() { activeTaskTab.value = 'long'; }

const lastReward = reactive({ coins: 0, tools: 0 });

const currentTaskList = computed(() => {
  return activeTaskTab.value === 'daily' ? gameState.dailyTasks : gameState.longTasks;
});

// 商城商品列表
const shopItems = [
  { id: 'undo', name: '翻牌', icon: 'shop_tool_undo.jpg', count: 1, price: 100 },
  { id: 'clear', name: '消除', icon: 'shop_tool_clear.jpg', count: 2, price: 100 },
  { id: 'magnet', name: '磁铁', icon: 'shop_tool_magnet.jpg', count: 1, price: 300 },
  { id: 'shuffle', name: '洗牌', icon: 'shop_tool_shuffle.jpg', count: 1, price: 300 },
  { id: 'time', name: '加时', icon: 'shop_tool_time.jpg', count: 2, price: 100 }
];

// 广告模拟状态
const adState = reactive({
  active: false,
  countdown: 3,
  callback: null
});

function triggerAd(cb) {
  adState.active = true;
  adState.countdown = 3;
  adState.callback = cb;
  const timer = setInterval(() => {
    adState.countdown--;
    if (adState.countdown <= 0) {
      clearInterval(timer);
      adState.active = false;
      if (adState.callback) adState.callback();
    }
  }, 1000);
}

// 弹窗开关明确函数
function openLuckyBag() { modals.luckyBag = true; }
function closeLuckyModal() { modals.luckyBag = false; }

function openPiggyBank() { modals.piggyBank = true; }
function closePiggyModal() { modals.piggyBank = false; }

function openDailyTasks() { modals.dailyTasks = true; }
function closeTasksModal() { modals.dailyTasks = false; }

function openShopCoins() { modals.shop = true; }
function openShopAll() { modals.shop = true; }
function closeShopModal() { modals.shop = false; }

function openSettings() { modals.settings = true; }
function closeSettingsModal() { modals.settings = false; }

function closeChestModal() { modals.chestReward = false; }

function openDesktopModal() { modals.desktop = true; }
function closeDesktopModal() { modals.desktop = false; }

function handleAddToDesktop() {
  uni.showModal({
    title: '添加至桌面',
    content: '请点击右上角【···】菜单，选择【添加到桌面】即可收藏游戏！\n首次通过桌面图标进入即可领取专属奖励。',
    showCancel: false,
    confirmText: '去添加',
    success: () => {
      // 模拟发放奖励
      addCoins(200);
      uni.showToast({ title: '金币 +200 已入账！', icon: 'success' });
      closeDesktopModal();
    }
  });
}

function showStaminaTip() {
  if (gameState.stamina >= 5) {
    uni.showToast({
      title: '您的体力已满',
      icon: 'none'
    });
    return;
  }
  uni.showModal({
    title: '体力说明',
    content: '当前体力: ' + gameState.stamina + '/5\n每15分钟自动恢复1点体力。是否看广告补满体力？',
    confirmText: '看广告补满',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        triggerAd(() => {
          gameState.stamina = 5;
          uni.showToast({ title: '体力已补满！', icon: 'success' });
        });
      }
    }
  });
}

function openAddToDesktop() {
  openDesktopModal();
}

function openDailyChallenge() {
  uni.showModal({
    title: '每日挑战',
    content: '今日专家挑战关卡已更新！胜利即可赢取双倍奖励，是否开始挑战？',
    confirmText: '开始挑战',
    cancelText: '稍后再来',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: '/pkg-game/pages/game/game?level=' + gameState.currentLevel + '&mode=challenge' });
      }
    }
  });
}

function openThemeModal() {
  uni.showToast({ title: '主题装扮已解锁默认“田园暖阳”皮肤！', icon: 'none' });
}

function gotoCardsPage() {
  uni.navigateTo({ url: '/pkg-cards/pages/cards/cards' });
}

function openLevelChest() {
  lastReward.coins = 50;
  lastReward.tools = 1;
  addCoins(50);
  addTool('clear', 1);
  modals.chestReward = true;
}

function openStarChest() {
  lastReward.coins = 150;
  lastReward.tools = 2;
  addCoins(150);
  addTool('shuffle', 1);
  addTool('undo', 1);
  modals.chestReward = true;
}

function unlockLuckyBag() {
  triggerAd(() => {
    addCoins(100);
    addTool('undo', 1);
    addTool('clear', 1);
    addTool('shuffle', 1);
    addTool('time', 1);
    gameState.luckyBag.remainingSeconds = 15 * 60;
    closeLuckyModal();
    uni.showToast({ title: '恭喜获得幸运大礼包！', icon: 'success' });
  });
}

function claimPiggyReward() {
  if (gameState.piggyBank.coins < 300 && !gameState.settings.gmMode) {
    uni.showToast({ title: '还需累积至300金币才可取出哦！', icon: 'none' });
    return;
  }
  triggerAd(() => {
    const got = gameState.piggyBank.coins;
    addCoins(got);
    gameState.piggyBank.coins = 0;
    closePiggyModal();
    uni.showToast({ title: '已成功取出 ' + got + ' 金币！', icon: 'success' });
  });
}

function handleTaskClick(t) {
  if (t.claimed || t.current < t.target) return;
  t.claimed = true;
  if (t.rewardType === 'coins') {
    addCoins(t.rewardCount);
  } else {
    addTool('clear', t.rewardCount);
  }
  uni.showToast({ title: '奖励领取成功！', icon: 'success' });
}

function buyItemCoins(item) {
  if (spendCoins(item.price)) {
    addTool(item.id, item.count);
    uni.showToast({ title: '购买成功！' + item.name + ' +' + item.count, icon: 'success' });
  } else {
    uni.showToast({ title: '金币不足，可通过看广告免费获取！', icon: 'none' });
  }
}

function buyItemAd(item) {
  triggerAd(() => {
    addTool(item.id, item.count);
    uni.showToast({ title: '获得道具 +' + item.count, icon: 'success' });
  });
}

function buyCoinsWithAd() {
  triggerAd(() => {
    addCoins(100);
    uni.showToast({ title: '金币 +100', icon: 'success' });
  });
}

function toggleSetting(key) {
  gameState.settings[key] = !gameState.settings[key];
}

function handleStartGame() {
  if (gameState.stamina <= 0 && !gameState.settings.gmMode) {
    showStaminaTip();
    return;
  }
  if (!gameState.settings.gmMode) {
    gameState.stamina--;
  }
  uni.navigateTo({
    url: '/pkg-game/pages/game/game?level=' + gameState.currentLevel
  });
}

onMounted(() => {
  startGlobalTimers();
});
</script>

<style scoped>
.home-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #55a297;
}

.home-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

/* flex: 1 让 5 条精确均分容器高度，不用百分比，避免取整产生缝隙 */
.home-bg-slice {
  flex: 1;
  width: 100%;
  display: block;
}

/* ================== 动态数据覆盖层 (仅用于动态变化覆盖) ================== */
.dyn-overlay {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* 金币数值 */
.dyn-coins-val {
  left: 21.43%;
  top: 5.2%;
  width: 10.32%;
  height: 2.8%;
  background: #436273;
  border-radius: 10rpx;
}

.dyn-val-text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.5);
}

/* 体力数值与倒计时 */
.dyn-stamina-val {
  left: 46%;
  top: 5.2%;
  width: 12%;
  height: 2.8%;
  background: #436273;
  border-radius: 10rpx;
  gap: 6rpx;
}

.dyn-stamina-sub {
  color: #fef08a;
  font-size: 20rpx;
  font-weight: 800;
}

/* 幸运礼包倒计时 */
.dyn-lucky-timer {
  left: 4.2%;
  top: 24.3%;
  width: 14.8%;
  height: 2.1%;
  background: #002d24;
  border-radius: 14rpx;
  border: 3rpx solid #30966a;
}

.dyn-timer-text {
  color: #fef08a;
  font-size: 18rpx;
  font-weight: 900;
  white-space: nowrap;
}

/* 关卡动态胶囊 */
.dyn-level-pill {
  left: 33.7%;
  top: 69.8%;
  width: 32.6%;
  height: 4.1%;
  background: #2b5952;
  border-radius: 30rpx;
  box-shadow: inset 0 2rpx 4rpx rgba(255,255,255,0.2);
}

.dyn-level-text {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

/* ================== 透明精准热区按钮 ================== */
.hotspot {
  position: absolute;
  z-index: 20;
  -webkit-tap-highlight-color: transparent;
}

.hotspot:active {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20rpx;
  transform: scale(0.96);
  transition: transform 0.08s ease;
}

.hotspot-gear {
  left: 2.5%;
  top: 4.2%;
  width: 10%;
  height: 4.8%;
  border-radius: 50%;
}

.hotspot-coins {
  left: 13.5%;
  top: 4.4%;
  width: 25.5%;
  height: 4.4%;
  border-radius: 30rpx;
}

.hotspot-stamina {
  left: 39.5%;
  top: 4.4%;
  width: 26.5%;
  height: 4.4%;
  border-radius: 30rpx;
}

.hotspot-level-chest {
  left: 3.5%;
  top: 10.4%;
  width: 45%;
  height: 7.5%;
  border-radius: 24rpx;
}

.hotspot-star-chest {
  left: 53.5%;
  top: 10.4%;
  width: 44%;
  height: 7.5%;
  border-radius: 24rpx;
}

.hotspot-winter-banner {
  left: 21%;
  top: 18.2%;
  width: 58%;
  height: 12%;
  border-radius: 24rpx;
}

.hotspot-lucky-gift {
  left: 3%;
  top: 18.6%;
  width: 18%;
  height: 8.5%;
  border-radius: 24rpx;
}

.hotspot-daily-task {
  left: 3%;
  top: 27.4%;
  width: 18%;
  height: 8.2%;
  border-radius: 24rpx;
}

.hotspot-daily-chal {
  left: 3%;
  top: 35.8%;
  width: 18%;
  height: 8.2%;
  border-radius: 24rpx;
}

.hotspot-piggy-bank {
  left: 79.5%;
  top: 19%;
  width: 18.5%;
  height: 8%;
  border-radius: 24rpx;
}

.hotspot-desktop {
  left: 79.5%;
  top: 27%;
  width: 18.5%;
  height: 8%;
  border-radius: 24rpx;
}

.hotspot-theme {
  left: 2.5%;
  top: 74.2%;
  width: 18.5%;
  height: 7.8%;
  border-radius: 24rpx;
}

.hotspot-cards {
  left: 2.5%;
  top: 82.2%;
  width: 18.5%;
  height: 7.8%;
  border-radius: 24rpx;
}

.hotspot-start-game {
  left: 21%;
  top: 73.6%;
  width: 58%;
  height: 9.4%;
  border-radius: 40rpx;
}

.hotspot-shop {
  left: 28%;
  top: 87.5%;
  width: 16%;
  height: 6.2%;
  border-radius: 24rpx;
}

/* ================== 弹窗系统通用样式 ================== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.animate-pop {
  animation: popUp 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes popUp {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* 1. 幸运礼包弹窗 (完全还原 0e5b39aca423980735833fe5710881f2.jpg) */
.lucky-bag-dialog {
  position: relative;
  width: 680rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lucky-header-box {
  position: relative;
  width: 100%;
  height: 240rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.lucky-title-3d {
  font-size: 60rpx;
  font-weight: 900;
  color: #fffbeb;
  text-shadow: 0 4rpx 0 #b45309, 0 8rpx 16rpx rgba(0,0,0,0.5);
  margin-bottom: -40rpx;
  z-index: 5;
}

.lucky-header-art {
  width: 520rpx;
  height: 220rpx;
  z-index: 4;
}

.modal-close-circle {
  position: absolute;
  top: 10rpx;
  right: 20rpx;
  width: 60rpx;
  height: 60rpx;
  background: rgba(0, 0, 0, 0.6);
  border: 4rpx solid #ffffff;
  border-radius: 30rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
  z-index: 10;
}

.lucky-card-body {
  position: relative;
  width: 100%;
  background: #fdfbf3;
  border-radius: 32rpx;
  border: 8rpx solid #f59e0b;
  padding: 40rpx 16rpx 46rpx;
  box-shadow: 0 10rpx 20rpx rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lucky-items-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.lucky-item-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lucky-item-square {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  background: #fae8c8;
  border-radius: 16rpx;
  border: 3rpx solid #eab308;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lucky-item-img {
  width: 64rpx;
  height: 64rpx;
}

.lucky-item-emoji {
  font-size: 54rpx;
}

.lucky-qty-badge {
  position: absolute;
  bottom: -6rpx;
  right: -6rpx;
  font-size: 20rpx;
  font-weight: 900;
  color: #451a03;
}

.lucky-name-label {
  font-size: 26rpx;
  font-weight: 900;
  color: #78350f;
  margin-top: 10rpx;
}

.lucky-plus-sign {
  font-size: 36rpx;
  font-weight: 900;
  color: #d97706;
}

.lucky-time-pill {
  position: absolute;
  bottom: -24rpx;
  left: 50%;
  transform: translateX(-50%);
  background: #f59e0b;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
  padding: 6rpx 36rpx;
  border-radius: 20rpx;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.2);
}

.unlock-action-btn {
  position: relative;
  margin-top: 50rpx;
  width: 480rpx;
  height: 104rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 52rpx;
  border: 6rpx solid #ffffff;
  box-shadow: 0 10rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.unlock-text {
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 900;
  text-shadow: 0 4rpx 4rpx rgba(0,0,0,0.3);
}

.free-ribbon {
  position: absolute;
  top: -12rpx;
  right: -10rpx;
  background: #ef4444;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  border: 3rpx solid #ffffff;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.3);
}

/* 2. 金库银行 (5f42c2f1cd2a6ff541de042d6025cb7c.jpg) */
.piggy-dialog {
  position: relative;
  width: 580rpx;
  background: #fdfbf3;
  border-radius: 32rpx;
  border: 8rpx solid #f59e0b;
  padding: 70rpx 30rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.piggy-title-ribbon {
  position: absolute;
  top: -30rpx;
  width: 440rpx;
  height: 80rpx;
  background: #f59e0b;
  border-radius: 40rpx;
  border: 5rpx solid #ffffff;
  box-shadow: 0 6rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
}

.piggy-title-text {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 900;
  text-shadow: 0 3rpx 0 #92400e;
}

.modal-close-btn-ribbon {
  position: absolute;
  right: 16rpx;
  width: 50rpx;
  height: 50rpx;
  background: #78350f;
  color: #ffffff;
  border-radius: 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
}

.piggy-content-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 10rpx;
}

.piggy-meter-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.meter-tag {
  background: #f59e0b;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  padding: 2rpx 14rpx;
  border-radius: 12rpx;
}

.meter-track {
  width: 44rpx;
  height: 240rpx;
  background: #451a03;
  border-radius: 22rpx;
  border: 4rpx solid #facc15;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}

.meter-fill {
  width: 100%;
  background: linear-gradient(to top, #eab308, #fef08a);
  transition: height 0.3s ease;
}

.piggy-art-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.piggy-bubble {
  background: #f59e0b;
  color: #ffffff;
  padding: 6rpx 24rpx;
  border-radius: 20rpx;
  border: 3rpx solid #ffffff;
  box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.2);
  margin-bottom: 10rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.bubble-coin-ico {
  width: 36rpx;
  height: 36rpx;
}

.bubble-coin-val {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
}

.piggy-hero-img {
  width: 400rpx;
  height: 320rpx;
}

.piggy-desc-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20rpx 0;
}

.desc-line {
  color: #451a03;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.4;
}

.piggy-claim-btn {
  width: 440rpx;
  height: 94rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 47rpx;
  border: 5rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.claim-btn-lbl {
  color: #ffffff;
  font-size: 38rpx;
  font-weight: 900;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.3);
}

.claim-btn-lbl {
  color: #ffffff;
  font-size: 38rpx;
  font-weight: 900;
  text-shadow: 0 3rpx 3rpx rgba(0,0,0,0.3);
}

.piggy-sub-notice {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #78350f;
  font-weight: bold;
}

/* 3. 每日任务与长线任务 (8c5804076525e732d05f68a710e9e14d.jpg) */
.tasks-dialog {
  position: relative;
  width: 680rpx;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.tasks-nav-tabs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}

.modal-close-task {
  width: 64rpx;
  height: 64rpx;
  background: rgba(0, 0, 0, 0.6);
  border: 4rpx solid #ffffff;
  border-radius: 32rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
}

.task-tab-pill {
  flex: 1;
  height: 76rpx;
  border-radius: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
  background: #164e43;
  color: #a7f3d0;
  border: 4rpx solid rgba(255,255,255,0.3);
}

.task-tab-pill.active {
  background: #fef9c3;
  color: #1e293b;
  border: 4rpx solid #000000;
}

.tasks-scroll-list {
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.task-card-row {
  background: #fefce8;
  border-radius: 28rpx;
  border: 4rpx solid #ca8a04;
  padding: 18rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.task-art-box {
  width: 90rpx;
  height: 90rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-sack-img {
  width: 84rpx;
  height: 84rpx;
}

.task-emoji-icon {
  font-size: 64rpx;
}

.task-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.task-main-title {
  font-size: 22rpx;
  color: #94a3b8;
  font-weight: bold;
}

.task-sub-title {
  font-size: 28rpx;
  font-weight: 900;
  color: #9a3412;
  margin-bottom: 8rpx;
}

.task-progress-bar {
  position: relative;
  width: 100%;
  height: 28rpx;
  background: #451a03;
  border-radius: 14rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-progress-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: #facc15;
}

.task-progress-txt {
  position: relative;
  z-index: 2;
  font-size: 18rpx;
  font-weight: 900;
  color: #ffffff;
}

.task-action-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.task-reward-preview {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.reward-type-icon { font-size: 28rpx; }
.reward-type-val { font-size: 24rpx; font-weight: 900; color: #451a03; }

.task-btn {
  position: relative;
  width: 140rpx;
  height: 58rpx;
  border-radius: 29rpx;
  font-size: 26rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #ffffff;
}

.btn-can-claim {
  background: #14b8a6;
  color: #ffffff;
  box-shadow: 0 4rpx 0 #0f766e;
}

.btn-claimed {
  background: #cbd5e1;
  color: #64748b;
  border-color: #94a3b8;
}

.btn-unfinish {
  background: #94a3b8;
  color: #ffffff;
}

.red-dot-micro {
  position: absolute;
  top: -4rpx; right: -4rpx;
  width: 16rpx; height: 16rpx;
  border-radius: 8rpx;
  background: #ef4444;
  border: 2rpx solid #ffffff;
}

/* 4. 商城弹窗 (eb8d66ed2e601b6783973ef0f410d30d.jpg) */
.shop-dialog {
  position: relative;
  width: 680rpx;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.shop-top-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.shop-title-text {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 900;
  text-shadow: 0 4rpx 8rpx rgba(0,0,0,0.5);
}

.shop-scroll-view {
  max-height: 75vh;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.shop-card {
  border-radius: 28rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
  border: 6rpx solid rgba(255,255,255,0.8);
  box-shadow: 0 6rpx 14rpx rgba(0,0,0,0.2);
}

.cyan-card .shop-card-header {
  background: #6ee7b7;
  color: #065f46;
  text-align: center;
  font-size: 32rpx;
  font-weight: 900;
  padding: 8rpx 0;
}

.cyan-card .shop-card-body {
  background: #ccfbf1;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.orange-card .shop-card-header {
  background: #fb923c;
  color: #ffffff;
  text-align: center;
  font-size: 32rpx;
  font-weight: 900;
  padding: 8rpx 0;
}

.orange-card .shop-card-body {
  background: #ffedd5;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shop-bag-img {
  width: 100rpx;
  height: 100rpx;
}

.shop-tool-preview {
  width: 100rpx;
  height: 100rpx;
  background: #fed7aa;
  border-radius: 18rpx;
  border: 3rpx solid #ea580c;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shop-tool-img {
  width: 64rpx;
  height: 64rpx;
}

.shop-tool-emoji {
  font-size: 50rpx;
}

.shop-qty-lbl {
  font-size: 36rpx;
  font-weight: 900;
  color: #1e293b;
}

.shop-btn-group {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.shop-coin-btn {
  width: 220rpx;
  height: 64rpx;
  background: #f59e0b;
  border-radius: 32rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 0 #b45309;
  gap: 8rpx;
}

.shop-free-btn {
  width: 220rpx;
  height: 64rpx;
  background: #14b8a6;
  border-radius: 32rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 0 #0f766e;
  gap: 8rpx;
}

.btn-cam-ico {
  width: 40rpx;
  height: 40rpx;
}

.btn-coin-ico {
  width: 40rpx;
  height: 40rpx;
}

.btn-coin-val {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
  text-shadow: 0 2rpx 0 #b45309;
}

.btn-free-txt {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
  text-shadow: 0 2rpx 0 #0f766e;
}

.reward-coin-ico, .reward-tool-ico {
  width: 32rpx;
  height: 32rpx;
}

.task-bulb-img {
  width: 76rpx;
  height: 76rpx;
}

/* 5. 设置与通用弹窗 */
.settings-dialog, .reward-dialog {
  width: 580rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 36rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dialog-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.dialog-title {
  font-size: 38rpx;
  font-weight: 900;
  color: #1e293b;
}

.close-btn {
  font-size: 36rpx;
  color: #64748b;
  font-weight: bold;
}

.settings-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 36rpx;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 30rpx;
  font-weight: 800;
  color: #334155;
}

.dialog-confirm-btn {
  width: 100%;
  height: 84rpx;
  background: #10b981;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
  border-radius: 42rpx;
  border: none;
}

/* 6. 宝箱奖励 */
.reward-header {
  font-size: 44rpx;
  font-weight: 900;
  color: #10b981;
  margin-bottom: 30rpx;
}

.reward-grid {
  width: 100%;
  display: flex;
  justify-content: space-around;
  margin-bottom: 40rpx;
}

.reward-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.reward-icon-lg { font-size: 64rpx; }
.reward-name { font-size: 26rpx; font-weight: 800; color: #1e293b; }

/* 广告模拟播放层 */
.ad-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.ad-box {
  width: 80%;
  text-align: center;
}

.ad-countdown {
  position: absolute;
  top: 80rpx; right: 40rpx;
  background: rgba(255,255,255,0.2);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
}

.ad-icon { font-size: 90rpx; margin-bottom: 20rpx; }
.ad-title { font-size: 34rpx; font-weight: 900; margin-bottom: 16rpx; }
.ad-sub { font-size: 24rpx; color: #94a3b8; margin-bottom: 30rpx; }
.ad-progress { width: 100%; height: 10rpx; background: #334155; border-radius: 5rpx; overflow: hidden; }
.ad-progress-bar { height: 100%; background: #22c55e; }

/* 7. 添加桌面有礼弹窗样式 (完全对齐 点添加桌面后的弹窗.jpg) */
.desktop-dialog {
  position: relative;
  width: 620rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.desktop-card-wrap {
  position: relative;
  width: 100%;
}

.desktop-card-img {
  width: 100%;
  display: block;
}

/* 右上角关闭热区 */
.desktop-close-hotspot {
  position: absolute;
  top: 28%;
  right: 4%;
  width: 14%;
  height: 12%;
  border-radius: 50%;
  z-index: 10;
  -webkit-tap-highlight-color: transparent;
}

.desktop-btn-wrap {
  margin-top: 24rpx;
  width: 320rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.08s ease;
}

.desktop-btn-wrap:active {
  transform: scale(0.95);
}

.desktop-btn-img {
  width: 100%;
  display: block;
}
</style>
