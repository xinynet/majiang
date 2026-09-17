---
name: animation-tuning
description: 调整麻将消消乐小程序（majiang-mp）里的动画——发牌动画与洗牌双手、启动页进度动画、棋子在棋桌上的翻转/滚动/掉落动画。改动画速度、时长、幅度、物理手感，或排查「动画不显示」「动画太长太短」时使用。
---

# 麻将消消乐 · 动画调整

面向后续 agent。三套动画各自的文件、参数、改法、约束和验证方式都在这里。
数值请以源码为准，本文件记录的是 2026-09-17 的现状。

## 0. 先读这一节，否则会白改

**源码不是跑起来的东西。** 源码在 `majiang-mp/src/`，微信开发者工具跑的是
`majiang-mp/dist/build/mp-weixin/`。改完源码必须重新编译并**重启**开发者工具，
否则看到的还是旧包（工具的缓存编译非常顽固，`cli open` 和 touch 文件都不可靠）：

```bash
cd c:\mydev\majiang\majiang-mp
npm run build:mp-weixin

CLI="/c/Program Files (x86)/Tencent/微信web开发者工具/cli.bat"
"$CLI" close --project 'C:\mydev\majiang\majiang-mp\dist\build\mp-weixin'
"$CLI" auto  --project 'C:\mydev\majiang\majiang-mp\dist\build\mp-weixin' --auto-port 9420
```

确认新包真的生效：grep 一下 dist 里的产物，例如发牌时长
`grep -o "3300" dist/build/mp-weixin/game/game-core.js`。

**短动画截不到。** automator 每张截图往返约 2 秒（含页面跳转开销接近 3 秒），而发牌只有 3.3 秒，`reLaunch`
之后第一张图落地时动画多半已经结束了。要稳定拍到一个几秒内的动画，唯一可靠的办法是
**临时把时长拉长 → 截图 → 改回原值**（见第 4 节）。不要因为截图里没看见就断定动画没生效。

## 1. 发牌动画

牌全部叠在牌阵中心正上方，按随机顺序错开下落，复用「失去支撑后下坠」那套物理落到各自位置。

| 关注点 | 位置 |
|---|---|
| 时长与高度常量 | `src/game/game-core.js` 第 51–57 行 |
| 发牌本体 `dealIn()` | `src/game/game-core.js` 约第 224–244 行 |
| 延迟推进 `stepMotion()` | `src/game/game-core.js` 约第 205–222 行 |
| 帧循环与计时 `pump()` / `start()` | `src/pages/game/game.vue` |

### 三个参数

```js
const DEAL_STAGGER = 1800, DEAL_DURATION = 3300;  // 毫秒
const DEAL_HEIGHT = 2.2;                          // 起落高度，单位是「层」
```

- `DEAL_STAGGER`：第一张和最后一张牌**开始**下落的时间差。每张牌拿到的延迟是
  `(i / 总数) * DEAL_STAGGER`，`i` 是打乱后的序号。调大 = 一张张慢慢铺；调到 0 = 整片一起砸下来。
- `DEAL_DURATION`：`build()` 的返回值，也是 `state.dealing` 置回 false、棋盘解锁、
  倒计时开始、洗牌双手撤走的时刻。
- `DEAL_HEIGHT`：起点比最高层再高多少。重力是 `9 /s²`（`tile-motion.js` 的 `step()`），
  所以 2.2 层大约落 0.7 秒。调高 = 落得更久、更有坠感。

### 常见需求怎么改

- **整体更快**：一起缩小 `DEAL_STAGGER` 和 `DEAL_DURATION`，`DEAL_HEIGHT` 也要跟着降，
  否则最后一张牌还在空中棋盘就解锁了。
- **一起落而不是依次落**：`DEAL_STAGGER = 0`。
- **完全关掉**：`createGame({ reducedMotion: true })`，此时 `state.motion` 为假，
  `dealIn()` 不执行，`build()` 返回 120ms。

### 硬约束

> `DEAL_DURATION` 必须 ≥ **实测的全部落定时间**，否则最后几张牌还在飞、玩家却已经能点牌了，
> 而且双手会在牌落定前就撤走。
>
> **不要用公式估**。直觉上尾巴由 `DEAL_STAGGER` + 自由落体时间（约 750ms）决定，实际不是：
> 斜靠的牌倒下来的角速度很慢，尾巴是**它们**定的。实测把 `DEAL_STAGGER` 从 600 砍到 350，
> 最慢的一关只从 1.95s 缩到 1.73s。所以每次改这三个常量，都要跑下面的 Node 回归重新量。
>
> 当前实测（1~20 关，1800/3300/2.2）：最慢 3.22s 全部落定，0 张牌落错位置。

`game.vue` 的 `start()` 用 `build()` 的返回值来排倒计时（`setTimeout(startClock, dealMs + 100)`），
**不要在 game.vue 里另写一个魔法数字**——历史上就是这么做的，结果改了一边忘了另一边。

### 1b. 伸进来洗牌的两只手

文件：`src/game/shuffle-hands.js`，素材 `src/static/hands/right-hand-long.png`（右手，1:3，左手是镜像）。

**为什么画在 canvas 里而不是用 `<image>`**：小程序的 `<canvas>` 是原生组件，
不论 z-index 多大都盖在所有 `<view>` 之上。用 `<image>` 做的手会被麻将牌埋掉，
所以手是在 `paint()` 里、牌画完之后画进同一块 canvas 的。

进度就是发牌进度：`progress = (Date.now() - dealStart) / dealLength`，`dealLength` 即 `DEAL_DURATION`。
`progress ≤ 0` 或 `≥ 1` 时不画。

**改洗牌次数 / 手速**：`FRAMES` 是关键帧表，沿用原 H5 版 `shuffleHand` CSS 动画的单位——
`t` 是 0~1 的归一化进度，`x` 是手盒宽度的百分比，`y` 是手盒高度的百分比，`rot` 是度，`alpha` 是透明度。

结构是固定的：**伸手进来 → （内扫 + 外扫）× N → 收手退出**。一对「内扫 + 外扫」＝ 一次洗牌。
当前是 **3 次**（10 帧），在 3300ms 下每次约 860ms。

- **改次数**：整对地加减关键帧，然后把所有 `t` 重新摊匀。
  只加半对、或者只改其中一个 `t`，会让某一次扫得特别快，看上去就少了一次。
- **想整体变快**：改 `DEAL_DURATION` 就行，手会自动跟着压缩（它按归一化进度采样）。
  但每次洗牌短于约 350ms 就糊成一团，玩家会反馈「只洗了一次」——
  要更快就先减次数，别硬压时长。
- 帧间用 `ease = p*p*(3-2*p)` 平滑，对应 CSS 的 ease-in-out。

**改大小和位置**（`drawShuffleHands()` 里的几何，注释里也写了）：

```js
const boxW = Math.min(width * 0.55, 320), boxH = boxW * 1.5; // 手盒：棋盘宽的 55%，最多 320px
const top = height * 1.08 - boxH;                            // 手盒底部探出棋盘 8%
// 旋转轴在 boxH * 0.9 处（手腕），不是盒子中心，所以手是「甩」的
// drawImage 的高度是 boxW * 3（图本身 1:3），所以小臂会伸出盒子、跑到屏幕外
```

**排查手不出现**，按这个顺序看：

1. `handImage` 是异步加载的，失败会静默吞掉（`game.vue` 里 `.catch(() => {})`，
   这是故意的：素材缺失不该拖垮发牌）。
2. `static/hands/` 有没有被打进 dist。
3. 是不是 `state.dealing` 已经 false 了。
4. 是不是截图太慢（见第 0 节）。

临时在 `drawShuffleHands` 开头画一个亮色方块，可以快速区分「函数没被调用」和「图没加载」，
**调完务必删掉**——这种调试块曾经被漏在文件里。

## 2. 启动动画（启动页进度条）

文件：`src/pages/splash/splash.vue`，插画 `src/static/ui/splash_bg.jpg`。
它是 `pages.json` 的第一页，加载完 `reLaunch` 到首页。

| 参数 | 作用 |
|---|---|
| `MIN_SHOW_MS = 1800` | 最短停留。本地素材一眨眼就加载完，没有它进度条会一闪而过 |
| `creep` 定时器：每 `70ms` 加 `4%`，封顶 `90%` | 进度条的「爬行」，让它看起来在真的加载 |
| `PRELOAD` 数组 | 真正预加载的素材；每加载完一个把进度推到 `loaded/total*90` |
| `progress-fill` 的 `transition: width .25s ease-out` | 每一跳的补间 |
| `setTimeout(go, 320)` | 走到 100% 之后再停一下才跳走 |
| `guard = setTimeout(go, MIN_SHOW_MS + 3200)` | 兜底：某个素材卡住也不会永远停在启动页 |

**改总时长**：动 `MIN_SHOW_MS`。想让爬行更顺滑就减小 `creep` 的间隔、同时减小步长
（70ms / 4% 走完 90% 约 1.6 秒，正好和 `MIN_SHOW_MS` 匹配，改一个记得核对另一个）。

### 换启动插画的完整流程

**进度条的位置**是按插画里那颗胶囊的**源图像素**算出来的：

```js
const ART_W = 852, ART_H = 1846;                                // 源插画（启动界面.png）的尺寸
const PILL = { left: 57, right: 795, top: 1667, bottom: 1716 }; // 胶囊在源图里的位置（含描边）
const MIN_BOTTOM_GAP = 16;                                      // 矮屏幕上的保底下边距
```

`placeTrack()` 按 `aspectFill` 的缩放和居中裁切换算成屏幕 px。只有 `PILL` 与 `ART_W/ART_H`
的**比例**有意义，所以导出的 JPG 可以比源图小，但**必须保持同样的长宽比**。

换插画的步骤：

1. 量胶囊。别用肉眼估，扫像素：橙色填充 `r>215 && g>130 && g<205 && b<90`，
   外圈描边是亮青色。`mp-tools/` 里有 sharp，几行就能扫出包围盒。
2. 顺手把描边色和填充色也采出来（当前是描边 `#00e7dc`、轨道 `#041a2c→#07262f`、
   填充 `#f8c41a→#f09a07`），写进 `.progress-track` / `.progress-fill`。
   **实时进度条是盖在画里那根画好的进度条上面的**，颜色不一致就会露出接缝。
3. 导出 `src/static/ui/splash_bg.jpg`，保持源图长宽比，质量 86 左右，控制在 250KB 以内。
4. 更新上面三个常量。

> **长宽比的坑**：当前插画是 852×1846（约 19.5:9），胶囊在 90% 高度处。
> `aspectFill` 在 16:9 的老机型上要裁掉约五分之一的高度，画里那根进度条会被**整根裁到屏幕外**。
> `MIN_BOTTOM_GAP` 就是为此存在：实时进度条会被拉回屏幕底部上方，保证还看得见
> （此时画里那根已经完全看不到了，不会出现两根条）。
> 换一张更「方」的插画（比如 0.56 左右）就不会触发这个夹取。

> **坑**：不要用「绝对定位 + top/left 50% + `transform: translate(-50%,-50%)`」包一层来对齐插画比例。
> 元素查询出来的宽高位置全对，但整页渲染出来是纯白，什么都不画。现在的写法
> （`<image mode="aspectFill">` 铺满 ＋ JS 算 px）是唯一验证过能用的。

## 3. 棋子在棋桌上的翻转 / 滚动 / 掉落动画

这是四层叠出来的，改之前先确认要动的是哪一层。

### (a) 摆上桌时的随机转向（静态，不是动画）

```js
rot:  (rnd()  - .5) * 74,  // ±37°，game-core.js makeLayout()，牌在桌面上的朝向
rot2: (rnd2() - .5) * 14,  // ±7°，build() 里再叠一点抖动，让牌堆更散乱
```

渲染时两者相加，见 `canvas-board.js` 的 `draw()`。命中测试 `pick()` 用同一个角度反算，
两边已经共用 `tileBox()`，**不要再各写一份**。

### (b) 斜靠 / 立起来的牌（lean）

`tile-motion.js` 的 `assignLeaners()`：

- 数量：`clamp(round(牌数 * 0.14), 4, 12)`，即约 14% 的牌会靠在邻居身上。
- 角度：交替取 `±65°` 和 `±35°`，方向朝着支撑它的那张牌。
- 挑选条件：必须找得到一个 z 不低于自己、x 相距 0.3~1、y 相距 <0.55 的邻居当支撑；
  已选中的斜牌之间还要拉开距离（x<0.7 且 y<0.65 视为太近）。

调大 `0.14` = 更多牌立起来，画面更乱也更「3D」。改角度会同时改变遮挡和命中面积
（`pick()` 会按倾角压低命中框的高度，见 3(d) 末尾的说明）。

### (c) 失去支撑后的下坠 + 滑行 + 落地回弹

`tile-motion.js` 的 `step(m, dt)`，这是**唯一**一处物理手感参数，发牌也复用它：

| 数值 | 含义 |
|---|---|
| `dt = min(.025, ...)` | 单步上限，防止掉帧时穿模 |
| `m.velocity -= 9 * dt` | 重力。调大 = 砸得更快更重 |
| `m.angularVelocity += -sign(Δlean) * 95 * max(.25, cos(lean)) * dt` | 倒下的角加速度；`cos` 项让接近水平时转得慢 |
| `slide = 1 - (1-progress)²` | 横向滑行的缓动。牌滑到一半就基本停了，不会一路滑到底 |
| `impactTime` 阶段，时长 `.22s` | 落地回弹：`bounce = sin(phase*π)*(1-phase)`，角度反弹 `4°`，高度弹起 `.045` 层 |
| `targets()` 里 `p.x += dir*.2; p.y += .13` | 每掉一层同时往侧前方滑出的距离；方向取自牌自己的 `rot`，以保证可复现 |

`targets()` 是自底向上多趟传播的：抽掉一张牌会让压在它上面的整摞连锁塌下来。
`settle()`（game-core.js）在每次消牌后调用它，把差异变成新的 `motion`。

### (d) 渲染：牌是怎么「转」起来的

`tile-poses.js` 是 `mp-tools/prep-assets.mjs` **生成**的，不要手改。

- 29 帧 atlas，`ANGLE_MIN = -70`，`ANGLE_STEP = 5` → 只覆盖 **-70°~+70°**。
- `samplePose(lean)` 返回相邻两帧和混合系数；`canvas-board.js` 会**同时插值帧和投影矩阵**，
  少插一个倾斜就会一跳一跳的。
- `LEAN_LIFT = 0.27`：斜牌按 `sin(lean)` 抬起来一点，看起来才是立着的。
- `LAYER_DX = -5, LAYER_DY = -9`：每高一层往左上偏，这就是那个伪 3D。

> **硬约束**：`lean` 超出 ±70° 就没有对应的 atlas 帧了（会被 clamp 住，视觉上卡死）。
> 想要更大的倾角必须重跑 `node mp-tools/prep-assets.mjs` 重新烘一套 pose。

> **性能**：静止的牌会整张（含接触阴影）合成进离屏 canvas 缓存，之后每帧只要一次 `drawImage`；
> **带 `motion` 的牌不吃缓存**，走完整绘制路径。所以同时运动的牌越多越掉帧——
> 发牌时全盘都在动，这也是 `DEAL_STAGGER` 存在的意义之一（错开峰值）。
> 缓存 key 是 `type|帧号|z`，棋盘尺寸变化时整体失效。

**命中框跟着倾角走**：从 atlas 实测，倾斜只压**高度**（0°→70° 是 192→156 单元像素），
**宽度基本不变**。所以 `pick()` 用满宽的 `box.w`，高度按 `1 - 0.19 * (lean/70)²` 压。
曾经按 `cos(lean)` 缩宽度，65° 的斜牌命中框只剩可见面积的 40%，点它两侧会穿透到下面的牌。
改倾角相关的任何东西，记得跑 `mp-tools/verify_tap.js` 复查。

### 纯逻辑回归（不用开发者工具）

物理是确定性的，可以直接在 Node 里跑，不用编译也不用开发者工具。
存成一个 `.mjs`（源码是 ESM，扩展名必须是 .mjs）然后 `node` 它：

```js
import { TileMotion } from 'file:///C:/mydev/majiang/majiang-mp/src/game/tile-motion.js';
import { createGame } from 'file:///C:/mydev/majiang/majiang-mp/src/game/game-core.js';

for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]) {
  const g = createGame({ motion: TileMotion, emit: () => {} });
  const dur = g.build(level, 0.76);
  const goals = new Map(g.state.tiles.map(t => [t.id, { ...t.motion.target }]));
  let t = 0;
  while (g.stepMotion(1 / 60) && t < 20) t += 1 / 60;
  let wrong = 0;
  for (const tile of g.state.tiles) {
    const goal = goals.get(tile.id);
    const p = tile.motion ? tile.motion.current : tile;
    if (Math.abs(p.x - goal.x) > 1e-6 || Math.abs(p.y - goal.y) > 1e-6 || Math.abs(p.z - goal.z) > 1e-6) wrong++;
  }
  console.log(level, g.state.tiles.length + ' tiles', 'settled ' + t.toFixed(2) + 's',
              'budget ' + dur + 'ms', 'misplaced ' + wrong);
  g.destroy();
}
```

**改完 `DEAL_STAGGER` / `DEAL_DURATION` / `DEAL_HEIGHT` 必须跑这一条**：
每一关的落定时间都要 ≤ `DEAL_DURATION`，`misplaced` 必须全是 0。

### 数洗牌次数（也不用开发者工具）

`drawShuffleHands()` 每帧只是往 ctx 上 `translate` 手腕的位置，喂一个假 ctx 把它记下来，
数 y 的极小值就知道到底扫了几次——比盯截图数靠谱得多：

```js
import { drawShuffleHands } from 'file:///C:/mydev/majiang/majiang-mp/src/game/shuffle-hands.js';
const ys = [];
const ctx = { save(){}, restore(){}, rotate(){}, scale(){}, drawImage(){},
              translate(x, y){ if (ys.at(-1) !== y) ys.push(y); },
              set globalAlpha(v){}, get globalAlpha(){ return 1; } };
const track = [];
for (let i = 0; i <= 600; i++) {
  ys.length = 0;
  drawShuffleHands(ctx, { width: 100, height: 300 }, 390, 497, i / 600);
  if (ys.length) track.push({ p: i / 600, y: ys[0] });
}
let n = 0;
for (let i = 1; i < track.length - 1; i++)
  if (track[i].y < track[i - 1].y && track[i].y <= track[i + 1].y) { n++; console.log('第', n, '次 @', track[i].p.toFixed(2)); }
```

当前应当输出 3 次，分别落在 progress 0.20 / 0.46 / 0.72（均匀分布）。
如果次数对但间隔不均匀，说明某一对关键帧的 `t` 没摊匀。

## 4. 验证流程

```bash
# 1. 改源码 → 编译 → 重启开发者工具（第 0 节的命令块）

# 2. 想肉眼看 2 秒内的动画，先临时拉长，重新编译 + 重启，再连拍：
#    发牌：game-core.js  DEAL_STAGGER = 5000, DEAL_DURATION = 12000
cd c:\mydev\majiang && node mp-tools/shot_deal.js     # → devtools_shots/deal_*.png
#    启动页：splash.vue  MIN_SHOW_MS = 15000
cd c:\mydev\majiang && node mp-tools/shot_splash.js   # → devtools_shots/00_splash_*.png

# 3. 确认效果后把常量改回去，重新编译 + 重启，跑全量回归：
cd c:\mydev\majiang && node mp-tools/full_v3.js       # → devtools_shots/*_live.png
```

| 脚本 | 用途 |
|---|---|
| `mp-tools/shot_deal.js` | 等首页起来后 `reLaunch` 到游戏页连拍，专门看发牌和双手 |
| `mp-tools/shot_splash.js` | `reLaunch` 到启动页连拍，看插画和进度条对位 |
| `mp-tools/full_v3.js` | 全量截图（首页 + 各弹窗 + 游戏 + 集卡） |
| `mp-tools/verify_tap.js` | 在棋盘上打一片点，统计有多少点真的消到了牌——改完布局或命中检测跑它 |

> 启动页只停约 2 秒，一张截图要 2 秒，所以**不拉长 `MIN_SHOW_MS` 就只会拍到白屏或首页**。
> 拍到白屏先别急着当成 bug，先确认是不是拍早了。

两个脚本都带连接重试——`cli auto` 返回时模拟器还没开始监听，第一次连必然失败，不用自己掐时间。
`shot_deal.js` 会等 `pages/index/index` 出现再跳转：启动页约 2 秒后会 `reLaunch` 回首页，
跳早了会被它顶掉，截出来的全是首页。

参考目标图在 `miniprogram截图/`，实拍结果在 `devtools_shots/`。
