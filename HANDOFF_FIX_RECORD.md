# 交互无响应 / 图片加载失败 —— 修复与验证记录

- 日期：2026-09-18
- 范围：`majiang-mp/src` 下的首页、集卡页、对局页与全局存档；新增首页回归脚本
- 工作区状态：**未提交、未 stash、未 reset**，此前的 cards.vue / state.js / game.vue 改动原样保留
- 诊断证据（只读，未改动）：`C:/Users/Administrator/WorkBuddy AI/2026-09-18-01-19-11/`
  下的 `repro-before.json` / `qa-original-profile.json` / `before-home.png` / `before-lucky.png`

---

## 一、问题清单

| # | 现象 | 触发条件 | 严重度 |
|---|---|---|---|
| P1 | 点「关卡宝箱」「星星宝箱」完全没反应 | 任何时候 | 高 |
| P2 | 宝箱进度永远停在满格（1/5→5/5 后不再变化），且每点一次白送一次金币 | 通关 5 次之后 | 高 |
| P3 | 点「开始游戏」没反应，体力却被扣掉 | 构建产物与 `pages.json` 不同步时 | 高 |
| P4 | 集卡页九张卡片全部裂图/空白 | 老存档玩家（含诊断基线存档） | 高 |
| P5 | 幸运礼包数据里「加时」图标指向不存在的文件 | 任何读档 | 中 |
| P6 | 首页体力显示与上限写死为 5，改 `maxStamina` 后显示错乱 | 调整体力上限时 | 低 |
| P7 | `dist/build/mp-weixin` 构建产物过期，仍指向旧的 `pages/game/game` | 真机/开发者工具回归时 | 高（阻塞验收） |

---

## 二、根因分析

### P1 —— 宝箱弹窗模板从来就没写过

`index.vue` 里 `openLevelChest()` / `openStarChest()` 都以 `modals.chestReward = true` 收尾，
`closeChestModal()` 也定义了，样式块「6. 宝箱奖励」（`.reward-dialog` / `.reward-header` /
`.reward-grid` / `.reward-item` / `.reward-name`）一应俱全 —— **唯独 `<template>` 里没有任何
节点消费 `modals.chestReward`**。翻 git 历史（`82e3c50`、`c48f5f6`）确认这段模板从未存在过，
不是本次改动弄丢的。

结果：点宝箱 → 金币静默入账 → 屏幕上什么都不发生。玩家看到的就是「点了没反应」。
诊断脚本 `repro-home.cjs` 里那句 `CHEST_EXISTS`（查 `.reward-dialog`）正是冲着这个来的。

> 构建产物佐证：重建前 `dist/build/mp-weixin/pages/index/index.js` 里 `chestReward` 出现 5 次，
> 而 `pages/index/index.wxml` 里 0 次。

### P2 —— 存档改了「宝箱封顶」，但没人负责「领取」

本次工作区里 `state.js` 的 `clampChest()` / `winLevelAction()` 改成了
「进度达到 `target` 后停在 `target`，等待领取，不再清零」（对应 state-regression 的
「关卡宝箱达到 target 后停在 target，不清零丢进度」）。可是首页的 `openLevelChest()` 老实现是：

```js
addCoins(50); addTool('clear', 1); modals.chestReward = true;   // 既不校验进度，也不清零
```

两边一对上就变成：进度永久卡在 5/5，而奖励可以无限点无限领。

### P3 —— 跳转失败被 uni 静默吞掉

`repro-before.json` 里留着决定性的一行：

```json
{"type":"error","args":["QA_NAV_FAILED","/pages/game/game?level=2",
 {"errMsg":"navigateTo:fail page \"pages/game/game?level=2\" is not found"}]}
```

分包改造（`1fe3702`）把对局页搬到了 `/pkg-game/pages/game/game`，源码已经改对了，但
**当时的构建产物是改造前的**（见 P7）。真正的代码缺陷在于：`uni.navigateTo` 没有 `fail`
回调，失败时只在控制台打一行错，界面上毫无提示，而体力已经在跳转前被扣掉了 ——
玩家的体验就是「点了没反应还掉体力」。

### P4 —— 老存档里的图片文件名反过来覆盖了代码里的默认值

`state.js` 的 `mergeStored()` 对字符串的规则是「存档里有非空值就保留」：

```js
if (typeof def === 'string') {
  return typeof stored === 'string' && stored !== '' ? stored : def;
}
```

卡册美术曾经从 `.png` 换版到 `.jpg`，仓库里现在只有 `card_hotpot.jpg` 这一套；
而老存档（**诊断基线 `qa-original-profile.json` 正是这种档**）里存的还是 `card_hotpot.png`。
合并之后 `gameState.cardsAlbum[].image` 全变回 `.png`，集卡页的
`:src="'/pkg-cards/static/ui/' + c.image"` 于是逐个指向不存在的文件 —— 九张卡全裂。

根子上的问题是**资源文件名被当成了玩家数据**。它属于代码资产，换版时应当由代码说了算。

### P5 —— 幸运礼包图标指向分包里不存在的文件

`DEFAULT_STATE.luckyBag.rewards` 里写的是 `tool-undo.png` / `tool-clear.png` /
`tool-time.png` / `tool-shuffle.png` / `coin_sack.jpg`。实际情况：

- `tool-*.png` 那套素材在 **pkg-game 分包**（`src/pkg-game/static/tools/`）里 —— 主包数据引分包资源本身就是错的；
- 其中 **`tool-time.png` 根本不存在**（该目录只有 clear / magnet / shuffle / undo 四个）；
- `coin_sack.jpg` 也不存在，磁盘上的文件叫 `coin_sack_exact.jpg`。

这批字段目前没有被模板直接渲染（首页幸运礼包弹窗是写死的 `<image src>`），所以线上没爆，
但它是颗随时会响的哑弹 —— 任何一处改成按数据渲染就会出空白格。

### P6 —— 体力上限写死

`v-if="gameState.stamina < 5"`、`gameState.stamina = 5`、`'/5'` 三处硬编码 5，
而存档里是 `maxStamina`。

### P7 —— 构建产物过期

`dist/build/mp-weixin` 的时间戳是 00:52，真机复现是 01:43，但那份产物里
`pages/index/index.js` 仍然是 `pages/game/game?level=`。也就是说 `repro-before.json` 里
的一大段报错是在**一个和源码不同步的包**上测出来的，属于验收环境问题，不是源码缺陷。

---

## 三、修复方案

### 改动文件一览

| 文件 | 性质 |
|---|---|
| `majiang-mp/src/pages/index/index.vue` | 修改 |
| `majiang-mp/src/game/state.js` | 修改 |
| `mp-tools/home-regression.cjs` | **新增** |
| `mp-tools/fixtures/qa-original-profile.json` | **新增**（诊断基线存档的只读副本，供脚本离线使用） |
| `majiang-mp/dist/build/mp-weixin/**` | 重建产物 |

`pkg-cards/pages/cards/cards.vue` 与 `pkg-game/pages/game/game.vue` 本次**未改动**：
排查后确认这两页的事件绑定、层级、计时器清理都没问题，集卡页裂图的根子在 `state.js`，
在源头修比在渲染处兜底更干净，也不会破坏 cards-regression 里
「图片引用数量与原有 UI 资源一致，无新增素材」那条静态断言。

### P1 + P2：补齐宝箱弹窗，并让「领取」真正消耗进度

`index.vue` `<template>`（第 310 行附近）新增：

```html
<view class="modal-overlay" v-if="modals.chestReward" @tap.self="closeChestModal">
  <view class="reward-dialog animate-pop" @tap.stop>
    <view class="reward-header">{{ chestReward.title }}</view>
    <view class="reward-grid">
      <view class="reward-item">
        <image class="reward-coin-lg" src="/static/ui/icon_crown_coin.png" mode="aspectFit" />
        <text class="reward-name">金币 x{{ chestReward.coins }}</text>
      </view>
      <view class="reward-item" v-if="chestReward.toolCount > 0">
        <image class="reward-coin-lg" :src="'/static/icons/' + chestReward.toolIcon" mode="aspectFit" />
        <text class="reward-name">{{ chestReward.toolName }} x{{ chestReward.toolCount }}</text>
      </view>
    </view>
    <button class="dialog-confirm-btn" @tap="closeChestModal">收下奖励</button>
  </view>
</view>
```

用的全是本来就写好的样式类，只补了一条 `.reward-coin-lg { width/height: 96rpx }`。
弹窗容器加了 `@tap.stop`、遮罩用 `@tap.self`，和页面里其它弹窗保持一致，避免点内容区误关。

脚本侧把两个宝箱收敛到一个 `claimChest(chest, reward)`：

```js
function claimChest(chest, reward) {
  if (!chest) return;
  if (chest.current < chest.target && !gameState.settings.gmMode) {
    uni.showToast({ title: '还差 ' + (chest.target - chest.current) + ' 点即可开启，继续闯关吧！', icon: 'none' });
    return;
  }
  chest.current = 0;                       // ← 领取即清零，和 state.js 的封顶逻辑对上
  addCoins(reward.coins);
  if (reward.toolCount > 0) addTool(reward.tool, reward.toolCount);
  ...
  modals.chestReward = true;
}
```

未满时给明确的进度提示（不再是「点了什么都没有」），满了才发奖并清零。`gmMode` 放行便于自测。

> 顺带的行为微调：星星宝箱原先发「洗牌 x1 + 翻牌 x1」，现在发「洗牌 x2」，
> 金币数量不变（150）。这是为了让弹窗只需展示一种道具、结构简单；如需保留两种道具，
> 把 `chestReward` 改成数组即可。

### P3：跳转失败必须让玩家看见

新增 `navigateOrWarn(url, onFail)`，首页三处跳转（开始游戏 / 每日挑战 / 集卡）统一走它：

```js
function navigateOrWarn(url, onFail) {
  uni.navigateTo({
    url,
    fail: () => {
      if (onFail) onFail();
      uni.showToast({ title: '页面打开失败，请重启小程序后重试', icon: 'none' });
    }
  });
}
```

同时 `handleStartGame()` 的体力口径改为走 `state.js` 的 `consumeStamina(1)`
（内部处理 `gmMode`，并在扣除瞬间就起满 15 分钟恢复计时），跳转失败时 `refundStamina(1)` 退回：

```js
function handleStartGame() {
  if (!consumeStamina(1)) { showStaminaTip(); return; }
  navigateOrWarn('/pkg-game/pages/game/game?level=' + gameState.currentLevel,
    () => { if (!gameState.settings.gmMode) refundStamina(1); });
}
```

### P4 + P5：资源文件名归代码所有

`state.js` 新增 `restoreAssetPaths(state)`，并挂进 `normalizeState()`：

```js
function restoreAssetPaths(state) {
  const defaults = new Map(DEFAULT_STATE.cardsAlbum.map(c => [c.id, c.image]));
  if (Array.isArray(state.cardsAlbum)) {
    state.cardsAlbum.forEach(c => { if (c && defaults.has(c.id)) c.image = defaults.get(c.id); });
  }
  const icons = new Map(DEFAULT_STATE.luckyBag.rewards.map(r => [r.id, r.icon]));
  const rewards = state.luckyBag && state.luckyBag.rewards;
  if (Array.isArray(rewards)) {
    rewards.forEach(r => { if (r && icons.has(r.id)) r.icon = icons.get(r.id); });
  }
  return state;
}
```

读档后按 id 把图片字段一律改回代码里的默认值 —— 玩家的 `count` / `duplicates` / `claimed`
等真实进度全部照常保留，只有资源路径不认存档。

同时把 `luckyBag.rewards` 的图标从分包的 `tool-*.png` 换成主包 `static/icons` 下的商城图标
（`shop_tool_undo.jpg` / `shop_tool_clear.jpg` / `shop_tool_time.jpg` /
`shop_tool_shuffle.jpg` / `coin_sack_exact.jpg`）。这套图标五个齐全、都在主包，
也正是首页幸运礼包弹窗实际渲染用的那套，视觉上完全一致。

> 关于「缺失且无法补图」：本次没有出现真正需要临时顶替的素材。
> `tool-time.png` 确实不存在，但它对应的 `shop_tool_time.jpg` 在主包里是有的，
> 换过去是修正引用而非降级替代。对局页底部道具栏没有「加时」按钮，不受影响。

### P6：体力上限改用 `maxStamina`

`v-if="gameState.stamina < gameState.maxStamina"`、提示文案里的 `/5` 改成
`'/' + gameState.maxStamina`、看广告补满从 `gameState.stamina = 5` 改成
`refundStamina(gameState.maxStamina)`（内部会 clamp 并归零恢复计时）。

### P7：重建构建产物

执行 `npm run build:mp-weixin`，详见验证一节。

### 排查过但确认无问题的点

- **热区遮挡**：首页 15 个透明热区两两不重叠（已写成回归断言）；`.dyn-overlay` 有
  `pointer-events: none`，不会吃掉底下的点击。
- **热区与美术对齐**：把 15 个热区矩形按 CSS 百分比叠加到 `before-home.png` 上逐个比对，
  左侧浮标（幸运礼包 / 每日任务 / 每日挑战）、右侧浮标（存钱罐 / 添加桌面）、
  底部（主题装扮 / 集卡 / 开始游戏 / 商店）以及顶栏和两个宝箱条全部落在按钮上，
  动态覆盖层（`dyn-level-pill` / `dyn-lucky-timer`）也和底图里烤好的位置吻合。
- **cover-view / cover-image**：全项目没有使用，不存在这类层级遮挡。
- **canvas 遮挡**：对局页已用 `:hidden="modalOpen"` 在弹窗期间隐藏原生 canvas，
  弹窗按钮不会被牌面盖住。
- **disabled / loading 卡死**：集卡页的 `busy` 标志所有分支都在 `finally` 里复位，
  广告计时器在 `onUnmounted` 清理，不会卡在 disabled。
- **静态资源存在性**：四个页面模板里写死的绝对路径 + 四处动态拼接路径（商城道具图标、
  宝箱道具图标、卡册图片、对局页补给道具图标、牌面图集 43 个 `faceKey`）逐个核对，
  除上文 P4/P5 外全部命中真实文件。

---

## 四、验证方式

### 4.1 三套 Node 回归脚本（全部通过，均为纯 Node，无需开发者工具）

```
$ node C:/mydev/majiang/majiang-mp/mp-tools/state-regression.cjs
一、旧存档迁移（深合并 / 数字异常 / 按 id 合并）
  PASS  空存档：全部字段回落到默认值
  PASS  任务/卡册按 id 合并：已有进度保留，缺失条目补齐
  ...
三、宝箱进度（达到 target 后封顶留待领取）
  PASS  关卡宝箱达到 target 后停在 target，不清零丢进度
  PASS  每日挑战双倍奖励：金币 +40 / 存钱罐 +50
✓ 23 个用例通过，0 个失败
```

```
$ node C:/mydev/majiang/mp-tools/cards-regression.cjs
[2] 集齐奖励：仅跨过阈值那一次发放
  PASS  连抽30次：集齐奖励只发了 1 次（要求 1 次）
[7] 源码静态校验：旧缺陷代码已移除
  PASS  图片引用数量与原有 UI 资源一致，无新增素材
ALL PASS
```

```
$ node C:/mydev/majiang/mp-tools/home-regression.cjs
一、首页图片引用：模板写死的 src
  PASS  模板里解析到 26 个写死的图片引用
  PASS  资源存在：/static/icons/shop_tool_time.jpg
  ...
二、首页图片引用：运行时拼出来的动态 src
  PASS  商城商品表解析到 5 个道具图标（应为 5）
  PASS  宝箱奖励图标存在：/static/icons/shop_tool_shuffle.jpg
三、事件绑定：模板绑到的处理函数都有定义
  PASS  模板里解析到 31 个事件处理函数
  PASS  事件处理函数已定义：closeChestModal()
四、没有“设了状态却没人渲染”的死角
  PASS  弹窗 modals.chestReward 在模板里有对应节点        ← P1 的回归点
五、热区按钮：几何定义齐全且互不遮挡
  PASS  模板里解析到 15 个热区按钮
  PASS  热区两两不重叠
  PASS  动态数值覆盖层 .dyn-overlay 设了 pointer-events: none，不吃掉热区的点击
六、页面跳转路径与 pages.json 一致
  PASS  跳转目标已在 pages.json 注册：/pkg-game/pages/game/game     ← P3 的回归点
  PASS  跳转目标已在 pages.json 注册：/pkg-cards/pages/cards/cards
  PASS  navigateTo 带 fail 兜底，跳转失败不再静默
七、存档迁移：state.js 读得动诊断基线存档
  PASS  金币保留：1200（基线 1200）
  PASS  体力保留：5/5（基线 5/5）
  PASS  星星保留：3（基线 3）
  PASS  关卡保留：2（基线 2）
  PASS  道具持有量保留：消除3 / 洗牌4 / 翻牌4
  PASS  卡册已有进度保留：暖心红薯 1 张
八、老存档不能把图片路径带坏（集卡页裂图的根因）
  PASS  基线存档确实带着老的 .png 卡册文件名（回归前提成立）
  PASS  卡册素材存在：/pkg-cards/static/ui/card_hotpot.jpg          ← P4 的回归点
  PASS  幸运礼包图标存在：shop_tool_time.jpg                        ← P5 的回归点
九、需要运行时环境的部分（本脚本不覆盖）
  SKIP  真机/开发者工具下的实际点击命中与渲染层图片解码：需开发者工具开 9420 自动化端口，走 mp-tools/repro-home.cjs
  SKIP  底图热区与美术坐标的像素级比对：需要当次构建的真机截图，属人工验收项

✓ 118 个断言通过，0 个失败，2 个跳过
```

`home-regression.cjs` 的设计说明：

- 风格沿用现有 `mp-tools` 脚本：纯 Node、直接读磁盘源码、`node` 一条命令即可跑、
  不依赖构建产物与微信开发者工具，失败时 `process.exit(1)`。
- 存档断言使用 `mp-tools/fixtures/qa-original-profile.json`（诊断基线存档的副本）。
  原始证据目录保持只读未动；若 fixture 缺失，该段整体降级为 SKIP 而不是失败。
- 两条确实需要真机的断言（真实点击命中、渲染层图片解码）写成了 SKIP 并注明了
  替代路径（`mp-tools/repro-home.cjs` + 开发者工具 9420 自动化端口）。

### 4.2 构建

```
$ cd C:/mydev/majiang/majiang-mp && npm run build:mp-weixin
Compiler version: 5.24（vue3）
Compiling...
DONE  Build complete.
```

构建后核对（重建前 → 重建后）：

| 检查项 | 重建前 | 重建后 |
|---|---|---|
| `pages/index/index.js` 里的对局页路径 | `pages/game/game?level=`（旧路径，navigateTo 必失败） | `/pkg-game/pages/game/game` ✅ |
| `pages/index/index.wxml` 里的宝箱弹窗 | 无 `.reward-dialog` | 有 `.reward-dialog` / `收下奖励` ✅ |
| wxml 引用的静态资源是否都在产物里 | —— | 全部命中，无 MISSING ✅ |

分包体积（微信主包上限 2MB，总包 20MB）：

| 包 | 体积 |
|---|---|
| 主包 | 1.27 MB |
| pkg-game | 0.67 MB |
| pkg-cards | 0.54 MB |

未触碰 `server/`、`test_admin*` 等无关目录。

### 4.3 工作区状态

未执行 `git commit` / `git stash` / `git reset`。`git status` 仍为改动态：

```
M majiang-mp/src/game/state.js
M majiang-mp/src/pages/index/index.vue
M majiang-mp/src/pkg-cards/pages/cards/cards.vue      （此前工作，本次未动）
M majiang-mp/src/pkg-game/pages/game/game.vue          （此前工作，本次未动）
?? mp-tools/home-regression.cjs
?? mp-tools/fixtures/
```

---

## 五、残留风险与建议

1. **未做真机/开发者工具验证。** 本次是无人值守执行，微信开发者工具没有启动，
   `repro-home.cjs` 需要 `ws://127.0.0.1:9420` 自动化端口，跑不了。
   建议提交前手动做一遍：导入重建后的 `dist/build/mp-weixin`，
   依次点两个宝箱（应弹窗）、开始游戏（应进对局）、集卡（九张卡图应正常），
   并用旧存档（`qa-original-profile.json` 写进 `majiang_user_profile_v2`）各走一遍。

2. **`repro-before.json` 里那 20 余条 `error` 只定位到一条。** 其中
   `QA_NAV_FAILED` 已确认是构建产物过期导致；其余错误的 `args` 序列化成了空对象 `{}`，
   拿不到消息内容，且那份产物已与源码脱节，无法再复现归因。
   建议在重建后的包上重跑一次 `repro-home.cjs`，把仍然存在的报错单独立项。

3. **`restoreAssetPaths` 是按 id 白名单覆盖的。** 未来卡册新增 id 时，
   只要在 `DEFAULT_STATE.cardsAlbum` 里登记就会自动纳入保护；但如果哪天真的需要
   「让存档决定图片」（比如玩家自选皮肤），得单开一个不受此函数管辖的字段。

4. **星星宝箱的奖励构成有微调**（洗牌 x1 + 翻牌 x1 → 洗牌 x2，金币不变）。
   如果这属于已定数值策划，改回两种道具需要把 `chestReward` 改成数组并相应扩展弹窗模板。

5. **星星宝箱 target 是 500。** 领取逻辑现在要求 `current >= target` 才发奖，
   也就是说非 GM 玩家实际需要攒满 500 颗星才点得动。这符合「封顶待领」的设计，
   但如果产品本意是更早可领，需要调 `DEFAULT_STATE.starChest.target`。

6. **热区对齐依赖底图不变。** 首页按钮全是叠在整屏底图上的百分比透明热区，
   一旦 `bg_home_*.jpg` 换版就必须同步重标 15 个热区坐标。
   `home-regression.cjs` 只能验「不重叠、定义完整」，验不了「压在按钮上」，
   换图时请务必重做 4.1 里那轮截图叠框比对。

7. **本次未能加载 `wechat-miniprogram` 技能包**（Skill 工具连续两次返回
   `Execute skill` 失败），相关判断基于通用小程序/uni-app 知识。
   若环境修好，建议按技能清单再复核一次分包资源引用与生命周期部分。

---

# R2 首页底图重构 —— 消除「开始游戏」拼接横线

## 一、问题

首页底图由 5 张竖向 JPG 切片（`bg_home_1.jpg ~ bg_home_5.jpg`，各 1260x560）
经 `.home-bg { display:flex; flex-direction:column }` + `.home-bg-slice { flex:1 }`
均分拼成一整屏。切片是为了绕开微信代码质量扫描的「单个图片/音频资源不应超过 200K」：
整幅 1260x2800 存成 JPEG 到不了这个体积，而底图里烤着全部按钮文字，也不能靠降质硬压。

代价是**「开始游戏」按钮上方出现一条肉眼可见的白色横线**，位置正好是第 4、5 片的交界
（y = 560 × 4 = 2240）。

### 这条线不在像素里

把 5 片按原样拼回一张图逐行量过，源像素完全连续，四条交界处都没有任何亮度尖峰：

```
边界 560   y=557:156.93  558:157.23  559:157.35  560:158.18  561:158.99  562:160.01
边界 1120  y=1117:150.82 1118:150.78 1119:150.61 1120:150.08 1121:149.76 1122:149.28
边界 1680  y=1677:110.88 1678:110.70 1679:110.65 1680:110.27 1681:110.20 1682:110.08
边界 2240  y=2237:143.13 2238:147.63 2239:152.21 2240:153.77 2241:155.15 2242:156.42
```

出问题的 y=2240 那两行像素是 `(253,206,32)` 与 `(253,205,35)`——按钮本身连续的黄色，
没有白行。全宽逐列扫描 y=2239/2240，最大单列色差出现在 x=194，那是「主题装扮」图标的
高对比边缘，属于画面内容而非缝。

所以这条线是**渲染期产物**：5 个独立 `<image>` 各自被缩放到非整数高度
（1125x2436 的屏幕上每片 487.2 行），各自在自己的上下边缘做重采样与合成，
边缘像素向外发白，叠在一起就成了一条缝。`flex: 1` 能防住百分比取整产生的缝，
防不住这个——因为缝不是「元素之间漏出背景」，而是「元素自己的边缘被抗锯齿了」。

结论：只要底图回到**一个** `<image>` 元素，元素内部就不存在边界，这条缝按构造消失。

## 二、方案选择：走了 P2（无缝单图），没走 P1（分层）

**选 P2。** 理由如下，按权重排序：

1. **P1 给的 UI 拼板是「素材板」而不是「页面布局」。** `0a95….jpg`（1312x1199）把
   元素按展示需要重新排布过，和首页实际位置对不上，要逐个抠图再按 15 个热区坐标
   重新摆位。

2. **更要命的是拼板里没有烤进去的动态数值。** 现行底图把
   `1/5`、`3/500`、`0/9`、Banner 上的 `200/300/500`、`max`、`关卡2`、`00:14:57`
   以及各个红点全烤在图里，页面只用 4 个 `.dyn-*` 覆盖层补真正会变的值。
   拼板刻意留空了数字位，改 P1 就得把这十来处全部重做成覆盖层——改动面和回归风险
   比「换一张图」大一个数量级，而且拼板本身还有两项都标成「每日任务」、缺「幸运礼包」
   标签的问题。

3. **P1 的新背景是现有底图的低清版。** `9df3….jpg` 只有 941x1672，
   而现有整图是 1260x2800，同一张画（树、松鼠、栅栏、「发」字水印都对得上）。
   拿它换等于主动降分辨率。

4. **P2 能做到与现行设计像素级一致。** 热区的百分比坐标本就是按「底图铺满整屏」标的，
   换单图不改变任何映射关系，15 个热区一个都不用重标（这是 P1 最大的风险点，
   见上一轮记录「残留风险 6」）。

5. **体积上 P2 反而更省。** 见下。

一句话：P1 是「重做首页」，P2 是「把同一张图换个封装」。问题是渲染期的元素边界，
P2 直接拆掉了这个成因，没必要为此承担重做布局的风险。

### 为什么是 WebP q86

换成 WebP 之后，整幅 1260x2800 在 200K 以内绰绰有余，不必再切片。源图取**现存最无损
的那一份**而不是在已经压过的切片上再压一道：`1fe3702`（分包瘦身那次提交）把
`bg_home.jpg` 切成了 5 片，它的父提交里还留着 1260x2800 / 1.08MB 的整图
（blob `e65155cd`），这是目前能拿到的最好的源。

质量点位是实测选的。以那张原图为基准，同时算全图 RMSE 和**边缘像素 RMSE**
（文字描边处的误差最要命，单独加权看）：

| 方案 | 体积 | 200K | 全图 RMSE | 边缘 RMSE |
|---|---|---|---|---|
| 现状 5 片 JPEG（合计） | 534.4K | — | 1.481 | 3.423 |
| **WebP q86** | **178.2K** | **OK** | **2.332** | **4.853** |
| WebP q85 | 167.4K | OK | 2.408 | 5.044 |
| WebP q88 | 207.2K | 超 | 2.166 | 4.585 |
| JPEG mozjpeg q74 4:4:4 | 290.8K | 超 | 2.248 | 5.997 |
| JPEG mozjpeg q78 4:2:0 | 218.6K | 超 | 2.660 | 6.605 |

**能塞进 200K 的 JPEG 一个都没有**（最省的 q78 还要 218.6K，且边缘误差已经到 6.6），
而 WebP q86 只用 178.2K 就把边缘误差压到 4.85，还剩 21.8K 余量。故取 q86。

## 三、具体改动

### 改动文件一览

| 文件 | 改动 |
|---|---|
| `majiang-mp/src/static/ui/bg_home_full.webp` | **新增**，1260x2800 WebP q86，178.2K |
| `majiang-mp/src/pages/index/index.vue` | 5 个切片 `<image>` → 1 个整图 `<image>`；`.home-bg-slice` → `.home-bg-img`；`navigateOrWarn` 加载提示 |
| `majiang-mp/src/pages.json` | 新增 `preloadRule`，首页预下载两个分包 |
| `mp-tools/build-home-bg.cjs` | **新增**，从 git 历史里的原图重新生成底图素材 |
| `mp-tools/shot-home-seam.cjs` | **新增**，实机接缝验收截图 + 逐行亮度扫描（本次未能跑通，见残留风险） |
| `mp-tools/home-regression.cjs` | 新增第三节「首页底图」；第七节补预下载与加载提示断言；原三~九节顺延为四~十 |

### 模板与样式

```diff
-    <view class="home-bg">
-      <image class="home-bg-slice" src="/static/ui/bg_home_1.jpg" mode="scaleToFill" />
-      … 共 5 片 …
-    </view>
+    <view class="home-bg">
+      <image class="home-bg-img" src="/static/ui/bg_home_full.webp" mode="scaleToFill" />
+    </view>
```

```diff
 .home-bg {
   position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;
-  display: flex;
-  flex-direction: column;
 }
-.home-bg-slice { flex: 1; width: 100%; display: block; }
+.home-bg-img  { width: 100%; height: 100%; display: block; }
```

`.dyn-*` 四个动态覆盖层与 15 个 `.hotspot-*` 热区**一行未动**——它们的百分比坐标
是相对整屏的，与底图怎么封装无关。

### 顺带优化（P3）：分包加载的等待反馈

对局页和集卡页都在分包里，首次进入要先下载分包，慢的时候 3~8 秒。这期间
`navigateTo` 还没回调，屏幕上一点动静都没有，玩家的体感就是「点了没反应」。

```diff
 function navigateOrWarn(url, onFail) {
+  uni.showLoading({ title: '加载中', mask: true });
   uni.navigateTo({
     url,
+    success: () => { uni.hideLoading(); },
     fail: () => {
+      uni.hideLoading();
       if (onFail) onFail();
       uni.showToast({ title: '页面打开失败，请重启小程序后重试', icon: 'none' });
     }
   });
 }
```

改在 `navigateOrWarn` 里，`handleStartGame` / `gotoCardsPage` / `openDailyChallenge`
三条路径一起受益，不用各写一遍。

**关闭为什么走 success / fail 两条腿而不是 `complete`：** `navigateTo` 必定只命中
success 或 fail 其中之一，两条腿覆盖是完整的；而 `complete` 排在 `fail` 之后，
会把 fail 里刚弹出来的 toast 一起掐掉——微信的 loading 与 toast 共用同一个提示通道，
`hideLoading()` 会顺手关掉 toast。回归脚本里专门钉了一条断言防止以后被「优化」成
`complete`。

`pages.json` 里同时配了预下载，尽量让玩家点下去的时候分包已经就位：

```json
"preloadRule": {
  "pages/index/index": { "network": "all", "packages": ["pkg-game", "pkg-cards"] }
}
```

预下载不保证跑在点击之前（弱网、冷启动都可能来不及），所以加载提示仍然要给，两者是
互补而不是二选一。

## 四、验证

### 4.1 三套回归脚本（全绿）

```
$ node majiang-mp/mp-tools/state-regression.cjs
✓ 23 个用例通过，0 个失败

$ node mp-tools/cards-regression.cjs
ALL PASS

$ node mp-tools/home-regression.cjs
✓ 140 个断言通过，0 个失败，2 个跳过
```

`home-regression.cjs` 新增/改动的断言：

```
三、首页底图：整幅一张，不再有拼接缝
  PASS  整幅底图素材存在：/static/ui/bg_home_full.webp
  PASS  模板里恰好引用一次整幅底图（单个 <image>，没有切片拼接）
  PASS  模板不再引用任何 bg_home_1~5.jpg 切片
  PASS  样式里切片规则 .home-bg-slice 已移除，改为整图规则 .home-bg-img
  PASS  体积在 200K 以内：/static/ui/bg_home_full.webp（178.2K）
  …（首页引用到的 13 个资源逐个量体积，全部达标）

七、页面跳转路径与 pages.json 一致
  PASS  跳转前给出加载提示 uni.showLoading
  PASS  跳转成功后关掉加载提示（success 分支）
  PASS  跳转失败后也关掉加载提示（fail 分支），不会卡住一个转圈
  PASS  hideLoading 不放在 complete 里（会把 fail 分支的 toast 一起关掉）
  PASS  pages.json 配了分包预下载 preloadRule
  PASS  分包已进预下载名单：pkg-game / pkg-cards
```

体积断言是对**首页引用到的每一张图**做的，不只是底图——换素材时最容易在这里翻车。

### 4.2 像素比对

新整图 vs 现状 5 片拼回（两者都是同一张原图的再编码，差异是两次独立压缩之和）：

```
全图 RMSE = 2.414    最大单通道差 = 40    差值 >8 的通道占比 = 1.287%
接缝带 y=2200~2280 RMSE = 3.100
```

RMSE 2.4（0~255 标度）远在肉眼可辨阈值以下；最大差 40 只出现在文字描边这类高对比边缘，
且占比仅 1.3%。对照上面的质量表，新图对**原始母版**的误差是 2.332，旧 5 片是 1.481，
两者都属于「与母版无可见差异」区间。

### 4.3 构建

```
$ cd majiang-mp && npm run build:mp-weixin
Compiler version: 5.24（vue3）
DONE  Build complete.
```

> 第一次执行报 `EPERM: operation not permitted, open '…/pkg-game/pages/game/game.js'`，
> 是上一次构建残留的文件句柄未释放（当时没有开发者工具在跑）。原样重跑即通过，
> 非代码问题。

产物核对：

| 检查项 | 结果 |
|---|---|
| `app.json` 是否带上 `preloadRule` | 有，`pages/index/index` → `network: all` + 两个分包 ✅ |
| `pages/index/index.wxml` 底图元素 | 只有一个 `class="home-bg-img" … mode="scaleToFill"` ✅ |
| `static/ui/bg_home_full.webp` 是否进包 | 在，182496 字节 ✅ |

### 4.4 分包体积

| 包 | 体积 |
|---|---|
| 主包（旧切片仍在包里） | **1.44 MB** |
| 主包（删掉旧切片后） | **0.92 MB** |
| pkg-game | 688.0 KB |
| pkg-cards | 555.3 KB |
| 整包合计 | 2.65 MB |

⚠️ **「待删除旧切片」是一件必须做的事，不是可选项。** 按任务要求
`bg_home_1~5.jpg` 暂时保留未删，但它们已经没有任何引用，现在纯属死重。
**留着的话主包从 1.27 MB 涨到 1.44 MB（净 +178K）；删掉才降到 0.92 MB（净 −356K）。**
提交前请执行：

```
git rm majiang-mp/src/static/ui/bg_home_1.jpg … bg_home_5.jpg
```

（本次遵守「禁止 git commit / 不动既有改动」的约束，没有代删。）

## 五、残留风险

1. **没做成实机渲染验收——这是本次最大的缺口。** 接缝是渲染期产物，最终证据本应是
   一张实机截图。为此写了 `mp-tools/shot-home-seam.cjs`（截整屏 + 裁接缝带 4 倍放大
   + 逐行平均亮度扫描，白线会表现为一条亮度尖峰），但微信开发者工具在本环境起不来：
   `launch-ide.cjs` 报 `Failed to launch wechat web devTools, please make sure http
   port is open`，9420 端口始终连不上（推测是无人值守环境下工具未登录 / 安全设置里
   CLI 端口未开）。
   **建议：** 人工开一次开发者工具（设置 → 安全 → 打开 CLI/HTTP 调用），
   再跑 `node mp-tools/shot-home-seam.cjs`，确认「相邻行最大跳变 < 6」且肉眼无线。

   > 另外尝试过用 sharp 离线模拟渲染（把 5 片各自缩到 487 行拼接 vs 整图连续缩放），
   > **没能复现出白线**。这不说明缝不存在——sharp 只能按整数行重采样，模拟不了合成器
   > 在亚像素位置上对图层边缘做的 alpha 抗锯齿，而那正是成因。所以这条模拟结论作废，
   > 不能拿来当「已验证」，实机截图不可替代。

2. **WebP 的兼容性。** 微信 `<image>` 组件支持 WebP，iOS 侧需要较新的基础库
   （2.9.0 起）。2026 年的线上基础库分布下实际风险很低，但这是**整屏底图**，
   万一解不出来就是一片空白，后果比普通图标严重。
   建议实机在 iOS 上看一眼；真要保险可以给 `.home-container` 的
   `background-color` 换成底图主色调（现为 `#55a297`），至少不会白屏。

3. **热区对齐依然依赖底图不换版。** 这次是同一张画换封装，15 个热区坐标一个没动，
   风险为零；但上一轮记录里的「残留风险 6」依然成立——哪天真换美术稿，
   `home-regression.cjs` 只能验「不重叠、定义完整」，验不了「压在按钮上」。

4. **`build-home-bg.cjs` 钉死了一个 git blob 哈希** (`e65155cd`)。
   源图只存在于历史提交里，工作区没有副本。如果哪天 rebase/filter-repo 重写了历史，
   这个 blob 可能被 gc 掉，脚本就跑不了了。要长期可重建的话，建议把那张 1.08MB 原图
   单独归档到仓库外的素材目录。
   （脚本里没写 `1fe3702^:路径` 而是直接钉 blob，还有个现实原因：`execSync` 在
   Windows 上走 cmd.exe，`^` 会被当成转义符吃掉，`1fe3702^` 会变成 `1fe3702`。）

5. **预下载会多占玩家流量。** `network: "all"` 意味着 4G/5G 下也会预下载
   pkg-game + pkg-cards（合计约 1.2 MB）。这是拿流量换「开始游戏」的响应速度，
   符合本次优化意图；如果产品上更在意流量，把 `network` 改成 `"wifi"` 即可，
   回归脚本里那条 `network === 'all'` 的断言要同步改。

6. **用户提供的两份新素材本次没有采用**（`0a95….jpg` UI 拼板、`9df3….jpg` 纯背景），
   原因见第二节。它们没有进仓库。如果后续确实想走分层方案（比如要让 UI 元素支持
   换肤、或让数值全部动态化），这两份素材仍然是起点，但那应当作为一次独立的
   「首页重做」任务来排，而不是混在消除接缝里。

---

# R3 首页分层重构 —— 改用美术给的「无按钮背景 + 无数字透明 UI」两份母版

- 日期：2026-09-18
- 范围：`majiang-mp/src/pages/index/index.vue`、`pages/splash/splash.vue`、
  `pkg-game/pages/game/game.vue`；`src/static/ui/home/` 全套新素材；`mp-tools/` 四个新脚本
- 工作区状态：**未提交、未 stash、未 reset**
- 母版：`mp-tools/art-src/home_bg_master.png`（941x1672，无按钮背景）、
  `mp-tools/art-src/home_ui_master.png`（1312x1199，带 alpha 的整版 UI，数值留空）
  —— 两张都已归档进仓库，不再像 R2 那样钉死一个 git blob 哈希

## 一、这一轮做了什么

R2 选了保底方案（整幅 WebP 单图），并在「残留风险 6」里写明**用户提供的两份分层素材没有采用**。
这一轮把 R2 跳过的 P1 分层方案补上了，同时顺手解决了 R2 解决不了的两个问题。

| | R2（整幅单图） | R3（分层，当前） |
|---|---|---|
| 首页素材文件数 | 1 | 15（1 背景 + 14 精灵） |
| 单文件最大体积 | 178K（贴着 200K 红线） | **59.8K** |
| 首页素材合计 | 727K（旧 5 片 549K 未删 + 整图 178K） | **344K** |
| 主包 | 1593K | **1249K** |
| 顶栏右上角 | 烤着仿微信胶囊 ··· ⊗ + 仿游戏圈图标 | **两块都没抠进来**，让给真正的胶囊 |
| 数值（金币/体力/宝箱/集卡） | 烤死在图里，靠不透明色块盖住再写新值 | 图上是空凹槽，数值全部 `<text>` |
| 拼接横线 | 已消除（单个 `<image>`） | 同样不存在（背景仍是单个 `<image>`） |

## 二、为什么必须逐元素抠图，不能「两张图叠一叠」

母版 `home_ui_master.png` 的画布是 1312x1199（比例 1.09），手机屏是 0.45。
第一反应是把两张图都 `scaleToFill` 铺满叠起来，实测**不行**：

- 整张拉伸到 1260x2800，图标会被纵向拉长 2.4 倍，明显变形；
- 按比例缩放摆中间，UI 只能占屏幕纵向 41%，下半屏空着。

原因是这份母版不是「把原设计整体压扁」，而是**把纵向留白抽掉后重新紧凑排布**的：
上面元素之间几乎没有空隙，而真实首页中段有一大片草地留白。
既然元素间距关系变了，就只能逐个抠出来按屏幕坐标重摆。

## 三、坐标体系（改版前务必读）

三个脚本共用一份坐标真相源 `mp-tools/home-layout.cjs`：

- `src` —— 元素在母版上的像素矩形（人工量的）
- `box` —— 元素在屏幕上的位置，只写 `left` / 纵向中心 `cy` / `width` 三个百分比
- `slots` —— 数值凹槽在母版上的像素矩形

`buildLayout()` 负责换算，关键约定有两条：

1. **box 的高度是算出来的，不是填的**：`height% = width% × (1260/2800) × (图高/图宽)`，
   于是 box 宽高比恒等于图片宽高比。
2. **精灵一律 `mode="scaleToFill"`**。配合第 1 条，scaleToFill 等价于等比缩放，图不会变形；
   而 scaleToFill 的好处是图在 box 里的位置是确定的（铺满），
   所以「数值相对图片的位置」可以线性映射成 box 内百分比，**换任何屏幕比例都对得准**。
   > 这里特意没用 `aspectFit`：aspectFit 会在 box 里居中留白，留白量随设备比例变化，
   > 数值文字就会跟着飘。回归脚本里有一条断言专门钉死这一点。

几何由 `build-home-layers.cjs` 回写进 `index.vue` 的
`/* AUTOGEN:HOME-LAYERS:BEGIN … END */` 段，手抄必错。
回归脚本会逐条比对「源码里的 CSS」和「布局表算出来的数字」，
有人手改了 AUTOGEN 段或改了布局表忘了重跑构建，都会被抓住。

## 四、热区：精灵自身就是热区

旧版是「整屏底图 + 15 个独立标定的透明热区」，热区坐标和美术坐标是两套数字，
R1 的「残留风险 6」点名过这个隐患：换美术稿时热区不会跟着动。

现在 `@tap` 直接挂在 `.spr` 盒子上，看到的就是点得到的，两套数字合成了一套。
唯一的例外是顶栏——金币段和体力段共用一张图，所以在盒子内部切了两个子热区
`.tap-coins` / `.tap-stamina`，分界线取爱心的左边缘（图宽的 44.25%）。

## 五、母版上被刻意丢弃的两块

| 母版坐标 | 内容 | 为什么不抠 |
|---|---|---|
| x=983-1260 y=38-141 | 仿微信胶囊（··· 与 ⊗） | 模仿系统 UI，审核风险；且真机上会和真胶囊并排出现两个 |
| x=862-968 y=42-150 | 仿游戏圈图标 | 伪造平台功能入口 |

丢掉之后右上角整块让给真正的微信胶囊，实机截图已确认两者不打架
（顶栏到 65%，胶囊从 77% 起）。

## 六、⚠️ 需要美术补一版的问题

母版上**幸运礼包那块瓷砖的文字标签误写成「每日任务」**，和它下面那张 DAILY 日历撞名。
标签是压在瓷砖下沿上画的，抠不干净（切在瓷砖圆角以上会削掉图案，切在下面会留半行字）。

当前处理：让倒计时胶囊**常驻显示**，槽位正好框住那行错字（母版 y=518~578），
既还原了 R1/R2 版「礼包 + 倒计时」的观感，也不会把错字露给玩家。
实机截图确认盖得严实。

**这是权宜之计。** 要彻底修好，需要美术重出一版标签正确（或干脆不带标签）的礼包图块，
替换 `art-src/home_ui_master.png` 后重量一次 `tileLucky` 的 `src`，重跑构建即可。

## 七、新增 / 改动的脚本

| 脚本 | 作用 |
|---|---|
| `mp-tools/home-layout.cjs` | 坐标真相源（母版矩形 → 屏幕百分比 → 槽位百分比） |
| `mp-tools/build-home-layers.cjs` | 切图 + 编码 + 200K 校验 + 回写 index.vue 的 AUTOGEN 段 |
| `mp-tools/mock-home.cjs` | 离线预览：不起 IDE 就能看排版，字号按真实 rpx 换算 |
| `mp-tools/verify-home-layers.cjs` | **运行期**验收：连开发者工具，查节点/尺寸/文字/点击/截图/报错 |
| `mp-tools/audit-precheck.cjs` | 「代码质量检测」里可静态验的部分（体积/HTTPS/废弃接口/图片尺寸） |
| `mp-tools/home-regression.cjs` | 第三、六节整体重写，对齐分层结构 |
| `playtest*.cjs` / `repro-home.cjs` | 选择器从 `.hotspot-*` 换成 `.spr-*` |

删掉的：`build-home-bg.cjs`（产出的 `bg_home_full.webp` 已不再使用）、
`shot-home-seam.cjs`（接缝检查，背景已是单图，没有缝可查）。

## 八、编码选型

| | near-lossless | **q88（采用）** |
|---|---|---|
| 14 个精灵合计 | 826K | **278K** |
| 观感 | — | 1:1 显示尺寸下与 near-lossless 无可辨差异 |

`alphaQuality: 100` 把 alpha 通道单独保成无损，所以硬边描边不会糊出彩边；
色彩通道 q88 省下的 500K 直接进了主包预算。背景同样 q88，941x1672 → 66K。

## 九、验证

### 9.1 静态回归（纯 Node，不需要开发者工具）

```
$ node mp-tools/home-regression.cjs     ✓ 292 个断言通过，0 个失败，2 个跳过
$ node mp-tools/cards-regression.cjs    ALL PASS
$ node majiang-mp/mp-tools/state-regression.cjs   ✓ 23 个用例通过，0 个失败
$ node mp-tools/audit-precheck.cjs      ✓ 22 项通过，0 项不通过
```

`audit-precheck` 覆盖的代码质量规则：

```
一、图片和音频资源不应超过 200K
  PASS  构建产物里找到 92 个图片/音频资源
  PASS  没有资源超过 200K              （最大的一个是 splash_bg.jpg 193.3K）
二、代码包体积
  PASS  主包 1109.7K ≤ 2MB
  PASS  分包 pkg-game 688.0K / pkg-cards 555.3K ≤ 2MB
  PASS  整包合计 2353.0K ≤ 20MB
三、PASS  没有明文 http:// 请求
四、PASS  业务代码没有直接调用废弃接口
五、14 个精灵原图/渲染面积比 0.88 ~ 1.58，均 ≤ 2（没有「图片尺寸过大」）
```

> 第四项原本是 FAIL：`game.vue` 里两处 `uni.getWindowInfo ? … : uni.getSystemInfoSync()`。
> `wx.getSystemInfoSync` 自基础库 2.20.1（2021 年）起停止维护，检测面板会当废弃接口扣分，
> 哪怕它只是回退分支。已去掉回退直接用 `uni.getWindowInfo()`——
> 本项目的首页底图本来就要求 2.9.0+ 才解得了 WebP，门槛没有因此抬高。
>
> uni-app 运行时 `common/vendor.js` 内部仍有 `wx.getSystemInfoSync`，属框架实现改不动；
> GUI 面板若仍提示这一条，来源是它，不是业务代码。

### 9.2 运行期验收（微信开发者工具，本轮终于跑通了）

R2 的「残留风险 1」是没做成实机渲染验收。这一轮解决了：开发者工具进程已在运行时，
`automator.launch()` 会因为「IDE 已占用另一个 HTTP 端口」直接失败，
正确做法是先手动开自动化端口再连：

```
$ cli.bat auto --project <dist 路径> --auto-port 9420    # 后台常驻
$ node mp-tools/verify-home-layers.cjs
```

```
✓ 42 项通过，0 项不通过
  14 个精灵节点全部存在且尺寸非零（WebP 在渲染层解得出来）
  金币 1300 / 体力 5max / 关卡宝箱 0/5 / 星星宝箱 3/500 / 集卡 1/9
  / 礼包倒计时 00:00:00 / 关卡2 —— 数值文字全部渲染出内容
  点 .spr-tileLucky → 幸运礼包弹窗弹出；点 .spr-tilePiggy → 存钱罐弹窗弹出
  整屏截图 mp-tools/work/home-real.png
  无未捕获异常、无 console.error
```

实机截图逐项核对：顶栏「1300」「5 max」都在凹槽内不顶加号；
右上角只有一个真微信胶囊；幸运礼包错字被倒计时胶囊盖住；
集卡进度「1/9」落在牌堆上；200/300/500 各自落在对应金币下方。

### 9.3 构建

```
$ cd majiang-mp && npm run build:mp-weixin
DONE  Build complete.
```

## 十、残留风险

1. **幸运礼包瓷砖的错字标签**，见第六节。当前靠倒计时胶囊遮住，不是根治。

2. **WebP 兼容性**（沿用 R2 的判断）。微信 `<image>` 支持 WebP，iOS 侧需基础库 2.9.0+。
   与 R2 相比风险其实**降低**了：以前整屏就一张图，解不出来就是满屏空白；
   现在解不出来的最多是单个图标，`.home-container` 的兜底色 `#55a297` 仍在。
   开发者工具模拟器已确认能解，真机 iOS 建议再看一眼。

3. **背景分辨率下降**。母版 941x1672 比 R2 的 1260x2800 小，在 1080 物理像素宽的机器上
   要放大约 1.15 倍。背景是连续色调的天空+草地渐变，放大后肉眼看不出，
   实机截图也确认了；但如果以后要在背景上放细节（比如更多小动物），得让美术出更大的母版。

4. **分包预下载会多占流量**（沿用 R2）。`network: "all"` 意味着 4G/5G 下也预下载
   pkg-game + pkg-cards（约 1.2MB）。改成 `"wifi"` 的话，回归脚本里那条
   `network === 'all'` 的断言要同步改。

5. **代码质量检测的运行期项仍未覆盖**：setData 体积与频率、渲染层节点数、首屏耗时。
   这些必须在 GUI 面板里跑，`cli.bat` 没有对应子命令。`audit-precheck.cjs` 末尾列了清单。

6. **开发者工具的自动化端口不会自己起来**。跑 `verify-home-layers.cjs` 之前得先执行
   `cli.bat auto --auto-port 9420`（或关掉已有 IDE 窗口让脚本自己拉起）。
   脚本已经会先尝试连 9420、连不上再拉 IDE，但 IDE 已在运行时那条路径必然失败，
   这是开发者工具自身的限制。

---

# R4 转小游戏 —— 现状勘察（未完成，卡在两处人工操作）

- 日期：2026-09-18
- 起因：`wx0ef60ee65a5abc73` 这个账号注册时选的是**小游戏**，不是小程序
- 结论先说：**这不是在开发者工具里改个「项目类型」就行的事，是一次移植。**
  已建 `majiang-game/` 骨架并勘察完可行性，本体代码尚未动工。

## 一、为什么不能只改项目类型

小程序和小游戏是两套运行时：

| | 小程序 | 小游戏 |
|---|---|---|
| 入口 | `app.json` + 页面目录 | `game.json` + `game.js` |
| 视图 | WXML / WXSS，有页面和组件树 | 只有一块 `wx.createCanvas()`，没有 DOM |
| 路由 | `navigateTo` / 分包 | 没有页面概念，自己管场景切换 |
| 布局 | CSS | 全部自己算坐标、自己画 |

而当前项目是 uni-app 编出来的小程序。**uni-app 没有小游戏编译目标**——
`majiang-mp/node_modules/@dcloudio/` 下只有 `uni-mp-weixin / alipay / baidu / qq / toutiao /
kuaishou / jd / lark / xhs / harmony`，没有任何 mini-game 目标，`package.json` 的
build 脚本里也没有。所以现有的 `npm run build:mp-weixin` 产物换个 appid 是跑不起来的。

## 二、勘察结论：移植量比想象的小

### 2.1 能原样搬过去的（~1285 行）

`src/game/` 整个目录本来就是为 canvas 写的，`canvas-board.js` 的文件头甚至明确写着
「Nothing here touches the DOM」。全目录只用到 7 个 `uni.*` API：

| uni API | 小游戏对应 |
|---|---|
| `uni.createOffscreenCanvas` ×2 | `wx.createCanvas()` |
| `uni.createInnerAudioContext` | `wx.createInnerAudioContext()` |
| `uni.setStorageSync` / `getStorageSync` | `wx.setStorageSync` / `getStorageSync` |
| `uni.vibrateShort` | `wx.vibrateShort()` |
| `uni.createSelectorQuery` | **不需要**——小游戏直接 `wx.createCanvas()` 拿画布 |
| `uni.showToast` | **没有对应**，得自己在 canvas 上画一个 toast |

另外两处依赖：
- `platform.js` 里的 `document.*` 已经包在 `typeof document !== 'undefined'` 里（H5 分支），小游戏侧走不到；
- `state.js` 依赖 vue 的 `reactive` / `watch`，这是唯一的框架耦合，换成一个几十行的
  「改了就标脏、下一帧重画」的小观察者即可。

也就是说：**一个 `wx` 薄壳 + 去掉 vue 响应式 + 自绘 toast，核心玩法就过去了。**

### 2.2 必须重写的（~3943 行 Vue）

| 文件 | 行数 | 说明 |
|---|---|---|
| `pages/index/index.vue` | 1814 | 首页 + 全部弹窗（礼包/存钱罐/任务/商城/设置/宝箱奖励） |
| `pkg-game/pages/game/game.vue` | 1207 | 牌桌页，其中 canvas 部分可留，HUD 与结算弹窗要重画 |
| `pkg-cards/pages/cards/cards.vue` | 750 | 集卡页 |
| `pages/splash/splash.vue` | 172 | 启动页进度条 |

这些是 WXML + WXSS，小游戏里一行都用不了，全部要变成 canvas 绘制 + 自己做命中测试。

### 2.3 R3 的分层改造刚好是这次移植的输入

上一轮把首页从「一整张烤死的位图」拆成了 14 个独立精灵，并把几何集中到
`mp-tools/home-layout.cjs`：每个元素有母版像素矩形、屏幕百分比盒子、内部数值槽位。

**canvas UI 需要的正是这三样东西。** 首页从小程序搬到小游戏，不用重新量坐标，
直接拿 `buildLayout()` 的输出喂给一个 `ctx.drawImage` 循环，命中测试用同一批矩形。
素材（15 个 WebP，344K）也能原样复用。这一步算是提前做掉了。

## 三、卡住的两件事（都需要人工在 GUI 里操作一次）

### 3.1 登录账号不是该小游戏的开发者

```
$ cli.bat open --project C:\mydev\majiang\majiang-game     # appid = wx0ef60ee65a5abc73
✖ 错误 Error: 登录用户不是该小程序的开发者 (code 10)
```

开发者工具当前登录的微信号，在 `wx0ef60ee65a5abc73` 下没有开发者权限。
**要么**用绑定该小游戏的微信号重新登录开发者工具，
**要么**在小游戏管理后台「成员管理」里把当前这个微信号加成开发者。

### 3.2 CLI 打开的项目一律按小程序编译

`project.config.json` 里写了 `"compileType": "game"`，但开发者工具日志里始终是：

```
[BuilderFactory] getBuilder ... platform=mini-weixin
[appservice] simulator launch catch error Error: app.json: 在项目根目录未找到 app.json
```

41 处 `platform=` 全是 `mini-weixin`。项目类型看来是记在 IDE 的项目列表条目里，
而不是从 `project.config.json` 读的，`cli open` 也不接受类型参数。

**需要在开发者工具 GUI 里「导入项目」，项目类型手动选「小游戏」，指向
`C:\mydev\majiang\majiang-game`。** 导入一次之后后续 CLI 打开应该会沿用该类型。

> 顺带修掉一个真 bug：`game.json` 里写 `"workers": ""` 会让配置解析直接失败
> （`game.json: ["workers"] 不能为 ''`）。不用 worker 就别写这个字段。

## 四、自动化验收要换一套

**`miniprogram-automator` 驱动不了小游戏。** 端口连得上，但 `systemInfo()` /
`screenshot()` 等任何 RPC 都 `timeout waiting for automator response`——
它整个 API 是按「页面 / 组件 / 选择器」建模的，而小游戏没有页面。
`cli.bat auto` 本身也是小程序专用命令，它会强制以 `platform=mini-weixin` 启动，
反倒把小游戏项目当小程序编译。

所以 R3 建的 `mp-tools/verify-home-layers.cjs`（连 9420、查节点、点热区、截图）
**在小游戏侧整套失效**，要换成「游戏自己往外写、Node 读磁盘」：

- `wx.setStorageSync()` → 开发者工具落到
  `User Data/<hash>/WeappLocalData/localstorage_*.json`，Node 可直接读；
- `canvas.toTempFilePath()` + `wx.getFileSystemManager().copyFileSync()` →
  写到 `wx.env.USER_DATA_PATH`，当截图用。

`majiang-game/game.js` 里这两个出口已经埋好了，等项目能以小游戏身份跑起来就能验证。

## 五、建议的推进顺序

1. 人工解掉第三节的两件事，确认探针画面能出来（这是一切的前提）。
2. 落地「游戏自己写、Node 读盘」的验收脚本，先把这条反馈回路打通——
   没有它，后面每一步都只能靠肉眼看模拟器。
3. 搭最小骨架：`wx` 薄壳 + 场景管理（splash / home / game / cards）+ 帧循环 + 命中测试。
4. 搬核心玩法：`src/game/` 七个文件 + 素材，牌桌先跑起来。
5. 用 `home-layout.cjs` 把首页画到 canvas 上（几何现成，工作量主要在弹窗）。
6. 集卡页、各类弹窗、结算面板。
7. 重跑体积与合规检查：`audit-precheck.cjs` 里体积/HTTPS/图片尺寸几节可以直接复用，
   小游戏主包上限同样是 2MB。

## 六、这一轮实际改了什么

- 清掉旧切片的最后残留：`dist/build/h5/static/ui/bg_home_[1-5].jpg` 与
  `mp-tools/fit200/`（源码侧 R3 已清，这两处是构建产物和临时目录）。
  现在全仓库搜 `bg_home_[1-5]` / `bg_home_full` 零命中。
- 新增 `majiang-game/`：`game.json` + `game.js`（连通性探针）+ `project.config.json`
  （`compileType: "game"`，appid `wx0ef60ee65a5abc73`）+ `README.md`。
- **`majiang-mp/` 一行没动**，小程序版本仍然是 R3 验收通过的状态，随时可跑可对照。

---

# R5 转小游戏 —— 骨架 + 核心玩法跑通

- 日期：2026-09-18
- 结论先说：**R4 卡住的两件事绕过去了，本体已经能玩。**
  启动页 → 首页 → 牌桌 → 集卡页 全线打通，发牌/点牌/消除/道具/倒计时/结算与小程序版一致。

## 一、先把反馈回路换掉（R4 第五节的第 2 步）

R4 停在「必须有人在开发者工具 GUI 里登录正确账号 + 手选小游戏类型导入项目」。
这一轮改用 `~/.claude/skills/@tencent-adm/weixin-minigame-helper` 这个 Skill 提供的 MCP
服务（`@weadmin/weixin-minigame-helper-mcp`），它把小游戏跑在**本地浏览器预览**里，
提供 `run_game` / `get_logs` / `capture_screenshot` 三个工具——开发期完全不碰开发者工具。

两处要记下来的坑：

- **Windows 上 `npx` 起不来。** Skill 写进 mcp.json 的 entry 是
  `npx -y @weadmin/...`，在本机 spawn 直接 `EINVAL`（Node 对 .cmd 的安全限制）。
  改成 `node <全局安装路径>/mcp/index.js --platform skill` 就正常了。
- **AI host 的工具表是会话启动时定的**，配置刚写进去的那个会话接不上。
  所以有了 `mp-tools/minigame-mcp.cjs`：自己当 MCP client，把 server 放进一个常驻守护进程
  （状态——预览服务、页面 websocket、日志缓冲区——都在 server 进程内存里，
  「起进程→调一次→杀进程」第二条命令就会拿到 "Game is not running"），
  再用本地 HTTP 控制口转发 run / logs / shot。

```bash
node mp-tools/minigame-mcp.cjs cycle   # 改完代码就跑这个：热重载 + 只看 error/warn
node mp-tools/minigame-mcp.cjs shot    # 截图落到 devtools_shots/
```

首次 run 后要在浏览器打开它给的 URL，预览服务要有页面连上来才有画面和日志。

`majiang-game/probe.js`（原 game.js 里那个「游戏自己写盘、Node 读盘」的探针）
不再是主路径，留作兜底。

## 二、移植量确认：R4 的估算是对的

- **原样搬过来的**：`src/game/` 五个文件（game-core / canvas-board / tile-motion /
  tile-poses / shuffle-hands），玩法逻辑一行没改。
- **重写的**：`platform.js`（uni.* → wx.*，toast 改自绘）、`state.js` → `store.js`
  （去 vue 化）、四个场景的 UI。
- **省掉的**：R3 的首页分层改造让首页坐标一个都不用重量，
  `buildLayout()` 的输出直接喂给 drawImage 循环，命中测试用同一批矩形。

## 三、移植中新发现的四个坑

1. **小游戏运行时是 CommonJS，不是 ESM。** `import` 直接
   `SyntaxError: Cannot use import statement outside a module`。全部改 require/module.exports。
2. **循环 require 拿到半成品 exports。** ui.js 要读屏幕宽高、app.js 要调 ui.js 画 toast，
   互相 require 之后先被引的那个拿到的 `screen` 是 undefined。拆出了 `src/screen.js`。
3. **全局必须用物理像素作画，不能 `ctx.scale(dpr)`。** canvas-board 把每张牌合成到离屏画布
   再 blit，画布按「牌宽 w」开；w 是逻辑像素的话 dpr=3 机器上整盘牌糊掉。
   代价是不能写死字号，UI 尺寸一律按屏幕百分比算。
4. **canvas 没有事件冒泡。** 弹窗遮罩要自己登记热区吞掉点击，否则结算界面点到的是下面的牌。

## 四、这一轮的产物

- `mp-tools/minigame-mcp.cjs`：小游戏 MCP 命令行驱动（守护进程版）。
- `majiang-game/game.js` + `src/`（screen/app/ui/platform/store/home-layout + game/ + scenes/）。
- `majiang-game/static/`：2.0MB 素材，主包共 2.2MB（小游戏主包上限 4MB，暂时不用分包）。
- 验收截图：`devtools_shots/mg-00-splash.png`、`mg-01-home.png`、`mg-02-board.png`、`mg-03-cards.png`。

## 五、还没做的（下一轮）

1. 首页那批弹窗：幸运礼包、存钱罐、每日任务、商城、主题装扮、添加桌面、
   关卡/星星宝箱领取；牌桌的道具补给购买弹窗；集卡页的兑换屋/赛季商店/赛季收藏。
   现在点这些入口只给一条 toast 说明，没有假装做完。
2. 广告相关流程（看视频得道具/碎片）整套没搬。
3. **合规**：`static/cards/cards_top_disc.jpg` 右上角烤着一个仿微信胶囊（··· ⊗），
   与 R3 从首页母版剔掉的 `fake_capsule` 同一类问题，且小游戏里真实胶囊就在同一位置。
   这张图小程序版也在用，是历史遗留，需要重出美术。
4. 提审前仍需在开发者工具里把项目按「小游戏」导入一次（真机预览与上传只能走它）。

---

# R6 转小游戏 —— 弹窗补齐 + 仿微信胶囊清除

- 日期：2026-09-18
- 结论先说：**R5 第五节列的「还没做的」1、3 两项做完了，第 2 项（广告流程）除真实广告
  投放外也接好了。** 小游戏侧现在没有「点了只给一条 toast 说还在搬」的入口。

## 一、合规：集卡页头图上的仿微信胶囊，拆掉了

R5 把它列为必须重出美术。实际不用重画——那个药丸是**常数 alpha 的纯色叠加**，
可以直接反算还原，底下的美术一个像素都不用猜。

量出来的参数（`mp-tools/fix-disc-capsule.cjs` 里都是常量，可复核）：

- 药丸：圆角矩形 x946–1230、y179–281、圆角半径 ≈51（就是半高，一个胶囊形）；
- 叠加：颜色 ≈ rgb(16,16,16)、alpha ≈ 0.301
  （沿上下边界取 313 个样本，中位数 0.3026；最小二乘拟合 `in = 0.6987*out + 4.71`）。

于是 `out = (in - a*16) / (1 - a)` 还原 25068 个像素，连被 ⊗ 压住的「视频宝箱」
徽章金色天线都回来了。剩下三处得另外处理：

1. **硬边两侧的 JPEG 振铃**：常数 alpha 算不回来，沿圆角矩形的法线从两侧各取一个
   干净样本插值抹平（`sdf()` 求法线）。
2. **三个「···」点**：不透明白色，信息真丢了。它们落在平涂背景上，用扩散填充
   （反复取邻域均值，收敛到调和解）比模型重画更稳，也不会带进色调差。
3. **那个 ⊗**：压着徽章的天线和金边，只能重画。把徽章周围 200x200 裁出来放到 1024
   送生图模型（`mp-tools/genart.cjs edit`），产物按「未遮罩像素」做配准 + 逐通道色彩回归，
   再只把遮罩里的 4988 个像素贴回来。

两份拷贝（小游戏 `static/cards/`、小程序 `pkg-cards/static/ui/`）都已写回，
原图备份在 `mp-tools/art-src/cards_top_disc_master.jpg`，整条流程可反复重跑：

```bash
node mp-tools/fix-disc-capsule.cjs restore   # 反算还原 + 产出遮罩 + 裁出送模型的那块
node mp-tools/genart.cjs edit --image mp-tools/work/disc/badge-in.png --size 1024x1024      --out mp-tools/work/disc/badge-out.png --prompt "...去掉白色圆圈叉，补回金色天线..."
node mp-tools/fix-disc-capsule.cjs paste     # 配准 + 色彩回归 + 按遮罩回贴 + 扩散填点
node mp-tools/fix-disc-capsule.cjs apply     # 写回两份素材
```

### 这一段里最值得记的坑

**sharp 对单通道 raw 做 `blur()` 会吐回 3 通道的 sRGB。** 按 1 通道取下标会整层拿到 0，
表现是「贴了个寂寞」——原图一个像素没变，而且不报错。第一次用模型重绘失败、
以为是「模型把 ⊗ 又画回来了」，其实压根没贴上去。`genart.cjs` 和
`fix-disc-capsule.cjs` 现在都按 `info.channels` 取。

另外**模型的 edit 不是局部重绘**：它把整张图重新生成，未遮罩区只是「尽量还原」，
尺寸还只能从它支持的那几档里选。所以必须自己做配准 + 按遮罩回贴，否则整版美术
会被悄悄改一遍（R5 时实测过：转盘中央凭空多个灰圆、比例从 1.546 变成 1.5）。

## 二、顺手修的：两个「假透明」图标

`icon_crown_coin.png`（天蓝底）和 `icon_video_camera.png`（青底）的 alpha 早被压掉了。
小程序里它们贴在同色卡片上看不出来，小游戏把它们画到奶油色弹窗和金色按钮上就是色块。
`mp-tools/dekey-icons.cjs` 按图标自己的配色分两种抠法：

- 摄像机走**漫水**——它的主体就是底色那个青，整图按色差抠会把图标一起抠没；
- 金币走**色向**——它底下压着一圈投影（底色乘 0.65），色差 68 远超容差，漫水会被
  投影圈死在右下角，抠完剩一块蓝角；而投影与底色的余弦相似度 0.9995、金币本身只有 0.79，
  按色向一刀切得干净。

两边拷贝一起改，原图备份在 `mp-tools/art-src/icons-master/`。

## 三、弹窗层：`majiang-game/src/modals.js`

小程序那边一个弹窗 = 一段 WXML + 一坨 WXSS，`v-if` 管显隐、`@tap.self` 点遮罩关闭、
`scroll-view` 管滚动、`switch` 是现成组件。小游戏这四样都没有，各自还原成了一个原语：

| 小程序 | 小游戏 |
|---|---|
| `v-if` | 一个 `active` 字符串 + draw 里的 switch |
| `@tap.self` | 先登记整屏热区关闭，再登记面板热区吞掉点击（后登记的在上层） |
| `scroll-view` | onTouchMove 累加偏移 + `ctx.clip()` 裁可视区 + 自绘滚动条 |
| `switch` | 自绘药丸 + 圆点 |
| `uni.showModal` | 自绘 confirm 弹窗（两个按钮） |
| 文字折行 | `wrapText()` 逐字累加断行（中文没有词边界） |

**滑动与点击的区分**：手指动过 1vh 以上就算滑动，不触发按钮。没有这条，滑列表必然
误触到「领取」。

已搬的弹窗：幸运礼包、金库银行、每日/长线任务、商城、添加桌面、宝箱奖励、游戏设置、
体力说明、道具补给（牌桌）、兑换屋 / 赛季商店 / 赛季收藏（集卡页）、模拟激励视频。
玩法口径逐条照搬小程序：宝箱未满不发奖且领完清零、存钱罐满 300 才能取、任务领过置灰、
商城金币不足给提示、赛季商店扣款后直接抽卡不走广告。

**两处有意的差异**（都是小程序那边受框架限制才那么写的）：

1. 「是否看广告补满体力」小程序用 `uni.showModal`，这里改成自绘 confirm 弹窗；
2. 「添加到桌面」的 200 金币，小程序每点一次发一次；这里认 `desktopRewardClaimed`
   只发一次——那个字段本来就在存档里，白送无限金币不像是有意设计。

## 四、集卡逻辑：两份拷贝，用逐字比对钉住

小程序 `cards.vue` 里有一段 `#region cards-pure-logic`（抽碎片 / 集齐一次性发奖 /
重复碎片兑换），本来就是为了能被 `mp-tools/cards-regression.cjs` 提取出来单测才那么写的。
小游戏不能反过来 require 小程序目录（包不在一起），所以**逐字**搬成了
`majiang-game/src/game/cards-core.js`。

回归脚本新增第 [8] 节：比对两边标记区的正文是否**逐字相同**。这比「各自跑一遍断言」更强
——断言只能发现被测到的差异，逐字比对连注释改了都拦得住。`node mp-tools/cards-regression.cjs`
现在跑 8 节、全绿。

## 五、验收

预览回路仍是 R5 那套（`mp-tools/minigame-mcp.cjs`，浏览器预览 + 截图 + 日志，
不碰开发者工具）。canvas 上的弹窗没法从外部点开，所以 `DEBUG_SCENE` 扩展成
`'场景#弹窗名'`：

```
home#  settings lucky piggy tasks shop desktop chest ad
board# refill
cards# detail exchange seasonShop collection
```

截图落在 `devtools_shots/`：`mg-modal-*.png`（首页 8 个 + 牌桌补给）、
`mg-cards-*.png`（集卡页 4 个）、`mg-00-splash.png` / `mg-01-home.png`。
日志零 error/warn，全部 `.js` 过 `node --check`。

主包 2.6MB（新增 5 张弹窗美术约 350KB），小游戏上限 4MB。

## 六、还剩什么

1. **真实广告投放**：现在是本地模拟浮层（3 秒进度条），真接要换成
   `wx.createRewardedVideoAd`，回调位置就是 `modals.js` 里 `ad.cb` 那一处。
2. **主题装扮**：小程序侧本身也只是一条 toast，两边一致，不算缺口。
3. **提审前仍需在开发者工具里把项目按「小游戏」导入一次**（真机预览与上传只能走它）。

---

# R7 广告投放接入 + 后台统一管理

- 日期：2026-09-18
- 结论先说：**八个「看广告拿奖励」的入口都接上了真实激励视频，投放策略全部挪到运营后台。**
  R6 遗留的「真实广告投放」这一项做完了。

## 一、为什么配置放后台而不是写在代码里

广告位换了、某个入口的广告出问题要临时关掉、过审期间要整体切回本地模拟——这些都不该
重新发一次版。所以 `server/data/game-config.json` 多了一节 `ads`，客户端启动时拉
`/api/ads`（精简接口，只给广告要用的字段，不把关卡表、GM 开关下发到端上），
拉不到就用上次缓存、再不行用代码里的兜底默认值。

后台能改的：

| 项 | 作用 |
|---|---|
| 总开关 | 关掉之后所有「看广告」入口**直接发奖**，不弹任何东西 |
| 广告来源 | `mock` 本地模拟浮层（开发/过审前） / `wechat` 真实激励视频 |
| 激励视频广告位 ID | `adunit-` 开头；选了 wechat 却没填，保存时会被拦下 |
| 投放位开关 | 八个入口各一个，出问题时不用整个停掉广告 |
| 最小间隔 | 两次激励视频之间的冷却，防连点刷奖励 |
| 拉不到广告时 | 退回模拟照发奖（开发期） / 提示稍后再试不发奖（正式运营） |

统计也按投放位分开记（曝光 / 看完 / 失败 / 完成率），后台页面下方一张表。
不分开记就看不出是哪个位置的广告拉不到、哪个位置用户愿意看完。

## 二、客户端：`majiang-game/src/ads.js`

`modals.playAd(placement, cb)` 只负责「模拟浮层怎么画」和「拿到奖励做什么」，
三条路径都收在 ads.js 里：投放位被关 → 直接发奖；`mock` → 播浮层；`wechat` → 真广告。

### 四个真容易踩的坑（都写进注释并被回归覆盖）

1. **同一个广告位只能有一个实例。** `wx.createRewardedVideoAd` 对同一 adUnitId 返回的是
   同一个对象，`onClose` 反复注册会累积回调——播一次触发 N 次，发 N 份奖励。
   所以自己缓存实例，`onClose`/`onError` 只注册一次，转发给当次的 pending。
2. **只有看完才发奖。** `onClose(res)` 里 `res.isEnded` 为 true 才算看完；
   基础库 2.1.0 以下 `res` 是 undefined，那种老环境按看完处理（官方兼容写法）。
3. **`show()` 会 reject**（广告没预加载好），要 `load()` 之后重试一次再放弃。
4. **拉不到广告要不要照发奖是运营决策，不是技术决策**——所以做成后台开关，
   默认开发期照发、正式运营拦住。

## 三、后台页面本来是坏的

`server/public/index.html` 的逻辑全在一个 `<script>` 块里，而第 216 行的 innerHTML 拼接
写成了 `"<input type="number" ...>"`——双引号没转义，**整块语法错误**。
表现是页面能打开、样式正常，但统计不刷新、关卡表不渲染、保存和重置按钮点了没反应。
这一轮修掉了（改用单引号写 HTML 属性）。

为了不再犯，新增 `server/admin-check.cjs`：把 `<script>` 抽出来过一遍语法（就是当初漏掉的
那一关）、用最小 DOM 桩跑一遍广告配置的「渲染进表单再收回来」、校验脚本里每个
`getElementById` 的 id 在 HTML 里真的存在，并比对投放位清单与客户端 `ads.js` 是否一致。

## 四、怎么验的

浏览器预览连不上运营后台。一开始我判断成「垫片没有 `wx.request`」，**这是错的**，
后来在游戏里打了个探针才问清楚：垫片既有 `wx.request` 也有 `createRewardedVideoAd`，
但它把请求**重写到了预览服务自己的源**上——同一个 `http://localhost:3000/api/ads`，
curl 是 200，游戏里拿回来的是预览服务的 **404**。
所以预览里 provider 永远停在兜底的 `mock`，后台改了不会生效。
（教训：跨进程的东西「没反应」时，先让被测方自己把它看到的结果说出来，别靠推断。）
所以广告这块不靠肉眼点，靠 `mp-tools/ads-check.cjs`：把 ads.js 放进一个 wx 桩里，
把「微信会怎么回调」演一遍，9 节 30 条断言覆盖上面四个坑 + 开关矩阵 + 间隔拦截 + 上报格式。
其中第 1 节是真的去 GET 本机 server 的 `/api/ads`，上报也是真的打到 `/api/stats`——
跑完在后台能看到分投放位的数字。

```bash
node mp-tools/ads-check.cjs     # 广告链路（9 节全绿）
node server/admin-check.cjs     # 后台页面自检
node mp-tools/cards-regression.cjs
node mp-tools/audit-precheck.cjs
```

顺带记一笔：`mp-tools/minigame-mcp.cjs` 那个自建守护进程这次出过一次假故障——
浏览器标签页失联后，`shot` 仍然返回一张 18K 的全黑图，`logs` 永远 "No logs found"，
看起来像是代码把游戏跑崩了，实际只是页面没连上。本机的 MCP 工具表里其实就有
`weixin-minigame-helper` 的 `run_game` / `capture_screenshot`，直接用它换个端口重开就正常了。
**下次遇到「全黑 + 无日志」，先怀疑预览页面失联，别急着回滚代码。**

## 五、还剩什么

1. **真机验证**：桩能覆盖逻辑分支，覆盖不了「微信到底给不给广告」。开通流量主、
   填好广告位 ID 之后，必须在真机上把八个入口各点一遍。
2. **小程序版（`majiang-mp/`）还是自己那套模拟广告**，没接这个后台。两边共用同一个
   `/api/ads` 是可以的（uni 侧把 `wx.` 换成 `uni.`、`uni.createRewardedVideoAd` 同名），
   但那版已经验收通过，这一轮没动它。
3. 上线前：`src/ads.js` 的 `API_BASE` 换成线上 https 地址，并在小游戏后台
   「开发设置 - 服务器域名」把它加进 request 合法域名。
