/* 首页场景。对应小程序的 pages/index/index.vue。
 *
 * 这一页是整次移植里最省事的一块，原因在 R3：上一轮已经把首页从「一整张烤死的位图」
 * 拆成 14 个透明精灵，并把几何集中到 mp-tools/home-layout.cjs——每个元素有母版像素矩形、
 * 屏幕百分比盒子、内部数值槽位。canvas UI 要的正好就是这三样，所以坐标一个都不用重量，
 * 直接把 buildLayout() 的输出喂给一个 drawImage 循环，命中测试用同一批矩形。
 *
 * 小程序版每个精灵的 @tap 挂在 .spr 上（看到的就是点得到的），这里保持同一条约定：
 * 画的时候顺手 hit(box, handler)，绝不另算一套热区。
 *
 * 弹窗（礼包/存钱罐/任务/商城/添加桌面/宝箱奖励/设置/模拟广告）都在 modals.js 里，
 * 本文件只负责「哪个精灵打开哪个弹窗」，以及把触摸先交给弹窗层处理。
 */
const { buildLayout } = require('../home-layout.js');
const {
  gameState, formatSeconds, formatLongSeconds, consumeStamina, startGlobalTimers, addCoins, addTool,
} = require('../store.js');
const { createModals } = require('../modals.js');
const daily = require('../daily.js');
const { viewport } = require('../screen.js');
const { replaceScene } = require('../app.js');
const { toast } = require('../platform.js');
const {
  img, loadImages, boxOf, slotOf, rem,
  text, textIn, roundRect, drawFill, drawCover, hit, beginFrame, tap,
} = require('../ui.js');

const SPRITE_DIR = 'static/ui/home/';

/* 宝箱奖励弹窗要有内容才看得出对不对，调试直开时给一份样例。 */
const DEBUG_CHEST_REWARD = {
  title: '关卡宝箱已开启！', coins: 50,
  toolName: '消除', toolIcon: 'shop_tool_clear.jpg', toolCount: 1,
};

/** 精灵 key → 素材 key，顺便当预加载清单。 */
function assetTable(sprites) {
  const table = { bg_home: SPRITE_DIR + 'bg_home.webp' };
  sprites.forEach((s) => { table[s.key] = SPRITE_DIR + s.file; });
  return table;
}

/* debugModal 只给 game.js 的调试开关用（DEBUG_SCENE = 'home#shop'）：
 * canvas 上的弹窗没法用截图工具点开，验收时要能直接进到那一屏。 */
function createHomeScene(makeBoardScene, makeCardsScene, debugModal) {
  const sprites = buildLayout();
  const modals = createModals();
  let ready = false;

  /* 数值槽位的内容。key 与 home-layout.cjs 里 slots 的字段一一对应，
   * 口径跟小程序的 computed 保持一致（体力满显示 max、集卡按卡种数算）。 */
  function slotText(spriteKey, slotKey) {
    const s = gameState;
    if (spriteKey === 'topbar' && slotKey === 'coins') return String(s.coins);
    if (spriteKey === 'topbar' && slotKey === 'stamina') {
      return s.stamina >= s.maxStamina ? `${s.stamina}  max` : `${s.stamina}  ${formatSeconds(s.staminaTimer)}`;
    }
    if (spriteKey === 'chestLevel') return s.levelChest.current + '/' + s.levelChest.target;
    if (spriteKey === 'chestStar') return s.starChest.current + '/' + s.starChest.target;
    if (spriteKey === 'banner' && slotKey === 'cards') {
      const album = s.cardsAlbum || [];
      return album.filter((c) => c.count > 0).length + '/' + album.length;
    }
    if (spriteKey === 'banner') return { coin1: '200', coin2: '300', coin3: '500' }[slotKey] || '';
    if (spriteKey === 'tileLucky' && slotKey === 'timer') return formatLongSeconds(s.luckyBag.remainingSeconds);
    return '';
  }

  function startGame() {
    /* 体力不够不是「点了没反应」，要把为什么和怎么办一起说清楚——
     * 小程序那边是 showStaminaTip()，这里同一套话术在 modals 里。 */
    if (!consumeStamina(1)) {
      modals.staminaTip();
      return;
    }
    replaceScene(makeBoardScene(), { level: gameState.currentLevel || 1 });
  }

  /** 弹窗要的那三样：后台下发的展示数值、今天剩几次、点按钮干什么。 */
  function dailyPayload() {
    return { config: daily.current(), attemptsLeft: daily.attemptsLeft(), onGo: startDailyChallenge };
  }

  /* 每日一关的入口动作。三道门依次过：今天还有没有次数、体力够不够、然后才进对局。
   * 次数先扣：进了对局再退出也算用掉一次，否则「进去看一眼就退」可以无限刷。 */
  function startDailyChallenge() {
    if (!daily.spend()) {
      toast('今日挑战次数已用完，明天 00:00 刷新');
      return;
    }
    if (!consumeStamina(1)) {
      modals.staminaTip();
      return;
    }
    replaceScene(makeBoardScene(), { level: gameState.currentLevel || 1, mode: 'challenge' });
  }

  /* 领宝箱。口径同小程序 claimChest：未满不发奖（gmMode 放行）、领完把进度清零，
   * 否则宝箱会永远停在满格，而且每点一次白送一次。 */
  function claimChest(chest, reward) {
    if (!chest) return;
    if (chest.current < chest.target && !gameState.settings.gmMode) {
      toast('还差 ' + (chest.target - chest.current) + ' 点即可开启，继续闯关吧！');
      return;
    }
    chest.current = 0;
    addCoins(reward.coins);
    if (reward.toolCount > 0) addTool(reward.tool, reward.toolCount);
    modals.open('chest', reward);
  }

  function handlerFor(key) {
    switch (key) {
      case 'gear': return () => modals.open('settings');
      case 'btnStart': return startGame;
      case 'banner':
      case 'tileCards': return () => replaceScene(makeCardsScene());
      /* 每日一关：先弹窗（人数、今日主题、奖励、剩余次数都在里面），
       * 玩家点「前往挑战」才扣次数和体力。次数是本地按日期重置的，见 daily.js。 */
      case 'tileChallenge': return () => modals.open('daily', dailyPayload());
      case 'chestLevel': return () => claimChest(gameState.levelChest, {
        title: '关卡宝箱已开启！', coins: 50,
        tool: 'clear', toolName: '消除', toolIcon: 'shop_tool_clear.jpg', toolCount: 1,
      });
      case 'chestStar': return () => claimChest(gameState.starChest, {
        title: '星星宝箱已开启！', coins: 150,
        tool: 'shuffle', toolName: '洗牌', toolIcon: 'shop_tool_shuffle.jpg', toolCount: 2,
      });
      case 'tileLucky': return () => modals.open('lucky');
      case 'tilePiggy': return () => modals.open('piggy');
      case 'tileTask': return () => modals.open('tasks');
      case 'tileShop': return () => modals.open('shop');
      case 'tileTheme': return () => toast('主题装扮已解锁默认「田园暖阳」皮肤！');
      case 'tileDesktop': return () => modals.open('desktop');
      /* 顶栏点的是体力：满了说一声，没满给补满入口，和小程序 showStaminaTip 一致。 */
      case 'topbar': return () => modals.staminaTip();
      default: return () => {};
    }
  }

  return {
    async enter() {
      modals.close();
      startGlobalTimers();
      await Promise.all([loadImages(assetTable(sprites)), modals.preload()]);
      daily.init();          // 不 await：拉不到就用缓存/兜底，别让首页等网络
      ready = true;
      /* 'ad' 不是弹窗而是播放态，3 秒就过去了；调试时让它自己续播，方便截图。 */
      if (debugModal === 'ad') { const loop = () => modals.playAd('debug', loop); loop(); }
      else if (debugModal === 'daily') modals.open('daily', dailyPayload());
      else if (debugModal) modals.open(debugModal, DEBUG_CHEST_REWARD);
    },

    update(dt) { modals.update(dt); },

    draw(ctx) {
      beginFrame();
      ctx.fillStyle = '#7fb69b';
      ctx.fillRect(0, 0, viewport.W, viewport.H);

      const bg = img('bg_home');
      if (bg) drawCover(ctx, bg, { x: 0, y: 0, w: viewport.W, h: viewport.H });

      if (!ready) {
        text(ctx, '加载中…', viewport.W / 2, viewport.H / 2, { size: rem(1.1) });
        return;
      }

      for (const s of sprites) {
        const box = boxOf(s.css);
        drawFill(ctx, img(s.key), box);
        hit(box, handlerFor(s.key));

        for (const [slotKey, slot] of Object.entries(s.slots || {})) {
          const str = slotText(s.key, slotKey);
          if (!str) continue;
          const r = slotOf(box, slot);
          /* 幸运礼包的倒计时压在礼盒美术上，不给底就是一行白字盖在花花绿绿的图上，
           * 根本读不出来。小程序那边是 .lucky-pill（深绿底 + 绿描边 + 淡黄字），
           * 这里照搬同一套配色。 */
          if (s.key === 'tileLucky') {
            ctx.fillStyle = '#002d24';
            roundRect(ctx, r, r.h / 2);
            ctx.fill();
            ctx.strokeStyle = '#30966a';
            ctx.lineWidth = Math.max(1, r.h * 0.08);
            ctx.stroke();
            textIn(ctx, str, r, { color: '#fef08a', weight: 'bold', size: r.h * 0.6 });
            continue;
          }
          textIn(ctx, str, r, {
            color: '#fff', weight: 'bold', stroke: 'rgba(30,60,48,.65)',
            size: r.h * (s.key === 'topbar' ? 0.62 : 0.78),
          });
        }
      }

      modals.draw(ctx);
    },

    /* 触摸先给弹窗层：它开着的时候要吃掉所有手势（包括列表滑动），
     * 没开才轮到首页自己的热区。 */
    onTouchStart(p) { modals.onTouchStart(p); },
    onTouchMove(p) { modals.onTouchMove(p); },
    onTouchEnd(p) { if (!modals.onTouchEnd(p)) tap(p); },
  };
}

module.exports = { createHomeScene };
