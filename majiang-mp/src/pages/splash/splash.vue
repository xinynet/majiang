<template>
  <view class="splash">
    <image class="splash-bg" src="/static/ui/splash_bg.jpg" mode="aspectFill" />
    <view class="progress-track" :style="track">
      <view class="progress-fill" :style="{ width: progress + '%' }"></view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';

const progress = ref(6);
const track = reactive({});

// Long enough for the bar to read as a real load rather than a flicker.
const MIN_SHOW_MS = 1800;

/* Where the pill is painted into splash_bg, in source-image pixels. The bar is
 * laid over it, so it has to follow the same crop the artwork gets. */
const ART_W = 941, ART_H = 1672;
const PILL = { left: 60, right: 885, top: 1550, bottom: 1606 };

const PRELOAD = [
  '/static/ui/bg_home.jpg',
  '/static/tile-poses/shells.png',
  '/static/bg/meadow.png',
];

/* aspectFill scales the art to cover the screen and centres the overflow, so
 * the bar's offsets are measured from where the art actually lands. */
function placeTrack() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  const w = info.windowWidth, h = info.windowHeight;
  const scale = Math.max(w / ART_W, h / ART_H);
  const artW = ART_W * scale, artH = ART_H * scale;
  const originX = (w - artW) / 2, originY = (h - artH) / 2;
  track.left = (originX + PILL.left * scale) + 'px';
  track.right = (w - originX - PILL.right * scale) + 'px';
  track.top = (originY + PILL.top * scale) + 'px';
  track.height = ((PILL.bottom - PILL.top) * scale) + 'px';
}

function loadOne(src) {
  return new Promise(resolve => {
    uni.getImageInfo({ src, complete: resolve });
  });
}

function go() {
  uni.reLaunch({ url: '/pages/index/index' });
}

onMounted(async () => {
  placeTrack();
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

.progress-track {
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(180deg, #0d3b2c, #124a38);
  border: 2px solid #1fcf9e;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffe37a, #f7a91d);
  box-shadow: 0 0 8px rgba(255, 200, 60, 0.6);
  transition: width 0.25s ease-out;
}
</style>
