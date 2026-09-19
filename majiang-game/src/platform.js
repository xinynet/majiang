/* game-core 事件的宿主侧实现（小游戏版）。
 *
 * 小程序版这个文件叫 majiang-mp/src/game/platform.js，用的是 uni.*；小游戏侧
 * 一一换成 wx.*，另有两处必须重写：
 *
 *   - `uni.showToast` 在小游戏里没有对应 API（wx.showToast 是小程序的），
 *     所以 toast 改成往画布上自己画一条，由 app.js 的帧循环消费（见 toastLayer）。
 *   - `uni.createSelectorQuery` / `resolveCanvas` 整段不需要了：小游戏没有页面，
 *     画布是 `wx.createCanvas()` 直接给的，尺寸就是屏幕尺寸，也不存在
 *     「布局未稳定导致量出错误尺寸」的问题，那套重试逻辑一并删掉。
 */

/* 帧回调。模块里**不能**直接写裸的 `requestAnimationFrame(cb)`：
 * 小游戏运行时把模块包在一个函数里执行，那个作用域里的 `requestAnimationFrame`
 * 是 undefined（真机/开发者工具实测 `TypeError: requestAnimationFrame is not a function`，
 * 而浏览器预览里它是真的，所以预览永远发现不了）。
 * 要从全局对象上取——小游戏是 `GameGlobal`，浏览器预览是 `globalThis`。
 * 两个都没有时退到 setTimeout，16ms ≈ 60fps：宁可掉帧，也不能整个循环起不来。
 * 这是 `screen` 撞名那件事的同一类问题，见 src/screen.js 的文件头。 */
const GLOBAL = (typeof GameGlobal !== 'undefined' && GameGlobal)
  || (typeof globalThis !== 'undefined' && globalThis)
  || {};

function raf(cb) {
  const fn = GLOBAL.requestAnimationFrame;
  if (typeof fn === 'function') return fn.call(GLOBAL, cb);
  return setTimeout(() => cb(Date.now()), 16);
}

const players = new Map();

function playTone(freq) {
  const name = 't' + freq;
  try {
    let audio = players.get(name);
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = `static/sfx/${name}.wav`;
      players.set(name, audio);
    }
    audio.stop();
    audio.play();
  } catch (e) { /* 少一个音效绝不能打断对局 */ }
}

function vibrate() {
  try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
}

/* 自绘 toast。小游戏没有系统 toast，这里只记一条待显示的消息，
 * 真正的绘制在 ui.js 的 drawToast 里，由每帧最后叠上去。 */
const toastLayer = { text: '', until: 0 };

function toast(title, duration = 1500) {
  if (!title) return;
  toastLayer.text = String(title);
  toastLayer.until = Date.now() + duration;
}

/* game-core 只管 emit，这里把事件翻译成平台效果。调用方仍然能拿到事件，
 * 以便更新自己的视图状态。 */
function createEmitter({ sound = true, haptic = true, onEvent = () => {} } = {}) {
  return (name, payload) => {
    if (name === 'sound' && sound) playTone(payload);
    else if (name === 'haptic' && haptic) vibrate();
    else if (name === 'toast') toast(payload);
    onEvent(name, payload);
  };
}

/* 渲染器只要三样东西：一个 2d ctx、加载图片的办法、造离屏画布的办法。
 * 小游戏这三样都在 wx 全局上，没有浏览器/小程序的分支问题。 */
function canvasHost(canvas) {
  return {
    ctx: canvas.getContext('2d'),
    loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = wx.createImage();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('图片加载失败 ' + src));
        img.src = src;
      });
    },
    makeCanvas(w, h) {
      const c = wx.createCanvas();   // 非首次调用返回的就是离屏画布
      c.width = w;
      c.height = h;
      return c;
    },
    frame(cb) {
      return raf(cb);
    },

    /* 一个绘制单位占几个物理像素。
     *
     * 小程序侧这里要实测，因为 uni 的 H5 画布已经预乘过 dpr 而微信 2d 画布没有。
     * 小游戏只有一种约定：`wx.createCanvas()` 给的主屏画布，
     * 1 单位 = 1 物理像素，宽高就是 windowWidth*dpr。所以恒为 1，
     * 缩放由 app.js 统一 setTransform(dpr) 来做。 */
    measureUnitScale() {
      return 1;
    },
  };
}

module.exports = { playTone, vibrate, toast, createEmitter, canvasHost, toastLayer, raf };
