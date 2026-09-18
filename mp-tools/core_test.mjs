/* 核心玩法回归：直接驱动 game-core，不依赖渲染层。 */
import { createGame, SLOTS } from '../majiang-mp/src/game/game-core.js';
import { TileMotion } from '../majiang-mp/src/game/tile-motion.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

function newGame(level = 2, reducedMotion = true) {
  const events = [];
  const g = createGame({ motion: TileMotion, emit: (n, p) => events.push([n, p]), reducedMotion });
  g.build(level, 0.76);
  g.state.dealing = false; g.state.animating = false; // 跳过发牌动画窗口
  return { g, events };
}

const liveOf = g => g.state.tiles.filter(t => !t.removed && !t.inTray);
/* 三消/道具的移除是带 260~300ms 消除动画的异步收尾（finishClear），
 * 所以每次凑齐后必须等动画走完再断言，否则测的是动画中间态。 */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settleAnim = () => sleep(450);

console.log('[1] 发牌与可解性');
{
  for (const lvl of [1, 2, 3, 5, 10]) {
    const { g } = newGame(lvl);
    const counts = {};
    g.state.tiles.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
    const bad = Object.entries(counts).filter(([, n]) => n % 3 !== 0);
    ok(g.state.tiles.length > 0 && g.state.tiles.length % 3 === 0,
      `关卡${lvl}: 牌数 ${g.state.tiles.length} 是 3 的倍数`);
    ok(bad.length === 0, `关卡${lvl}: 每种牌张数都是 3 的倍数（可通关）${bad.length ? ' -> ' + JSON.stringify(bad) : ''}`);
  }
}

console.log('\n[2] 三张同款自动消除 + 计分');
{
  const { g, events } = newGame(2);
  const type = liveOf(g)[0].type;
  const three = liveOf(g).filter(t => t.type === type).slice(0, 3);
  const before = liveOf(g).length;
  three.forEach(t => ok(g.pick(t.id) === true, `点第 ${three.indexOf(t) + 1} 张「${type}」进卡槽`));
  await settleAnim();
  ok(g.state.slots.length === 0, '凑齐三张后卡槽被清空');
  ok(three.every(t => t.removed), '三张牌已从牌面移除');
  ok(liveOf(g).length === before - 3, `牌面剩余 ${before} -> ${liveOf(g).length}`);
  ok(g.state.score > 0, `得分 ${g.state.score} > 0`);
  ok(events.some(e => e[0] === 'match'), '触发了 match 事件');
}

console.log('\n[3] 整局打通 -> won');
{
  const { g, events } = newGame(2);
  let guard = 0;
  while (liveOf(g).length && guard++ < 500) {
    const board = liveOf(g);
    const counts = {};
    board.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
    const type = Object.keys(counts).find(k => counts[k] >= 3);
    if (!type) break;
    board.filter(t => t.type === type).slice(0, 3).forEach(t => g.pick(t.id));
    await settleAnim();
  }
  ok(liveOf(g).length === 0 && g.state.slots.length === 0, `全部消完（剩 ${liveOf(g).length}）`);
  ok(events.some(e => e[0] === 'won'), '发出了 won 事件');
  ok(g.state.over === true, 'state.over = true');
  ok([1, 2, 3].includes(g.stars()), `结算星级 ${g.stars()}`);
}

console.log('\n[4] 卡槽放满 7 张 -> lost');
{
  const { g, events } = newGame(5);
  const picked = new Set();
  for (const t of liveOf(g)) {
    if (picked.has(t.type)) continue;      // 每种只放一张，绝不会凑成三消
    picked.add(t.type);
    g.pick(t.id);
    if (g.state.slots.length >= SLOTS) break;
  }
  ok(g.state.slots.length === SLOTS, `卡槽放满 ${g.state.slots.length}/${SLOTS} 张`);
  ok(events.some(e => e[0] === 'lost'), '发出了 lost 事件');
  const revived = (() => { g.revive(); return g.state; })();
  ok(revived.over === false && revived.slots.length === SLOTS - 3, `复活后可继续（卡槽回到 ${revived.slots.length} 张）`);
}

console.log('\n[5] 四个道具');
{
  { // 消除
    const { g } = newGame(2);
    const before = liveOf(g).length;
    ok(g.useTool('clear') === true, '消除：调用成功');
    await settleAnim();
    ok(liveOf(g).length === before - 3, `消除：牌面 ${before} -> ${liveOf(g).length}`);
    ok(g.state.tools.clear === 0, '消除：道具次数扣减到 0');
    ok(g.useTool('clear') === false, '消除：次数为 0 时拒绝并请求补充');
  }
  { // 洗牌
    const { g } = newGame(2);
    const before = liveOf(g).map(t => t.type).join(',');
    ok(g.useTool('shuffle') === true, '洗牌：调用成功');
    const after = liveOf(g).map(t => t.type).join(',');
    ok(before.split(',').sort().join() === after.split(',').sort().join(), '洗牌：牌面各类数量不变（不破坏可解性）');
    ok(before !== after, '洗牌：牌面顺序确实变了');
  }
  { // 回退
    const { g } = newGame(2);
    const t = liveOf(g)[0];
    g.pick(t.id);
    ok(g.state.slots.length === 1, '回退：先放一张进卡槽');
    ok(g.useTool('undo') === true, '回退：调用成功');
    ok(g.state.slots.length === 0 && !t.inTray, '回退：牌回到牌面，卡槽清空');
  }
  { // 磁铁
    const { g } = newGame(2);
    const type = liveOf(g)[0].type;
    g.pick(liveOf(g).find(t => t.type === type).id);
    const before = liveOf(g).length;
    ok(g.useTool('magnet') === true, '磁铁：调用成功');
    await settleAnim();
    ok(g.state.slots.length === 0, '磁铁：卡槽被凑齐并清空');
    ok(liveOf(g).length === before - 2, `磁铁：从牌面吸走 2 张（${before} -> ${liveOf(g).length}）`);
  }
}

console.log('\n[6] 倒计时归零 -> lost');
{
  const { g, events } = newGame(2);
  g.state.remain = 2;
  ok(g.tick() === true, '倒计时：剩 1 秒仍在进行');
  ok(g.tick() === false, '倒计时：归零返回 false');
  ok(events.some(e => e[0] === 'lost' && e[1]?.title === '时间到'), '倒计时：发出「时间到」失败事件');
}

console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
