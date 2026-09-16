const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../majiang-mp/src/pages/index/index.vue');

const content = `<template>
  <view class="home-container">
    <!-- 背景底图 -->
    <image class="home-bg" src="/static/ui/bg_home.jpg" mode="aspectFill" />

    <!-- 顶栏状态区 -->
    <view class="top-bar">
      <!-- 设置齿轮 -->
      <view class="btn-gear" @tap="openSettings">
        <text class="icon-gear">⚙️</text>
      </view>

      <!-- 金币栏 -->
      <view class="currency-pill" @tap="openShop('coins')">
        <text class="currency-icon">🪙</text>
        <text class="currency-val">{{ gameState.coins }}</text>
        <view class="plus-badge">+</view>
      </view>

      <!-- 体力爱心栏 -->
      <view class="currency-pill" @tap="showStaminaTip">
        <text class="currency-icon">❤️</text>
        <text class="currency-val">{{ gameState.stamina }}</text>
        <text class="stamina-tag">{{ gameState.stamina >= 5 ? 'max' : formatSeconds(gameState.staminaTimer) }}</text>
        <view class="plus-badge">+</view>
      </view>
    </view>

    <!-- 关卡宝箱 & 星星宝箱 -->
    <view class="chests-row">
      <view class="chest-card left-chest" @tap="openChest('level')">
        <image class="chest-img" src="/static/ui/card_level_chest.png" mode="aspectFit" />
      </view>
      <view class="chest-card right-chest" @tap="openChest('star')">
        <image class="chest-img" src="/static/ui/card_star_chest.png" mode="aspectFit" />
      </view>
    </view>

    <!-- 冬日集卡活动 Banner -->
    <view class="event-banner-wrap" @tap="gotoCardsPage">
      <image class="event-banner-img" src="/static/ui/banner_winter.png" mode="aspectFit" />
    </view>

    <!-- 左侧悬浮按钮组 -->
    <view class="floating-left">
      <!-- 倒计时礼包 -->
      <view class="float-btn-wrap" @tap="openLuckyBag">
        <image class="float-btn-icon" src="/static/ui/btn_lucky_gift.png" mode="aspectFit" />
        <view class="countdown-pill">{{ formatLongSeconds(gameState.luckyBag.remainingSeconds) }}</view>
      </view>

      <!-- 每日任务 -->
      <view class="float-btn-wrap" @tap="openDailyTasks">
        <image class="float-btn-icon" src="/static/ui/btn_daily_task.png" mode="aspectFit" />
        <view class="red-dot"></view>
      </view>

      <!-- 每日挑战 -->
      <view class="float-btn-wrap" @tap="openDailyChallenge">
        <image class="float-btn-icon" src="/static/ui/btn_daily_chal.png" mode="aspectFit" />
        <view class="red-dot"></view>
      </view>
    </view>

    <!-- 右侧悬浮按钮组 -->
    <view class="floating-right">
      <!-- 存钱罐 -->
      <view class="float-btn-wrap" @tap="openPiggyBank">
        <image class="float-btn-icon" src="/static/ui/btn_piggy.png" mode="aspectFit" />
      </view>

      <!-- 添加到桌面 -->
      <view class="float-btn-wrap" @tap="openAddToDesktop">
        <image class="float-btn-icon" src="/static/ui/btn_desktop.png" mode="aspectFit" />
        <view class="red-dot"></view>
      </view>
    </view>

    <!-- 左下功能按钮 -->
    <view class="bottom-left-btns">
      <!-- 主题装扮 -->
      <view class="bottom-sub-btn" @tap="openThemeModal">
        <image class="sub-btn-icon" src="/static/ui/btn_theme.png" mode="aspectFit" />
        <view class="red-dot sub-dot"></view>
      </view>

      <!-- 集卡 -->
      <view class="bottom-sub-btn" @tap="gotoCardsPage">
        <image class="sub-btn-icon" src="/static/ui/btn_cards.png" mode="aspectFit" />
      </view>
    </view>

    <!-- 底部中心：开始游戏 -->
    <view class="bottom-center-action">
      <!-- 关卡胶囊 -->
      <view class="level-pill-badge">关卡{{ gameState.currentLevel }}</view>

      <!-- 开始游戏大按钮 -->
      <view class="start-play-btn" @tap="handleStartGame">
        <image class="start-btn-img" src="/static/ui/btn_start_game.png" mode="aspectFit" />
      </view>

      <!-- 商店按钮 -->
      <view class="shop-btn-wrap" @tap="openShop('all')">
        <image class="shop-icon-img" src="/static/ui/btn_shop.png" mode="aspectFit" />
      </view>
    </view>

    <!-- ==================== 弹窗系统 ==================== -->

    <!-- 1. 幸运礼包弹窗 (0e5b39aca423980735833fe5710881f2.jpg) -->
    <view class="modal-overlay" v-if="modals.luckyBag" @tap.self="closeModal('luckyBag')">
      <view class="lucky-bag-dialog animate-pop">
        <view class="modal-close-circle" @tap="closeModal('luckyBag')">✕</view>
        <image class="lucky-header-art" src="/static/ui/lucky_chest_header.png" mode="aspectFit" />
        
        <view class="lucky-items-box">
          <view class="lucky-item-col" v-for="(it, idx) in gameState.luckyBag.rewards" :key="idx">
            <view class="lucky-item-card">
              <text class="lucky-item-emoji">{{ it.id==='undo'?'↩️':it.id==='clear'?'💡':it.id==='time'?'⏱️':it.id==='shuffle'?'🔄':'🪙' }}</text>
              <text class="lucky-count-tag">x{{ it.count }}</text>
            </view>
            <text class="lucky-item-lbl">{{ it.name }}</text>
          </view>
        </view>

        <!-- 倒计时 -->
        <view class="lucky-time-pill">{{ formatLongSeconds(gameState.luckyBag.remainingSeconds) }}</view>

        <!-- 立即解锁大按钮 -->
        <view class="unlock-action-btn" @tap="unlockLuckyBag">
          <text class="tv-icon">📺</text>
          <text class="unlock-text">立即解锁</text>
          <view class="free-ribbon">限免</view>
        </view>
      </view>
    </view>

    <!-- 2. 金库银行 / 存钱罐 (5f42c2f1cd2a6ff541de042d6025cb7c.jpg) -->
    <view class="modal-overlay" v-if="modals.piggyBank" @tap.self="closeModal('piggyBank')">
      <view class="piggy-dialog animate-pop">
        <view class="piggy-title-ribbon">
          <text class="piggy-title-text">金库银行</text>
          <view class="modal-close-btn-ribbon" @tap="closeModal('piggyBank')">✕</view>
        </view>

        <view class="piggy-content-row">
          <!-- 左侧温度计刻度 -->
          <view class="piggy-meter-col">
            <view class="meter-tag tag-600">600</view>
            <view class="meter-track">
              <view class="meter-fill" :style="{ height: (gameState.piggyBank.coins / 600 * 100) + '%' }"></view>
            </view>
            <view class="meter-tag tag-300">300</view>
          </view>

          <!-- 右侧金猪插图与气泡 -->
          <view class="piggy-art-wrap">
            <view class="piggy-bubble">🪙 {{ gameState.piggyBank.coins }}</view>
            <image class="piggy-hero-img" src="/static/ui/piggy_big.png" mode="aspectFit" />
          </view>
        </view>

        <view class="piggy-desc-text">
          <text class="desc-line">满300金币可以领取</text>
          <text class="desc-line">最多可存储600金币</text>
        </view>

        <!-- 领取奖励按钮 -->
        <view class="piggy-claim-btn" @tap="claimPiggyReward">
          <text class="tv-icon">📺</text>
          <text class="claim-btn-lbl">领取奖励</text>
        </view>

        <view class="piggy-sub-notice">(每次通过关卡可存入25金币)</view>
      </view>
    </view>

    <!-- 3. 每日任务与长线任务 (8c5804076525e732d05f68a710e9e14d.jpg) -->
    <view class="modal-overlay" v-if="modals.dailyTasks" @tap.self="closeModal('dailyTasks')">
      <view class="tasks-dialog animate-pop">
        <view class="tasks-nav-tabs">
          <view class="modal-close-task" @tap="closeModal('dailyTasks')">✕</view>
          <view class="task-tab-pill" :class="{ active: activeTaskTab === 'daily' }" @tap="activeTaskTab = 'daily'">每日任务</view>
          <view class="task-tab-pill" :class="{ active: activeTaskTab === 'long' }" @tap="activeTaskTab = 'long'">长线任务</view>
        </view>

        <scroll-view class="tasks-scroll-list" scroll-y>
          <view class="task-card-row" v-for="(t, i) in currentTaskList" :key="i">
            <!-- 左侧插画 -->
            <view class="task-art-box">
              <image v-if="t.rewardType==='coins'" class="task-sack-img" src="/static/ui/coin_sack.png" mode="aspectFit" />
              <text v-else class="task-emoji-icon">💡</text>
            </view>

            <!-- 中间标题与进度条 -->
            <view class="task-info-col">
              <text class="task-main-title">{{ t.title }}</text>
              <text class="task-sub-title">{{ t.desc }}</text>
              <view class="task-progress-bar">
                <view class="task-progress-fill" :style="{ width: Math.min(100, (t.current / t.target * 100)) + '%' }"></view>
                <text class="task-progress-txt">{{ t.current }}/{{ t.target }}</text>
              </view>
            </view>

            <!-- 右侧奖励与领取按钮 -->
            <view class="task-action-col">
              <view class="task-reward-preview">
                <text class="reward-type-icon">{{ t.rewardType==='coins'?'🪙':'💡' }}</text>
                <text class="reward-type-val">x{{ t.rewardCount }}</text>
              </view>
              <button 
                class="task-btn" 
                :class="{ 'btn-can-claim': t.current >= t.target && !t.claimed, 'btn-claimed': t.claimed, 'btn-unfinish': t.current < t.target }"
                @tap="claimTaskReward(t)"
              >
                {{ t.claimed ? '已领取' : (t.current >= t.target ? '领取' : '未完成') }}
                <view class="red-dot-micro" v-if="t.current >= t.target && !t.claimed"></view>
              </button>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 4. 商城弹窗 (eb8d66ed2e601b6783973ef0f410d30d.jpg) -->
    <view class="modal-overlay" v-if="modals.shop" @tap.self="closeModal('shop')">
      <view class="shop-dialog animate-pop">
        <view class="shop-top-header">
          <view class="modal-close-task" @tap="closeModal('shop')">✕</view>
          <text class="shop-title-text">道具与金币补给</text>
        </view>

        <scroll-view class="shop-scroll-view" scroll-y>
          <!-- 金币礼包 -->
          <view class="shop-card cyan-card">
            <view class="shop-card-header">金币</view>
            <view class="shop-card-body">
              <image class="shop-bag-img" src="/static/ui/shop_coin_bag.png" mode="aspectFit" />
              <text class="shop-qty-lbl">x100</text>
              <view class="shop-free-btn" @tap="buyWithAd('coins', 100)">
                <text class="tv-icon-sm">📺</text> 免费
              </view>
            </view>
          </view>

          <!-- 道具礼包列表 -->
          <view class="shop-card orange-card" v-for="(item, idx) in shopItems" :key="idx">
            <view class="shop-card-header">{{ item.name }}</view>
            <view class="shop-card-body">
              <view class="shop-tool-preview">
                <text class="shop-tool-emoji">{{ item.emoji }}</text>
              </view>
              <text class="shop-qty-lbl">x{{ item.count }}</text>
              <view class="shop-btn-group">
                <view class="shop-coin-btn" @tap="buyWithCoins(item)">
                  🪙 {{ item.price }}
                </view>
                <view class="shop-free-btn" @tap="buyWithAd(item.id, item.count)">
                  <text class="tv-icon-sm">📺</text> 免费
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 5. 设置弹窗 -->
    <view class="modal-overlay" v-if="modals.settings" @tap.self="closeModal('settings')">
      <view class="settings-dialog animate-pop">
        <view class="dialog-header">
          <text class="dialog-title">游戏设置</text>
          <view class="close-btn" @tap="closeModal('settings')">✕</view>
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
        <button class="dialog-confirm-btn" @tap="closeModal('settings')">确定</button>
      </view>
    </view>

    <!-- 6. 宝箱开启奖励提示弹窗 -->
    <view class="modal-overlay" v-if="modals.chestReward" @tap.self="closeModal('chestReward')">
      <view class="reward-dialog animate-pop">
        <view class="reward-header">🎉 宝箱已开启！</view>
        <view class="reward-grid">
          <view class="reward-item">
            <text class="reward-icon-lg">🪙</text>
            <text class="reward-name">金币 +{{ lastReward.coins }}</text>
          </view>
          <view class="reward-item">
            <text class="reward-icon-lg">💡</text>
            <text class="reward-name">消除道具 +{{ lastReward.tools }}</text>
          </view>
        </view>
        <button class="dialog-confirm-btn" @tap="closeModal('chestReward')">开心收下</button>
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

// 弹窗状态管理
const modals = reactive({
  luckyBag: false,
  piggyBank: false,
  dailyTasks: false,
  shop: false,
  settings: false,
  chestReward: false
});

const activeTaskTab = ref('daily');
const lastReward = reactive({ coins: 0, tools: 0 });

const currentTaskList = computed(() => {
  return activeTaskTab.value === 'daily' ? gameState.dailyTasks : gameState.longTasks;
});

// 商城商品列表
const shopItems = [
  { id: 'undo', name: '翻牌', emoji: '↩️', count: 1, price: 100 },
  { id: 'clear', name: '消除', emoji: '💡', count: 2, price: 100 },
  { id: 'magnet', name: '磁铁', emoji: '🧲', count: 1, price: 300 },
  { id: 'shuffle', name: '洗牌', emoji: '🔄', count: 1, price: 300 },
  { id: 'time', name: '加时', emoji: '⏱️', count: 2, price: 100 }
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

// 按钮交互
function openLuckyBag() { modals.luckyBag = true; }
function openPiggyBank() { modals.piggyBank = true; }
function openDailyTasks() { modals.dailyTasks = true; }
function openShop(tab) { modals.shop = true; }
function openSettings() { modals.settings = true; }
function closeModal(m) { modals[m] = false; }

function showStaminaTip() {
  uni.showModal({
    title: '体力说明',
    content: '当前体力: ' + gameState.stamina + '/5\\n每15分钟自动恢复1点体力。是否看广告补满体力？',
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
  uni.showModal({
    title: '添加到桌面',
    content: '点击小程序右上角【···】选择【添加到桌面】或【添加到我的小程序】，随时随地畅玩麻将！',
    showCancel: false,
    confirmText: '我知道了'
  });
}

function openDailyChallenge() {
  uni.showModal({
    title: '每日挑战',
    content: '今日专家挑战关卡已更新！胜利即可赢取双倍奖励，是否开始挑战？',
    confirmText: '开始挑战',
    cancelText: '稍后再来',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: '/pages/game/game?level=' + gameState.currentLevel + '&mode=challenge' });
      }
    }
  });
}

function openThemeModal() {
  uni.showToast({ title: '主题装扮已解锁默认“田园暖阳”皮肤！', icon: 'none' });
}

function gotoCardsPage() {
  uni.navigateTo({ url: '/pages/cards/cards' });
}

function openChest(type) {
  if (type === 'level') {
    lastReward.coins = 50;
    lastReward.tools = 1;
    addCoins(50);
    addTool('clear', 1);
    modals.chestReward = true;
  } else {
    lastReward.coins = 150;
    lastReward.tools = 2;
    addCoins(150);
    addTool('shuffle', 1);
    addTool('undo', 1);
    modals.chestReward = true;
  }
}

function unlockLuckyBag() {
  triggerAd(() => {
    addCoins(100);
    addTool('undo', 1);
    addTool('clear', 1);
    addTool('shuffle', 1);
    addTool('time', 1);
    gameState.luckyBag.remainingSeconds = 15 * 60;
    closeModal('luckyBag');
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
    closeModal('piggyBank');
    uni.showToast({ title: '已成功取出 ' + got + ' 金币！', icon: 'success' });
  });
}

function claimTaskReward(t) {
  if (t.claimed || t.current < t.target) return;
  t.claimed = true;
  if (t.rewardType === 'coins') {
    addCoins(t.rewardCount);
  } else {
    addTool('clear', t.rewardCount);
  }
  uni.showToast({ title: '奖励领取成功！', icon: 'success' });
}

function buyWithCoins(item) {
  if (spendCoins(item.price)) {
    addTool(item.id, item.count);
    uni.showToast({ title: '购买成功！' + item.name + ' +' + item.count, icon: 'success' });
  } else {
    uni.showToast({ title: '金币不足，可通过看广告免费获取！', icon: 'none' });
  }
}

function buyWithAd(toolId, count) {
  triggerAd(() => {
    if (toolId === 'coins') {
      addCoins(count);
      uni.showToast({ title: '金币 +' + count, icon: 'success' });
    } else {
      addTool(toolId, count);
      uni.showToast({ title: '获得道具 +' + count, icon: 'success' });
    }
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
    url: '/pages/game/game?level=' + gameState.currentLevel
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
}

/* 顶栏状态区 */
.top-bar {
  position: absolute;
  top: 60rpx;
  left: 30rpx;
  right: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  z-index: 10;
}

.btn-gear {
  width: 80rpx;
  height: 80rpx;
  background: #ffffff;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.2);
  border: 4rpx solid #bce2db;
}

.icon-gear {
  font-size: 40rpx;
}

.currency-pill {
  height: 70rpx;
  background: rgba(0, 50, 40, 0.6);
  border: 3rpx solid rgba(255, 255, 255, 0.4);
  border-radius: 35rpx;
  display: flex;
  align-items: center;
  padding: 0 10rpx 0 16rpx;
  gap: 12rpx;
}

.currency-icon {
  font-size: 36rpx;
}

.currency-val {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 800;
  min-width: 50rpx;
}

.stamina-tag {
  color: #ffef8a;
  font-size: 22rpx;
  font-weight: bold;
}

.plus-badge {
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
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.3);
  border: 2rpx solid #ffffff;
}

/* 上方双宝箱 */
.chests-row {
  position: absolute;
  top: 170rpx;
  left: 20rpx;
  right: 20rpx;
  display: flex;
  justify-content: space-between;
  z-index: 10;
}

.chest-card {
  width: 48%;
  height: 120rpx;
}

.chest-img {
  width: 100%;
  height: 100%;
}

/* 冬日活动 Banner */
.event-banner-wrap {
  position: absolute;
  top: 290rpx;
  left: 140rpx;
  right: 140rpx;
  height: 180rpx;
  z-index: 10;
}

.event-banner-img {
  width: 100%;
  height: 100%;
}

/* 左侧悬浮按钮 */
.floating-left {
  position: absolute;
  left: 24rpx;
  top: 310rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  z-index: 12;
}

.float-btn-wrap {
  position: relative;
  width: 130rpx;
  height: 130rpx;
}

.float-btn-icon {
  width: 100%;
  height: 100%;
}

.countdown-pill {
  position: absolute;
  bottom: -6rpx;
  left: 50%;
  transform: translateX(-50%);
  background: #0f3d32;
  color: #fef08a;
  font-size: 18rpx;
  font-weight: bold;
  padding: 2rpx 10rpx;
  border-radius: 12rpx;
  white-space: nowrap;
  border: 2rpx solid #34d399;
}

.red-dot {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 22rpx;
  height: 22rpx;
  border-radius: 11rpx;
  background: #ef4444;
  border: 3rpx solid #ffffff;
}

/* 右侧悬浮按钮 */
.floating-right {
  position: absolute;
  right: 24rpx;
  top: 310rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  z-index: 12;
}

/* 左下功能按钮 */
.bottom-left-btns {
  position: absolute;
  left: 24rpx;
  bottom: 150rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  z-index: 12;
}

.bottom-sub-btn {
  position: relative;
  width: 130rpx;
  height: 120rpx;
}

.sub-btn-icon {
  width: 100%;
  height: 100%;
}

.sub-dot {
  top: 0;
  right: 0;
}

/* 底部中心按钮 */
.bottom-center-action {
  position: absolute;
  bottom: 40rpx;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 15;
}

.level-pill-badge {
  background: #254a43;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 800;
  padding: 8rpx 50rpx;
  border-radius: 30rpx;
  margin-bottom: 12rpx;
  border: 3rpx solid #3c776b;
  box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.3);
}

.start-play-btn {
  width: 440rpx;
  height: 140rpx;
}

.start-btn-img {
  width: 100%;
  height: 100%;
}

.shop-btn-wrap {
  width: 140rpx;
  height: 110rpx;
  margin-top: 10rpx;
}

.shop-icon-img {
  width: 100%;
  height: 100%;
}

/* ================== 通用弹窗层 ================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
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

/* 幸运礼包弹窗 */
.lucky-bag-dialog {
  position: relative;
  width: 660rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-close-circle {
  position: absolute;
  top: 60rpx;
  right: 20rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: rgba(0,0,0,0.6);
  border: 3rpx solid #ffffff;
  color: #fff;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.lucky-header-art {
  width: 100%;
  height: 360rpx;
}

.lucky-items-box {
  width: 100%;
  background: #fdf6dc;
  border: 8rpx solid #ea8f20;
  border-radius: 28rpx;
  padding: 30rpx 16rpx 40rpx;
  display: flex;
  justify-content: space-around;
  margin-top: -30rpx;
}

.lucky-item-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.lucky-item-card {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  background: #ecd5a4;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #cfab76;
}

.lucky-item-emoji {
  font-size: 48rpx;
}

.lucky-count-tag {
  position: absolute;
  bottom: 2rpx;
  right: 4rpx;
  font-size: 20rpx;
  font-weight: 900;
  color: #3f200c;
}

.lucky-item-lbl {
  font-size: 22rpx;
  font-weight: bold;
  color: #b45309;
}

.lucky-time-pill {
  margin-top: -24rpx;
  background: #f59e0b;
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
  padding: 8rpx 50rpx;
  border-radius: 30rpx;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.2);
  z-index: 5;
}

.unlock-action-btn {
  position: relative;
  margin-top: 36rpx;
  width: 440rpx;
  height: 100rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 50rpx;
  border: 6rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #b45309, 0 12rpx 16rpx rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.unlock-text {
  font-size: 38rpx;
  font-weight: 900;
  color: #78350f;
}

.free-ribbon {
  position: absolute;
  top: -16rpx;
  right: -10rpx;
  background: #ef4444;
  color: #fff;
  font-size: 20rpx;
  font-weight: bold;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  border: 3rpx solid #fff;
}

/* 金库银行弹窗 */
.piggy-dialog {
  position: relative;
  width: 640rpx;
  background: #fff8eb;
  border-radius: 32rpx;
  border: 8rpx solid #eab308;
  padding: 0 0 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.piggy-title-ribbon {
  width: 80%;
  height: 80rpx;
  background: #f59e0b;
  border-radius: 0 0 24rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 4rpx solid #fff;
  border-top: none;
}

.piggy-title-text {
  font-size: 36rpx;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.modal-close-btn-ribbon {
  position: absolute;
  right: -60rpx;
  top: 10rpx;
  width: 54rpx;
  height: 54rpx;
  border-radius: 27rpx;
  background: #92400e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  border: 3rpx solid #fff;
}

.piggy-content-row {
  width: 90%;
  display: flex;
  align-items: center;
  margin-top: 30rpx;
}

.piggy-meter-col {
  width: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.meter-track {
  width: 32rpx;
  height: 260rpx;
  background: #451a03;
  border-radius: 16rpx;
  position: relative;
  overflow: hidden;
}

.meter-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to top, #eab308, #fef08a);
  border-radius: 16rpx;
}

.meter-tag {
  background: #f59e0b;
  color: #fff;
  font-size: 20rpx;
  font-weight: bold;
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
}

.piggy-art-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.piggy-bubble {
  background: #f59e0b;
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
  padding: 6rpx 24rpx;
  border-radius: 20rpx;
  border: 3rpx solid #fff;
  box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.15);
  margin-bottom: 10rpx;
}

.piggy-hero-img {
  width: 320rpx;
  height: 260rpx;
}

.piggy-desc-text {
  text-align: center;
  font-size: 32rpx;
  font-weight: 900;
  color: #451a03;
  line-height: 1.5;
  margin: 20rpx 0;
}

.desc-line {
  display: block;
}

.piggy-claim-btn {
  width: 440rpx;
  height: 94rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 47rpx;
  border: 6rpx solid #ffffff;
  box-shadow: 0 8rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.claim-btn-lbl {
  font-size: 38rpx;
  font-weight: 900;
  color: #78350f;
}

.piggy-sub-notice {
  font-size: 22rpx;
  color: #78350f;
  margin-top: 20rpx;
}

/* 每日任务弹窗 */
.tasks-dialog {
  width: 680rpx;
  height: 80vh;
  background: #fffdf5;
  border-radius: 36rpx;
  border: 8rpx solid #d97706;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

.tasks-nav-tabs {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.modal-close-task {
  width: 60rpx;
  height: 60rpx;
  border-radius: 30rpx;
  background: #1e293b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  border: 3rpx solid #fff;
}

.task-tab-pill {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  background: #cbd5e1;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 900;
}

.task-tab-pill.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.15);
  border: 4rpx solid #d97706;
}

.tasks-scroll-list {
  flex: 1;
  overflow-y: auto;
}

.task-card-row {
  background: #fefce8;
  border: 4rpx solid #fde047;
  border-radius: 20rpx;
  padding: 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.task-art-box {
  width: 90rpx;
  height: 90rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-sack-img {
  width: 90rpx;
  height: 90rpx;
}

.task-emoji-icon {
  font-size: 64rpx;
}

.task-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.task-main-title {
  font-size: 24rpx;
  color: #713f12;
  font-weight: bold;
}

.task-sub-title {
  font-size: 28rpx;
  font-weight: 900;
  color: #b45309;
}

.task-progress-bar {
  position: relative;
  width: 100%;
  height: 28rpx;
  background: #451a03;
  border-radius: 14rpx;
  overflow: hidden;
}

.task-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #eab308;
  border-radius: 14rpx;
}

.task-progress-txt {
  position: absolute;
  width: 100%;
  text-align: center;
  font-size: 18rpx;
  font-weight: bold;
  color: #fff;
  line-height: 28rpx;
}

.task-action-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.task-reward-preview {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.reward-type-icon {
  font-size: 32rpx;
}

.reward-type-val {
  font-size: 24rpx;
  font-weight: 900;
  color: #713f12;
}

.task-btn {
  position: relative;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  font-size: 24rpx;
  font-weight: 900;
  border: none;
}

.btn-can-claim {
  background: #14b8a6;
  color: #fff;
  box-shadow: 0 4rpx 0 #0f766e;
}

.btn-claimed {
  background: #94a3b8;
  color: #f1f5f9;
}

.btn-unfinish {
  background: #cbd5e1;
  color: #64748b;
}

.red-dot-micro {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 18rpx;
  height: 18rpx;
  border-radius: 9rpx;
  background: #ef4444;
  border: 2rpx solid #fff;
}

/* 商城弹窗 */
.shop-dialog {
  width: 680rpx;
  height: 80vh;
  background: #0f3d32;
  border-radius: 36rpx;
  border: 6rpx solid #34d399;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

.shop-top-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.shop-title-text {
  font-size: 36rpx;
  font-weight: 900;
  color: #ffffff;
}

.shop-scroll-view {
  flex: 1;
  overflow-y: auto;
}

.shop-card {
  border-radius: 24rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  border: 4rpx solid #fff;
}

.cyan-card {
  background: #6ee7b7;
}

.orange-card {
  background: #fdba74;
}

.shop-card-header {
  font-size: 30rpx;
  font-weight: 900;
  color: #0f3d32;
  text-align: center;
  margin-bottom: 8rpx;
}

.shop-card-body {
  background: #fff;
  border-radius: 18rpx;
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shop-bag-img {
  width: 80rpx;
  height: 80rpx;
}

.shop-tool-emoji {
  font-size: 60rpx;
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
  background: #f59e0b;
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
  padding: 8rpx 30rpx;
  border-radius: 24rpx;
  border: 3rpx solid #fff;
  box-shadow: 0 4rpx 0 #b45309;
}

.shop-free-btn {
  background: #14b8a6;
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
  padding: 8rpx 30rpx;
  border-radius: 24rpx;
  border: 3rpx solid #fff;
  box-shadow: 0 4rpx 0 #0f766e;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

/* 设置与通用弹窗 */
.settings-dialog, .reward-dialog {
  width: 600rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.dialog-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #1e293b;
}

.close-btn {
  font-size: 36rpx;
  color: #64748b;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #334155;
}

.dialog-confirm-btn {
  width: 100%;
  height: 80rpx;
  background: #10b981;
  color: #fff;
  font-size: 32rpx;
  font-weight: 900;
  border-radius: 40rpx;
  border: none;
}

.reward-header {
  font-size: 40rpx;
  font-weight: 900;
  color: #f59e0b;
  text-align: center;
  margin-bottom: 24rpx;
}

.reward-grid {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30rpx;
}

.reward-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.reward-icon-lg {
  font-size: 64rpx;
}

.reward-name {
  font-size: 28rpx;
  font-weight: 800;
  color: #1e293b;
}

/* 广告模拟播放层 */
.ad-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ad-box {
  width: 80%;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  text-align: center;
}

.ad-countdown {
  position: absolute;
  top: 80rpx;
  right: 40rpx;
  background: rgba(255,255,255,0.2);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
}

.ad-icon {
  font-size: 100rpx;
  margin-bottom: 30rpx;
}

.ad-title {
  font-size: 36rpx;
  font-weight: 900;
  margin-bottom: 16rpx;
}

.ad-sub {
  font-size: 24rpx;
  color: #94a3b8;
  margin-bottom: 40rpx;
}

.ad-progress {
  width: 100%;
  height: 12rpx;
  background: #334155;
  border-radius: 6rpx;
  overflow: hidden;
}

.ad-progress-bar {
  height: 100%;
  background: #10b981;
}
</style>
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Successfully written index.vue to', target);
