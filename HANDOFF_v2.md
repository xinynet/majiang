# 麻将消消乐 小程序开发交接文档 v2

## 1. 项目概况

**项目路径**：c:\mydev\majiang\majiang-mp
**框架**：uni-app + Vue 3 (script setup)
**编译输出**：c:\mydev\majiang\majiang-mp\dist\build\mp-weixin
**微信开发者工具**：已导入 dist 目录

---

## 2. 当前状态

### 已完成

- 启动页（splash）：全屏启动插画 + 进度条，加载完成后跳首页
- 首页背景+按钮：全景背景图 bg_home.jpg，透明热区无重影
- 幸运礼包弹窗：头图+道具格+倒计时+解锁按钮
- 金库银行弹窗：进度条+金猪图+领取奖励按钮
- 每日任务弹窗：每日/长线双Tab，任务列表，进度条，金币袋图标
- 商城弹窗：金币+4种道具，金币购买+免费看广告
- 游戏对局页：canvas 画牌、发牌动画、道具栏、暂停/通关/失败弹窗
- 集卡中心页：转盘区+9套卡片网格+集卡进度
- 全部 10 张截图已实拍验证，无空白页

### 本轮修复（重要）

1. **新增启动界面** `src/pages/splash/splash.vue`，已注册为 pages.json 第一页
2. **修复发牌动画**：之前 build() 只是空等 3.4 秒，牌一开始就在终点位置，完全没有动画
3. **修复暂停弹窗被麻将牌盖住**：canvas 是原生组件，z-index 对它无效
4. **修复暂停弹窗点"继续游戏"关不掉**：onPause 原本是 toggle，会被冒泡二次触发

---

## 3. 开发环境

### 微信开发者工具

- 安装路径：C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
- Automator 端口：9420 (ws://127.0.0.1:9420)

### ⚠️ 开发者工具会跑旧代码（必读，否则白白排查几小时）

`npm run build` 之后，开发者工具**经常继续运行缓存的旧包**，页面数据和 WXML 都还是旧的。
判断方法：用 automator 读 `page.data()`，字段绑定名（a/b/c/j/k…）跟 dist 里的 .wxml 对不上就是旧包。

**可靠的重新编译方式**（每次改完代码都这么做）：

```
cli.bat close --project C:\mydev\majiang\majiang-mp\dist\build\mp-weixin
（等 4 秒）
cli.bat auto --project C:\mydev\majiang\majiang-mp\dist\build\mp-weixin --auto-port 9420
（等 28 秒）
```

`touch` dist 里的文件有时也能触发热重载，但不稳定；`cli open` 不会强制重编译。

### 截图工具

- 全量截图：`cd c:\mydev\majiang && node mp-tools/full_v3.js`（先按上面重启开发者工具）
- 发牌连拍：`node mp-tools/shot_deal.js`（专看发牌和洗牌双手，用法见动画 skill）
- 输出目录：c:\mydev\majiang\devtools_shots\
- 旧的 full_v2.js 已失效，见下条
- 两个脚本都自带连接重试：`cli auto` 返回时模拟器还没监听，第一次连必然失败，不用自己掐时间
- **automator 每张截图往返约 2 秒**，所以 2 秒内的动画根本截不到；要看就得先把时长临时拉长

### ⚠️ callMethod 已不可用

`page.callMethod('openLuckyBag')` 这类调用现在全部报 `is not a function` —— `<script setup>`
里的函数没有暴露成页面方法。**改为点真实热区**（full_v3.js 就是这么做的）：

| 弹窗 | 打开选择器 | 关闭选择器 |
|------|-----------|-----------|
| 幸运礼包 | `.hotspot-lucky-gift` | `.modal-close-circle` |
| 金库银行 | `.hotspot-piggy-bank` | `.modal-close-btn-ribbon` |
| 每日任务 | `.hotspot-daily-task` | `.modal-close-task` |
| 商城 | `.hotspot-shop` | `.modal-close-task` |
| 道具补给 | 先点 `.tool-capsule` 把道具用光，再点 `.tool-add-plus` | `.refill-close-btn` |
| 暂停 | `.round-pause-btn` | `.primary-gradient` |

### 参考截图（目标对齐）

位于 c:\mydev\majiang\miniprogram截图\

| 文件 | 页面 |
|------|------|
| 带进度条的小程序游戏启动界面.png | 启动页 |
| index.jpg | 首页 |
| 0e5b39aca423980735833fe5710881f2.jpg | 幸运礼包弹窗 |
| 5f42c2f1cd2a6ff541de042d6025cb7c.jpg | 金库银行弹窗 |
| 8c5804076525e732d05f68a710e9e14d.jpg | 每日任务弹窗 |
| eb8d66ed2e601b6783973ef0f410d30d.jpg | 商城弹窗 |
| c5f9f24a490a2422db421d4e9a09ab00.jpg | 游戏+道具补给弹窗 |
| f4cc7a12bde4cb0d8a68770e01102864.jpg | 游戏对局界面 |
| 2e193822f7443320327a021b85dfe9be.jpg | 集卡中心 |

---

## 4. 关键文件路径

### 源码文件

- src/pages/splash/splash.vue — 启动页（进度条叠在插画的胶囊上）
- src/pages/index/index.vue — 首页+所有弹窗
- src/pages/game/game.vue — 游戏对局页
- src/pages/cards/cards.vue — 集卡中心页
- src/game/state.js — 全局状态（金币、体力、任务、卡册等）
- src/game/game-core.js — 游戏核心逻辑（牌阵、匹配、发牌）
- src/game/canvas-board.js — Canvas 渲染器
- src/game/tile-motion.js — 牌面物理动画（下坠、倾倒、落地回弹）
- src/game/tile-poses.js — 29 帧倾角 atlas 的几何，由 mp-tools/prep-assets.mjs 生成，勿手改
- src/game/shuffle-hands.js — 发牌时伸进来洗牌的两只手（画在 canvas 里）
- src/game/platform.js — 平台适配层

### 关键资源

- /static/ui/splash_bg.jpg：启动页插画（由参考图压成 750×1333 JPG，约 195KB）
- /static/ui/bg_home.jpg：首页全景背景
- /static/ui/lucky_chest_header.png：幸运礼包头图（已含"幸运礼包"字，不要再加文字！）
- /static/ui/piggy_hero_exact.png：金库银行金猪艺术图
- /static/ui/icon_crown_coin.png：金币图标（替代 emoji）
- /static/icons/icon_video_camera.png：视频/广告图标

---

## 5. 技术约束（必读）

### 原生组件盖住弹窗

小程序的 `<canvas>` 是原生组件，**不管 z-index 写多大都盖在所有 view 之上**。
游戏页的暂停/结算/道具弹窗曾经整个被麻将牌盖住，按钮看不见也点不到。

解决方式（已实现，见 game.vue）：有弹窗打开时直接把 canvas 隐藏掉

```js
const modalOpen = computed(() => paused.value || isWon.value || isLost.value
  || refillModal.visible || adActive.value);
// 模板：<canvas ... :hidden="modalOpen">
// 关闭弹窗后要重画一次，display:none 回来可能是空位图
watch(modalOpen, open => { if (!open) nextTick(paint); });
```

### WXSS 不要用 transform: translate(-50%,-50%) 做整页居中

启动页最初用「绝对定位 + top/left 50% + translate(-50%,-50%)」包一层来贴合插画比例。
元素查询出来的宽高位置全对（475×844），**但整页渲染出来是纯白，什么都不画**。
改成 `<image mode="aspectFill">` 铺满 + 用 JS 算出进度条的 px 位置就正常了。

### 弹窗的"开/关"不要写成 toggle

`@tap.self` 写在遮罩上、按钮又绑同一个 toggle 函数时，点按钮会连带触发遮罩，
toggle 两次 = 弹窗关不掉。改成 `onPause()` 只置 true、`resumeGame()` 只置 false。

### Emoji 渲染问题

Windows 微信开发者工具（Chromium）中，特殊 emoji 显示为空方块 → 一律用 `<image>` 替代。

### 幸运礼包标题

lucky_chest_header.png 图片本身已含立体文字"幸运礼包"，不要再叠加文字标题。

---

## 6. 动画（发牌 / 启动页 / 牌面翻滚）

**要改动画先读 `.claude/skills/animation-tuning/SKILL.md`**，那里有三套动画的全部
参数、改法、硬约束和验证脚本。本节只留一个概览。

`game-core.js` 的 `dealIn()`：所有牌先叠在牌阵中心正上方（z = 最高层 + `DEAL_HEIGHT` 1.6），
按随机顺序错开 `DEAL_STAGGER`(450ms) 依次下落，复用 `tile-motion.js` 里
「失去支撑后下坠 + 滑行 + 落地回弹」那套物理，落点就是各自的布局位置。
发牌期间 `shuffle-hands.js` 把两只手画进同一块 canvas（不能用 `<image>`，会被牌盖住）。

- `stepMotion()` 里先扣 `motion.delay` 再走物理步进，延迟期间牌停在起点
- `build()` 返回 `DEAL_DURATION`(1900ms)，game.vue 用这个值决定何时开始计时、何时撤走双手
- 实测（1~20 关）：最慢 1.87 秒全部落定，0 张牌落错位置，整体在 2 秒以内

> 尾巴不是 `DEAL_STAGGER` 决定的，是斜靠的牌倒下来的角速度决定的。
> 把 stagger 从 600 砍到 350，最慢的一关只从 1.95s 缩到 1.73s。
> 所以改完常量**必须**跑 skill 里那段 Node 回归重新量，别用公式估。

---

## 7. 下一步工作

- 逐张对比 devtools_shots/ 与 miniprogram截图/，细调仍有出入的间距和字号
- 通关/失败结算弹窗里还有 emoji（🎉 🪙 🐷 ⭐ 📺 🎬），建议换成图片
  （游戏页顶部的 ⏸ ⭐ 🧭 已实拍确认渲染正常，不用动）
- 关卡配置、体力消耗、金币产出等数值接后台（server/ 目录，localhost:3000/admin）

---

## 8. 构建命令

```
cd c:\mydev\majiang\majiang-mp
npm run build:mp-weixin
```

构建完**务必**按第 3 节的方式重启开发者工具，否则看到的还是旧代码。
