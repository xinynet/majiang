/* Board state and rules, with no DOM and no rendering.
 *
 * app.js grew these rules tangled with element writes, which is exactly what a
 * mini-program cannot run. Everything here works on plain objects; the host
 * decides how to draw them and how to play sound, vibrate or show a toast, by
 * handling the events passed to emit().
 *
 * TileMotion is injected rather than imported because the web build loads it as
 * a classic script and the mini-program build imports it as a module.
 */

export const SYMBOLS = ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  '一索', '二索', '三索', '四索', '五索', '六索', '七索', '八索', '九索',
  '一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬',
  '熊猫', '狐狸', '猫咪', '小狗', '狮子', '老虎', '兔子', '猴子',
  '苹果', '橙子', '柠檬', '西瓜', '葡萄', '草莓', '樱桃', '桃子'];

export const PICTURE_TILES = {
  熊猫: 'panda', 狐狸: 'fox', 猫咪: 'cat', 小狗: 'dog', 狮子: 'lion', 老虎: 'tiger',
  兔子: 'rabbit', 猴子: 'monkey', 苹果: 'apple', 橙子: 'orange', 柠檬: 'lemon',
  西瓜: 'watermelon', 葡萄: 'grapes', 草莓: 'strawberry', 樱桃: 'cherry', 桃子: 'peach',
};

const FACE_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/* All 43 faces are images now, wan included, so nothing depends on a font. */
export function faceKey(type) {
  const n = FACE_NUM[type[0]] || 0;
  if (type.endsWith('萬')) return 'wan-' + n;
  if (type.endsWith('筒')) return 'circle-' + n;
  if (type.endsWith('索')) return 'bamboo-' + n;
  return PICTURE_TILES[type];
}

export function seeded(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function tileCountForLevel(level) {
  const n = Math.min(120, 30 + 15 * (level - 1));
  return n - n % 3;
}

export const SLOTS = 7;
export const ROUND_SECONDS = 600;
const TOOL_LABEL = { clear: '消除', shuffle: '洗牌', undo: '翻牌', magnet: '磁铁' };

function shuffleWith(rnd, list) {
  const c = [...list];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

/* Where every tile sits, in tile-width units.
 *
 * Layers fill one at a time rather than by a fixed share, so a level with few
 * tiles lies flat across the whole table and only a crowded one stacks. `aspect`
 * is the board's width/height; the caller measures it because only the caller
 * knows what it is drawing into.
 */
export function makeLayout(level, rnd, aspect = 0.76) {
  const count = tileCountForLevel(level);
  // The grid one layer can hold at the fixed tile size.
  const cols = Math.max(2, Math.round(TILES_ACROSS));
  const rows = Math.max(2, Math.floor((TILES_ACROSS / aspect) / 1.3636));
  const perLayer = cols * rows;
  const layers = Math.max(1, Math.min(MAX_LAYERS + 1, Math.ceil(count / perLayer)));
  const positions = [];

  let placed = 0;
  for (let z = 0; z < layers; z++) {
    // Spread the remainder over the last layers instead of leaving a lone tile
    // on top of a full one.
    const n = Math.min(count - placed, Math.ceil((count - placed) / (layers - z)));
    placed += n;
    // Take scattered cells, not the first n, so a partly filled layer still
    // covers the table rather than banking up along the top rows.
    const cells = shuffleWith(rnd, Array.from({ length: perLayer }, (_, i) => i)).slice(0, n);
    for (const cell of cells) {
      const col = cell % cols, row = Math.floor(cell / cols);
      positions.push({
        x: col + (rnd() - .5) * .34,
        y: row + (rnd() - .5) * .32,
        z,
        rot: (rnd() - .5) * 74,
      });
    }
  }
  // Nudge apart only the pairs that almost exactly coincide; the rest keep overlapping.
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < positions.length; a++) for (let b = a + 1; b < positions.length; b++) {
    const p = positions[a], q = positions[b];
    if (p.z !== q.z) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, min = .34;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || .02, push = (min - d) / 2;
    q.x += dx / d * push; q.y += dy / d * push; p.x -= dx / d * push; p.y -= dy / d * push;
  }
  return positions;
}

/* How many tiles fit across the board. Tile size follows from this and nothing
 * else - in particular not from the level or the tile count, because a tile has
 * to look the same on every level. */
export const TILES_ACROSS = 7.2;
// Tiles never stack deeper than this, so the board can reserve the offset room up front.
export const MAX_LAYERS = 2;

/* Tile size, spacing and origin for a board of the given pixel size.
 *
 * Size and spread are deliberately separate. The tile keeps a fixed size and
 * only the spacing shrinks as a level holds more tiles, so a crowded level
 * becomes a denser pile rather than a board of smaller tiles.
 */
export function boardMetrics(tiles, level, viewW, viewH) {
  const xs = tiles.map(t => t.layoutX ?? t.x), ys = tiles.map(t => t.layoutY ?? t.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spreadX = maxX - minX, spreadY = maxY - minY;
  // Room for the layer offsets is always reserved, even on a flat level, so the
  // tile comes out exactly the same size whatever the level stacks up to.
  const edge = { left: 10 + MAX_LAYERS * 5, top: 10 + MAX_LAYERS * 9, right: 16, bottom: 18 };
  const availableW = Math.max(1, viewW - edge.left - edge.right);
  const availableH = Math.max(1, viewH - edge.top - edge.bottom);
  const ratio = 1.3636;
  const w = Math.max(20, availableW / TILES_ACROSS), h = w * ratio;
  // Neighbours touch at most; past that they overlap so the pile still fits.
  const sx = Math.min(
    w,
    spreadX > 0 ? (availableW - w) / spreadX : w,
    spreadY > 0 ? (availableH / ratio - w) / spreadY : w,
  );
  const sy = sx * ratio;
  const pileW = spreadX * sx + w, pileH = spreadY * sy + h;
  return {
    w, h, sx, sy,
    ox: edge.left + Math.max(0, availableW - pileW) / 2 - minX * sx,
    oy: edge.top + Math.max(0, availableH - pileH) / 2 - minY * sy,
  };
}

/* Tiles taken from the top first, so pulling a triple never leaves a floater. */
function removalOrder(list) {
  return [...list].sort((a, b) => b.z - a.z || a.y - b.y || a.x - b.x);
}

export function createGame({ motion, emit = () => {}, reducedMotion = false } = {}) {
  const state = {
    level: 1, tiles: [], slots: [], score: 0, combo: 1, comboUntil: 0,
    tools: { clear: 1, shuffle: 1, undo: 1, magnet: 1 },
    remain: ROUND_SECONDS, seconds: 0, shuffles: 0,
    initial: 0, initialTypeCount: 0,
    dealing: false, animating: false, over: false, motion: !reducedMotion,
  };
  let dealTimer = null, effectId = 0;

  const live = () => state.tiles.filter(t => !t.removed && !t.inTray);
  const changed = () => emit('board');

  /* Deals in triples, so every type appears a multiple of three times and the
   * level is always winnable. Types are scattered rather than grouped: any tile
   * can be tapped, so the only thing that matters is the counts. */
  function dealTriples(rnd) {
    const total = state.tiles.length, groupCount = Math.floor(total / 3);
    const pool = shuffleWith(rnd, SYMBOLS);
    const cap = Math.max(5, Math.min(pool.length, Math.ceil(groupCount * .63)));
    const types = pool.slice(0, cap);
    const bag = [];
    for (let i = 0; i < groupCount; i++) { const t = types[i % types.length]; bag.push(t, t, t); }
    const mixed = shuffleWith(rnd, bag);
    shuffleWith(rnd, state.tiles).forEach((tile, i) => { tile.type = mixed[i]; });
  }

  function reassignTypes(rnd) {
    const board = live();
    const bag = shuffleWith(rnd, board.map(t => t.type));
    board.forEach((t, i) => { t.type = bag[i]; });
  }

  /* Re-runs support: anything that lost its prop falls or topples. */
  function settle() {
    let moved = false;
    const targets = motion.targets(state.tiles);
    for (const t of state.tiles) {
      const goal = targets.get(t.id);
      if (!goal || (goal.z === t.z && goal.lean === (t.stand || 0) && goal.x === t.x)) continue;
      const from = { ...(t.motion?.current || { x: t.x, y: t.y, z: t.z, lean: t.stand || 0 }) };
      t.motion = { from, current: { ...from }, target: goal, velocity: t.motion?.velocity || 0, angularVelocity: t.motion?.angularVelocity || 0 };
      t.x = goal.x; t.y = goal.y; t.z = goal.z; t.stand = goal.lean; t.leanOn = goal.leanOn;
      if (!state.motion) t.motion = null;
      moved = true;
    }
    return moved;
  }

  /* Advances every falling tile. Returns true while anything is still moving,
   * so the host knows whether to keep requesting frames. */
  function stepMotion(dt) {
    let active = false;
    for (const t of state.tiles) {
      if (!t.motion || t.removed || t.inTray) continue;
      const steps = Math.max(1, Math.ceil(dt / .016));
      let done = false;
      for (let i = 0; i < steps && !done; i++) done = motion.step(t.motion, dt / steps);
      if (done) t.motion = null; else active = true;
    }
    return active;
  }

  function build(level, aspect) {
    clearTimeout(dealTimer);
    const run = ++effectId;
    Object.assign(state, {
      level, seconds: 0, remain: ROUND_SECONDS, shuffles: 0, slots: [], score: 0,
      combo: 1, comboUntil: 0, tools: { clear: 1, shuffle: 1, undo: 1, magnet: 1 },
      dealing: true, animating: true, over: false,
    });
    const rnd = seeded(level), rnd2 = seeded(level * 7 + 3);
    state.tiles = makeLayout(level, rnd, aspect).map((p, i) => ({
      id: i, type: '', ...p, layoutX: p.x, layoutY: p.y, layoutZ: p.z,
      rot: p.rot ?? 0, rot2: (rnd2() - .5) * 14, removed: false, inTray: false,
      stand: 0, leanOn: null, motion: null,
    }));
    dealTriples(rnd);
    motion.assignLeaners(state.tiles, seeded(level * 13 + 5));
    state.initial = state.tiles.length;
    state.initialTypeCount = new Set(state.tiles.map(t => t.type)).size;
    // Armed before the first emit: a throwing host handler must not leave the
    // board stuck in its dealing state forever.
    const dealDuration = state.motion ? 3400 : 120;
    dealTimer = setTimeout(() => {
      if (run !== effectId) return;
      state.dealing = false; state.animating = false;
      emit('dealt');
      changed();
    }, dealDuration);
    emit('built');
    changed();
    return dealDuration;
  }

  function bumpCombo() {
    const now = Date.now();
    state.combo = now < state.comboUntil ? Math.min(9, state.combo + 1) : 1;
    state.comboUntil = now + 5000;
  }

  function pick(id) {
    if (state.animating || state.over || state.dealing) return false;
    const t = state.tiles.find(x => x.id === id);
    if (!t || t.removed || t.inTray) return false;
    if (state.slots.length >= SLOTS) { emit('toast', '卡槽已满'); return false; }
    t.motion = null;
    t.inTray = true;
    // Slot next to its own kind so a forming triple reads as a group.
    const last = state.slots.map(s => s.type).lastIndexOf(t.type);
    state.slots.splice(last >= 0 ? last + 1 : state.slots.length, 0, t);
    settle();
    emit('sound', 430); emit('haptic');
    changed();
    resolveTray();
    return true;
  }

  function finishClear(picks, label) {
    picks.forEach(p => {
      p.removed = true; p.inTray = false;
      const i = state.slots.indexOf(p);
      if (i >= 0) state.slots.splice(i, 1);
    });
    settle(); bumpCombo();
    state.score += state.combo;
    state.animating = false;
    changed();
    if (label) emit('toast', label);
    if (state.tiles.every(x => x.removed)) { state.over = true; emit('won'); }
    else checkFail();
  }

  function resolveTray() {
    const counts = {};
    state.slots.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
    const hit = Object.keys(counts).find(k => counts[k] >= 3);
    if (!hit) { checkFail(); return; }
    state.animating = true;
    const picks = state.slots.filter(s => s.type === hit).slice(0, 3);
    emit('match', picks.map(p => state.slots.indexOf(p)));
    emit('sound', 620); emit('haptic', [12, 24, 28]);
    setTimeout(() => finishClear(picks), 300);
  }

  function clearTiles(picks, label) {
    state.animating = true;
    emit('sound', 620);
    setTimeout(() => finishClear(picks, label), 260);
  }

  function checkFail() {
    if (state.slots.length >= SLOTS) {
      state.over = true;
      emit('lost', { title: '卡槽已满', desc: '卡槽放满 7 张，但没有凑齐三张相同的麻将。' });
    }
  }

  const TOOLS = {
    clear() {
      const board = live(), counts = {};
      board.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
      const type = Object.keys(counts).filter(k => counts[k] >= 3).sort((a, b) => counts[b] - counts[a])[0];
      if (!type) { emit('toast', '牌面上没有可直接消除的三张'); return false; }
      clearTiles(removalOrder(board.filter(t => t.type === type)).slice(0, 3), `消除了三张${type}`);
    },
    shuffle() {
      reassignTypes(Math.random);
      state.shuffles++;
      changed();
      emit('toast', '牌面已重新洗过');
    },
    undo() {
      const t = state.slots.pop();
      if (!t) { emit('toast', '卡槽是空的，无需回退'); return false; }
      t.inTray = false;
      changed();
      checkFail();
      emit('toast', '已把最后一张放回牌面');
    },
    magnet() {
      const counts = {};
      state.slots.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
      const type = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (!type) { emit('toast', '卡槽为空，磁铁没有目标'); return false; }
      const need = 3 - counts[type], board = live().filter(t => t.type === type);
      if (board.length < need) { emit('toast', '牌面里没有足够的同款麻将'); return false; }
      clearTiles([...state.slots.filter(s => s.type === type), ...removalOrder(board).slice(0, need)],
        `磁铁吸出了${need}张${type}`);
    },
  };

  function useTool(name) {
    if (state.animating || state.over || state.dealing) return false;
    if ((state.tools[name] || 0) <= 0) { emit('needTool', { tool: name, label: TOOL_LABEL[name] || '道具' }); return false; }
    if (!TOOLS[name] || TOOLS[name]() === false) return false;
    state.tools[name]--;
    emit('haptic', [8, 20, 8]);
    changed();
    return true;
  }

  /* One second of clock. Returns false once time is up. */
  function tick() {
    if (state.over || state.dealing) return true;
    state.seconds++;
    state.remain--;
    if (state.remain > 0) return true;
    state.remain = 0; state.over = true;
    emit('lost', { title: '时间到', desc: '这一局的 10 分钟用完了。' });
    return false;
  }

  function stars() { return state.remain > 420 ? 3 : state.remain > 240 ? 2 : 1; }

  function destroy() { clearTimeout(dealTimer); effectId++; }

  return { state, build, pick, useTool, tick, settle, stepMotion, stars, destroy, live, liveCount: () => live().length };
}
