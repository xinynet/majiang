<template>
  <view class="splash">
    <image class="splash-bg" src="/static/ui/splash_bg.jpg" mode="aspectFill" />

    <!-- 法定文案与适龄提示用真实文字渲染，不烤进底图：
         按设备分辨率矢量绘制，任何机型都清晰（备案曾因「无法辨识图内文本内容」
         被退回）；文案写错也只需改这里，不必重出美术。 -->
    <view class="splash-footer">
      <view class="legal-row">
        <!-- 音数协官方适龄提示标识，比例固定，不用 CSS 摹 -->
        <image class="age-badge" src="/static/ui/age_rating_12plus.png" mode="widthFix" />
        <view class="legal-text">
          <text class="legal-title">健康游戏忠告</text>
          <text class="legal-body">抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。</text>
        </view>
      </view>

      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progress + '%' }"></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const progress = ref(6);

// Long enough for the bar to read as a real load rather than a flicker.
const MIN_SHOW_MS = 1800;

const PRELOAD = [
  '/static/ui/bg_home_1.jpg',
  '/static/ui/bg_home_2.jpg',
  '/static/ui/bg_home_3.jpg',
  '/static/ui/bg_home_4.jpg',
  '/static/ui/bg_home_5.jpg',
];

function loadOne(src) {
  return new Promise(resolve => {
    uni.getImageInfo({ src, complete: resolve });
  });
}

function go() {
  uni.reLaunch({ url: '/pages/index/index' });
}

onMounted(async () => {
  const guard = setTimeout(go, MIN_SHOW_MS + 3200);
  const start = Date.now();
  let loaded = 0;
  // Assets load off local storage in a blink, so the bar would flash past
  // unread. Creep it forward on a timer and let each load push it along.
  const creep = setInterval(() => {
    progress.value = Math.min(90, progress.value + 4);
  }, 70);
  await Promise.all(PRELOAD.map(src => loadOne(src).then(() => {
    loaded++;
    progress.value = Math.max(progress.value, Math.round(loaded / PRELOAD.length * 90));
  })));
  const elapsed = Date.now() - start;
  if (elapsed < MIN_SHOW_MS) await new Promise(r => setTimeout(r, MIN_SHOW_MS - elapsed));
  clearInterval(creep);
  clearTimeout(guard);
  progress.value = 100;
  setTimeout(go, 320);
});
</script>

<style>
.splash {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #0b2a20;
}

.splash-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
}

/* 锚定屏幕底部而不是美术坐标：底图换版时这里不需要重新标定。
 * 压一层向下变深的遮罩，保证白色法规文字在任何底图上都够对比度 —— 审核看的
 * 就是这段能不能辨认，不能赌美术底部恰好是暗的。 */
.splash-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 90rpx 40rpx 28rpx;
  background: linear-gradient(180deg, rgba(4, 26, 20, 0), rgba(4, 26, 20, 0.55) 45%, rgba(4, 26, 20, 0.72));
  padding-bottom: calc(28rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.legal-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 20rpx;
}

/* 适龄提示标识 */
.age-badge {
  flex-shrink: 0;
  width: 108rpx;
  margin-right: 20rpx;
}

.legal-text {
  flex: 1;
  min-width: 0;
}

.legal-title {
  display: block;
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  margin-bottom: 4rpx;
  text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.8);
}

.legal-body {
  display: block;
  color: #ffffff;
  font-size: 21rpx;
  line-height: 1.5;
  text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.85);
}

/* 凹槽也不再画在底图里，整条由 CSS 绘制 */
.progress-track {
  height: 34rpx;
  border-radius: 999px;
  background: linear-gradient(180deg, #041a2c, #07262f);
  border: 3rpx solid #00e7dc;
  overflow: hidden;
  box-shadow: inset 0 2rpx 4rpx rgba(0, 0, 0, 0.45);
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(180deg, #f8c41a, #f09a07);
  box-shadow: 0 0 8rpx rgba(250, 180, 30, 0.6);
  transition: width 0.25s ease-out;
}
</style>
