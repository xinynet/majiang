/* 首页弹窗群（canvas 版）。
 *
 * 小程序侧每个弹窗是一段 WXML + 一坨 WXSS（index.vue 的「弹窗系统」那一节）：
 * `v-if` 控制显隐、`@tap.self` 点遮罩关闭、`scroll-view` 负责滚动、`switch` 是现成组件。
 * 小游戏这四样全都没有，所以这里把它们各自还原成一个原语：
 *
 *   显隐      —— 一个 `active` 字符串 + draw 里的 switch；
 *   点遮罩关  —— 先登记整屏热区关闭，再登记面板热区吞掉点击（后登记的在上层）；
 *   滚动      —— onTouchMove 累加偏移 + ctx.clip() 裁出可视区，见 scroller；
 *   开关      —— 自绘一个药丸 + 圆点。
 *
 * 广告不在这里实现：`playAd(placement, cb)` 只提供模拟浮层的画法，真实激励视频、
 * 后台下发的投放开关与数据上报都在 `ads.js`。
 *
 * 玩法口径全部照搬小程序：宝箱未满不发奖、存钱罐满 300 才能取、任务领过就置灰、
 * 商城金币不足给提示、所有「免费」入口都先走一遍模拟激励视频。差异只有两处，
 * 都是小程序那边受框架限制才那么写的：
 *   1. 小程序用 uni.showModal 问「是否看广告补满体力」，小游戏没有这个组件，
 *      改成弹窗内的两个按钮（confirm 弹窗，见 openConfirm）。
 *   2. 「添加到桌面」的 200 金币，小程序每点一次发一次；这里认 desktopRewardClaimed
 *      标记只发一次——那个字段本来就在存档里，白送无限金币不该是有意设计。
 */
const { screen } = require('./screen.js');
const {
  gameState, addCoins, spendCoins, addTool, refundStamina, formatLongSeconds,
} = require('./store.js');
const { toast } = require('./platform.js');
const ads = require('./ads.js');
const {
  img, loadImages, roundRect, text, textIn, drawContain, hit, tap, vw, vh, rem,
} = require('./ui.js');

/* 弹窗用到的素材。和小程序同名同图，拷到了小游戏包里。 */
const ART = {
  m_lucky_header: 'static/ui/lucky_chest_header.jpg',
  m_piggy_hero: 'static/ui/piggy_hero_exact.jpg',
  m_desktop_card: 'static/ui/desktop_modal_card.png',
  m_desktop_btn: 'static/ui/desktop_modal_btn.png',
  m_coin_sack: 'static/ui/coin_sack_exact.jpg',
  m_crown_coin: 'static/ui/icon_crown_coin.png',
  m_cam: 'static/icons/icon_video_camera.png',
  m_coins_bag: 'static/icons/shop_coins_bag.jpg',
  m_tool_undo: 'static/icons/shop_tool_undo.jpg',
  m_tool_clear: 'static/icons/shop_tool_clear.jpg',
  m_tool_magnet: 'static/icons/shop_tool_magnet.jpg',
  m_tool_shuffle: 'static/icons/shop_tool_shuffle.jpg',
  m_tool_time: 'static/icons/shop_tool_time.jpg',
};
/* 存档里存的是文件名（如 shop_tool_undo.jpg），这里换算成上面的素材 key。 */
const ICON_KEY = {
  'shop_tool_undo.jpg': 'm_tool_undo',
  'shop_tool_clear.jpg': 'm_tool_clear',
  'shop_tool_magnet.jpg': 'm_tool_magnet',
  'shop_tool_shuffle.jpg': 'm_tool_shuffle',
  'shop_tool_time.jpg': 'm_tool_time',
  'shop_coins_bag.jpg': 'm_coins_bag',
  'coin_sack_exact.jpg': 'm_coin_sack',
};

/* 商城货架。和小程序 index.vue 的 shopItems 一字不差。 */
const SHOP_ITEMS = [
  { id: 'undo', name: '翻牌', icon: 'shop_tool_undo.jpg', count: 1, price: 100 },
  { id: 'clear', name: '消除', icon: 'shop_tool_clear.jpg', count: 2, price: 100 },
  { id: 'magnet', name: '磁铁', icon: 'shop_tool_magnet.jpg', count: 1, price: 300 },
  { id: 'shuffle', name: '洗牌', icon: 'shop_tool_shuffle.jpg', count: 1, price: 300 },
  { id: 'time', name: '加时', icon: 'shop_tool_time.jpg', count: 2, price: 100 },
];

/* 配色。取自小程序的弹窗样式，改这里就等于换肤。 */
const C = {
  panel: '#fdf6e6',
  ink: '#2c5b4c',
  sub: '#6b7f76',
  accent: '#3aa17e',
  accentDark: '#2b7f63',
  gold: '#ffb324',
  goldDark: '#e08a12',
  track: '#d9cdb4',
  mask: 'rgba(0,0,0,.58)',
};

/* ------------------------------------------------------------------ 小部件 */

/** 面板底板：奶油色圆角 + 一条标题带 + 右上角关闭。返回内容区矩形。 */
function panel(ctx, r, title, onClose) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = vw(4);
  ctx.shadowOffsetY = vh(0.6);
  ctx.fillStyle = C.panel;
  roundRect(ctx, r, vw(5));
  ctx.fill();
  ctx.restore();
  hit(r, () => {});           // 面板吞掉点击，别穿透到遮罩

  let top = r.y + vh(1.6);
  if (title) {
    const ribbon = { x: r.x + vw(8), y: r.y - vh(2.2), w: r.w - vw(16), h: vh(5.6) };
    ctx.fillStyle = C.accent;
    roundRect(ctx, ribbon, ribbon.h / 2);
    ctx.fill();
    textIn(ctx, title, ribbon, { color: '#fff', weight: 'bold', size: ribbon.h * 0.46 });
    top = ribbon.y + ribbon.h + vh(1.4);
  }

  const close = { x: r.x + r.w - vw(11), y: r.y - vh(1.4), w: vw(9), h: vw(9) };
  ctx.fillStyle = '#ef6b5a';
  ctx.beginPath();
  ctx.arc(close.x + close.w / 2, close.y + close.h / 2, close.w / 2, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, '✕', close.x + close.w / 2, close.y + close.h / 2 + close.h * 0.03,
    { color: '#fff', weight: 'bold', size: close.h * 0.52 });
  hit(close, onClose);

  return { x: r.x + vw(5), y: top, w: r.w - vw(10), h: r.y + r.h - top - vh(2) };
}

/** 胶囊按钮。cam=true 时左边带个摄像机图标，表示这是「看广告免费拿」；
 *  labelAt 给定时把文字挪到按钮宽度的这个比例处，给右边的金币数腾地方。 */
function button(ctx, r, label, onTap, {
  cam = false, color = C.gold, dark = C.goldDark, size = 0.44, labelAt = 0,
} = {}) {
  ctx.fillStyle = dark;
  roundRect(ctx, { x: r.x, y: r.y + r.h * 0.08, w: r.w, h: r.h }, r.h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, r, r.h / 2);
  ctx.fill();
  const icon = cam ? img('m_cam') : null;
  const pad = icon ? r.h * 0.62 : 0;
  if (icon) {
    drawContain(ctx, icon, { x: r.x + r.h * 0.22, y: r.y + r.h * 0.22, w: r.h * 0.56, h: r.h * 0.56 });
  }
  const lx = labelAt ? r.x + r.w * labelAt : r.x + (r.w + pad) / 2;
  text(ctx, label, lx, r.y + r.h / 2,
    { color: '#fff', weight: 'bold', size: r.h * size, stroke: 'rgba(0,0,0,.28)', fit: r.w - pad - r.h * 0.4 });
  hit(r, onTap);
  return r;
}

/** 道具/金币方格：一张图 + 右下角 xN 角标 + 下方名字。 */
function itemTile(ctx, r, iconKey, qty, label) {
  ctx.fillStyle = '#fff';
  roundRect(ctx, r, r.w * 0.22);
  ctx.fill();
  ctx.strokeStyle = C.track;
  ctx.lineWidth = Math.max(1, r.w * 0.03);
  ctx.stroke();
  drawContain(ctx, img(iconKey), { x: r.x + r.w * 0.1, y: r.y + r.h * 0.1, w: r.w * 0.8, h: r.h * 0.8 });
  if (qty) {
    const badge = { x: r.x + r.w * 0.42, y: r.y + r.h * 0.66, w: r.w * 0.62, h: r.h * 0.34 };
    ctx.fillStyle = '#ef6b5a';
    roundRect(ctx, badge, badge.h / 2);
    ctx.fill();
    textIn(ctx, qty, badge, { color: '#fff', weight: 'bold', size: badge.h * 0.7 });
  }
  if (label) {
    text(ctx, label, r.x + r.w / 2, r.y + r.h + vh(1.5),
      { color: C.ink, weight: 'bold', size: rem(0.82), fit: r.w * 1.3 });
  }
}

/** 按宽度折行。text() 只画一行，而说明文案是整段中文，必须自己断。
 *  中文没有词边界，逐字累加到超宽就断——英文数字会被切开，但这里的文案没有长英文。 */
function wrapText(ctx, str, maxWidth, size) {
  ctx.font = `${size}px sans-serif`;
  const lines = [];
  let line = '';
  for (const ch of String(str || '')) {
    if (ch === String.fromCharCode(10)) { lines.push(line); line = ''; continue; }
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = ch; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------------ 弹窗管理器 */

function createModals() {
  /** null | 'settings' | 'lucky' | 'piggy' | 'tasks' | 'shop' | 'desktop' | 'chest' | 'confirm' | 'refill' | 'aux' */
  let active = null;
  let payload = {};
  let taskTab = 'daily';
  /* 滚动状态。rect / max 由 draw 填，触摸事件只读它们——canvas 没有布局阶段，
   * 可视区尺寸只有画的时候才知道。 */
  const scroll = { offset: 0, max: 0, rect: null, dragging: false, lastY: 0, moved: 0 };
  /* 模拟激励视频。小程序里是 adState + setInterval，这里挂在帧循环上。 */
  const ad = { active: false, remain: 0, cb: null };

  function open(name, data) {
    active = name;
    payload = data || {};
    scroll.offset = 0;
    scroll.max = 0;
    scroll.rect = null;   // 上一个弹窗的可视区不能留给下一个
  }
  function close() { active = null; payload = {}; }

  /* 看完广告再发奖。小程序那边同名函数是 triggerAd，那时只有本地模拟浮层；
   * 现在真实激励视频、模拟浮层、以及「后台把这个投放位关了就直接发奖」三条路
   * 都收在 ads.js 里，这里只负责提供浮层的画法和拿到奖励后的动作。
   *
   * placement 是投放位 key（见 ads.js 的 PLACEMENTS），后台按它分开统计与开关，
   * 所以每个入口都必须传自己的那个，别图省事传同一个。 */
  function playAd(placement, cb) {
    ads.showRewarded(placement, {
      mock: (done) => { ad.active = true; ad.remain = 3; ad.cb = done; },
      onReward: cb,
      onFail: (msg) => { if (msg) toast(msg); },
    });
  }

  /** 没有 uni.showModal，需要「确定/取消」时用这个自绘弹窗顶上。 */
  function openConfirm(title, body, confirmLabel, onConfirm) {
    open('confirm', { title, body, confirmLabel, onConfirm });
  }

  /* --------------------------------------------------------------- 业务动作 */

  function unlockLuckyBag() {
    playAd('luckyBag', () => {
      addCoins(100);
      addTool('undo', 1); addTool('clear', 1); addTool('shuffle', 1); addTool('time', 1);
      gameState.luckyBag.remainingSeconds = 15 * 60;
      close();
      toast('恭喜获得幸运大礼包！');
    });
  }

  function claimPiggy() {
    const bank = gameState.piggyBank;
    if (bank.coins < bank.minClaim && !gameState.settings.gmMode) {
      toast('还需累积至' + bank.minClaim + '金币才可取出哦！');
      return;
    }
    playAd('piggy', () => {
      const got = bank.coins;
      addCoins(got);
      bank.coins = 0;
      close();
      toast('已成功取出 ' + got + ' 金币！');
    });
  }

  function claimTask(t) {
    if (t.claimed || t.current < t.target) return;
    t.claimed = true;
    if (t.rewardType === 'coins') addCoins(t.rewardCount);
    else addTool('clear', t.rewardCount);
    toast('奖励领取成功！');
  }

  function buyWithCoins(item) {
    if (spendCoins(item.price)) {
      addTool(item.id, item.count);
      toast('购买成功！' + item.name + ' +' + item.count);
    } else {
      toast('金币不足，可通过看广告免费获取！');
    }
  }

  function buyWithAd(item) {
    playAd('shopTool', () => {
      addTool(item.id, item.count);
      toast('获得道具 +' + item.count);
    });
  }

  function addToDesktop() {
    if (gameState.desktopRewardClaimed) {
      toast('点右上角「···」→「添加到桌面」即可收藏游戏');
      return;
    }
    gameState.desktopRewardClaimed = true;
    addCoins(200);
    close();
    toast('点右上角「···」添加到桌面，金币 +200 已入账！');
  }

  /** 体力不足时的说明与补满入口，替代小程序的 uni.showModal。 */
  function staminaTip() {
    const s = gameState;
    if (s.stamina >= s.maxStamina) { toast('您的体力已满'); return; }
    openConfirm('体力说明',
      ['当前体力 ' + s.stamina + '/' + s.maxStamina, '每15分钟自动恢复1点体力。', '看一段广告可立即补满。'],
      '看广告补满',
      () => playAd('stamina', () => { refundStamina(s.maxStamina); toast('体力已补满！'); }));
  }

  /* --------------------------------------------------------------- 各弹窗绘制 */

  function drawOverlay(ctx) {
    ctx.fillStyle = C.mask;
    ctx.fillRect(0, 0, screen.W, screen.H);
    hit({ x: 0, y: 0, w: screen.W, h: screen.H }, close);
  }

  function drawSettings(ctx) {
    const r = { x: vw(9), y: vh(30), w: vw(82), h: vh(40) };
    const body = panel(ctx, r, '游戏设置', close);
    const rows = [['sound', '音效'], ['music', '背景音乐'], ['vibrate', '触感震动'], ['gmMode', 'GM 开发者模式']];
    rows.forEach(([key, label], i) => {
      const y = body.y + vh(1) + i * vh(6.2);
      text(ctx, label, body.x + vw(2), y + vh(2), { align: 'left', size: rem(0.95), color: C.ink });
      const on = !!gameState.settings[key];
      const sw = { x: body.x + body.w - vw(2) - vw(16), y, w: vw(16), h: vh(4) };
      ctx.fillStyle = on ? C.accent : '#c3cdc7';
      roundRect(ctx, sw, sw.h / 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(on ? sw.x + sw.w - sw.h / 2 : sw.x + sw.h / 2, sw.y + sw.h / 2, sw.h * 0.38, 0, Math.PI * 2);
      ctx.fill();
      hit(sw, () => { gameState.settings[key] = !on; });
    });
    button(ctx, { x: body.x + (body.w - vw(38)) / 2, y: r.y + r.h - vh(7.5), w: vw(38), h: vh(5.4) },
      '确定', close, { color: C.accent, dark: C.accentDark });
  }

  function drawLucky(ctx) {
    const r = { x: vw(6), y: vh(24), w: vw(88), h: vh(46) };
    const body = panel(ctx, r, null, close);

    /* 头图是一整张烤好的美术（宝箱 + 彩带），按宽度铺在面板顶部。 */
    const header = img('m_lucky_header');
    if (header) {
      const hw = body.w, hh = hw * header.height / header.width;
      drawContain(ctx, header, { x: body.x, y: body.y, w: hw, h: Math.min(hh, vh(16)) });
    }

    const rewards = gameState.luckyBag.rewards || [];
    const rowY = body.y + vh(17);
    const cell = body.w / rewards.length;
    const size = Math.min(cell * 0.72, vh(7));
    rewards.forEach((it, i) => {
      const x = body.x + cell * i + (cell - size) / 2;
      itemTile(ctx, { x, y: rowY, w: size, h: size }, ICON_KEY[it.icon] || 'm_tool_clear', 'x' + it.count, it.name);
      if (i < rewards.length - 1) {
        text(ctx, '+', body.x + cell * (i + 1), rowY + size / 2, { color: C.sub, weight: 'bold', size: rem(0.9) });
      }
    });

    const pill = { x: body.x + (body.w - vw(34)) / 2, y: rowY + size + vh(4.2), w: vw(34), h: vh(4) };
    ctx.fillStyle = '#002d24';
    roundRect(ctx, pill, pill.h / 2);
    ctx.fill();
    textIn(ctx, formatLongSeconds(gameState.luckyBag.remainingSeconds), pill,
      { color: '#fef08a', weight: 'bold', size: pill.h * 0.56 });

    const btn = { x: body.x + (body.w - vw(50)) / 2, y: r.y + r.h - vh(8), w: vw(50), h: vh(6) };
    button(ctx, btn, '立即解锁', unlockLuckyBag, { cam: true });
    /* 「限免」角标压在按钮右上角，和小程序的 .free-ribbon 同一个位置。 */
    const tag = { x: btn.x + btn.w - vw(10), y: btn.y - vh(1.4), w: vw(12), h: vh(3) };
    ctx.fillStyle = '#ef4444';
    roundRect(ctx, tag, tag.h / 2);
    ctx.fill();
    textIn(ctx, '限免', tag, { color: '#fff', weight: 'bold', size: tag.h * 0.6 });
  }

  function drawPiggy(ctx) {
    const r = { x: vw(8), y: vh(26), w: vw(84), h: vh(44) };
    const body = panel(ctx, r, '金库银行', close);
    const bank = gameState.piggyBank;

    /* 左边一根竖着的储量计：600 在上、300 在下，填充高度按存款比例。 */
    const meter = { x: body.x + vw(2), y: body.y + vh(3), w: vw(7), h: vh(20) };
    ctx.fillStyle = C.track;
    roundRect(ctx, meter, meter.w / 2);
    ctx.fill();
    const k = Math.max(0, Math.min(1, bank.coins / bank.maxCapacity));
    if (k > 0) {
      const fh = Math.max(meter.w, meter.h * k);
      ctx.fillStyle = C.gold;
      roundRect(ctx, { x: meter.x, y: meter.y + meter.h - fh, w: meter.w, h: fh }, meter.w / 2);
      ctx.fill();
    }
    text(ctx, String(bank.maxCapacity), meter.x + meter.w / 2, meter.y - vh(1.4), { color: C.sub, size: rem(0.7) });
    text(ctx, String(bank.minClaim), meter.x + meter.w / 2, meter.y + meter.h * 0.5, { color: C.ink, size: rem(0.7) });

    /* 右边猪罐 + 头顶气泡里的当前存款。 */
    const art = { x: body.x + vw(14), y: body.y + vh(4), w: body.w - vw(16), h: vh(19) };
    drawContain(ctx, img('m_piggy_hero'), art);
    const bubble = { x: art.x + art.w / 2 - vw(14), y: body.y, w: vw(28), h: vh(4.4) };
    ctx.fillStyle = '#fff';
    roundRect(ctx, bubble, bubble.h / 2);
    ctx.fill();
    drawContain(ctx, img('m_crown_coin'),
      { x: bubble.x + vw(1.4), y: bubble.y + bubble.h * 0.15, w: bubble.h * 0.7, h: bubble.h * 0.7 });
    text(ctx, String(bank.coins), bubble.x + bubble.w * 0.6, bubble.y + bubble.h / 2,
      { color: C.ink, weight: 'bold', size: bubble.h * 0.56 });

    text(ctx, '满' + bank.minClaim + '金币可以领取', body.x + body.w / 2, body.y + vh(25.5),
      { color: C.ink, size: rem(0.86) });
    text(ctx, '最多可存储' + bank.maxCapacity + '金币', body.x + body.w / 2, body.y + vh(28.5),
      { color: C.ink, size: rem(0.86) });

    button(ctx, { x: body.x + (body.w - vw(46)) / 2, y: r.y + r.h - vh(9.5), w: vw(46), h: vh(5.8) },
      '领取奖励', claimPiggy, { cam: true });
    text(ctx, '(每次通过关卡可存入25金币)', body.x + body.w / 2, r.y + r.h - vh(2.6),
      { color: C.sub, size: rem(0.7) });
  }

  /** 裁出可视区、画滚动内容。rows 是 (ctx, rect, item, index) 的画法。 */
  function scrollList(ctx, view, items, rowH, drawRow) {
    scroll.rect = view;
    scroll.max = Math.max(0, items.length * rowH - view.h);
    scroll.offset = Math.max(0, Math.min(scroll.max, scroll.offset));
    ctx.save();
    roundRect(ctx, view, vw(2));
    ctx.clip();
    items.forEach((item, i) => {
      const y = view.y - scroll.offset + i * rowH;
      if (y > view.y + view.h || y + rowH < view.y) return;   // 视口外的不画也不登记热区
      drawRow(ctx, { x: view.x, y, w: view.w, h: rowH - vh(1) }, item, i);
    });
    ctx.restore();
    /* 右侧滚动条：canvas 上没有系统滚动条，不给条玩家不知道还能滑。 */
    if (scroll.max > 0) {
      const th = Math.max(vh(3), view.h * view.h / (items.length * rowH));
      const ty = view.y + (view.h - th) * (scroll.offset / scroll.max);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      roundRect(ctx, { x: view.x + view.w - vw(1.2), y: ty, w: vw(0.8), h: th }, vw(0.4));
      ctx.fill();
    }
  }

  function drawTasks(ctx) {
    const r = { x: vw(5), y: vh(18), w: vw(90), h: vh(60) };
    const body = panel(ctx, r, null, close);

    const tabs = [['daily', '每日任务'], ['long', '长线任务']];
    tabs.forEach(([key, label], i) => {
      const t = { x: body.x + i * (body.w / 2), y: body.y, w: body.w / 2 - vw(2), h: vh(5) };
      const on = taskTab === key;
      ctx.fillStyle = on ? C.accent : '#e6dcc6';
      roundRect(ctx, t, t.h / 2);
      ctx.fill();
      textIn(ctx, label, t, { color: on ? '#fff' : C.sub, weight: 'bold', size: t.h * 0.44 });
      hit(t, () => { if (taskTab !== key) { taskTab = key; scroll.offset = 0; } });
    });

    const list = taskTab === 'daily' ? gameState.dailyTasks : gameState.longTasks;
    const view = { x: body.x, y: body.y + vh(6.5), w: body.w, h: body.h - vh(7.5) };
    scrollList(ctx, view, list, vh(12), (c, row, t) => {
      c.fillStyle = '#fff';
      roundRect(c, row, vw(3));
      c.fill();

      const art = { x: row.x + vw(2), y: row.y + row.h * 0.18, w: row.h * 0.64, h: row.h * 0.64 };
      drawContain(c, img(t.rewardType === 'coins' ? 'm_coin_sack' : 'm_tool_clear'), art);

      const infoX = art.x + art.w + vw(3);
      text(c, t.title, infoX, row.y + row.h * 0.26,
        { align: 'left', color: C.ink, weight: 'bold', size: rem(0.9), fit: row.w * 0.42 });
      text(c, t.desc, infoX, row.y + row.h * 0.5,
        { align: 'left', color: C.sub, size: rem(0.72), fit: row.w * 0.42 });

      const bar = { x: infoX, y: row.y + row.h * 0.66, w: row.w * 0.38, h: row.h * 0.18 };
      c.fillStyle = C.track;
      roundRect(c, bar, bar.h / 2);
      c.fill();
      const ratio = Math.max(0, Math.min(1, t.current / t.target));
      if (ratio > 0) {
        c.fillStyle = C.gold;
        roundRect(c, { x: bar.x, y: bar.y, w: Math.max(bar.h, bar.w * ratio), h: bar.h }, bar.h / 2);
        c.fill();
      }
      textIn(c, t.current + '/' + t.target, bar, { color: '#fff', size: bar.h * 0.72, stroke: 'rgba(0,0,0,.35)' });

      const rw = { x: row.x + row.w - vw(24), y: row.y + row.h * 0.16, w: vw(20), h: row.h * 0.3 };
      drawContain(c, img(t.rewardType === 'coins' ? 'm_crown_coin' : 'm_tool_clear'),
        { x: rw.x, y: rw.y, w: rw.h, h: rw.h });
      text(c, 'x' + t.rewardCount, rw.x + rw.h + vw(1), rw.y + rw.h / 2,
        { align: 'left', color: C.ink, weight: 'bold', size: rem(0.8) });

      const can = t.current >= t.target && !t.claimed;
      const btn = { x: row.x + row.w - vw(24), y: row.y + row.h * 0.54, w: vw(20), h: row.h * 0.3 };
      button(c, btn, t.claimed ? '已领取' : (can ? '领取' : '未完成'), () => claimTask(t), {
        color: t.claimed ? '#bdc7c1' : (can ? C.gold : '#d7cfbb'),
        dark: t.claimed ? '#a3aca7' : (can ? C.goldDark : '#c0b8a4'),
        size: 0.42,
      });
      if (can) {   // 可领取时点个小红点，和小程序的 .red-dot-micro 一致
        c.fillStyle = '#ef4444';
        c.beginPath();
        c.arc(btn.x + btn.w, btn.y, btn.h * 0.18, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  function drawShop(ctx) {
    const r = { x: vw(5), y: vh(18), w: vw(90), h: vh(60) };
    const body = panel(ctx, r, '商城', close);
    /* 第一行固定是「看广告白拿金币」，后面才是道具货架，顺序同小程序。 */
    const rows = [{ coin: true }].concat(SHOP_ITEMS);
    const view = { x: body.x, y: body.y, w: body.w, h: body.h };
    scrollList(ctx, view, rows, vh(13), (c, row, item) => {
      c.fillStyle = item.coin ? '#e8f7f3' : '#fff6e4';
      roundRect(c, row, vw(3));
      c.fill();

      const head = { x: row.x + vw(2), y: row.y + vh(0.8), w: vw(18), h: vh(3.4) };
      c.fillStyle = item.coin ? C.accent : C.gold;
      roundRect(c, head, head.h / 2);
      c.fill();
      textIn(c, item.coin ? '金币' : item.name, head, { color: '#fff', weight: 'bold', size: head.h * 0.56 });

      const art = { x: row.x + vw(4), y: row.y + vh(4.4), w: row.h * 0.46, h: row.h * 0.46 };
      drawContain(c, img(item.coin ? 'm_coins_bag' : ICON_KEY[item.icon]), art);
      text(c, 'x' + (item.coin ? 100 : item.count), art.x + art.w + vw(3), art.y + art.h / 2,
        { align: 'left', color: C.ink, weight: 'bold', size: rem(1) });

      if (item.coin) {
        button(c, { x: row.x + row.w - vw(26), y: row.y + row.h * 0.34, w: vw(22), h: vh(5) },
          '免费', () => playAd('shopCoins', () => { addCoins(100); toast('金币 +100'); }),
          { cam: true, color: C.accent, dark: C.accentDark });
      } else {
        button(c, { x: row.x + row.w - vw(50), y: row.y + row.h * 0.34, w: vw(22), h: vh(5) },
          String(item.price), () => buyWithCoins(item), { color: C.gold, dark: C.goldDark });
        button(c, { x: row.x + row.w - vw(26), y: row.y + row.h * 0.34, w: vw(22), h: vh(5) },
          '免费', () => buyWithAd(item), { cam: true, color: C.accent, dark: C.accentDark });
      }
    });
  }

  function drawDesktop(ctx) {
    /* 这个弹窗整张都是烤好的美术（卡片 + 按钮两张图），只需要按宽度摆好、
     * 在卡片右上角和按钮上各留一个热区。 */
    const card = img('m_desktop_card');
    const btn = img('m_desktop_btn');
    const w = vw(84);
    const ch = card ? w * card.height / card.width : vh(40);
    const bh = btn ? vw(60) * btn.height / btn.width : vh(7);
    const total = ch + vh(2) + bh;
    const top = (screen.H - total) / 2;

    const cardRect = { x: (screen.W - w) / 2, y: top, w, h: ch };
    drawContain(ctx, card, cardRect);
    hit(cardRect, () => {});
    /* 关闭的 ✕ 是烤在卡片美术里的，位置在标题条右端（约整图的 97% 宽、31% 高），
     * 不是图片的右上角——热区照着画上去的那个叉放，别照着包围盒放。 */
    hit({
      x: cardRect.x + cardRect.w * 0.90, y: cardRect.y + cardRect.h * 0.25,
      w: cardRect.w * 0.14, h: cardRect.h * 0.13,
    }, close);

    const btnRect = { x: (screen.W - vw(60)) / 2, y: top + ch + vh(2), w: vw(60), h: bh };
    drawContain(ctx, btn, btnRect);
    hit(btnRect, addToDesktop);
  }

  function drawChest(ctx) {
    const r = { x: vw(12), y: vh(32), w: vw(76), h: vh(34) };
    const body = panel(ctx, r, payload.title || '奖励', close);
    const items = [{ icon: 'm_crown_coin', label: '金币 x' + (payload.coins || 0) }];
    if (payload.toolCount > 0) {
      items.push({ icon: ICON_KEY[payload.toolIcon] || 'm_tool_clear', label: payload.toolName + ' x' + payload.toolCount });
    }
    const size = vh(9);
    items.forEach((it, i) => {
      const cw = body.w / items.length;
      const x = body.x + cw * i + (cw - size) / 2;
      drawContain(ctx, img(it.icon), { x, y: body.y + vh(2), w: size, h: size });
      text(ctx, it.label, x + size / 2, body.y + size + vh(4),
        { color: C.ink, weight: 'bold', size: rem(0.85), fit: cw * 0.9 });
    });
    button(ctx, { x: body.x + (body.w - vw(40)) / 2, y: r.y + r.h - vh(7.5), w: vw(40), h: vh(5.4) },
      '收下奖励', close, { color: C.accent, dark: C.accentDark });
  }

  function drawConfirm(ctx) {
    const r = { x: vw(10), y: vh(34), w: vw(80), h: vh(30) };
    const body = panel(ctx, r, payload.title || '提示', close);
    (payload.body || []).forEach((line, i) => {
      text(ctx, line, body.x + body.w / 2, body.y + vh(3) + i * vh(3.4),
        { color: C.ink, size: rem(0.85), fit: body.w * 0.95 });
    });
    const y = r.y + r.h - vh(7.5), bw = vw(32);
    button(ctx, { x: body.x, y, w: bw, h: vh(5.4) }, '取消', close, { color: '#bdc7c1', dark: '#a3aca7' });
    button(ctx, { x: body.x + body.w - bw, y, w: bw, h: vh(5.4) }, payload.confirmLabel || '确定', () => {
      const fn = payload.onConfirm;
      close();
      if (fn) fn();
    }, { color: C.accent, dark: C.accentDark });
  }

  /* 牌桌的道具补给弹窗。素材是 pkg-game 那套 tool-*.png，由牌桌场景负责预加载，
   * ui.js 的图片缓存是全局的，这里按 key 取就行。
   * payload: { tool, title, desc, price, icon, onGrant(tool) } */
  function drawRefill(ctx) {
    /* 先把 payload 解构出来：按钮回调里 close() 之后 payload 就被清空了，
     * 回调里再读 payload.title 会拿到 undefined。 */
    const { tool, title, desc, price, icon, onGrant } = payload;
    const r = { x: vw(14), y: vh(30), w: vw(72), h: vh(40) };
    const body = panel(ctx, r, title, close);

    const card = { x: body.x + (body.w - vh(13)) / 2, y: body.y + vh(1), w: vh(13), h: vh(13) };
    ctx.fillStyle = '#fff';
    roundRect(ctx, card, vw(4));
    ctx.fill();
    ctx.strokeStyle = C.track;
    ctx.lineWidth = Math.max(1, vw(0.4));
    ctx.stroke();
    drawContain(ctx, img(icon), {
      x: card.x + card.w * 0.12, y: card.y + card.h * 0.12, w: card.w * 0.76, h: card.h * 0.76,
    });
    const badge = { x: card.x + card.w * 0.58, y: card.y + card.h * 0.7, w: card.w * 0.42, h: card.h * 0.26 };
    ctx.fillStyle = '#ef6b5a';
    roundRect(ctx, badge, badge.h / 2);
    ctx.fill();
    textIn(ctx, 'X1', badge, { color: '#fff', weight: 'bold', size: badge.h * 0.62 });

    text(ctx, desc, body.x + body.w / 2, card.y + card.h + vh(3.4),
      { color: C.ink, size: rem(0.88), fit: body.w * 0.95 });

    /* 两个按钮一绿一黄，和小程序 .refill-buy-green-btn / .refill-free-yellow-btn 同序：
     * 上面用金币买，下面看广告白拿。 */
    const bw = body.w * 0.82, bh = vh(6);
    const bx = body.x + (body.w - bw) / 2;
    const buy = { x: bx, y: r.y + r.h - vh(15), w: bw, h: bh };
    button(ctx, buy, '购买', () => {
      if (spendCoins(price)) {
        onGrant(tool);
        close();
        toast('购买成功！' + title + ' +1');
      } else {
        toast('金币不足，可通过看广告免费获取！');
      }
    }, { color: C.accent, dark: C.accentDark, labelAt: 0.3 });
    /* 金币图标和价格排在「购买」右边，别叠在字上。 */
    drawContain(ctx, img('m_crown_coin'), {
      x: buy.x + buy.w * 0.52, y: buy.y + buy.h * 0.2, w: buy.h * 0.6, h: buy.h * 0.6,
    });
    text(ctx, String(price), buy.x + buy.w * 0.66, buy.y + buy.h / 2,
      { align: 'left', color: '#fff', weight: 'bold', size: buy.h * 0.44, stroke: 'rgba(0,0,0,.28)' });

    const free = { x: bx, y: r.y + r.h - vh(7.6), w: bw, h: bh };
    button(ctx, free, '购买   免费', () => { close(); playAd('refill', () => {
      onGrant(tool);
      toast('获得 ' + title + ' +1！');
    }); }, { cam: true });
  }


  /* 集卡页的辅助弹窗：兑换屋 / 赛季商店 / 赛季收藏 共用一套壳。
   * payload: { title, desc, btnText, onAction, sections?() }
   * sections 传函数而不是数组，因为兑换屋的选中态每帧都可能变（点一下筹码就换一个）。 */
  function drawAux(ctx) {
    const { title, desc, btnText, onAction } = payload;
    /* 兑换屋最多要排 9 个筹码（5 行），面板按最坏情况开高；
     * 内容区再 clip 一次，万一以后卡册变多，溢出的部分是被裁掉而不是压在按钮上。 */
    const r = { x: vw(7), y: vh(15), w: vw(86), h: vh(66) };
    const body = panel(ctx, r, title, close);
    const btnTop = r.y + r.h - vh(8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x - vw(2), body.y - vh(1), body.w + vw(4), btnTop - body.y - vh(1));
    ctx.clip();

    let y = body.y + vh(1);
    wrapText(ctx, desc, body.w * 0.96, rem(0.82)).forEach((line) => {
      text(ctx, line, body.x + body.w / 2, y + vh(1.4), { color: C.ink, size: rem(0.82) });
      y += vh(3);
    });

    const sections = typeof payload.sections === 'function' ? payload.sections() : (payload.sections || []);
    for (const sec of sections) {
      y += vh(1.4);
      text(ctx, sec.label, body.x, y + vh(1.2), { align: 'left', color: C.sub, size: rem(0.76), fit: body.w });
      y += vh(3.6);
      if (!sec.chips.length) {
        text(ctx, sec.empty, body.x, y + vh(1.2), { align: 'left', color: '#a3a99f', size: rem(0.72), fit: body.w });
        y += vh(3.4);
        continue;
      }
      /* 筹码按行排，排不下就换行——数量随卡册数量变，不能写死每行几个。 */
      let x = body.x;
      const h = vh(4);
      for (const chip of sec.chips) {
        ctx.font = `${h * 0.42}px sans-serif`;
        const w = Math.min(body.w, ctx.measureText(chip.label).width + vw(6));
        if (x + w > body.x + body.w) { x = body.x; y += h + vh(1); }
        const box = { x, y, w, h };
        ctx.fillStyle = chip.on ? C.accent : '#efe6cf';
        roundRect(ctx, box, h / 2);
        ctx.fill();
        textIn(ctx, chip.label, box, { color: chip.on ? '#fff' : C.ink, size: h * 0.42, weight: 'bold' });
        hit(box, () => sec.onPick(chip.id));
        x += w + vw(2);
      }
      y += h + vh(1);
    }

    ctx.restore();

    button(ctx, { x: body.x + (body.w - vw(52)) / 2, y: btnTop, w: vw(52), h: vh(5.8) },
      btnText, () => onAction(close), { color: C.accent, dark: C.accentDark });
  }

  /** 模拟激励视频。真接广告要换成 wx.createRewardedVideoAd，回调位置就是 ad.cb。 */
  function drawAd(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.86)';
    ctx.fillRect(0, 0, screen.W, screen.H);
    hit({ x: 0, y: 0, w: screen.W, h: screen.H }, () => {});   // 广告期间吞掉所有点击

    const box = { x: vw(8), y: vh(32), w: vw(84), h: vh(34) };
    ctx.fillStyle = '#12211d';
    roundRect(ctx, box, vw(4));
    ctx.fill();
    text(ctx, '广告播放中… ' + Math.ceil(ad.remain) + 's', box.x + box.w / 2, box.y + vh(4),
      { color: '#9fe3c9', size: rem(0.9) });
    text(ctx, '🎬', box.x + box.w / 2, box.y + vh(13), { size: rem(3) });
    text(ctx, '【趣味麻将碰】赞助商精彩广告', box.x + box.w / 2, box.y + vh(20),
      { color: '#fff', weight: 'bold', size: rem(0.95), fit: box.w * 0.9 });
    text(ctx, '观看完整视频即可获得丰厚道具与金币奖励！', box.x + box.w / 2, box.y + vh(24),
      { color: '#9aa8a3', size: rem(0.75), fit: box.w * 0.9 });

    const bar = { x: box.x + vw(6), y: box.y + box.h - vh(5), w: box.w - vw(12), h: vh(1.4) };
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, bar, bar.h / 2);
    ctx.fill();
    const done = Math.max(0, Math.min(1, (3 - ad.remain) / 3));
    if (done > 0) {
      ctx.fillStyle = C.accent;
      roundRect(ctx, { x: bar.x, y: bar.y, w: Math.max(bar.h, bar.w * done), h: bar.h }, bar.h / 2);
      ctx.fill();
    }
  }

  const DRAW = {
    settings: drawSettings, lucky: drawLucky, piggy: drawPiggy, tasks: drawTasks,
    shop: drawShop, desktop: drawDesktop, chest: drawChest, confirm: drawConfirm,
    refill: drawRefill, aux: drawAux,
  };

  /* 抽成普通函数而不是只挂在返回对象上：下面几个触摸处理器里原本写的是 `this.isOpen()`，
   * 那依赖调用方一定带着接收者（modals.onTouchEnd(p)）。小游戏的代码包在真机/开发者工具里
   * 可能跑在严格模式下，一旦有人把方法解构出去用（`const { onTouchEnd } = modals`），
   * `this` 就是 undefined，直接 TypeError。浏览器预览的打包器会替我们「归一化」这类
   * 松散 this，所以预览里看不出问题——干脆不依赖 this。 */
  const isOpen = () => !!active || ad.active;

  return {
    preload: () => loadImages(ART),
    open,
    close,
    openConfirm,
    playAd,
    staminaTip,
    isOpen,
    /** 场景每帧调一次，放在自己的内容画完之后。 */
    draw(ctx) {
      if (active && DRAW[active]) {
        drawOverlay(ctx);
        DRAW[active](ctx);
      }
      if (ad.active) drawAd(ctx);
    },
    update(dt) {
      if (!ad.active) return;
      ad.remain -= dt;
      if (ad.remain > 0) return;
      ad.active = false;
      const cb = ad.cb;
      ad.cb = null;
      if (cb) cb();
    },
    /* 触摸：返回 true 表示这一下被弹窗吃了，场景别再自己处理。
     * 滚动和点击靠位移量区分——手指动过 8px 以上就当滑动，不触发按钮。 */
    onTouchStart(p) {
      if (!isOpen()) return false;
      scroll.moved = 0;
      if (scroll.rect && p.y >= scroll.rect.y && p.y <= scroll.rect.y + scroll.rect.h) {
        scroll.dragging = true;
        scroll.lastY = p.y;
      }
      return true;
    },
    onTouchMove(p) {
      if (!scroll.dragging) return isOpen();
      const dy = p.y - scroll.lastY;
      scroll.lastY = p.y;
      scroll.moved += Math.abs(dy);
      scroll.offset = Math.max(0, Math.min(scroll.max, scroll.offset - dy));
      return true;
    },
    onTouchEnd(p) {
      if (!isOpen()) return false;
      const dragged = scroll.dragging && scroll.moved > vh(1);
      scroll.dragging = false;
      if (!dragged) tap(p);
      return true;
    },
  };
}

module.exports = { createModals, SHOP_ITEMS };
