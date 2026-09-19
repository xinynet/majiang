/* 牌桌场景。对应小程序的 pkg-game/pages/game/game.vue。
 *
 * 玩法规则一行没改——`src/game/game-core.js` 与 `tile-motion.js` 是从小程序原样搬来的，
 * 本来就是「不碰 DOM」的纯逻辑。这里重写的只有 game.vue 里那部分 WXML/WXSS：
 * 顶栏、关卡状态条、七格卡槽、四个道具位、暂停/胜负弹窗，全部改成 canvas 自绘 + 自测命中。
 *
 * 一个关键的结构差异：小程序里牌桌是一块独立的 <canvas>，叠在 <image> 背景之上，
 * canvas-board.js 每帧 clearRect 自己那块画布不会影响背景。小游戏只有一块主画布，
 * 直接让它 clearRect 会把背景一起擦掉。所以牌堆仍然画在一块**离屏画布**上，
 * 每帧再整块 blit 到主画布——既不用动 canvas-board.js，也保住了背景。
 */
const { createGame, boardMetrics, faceKey } = require('../game/game-core.js');
const { createBoardRenderer } = require('../game/canvas-board.js');
const { TileMotion } = require('../game/tile-motion.js');
const { drawShuffleHands } = require('../game/shuffle-hands.js');
const { canvasHost, createEmitter, toast } = require('../platform.js');
const { gameState, winLevelAction, refundStamina, formatSeconds } = require('../store.js');
const { createModals } = require('../modals.js');
const { screen } = require('../screen.js');
const { replaceScene } = require('../app.js');
const {
  img, loadImages, vw, vh, rem, text, textIn, roundRect,
  drawContain, drawCover, hit, beginFrame, tap,
} = require('../ui.js');

/* 四个道具位。price / desc 与小程序 openRefill() 里那串 if-else 逐项对齐。 */
const TOOL_BAR = [
  { id: 'clear', label: '消除', icon: 'tool-clear', desc: '移出卡槽中的前三张牌', price: 100 },
  { id: 'shuffle', label: '洗牌', icon: 'tool-shuffle', desc: '将场上的牌打乱', price: 300 },
  { id: 'undo', label: '翻牌', icon: 'tool-undo', desc: '撤回上一次点击的牌', price: 100 },
  { id: 'magnet', label: '磁铁', icon: 'tool-magnet', desc: '自动吸附消除一组相同牌', price: 300 },
];

/* debugModal 同 home.js：DEBUG_SCENE = 'board#refill' 时直接把补给弹窗开出来，
 * 截图工具点不了 canvas 上的「+」。 */
function createBoardScene(homeSceneFactory, debugModal) {
  const modals = createModals();
  let game = null;
  let renderer = null;
  let host = null;
  let metrics = null;
  let boardCanvas = null;
  let boardSize = { width: 0, height: 0 };
  let boardRect = { x: 0, y: 0, w: 0, h: 0 };
  let handImage = null;
  let dealStart = 0, dealLength = 1;
  let clockTimer = null;
  let level = 1;
  let challenge = false;
  /** 'playing' | 'paused' | 'won' | 'lost' | 'error' */
  let phase = 'playing';
  let lostInfo = null;
  let errorText = '';
  const faces = new Map();
  const pendingFaces = new Set();

  /* ---------------------------------------------------------------- 布局 */

  /* 一屏的纵向切分。全部按屏高百分比算，不写死 px——
   * 小游戏要覆盖从 16:9 到 21:9 的机型，写死的高度在长屏上会把牌桌压扁。 */
  function layout() {
    const topBarY = screen.safeTop;
    const topBarH = vh(6);
    const statusY = topBarY + topBarH;
    const statusH = vh(3.4);
    const dockH = vh(11);
    const dockY = screen.H - screen.safeBottom - dockH - vh(1);
    const trayH = vh(7.2);
    const trayY = dockY - trayH - vh(3.2);
    return {
      topBar: { x: 0, y: topBarY, w: screen.W, h: topBarH },
      status: { x: vw(4), y: statusY, w: vw(92), h: statusH },
      board: { x: 0, y: statusY + statusH + vh(0.6), w: screen.W, h: trayY - (statusY + statusH) - vh(2.4) },
      tray: { x: vw(4), y: trayY, w: vw(92), h: trayH },
      dock: { x: vw(3), y: dockY, w: vw(94), h: dockH },
    };
  }

  /* ---------------------------------------------------------------- 牌堆 */

  function ordered() {
    const s = game.state;
    const maxLayer = Math.max(0, ...s.tiles.map((t) => t.layoutZ ?? t.z));
    return s.tiles.filter((t) => !t.removed && !t.inTray)
      .sort((a, b) => TileMotion.depth(a.z, a.stand || 0, maxLayer) - TileMotion.depth(b.z, b.stand || 0, maxLayer));
  }

  function faceFor(type) {
    const key = faceKey(type);
    if (faces.has(key)) return faces.get(key);
    if (!pendingFaces.has(key)) {
      pendingFaces.add(key);
      host.loadImage('static/tiles-face/' + key + '.png')
        .then((image) => { faces.set(key, image); renderer && renderer.invalidate(); })
        .catch(() => {});
    }
    return null;
  }

  function paintBoard() {
    if (!renderer || !game || !metrics) return;
    renderer.draw(ordered(), metrics, { ...boardSize, makeCanvas: host.makeCanvas });
    // 手画在牌堆之后，才是「手从牌上扫过去」而不是「手在牌下面」
    if (game.state.dealing) {
      drawShuffleHands(host.ctx, handImage, boardSize.width, boardSize.height,
        (Date.now() - dealStart) / dealLength);
    }
  }

  /* ---------------------------------------------------------------- 时钟 */

  function startClock() {
    stopClock();
    clockTimer = setInterval(() => {
      /* 暂停、买补给、看广告期间倒计时一起冻结——口径同小程序的 modalOpen，
       * 否则玩家在弹窗里挑道具的十几秒会白白烧掉。 */
      if (phase !== 'playing' || modals.isOpen()) return;
      if (!game.tick()) stopClock();
    }, 1000);
  }

  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  /* 对局里的道具数是全局存档的副本（game-core 自己维护 state.tools），
   * 每次消耗都要写回 gameState.tools，否则退出对局道具就「复活」了。 */
  function pushToolsToGlobal() {
    if (!game) return;
    const tools = game.state.tools || {};
    Object.keys(tools).forEach((k) => { gameState.tools[k] = tools[k]; });
  }

  function onEvent(name, payload) {
    if (name === 'won') {
      stopClock();
      phase = 'won';
      winLevelAction(level, game.state.score, challenge ? 2 : 1);
      pushToolsToGlobal();
    }
    if (name === 'lost') {
      stopClock();
      phase = 'lost';
      lostInfo = payload || { title: '本局结束', desc: '' };
      pushToolsToGlobal();
    }
  }

  /* ---------------------------------------------------------------- 绘制 */

  function drawTopBar(ctx, L) {
    const r = L.topBar;
    const btn = { x: vw(4), y: r.y + (r.h - vh(4.6)) / 2, w: vh(4.6), h: vh(4.6) };
    ctx.fillStyle = 'rgba(12,44,36,.55)';
    ctx.beginPath();
    ctx.arc(btn.x + btn.w / 2, btn.y + btn.h / 2, btn.w / 2, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, '⏸', btn.x + btn.w / 2, btn.y + btn.h / 2, { size: btn.h * 0.5 });
    hit(btn, () => { phase = 'paused'; });

    // 星星数
    const badge = { x: btn.x + btn.w + vw(2.5), y: btn.y + btn.h * 0.12, w: vw(22), h: btn.h * 0.76 };
    ctx.fillStyle = 'rgba(12,44,36,.42)';
    roundRect(ctx, badge, badge.h / 2);
    ctx.fill();
    text(ctx, '⭐ ' + game.state.score, badge.x + badge.w / 2, badge.y + badge.h / 2,
      { size: badge.h * 0.55, fit: badge.w * 0.9 });

    // 倒计时
    const urgent = game.state.remain < 60;
    const pill = { x: screen.W - vw(4) - vw(26), y: btn.y + btn.h * 0.12, w: vw(26), h: btn.h * 0.76 };
    ctx.fillStyle = urgent ? 'rgba(180,44,38,.82)' : 'rgba(12,44,36,.55)';
    roundRect(ctx, pill, pill.h / 2);
    ctx.fill();
    text(ctx, '⏱ ' + formatSeconds(game.state.remain), pill.x + pill.w / 2, pill.y + pill.h / 2,
      { size: pill.h * 0.55, fit: pill.w * 0.88 });
  }

  function drawStatus(ctx, L) {
    const r = L.status;
    const s = game.state;
    const remaining = s.tiles.filter((t) => !t.removed && !t.inTray).length;
    const cy = r.y + r.h / 2;
    text(ctx, `关卡${level}`, r.x, cy, { align: 'left', size: r.h * 0.62, weight: 'bold', stroke: 'rgba(8,36,28,.55)' });
    let x = r.x + vw(16);
    if (challenge) {
      text(ctx, '每日挑战', x, cy, { align: 'left', size: r.h * 0.52, color: '#ffe08a', stroke: 'rgba(8,36,28,.55)' });
      x += vw(17);
    }
    text(ctx, `种类${s.initialTypeCount}`, x, cy, { align: 'left', size: r.h * 0.52, color: '#e6f3ec', stroke: 'rgba(8,36,28,.5)' });
    text(ctx, `总数${s.initial}`, x + vw(15), cy, { align: 'left', size: r.h * 0.52, color: '#e6f3ec', stroke: 'rgba(8,36,28,.5)' });
    text(ctx, '剩余数量', r.x + r.w - vw(11), cy, { align: 'right', size: r.h * 0.52, color: '#e6f3ec', stroke: 'rgba(8,36,28,.5)' });
    text(ctx, String(remaining), r.x + r.w, cy, { align: 'right', size: r.h * 0.78, weight: 'bold', color: '#ffd76a', stroke: 'rgba(8,36,28,.55)' });
  }

  function drawTray(ctx, L) {
    const r = L.tray;
    const slots = game.state.slots;
    const danger = slots.length >= 6;
    ctx.fillStyle = danger ? 'rgba(150,40,34,.35)' : 'rgba(10,40,32,.30)';
    roundRect(ctx, { x: r.x, y: r.y, w: r.w, h: r.h }, r.h * 0.22);
    ctx.fill();
    const pad = r.h * 0.12;
    const cell = (r.w - pad * 8) / 7;
    for (let i = 0; i < 7; i++) {
      const c = { x: r.x + pad + i * (cell + pad), y: r.y + pad, w: cell, h: r.h - pad * 2 };
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      roundRect(ctx, c, c.w * 0.16);
      ctx.fill();
      const t = slots[i];
      if (!t) continue;
      const face = faceFor(t.type);
      if (face) drawContain(ctx, face, { x: c.x + c.w * 0.06, y: c.y + c.h * 0.06, w: c.w * 0.88, h: c.h * 0.88 });
      else textIn(ctx, t.type[0], c, { color: '#123', size: c.h * 0.5 });
    }
    // 连击倍数
    text(ctx, 'x' + game.state.combo, r.x + r.w - vw(1), r.y - vh(1.2),
      { align: 'right', baseline: 'bottom', size: rem(1.05), color: '#ffe08a', stroke: 'rgba(8,36,28,.6)' });
  }

  function drawDock(ctx, L) {
    const r = L.dock;
    const gap = r.w * 0.03;
    const cw = (r.w - gap * 3) / 4;
    TOOL_BAR.forEach((tool, i) => {
      const c = { x: r.x + i * (cw + gap), y: r.y, w: cw, h: r.h };
      ctx.fillStyle = 'rgba(10,40,32,.42)';
      roundRect(ctx, c, c.w * 0.18);
      ctx.fill();
      const icon = img(tool.icon);
      drawContain(ctx, icon, { x: c.x + c.w * 0.16, y: c.y + c.h * 0.08, w: c.w * 0.68, h: c.h * 0.52 });
      text(ctx, tool.label, c.x + c.w / 2, c.y + c.h * 0.78, { size: c.h * 0.17, fit: c.w * 0.8 });

      const count = game.state.tools[tool.id] || 0;
      const badge = { x: c.x + c.w * 0.62, y: c.y + c.h * 0.02, w: c.w * 0.36, h: c.h * 0.26 };
      ctx.fillStyle = count > 0 ? 'rgba(255,196,61,.95)' : 'rgba(92,190,120,.95)';
      roundRect(ctx, badge, badge.h / 2);
      ctx.fill();
      textIn(ctx, count > 0 ? String(count) : '+', badge, { color: '#20372c', weight: 'bold' });

      /* 有存货就用，没存货点开补给弹窗——小程序里「+」号走的就是 openRefill。 */
      hit(c, () => {
        if (count > 0) { game.useTool(tool.id); return; }
        modals.open('refill', {
          tool: tool.id, title: tool.label, desc: tool.desc, price: tool.price, icon: tool.icon,
          onGrant: (id) => {
            gameState.tools[id] = (gameState.tools[id] || 0) + 1;
            if (game) game.state.tools[id] = (game.state.tools[id] || 0) + 1;
          },
        });
      });
    });
  }

  /* 弹窗统一长这样：半透明遮罩 + 圆角面板 + 若干按钮。
   * 遮罩本身也登记成热区，挡住底下牌桌的点击——canvas 没有事件冒泡，
   * 不挡的话玩家在结算界面点到的是下面的牌。 */
  function drawDialog(ctx, { title, desc, lines = [], buttons }) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, screen.W, screen.H);
    hit({ x: 0, y: 0, w: screen.W, h: screen.H }, () => {});

    const panel = { x: vw(12), y: vh(28), w: vw(76), h: vh(40) };
    ctx.fillStyle = '#f6efe0';
    roundRect(ctx, panel, vw(4));
    ctx.fill();
    ctx.strokeStyle = 'rgba(85,162,151,.9)';
    ctx.lineWidth = Math.max(2, vw(0.6));
    ctx.stroke();

    text(ctx, title, panel.x + panel.w / 2, panel.y + vh(5),
      { size: rem(1.35), weight: 'bold', color: '#2c5b4c', fit: panel.w * 0.86 });
    if (desc) {
      text(ctx, desc, panel.x + panel.w / 2, panel.y + vh(9.5),
        { size: rem(0.85), color: '#6b7d73', fit: panel.w * 0.86 });
    }
    lines.forEach((line, i) => {
      text(ctx, line, panel.x + panel.w / 2, panel.y + vh(14) + i * vh(4),
        { size: rem(0.95), color: '#46695c', fit: panel.w * 0.86 });
    });

    const bw = panel.w * 0.68;
    const bh = vh(6);
    buttons.forEach((b, i) => {
      const r = { x: panel.x + (panel.w - bw) / 2, y: panel.y + panel.h - vh(3) - (buttons.length - i) * (bh + vh(1.4)), w: bw, h: bh };
      ctx.fillStyle = b.primary ? '#55a297' : '#cfd9d2';
      roundRect(ctx, r, bh / 2);
      ctx.fill();
      textIn(ctx, b.label, r, { color: b.primary ? '#fff' : '#3f5a50', weight: 'bold', size: bh * 0.42 });
      hit(r, b.onTap);
    });
  }

  function backHome() {
    stopClock();
    pushToolsToGlobal();
    if (game) { game.destroy(); game = null; }
    replaceScene(homeSceneFactory());
  }

  function restart() {
    phase = 'playing';
    lostInfo = null;
    start(level);
  }

  function start(lv) {
    dealStart = Date.now();
    dealLength = game.build(lv, boardSize.width / boardSize.height, buildConfig());
    // build() 会把 tools 重置成默认值，这里改回玩家存档里的真实持有量
    game.state.tools = { ...gameState.tools };
    metrics = boardMetrics(game.state.tiles, lv, boardSize.width, boardSize.height);
    startClock();
  }

  function buildConfig() {
    return { gmMode: !!(gameState.settings && gameState.settings.gmMode) };
  }

  /* ---------------------------------------------------------------- 场景接口 */

  return {
    async enter(params = {}) {
      level = params.level || gameState.currentLevel || 1;
      challenge = params.mode === 'challenge';
      phase = 'playing';
      errorText = '';

      const L = layout();
      boardRect = L.board;
      boardSize = { width: Math.round(L.board.w), height: Math.round(L.board.h) };

      try {
        boardCanvas = wx.createCanvas();      // 首屏画布已被 app.js 取走，这里拿到的是离屏画布
        boardCanvas.width = boardSize.width;
        boardCanvas.height = boardSize.height;
        host = canvasHost(boardCanvas);

        await Promise.all([
          loadImages({
            meadow: 'static/bg/meadow.png',
            'tool-clear': 'static/tools/tool-clear.png',
            'tool-shuffle': 'static/tools/tool-shuffle.png',
            'tool-undo': 'static/tools/tool-undo.png',
            'tool-magnet': 'static/tools/tool-magnet.png',
          }),
          modals.preload(),   // 补给弹窗要的金币/摄像机图标
        ]);

        /* 手的图不 await：缺一只手不该让这局发不了牌。图集则是必需品。 */
        host.loadImage('static/hands/right-hand-long.png')
          .then((image) => { handImage = image; })
          .catch(() => {});
        const atlas = await host.loadImage('static/tile-poses/shells.png');

        game = createGame({ motion: TileMotion, emit: createEmitter({ onEvent }) });
        renderer = createBoardRenderer(host.ctx, atlas, faceFor);
        game.state.tools = { ...gameState.tools };
        start(level);
        if (debugModal === 'refill') {
          const t = TOOL_BAR[1];   // 洗牌，价格 300，两个按钮都看得清
          modals.open('refill', {
            tool: t.id, title: t.label, desc: t.desc, price: t.price, icon: t.icon,
            onGrant: () => {},
          });
        }
      } catch (e) {
        console.error('[board] 初始化失败', e);
        phase = 'error';
        errorText = '牌桌加载失败，请返回首页重试';
        // 没玩成不能倒扣体力
        if (!(gameState.settings && gameState.settings.gmMode)) refundStamina(1);
      }
    },

    exit() {
      stopClock();
      if (game) { game.destroy(); game = null; }
      renderer = null;
    },

    update(dt) {
      modals.update(dt);
      /* 弹窗开着的时候连牌的动画也停下：小程序那边是把 canvas 整个 hidden 掉的，
       * 这里没有那一层，至少别让牌在遮罩后面继续飞。 */
      if (game && phase === 'playing' && !modals.isOpen()) game.stepMotion(dt);
    },

    draw(ctx) {
      beginFrame();
      const L = layout();

      // 背景：草地色打底 + 野餐布条，和小程序版 .g-meadow 的观感一致
      ctx.fillStyle = '#4e9c82';
      ctx.fillRect(0, 0, screen.W, screen.H);
      const meadow = img('meadow');
      if (meadow) drawCover(ctx, meadow, { x: 0, y: 0, w: screen.W, h: screen.H * 0.42 });

      if (phase === 'error' || !game) {
        text(ctx, errorText || '加载中…', screen.W / 2, screen.H / 2, { size: rem(1.1) });
        if (errorText) {
          const r = { x: vw(25), y: screen.H / 2 + vh(5), w: vw(50), h: vh(6) };
          ctx.fillStyle = '#55a297';
          roundRect(ctx, r, r.h / 2);
          ctx.fill();
          textIn(ctx, '返回首页', r, { weight: 'bold' });
          hit(r, backHome);
        }
        return;
      }

      paintBoard();
      ctx.drawImage(boardCanvas, boardRect.x, boardRect.y);

      drawTopBar(ctx, L);
      drawStatus(ctx, L);
      drawTray(ctx, L);
      drawDock(ctx, L);

      if (game.state.dealing) {
        text(ctx, '发牌中…', screen.W / 2, boardRect.y + boardRect.h * 0.5,
          { size: rem(1.1), color: 'rgba(255,255,255,.9)', stroke: 'rgba(8,36,28,.5)' });
      }

      if (phase === 'paused') {
        drawDialog(ctx, {
          title: '已暂停',
          desc: `关卡 ${level}`,
          buttons: [
            { label: '继续游戏', primary: true, onTap: () => { phase = 'playing'; } },
            { label: '重新开始', onTap: restart },
            { label: '返回首页', onTap: backHome },
          ],
        });
      } else if (phase === 'won') {
        drawDialog(ctx, {
          title: '过关啦！',
          desc: `关卡 ${level} 完成`,
          lines: [`获得星星 ${game.state.score}`, `剩余时间 ${formatSeconds(game.state.remain)}`],
          buttons: [
            { label: '下一关', primary: true, onTap: () => { level += 1; restart(); } },
            { label: '返回首页', onTap: backHome },
          ],
        });
      } else if (phase === 'lost') {
        drawDialog(ctx, {
          title: (lostInfo && lostInfo.title) || '本局结束',
          desc: (lostInfo && lostInfo.desc) || '',
          buttons: [
            { label: '再来一局', primary: true, onTap: restart },
            { label: '返回首页', onTap: backHome },
          ],
        });
      }

      /* 补给弹窗与广告层画在最后：它们要盖住「发牌中…」和结算面板。 */
      modals.draw(ctx);
    },

    onTouchStart(p) { modals.onTouchStart(p); },
    onTouchMove(p) { modals.onTouchMove(p); },

    onTouchEnd(p) {
      // 补给弹窗/广告开着的时候，这一下全归它
      if (modals.onTouchEnd(p)) return;
      // 弹窗/道具/顶栏优先；没命中任何 UI 才算作点牌
      if (tap(p)) return;
      if (phase !== 'playing' || !game || !renderer || !metrics) return;
      if (game.state.dealing) return;
      const inBoard = p.x >= boardRect.x && p.x <= boardRect.x + boardRect.w
        && p.y >= boardRect.y && p.y <= boardRect.y + boardRect.h;
      if (!inBoard) return;
      const target = renderer.pick(ordered(), metrics, p.x - boardRect.x, p.y - boardRect.y);
      if (target) game.pick(target.id);
    },
  };
}

module.exports = { createBoardScene };
