# 交接说明 — 麻将三消：H5 → uni-app 微信小程序移植

写给接手的 agent。本文档只写事实和已验证的结果；带 ⚠️ 的是我没验证过的假设或已知的不确定项，请自行核实再依赖它。

## 现状一句话

H5 原版（`majiangxiaoxiaole/`）功能完整、已回归测试。小程序移植（`majiang-mp/`）的游戏逻辑、canvas 渲染、HUD/卡槽/道具坞、顶部农场背景、道具图标都已完成并在 H5 构建（`npm run build:h5`）里逐元素数值比对过，和原版一致。**在微信开发者工具真机模拟器里做过一次完整验证**（点击取牌、四个道具、计时器），但最近几轮 UI 改动（农场背景、全彩图标、单层铺牌、滑动物理）**没有在真机模拟器里复验过**，只在 H5 构建里验证过。所有改动都**未提交 git**。

## 目录结构

```
C:/mydev/majiang/                  ← git 仓库根目录（未初始化远程推送限制，本地已有历史提交）
├── majiangxiaoxiaole/              H5 原版游戏（this is the source of truth for game rules & visuals）
│   ├── app.js                      主逻辑 + DOM 渲染器（仍在用，H5 页面本体）
│   ├── game-core.js                ★新增：剥离出的纯逻辑 store，零 DOM 依赖
│   ├── canvas-board.js             ★新增：canvas 渲染器（H5 和小程序共用同一份文件）
│   ├── tile-motion.js              物理引擎（重力/摩擦/翻倒），ESM 导出前是 UMD 写法
│   ├── tile-poses.js               ★自动生成：29 帧姿态矩阵 + 图集几何，勿手改
│   ├── styles-v37~v60.css, styles.css   26 个样式表，按顺序层叠加载
│   ├── sw.js                       Service Worker 预缓存清单
│   ├── assets/tiles-face/          43 张牌面 PNG（34 原有 + 9 张萬字新烘焙）
│   ├── assets/tile-poses/          shells.png 雪碧图 + poses.js 原始数据
│   ├── tools/bake-tiles.py         雪碧图烘焙器（改烘焙参数要同步改 mp-tools/prep-assets.mjs 里的 ATLAS 常量）
│   ├── tools/bake-wan.py           ★新增：萬字牌烘焙器
│   └── tools/test-tile-motion.cjs  物理回归测试，跑得动就跑：`node tools/test-tile-motion.cjs`
│
├── majiang-mp/                     uni-app 工程（Vue3 + Vite），编译到 H5 / 微信小程序
│   ├── src/pages/game/game.vue     ★唯一的游戏页面，canvas + Vue HUD
│   ├── src/game/                   ★同步自 majiangxiaoxiaole 的共享模块（生成的，见下）
│   │   ├── game-core.js, canvas-board.js, tile-poses.js  — 原样复制
│   │   ├── tile-motion.js          — 从 UMD 重写成 `export const TileMotion = ...`
│   │   └── platform.js             手写：小程序/H5 平台适配层（音效、震动、canvas 句柄、坐标系测量）
│   ├── src/styles/game-screen.css  ★自动生成：从 H5 样式表抽取的 90+ 条游戏屏规则
│   ├── src/static/                 ★同步自 mp-tools/static-out：压缩后的图片、音效、图标
│   └── dist/build/{h5,mp-weixin}/  构建产物
│
└── mp-tools/                       ★新增：素材加工 + 代码同步脚本，不参与运行时
    ├── prep-assets.mjs             主脚本：压缩图片、烘焙姿态模块、同步共享 JS 到 majiang-mp
    ├── extract-game-css.mjs        从 H5 样式表抽取游戏屏 CSS，转换成 WXSS 兼容形式
    ├── bake-icons.mjs              烘焙 10 个白色线条图标（暂停/规则/设置/退出/计时器等）
    ├── bake-art.mjs                ★新增：烘焙 4 个全彩道具图标 + 顶部农场插画
    └── static-out/                 上述脚本的输出，会被 prep-assets.mjs 同步进 majiang-mp/src/static
```

## 关键设计决定（后面接手时不要重新发明）

1. **共享代码的唯一来源是 `majiangxiaoxiaole/`**，不是 `majiang-mp/src/game/`。要改游戏逻辑/物理/渲染，改 H5 目录里的文件，然后跑：
   ```bash
   cd mp-tools && node prep-assets.mjs
   ```
   这会把 `game-core.js`、`canvas-board.js`、`tile-poses.js` 原样复制，`tile-motion.js` 会被重写成 ESM（因为 H5 用 `<script>` 标签加载它是全局变量，小程序要 `import`）。**直接改 `majiang-mp/src/game/` 下的文件会在下次跑 prep-assets.mjs 时被覆盖**。

2. **`game.vue` 是手写的，不会被自动覆盖**，改它不需要跑任何脚本，改完直接 `npm run build:h5` 或 `npm run build:mp-weixin`。

3. **画布绘图单位问题**（踩了很久的坑）：微信小程序的 2d canvas 是 1:1（1 单位 = 1 设备像素），uni-app 的 H5 canvas 已经预乘了 dpr 且 `setTransform` 是叠加而非替换。两边约定不一样，所以 `platform.js` 里的 `measureUnitScale()` 会**实际画一条 50 单位的线再读回多少设备像素**来反推比例，而不是假设某个 dpr 换算公式。改这块代码前一定要先理解这个函数在干什么。

4. **牌的尺寸不能跟关卡牌数挂钩**。`game-core.js` 的 `boardMetrics()` 用固定的 `TILES_ACROSS = 7.2`（一排放几张）算牌宽，牌多了靠**重叠变密**（`sx`/`sy` 收窄），不是把牌缩小。`MAX_LAYERS = 2` 决定预留多少边距，改了要保证所有关卡牌宽仍然一致（验证方法见下面"如何验证"）。

5. **`.g-slot` 高度不能用 `aspect-ratio`**，WXSS 不支持，会直接塌成 0。现在用 `calc((100vw - 70px) / 7 * 1.3636)` 手算，如果卡槽栅格的列数/间距/内边距改了，这个公式要跟着改。

6. **WXSS 没有全局默认样式**：没有 `box-sizing: border-box`（H5 全局有），没有 `<b>` 标签默认加粗（小程序里是 `<text class="t-b">`，靠 `.t-b { font-weight: 700 }` 手动补）。`game.vue` 的 `<style>` 顶部已经加了这两条全局规则，**如果新增元素样式跟 H5 原版对不上，先检查是不是撞上这两个默认值缺失的坑**，这个问题出现过不止一次。

## 美术资源状态 ⚠️ 需要你和用户确认

用户给的参考截图（趣味麻将碰）用的是**另一款游戏的美术资源**，我手上没有原始素材文件。以下两处是我**照着截图的风格原创重画的**，不是复刻：

- **顶部农场背景**（`mp-tools/bake-art.mjs` 里的 `meadow` SVG）：深绿灌木丛+小白花+浅绿天空+云朵，纯 SVG 参数化生成。
- **四个道具全彩图标**（同文件 `TOOLS` 对象）：灯泡/卡牌+闪电/弯箭头/马蹄磁铁。

如果用户后续提供了原始素材文件（PNG/SVG），直接替换 `mp-tools/static-out/bg/meadow.png` 和 `static-out/icons/tool-*.png`，再跑一次 `prep-assets.mjs` 同步，不需要碰生成脚本。

## 已知未完成 / 需要下一步验证的

1. **最近几轮 UI 改动没有在微信开发者工具真机模拟器里复验**（农场背景、全彩图标、单层铺牌物理、滑动动画）。只验证过 H5 构建。开发者工具的自动化（`miniprogram-automator` + `cli.bat auto --auto-port 9420`）在这台机器上**很不稳定**，反复出现连接超时、页面上下文损坏（`getPageMetaByWebviewId` 返回 null）。建议**让用户手动打开开发者工具重新导入 `majiang-mp/dist/build/mp-weixin`**，比自动化脚本可靠。测试脚本在 `majiang-mp/test/*.cjs`（`mp-shot.cjs` 截图、`mp-play.cjs` 交互测试、`mp-probe.cjs` 查元素尺寸），能用就用，连不上就让用户手动看。

2. **`game.vue` 里还有一堆没接的 HUD 按钮**：暂停按钮只是切了个内部 `paused` flag 和一个 toast，右上角"规则"/"设置"/"退出"三个圆按钮**完全没绑定点击事件**（H5 原版对应打开规则弹窗/设置弹窗/退出确认）。这些弹窗层（`#pauseSheet`、`#gameSettingsSheet` 等）在 H5 里存在，但小程序端**完全没做**——没有首页/关卡地图/结算弹窗/设置页，只有裸的游戏页面直接进入第 1 关。

3. **本地存档/进度没有接入小程序**。H5 版靠 `localStorage` 存关卡进度、道具次数、每日体力，`platform.js` 目前没有对应的 `uni.getStorageSync` 封装。现在小程序端每次刷新都从第 1 关重新开始，通关后 `onEvent('won')` 只是弹个 `showModal` 然后直接 `start(level+1)`，没有存档。

4. **`useTool` 次数用尽时的"看广告补充"流程没做**。H5 版 `requestToolAd` 会弹广告面板，小程序端 `game-core.js` 的 `emit('needTool', ...)` 事件目前在 `game.vue` 里**根本没有监听处理**——道具用完后点击没有任何反馈。

5. **`assets/tiles/` 目录（34 张旧牌图，约 3.3MB）还没清理**，已被 `assets/tiles-face/` 取代，H5 端 `index.html` 里两处"玩法说明"卡片仍引用旧路径 `assets/tiles/bamboo-1.png` / `bamboo-2.png`（这两处引用是有效的，不要删这两张图，只删其余 32 张未引用的）。

6. **`index.html` 里的玩法说明文字还是旧版"两张配对"规则**，没改成现在的"三张消除"规则（`选择两张图案相同的麻将牌`这句话是错的）。这是 H5 端的遗留问题，跟小程序移植无关，但属于我在清理阶段记录下来没处理的项。

## 如何验证改动没破坏东西

```bash
# 1. 物理引擎回归测试（改 tile-motion.js 后必跑）
cd majiangxiaoxiaole && node tools/test-tile-motion.cjs

# 2. store 与 H5 渲染器的一致性（改 game-core.js 后应该跑，目前没有独立脚本，
#    上一个 agent 是在浏览器 console 里手动对拍的，做法见下）
#    在 H5 页面控制台跑：
#    const core = await import('./game-core.js?v='+Date.now());
#    比较 core.createGame(...).build(level, aspect) 的 state.tiles
#    跟 app.js 里 buildLevel(level) 后的 state.tiles 逐字段是否一致

# 3. 跨关卡牌尺寸一致性检查（改 boardMetrics/TILES_ACROSS 后跑）
cd majiang-mp && node --input-type=module -e "
import {TileMotion} from './src/game/tile-motion.js';
import {createGame, boardMetrics} from './src/game/game-core.js';
const W=355,H=454;
for (const lv of [1,2,3,5,8,12,20]) {
  const g=createGame({motion:TileMotion,reducedMotion:true});
  g.build(lv, W/H);
  const m=boardMetrics(g.state.tiles, lv, W, H);
  console.log('level',lv,'tiles',g.state.tiles.length,'w',m.w.toFixed(2));
  g.destroy();
}
"
# 所有关卡的 w 必须相等，否则牌大小会随关卡变化（用户明确要求过这个）

# 4. 构建
cd majiang-mp
npm run build:h5          # 输出 dist/build/h5，可用 python -m http.server 起个静态服务器看
npm run build:mp-weixin   # 输出 dist/build/mp-weixin，需要微信开发者工具打开验证

# 5. H5 视觉/交互验证（推荐用浏览器工具截图 + getBoundingClientRect 数值比对，
#    不要只靠肉眼看截图——这个项目里好几个真实 bug 都是肉眼看着差不多、量出来才发现差 4px/2 倍）
```

## 素材加工管线的执行顺序

如果要从头重新生成所有派生资源，顺序是：

```bash
cd mp-tools
node bake-icons.mjs        # H5 index.html 里的白色线条图标 → PNG（暂停/规则/设置/退出/计时器）
node bake-art.mjs          # 原创全彩道具图标 + 农场背景
node extract-game-css.mjs  # 从 H5 样式表抽取游戏屏 CSS → majiang-mp/src/styles/game-screen.css
node prep-assets.mjs       # 压缩图片、烘焙 tile-poses.js、同步共享 JS 和所有静态资源到 majiang-mp
```

`prep-assets.mjs` 依赖 `static-out/b64/*.txt`（背景图/雪碧图的 base64），这些是它自己生成的，`extract-game-css.mjs` 也依赖同一批 base64 文件来内联 CSS 背景图，**顺序错了会报文件不存在或用到过期的 base64**——保险起见按上面的顺序完整跑一遍。

## 提交状态

**全部改动未提交**（`git status` 显示 43 处改动/新增文件，`majiang-mp/` 和 `mp-tools/` 整个是 untracked）。用户明确说过"暂不提交github"。接手前跟用户确认是否要开始提交。
