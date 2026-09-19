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
      <view class="card-detail-dialog animate-pop" @tap.stop>
        <view class="dialog-close" @tap="selectedCard = null">✕</view>
        <view class="detail-title">{{ selectedCard.name }}</view>
        <image class="detail-artwork" :src="'/pkg-cards/static/ui/' + selectedCard.image" mode="widthFix" />
        <view class="detail-prog">当前收集进度: {{ selectedCard.count }}/9</view>
        <view class="detail-tip">重复碎片: {{ selectedCard.duplicates || 0 }} 张（已集满的卡册再次抽到会转为重复碎片）</view>
        <view class="detail-tip">集齐整套即可开启宝箱获得稀有奖励！</view>
        <button class="draw-card-btn" :disabled="busy || adActive" @tap="drawSpecificCard(selectedCard)">
          📺 观看本地演示广告获得碎片 (+1)
        </button>
      </view>
    </view>

    <!-- 辅助弹窗 (兑换屋 / 赛季商店 / 赛季收藏) -->
    <view class="modal-overlay" v-if="auxModal.visible" @tap.self="auxModal.visible = false">
      <view class="aux-dialog animate-pop" @tap.stop>
        <view class="dialog-close" @tap="auxModal.visible = false">✕</view>
        <view class="aux-dialog-title">{{ auxModal.title }}</view>

        <!-- 兑换屋：选择重复碎片来源 + 未集满卡册目标 -->
        <view class="aux-dialog-content" v-if="auxModal.type === 'exchange'">
          <text class="aux-content-desc">{{ auxModal.desc }}</text>
          <view class="ex-section">
            <view class="ex-label">1. 选择要消耗的重复碎片（每3张换1张）</view>
            <view class="ex-chips" v-if="duplicateCards.length">
              <view
                class="ex-chip"
                :class="{ 'ex-chip-on': exchangeSourceId === c.id }"
                v-for="c in duplicateCards"
                :key="'src-' + c.id"
                @tap="selectExchangeSource(c.id)"
              >{{ c.name }} ×{{ c.duplicates }}</view>
            </view>
            <view class="ex-empty" v-else>暂无重复碎片：重复抽到已集满的卡册即可获得。</view>
          </view>
          <view class="ex-section">
            <view class="ex-label">2. 选择要兑换的卡册（未集满）</view>
            <view class="ex-chips" v-if="incompleteCards.length">
              <view
                class="ex-chip"
                :class="{ 'ex-chip-on': exchangeTargetId === c.id }"
                v-for="c in incompleteCards"
                :key="'dst-' + c.id"
                @tap="selectExchangeTarget(c.id)"
              >{{ c.name }} {{ c.count }}/9</view>
            </view>
            <view class="ex-empty" v-else>全部卡册均已集满，无需兑换。</view>
          </view>
          <button class="dialog-action-btn" :disabled="busy || adActive" @tap="handleAuxAction">
            {{ auxModal.btnText }}
          </button>
        </view>

        <!-- 赛季商店 / 赛季收藏 -->
        <view class="aux-dialog-content" v-else>
          <text class="aux-content-desc">{{ auxModal.desc }}</text>
          <button class="dialog-action-btn" :disabled="busy || adActive" @tap="handleAuxAction">
            {{ auxModal.btnText }}
          </button>
        </view>
      </view>
    </view>

    <!-- 本地演示广告播放浮层（非真实广告投放，仅前端模拟） -->
    <view class="ad-overlay" v-if="adActive">
      <view class="ad-box">
        <view class="ad-countdown">本地演示广告 {{ adCountdown }}s</view>
        <text class="ad-icon">🎬</text>
        <text class="ad-title">抽取冬日集卡碎片中...</text>
        <text class="ad-title">（本地演示广告，非真实广告）</text>
        <view class="ad-progress">
          <view class="ad-progress-bar" :style="{ width: ((3 - adCountdown) / 3 * 100) + '%' }"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue';
import { gameState, addCoins } from '../../../game/state.js';

const CARD_TARGET = 9;            // 每套卡册集齐所需碎片数
const EXCHANGE_COST = 3;          // 兑换屋：每 3 张重复碎片换 1 张自选碎片
const COMPLETE_REWARD_COINS = 100; // 集齐奖励（仅发放一次）
const SEASON_SHOP_COST = 200;     // 赛季商店卡包售价
const AD_SECONDS = 3;             // 本地演示广告时长

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

const selectedCard = ref(null);
const adActive = ref(false);
const adCountdown = ref(AD_SECONDS);
const busy = ref(false);              // 抽卡/兑换进行中，防止重复触发
const exchangeSourceId = ref('');
const exchangeTargetId = ref('');

let adTimer = null;

const auxModal = reactive({
  visible: false,
  type: '',
  title: '',
  desc: '',
  btnText: '确定'
});

const album = computed(() => gameState.cardsAlbum || []);
const duplicateCards = computed(() =>
  album.value.filter(c => c && (c.duplicates || 0) > 0).sort((a, b) => b.duplicates - a.duplicates)
);
const incompleteCards = computed(() => album.value.filter(c => c && (c.count || 0) < CARD_TARGET));
const completedSets = computed(() => countCompletedSets(album.value));

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: '/pages/index/index' });
    }
  });
}

function stopAdTimer() {
  if (adTimer) {
    clearInterval(adTimer);
    adTimer = null;
  }
}

function runAd(cb) {
  stopAdTimer();
  adActive.value = true;
  adCountdown.value = AD_SECONDS;
  adTimer = setInterval(() => {
    adCountdown.value--;
    if (adCountdown.value <= 0) {
      stopAdTimer();
      adActive.value = false;
      cb();
    }
  }, 1000);
}

onUnmounted(() => {
  stopAdTimer();
  adActive.value = false;
  busy.value = false;
});

function beginAction() {
  if (busy.value || adActive.value) return false;
  busy.value = true;
  return true;
}

function endAction() {
  busy.value = false;
}

// 同步「卡册大满贯」长期任务进度
function syncAlbumProgress() {
  const sets = countCompletedSets(album.value);
  const task = (gameState.longTasks || []).find(t => t.id === 'long_card9');
  if (task) task.current = Math.min(task.target || CARD_TARGET, sets);
  return sets;
}

function announceDraw(res, cardName) {
  if (!res || !res.ok) return;
  syncAlbumProgress();
  if (res.rewardGranted) {
    addCoins(COMPLETE_REWARD_COINS);
    uni.showToast({ title: '集齐【' + cardName + '】！+' + COMPLETE_REWARD_COINS + '金币', icon: 'success' });
  } else if (res.duplicate) {
    uni.showToast({ title: '已集满，转为重复碎片×1（共' + res.duplicates + '）', icon: 'none' });
  } else {
    uni.showToast({ title: '获得【' + cardName + '】碎片 x1', icon: 'success' });
  }
}

function inspectCard(c) {
  selectedCard.value = c;
}

function drawSpecificCard(c) {
  if (!c || !beginAction()) return;
  runAd(() => {
    try {
      const res = drawFragment(album.value, c.id);
      announceDraw(res, c.name);
      selectedCard.value = null;
    } finally {
      endAction();
    }
  });
}

// 视频宝箱：随机一张碎片，同样走集齐奖励逻辑
function drawCardVideo() {
  if (!beginAction()) return;
  runAd(() => {
    try {
      const id = pickRandomCardId(album.value);
      const card = findCardById(album.value, id);
      if (!card) return;
      const res = drawFragment(album.value, id);
      announceDraw(res, card.name);
    } finally {
      endAction();
    }
  });
}

// 赛季商店：扣款后直接发放碎片，不播放广告
function buySeasonPack() {
  if (!beginAction()) return;
  try {
    if ((gameState.coins || 0) < SEASON_SHOP_COST) {
      uni.showToast({ title: '金币不足！可以通过通关获取金币', icon: 'none' });
      return;
    }
    const id = pickRandomCardId(album.value);
    const card = findCardById(album.value, id);
    if (!card) {
      uni.showToast({ title: '卡册数据异常，请稍后重试', icon: 'none' });
      return;
    }
    gameState.coins -= SEASON_SHOP_COST;
    const res = drawFragment(album.value, id);
    auxModal.visible = false;
    announceDraw(res, card.name);
  } finally {
    endAction();
  }
}

function confirmExchange() {
  if (!beginAction()) return;
  try {
    const src = findCardById(album.value, exchangeSourceId.value);
    const dst = findCardById(album.value, exchangeTargetId.value);
    if (!src || !dst) {
      uni.showToast({ title: '请先选择重复碎片与兑换目标', icon: 'none' });
      return;
    }
    const res = exchangeFragment(album.value, src.id, dst.id);
    if (!res.ok) {
      if (res.reason === 'insufficient') {
        uni.showToast({ title: '重复碎片不足，需' + res.need + '张（当前' + res.have + '张）', icon: 'none' });
      } else if (res.reason === 'same') {
        uni.showToast({ title: '不能兑换同一套卡册', icon: 'none' });
      } else if (res.reason === 'target_full') {
        uni.showToast({ title: '该卡册已集满，无需兑换', icon: 'none' });
      } else {
        uni.showToast({ title: '兑换失败，请重试', icon: 'none' });
      }
      return;
    }
    if (src.duplicates <= 0) exchangeSourceId.value = '';
    syncAlbumProgress();
    uni.showToast({ title: '兑换成功！获得【' + dst.name + '】碎片', icon: 'success' });
  } finally {
    endAction();
  }
}

function openAuxModal(type) {
  auxModal.type = type;
  if (type === 'exchange') {
    const dups = duplicateCards.value;
    exchangeSourceId.value = dups.length ? dups[0].id : '';
    exchangeTargetId.value = incompleteCards.value.length ? incompleteCards.value[0].id : '';
    auxModal.title = '兑换屋';
    auxModal.desc = '消耗3张重复碎片，兑换1张自选卡册碎片。';
    auxModal.btnText = '确认兑换';
  } else if (type === 'seasonShop') {
    auxModal.title = '赛季商店';
    auxModal.desc = '消耗 ' + SEASON_SHOP_COST + ' 金币直接购买冬日限定卡包，立即获得1张随机碎片（本地演示，无真实广告）。';
    auxModal.btnText = '购买卡包 (🪙 ' + SEASON_SHOP_COST + ')';
  } else if (type === 'collection') {
    auxModal.title = '赛季收藏';
    auxModal.desc = '已达成赛季收集进度：' + completedSets.value + '/' + CARD_TARGET + ' 套。集齐全部' + CARD_TARGET + '套即可获得限定金杯称号！';
    auxModal.btnText = '我知道了';
  }
  auxModal.visible = true;
}

function selectExchangeSource(id) {
  exchangeSourceId.value = id;
}

function selectExchangeTarget(id) {
  exchangeTargetId.value = id;
}

function handleAuxAction() {
  if (auxModal.type === 'exchange') {
    confirmExchange();
    return;
  }
  if (auxModal.type === 'seasonShop') {
    buySeasonPack();
    return;
  }
  auxModal.visible = false;
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

/* 赛季标签 (冬日欢乐)：保持静态层级，不遮挡赛季商店热区 */
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

/* 9套卡片网格 (3x3)：层级高于赛季商店热区，保证首行卡片点击不被热区截获 */
.cards-grid {
  position: relative;
  z-index: 21;
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

/* 兑换屋：来源/目标选择 */
.aux-dialog-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ex-section {
  width: 100%;
  margin-bottom: 20rpx;
}

.ex-label {
  font-size: 26rpx;
  font-weight: 900;
  color: #7c2d12;
  margin-bottom: 12rpx;
}

.ex-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-height: 240rpx;
  overflow-y: auto;
}

.ex-chip {
  padding: 10rpx 22rpx;
  border-radius: 30rpx;
  background: #fef3c7;
  border: 4rpx solid #fdba74;
  color: #7c2d12;
  font-size: 26rpx;
  font-weight: 900;
}

.ex-chip-on {
  background: #fb923c;
  border-color: #7c2d12;
  color: #ffffff;
}

.ex-empty {
  font-size: 24rpx;
  color: #a16207;
  line-height: 1.5;
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
