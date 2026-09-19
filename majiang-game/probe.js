/* 小游戏连通性探针。
 *
 * 目的有两个：
 *   1. 证明这个项目能以 compileType: "game" 在微信开发者工具里跑起来；
 *   2. 打通一条「小游戏自检」的通道——miniprogram-automator 只支持小程序
 *      （连得上端口，但任何 RPC 都会 timeout，因为小游戏没有页面/组件树），
 *      所以改成让游戏自己把画面和运行信息写到 USER_DATA_PATH，
 *      外面的 Node 脚本再去磁盘上读。
 */
/* 变量名别叫 canvas：小游戏运行时的模块作用域里可能已有同名全局，
 * 顶层重复声明是加载期 SyntaxError（screen 就是这么把整个游戏干掉过一次的，
 * 见 src/screen.js 的文件头与 mp-tools/minigame-lint.cjs）。 */
const probeCanvas = wx.createCanvas();
const ctx = probeCanvas.getContext('2d');
const info = wx.getWindowInfo();

ctx.fillStyle = '#55a297';
ctx.fillRect(0, 0, probeCanvas.width, probeCanvas.height);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 20px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('小游戏运行时 OK', probeCanvas.width / 2, probeCanvas.height / 2 - 20);
ctx.font = '14px sans-serif';
ctx.fillText(`canvas ${probeCanvas.width}x${probeCanvas.height}  dpr ${info.pixelRatio}`,
  probeCanvas.width / 2, probeCanvas.height / 2 + 12);

const report = {
  ok: true,
  at: new Date().toISOString(),
  canvas: { width: probeCanvas.width, height: probeCanvas.height },
  window: { width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio },
  sdk: wx.getAppBaseInfo ? wx.getAppBaseInfo().SDKVersion : 'unknown',
  userDataPath: wx.env.USER_DATA_PATH
};
console.log('[probe]', JSON.stringify(report));

/* 开发者工具会把 storage 落到 User Data/<hash>/WeappLocalData/localstorage_*.json，
 * 这是外部 Node 脚本唯一能稳定读到的通道（小游戏没有页面，automator 驱动不了）。 */
wx.setStorageSync('__probe__', report);

const fsm = wx.getFileSystemManager();
fsm.writeFileSync(`${wx.env.USER_DATA_PATH}/probe.json`, JSON.stringify(report, null, 2), 'utf8');

// 把画面也落盘，外面就能像看截图一样看小游戏渲染结果。
probeCanvas.toTempFilePath({
  success: (res) => {
    fsm.copyFileSync(res.tempFilePath, `${wx.env.USER_DATA_PATH}/probe-shot.png`);
    console.log('[probe] shot saved');
  },
  fail: (e) => console.error('[probe] toTempFilePath failed', e)
});
