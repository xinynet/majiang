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

/* Where the pill is painted into splash_bg, in the source artwork's own pixels.
 * The live bar is laid over that painted pill, so it has to follow the same
 * crop the artwork gets. These are measured off 启动界面.png, and only their
 * ratio to ART_W/ART_H matters - the exported JPG is smaller, which is fine as
 * long as it keeps the same aspect. Re-measure all six numbers when the
 * artwork changes. */
const ART_W = 852, ART_H = 1846;
const PILL = { left: 57, right: 795, top: 1667, bottom: 1716 };
// Never let the bar fall off the bottom of a shorter screen (see placeTrack).
const MIN_BOTTOM_GAP = 16;

const PRELOAD = [
  '/static/ui/bg_home.jpg',
  '/static/tile-poses/shells.png',
  '/static/bg/meadow.png',
];

/* aspectFill scales the art to cover the screen and centres the overflow, so
 * the bar's offsets are measured from where the art actually lands.
 *
 * The artwork is 852x1846, about 19.5:9. On a screen that tall the painted pill
 * lands exactly where this puts the live bar. On a 16:9 screen aspectFill has
 * to crop roughly a fifth of the height, and the pill - which sits at 90% of
 * the art - is cropped away with it; left alone the live bar would go off the
 * bottom edge too. Pulling it back up keeps a progress bar on screen, and since
 * the painted one is fully cropped by then there is nothing to double up with. */
function placeTrack() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  const w = info.windowWidth, h = info.windowHeight;
  const scale = Math.max(w / ART_W, h / ART_H);
  const artW = ART_W * scale, artH = ART_H * scale;
  const originX = (w - artW) / 2, originY = (h - artH) / 2;
  const height = (PILL.bottom - PILL.top) * scale;
  const top = Math.min(originY + PILL.top * scale, h - height - MIN_BOTTOM_GAP);
  track.left = (originX + PILL.left * scale) + 'px';
  track.right = (w - originX - PILL.right * scale) + 'px';
  track.top = top + 'px';
  track.height = height + 'px';
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

/* Colours sampled straight out of the artwork's own pill, so the live bar sits
 * on top of the painted one without showing a seam. */
.progress-track {
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(180deg, #041a2c, #07262f);
  border: 2px solid #00e7dc;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.45);
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(180deg, #f8c41a, #f09a07);
  box-shadow: 0 0 8px rgba(250, 180, 30, 0.6);
  transition: width 0.25s ease-out;
}
</style>
