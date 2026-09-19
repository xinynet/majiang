/* 首页分层素材的唯一坐标真相源。
 *
 * 背景：首页原本是「一整张烤死的位图」——按钮、图标、数值全部画进同一张图里。
 * 那种做法有三个跑不掉的问题：
 *   1. 体积。整屏 1260x2800 的图不管怎么编码都顶着微信「单个图片资源 ≤ 200K」的红线，
 *      上一轮是靠 WebP q86 压到 178K 勉强过线，一点余量都没有。
 *   2. 合规。烤进去的那条顶栏右侧带着一个仿微信胶囊（··· ⊗）和一个仿游戏圈图标，
 *      属于「模仿系统 UI / 伪造平台入口」，审核会挑。
 *   3. 数值。金币、体力、宝箱进度、集卡进度全是画上去的死数字，只能再叠一层不透明
 *      色块把原数字盖住再写新的，盖不准就露边。
 *
 * 现在改成「干净背景 + 逐元素透明精灵」：背景一张纯风景图，UI 元素各自一张带 alpha
 * 的小图，数值一律用 <text> 画。每个文件都只有几十 K，合规问题一并消掉。
 *
 * 坐标系说明（这是本文件最关键的约定，改之前务必读完）：
 *
 *   - `src` 里的数字是母版 art-src/home_ui_master.png（1312x1199）上的像素坐标。
 *     母版是美术给的「无数字透明按钮」整版 UI，元素在上面是紧凑排布的，
 *     它的画布比例（1.09）和手机屏幕比例（0.45）完全不同，所以**不能**整张拉伸铺屏，
 *     只能逐个元素抠出来再按屏幕坐标摆放。这也是必须做分层而不是「两张图叠一叠」的原因。
 *
 *   - `box` 里的数字是屏幕百分比（相对 .home-container）。宽度是人工定的（沿用上一版
 *     已验收的热区宽度），高度**不写死**，由 buildLayout() 按精灵自身宽高比算出来，
 *     保证 box 的宽高比 === 精灵的宽高比。
 *
 *     为什么要算而不是直接填？因为精灵一律用 mode="scaleToFill"。只要 box 比例和图一致，
 *     scaleToFill 就等价于等比缩放，图不会变形；而 scaleToFill 的好处是**图在 box 里的
 *     位置是确定的**（铺满），于是「数值文字在图上的相对位置」可以线性映射成 box 内的
 *     百分比，在任何屏幕比例的设备上都对得准。
 *     如果改用 aspectFit，图会在 box 里居中留白，留白量随设备比例变化，数值就会飘。
 *
 *   - `slots` 是元素内部要盖数值的位置，同样写母版像素坐标，由 buildLayout() 换算成
 *     「相对该元素 box 的百分比」。这样美术换版只要重新量一次 src/slots，
 *     屏幕坐标和 CSS 会自动跟着变。
 *
 * 设计基准屏：1260x2800（比例 0.45，和上一版烤死的整图一致，热区百分比据此标定）。
 */

/** 设计基准分辨率。只用来把「宽度百分比 + 精灵宽高比」换算成「高度百分比」。 */
const DESIGN = { W: 1260, H: 2800 };

/* 母版上要丢弃、不抠进小程序的区域，写在这里只为留痕：
 *   x=983-1260 y=38-141   仿微信胶囊（··· 与 ⊗）——模仿系统 UI，审核风险
 *   x=862-968  y=42-150   仿游戏圈图标——伪造平台入口，同上
 * 这两块不进 SPRITES，它们占据的右上角正好让给真正的微信胶囊。 */
const DROPPED = [
  { name: 'fake_capsule', src: { x: 983, y: 38, w: 278, h: 104 }, why: '仿微信胶囊，模仿系统 UI' },
  { name: 'fake_gamecircle', src: { x: 862, y: 42, w: 107, h: 109 }, why: '仿游戏圈入口，伪造平台功能' }
];

/* 元素清单。
 *
 * anchor 决定 box 的纵向对齐方式：
 *   'center' —— box 纵向中心对齐 cy（大多数图标，标签挂在图下方，居中最稳）
 *   'top'    —— box 顶边对齐 cy（顶栏、横幅这类上边缘是视觉基准的元素）
 *
 * 这里不再单列热区：精灵盒子自己就是热区（index.vue 里 @tap 直接挂在 .spr 上），
 * 「看到的」和「点得到的」按构造是同一个矩形。
 */
const SPRITES = [
  {
    key: 'gear', file: 'ui_gear.webp',
    src: { x: 58, y: 25, w: 129, h: 127 },
    box: { left: 2.5, cy: 6.6, width: 10 }, anchor: 'center'
  },
  {
    /* 顶栏是一整条：金币图标 — 空槽 — 加号 — 爱心 — 空槽 — 加号。
     * 两个空槽就是留给金币数和体力数的，slots 里量的就是它们。 */
    key: 'topbar', file: 'ui_topbar.webp',
    src: { x: 205, y: 35, w: 644, h: 106 },
    box: { left: 13.5, cy: 6.6, width: 52.5 }, anchor: 'center',
    /* 两个凹槽的边界是扫「深灰、不透明、低饱和」的连通块量出来的：
     * 金币槽 x=282~447（金币图标右缘到加号左缘），体力槽 x=597~766（爱心右缘到加号左缘）。
     * 这里各留几像素余量，尽量把可用宽度吃满——五位数金币和「3 14:02」都得放得下。 */
    slots: {
      coins: { x: 288, y: 55, w: 155, h: 75 },
      stamina: { x: 610, y: 55, w: 154, h: 75 }
    }
  },
  {
    key: 'chestLevel', file: 'ui_chest_level.webp',
    src: { x: 41, y: 170, w: 587, h: 205 },
    box: { left: 3.5, cy: 14.15, width: 45 }, anchor: 'center',
    slots: { progress: { x: 238, y: 268, w: 355, h: 77 } }
  },
  {
    key: 'chestStar', file: 'ui_chest_star.webp',
    src: { x: 678, y: 170, w: 590, h: 205 },
    box: { left: 53.5, cy: 14.15, width: 44 }, anchor: 'center',
    slots: { progress: { x: 712, y: 268, w: 356, h: 77 } }
  },
  {
    /* 冬日集卡横幅。母版上牌堆和三枚金币都是空的（无数字），
     * 进度「n/9」和 200/300/500 三档全部改成文字层。 */
    key: 'banner', file: 'ui_banner_cards.webp',
    src: { x: 325, y: 384, w: 669, h: 302 },
    box: { left: 21, cy: 24.2, width: 58 }, anchor: 'center',
    slots: {
      cards: { x: 374, y: 590, w: 86, h: 36 },
      coin1: { x: 553, y: 615, w: 86, h: 34 },
      coin2: { x: 709, y: 615, w: 86, h: 34 },
      coin3: { x: 867, y: 615, w: 86, h: 34 }
    }
  },
  {
    /* 幸运礼包。⚠️ 母版这块的文字标签写的是「每日任务」，和下面那张 DAILY 日历重名，
     * 应当是美术导出时的笔误。这里不改图，而是让倒计时胶囊常驻盖住标签区
     * （slots.timer 正好框住那行字），既还原了上一版「礼包 + 倒计时」的观感，
     * 也不会把错字露出来。要彻底修好需要美术重出一版无错字的图块。 */
    key: 'tileLucky', file: 'ui_tile_lucky.webp',
    src: { x: 46, y: 386, w: 208, h: 194 },
    box: { left: 3, cy: 22.85, width: 18 }, anchor: 'center',
    slots: { timer: { x: 48, y: 518, w: 204, h: 60 } }
  },
  {
    key: 'tilePiggy', file: 'ui_tile_piggy.webp',
    src: { x: 1054, y: 386, w: 213, h: 190 },
    box: { left: 79.5, cy: 23, width: 18.5 }, anchor: 'center'
  },
  {
    key: 'tileDesktop', file: 'ui_tile_desktop.webp',
    src: { x: 1055, y: 577, w: 214, h: 202 },
    box: { left: 79.5, cy: 31, width: 18.5 }, anchor: 'center'
  },
  {
    /* 左列三块在母版上是**连在一起**的：标签文字压着下一块的瓷砖顶边，
     * 连通域算法切不开。这三条 y 分界线是扫「整行 alpha 覆盖最少的那一行」
     * 找出来的（761 行只有 9 个不透明像素，939 行只有 2 个），
     * 从那里切下去不会削掉任何笔画。 */
    key: 'tileTask', file: 'ui_tile_task.webp',
    src: { x: 44, y: 588, w: 206, h: 174 },
    box: { left: 3, cy: 31.5, width: 18 }, anchor: 'center'
  },
  {
    key: 'tileChallenge', file: 'ui_tile_challenge.webp',
    src: { x: 44, y: 762, w: 206, h: 178 },
    box: { left: 3, cy: 39.9, width: 18 }, anchor: 'center'
  },
  {
    key: 'tileTheme', file: 'ui_tile_theme.webp',
    src: { x: 44, y: 940, w: 206, h: 134 },
    box: { left: 2.5, cy: 78.1, width: 18.5 }, anchor: 'center'
  },
  {
    key: 'tileCards', file: 'ui_tile_cards.webp',
    src: { x: 54, y: 1076, w: 193, h: 121 },
    box: { left: 2.5, cy: 86.1, width: 18.5 }, anchor: 'center'
  },
  {
    /* 「开始游戏」只取按钮本身。母版上按钮后面还压着一个写着「关卡」的深色胶囊，
     * 那个胶囊不抠——关卡号是动态的，用 CSS 画一个同色胶囊再写「关卡N」更省也更准。 */
    key: 'btnStart', file: 'ui_btn_start.webp',
    src: { x: 363, y: 833, w: 582, h: 206 },
    box: { left: 21, cy: 78.3, width: 58 }, anchor: 'center'
  },
  {
    key: 'tileShop', file: 'ui_tile_shop.webp',
    src: { x: 576, y: 1048, w: 160, h: 145 },
    box: { left: 28, cy: 90.6, width: 16 }, anchor: 'center'
  }
];

/**
 * 把上面的声明式清单展开成可直接写进 CSS 的几何数据。
 *
 * @returns {{key:string,file:string,src:object,css:{left:number,top:number,width:number,height:number},
 *            slots:Object<string,{left:number,top:number,width:number,height:number}>}[]}
 *          css 是相对 .home-container 的百分比；slots 里的百分比是**相对该元素 box** 的，
 *          直接用在 box 内的绝对定位子元素上。
 */
function buildLayout() {
  return SPRITES.map((s) => {
    // box 宽高比锁死等于精灵宽高比，scaleToFill 因此不会让图变形。
    const pxW = (s.box.width / 100) * DESIGN.W;
    const pxH = pxW * (s.src.h / s.src.w);
    const height = (pxH / DESIGN.H) * 100;
    const top = s.anchor === 'top' ? s.box.cy : s.box.cy - height / 2;

    const slots = {};
    for (const [name, r] of Object.entries(s.slots || {})) {
      slots[name] = {
        left: ((r.x - s.src.x) / s.src.w) * 100,
        top: ((r.y - s.src.y) / s.src.h) * 100,
        width: (r.w / s.src.w) * 100,
        height: (r.h / s.src.h) * 100
      };
    }

    return {
      key: s.key,
      file: s.file,
      src: s.src,
      css: { left: s.box.left, top, width: s.box.width, height },
      slots
    };
  });
}

/* CommonJS 版在 mp-tools/home-layout.cjs（小程序构建与验收脚本用），这里是同一份几何的 ESM 拷贝。
 * 两边必须同步改；坐标真相源是母版 art-src/home_ui_master.png。 */

module.exports = { DESIGN, SPRITES, DROPPED, buildLayout };
