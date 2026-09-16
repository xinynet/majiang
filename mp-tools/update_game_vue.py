# -*- coding: utf-8 -*-
import os

vue_content = """<template>
  <view class="game">
    <!-- Top Meadow Background with Hills, Flowers and Blue Checkered Awning -->
    <image class="g-meadow" src="/static/bg/meadow.png" mode="scaleToFill" />

    <!-- Top Navigation and Tool Buttons -->
    <view class="g-top t-header">
      <view class="g-top-left">
        <view class="g-pause-circle" @tap="openModal('pause')">
          <view class="g-pause-bars"><view class="bar"></view><view class="bar"></view></view>
        </view>
        <view class="g-score">
          <view class="g-star t-span"><image class="t-icon" src="/static/icons/star.png" mode="aspectFit" /></view>
          <text class="t-b score-val">{{ view.score }}</text>
        </view>
      </view>
      <view class="g-top-tools">
        <view class="g-round g-rules t-btn" @tap="openModal('rules')" aria-label="规则说明"><image class="t-icon" src="/static/icons/rules.png" mode="aspectFit" /></view>
        <view class="g-round g-more t-btn" @tap="openModal('settings')" aria-label="系统设置"><image class="t-icon" src="/static/icons/more.png" mode="aspectFit" /></view>
        <view class="g-round g-quit t-btn" @tap="openModal('quit')" aria-label="退出游戏"><image class="t-icon" src="/static/icons/quit.png" mode="aspectFit" /></view>
      </view>
    </view>

    <!-- Timer Row below the Blue Checkered Ribbon on the Right -->
    <view class="g-timer-row">
      <view class="g-timer" :class="{ urgent: view.remain < 60 }">
        <view class="g-timer-icon t-span"><image class="t-icon" src="/static/icons/timer.png" mode="aspectFit" /></view>
        <text class="t-b timer-text">{{ clock }}</text>
      </view>
    </view>

    <!-- Main Game Board -->
    <view class="board-wrap t-main">
      <canvas id="board" type="2d" class="board" @touchstart="onTouch"></canvas>
      <view v-if="view.dealing" class="coach"><text class="t-p">发牌中…</text></view>
    </view>

    <!-- Status Bar -->
    <view class="g-status">
      <text class="g-stat t-span">关卡 <text class="t-b">{{ view.level }}</text></text>
      <text class="g-stat t-span">种类 <text class="t-b">{{ view.types }}</text></text>
      <text class="g-stat t-span">总数 <text class="t-b">{{ view.initial }}</text></text>
      <text class="g-stat g-stat-right t-span">剩余数量 <text class="t-b">{{ view.remaining }}</text></text>
    </view>

    <!-- 7 Slots Tray -->
    <view class="g-tray" :class="{ danger: view.slots.length >= 6 }">
      <view v-for="i in 7" :key="i" class="g-slot" :class="{ filled: !!view.slots[i - 1] }">
        <image v-if="view.slots[i - 1]" class="g-slot-face" :src="faceSrc(view.slots[i - 1])" mode="aspectFit" />
      </view>
    </view>

    <!-- Combo Bar -->
    <view class="g-combo">
      <view class="g-combo-fill t-i" :style="{ width: comboWidth }"></view>
      <text class="g-combo-text t-b">x{{ view.combo }}</text>
    </view>

    <!-- 4 Bottom Tool Buttons (Exact Match to Reference Screenshot) -->
    <view class="g-dock t-nav">
      <view v-for="t in tools" :key="t.name" class="g-prop-item">
        <view class="g-prop-btn" @tap="onTool(t.name)">
          <image class="g-prop-art" :src="'/static/icons/tool-' + t.name + '.png'" mode="aspectFit" />
          <text class="g-prop-name">{{ t.label }}</text>
          <!-- Green plus badge on top-right: shown when count <= 0 -->
          <view v-if="(view.tools[t.name] || 0) <= 0" class="g-prop-plus" @tap.stop="requestToolAd(t.name)">
            <text class="g-plus-icon">+</text>
          </view>
        </view>
        <!-- Pill shape badge centered below each button with bold yellow number -->
        <view class="g-prop-pill" @tap.stop="requestToolAd(t.name)">
          <text class="g-prop-num">{{ view.tools[t.name] || 0 }}</text>
        </view>
      </view>
    </view>

    <!-- ==================== Interactive Modals ==================== -->

    <!-- Modal 1: 游戏暂停 -->
    <view v-if="curModal === 'pause'" class="modal-mask">
      <view class="modal-box">
        <view class="modal-header">
          <text class="modal-title">游戏暂停</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body">
          <view class="modal-stat-card">
            <text class="modal-stat-line">当前关卡：第 {{ view.level }} 关</text>
            <text class="modal-stat-line">累计得分：{{ view.score }} 分</text>
            <text class="modal-stat-line">剩余时间：{{ clock }}</text>
          </view>
          <button class="m-btn m-btn-primary" @tap="closeModal">▶ 继续游戏</button>
          <button class="m-btn m-btn-warning" @tap="restartLevel">🔄 重新开始本关</button>
          <button class="m-btn m-btn-outline" @tap="openModal('settings')">⚙️ 偏好设置 / 后台</button>
          <button class="m-btn m-btn-danger" @tap="openModal('quit')">🚪 退出游戏</button>
        </view>
      </view>
    </view>

    <!-- Modal 2: 玩法规则 -->
    <view v-if="curModal === 'rules'" class="modal-mask">
      <view class="modal-box rules-box">
        <view class="modal-header">
          <text class="modal-title">趣味麻将碰 · 玩法指南</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body scroll-body">
          <view class="rule-item">
            <text class="rule-title">🀄 核心三消规则</text>
            <text class="rule-desc">点击上方牌桌任意麻将放入下方卡槽，卡槽中凑齐 3 张相同麻将即可消除得分！</text>
          </view>
          <view class="rule-item">
            <text class="rule-title">⚠️ 卡槽空间限制</text>
            <text class="rule-desc">下方卡槽最多容纳 7 张麻将。当卡槽放满 7 张且未凑成三消，游戏失败！</text>
          </view>
          <view class="rule-item">
            <text class="rule-title">🔥 4 大助力道具秘籍</text>
            <text class="rule-desc">💡 消除：自动在牌桌中找出并消除一组 3 张相同的麻将。<br/>🔄 洗牌：打乱剩余牌面，解除无解僵局。<br/>↩️ 翻牌：将卡槽中最后一张放回牌桌，解救卡槽危机。<br/>🧲 磁铁：直接吸出与卡槽已有牌配对的麻将，瞬间三消！</text>
          </view>
          <view class="rule-item">
            <text class="rule-title">⚡ 连击 Combo 奖励</text>
            <text class="rule-desc">5 秒内连续消除可累积连击加成倍数，得分翻倍！</text>
          </view>
          <button class="m-btn m-btn-primary" @tap="closeModal">我知道了</button>
        </view>
      </view>
    </view>

    <!-- Modal 3: 设置与后台入口 -->
    <view v-if="curModal === 'settings'" class="modal-mask">
      <view class="modal-box">
        <view class="modal-header">
          <text class="modal-title">系统设置</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body">
          <view class="setting-row" @tap="toggleSound">
            <text class="setting-lbl">音效声音反馈</text>
            <view class="setting-toggle" :class="{ on: prefs.sound }"><view class="toggle-dot"></view></view>
          </view>
          <view class="setting-row" @tap="toggleHaptic">
            <text class="setting-lbl">操作震动反馈</text>
            <view class="setting-toggle" :class="{ on: prefs.haptic }"><view class="toggle-dot"></view></view>
          </view>
          <button class="m-btn m-btn-admin" @tap="openModal('admin')">🎮 运营后台与 GM 控制台</button>
          <button class="m-btn m-btn-outline" @tap="clearStorageAndReset">🗑️ 清除存档重置游戏</button>
          <button class="m-btn m-btn-primary" @tap="closeModal">完成</button>
        </view>
      </view>
    </view>

    <!-- Modal 4: 小程序内嵌 GM / 运营后台控制台 -->
    <view v-if="curModal === 'admin'" class="modal-mask">
      <view class="modal-box admin-box">
        <view class="modal-header">
          <text class="modal-title">🛠️ 运营后台 & GM 控制台</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body scroll-body">
          <view class="admin-tip">可在后台实时调整关卡与道具，即刻生效：</view>
          <view class="admin-sec">
            <text class="admin-sec-title">快速选关跳转</text>
            <view class="admin-levels-grid">
              <view v-for="lvl in 10" :key="lvl" class="admin-lvl-btn" :class="{ active: view.level === lvl }" @tap="adminSetLevel(lvl)">第{{ lvl }}关</view>
            </view>
          </view>
          <view class="admin-sec">
            <text class="admin-sec-title">道具与时间控制</text>
            <view class="admin-actions-row">
              <button class="m-btn-mini" @tap="adminAddTools">一键赠送 +5 道具</button>
              <button class="m-btn-mini" @tap="adminAddTime">时间 +120 秒</button>
            </view>
            <view class="admin-actions-row" style="margin-top: 8px;">
              <button class="m-btn-mini" :class="{ 'btn-on': backendConfig.gmMode }" @tap="adminToggleGm">无限道具模式: {{ backendConfig.gmMode ? '开启' : '关闭' }}</button>
              <button class="m-btn-mini btn-win" @tap="adminInstantWin">作弊一键通关</button>
            </view>
          </view>
          <view class="admin-sec">
            <text class="admin-sec-title">远程后台接口同步</text>
            <button class="m-btn m-btn-outline" style="width: 100%;" @tap="adminSyncBackend">🔄 从远程服务器拉取最新配置</button>
            <text class="admin-api-hint">服务器地址: http://localhost:3000/api/config</text>
          </view>
          <button class="m-btn m-btn-primary" @tap="closeModal">保存并返回</button>
        </view>
      </view>
    </view>

    <!-- Modal 5: 观看广告补充道具 -->
    <view v-if="curModal === 'ad'" class="modal-mask">
      <view class="modal-box">
        <view class="modal-header">
          <text class="modal-title">补充道具</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body">
          <view v-if="!adPlaying">
            <image class="ad-prop-icon" :src="'/static/icons/tool-' + pendingTool + '.png'" mode="aspectFit" />
            <text class="ad-tip-title">道具【{{ pendingToolLabel }}】数量不足</text>
            <text class="ad-tip-desc">观看完整激励视频广告，即可免费获得 1 次【{{ pendingToolLabel }}】助力破局！</text>
            <button class="m-btn m-btn-primary" @tap="startAd">🎬 观看视频广告 (+1次)</button>
            <button class="m-btn m-btn-outline" @tap="closeModal">稍后再说</button>
          </view>
          <!-- Simulated Video Ad Screen -->
          <view v-else class="ad-player-box">
            <view class="ad-player-screen">
              <text class="ad-sponsor">广告播放中</text>
              <text class="ad-countdown">倒计时 {{ adCountdown }} 秒</text>
              <view class="ad-progress"><view class="ad-progress-bar" :style="{ width: ((3 - adCountdown) / 3 * 100) + '%' }"></view></view>
            </view>
            <text class="ad-playing-text">感谢您的支持，视频即将播放完毕…</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Modal 6: 通关大捷 -->
    <view v-if="curModal === 'won'" class="modal-mask">
      <view class="modal-box won-box">
        <view class="won-stars">
          <text class="star-icon">⭐</text><text class="star-icon">⭐</text><text class="star-icon">⭐</text>
        </view>
        <text class="won-title">本关通关大捷！</text>
        <view class="won-card">
          <text class="won-stat">本关得分：<text class="t-b">{{ wonScore }}</text></text>
          <text class="won-stat">连击最高：<text class="t-b">x{{ wonCombo }}</text></text>
        </view>
        <button class="m-btn m-btn-primary" @tap="nextLevel">🎉 进入第 {{ view.level + 1 }} 关</button>
        <button class="m-btn m-btn-outline" @tap="restartLevel">🔄 再次挑战本关</button>
      </view>
    </view>

    <!-- Modal 7: 挑战失败 & 复活 -->
    <view v-if="curModal === 'lost'" class="modal-mask">
      <view class="modal-box lost-box">
        <view class="lost-icon">💔</view>
        <text class="lost-title">本局挑战未通过</text>
        <text class="lost-reason">{{ lostReason }}</text>
        <view class="lost-actions">
          <button class="m-btn m-btn-revive" @tap="onRevive">🎬 看视频免费复活 (移出3张牌)</button>
          <button class="m-btn m-btn-warning" @tap="restartLevel">🔄 重新开始第 {{ view.level }} 关</button>
          <button class="m-btn m-btn-outline" @tap="openModal('quit')">🚪 返回主页</button>
        </view>
      </view>
    </view>

    <!-- Modal 8: 确认退出 -->
    <view v-if="curModal === 'quit'" class="modal-mask">
      <view class="modal-box">
        <view class="modal-header">
          <text class="modal-title">退出对局确认</text>
          <view class="modal-close" @tap="closeModal">✕</view>
        </view>
        <view class="modal-body">
          <text class="quit-text">退出当前对局将重新从第 1 关开始，确定退出吗？</text>
          <button class="m-btn m-btn-danger" @tap="onQuitConfirm">确定退出并重开</button>
          <button class="m-btn m-btn-primary" @tap="closeModal">继续游戏</button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { reactive, computed, ref, onMounted, onUnmounted, getCurrentInstance } from 'vue';
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

const TOOL_LABEL = { clear: '消除', shuffle: '洗牌', undo: '翻牌', magnet: '磁铁' };

const view = reactive({
  level: 1, score: 0, remain: 600, combo: 1, comboUntil: 0,
  initial: 0, types: 0, remaining: 0, slots: [], dealing: true,
  tools: { clear: 1, shuffle: 1, undo: 1, magnet: 1 },
});

const prefs = reactive({
  sound: true,
  haptic: true,
});

const backendConfig = reactive({
  gameTitle: '趣味麻将碰',
  announcement: '',
  roundSeconds: 600,
  adRewardCount: 1,
  gmMode: false,
  initialTools: { clear: 1, shuffle: 1, undo: 1, magnet: 1 },
  levels: [
    { level: 1, tiles: 30, types: 8, time: 600 },
    { level: 2, tiles: 105, types: 22, time: 600 },
    { level: 3, tiles: 120, types: 26, time: 600 },
  ],
});

const curModal = ref(null);
const pendingTool = ref('clear');
const pendingToolLabel = computed(() => TOOL_LABEL[pendingTool.value] || '道具');
const adPlaying = ref(false);
const adCountdown = ref(3);
const wonScore = ref(0);
const wonCombo = ref(1);
const lostReason = ref('卡槽已满 7 张未能消除');

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
  if (!game) return;
  const s = game.state;
  view.level = s.level; view.score = s.score; view.remain = s.remain;
  view.combo = s.combo; view.comboUntil = s.comboUntil;
  view.initial = s.initial; view.types = s.initialTypeCount;
  view.remaining = s.tiles.filter(t => !t.removed).length;
  view.slots = s.slots.map(t => ({ type: t.type }));
  view.dealing = s.dealing;
  view.tools = { ...s.tools };
}

function saveUserData() {
  try {
    uni.setStorageSync('mahjong_user_data', {
      level: view.level,
      score: view.score,
      tools: view.tools,
      sound: prefs.sound,
      haptic: prefs.haptic,
    });
  } catch (e) {}
}

function loadUserData() {
  try {
    const d = uni.getStorageSync('mahjong_user_data');
    if (d) {
      if (d.tools) Object.assign(view.tools, d.tools);
      if (d.sound !== undefined) prefs.sound = d.sound;
      if (d.haptic !== undefined) prefs.haptic = d.haptic;
    }
  } catch (e) {}
}

async function loadRemoteConfig() {
  // Load local cache first
  try {
    const cached = uni.getStorageSync('mahjong_config');
    if (cached) Object.assign(backendConfig, cached);
  } catch (e) {}

  // Attempt to fetch from backend server
  try {
    uni.request({
      url: 'http://localhost:3000/api/config',
      timeout: 1500,
      success(res) {
        if (res.data && res.data.code === 0 && res.data.data) {
          Object.assign(backendConfig, res.data.data);
          try { uni.setStorageSync('mahjong_config', res.data.data); } catch (e) {}
        }
      },
      fail() {}
    });
  } catch (e) {}
}

function ordered() {
  if (!game) return [];
  const s = game.state;
  const maxLayer = Math.max(0, ...s.tiles.map(t => t.layoutZ ?? t.z));
  return s.tiles.filter(t => !t.removed && !t.inTray)
    .sort((a, b) => TileMotion.depth(a.z, a.stand || 0, maxLayer) - TileMotion.depth(b.z, b.stand || 0, maxLayer));
}

function paint() {
  if (!renderer || !game || !metrics) return;
  renderer.draw(ordered(), metrics, { ...boardSize, makeCanvas: host.makeCanvas });
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
    if (active) host.frame(tick); else running = false;
  };
  host.frame(tick);
}

function onEvent(name, payload) {
  if (name === 'board' || name === 'built' || name === 'dealt') {
    syncView();
    paint();
    pump();
    saveUserData();
  }
  if (name === 'needTool') {
    requestToolAd(payload.tool);
  }
  if (name === 'won') {
    stopClock();
    wonScore.value = game.state.score;
    wonCombo.value = game.state.combo;
    saveUserData();
    openModal('won');
  }
  if (name === 'lost') {
    stopClock();
    lostReason.value = (payload && payload.desc) || (game.state.slots.length >= 7 ? '卡槽已满 7 张未能消除' : '本局时间已用尽');
    openModal('lost');
  }
}

function startClock() {
  stopClock();
  clockTimer = setInterval(() => {
    if (paused || curModal.value) return;
    if (!game.tick()) stopClock();
    view.remain = game.state.remain;
    view.combo = game.state.combo;
  }, 1000);
}
function stopClock() { clearInterval(clockTimer); clockTimer = null; }

function openModal(name) {
  curModal.value = name;
  if (name === 'pause' || name === 'settings' || name === 'admin' || name === 'ad' || name === 'won' || name === 'lost' || name === 'quit') {
    paused = true;
  }
}

function closeModal() {
  curModal.value = null;
  paused = false;
}

function toggleSound() {
  prefs.sound = !prefs.sound;
  saveUserData();
  uni.showToast({ title: prefs.sound ? '音效已开启' : '音效已静音', icon: 'none' });
}

function toggleHaptic() {
  prefs.haptic = !prefs.haptic;
  saveUserData();
  uni.showToast({ title: prefs.haptic ? '震动已开启' : '震动已关闭', icon: 'none' });
}

function onTouch(e) {
  const p = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!p || !renderer || !metrics || game.state.dealing || paused || curModal.value) return;
  let x = p.x, y = p.y;
  if (x === undefined) { x = p.clientX ?? p.pageX; y = p.clientY ?? p.pageY; }
  const hit = renderer.pick(ordered(), metrics, x, y);
  if (hit) game.pick(hit.id);
}

function onTool(name) {
  if (paused || curModal.value) return;
  if ((view.tools[name] || 0) <= 0 && !backendConfig.gmMode) {
    requestToolAd(name);
    return;
  }
  game.useTool(name);
  syncView();
}

function requestToolAd(name) {
  pendingTool.value = name;
  adPlaying.value = false;
  openModal('ad');
}

function startAd() {
  adPlaying.value = true;
  adCountdown.value = 3;
  const timer = setInterval(() => {
    adCountdown.value--;
    if (adCountdown.value <= 0) {
      clearInterval(timer);
      adPlaying.value = false;
      const count = backendConfig.adRewardCount || 1;
      view.tools[pendingTool.value] = (view.tools[pendingTool.value] || 0) + count;
      if (game && game.state && game.state.tools) {
        game.state.tools[pendingTool.value] = view.tools[pendingTool.value];
      }
      saveUserData();
      closeModal();
      uni.showToast({ title: `领取成功！【${pendingToolLabel.value}】+${count}`, icon: 'success' });
    }
  }, 1000);
}

function onRevive() {
  adPlaying.value = true;
  adCountdown.value = 3;
  const timer = setInterval(() => {
    adCountdown.value--;
    if (adCountdown.value <= 0) {
      clearInterval(timer);
      adPlaying.value = false;
      closeModal();
      if (game) {
        game.revive();
        syncView();
        paint();
        startClock();
      }
      uni.showToast({ title: '复活成功！已清空3张卡槽牌', icon: 'success' });
    }
  }, 1000);
}

function nextLevel() {
  closeModal();
  start(view.level + 1);
}

function restartLevel() {
  closeModal();
  start(view.level);
}

function onQuitConfirm() {
  closeModal();
  start(1);
}

function clearStorageAndReset() {
  try {
    uni.removeStorageSync('mahjong_user_data');
    view.tools = { clear: 1, shuffle: 1, undo: 1, magnet: 1 };
    view.score = 0;
    uni.showToast({ title: '已清除缓存，重新开始', icon: 'none' });
    closeModal();
    start(1);
  } catch (e) {}
}

function adminSetLevel(lvl) {
  closeModal();
  start(lvl);
  uni.showToast({ title: `已跳转到第 ${lvl} 关`, icon: 'none' });
}

function adminAddTools() {
  for (const k of ['clear', 'shuffle', 'undo', 'magnet']) {
    view.tools[k] = (view.tools[k] || 0) + 5;
    if (game?.state?.tools) game.state.tools[k] = view.tools[k];
  }
  saveUserData();
  uni.showToast({ title: '所有道具已 +5', icon: 'success' });
}

function adminAddTime() {
  if (game?.state) {
    game.state.remain += 120;
    view.remain = game.state.remain;
    uni.showToast({ title: '倒计时 +120 秒', icon: 'none' });
  }
}

function adminToggleGm() {
  backendConfig.gmMode = !backendConfig.gmMode;
  if (game?.state) game.state.config = backendConfig;
  uni.showToast({ title: backendConfig.gmMode ? '已开启无限道具' : '已关闭无限道具', icon: 'none' });
}

function adminInstantWin() {
  closeModal();
  if (game?.state?.tiles) {
    game.state.tiles.forEach(t => { t.removed = true; });
    game.state.score += 500;
    onEvent('won');
  }
}

function adminSyncBackend() {
  uni.showLoading({ title: '同步中...' });
  uni.request({
    url: 'http://localhost:3000/api/config',
    timeout: 3000,
    success(res) {
      uni.hideLoading();
      if (res.data?.code === 0 && res.data.data) {
        Object.assign(backendConfig, res.data.data);
        uni.setStorageSync('mahjong_config', res.data.data);
        uni.showToast({ title: '后台配置同步成功！', icon: 'success' });
      } else {
        uni.showToast({ title: '获取配置失败', icon: 'none' });
      }
    },
    fail() {
      uni.hideLoading();
      uni.showToast({ title: '连接后台服务失败，请确保后台运行中', icon: 'none' });
    }
  });
}

function start(level) {
  game.build(level, boardSize.width / boardSize.height, backendConfig);
  metrics = boardMetrics(game.state.tiles, level, boardSize.width, boardSize.height);
  // Restore user tools if stored
  if (view.tools) {
    Object.assign(game.state.tools, view.tools);
  }
  syncView();
  paint();
  setTimeout(startClock, 3500);
}

onMounted(async () => {
  await loadRemoteConfig();
  loadUserData();

  const found = await resolveCanvas('#board', instance);
  if (!found) return;
  const { canvas, width, height } = found;
  const dpr = uni.getWindowInfo ? uni.getWindowInfo().pixelRatio : uni.getSystemInfoSync().pixelRatio;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  host = canvasHost(canvas);
  const unit = host.measureUnitScale();
  if (Math.abs(dpr / unit - 1) > 0.01) host.ctx.scale(dpr / unit, dpr / unit);
  boardSize = { width, height };

  game = createGame({
    motion: TileMotion,
    emit: createEmitter({
      sound: () => prefs.sound,
      haptic: () => prefs.haptic,
      onEvent
    })
  });

  const atlas = await host.loadImage('/static/tile-poses/shells.png');
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

/* Box Sizing and Global Reset */
view, text, image, canvas { box-sizing: border-box; }
.t-b { font-weight: 700; }

/* Page Root */
.game { position: relative; display: flex; flex-direction: column; width: 100%; height: 100vh; overflow: hidden; }

/* Meadow Header Background (Hills, flowers, blue checkered ribbon) */
.g-meadow { position: absolute; left: 0; top: 0; z-index: 0; width: 100%; height: 110px; }
.game > view { position: relative; z-index: 1; }

/* Custom Translucent Pause Button matching screenshot */
.g-pause-circle {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(45, 110, 80, 0.45);
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
.g-pause-bars { display: flex; gap: 4px; }
.g-pause-bars .bar { width: 3px; height: 14px; background: #ffffff; border-radius: 2px; }

.g-score { margin-top: 4px; display: flex; align-items: center; gap: 3px; }
.score-val { color: #ffffff; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }

/* Right Timer Pill matching screenshot */
.g-timer-row { position: absolute; right: 12px; top: 114px; z-index: 10; display: flex; justify-content: flex-end; }
.g-timer {
  background: #224847; border-radius: 14px; height: 26px;
  padding: 0 10px 0 6px; display: flex; align-items: center; gap: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);
}
.g-timer-icon { width: 18px; height: 18px; display: flex; align-items: center; }
.g-timer-icon .t-icon { width: 16px; height: 16px; }
.timer-text { color: #ffffff; font-size: 14px; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }
.g-timer.urgent { background: #8e2b24; animation: blink 1s infinite; }

/* Board */
.board { position: absolute; left: 10px; top: 4px; width: calc(100% - 20px); height: calc(100% - 10px); }

/* Slots Tray */
.g-slot { height: calc((100vw - 70px) / 7 * 1.3636); }
.g-slot-face { position: absolute; inset: 7%; width: 86%; height: 86%; }

/* ==================== Bottom 4 Tool Buttons ==================== */
.g-dock {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: flex-start !important;
  gap: 8px !important;
  padding: 8px 10px max(10px, env(safe-area-inset-bottom)) !important;
  margin-top: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
}

.g-prop-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.g-prop-btn {
  width: 100%;
  height: 42px;
  border-radius: 11px;
  background: linear-gradient(180deg, #58c4aa 0%, #45ab93 100%);
  border-bottom: 3.5px solid #2e7d6b;
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  position: relative;
  transition: transform 0.1s, border-bottom-width 0.1s;
}

.g-prop-btn:active {
  transform: translateY(2px);
  border-bottom-width: 1.5px;
}

.g-prop-art {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.g-prop-name {
  color: #ffffff;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(15, 50, 40, 0.5);
}

/* Green plus badge on top-right of button */
.g-prop-plus {
  position: absolute;
  right: -5px;
  top: -5px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #4ecb45;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.g-plus-icon {
  color: #ffffff;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
  margin-top: -1px;
}

/* Dark Pill Badge centered below button with bright yellow number */
.g-prop-pill {
  margin-top: 4px;
  width: 44px;
  height: 20px;
  border-radius: 10px;
  background: #11352e;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.25);
}

.g-prop-num {
  color: #ffe936;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

/* ==================== Modals Styling ==================== */
.modal-mask {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal-box {
  width: min(380px, 92vw); max-height: 85vh;
  background: #fff8e8; border: 4px solid #c97b20; border-radius: 24px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  background: linear-gradient(180deg, #ffb347, #f38f18);
  padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 2px solid #b86910;
}
.modal-title { color: #ffffff; font-size: 18px; font-weight: 900; text-shadow: 0 1px 2px rgba(100,40,0,0.5); }
.modal-close {
  width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.2);
  color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px;
}
.modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.scroll-body { overflow-y: auto; max-height: 60vh; }

.modal-stat-card {
  background: #fdf2d0; border: 1.5px solid #ecd395; border-radius: 12px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.modal-stat-line { color: #5a2e0a; font-size: 14px; font-weight: 600; }

/* Modal Buttons */
.m-btn {
  width: 100%; height: 44px; border-radius: 12px; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: none;
  box-shadow: 0 3px 6px rgba(0,0,0,0.18);
}
.m-btn-primary { background: linear-gradient(180deg, #51cf66, #37b24d); color: #fff; }
.m-btn-warning { background: linear-gradient(180deg, #fcc419, #f59f00); color: #5a2a00; }
.m-btn-danger { background: linear-gradient(180deg, #ff6b6b, #e03131); color: #fff; }
.m-btn-outline { background: #fff; color: #495057; border: 1.5px solid #ced4da; }
.m-btn-admin { background: linear-gradient(180deg, #845ef7, #5f3dc4); color: #fff; }
.m-btn-revive { background: linear-gradient(180deg, #ff922b, #d9480f); color: #fff; font-size: 16px; }

/* Rules */
.rule-item { background: #fffdf5; border: 1px solid #ebd9b0; border-radius: 10px; padding: 10px 12px; }
.rule-title { font-size: 14px; font-weight: 800; color: #78350f; display: block; margin-bottom: 4px; }
.rule-desc { font-size: 12px; color: #92400e; line-height: 1.5; }

/* Settings */
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: #fffdf5; border: 1px solid #edd9b4; border-radius: 12px;
}
.setting-lbl { font-size: 14px; font-weight: 700; color: #5a2e0a; }
.setting-toggle {
  width: 44px; height: 24px; border-radius: 12px; background: #ced4da;
  position: relative; transition: background 0.2s; padding: 2px;
}
.setting-toggle.on { background: #40c057; }
.toggle-dot {
  width: 20px; height: 20px; border-radius: 50%; background: #fff;
  transition: transform 0.2s;
}
.setting-toggle.on .toggle-dot { transform: translateX(20px); }

/* Admin */
.admin-tip { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.admin-sec { background: #fdf2d0; border: 1px solid #ebcf91; border-radius: 12px; padding: 12px; }
.admin-sec-title { font-size: 13px; font-weight: 800; color: #633306; display: block; margin-bottom: 8px; }
.admin-levels-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.admin-lvl-btn {
  height: 32px; border-radius: 6px; background: #fff; border: 1px solid #dcd1be;
  font-size: 12px; font-weight: 700; color: #4b3820; display: flex; align-items: center; justify-content: center;
}
.admin-lvl-btn.active { background: #10b981; color: #fff; border-color: #059669; }
.admin-actions-row { display: flex; gap: 8px; }
.m-btn-mini {
  flex: 1; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 700;
  background: #fff; border: 1px solid #c8bba8; color: #374151; display: flex; align-items: center; justify-content: center;
}
.m-btn-mini.btn-on { background: #40c057; color: #fff; border-color: #2b8a3e; }
.m-btn-mini.btn-win { background: #f59f00; color: #fff; border-color: #d97706; }
.admin-api-hint { font-size: 11px; color: #78716c; margin-top: 6px; display: block; text-align: center; }

/* Ad Screen */
.ad-prop-icon { width: 56px; height: 56px; margin: 0 auto 8px; display: block; }
.ad-tip-title { font-size: 16px; font-weight: 800; color: #78350f; text-align: center; display: block; }
.ad-tip-desc { font-size: 13px; color: #92400e; text-align: center; margin: 6px 0 14px; line-height: 1.4; display: block; }
.ad-player-box { padding: 10px 0; }
.ad-player-screen {
  height: 160px; border-radius: 12px; background: linear-gradient(135deg, #1e1b4b, #312e81);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #fff;
}
.ad-sponsor { font-size: 13px; opacity: 0.75; }
.ad-countdown { font-size: 22px; font-weight: 900; color: #fde047; }
.ad-progress { width: 75%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; }
.ad-progress-bar { height: 100%; background: #4ade80; transition: width 0.3s; }
.ad-playing-text { font-size: 12px; color: #6b7280; text-align: center; margin-top: 10px; display: block; }

/* Won & Lost */
.won-box, .lost-box { text-align: center; padding: 24px 18px; }
.won-stars { font-size: 32px; margin-bottom: 4px; }
.won-title { font-size: 22px; font-weight: 900; color: #15803d; display: block; margin-bottom: 12px; }
.won-card { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
.won-stat { font-size: 15px; color: #166534; display: block; margin: 4px 0; }

.lost-icon { font-size: 40px; margin-bottom: 4px; }
.lost-title { font-size: 22px; font-weight: 900; color: #b91c1c; display: block; margin-bottom: 6px; }
.lost-reason { font-size: 13px; color: #7f1d1d; display: block; margin-bottom: 16px; }
.lost-actions { display: flex; flex-direction: column; gap: 10px; }

.quit-text { font-size: 14px; color: #4b5563; text-align: center; line-height: 1.5; margin: 10px 0 16px; display: block; }
</style>
"""

target = 'c:/mydev/majiang/majiang-mp/src/pages/game/game.vue'
with open(target, 'w', encoding='utf-8') as f:
    f.write(vue_content)
print(f'Successfully updated {target}, size = {len(vue_content)} bytes')

