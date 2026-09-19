# majiang-game —— 小游戏版（玩法 + 弹窗全部打通）

把「趣味麻将碰」从微信**小程序**移植成微信**小游戏**。放在 `majiang-mp/` 旁边而不是
覆盖它，是为了让已经验收通过的小程序版本保持可运行，改造过程中随时能对照。

## 现在能跑什么

启动页 → 首页 → 牌桌 → 集卡页 全部打通，核心玩法（发牌动画、点牌、卡槽、
三张消除、四个道具、倒计时、胜负结算）与小程序版行为一致；首页/牌桌/集卡页的
弹窗也全部搬完了，没有「点了给条 toast 说还在搬」的入口。

| 场景 | 文件 | 状态 |
|---|---|---|
| 启动页 | `src/scenes/splash.js` | ✅ 含健康游戏忠告 + CADPA 12+，真实文字渲染 |
| 首页 | `src/scenes/home.js` | ✅ 14 个精灵 + 数值槽位 + 8 个弹窗 |
| 牌桌 | `src/scenes/board.js` | ✅ 玩法完整；暂停/胜利/失败 + 道具补给购买弹窗 |
| 集卡页 | `src/scenes/cards.js` | ✅ 头图 5 个热区 + 九宫格 + 详情/兑换屋/赛季商店/赛季收藏 |
| 弹窗层 | `src/modals.js` | ✅ 遮罩、面板、开关、筹码、列表滚动、广告浮层 |
| 广告 | `src/ads.js` | ✅ 真实激励视频 + 后台下发的投放配置 + 分投放位上报 |

弹窗一览（玩法口径逐条对齐小程序，见 `src/modals.js` 文件头）：
幸运礼包、金库银行（存钱罐）、每日/长线任务、商城、添加桌面、宝箱奖励、游戏设置、
体力说明、道具补给、兑换屋、赛季商店、赛季收藏、卡片详情。

**还没做的**：主题装扮（小程序侧本身也只是一条 toast，两边一致）。

## 怎么预览（不需要微信开发者工具）

```bash
node mp-tools/minigame-mcp.cjs run     # 启动/热重载预览，返回 http://localhost:3847
node mp-tools/minigame-mcp.cjs cycle   # run + 只看 error/warn 日志（改完代码就跑这个）
node mp-tools/minigame-mcp.cjs shot    # 截图落到 devtools_shots/
node mp-tools/minigame-mcp.cjs logs --lines 50
```

首次 `run` 之后要在浏览器里打开它给的 URL，游戏才真正开始跑（预览服务要有页面连上来
才有画面和日志）。之后改代码只要再 `cycle` 一次，页面会自动刷新。

这条回路绕开了 R4 卡住的两件事：不需要用小游戏的开发者身份登录开发者工具，
也不需要在 GUI 里「导入项目」手选小游戏类型。**提审和真机预览仍然要用开发者工具。**

`game.js` 顶部的 `DEBUG_SCENE` 改成 `'home'` / `'board'` / `'cards'` 可以跳过前面的场景
直接进那一屏；写成 `'home#shop'` 还会顺手把那个弹窗打开——canvas 上的弹窗没法从外部点开，
验收截图只能这么进。可用的名字：

| 场景 | 可直开的弹窗 |
|---|---|
| `home#` | `settings` `lucky` `piggy` `tasks` `shop` `desktop` `chest` `ad` |
| `board#` | `refill` |
| `cards#` | `detail` `exchange` `seasonShop` `collection` |

**提交前必须保持空字符串。**

## 目录

```
game.js                入口：场景工厂 + 帧循环启动
src/screen.js          画布与坐标系，导出 viewport（为什么不叫 screen 见文件头注释）
src/app.js             帧循环、场景切换、触摸派发
src/ui.js              canvas UI 原语：素材、尺寸、绘制、命中测试
src/platform.js        game-core 事件的宿主实现（音效/震动/自绘 toast/画布/帧回调 raf）
src/store.js           全局状态与持久化（小程序版 state.js 去 vue 化）
src/modals.js          弹窗层：遮罩/面板/开关/筹码/列表滚动 + 广告浮层的画法
src/ads.js             广告投放：激励视频、后台配置、投放位开关、数据上报
src/home-layout.js     首页几何，与 mp-tools/home-layout.cjs 同步
src/game/              玩法核心，从小程序原样搬来（含 cards-core.js：集卡纯逻辑）
src/scenes/            四个场景
static/                素材，2.4MB（主包共 2.6MB，小游戏上限 4MB）
probe.js               旧的连通性探针，留作兜底
```

## 移植时踩到的六件事

1. **小游戏运行时是 CommonJS，不是 ESM。** `import` 直接 SyntaxError，全部用
   `require` / `module.exports`。小程序侧那五个玩法核心文件是 ESM 写的，搬过来做了
   一次机械转换，逻辑一行没动。

2. **循环 require 会拿到半成品 exports。** `ui.js` 要读屏幕宽高，`app.js` 要调 `ui.js`
   画 toast，两边一互相 require，先被引的那个拿到的 `screen` 是 `undefined`。
   把两边都依赖、自己谁也不依赖的那块拆成了 `src/screen.js`。

3. **全局用物理像素作画，不做 `ctx.scale(dpr)`。** `canvas-board.js` 会把每张牌合成到
   离屏画布再 blit，那些画布是按「牌宽 w」这个数字开的；w 要是逻辑像素，dpr=3 的机器上
   整盘牌就是糊的。代价是不能写死字号，UI 尺寸一律按屏幕宽高的百分比算（`ui.js` 的 vw/vh/rem）。

4. **canvas 没有事件冒泡。** 弹窗遮罩必须自己登记成热区把点击吞掉，否则玩家在结算界面
   点到的是下面的牌。绘制和命中测试共用同一个 rect 对象，绝不各算一套。

5. **模块作用域里的全局，和浏览器不是一回事。** 小游戏运行时把每个模块包在一个函数里
   执行，那个作用域和浏览器全局对不上，两个方向都会咬人：

   - **名字已经被占**：`src/screen.js` 顶层写 `const screen = {...}`，而那儿已经有一个
     `screen`（浏览器风格的全局），于是加载期直接
     `SyntaxError: Identifier 'screen' has already been declared` → 模块注册不上 →
     所有 `require('./screen.js')` 报 `module 'src/screen.js' is not defined` → 游戏起不来。
     现在那个对象叫 `viewport`。
   - **名字根本不存在**：`requestAnimationFrame` 在模块作用域里是 undefined，
     裸调用就是 `TypeError: requestAnimationFrame is not a function`，帧循环压根起不来。
     要从全局对象上取（小游戏是 `GameGlobal`，预览是 `globalThis`），见 `platform.js`
     的 `raf()`，并带 setTimeout 兜底。

   两件事的共同点：**浏览器预览里全都正常**，只有装进开发者工具/真机才暴露。
   所以有了 `mp-tools/minigame-lint.cjs` 专盯这一类。

6. **没有 `scroll-view`，也没有 `switch`、`showModal`。** 任务/商城的长列表得自己接
   onTouchMove 累加偏移 + `ctx.clip()` 裁可视区，还要靠位移量区分「滑动」和「点击」
   （动过 1vh 以上就不触发按钮）；开关、确认框、文字折行也都在 `modals.js` 里自绘。

## 广告投放

八个「看广告拿奖励」的入口都走 `src/ads.js`，配置不在代码里，而在运营后台
（`server/`，页面上的「广告投放」卡片）：广告位 ID、总开关、每个投放位的单独开关、
两次广告的最小间隔、拉不到广告时是否照发奖励——改完保存，客户端下次启动就生效。

| 投放位 key | 位置 |
|---|---|
| `luckyBag` | 首页 · 幸运礼包解锁 |
| `piggy` | 首页 · 存钱罐领取 |
| `stamina` | 首页 · 看广告补满体力 |
| `shopCoins` / `shopTool` | 商城 · 免费领金币 / 免费领道具 |
| `refill` | 牌桌 · 道具补给免费拿 |
| `cardsChest` / `cardsDetail` | 集卡 · 视频宝箱 / 卡片详情补碎片 |

后台会按投放位分别统计曝光 / 看完 / 失败，所以**每个入口必须传自己的 key**
（`modals.playAd(placement, cb)`），别图省事传同一个。

```bash
node mp-tools/ads-check.cjs     # 广告链路回归：用 wx 桩把每条分支跑一遍
node server/admin-check.cjs     # 后台页面自检：脚本语法、id、广告配置往返
node mp-tools/minigame-lint.cjs # 只在微信里才会炸的写法（撞名全局 / ESM / 忘关调试开关）
```

**上线前必须做的两件事**（代码里做不了）：

1. 小游戏后台开通流量主、创建激励视频广告位，把 `adunit-` 开头的 ID 填进运营后台，
   并把「广告来源」从「本地模拟」改成「微信激励视频」；
2. 把 `src/ads.js` 顶部的 `API_BASE` 换成线上 **https** 地址，并在小游戏后台
   「开发设置 - 服务器域名」把它加进 request 合法域名。没配的话客户端会安静地
   退回缓存/默认配置——不会白屏，但后台就管不着它了。

## 已知问题

- 首页中段有一大片空白，这是首页母版本来的排布，不是移植引入的。
- 浏览器预览里拉不到运营后台：垫片**有** `wx.request`，但会把请求重写到预览服务自己的
  源上——实测 `http://localhost:3000/api/ads` 直接 curl 是 200，从游戏里发出去拿回来的
  是预览服务的 404。所以预览里 provider 永远停在兜底的 `mock`，后台改了不会生效。
  验广告配置要用 `mp-tools/ads-check.cjs`（Node 里直连后台）或真机。
- 集卡页九张卡按剩余高度收缩以求一屏放下；小程序那边外面套的是 `<scroll-view>`。
  卡片多到放不下时要改成自己实现滚动。
