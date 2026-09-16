# 麻将小程序开发交接文档 v2

## 1. 项目概况

**项目路径**：c:\mydev\majiang\majiang-mp  
**框架**：uni-app + Vue 3 (script setup)  
**编译输出**：c:\mydev\majiang\majiang-mp\dist\build\mp-weixin  
**微信开发者工具**：已打开并监听 dist 目录，会自动热重载  

---

## 2. 当前状态（截止本次交接）

### 已完成

- 首页背景+按钮：全景背景图 bg_home.jpg，透明热区无重影
- 幸运礼包弹窗：头图+道具格+倒计时+解锁按钮
- 金库银行弹窗：进度条+金猪图+领取奖励按钮
- 每日任务弹窗：每日/长线双Tab，任务列表，进度条
- 商城弹窗：金币+4种道具，金币购买+免费看广告
- 游戏对局页：canvas画牌，道具栏，暂停/通关/失败弹窗
- 集卡中心页：转盘区+9套卡片网格+集卡进度
- 最后编译：npm run build:mp-weixin 成功（本次交接前）

### 待验证

最近修复（刚做，build已成功但截图未更新）：
- game.vue：将 emoji 替换为真实图片（金币图标、视频图标）
- 需要重新截图验证 02~08 是否完全对齐参考图

---

## 3. 开发环境

### 微信开发者工具
- 安装路径：C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
- Automator 端口：9420 (ws://127.0.0.1:9420)
- 操作文档：c:\mydev\majiang\agent如何使用微信开发者工具\

### 截图工具
- 当前截图：c:\mydev\majiang\devtools_shots\（01~08，部分是旧版）
- 全量截图脚本：c:\mydev\majiang\mp-tools\full_v2.js
  运行：cd c:\mydev\majiang && node mp-tools/full_v2.js

### 参考截图（目标对齐）
位于 c:\mydev\majiang\miniprogram截图\

| 文件 | 页面 |
|------|------|
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
- src/pages/index/index.vue — 首页+所有弹窗（~1633行）
- src/pages/game/game.vue — 游戏对局页（~967行）
- src/pages/cards/cards.vue — 集卡中心页（~454行）
- src/game/state.js — 全局状态（金币、体力、任务、卡册等）（183行）
- src/game/game-core.js — 游戏核心逻辑（牌阵、匹配）
- src/game/canvas-board.js — Canvas渲染器
- src/game/tile-motion.js — 牌面动画
- src/game/platform.js — 平台适配层

### 静态资源目录
- src/static/ui/ — 背景图、弹窗艺术图、按钮图
- src/static/icons/ — 道具图标、视频图标、商城道具图
- src/static/tools/ — 游戏内道具小图标（tool-clear.png 等）
- src/static/bg/ — 游戏背景（meadow.png）
- src/static/tiles-face/ — 麻将牌面图

### 关键资源（重要）
- /static/ui/bg_home.jpg：首页全景背景
- /static/ui/lucky_chest_header.png：幸运礼包头图（已含"幸运礼包"字，不要再加文字！）
- /static/ui/piggy_hero_exact.png：金库银行金猪艺术图
- /static/ui/icon_crown_coin.png：金币图标（替代emoji）
- /static/icons/icon_video_camera.png：视频/广告图标（替代📺）
- /static/icons/shop_tool_undo/clear/magnet/shuffle/time.png：商城道具图

---

## 5. 技术约束（必读）

### Automator 注意
1. reLaunch 会断开连接：必须 mp.disconnect() 再重新 automator.connect()
2. currentPage() 需要重试：页面加载后可能短暂返回null，需循环重试（见full_v2.js的getPage函数）
3. tap用法：先 page.$(selector) 获取元素，再 element.tap()，不能 page.tap(selector)

### Emoji 渲染问题
- Windows 微信开发者工具（Chromium）中，特殊emoji如 coin/pig/bulb/TV 显示为空方块[x]
- 解决方案：一律用 <image> 标签替代，使用已有图片资源
- 已修复：game.vue 中的 coin 和 TV 图标
- 未验证修复效果：需重新截图确认

### 幸运礼包标题
- lucky_chest_header.png 图片本身已含立体文字"幸运礼包"
- 不要再叠加任何文字标题，否则会出现双重标题重影

---

## 6. 下一步工作

### 第一步：重新截图验证（最紧急）
```
cd c:\mydev\majiang
node mp-tools/full_v2.js
```

### 第二步：对比截图与参考图
查看 devtools_shots/ 中 02~08 截图，与 miniprogram截图/ 中对应参考图一一对比

### 第三步：修复仍不一致的地方
重点检查：
- 每日任务奖励图标（coin_sack_exact.png 金币袋 vs 方块）
- 游戏页道具补给弹窗购买按钮图标
- 集卡页是否正常显示（之前截图全白可能是截图时机问题）
- 如有其他emoji：查找 .vue 文件中的 emoji 字符，全部替换为图片

### 第四步：rebuild
```
cd c:\mydev\majiang\majiang-mp
npm run build:mp-weixin
```

---

## 7. Automator 弹窗调用方法

```js
// 首页弹窗（在 /pages/index/index 页面）
await page.callMethod('openLuckyBag');
await page.callMethod('closeLuckyModal');
await page.callMethod('openPiggyBank');
await page.callMethod('closePiggyModal');
await page.callMethod('openDailyTasks');
await page.callMethod('closeTasksModal');
await page.callMethod('openShopAll');
await page.callMethod('closeShopModal');

// 游戏页道具弹窗（在 /pages/game/game 页面）
await page.callMethod('openRefill', 'shuffle'); // clear/shuffle/undo/magnet
```

---

## 8. 构建命令

```
cd c:\mydev\majiang\majiang-mp
npm run build:mp-weixin
# 输出目录：dist\build\mp-weixin（已导入微信开发者工具）
```