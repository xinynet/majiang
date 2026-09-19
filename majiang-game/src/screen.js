/* 屏幕与画布。单独成一个模块，是为了断开 app.js ↔ ui.js 的循环依赖：
 * ui.js 的每个尺寸函数都要读屏幕宽高，而 app.js 的帧循环又要调 ui.js 画 toast。
 * CommonJS 的循环 require 会让先被引的一方拿到半成品 exports（`viewport` 是 undefined），
 * 症状是启动就报 "Cannot read properties of undefined"，且只在某个 require 顺序下出现。
 * 把两边都依赖、自己谁也不依赖的这块单拎出来，环就断了。
 *
 * 坐标系约定（改任何绘制代码前先读这段）：
 *
 *   全局统一用**物理像素**作画，不做 ctx.scale(dpr)。
 *   原因是 canvas-board.js 会把每张牌合成到离屏画布上再 blit（settled tile 一帧一次
 *   drawImage），那些离屏画布是按「牌宽 w」这个数字开的。如果 w 是逻辑像素，
 *   dpr=3 的机器上就等于用 1/3 分辨率的位图去铺满屏幕，整盘牌会糊。
 *
 *   代价是不能写死字号。所以 UI 尺寸一律从屏幕宽高按比例算（见 ui.js 的 vw/vh/rem），
 *   本来 canvas UI 就该这么写，反而比写死 px 更适配。
 *
 *   触摸事件给的是逻辑像素，进来统一乘 dpr 转成物理像素（见 app.js 的 toLocal）。
 *
 * 这个对象叫 `viewport` 而不是 `screen`，是被真机/开发者工具教育过的：
 * 小游戏运行时把模块包在一个函数里执行，作用域里**已经有一个 `screen`**
 * （浏览器风格的全局）。模块顶层再写 `const screen = {...}` 就是
 * `SyntaxError: Identifier 'screen' has already been declared`——
 * 而且是**加载期**报错：这个模块根本注册不上，后面所有 `require('./screen.js')`
 * 跟着报 `module 'src/screen.js' is not defined`，整个游戏起不来。
 * 浏览器预览的打包器不注入这个名字，所以预览里一切正常，只有开发者工具里会炸。
 * 同理，模块顶层也别用 `navigator` / `document` / `location` / `performance` 这类名字。
 */

const viewport = {
  canvas: null,
  ctx: null,
  /** 物理像素宽高 —— 所有绘制都在这个坐标系里 */
  W: 0,
  H: 0,
  dpr: 1,
  /** 安全区（刘海/微信胶囊）留白，物理像素 */
  safeTop: 0,
  safeBottom: 0,
};

/** 初始化主画布。只能调一次：第二次 wx.createCanvas() 给的是离屏画布。 */
function initScreen() {
  const canvas = wx.createCanvas();
  const info = wx.getWindowInfo();
  const dpr = info.pixelRatio || 1;
  canvas.width = Math.round(info.windowWidth * dpr);
  canvas.height = Math.round(info.windowHeight * dpr);

  viewport.canvas = canvas;
  viewport.ctx = canvas.getContext('2d');
  viewport.W = canvas.width;
  viewport.H = canvas.height;
  viewport.dpr = dpr;
  /* 顶部要给微信胶囊让位。safeArea 在部分基础库上缺字段，退回状态栏高度，
   * 再兜一个屏高 4% 的下限，免得按钮压在胶囊底下点不着。 */
  const safe = info.safeArea;
  const statusBar = (info.statusBarHeight || 20) * dpr;
  viewport.safeTop = Math.max(statusBar, safe ? safe.top * dpr : 0, viewport.H * 0.04);
  viewport.safeBottom = safe ? Math.max(0, (info.windowHeight - safe.bottom) * dpr) : 0;
  return viewport;
}

module.exports = { viewport, initScreen };
