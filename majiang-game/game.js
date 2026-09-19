/* 趣味麻将碰 —— 微信小游戏入口。
 *
 * 小程序侧的入口是 app.json 列出页面、框架按路由建页面；小游戏没有这一层，
 * 从这里开始一切都要自己接：拿画布、起帧循环、决定第一个场景。
 *
 * 场景之间是互相引用的（首页 → 牌桌 → 回首页），ESM 里直接循环 import 会拿到
 * 未初始化的绑定，所以统一传「工厂函数」而不是场景实例——谁要跳哪儿，
 * 现场造一个新的场景对象，状态也就天然是干净的。
 *
 * 旧的连通性探针挪到了 probe.js（把本文件的 import 换成它即可单独跑），
 * 它当初是为了「游戏自己写盘、外部 Node 读盘」那套验收；现在预览走
 * mp-tools/minigame-mcp.cjs（浏览器预览 + 截图 + 日志），探针只留作兜底。
 */
const { initScreen } = require('./src/screen.js');
const { startLoop, replaceScene } = require('./src/app.js');
const { createSplashScene } = require('./src/scenes/splash.js');
const { createHomeScene } = require('./src/scenes/home.js');
const { createBoardScene } = require('./src/scenes/board.js');
const { createCardsScene } = require('./src/scenes/cards.js');
const ads = require('./src/ads.js');

const makeHome = (modal) => createHomeScene(makeBoard, makeCards, modal);
const makeBoard = (modal) => createBoardScene(makeHome, modal);
const makeCards = (modal) => createCardsScene(makeHome, modal);

/* 调试入口：改成 'home' / 'board' / 'cards' 可跳过前面的场景直接进那一屏；
 * 'home#lucky' 这种写法还会顺手把那个弹窗打开（名字见 modals.js 的 active 注释）
 * ——canvas 上的弹窗没法从外部点开，验收截图只能这么进。
 * 小游戏没有地址栏也没有页面路由，不这么做调某一屏就得每次手点进去；
 * 提交前必须保持空字符串。 */
const DEBUG_SCENE = '';

const [debugScene, debugModal] = DEBUG_SCENE.split('#');
const FIRST_SCENE = {
  home: () => makeHome(debugModal),
  board: () => makeBoard(debugModal),
  cards: () => makeCards(debugModal),
}[debugScene] || (() => createSplashScene(() => makeHome()));

initScreen();

/* 广告投放配置来自运营后台（server/ 的 /api/ads），启动时拉一次。
 * 不 await：拉取期间先用上次缓存或兜底默认值，别让首屏等网络。 */
ads.init();

/* 未捕获异常直接打进日志。小游戏没有页面，白屏的时候除了日志没有别的线索。 */
if (wx.onError) wx.onError((e) => console.error('[unhandled]', (e && e.message) || e, (e && e.stack) || ''));

replaceScene(FIRST_SCENE());
startLoop();
