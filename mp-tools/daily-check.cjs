#!/usr/bin/env node
/* 每日一关回归。
 *
 * 这一块最容易错的地方不是画面，是**跨天重置**：靠手点验不出来（要么等一天，要么改系统时间），
 * 而写错的后果是「玩家第二天点进去发现次数没回来」或者「同一天能无限刷」。
 * 所以 daily.js 把这段写成了不碰 wx / 不碰网络的纯函数，这里直接喂日期断言。
 *
 * 另外钉两条一致性：
 *   - 奖励数值（星星倍数 / 金币）必须和**烤在弹窗美术上**的「3倍 / x200」一致。
 *     后台能改数值，但美术改不了——数值和美术对不上，玩家看到的和拿到的就不是一回事。
 *   - 槽位坐标必须落在 [0,1] 内（它们是相对美术自身宽高的百分比）。
 *
 * 运行：node mp-tools/daily-check.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DAILY_JS = path.join(ROOT, 'majiang-game', 'src', 'daily.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

/* daily.js 顶部 require 了 backend.js 和 store.js，而它们要 wx。
 * 这里只测纯逻辑，给一个最小 wx 桩就够了。 */
global.wx = {
  getStorageSync: () => '',
  setStorageSync: () => {},
  request: undefined,
};
const daily = require(DAILY_JS);

console.log('[1] 本地日期 key');
{
  const d = new Date(2026, 8, 19, 23, 59, 59);      // 2026-09-19 本地时间
  ok(daily.todayKey(d) === '2026-09-19', 'Date 入参：' + daily.todayKey(d));
  ok(daily.todayKey(d.getTime()) === '2026-09-19', '时间戳入参同结果');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(daily.todayKey()), '不传参数取当前时间：' + daily.todayKey());
  /* 用本地时区而不是 UTC：玩家眼里的「今天」是本地的。 */
  const localMidnight = new Date(2026, 0, 1, 0, 0, 1);
  ok(daily.todayKey(localMidnight) === '2026-01-01', '本地零点刚过算新的一天');
}

console.log('\n[2] 跨天补次数 / 同一天不补');
{
  const st = { date: '2026-09-18', left: 0 };
  ok(daily.ensureAttempts(st, '2026-09-19', 1) === true, '跨天：发生重置');
  ok(st.left === 1 && st.date === '2026-09-19', `次数回到 1，日期更新为 ${st.date}`);

  st.left = 0;
  ok(daily.ensureAttempts(st, '2026-09-19', 1) === false, '同一天再调：不重置');
  ok(st.left === 0, '用完就是用完，同一天不会自己回来');
}

console.log('\n[3] 存档字段缺失 / 写坏了要自愈');
{
  const a = { date: '2026-09-19' };                  // 老存档没有 left
  daily.ensureAttempts(a, '2026-09-19', 2);
  ok(a.left === 2, 'left 缺失：补成每日上限 ' + a.left);

  const b = { date: '2026-09-19', left: -5 };
  daily.ensureAttempts(b, '2026-09-19', 2);
  ok(b.left === 2, 'left 是负数：修回上限');

  const c = { date: '2026-09-19', left: 99 };
  daily.ensureAttempts(c, '2026-09-19', 2);
  ok(c.left === 2, '后台把每日次数调小，当天就封顶（99 → ' + c.left + '）');

  ok(daily.ensureAttempts(null, '2026-09-19', 1) === false, '传 null 不抛错');
}

console.log('\n[4] 扣次数');
{
  const st = { date: '2026-09-19', left: 2 };
  ok(daily.consumeAttempt(st) === true && st.left === 1, '扣一次：2 → ' + st.left);
  ok(daily.consumeAttempt(st) === true && st.left === 0, '再扣一次：1 → ' + st.left);
  ok(daily.consumeAttempt(st) === false && st.left === 0, '扣不动了：返回 false 且不会扣成负数');
}

console.log('\n[5] 奖励数值要和弹窗美术上印的一致');
{
  const art = { starMultiplier: 3, coinReward: 200 };   // daily_level.webp 上烤着「3倍」「x200」
  ok(daily.FALLBACK.starMultiplier === art.starMultiplier,
    `客户端兜底星星倍数 = ${daily.FALLBACK.starMultiplier}（美术上是 ${art.starMultiplier} 倍）`);
  ok(daily.FALLBACK.coinReward === art.coinReward,
    `客户端兜底金币 = ${daily.FALLBACK.coinReward}（美术上是 x${art.coinReward}）`);

  const server = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
  const block = (server.match(/dailyLevel:\s*\{[\s\S]*?\}/) || [''])[0];
  const num = (k) => Number((block.match(new RegExp(k + ':\\s*(\\d+)')) || [])[1]);
  ok(num('starMultiplier') === art.starMultiplier, `后台默认星星倍数 = ${num('starMultiplier')}`);
  ok(num('coinReward') === art.coinReward, `后台默认金币 = ${num('coinReward')}`);
  ok(num('attemptsPerDay') === daily.FALLBACK.attemptsPerDay,
    `每日次数两边一致 = ${num('attemptsPerDay')}`);
}

console.log('\n[6] 弹窗槽位坐标必须落在美术范围内');
{
  const modals = fs.readFileSync(path.join(ROOT, 'majiang-game', 'src', 'modals.js'), 'utf8');
  const block = (modals.match(/const DAILY_SLOTS = \{[\s\S]*?\n\};/) || [''])[0];
  ok(block.length > 0, '找得到 DAILY_SLOTS');
  const slots = [...block.matchAll(/(\w+):\s*\{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}/g)];
  ok(slots.length === 5, `5 个槽位（实际 ${slots.length}）：` + slots.map((m) => m[1]).join(','));
  for (const [, name, x, y, w, h] of slots) {
    const [X, Y, W, H] = [x, y, w, h].map(Number);
    ok(X >= 0 && Y >= 0 && X + W <= 1.001 && Y + H <= 1.001,
      `${name} 在画面内：x${X}+w${W}, y${Y}+h${H}`);
  }
}

console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
