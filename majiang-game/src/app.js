/* 小游戏外壳：帧循环、场景切换、触摸派发。
 *
 * 小程序版这些事分别由 pages.json 的路由、Vue 的生命周期和 WXML 的 @tap 承担；
 * 小游戏一样都没有，只有一块 wx.createCanvas() 给的画布，所以全部自己来。
 * 画布本身与坐标系约定在 screen.js。
 */
const { viewport } = require('./screen.js');
const { toastLayer, raf } = require('./platform.js');
const { drawToast } = require('./ui.js');
const { saveNow } = require('./store.js');

let current = null;
let pending = null;
let lastTime = 0;
let running = false;

/** 逻辑像素的触摸点 → 物理像素。 */
function toLocal(touch) {
  return { x: touch.clientX * viewport.dpr, y: touch.clientY * viewport.dpr };
}

/* 场景接口（全部可选）：
 *   enter(params) / exit()            进出场
 *   update(dt, now)                   dt 单位秒
 *   draw(ctx)                         画一帧，坐标系是物理像素
 *   onTouchStart(p) / onTouchMove(p) / onTouchEnd(p)
 *
 * 切场景不是立刻生效的，而是记到 pending、等这一帧画完再换。
 * 否则在 onTouchEnd 里切场景会让当前帧画到一半的场景被换掉，出现闪一下的黑屏。 */
function replaceScene(scene, params) {
  pending = { scene, params };
}

function applyPending() {
  if (!pending) return;
  const { scene, params } = pending;
  pending = null;
  if (current && current.exit) {
    try { current.exit(); } catch (e) { console.error('[scene.exit]', e); }
  }
  current = scene;
  if (current && current.enter) {
    try { current.enter(params || {}); } catch (e) { console.error('[scene.enter]', e); }
  }
}

function currentScene() { return current; }

function dispatch(name, e) {
  const t = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]);
  if (!t || !current || !current[name]) return;
  try { current[name](toLocal(t)); } catch (err) { console.error('[' + name + ']', err); }
}

function bindInput() {
  wx.onTouchStart((e) => dispatch('onTouchStart', e));
  wx.onTouchMove((e) => dispatch('onTouchMove', e));
  wx.onTouchEnd((e) => dispatch('onTouchEnd', e));
  wx.onTouchCancel((e) => dispatch('onTouchEnd', e));
  // 切后台立刻落盘：合并窗口里的那点改动不能指望回前台还在
  if (wx.onHide) wx.onHide(() => saveNow());
}

function frame(now) {
  raf(frame);
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;

  applyPending();
  if (!current) return;

  const ctx = viewport.ctx;
  if (current.update) {
    try { current.update(dt, now); } catch (e) { console.error('[scene.update]', e); }
  }
  try {
    current.draw(ctx);
  } catch (e) {
    console.error('[scene.draw]', e);
  }
  // toast 永远画在最上层，跨场景存活
  if (toastLayer.until > Date.now()) drawToast(ctx, toastLayer.text);
}

function startLoop() {
  if (running) return;
  running = true;
  bindInput();
  raf(frame);
}

module.exports = { replaceScene, currentScene, startLoop };
