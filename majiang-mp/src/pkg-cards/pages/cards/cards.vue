<template>
  <view class="cards-page-container">
    <!-- 主滚动区 -->
    <scroll-view class="cards-scroll-body" scroll-y>
      <!-- 顶部插图与转盘 (完全对齐 2e193822f7443320327a021b85dfe9be.jpg) -->
      <view class="disc-section">
        <image class="disc-hero-img" src="/pkg-cards/static/ui/cards_top_disc.jpg" mode="widthFix" />
        
        <!-- 精准透明功能热区 -->
        <!-- 1. 左上角返回按钮 -->
        <view class="disc-hotspot hotspot-back" @tap="goBack"></view>

        <!-- 2. 视频宝箱 (右上角) -->
        <view class="disc-hotspot hotspot-video-chest" @tap="drawCardVideo"></view>

        <!-- 3. 兑换屋 (左下角球形按钮) -->
        <view class="disc-hotspot hotspot-exchange" @tap="openAuxModal('exchange')"></view>

        <!-- 4. 赛季收藏 (右下角金色五角星方块) -->
        <view class="disc-hotspot hotspot-collection" @tap="openAuxModal('collection')"></view>

        <!-- 5. 赛季商店 (兑换屋下方) -->
        <view class="disc-hotspot hotspot-season-shop" @tap="openAuxModal('seasonShop')"></view>
      </view>

      <!-- 活动标签 (冬日欢乐) -->
      <view class="season-tab-row">
        <view class="season-pill-btn">
          <text class="pill-excl">!</text>
          <text class="pill-text">冬日欢乐</text>
        </view>
      </view>

      <!-- 9套卡片网格 (3x3) (2e193822f7443320327a021b85dfe9be.jpg) -->
      <view class="cards-grid">
        <view 
          class="card-grid-item" 
          v-for="(c, i) in gameState.cardsAlbum" 
          :key="i"
          @tap="inspectCard(c)"
        >
          <view class="card-thumb-frame">
            <image class="card-artwork" :src="'/pkg-cards/static/ui/' + c.image" mode="widthFix" />
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
        <image class="detail-artwork" :src="'/pkg-cards/static/ui/' + selectedCard.image" mode="widthFix" />
        <view class="detail-prog">当前收集进度: {{ selectedCard.count }}/9</view>
        <view class="detail-tip">集齐整套即可开启宝箱获得稀有奖励！</view>
        <button class="draw-card-btn" @tap="drawSpecificCard(selectedCard)">
          📺 看广告获得碎片 (+1)
        </button>
      </view>
    </view>

    <!-- 辅助弹窗 (兑换屋 / 赛季商店 / 赛季收藏) -->
    <view class="modal-overlay" v-if="auxModal.visible" @tap.self="auxModal.visible = false">
      <view class="aux-dialog animate-pop">
        <view class="dialog-close" @tap="auxModal.visible = false">✕</view>
        <view class="aux-dialog-title">{{ auxModal.title }}</view>
        <view class="aux-dialog-content">
          <text class="aux-content-desc">{{ auxModal.desc }}</text>
          <button class="dialog-action-btn" @tap="handleAuxAction">
            {{ auxModal.btnText }}
          </button>
        </view>
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
import { ref, reactive } from 'vue';
import { gameState, addCoins } from '../../../game/state.js';

const selectedCard = ref(null);
const adActive = ref(false);
const adCountdown = ref(3);

const auxModal = reactive({
  visible: false,
  type: '',
  title: '',
  desc: '',
  btnText: '确定'
});

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
  auxModal.type = type;
  if (type === 'exchange') {
    auxModal.title = '兑换屋';
    auxModal.desc = '可使用多余的重复卡片碎片兑换万能卡片！每3张重复卡片可兑换1张自选碎片。';
    auxModal.btnText = '兑换碎片';
  } else if (type === 'seasonShop') {
    auxModal.title = '赛季商店';
    auxModal.desc = '消耗赛季积分或金币可直接购买冬日限定卡包与绝版装饰！';
    auxModal.btnText = '购买卡包 (🪙 200)';
  } else if (type === 'collection') {
    auxModal.title = '赛季收藏';
    auxModal.desc = '已达成赛季收集进度：' + gameState.cardsAlbum.filter(c => c.count >= 9).length + '/9 套。集齐全部9套即可获得限定金杯称号！';
    auxModal.btnText = '我知道了';
  }
  auxModal.visible = true;
}

function handleAuxAction() {
  if (auxModal.type === 'seasonShop') {
    if (gameState.coins >= 200) {
      gameState.coins -= 200;
      drawCardVideo();
      auxModal.visible = false;
    } else {
      uni.showToast({ title: '金币不足！可以通过通关获取金币', icon: 'none' });
    }
  } else {
    auxModal.visible = false;
  }
}
</script>

<style scoped>
.cards-page-container {
  width: 100vw;
  height: 100vh;
  background: #fef0d2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cards-scroll-body {
  flex: 1;
  overflow-y: auto;
}

/* 顶部插图与转盘区 */
.disc-section {
  position: relative;
  width: 100%;
}

.disc-hero-img {
  width: 100%;
  display: block;
}

/* 精准透明热区 */
.disc-hotspot {
  position: absolute;
  z-index: 20;
  -webkit-tap-highlight-color: transparent;
}

.disc-hotspot:active {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
  transform: scale(0.95);
  transition: transform 0.08s ease;
}

/* 1. 左上角返回按钮 */
.hotspot-back {
  left: 2.5%;
  top: 8%;
  width: 10%;
  height: 15%;
  border-radius: 50%;
}

/* 2. 视频宝箱 (右上角) */
.hotspot-video-chest {
  right: 2%;
  top: 18%;
  width: 18%;
  height: 22%;
  border-radius: 20rpx;
}

/* 3. 兑换屋 (左下角球形按钮) */
.hotspot-exchange {
  left: 1%;
  bottom: 2%;
  width: 17%;
  height: 25%;
  border-radius: 20rpx;
}

/* 4. 赛季收藏 (右下角金色五角星方块) */
.hotspot-collection {
  right: 1%;
  bottom: 2%;
  width: 17%;
  height: 25%;
  border-radius: 20rpx;
}

/* 5. 赛季商店 (位于兑换屋下方) */
.hotspot-season-shop {
  left: 1%;
  bottom: -28%;
  width: 18%;
  height: 25%;
  border-radius: 20rpx;
}

/* 赛季标签 (冬日欢乐) */
.season-tab-row {
  display: flex;
  justify-content: center;
  margin: 20rpx 0 20rpx;
}

.season-pill-btn {
  background: #f97316;
  color: #fff;
  padding: 8rpx 44rpx;
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

/* 9套卡片网格 (3x3) */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
  padding: 0 24rpx;
}

.card-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card-grid-item:active {
  transform: scale(0.96);
  transition: transform 0.08s ease;
}

.card-thumb-frame {
  width: 100%;
}

.card-artwork {
  width: 100%;
  display: block;
}

/* 弹窗层通用样式 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.72);
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

.card-detail-dialog, .aux-dialog {
  position: relative;
  width: 580rpx;
  background: #ffffff;
  border-radius: 32rpx;
  border: 8rpx solid #fb923c;
  padding: 36rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dialog-close {
  position: absolute;
  top: 16rpx; right: 20rpx;
  width: 50rpx; height: 50rpx;
  border-radius: 25rpx;
  background: #7c2d12;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
}

.detail-title, .aux-dialog-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #7c2d12;
  margin-bottom: 20rpx;
}

.detail-artwork {
  width: 320rpx;
  margin-bottom: 20rpx;
}

.detail-prog {
  font-size: 32rpx;
  font-weight: 900;
  color: #ea580c;
  margin-bottom: 12rpx;
}

.detail-tip, .aux-content-desc {
  font-size: 26rpx;
  color: #78350f;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 30rpx;
}

.draw-card-btn, .dialog-action-btn {
  width: 90%;
  height: 88rpx;
  background: linear-gradient(to bottom, #fde047, #f59e0b);
  border-radius: 44rpx;
  border: 4rpx solid #ffffff;
  box-shadow: 0 6rpx 0 #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
}

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
