const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../majiang-mp/src/pages/cards/cards.vue');

const content = `<template>
  <view class="cards-page-container">
    <!-- 顶部导航栏 -->
    <view class="cards-header-nav">
      <view class="back-btn-round" @tap="goBack">
        <text class="back-arrow-icon">⬅</text>
      </view>
    </view>

    <scroll-view class="cards-scroll-body" scroll-y>
      <!-- 顶部插图与转盘 -->
      <view class="disc-section">
        <image class="disc-hero-img" src="/static/ui/cards_top_disc.png" mode="aspectFit" />
        
        <!-- 四个辅助功能按钮 -->
        <view class="aux-btn left-top-btn" @tap="openAuxModal('exchange')">
          <text class="aux-btn-icon">⭐</text>
          <text class="aux-btn-txt">兑换屋</text>
        </view>

        <view class="aux-btn left-bot-btn" @tap="openAuxModal('seasonShop')">
          <text class="aux-btn-icon">🏬</text>
          <text class="aux-btn-txt">赛季商店</text>
        </view>

        <view class="aux-btn right-top-btn" @tap="drawCardVideo">
          <text class="aux-btn-icon">🎁</text>
          <text class="aux-btn-txt">视频宝箱</text>
        </view>

        <view class="aux-btn right-bot-btn" @tap="openAuxModal('collection')">
          <text class="aux-btn-icon">🏆</text>
          <text class="aux-btn-txt">赛季收藏</text>
        </view>
      </view>

      <!-- 活动标签 -->
      <view class="season-tab-row">
        <view class="season-pill-btn">
          <text class="pill-excl">!</text>
          <text class="pill-text">冬日欢乐</text>
        </view>
      </view>

      <!-- 9套卡片网格 (3x3) -->
      <view class="cards-grid">
        <view 
          class="card-grid-item" 
          v-for="(c, i) in gameState.cardsAlbum" 
          :key="i"
          @tap="inspectCard(c)"
        >
          <view class="card-thumb-frame">
            <image class="card-artwork" :src="'/static/ui/' + c.image" mode="aspectFit" />
          </view>
        </view>
      </view>

      <view style="height: 60rpx;"></view>
    </scroll-view>

    <!-- 卡片详情/抽取弹窗 -->
    <view class="modal-overlay" v-if="selectedCard" @tap.self="selectedCard = null">
      <view class="card-detail-dialog animate-pop">
        <view class="dialog-close" @tap="selectedCard = null">✕</view>
        <view class="detail-title">{{ selectedCard.name }}</view>
        <image class="detail-artwork" :src="'/static/ui/' + selectedCard.image" mode="aspectFit" />
        <view class="detail-prog">当前收集进度: {{ selectedCard.count }}/9</view>
        <view class="detail-tip">集齐整套即可开启宝箱获得稀有奖励！</view>
        <button class="draw-card-btn" @tap="drawSpecificCard(selectedCard)">
          📺 看广告获得碎片 (+1)
        </button>
      </view>
    </view>

    <!-- 模拟激励视频广告播放浮层 -->
    <view class="ad-overlay" v-if="adActive">
      <view class="ad-box">
        <view class="ad-countdown">广告播放中... {{ adCountdown }}s</view>
        <text class="ad-icon">🎬</text>
        <text class="ad-title">抽取冬日集卡碎片中...</text>
        <view class="ad-progress">
          <view class="ad-progress-bar" :style="{ width: ((3 - adCountdown) / 3 * 100) + '%' }"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { gameState, addCoins } from '../../game/state.js';

const selectedCard = ref(null);
const adActive = ref(false);
const adCountdown = ref(3);

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: '/pages/index/index' });
    }
  });
}

function runAd(cb) {
  adActive.value = true;
  adCountdown.value = 3;
  const t = setInterval(() => {
    adCountdown.value--;
    if (adCountdown.value <= 0) {
      clearInterval(t);
      adActive.value = false;
      cb();
    }
  }, 1000);
}

function inspectCard(c) {
  selectedCard.value = c;
}

function drawSpecificCard(c) {
  runAd(() => {
    c.count = Math.min(9, c.count + 1);
    if (c.count >= 9) {
      addCoins(100);
      uni.showToast({ title: '恭喜集齐【' + c.name + '】！获得100金币！', icon: 'success' });
    } else {
      uni.showToast({ title: '获得【' + c.name + '】碎片 x1', icon: 'success' });
    }
    selectedCard.value = null;
  });
}

function drawCardVideo() {
  runAd(() => {
    const list = gameState.cardsAlbum;
    const randomCard = list[Math.floor(Math.random() * list.length)];
    randomCard.count = Math.min(9, randomCard.count + 1);
    uni.showToast({ title: '宝箱开启！获得【' + randomCard.name + '】碎片', icon: 'success' });
  });
}

function openAuxModal(type) {
  const titles = {
    exchange: '兑换屋',
    seasonShop: '赛季商店',
    collection: '赛季收藏'
  };
  uni.showModal({
    title: titles[type] || '活动提示',
    content: '当前为“冬日集卡”第一赛季，快快集齐卡片领取500大奖吧！',
    showCancel: false,
    confirmText: '继续集卡'
  });
}
</script>

<style scoped>
.cards-page-container {
  width: 100vw;
  height: 100vh;
  background-color: #fefce8;
  display: flex;
  flex-direction: column;
  position: relative;
}

.cards-header-nav {
  height: 90rpx;
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  z-index: 20;
}

.back-btn-round {
  width: 72rpx;
  height: 72rpx;
  background: #f97316;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.2);
}

.back-arrow-icon {
  color: #fff;
  font-size: 36rpx;
  font-weight: 900;
}

.cards-scroll-body {
  flex: 1;
  overflow-y: auto;
}

/* 顶部插图区 */
.disc-section {
  position: relative;
  width: 100%;
  height: 480rpx;
  display: flex;
  justify-content: center;
}

.disc-hero-img {
  width: 95%;
  height: 100%;
}

.aux-btn {
  position: absolute;
  width: 110rpx;
  height: 110rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20rpx;
  border: 4rpx solid #fb923c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.15);
}

.left-top-btn { left: 20rpx; top: 180rpx; }
.left-bot-btn { left: 20rpx; top: 310rpx; }
.right-top-btn { right: 20rpx; top: 120rpx; }
.right-bot-btn { right: 20rpx; top: 250rpx; }

.aux-btn-icon { font-size: 36rpx; }
.aux-btn-txt { font-size: 18rpx; font-weight: 900; color: #7c2d12; margin-top: 4rpx; }

/* 赛季标签 */
.season-tab-row {
  display: flex;
  justify-content: center;
  margin: 10rpx 0 24rpx;
}

.season-pill-btn {
  background: #f97316;
  color: #fff;
  padding: 8rpx 40rpx;
  border-radius: 30rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  border: 4rpx solid #fff;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.15);
}

.pill-excl {
  background: #fff;
  color: #f97316;
  width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.pill-text {
  font-size: 32rpx;
  font-weight: 900;
}

/* 9套卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding: 0 20rpx;
}

.card-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card-thumb-frame {
  width: 220rpx;
  height: 280rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.card-artwork {
  width: 100%;
  height: 100%;
}

/* 卡片弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.card-detail-dialog {
  position: relative;
  width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dialog-close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  font-size: 36rpx;
  color: #64748b;
}

.detail-title {
  font-size: 36rpx;
  font-weight: 900;
  color: #7c2d12;
  margin-bottom: 20rpx;
}

.detail-artwork {
  width: 300rpx;
  height: 380rpx;
  margin-bottom: 20rpx;
}

.detail-prog {
  font-size: 28rpx;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 8rpx;
}

.detail-tip {
  font-size: 22rpx;
  color: #64748b;
  margin-bottom: 30rpx;
}

.draw-card-btn {
  width: 100%;
  height: 80rpx;
  background: #f97316;
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
  border-radius: 40rpx;
  border: none;
}

/* 广告模拟 */
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
.ad-title { font-size: 34rpx; font-weight: 900; margin-bottom: 30rpx; }
.ad-progress { width: 100%; height: 10rpx; background: #334155; border-radius: 5rpx; overflow: hidden; }
.ad-progress-bar { height: 100%; background: #f97316; }
</style>
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Successfully written cards.vue to', target);
