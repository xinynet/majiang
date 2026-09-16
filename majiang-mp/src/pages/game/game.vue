<template>
  <view class="game">
    <image class="g-meadow" src="/static/bg/meadow.png" mode="scaleToFill" />

    <view class="g-top t-header">
      <view class="g-top-left">
        <view class="g-pause t-btn" @tap="onPause"><image class="t-icon" src="/static/icons/pause.png" mode="aspectFit" /></view>
        <view class="g-score">
          <view class="g-star t-span"><image class="t-icon" src="/static/icons/star.png" mode="aspectFit" /></view>
          <text class="t-b">{{ view.score }}</text>
        </view>
      </view>
      <view class="g-top-tools">
        <view class="g-round g-rules t-btn"><image class="t-icon" src="/static/icons/rules.png" mode="aspectFit" /></view>
        <view class="g-round g-more t-btn"><image class="t-icon" src="/static/icons/more.png" mode="aspectFit" /></view>
        <view class="g-round g-quit t-btn"><image class="t-icon" src="/static/icons/quit.png" mode="aspectFit" /></view>
      </view>
    </view>

    <view class="g-timer-row">
      <view class="g-timer" :class="{ urgent: view.remain < 60 }">
        <view class="g-timer-icon t-span"><image class="t-icon" src="/static/icons/timer.png" mode="aspectFit" /></view>
        <text class="t-b">{{ clock }}</text>
      </view>
    </view>

    <view class="board-wrap t-main">
      <canvas id="board" type="2d" class="board" @touchstart="onTouch"></canvas>
      <view v-if="view.dealing" class="coach"><text class="t-p">发牌中…</text></view>
    </view>

    <view class="g-status">
      <text class="g-stat t-span">关卡<text class="t-b">{{ view.level }}</text></text>
      <text class="g-stat t-span">种类<text class="t-b">{{ view.types }}</text></text>
      <text class="g-stat t-span">总数<text class="t-b">{{ view.initial }}</text></text>
      <text class="g-stat g-stat-right t-span">剩余数量<text class="t-b">{{ view.remaining }}</text></text>
    </view>

    <view class="g-tray" :class="{ danger: view.slots.length >= 6 }">
      <view v-for="i in 7" :key="i" class="g-slot" :class="{ filled: !!view.slots[i - 1] }">
        <image v-if="view.slots[i - 1]" class="g-slot-face" :src="faceSrc(view.slots[i - 1])" mode="aspectFit" />
      </view>
    </view>

    <view class="g-combo">
      <view class="g-combo-fill t-i" :style="{ width: comboWidth }"></view>
      <text class="g-combo-text t-b">x{{ view.combo }}</text>
    </view>

    <view class="g-dock t-nav">
      <view v-for="t in tools" :key="t.name" class="g-prop" :class="{ empty: view.tools[t.name] <= 0 }" :data-tool="t.name">
        <view class="g-prop-main t-btn" @tap="onTool(t.name)">
          <image class="g-prop-art" :src="'/static/icons/tool-' + t.name + '.png'" mode="aspectFit" />
          <text class="g-prop-name t-span">{{ t.label }}</text>
        </view>
        <view class="g-prop-add t-btn">+</view>
        <text class="g-prop-count t-b">{{ view.tools[t.name] }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { TileMotion } from '../../game/tile-motion.js';
import { createGame, boardMetrics, faceKey } from '../../game/game-core.js';
import { createBoardRenderer } from '../../game/canvas-board.js';
import { createEmitter, canvasHost, resolveCanvas } from '../../game/platform.js';

const instance = getCurrentInstance();

const tools = [
  { name: 'clear', label: '消除' },
  { name: 'shuffle', label: '洗牌' },
  { name: 'undo', label: '翻牌' },
  { name: 'magnet', label: '磁铁' },
];

/* Only what the template reads lives in reactive state. The tile array never
 * does: it changes every frame during a fall and the canvas reads it directly,
 * so putting it here would push a hundred objects through setData per frame -
 * exactly the cost this port exists to avoid. */
const view = reactive({
  level: 1, score: 0, remain: 600, combo: 1, comboUntil: 0,
  initial: 0, types: 0, remaining: 0, slots: [], dealing: true,
  tools: { clear: 1, shuffle: 1, undo: 1, magnet: 1 },
});

const clock = computed(() => {
  const s = Math.max(0, view.remain);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
});
const comboWidth = computed(() => {
  if (view.combo <= 1) return '100%';
  return Math.max(0, (view.comboUntil - Date.now()) / 5000 * 100) + '%';
});
const faceSrc = tile => `/static/tiles-face/${faceKey(tile.type)}.png`;

let game = null, renderer = null, host = null, metrics = null;
let boardSize = { width: 0, height: 0 };
let running = false, clockTimer = null, lastFrame = 0, paused = false;

function syncView() {
  const s = game.state;
  view.level = s.level; view.score = s.score; view.remain = s.remain;
  view.combo = s.combo; view.comboUntil = s.comboUntil;
  view.initial = s.initial; view.types = s.initialTypeCount;
  view.remaining = s.tiles.filter(t => !t.removed).length;
  view.slots = s.slots.map(t => ({ type: t.type }));
  view.dealing = s.dealing;
  view.tools = { ...s.tools };
}

/* Back-to-front, the same ordering the web build used for z-index. */
function ordered() {
  const s = game.state;
  const maxLayer = Math.max(0, ...s.tiles.map(t => t.layoutZ ?? t.z));
  return s.tiles.filter(t => !t.removed && !t.inTray)
    .sort((a, b) => TileMotion.depth(a.z, a.stand || 0, maxLayer) - TileMotion.depth(b.z, b.stand || 0, maxLayer));
}

function paint() {
  // build() emits before the board has been measured, so there is a frame with
  // tiles but no metrics yet.
  if (!renderer || !game || !metrics) return;
  renderer.draw(ordered(), metrics, { ...boardSize, makeCanvas: host.makeCanvas });
}

/* Runs only while something is actually moving, then stops. */
function pump() {
  if (running) return;
  running = true;
  lastFrame = Date.now();
  const tick = () => {
    const now = Date.now(), dt = Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const active = game.stepMotion(dt);
    paint();
    if (active) host.frame(tick); else running = false;
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
    uni.showModal({
      title: '本局完成', content: `得分 ${game.state.score} · ${'★'.repeat(game.stars())}`,
      showCancel: false, success: () => start(game.state.level + 1),
    });
  }
  if (name === 'lost') stopClock();
}

function startClock() {
  stopClock();
  clockTimer = setInterval(() => {
    if (paused) return;
    if (!game.tick()) stopClock();
    view.remain = game.state.remain;
    view.combo = game.state.combo;
  }, 1000);
}
function stopClock() { clearInterval(clockTimer); clockTimer = null; }

function onPause() {
  paused = !paused;
  uni.showToast({ title: paused ? '已暂停' : '继续', icon: 'none', duration: 900 });
}

function onTouch(e) {
  const p = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!p || !renderer || !metrics || game.state.dealing || paused) return;
  // Mini-program canvases report canvas-local x/y; browsers report page coords.
  let x = p.x, y = p.y;
  if (x === undefined) { x = p.clientX ?? p.pageX; y = p.clientY ?? p.pageY; }
  const hit = renderer.pick(ordered(), metrics, x, y);
  if (hit) game.pick(hit.id);
}

function onTool(name) {
  if (!paused) game.useTool(name);
}

function start(level) {
  game.build(level, boardSize.width / boardSize.height);
  metrics = boardMetrics(game.state.tiles, level, boardSize.width, boardSize.height);
  syncView();
  paint();
  setTimeout(startClock, 3500);
}

onMounted(async () => {
  const found = await resolveCanvas('#board', instance);
  if (!found) return;
  const { canvas, width, height } = found;
  const dpr = uni.getWindowInfo ? uni.getWindowInfo().pixelRatio : uni.getSystemInfoSync().pixelRatio;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  host = canvasHost(canvas);
  // The layout constants in boardMetrics are CSS pixels, so the context has to
  // draw in CSS pixels too. How many device pixels a unit currently covers
  // differs by platform, so measure it and correct by the difference instead of
  // assuming: a WeChat 2d context starts at 1:1, uni-app's H5 one is pre-scaled.
  const unit = host.measureUnitScale();
  if (Math.abs(dpr / unit - 1) > 0.01) host.ctx.scale(dpr / unit, dpr / unit);
  boardSize = { width, height };

  game = createGame({ motion: TileMotion, emit: createEmitter({ onEvent }) });

  const atlas = await host.loadImage('/static/tile-poses/shells.png');
  // Faces load lazily; a tile draws its shell until its art arrives.
  const faces = new Map(), pending = new Set();
  const faceFor = type => {
    const key = faceKey(type);
    if (faces.has(key)) return faces.get(key);
    if (!pending.has(key)) {
      pending.add(key);
      host.loadImage(`/static/tiles-face/${key}.png`)
        .then(img => { faces.set(key, img); renderer && renderer.invalidate(); paint(); })
        .catch(() => {});
    }
    return null;
  };
  renderer = createBoardRenderer(host.ctx, atlas, faceFor);
  start(1);
});

onUnmounted(() => { stopClock(); game && game.destroy(); });
</script>

<style>
@import '../../styles/game-screen.css';

/* The H5 page had a global border-box reset and got bold text for free from the
 * <b> element. WXML has neither, so both are restated - without them every
 * padded box comes out 4px wider than the design and the counters read light. */
view, text, image, canvas { box-sizing: border-box; }
.t-b { font-weight: 700; }

/* The meadow illustration replaces the CSS clouds; the picket band that the
 * stylesheet draws at 96px still closes it off against the table. */
.g-meadow { position: absolute; left: 0; top: 0; z-index: 0; width: 100%; height: 110px; }
.game > view { position: relative; z-index: 1; }

/* The tool art carries its own colour, so it needs no plate behind it. */
.g-prop-art { flex: 0 0 26px; width: 26px; height: 26px; }

/* The page root stands in for the H5 screen element. */
.game { position: relative; display: flex; flex-direction: column; width: 100%; height: 100vh; overflow: hidden; }
/* uni-canvas carries a default 300x150 box, so `inset` alone will not stretch it
 * the way the H5 <div> stretched; the size has to be stated. */
.board { position: absolute; left: 10px; top: 4px; width: calc(100% - 20px); height: calc(100% - 10px); }
/* WXSS ignores aspect-ratio, which is what gave the slots their height in the
 * browser, so it is derived from the tray's own grid arithmetic instead:
 * 7 columns, 5px gaps, 8px padding, 12px margins. */
.g-slot { height: calc((100vw - 70px) / 7 * 1.3636); }
.g-slot-face { position: absolute; inset: 7%; width: 86%; height: 86%; }
/* Icons are baked PNGs rather than inline SVG, which WXML has no element for. */
.t-icon { display: block; }
</style>
