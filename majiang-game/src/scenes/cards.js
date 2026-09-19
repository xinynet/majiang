/* 集卡页。对应小程序的 pkg-cards/pages/cards/cards.vue。
 *
 * 小程序版那 750 行里绝大部分是 WXML/WXSS 的转盘头图、热区与弹窗；数据本身很简单——
 * gameState.cardsAlbum 九个条目，每个有图、名字、已集数量、目标数量。
 *
 * 一个容易踩的坑：卡片美术是**整张成品卡**，卡名和「0/9」都烤在图里。
 * 所以网格里一个字都不要另外写（第一版在图上又叠了一遍名字和进度，两份字叠在一起），
 * 真实进度跟小程序一样只在点开卡片后的详情弹窗里给——那里的数字才是活的。
 *
 * 头图 cards_top_disc.jpg 上的几个按钮同样是烤死的，热区百分比沿用小程序
 * cards.vue 里 .hotspot-* 那几条（相对头图自身的盒子），看到的就是点得到的。
 *
 * 抽碎片/集齐发奖/重复碎片兑换的规则不在这里，在 src/game/cards-core.js——
 * 那是从 cards.vue 的纯逻辑区逐字搬来的，mp-tools/cards-regression.cjs 会比对两份是否一致。
 * 本文件只负责「点哪儿、画什么、发什么提示」。
 */
const { gameState, addCoins, spendCoins } = require('../store.js');
const {
  CARD_TARGET, COMPLETE_REWARD_COINS, SEASON_SHOP_COST, EXCHANGE_COST,
  countCompletedSets, drawFragment, pickRandomCardId, findCardById, exchangeFragment, ensureCardFields,
} = require('../game/cards-core.js');
const { createModals } = require('../modals.js');
const { screen } = require('../screen.js');
const { replaceScene } = require('../app.js');
const { toast } = require('../platform.js');
const {
  img, loadImages, vw, vh, rem, text, textIn, roundRect,
  drawCover, drawContain, hit, beginFrame, tap,
} = require('../ui.js');

function createCardsScene(makeHomeScene, debugModal) {
  const album = () => gameState.cardsAlbum || [];
  const modals = createModals();
  let ready = false;
  let selected = null;
  /* 兑换屋的两个选择：消耗哪套的重复碎片、补给哪套。存在场景里而不是 payload 里，
   * 因为点一下筹码就要换选中态，而 payload 是 open 时定死的。 */
  let exchangeSource = '';
  let exchangeTarget = '';
  /** 头图按原始宽高比铺满屏宽，热区要跟着它算，所以量一次存起来。 */
  let discRect = { x: 0, y: 0, w: 0, h: 0 };

  /** 相对头图的百分比热区 → 屏幕矩形，百分比取自 cards.vue 的 .hotspot-*。 */
  function discSpot(left, top, w, h) {
    return {
      x: discRect.x + discRect.w * left / 100,
      y: discRect.y + discRect.h * top / 100,
      w: discRect.w * w / 100,
      h: discRect.h * h / 100,
    };
  }

  /* 抽到碎片之后统一走这里：同步长期任务进度、按三种结果给不同提示。
   * 口径照搬小程序的 syncAlbumProgress + announceDraw。 */
  function announce(res, cardName) {
    if (!res || !res.ok) return;
    const sets = countCompletedSets(album());
    const task = (gameState.longTasks || []).find((t) => t.id === 'long_card9');
    if (task) task.current = Math.min(task.target || CARD_TARGET, sets);

    if (res.rewardGranted) {
      addCoins(COMPLETE_REWARD_COINS);
      toast('集齐【' + cardName + '】！+' + COMPLETE_REWARD_COINS + '金币');
    } else if (res.duplicate) {
      toast('已集满，转为重复碎片×1（共' + res.duplicates + '）');
    } else {
      toast('获得【' + cardName + '】碎片 x1');
    }
  }

  /** 看广告抽一张随机碎片（头图右上角的「视频宝箱」，以及卡片详情里的按钮）。
   *  两个入口分成两个投放位，后台才看得出哪个位置的广告有人看。 */
  function drawByAd(cardId) {
    modals.playAd(cardId ? 'cardsDetail' : 'cardsChest', () => {
      const id = cardId || pickRandomCardId(album());
      const card = findCardById(album(), id);
      if (!card) { toast('卡册数据异常，请稍后重试'); return; }
      announce(drawFragment(album(), id), card.name);
      selected = null;
    });
  }

  const duplicates = () => album().map(ensureCardFields).filter((c) => c.duplicates > 0);
  const incomplete = () => album().filter((c) => c.count < CARD_TARGET);

  function openExchange() {
    const dups = duplicates(), todo = incomplete();
    exchangeSource = dups.length ? dups[0].id : '';
    exchangeTarget = todo.length ? todo[0].id : '';
    modals.open('aux', {
      title: '兑换屋',
      desc: '消耗' + EXCHANGE_COST + '张重复碎片，兑换1张自选卡册碎片。',
      btnText: '确认兑换',
      sections: () => [
        {
          label: '1. 选择要消耗的重复碎片（每' + EXCHANGE_COST + '张换1张）',
          empty: '暂无重复碎片：重复抽到已集满的卡册即可获得。',
          chips: duplicates().map((c) => ({ id: c.id, label: c.name + ' ×' + c.duplicates, on: c.id === exchangeSource })),
          onPick: (id) => { exchangeSource = id; },
        },
        {
          label: '2. 选择要兑换的卡册（未集满）',
          empty: '全部卡册均已集满，无需兑换。',
          chips: incomplete().map((c) => ({ id: c.id, label: c.name + ' ' + c.count + '/' + CARD_TARGET, on: c.id === exchangeTarget })),
          onPick: (id) => { exchangeTarget = id; },
        },
      ],
      onAction: () => {
        const res = exchangeFragment(album(), exchangeSource, exchangeTarget);
        if (!res.ok) {
          const why = {
            insufficient: '重复碎片不足，需' + EXCHANGE_COST + '张（当前' + (res.have || 0) + '张）',
            same: '不能兑换同一套卡册',
            target_full: '该卡册已集满，无需兑换',
          }[res.reason] || '请先选择重复碎片与兑换目标';
          toast(why);
          return;
        }
        const dst = findCardById(album(), exchangeTarget);
        const src = findCardById(album(), exchangeSource);
        if (src && src.duplicates <= 0) exchangeSource = '';
        announce(res, dst ? dst.name : '');
        toast('兑换成功！获得【' + (dst ? dst.name : '') + '】碎片');
      },
    });
  }

  function openSeasonShop() {
    modals.open('aux', {
      title: '赛季商店',
      desc: '消耗 ' + SEASON_SHOP_COST + ' 金币直接购买冬日限定卡包，立即获得1张随机碎片（本地演示，无真实广告）。',
      btnText: '购买卡包（' + SEASON_SHOP_COST + ' 金币）',
      onAction: (done) => {
        /* 赛季商店是花钱直购，不播广告——这条口径在回归脚本里被单独钉住过。 */
        if (!spendCoins(SEASON_SHOP_COST)) { toast('金币不足！可以通过通关获取金币'); return; }
        const id = pickRandomCardId(album());
        const card = findCardById(album(), id);
        if (!card) { toast('卡册数据异常，请稍后重试'); return; }
        const res = drawFragment(album(), id);
        done();
        announce(res, card.name);
      },
    });
  }

  function openCollection() {
    modals.open('aux', {
      title: '赛季收藏',
      desc: '已达成赛季收集进度：' + countCompletedSets(album()) + '/' + CARD_TARGET
        + ' 套。集齐全部' + CARD_TARGET + '套即可获得限定金杯称号！',
      btnText: '我知道了',
      onAction: (done) => done(),
    });
  }

  function drawDetail(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, 0, screen.W, screen.H);
    hit({ x: 0, y: 0, w: screen.W, h: screen.H }, () => { selected = null; });

    /* 面板比第一版高 6vh：底下多了「看广告得碎片」按钮，不加高的话
     * 「集齐整套即可开启宝箱」那行会被按钮压住。 */
    const panel = { x: vw(12), y: vh(20), w: vw(76), h: vh(58) };
    ctx.fillStyle = '#f6efe0';
    roundRect(ctx, panel, vw(4));
    ctx.fill();
    hit(panel, () => {});   // 面板吞掉点击，别穿透到遮罩

    text(ctx, selected.name, panel.x + panel.w / 2, panel.y + vh(4.5),
      { size: rem(1.2), weight: 'bold', color: '#2c5b4c' });

    drawContain(ctx, img('card_' + selected.id),
      { x: panel.x + vw(14), y: panel.y + vh(8), w: panel.w - vw(28), h: vh(26) });

    text(ctx, `当前收集进度：${selected.count}/${selected.target}`,
      panel.x + panel.w / 2, panel.y + vh(37), { size: rem(0.9), color: '#46695c' });
    text(ctx, '集齐整套即可开启宝箱获得稀有奖励',
      panel.x + panel.w / 2, panel.y + vh(41.5), { size: rem(0.72), color: '#6b7d73', fit: panel.w * 0.88 });

    /* 详情里也能看广告补一张碎片——小程序那个按钮是 drawSpecificCard(selectedCard)。 */
    const card = selected;
    const adBtn = { x: panel.x + (panel.w - vw(56)) / 2, y: panel.y + panel.h - vh(14), w: vw(56), h: vh(5.4) };
    ctx.fillStyle = '#e0a020';
    roundRect(ctx, adBtn, adBtn.h / 2);
    ctx.fill();
    textIn(ctx, '看广告得碎片 +1', adBtn, { weight: 'bold', size: adBtn.h * 0.4 });
    hit(adBtn, () => drawByAd(card.id));

    const close = { x: panel.x + (panel.w - vw(40)) / 2, y: panel.y + panel.h - vh(7.4), w: vw(40), h: vh(5.4) };
    ctx.fillStyle = '#55a297';
    roundRect(ctx, close, close.h / 2);
    ctx.fill();
    textIn(ctx, '关闭', close, { weight: 'bold' });
    hit(close, () => { selected = null; });
  }

  return {
    async enter() {
      selected = null;
      const table = { cards_top_disc: 'static/cards/cards_top_disc.jpg' };
      album().forEach((c) => { table['card_' + c.id] = 'static/cards/' + c.image; });
      await Promise.all([loadImages(table), modals.preload()]);
      ready = true;
      /* 调试直开，同 home.js：DEBUG_SCENE = 'cards#exchange' 等。 */
      if (debugModal === 'exchange') openExchange();
      else if (debugModal === 'seasonShop') openSeasonShop();
      else if (debugModal === 'collection') openCollection();
      else if (debugModal === 'detail') selected = album()[0];
    },

    update(dt) { modals.update(dt); },

    draw(ctx) {
      beginFrame();
      ctx.fillStyle = '#2f5d4f';
      ctx.fillRect(0, 0, screen.W, screen.H);

      if (!ready) {
        text(ctx, '加载中…', screen.W / 2, screen.H / 2, { size: rem(1.1) });
        return;
      }

      // 头图：铺满屏宽、按原比例定高，从安全区下面开始
      const disc = img('cards_top_disc');
      discRect = {
        x: 0, y: screen.safeTop, w: screen.W,
        h: disc ? screen.W * disc.height / disc.width : vh(24),
      };
      if (disc) ctx.drawImage(disc, discRect.x, discRect.y, discRect.w, discRect.h);

      /* 五个热区，百分比与 cards.vue 的 .hotspot-* 对齐（right/bottom 换算成 left/top）。
       * 赛季商店那个在头图下沿之外（原 CSS 是 bottom:-28%），所以 top 会超过 100%。 */
      hit(discSpot(2.5, 8, 10, 15), () => replaceScene(makeHomeScene()));
      hit(discSpot(80, 18, 18, 22), () => drawByAd());
      hit(discSpot(1, 73, 17, 25), openExchange);
      hit(discSpot(82, 73, 17, 25), openCollection);
      hit(discSpot(1, 103, 18, 25), openSeasonShop);

      const list = album();
      const collected = list.filter((c) => c.count > 0).length;
      const pill = { x: (screen.W - vw(44)) / 2, y: discRect.y + discRect.h + vh(1.4), w: vw(44), h: vh(4) };
      ctx.fillStyle = 'rgba(255,196,61,.95)';
      roundRect(ctx, pill, pill.h / 2);
      ctx.fill();
      textIn(ctx, `冬日欢乐  ${collected}/${list.length}`, pill, { color: '#20372c', weight: 'bold' });

      /* 九张卡必须一屏放下。小程序那边外面套的是 <scroll-view>，小游戏没有滚动容器，
       * 自己实现惯性滚动只为这一页不划算——所以改成按剩余高度收缩卡片，
       * 三行一定落在安全区以内（卡面是等比 drawCover，压缩的是裁切量不是画面比例）。 */
      const gridTop = pill.y + pill.h + vh(2);
      const gap = vw(3);
      const rowGap = vh(1.6);
      const cw = (screen.W - vw(8) - gap * 2) / 3;
      const avail = screen.H - screen.safeBottom - vh(2) - gridTop;
      const ch = Math.min(cw * 1.42, (avail - rowGap * 2) / 3);

      list.forEach((card, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const r = { x: vw(4) + col * (cw + gap), y: gridTop + row * (ch + rowGap), w: cw, h: ch };

        ctx.save();
        roundRect(ctx, r, cw * 0.08);
        ctx.clip();
        const art = img('card_' + card.id);
        if (art) drawCover(ctx, art, r);
        else { ctx.fillStyle = '#3d7263'; ctx.fillRect(r.x, r.y, r.w, r.h); }
        /* 没集到的压暗。小程序版没有这一层，但那边有 :active 高亮和滚动反馈，
         * canvas 上什么都没有，至少要让「有没有」一眼看得出来。 */
        if (card.count <= 0) {
          ctx.fillStyle = 'rgba(8,24,18,.55)';
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        ctx.restore();

        hit(r, () => { selected = card; });
      });

      if (selected) drawDetail(ctx);
      modals.draw(ctx);
    },

    onTouchStart(p) { modals.onTouchStart(p); },
    onTouchMove(p) { modals.onTouchMove(p); },
    onTouchEnd(p) { if (!modals.onTouchEnd(p)) tap(p); },
  };
}

module.exports = { createCardsScene };
