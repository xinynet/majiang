#!/usr/bin/env node
/* 广告投放链路回归：把 majiang-game/src/ads.js 放进一个 wx 桩里跑一遍。
 *
 * 为什么不在预览里点：浏览器预览的 wx 垫片既没有 wx.request 也没有
 * createRewardedVideoAd，真实链路在那儿根本走不到；而真机又没法跑自动断言。
 * 这里用桩把「微信会怎么回调」演一遍，能覆盖的分支比手点多得多：
 *
 *   - 后台配置拉取（真的去 GET /api/ads，server 没起就跳过这一节）
 *   - 总开关关 / 单个投放位关 → 直接发奖，不弹广告
 *   - provider=mock → 播模拟浮层再发奖
 *   - provider=wechat 看完 → 发奖且上报 complete
 *   - provider=wechat 中途退出（isEnded=false）→ 不发奖，提示看完才有
 *   - 广告位没配 / 接口不存在 → 按 fallbackToMock 决定「照发」还是「提示稍后再试」
 *   - show() reject → load() 后重试；重试再失败才算失败
 *   - 最小间隔内连点第二次 → 拦住
 *   - onClose 只发一份奖（同一个广告位实例重复注册回调是最容易踩的坑）
 *
 * 运行：node mp-tools/ads-check.cjs
 */
const path = require('path');
const http = require('http');

const ADS = path.join(__dirname, '..', 'majiang-game', 'src', 'ads.js');
const API_BASE = process.env.MAJIANG_API_BASE || 'http://localhost:3000';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

/* ---------------------------------------------------------------- wx 桩 */

const store = new Map();
/** 当前这一轮要模拟的广告行为，由每个用例改写。 */
let adBehavior = { mode: 'complete' };
const reports = [];

function makeWx({ withRequest = true, withAd = true } = {}) {
  const wx = {
    getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
    setStorageSync: (k, v) => store.set(k, v),
  };

  if (withRequest) {
    wx.request = ({ url, method = 'GET', data, success, fail }) => {
      if (/\/api\/stats$/.test(url)) reports.push(data);
      const u = new URL(url);
      const body = data ? JSON.stringify(data) : null;
      const req = http.request({
        hostname: u.hostname, port: u.port, path: u.pathname, method,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
        timeout: 2000,
      }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          let parsed = buf;
          try { parsed = JSON.parse(buf); } catch (e) { /* 原样给回去 */ }
          if (success) success({ statusCode: res.statusCode, data: parsed });
        });
      });
      req.on('error', (e) => { if (fail) fail({ errMsg: 'request:fail ' + e.message }); });
      req.on('timeout', () => { req.destroy(); if (fail) fail({ errMsg: 'request:fail timeout' }); });
      if (body) req.write(body);
      req.end();
    };
  }

  if (withAd) {
    /* 微信的真实行为：同一个 adUnitId 反复 create 拿到的是同一个实例。
     * 桩也这么做，才测得出「回调被重复注册」这个坑。 */
    const pool = new Map();
    wx.createRewardedVideoAd = ({ adUnitId }) => {
      if (pool.has(adUnitId)) return pool.get(adUnitId);
      const closeCbs = [];
      const errCbs = [];
      const inst = {
        adUnitId,
        closeCbs, errCbs,
        onClose: (fn) => closeCbs.push(fn),
        onError: (fn) => errCbs.push(fn),
        load: () => Promise.resolve(),
        show() {
          const b = adBehavior;
          if (b.mode === 'showReject') {
            b.mode = b.then || 'complete';       // 重试时按 then 指定的行为
            return Promise.reject(new Error('ad not ready'));
          }
          if (b.mode === 'error') {
            setTimeout(() => errCbs.forEach((f) => f({ errCode: 1004, errMsg: 'no ad' })), 0);
            return Promise.resolve();
          }
          const res = b.mode === 'skip' ? { isEnded: false }
            : b.mode === 'legacy' ? undefined : { isEnded: true };
          setTimeout(() => closeCbs.forEach((f) => f(res)), 0);
          return Promise.resolve();
        },
      };
      pool.set(adUnitId, inst);
      return inst;
    };
  }
  return wx;
}

/** 每个用例重新 require 一次，拿到干净的模块状态（config / 实例缓存）。 */
function freshAds(cfg, wxOpts) {
  delete require.cache[require.resolve(ADS)];
  global.wx = makeWx(wxOpts);
  const ads = require(ADS);
  if (cfg) Object.assign(ads.current(), cfg);   // 直接改生效中的配置，跳过网络
  return ads;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 跑一次 showRewarded，把结果收集成一个好断言的对象。 */
function run(ads, placement, { autoMock = true } = {}) {
  const out = { rewarded: 0, failed: 0, msg: null, mockPlayed: 0 };
  ads.showRewarded(placement, {
    mock: (done) => { out.mockPlayed++; if (autoMock) done(); },
    onReward: () => { out.rewarded++; },
    onFail: (m) => { out.failed++; out.msg = m; },
  });
  return out;
}

(async () => {
  console.log('[1] 后台配置拉取');
  {
    global.wx = makeWx();
    delete require.cache[require.resolve(ADS)];
    const ads = require(ADS);
    global.wx.setStorageSync('majiang_api_base', API_BASE);
    let reachable = true;
    await ads.init().catch(() => { reachable = false; });
    const cfg = ads.current();
    if (cfg.rewardedVideoUnitId === undefined) reachable = false;
    ok(!!cfg && typeof cfg === 'object', 'init() 永远 resolve，拿到一份配置');
    ok(typeof cfg.placements === 'object' && Object.keys(cfg.placements).length >= 8,
      `投放位开关齐全（${Object.keys(cfg.placements || {}).length} 个）`);
    console.log('        当前 provider=' + cfg.provider + '，来源：' + (reachable ? 'server 或缓存' : '兜底默认值'));
  }

  console.log('\n[2] 总开关 / 投放位开关关掉 → 直接发奖，不弹广告');
  {
    const ads = freshAds({ enabled: false, provider: 'wechat', rewardedVideoUnitId: 'adunit-000000000000' });
    const r = run(ads, 'luckyBag');
    ok(r.rewarded === 1 && r.mockPlayed === 0 && r.failed === 0, '总开关关：直接发奖');

    const ads2 = freshAds({ enabled: true, provider: 'mock', placements: { piggy: false } });
    const r2 = run(ads2, 'piggy');
    ok(r2.rewarded === 1 && r2.mockPlayed === 0, '单个投放位关：直接发奖');
    const r3 = run(ads2, 'luckyBag');
    ok(r3.mockPlayed === 1 && r3.rewarded === 1, '同一份配置里没关的投放位照常播');
  }

  console.log('\n[3] provider=mock → 播模拟浮层，播完才发奖');
  {
    const ads = freshAds({ enabled: true, provider: 'mock' });
    const out = { rewarded: 0, done: null };
    ads.showRewarded('shopCoins', {
      mock: (done) => { out.done = done; },       // 故意不立刻播完
      onReward: () => { out.rewarded++; },
    });
    ok(out.done !== null && out.rewarded === 0, '浮层开始播，此时还没发奖');
    out.done();
    ok(out.rewarded === 1, '浮层播完才发奖');
  }

  console.log('\n[4] provider=wechat：看完 / 中途退出 / 老基础库');
  {
    const cfg = { enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: false };

    adBehavior = { mode: 'complete' };
    const a = freshAds({ ...cfg });
    const r1 = run(a, 'refill');
    await wait(10);
    ok(r1.rewarded === 1 && r1.failed === 0, 'isEnded=true：发奖');

    adBehavior = { mode: 'skip' };
    const b = freshAds({ ...cfg });
    const r2 = run(b, 'refill');
    await wait(10);
    ok(r2.rewarded === 0 && r2.failed === 1, '中途退出：不发奖');
    ok(/看完/.test(r2.msg || ''), '提示语说清楚为什么没奖：' + r2.msg);

    adBehavior = { mode: 'legacy' };
    const c = freshAds({ ...cfg });
    const r3 = run(c, 'refill');
    await wait(10);
    ok(r3.rewarded === 1, '老基础库 res=undefined：按看完处理（官方兼容写法）');
  }

  console.log('\n[5] 拉不到广告：fallbackToMock 决定照发还是拦住');
  {
    adBehavior = { mode: 'error' };
    const on = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: true });
    const r1 = run(on, 'cardsChest');
    await wait(10);
    ok(r1.mockPlayed === 1 && r1.rewarded === 1, 'fallbackToMock=true：退回模拟并发奖');

    adBehavior = { mode: 'error' };
    const off = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: false });
    const r2 = run(off, 'cardsChest');
    await wait(10);
    ok(r2.rewarded === 0 && r2.failed === 1, 'fallbackToMock=false：不发奖');
    ok(/稍后再试/.test(r2.msg || ''), '提示语：' + r2.msg);

    /* 广告位没填 = 同一类兜底，但发生在调用微信接口之前 */
    const noUnit = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: '', fallbackToMock: false });
    const r3 = run(noUnit, 'cardsChest');
    ok(r3.rewarded === 0 && r3.failed === 1, '广告位没配：不发奖（后台保存时也会拦一道）');

    /* 基础库老到没有这个接口 */
    const noApi = freshAds(
      { enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: true },
      { withAd: false });
    const r4 = run(noApi, 'cardsChest');
    ok(r4.mockPlayed === 1 && r4.rewarded === 1, '环境没有 createRewardedVideoAd：退回模拟');
  }

  console.log('\n[6] show() reject → load() 后重试一次');
  {
    adBehavior = { mode: 'showReject', then: 'complete' };
    const ads = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: false });
    const r = run(ads, 'shopTool');
    await wait(30);
    ok(r.rewarded === 1 && r.failed === 0, '第一次 show 失败，load 后重试成功仍然发奖');

    adBehavior = { mode: 'showReject', then: 'error' };
    const ads2 = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: false });
    const r2 = run(ads2, 'shopTool');
    await wait(30);
    ok(r2.rewarded === 0 && r2.failed === 1, '重试还是失败才算失败');
  }

  console.log('\n[7] 同一个广告位反复播：一次只发一份奖');
  {
    adBehavior = { mode: 'complete' };
    const ads = freshAds({ enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456', fallbackToMock: false });
    const r1 = run(ads, 'luckyBag');
    await wait(10);
    const r2 = run(ads, 'piggy');
    await wait(10);
    ok(r1.rewarded === 1 && r2.rewarded === 1, '连播两次，各发一份');
    const inst = global.wx.createRewardedVideoAd({ adUnitId: 'adunit-abcdef123456' });
    ok(inst.closeCbs.length === 1 && inst.errCbs.length === 1,
      `onClose/onError 只注册了一次（实际 ${inst.closeCbs.length}/${inst.errCbs.length}）——重复注册会一次播放发 N 份奖`);
  }

  console.log('\n[8] 最小间隔：间隔内连点第二次要拦住');
  {
    adBehavior = { mode: 'complete' };
    const ads = freshAds({
      enabled: true, provider: 'wechat', rewardedVideoUnitId: 'adunit-abcdef123456',
      fallbackToMock: false, minIntervalSeconds: 60,
    });
    const r1 = run(ads, 'luckyBag');
    await wait(10);
    const r2 = run(ads, 'luckyBag');
    ok(r1.rewarded === 1, '第一次正常播');
    ok(r2.rewarded === 0 && r2.failed === 1 && /秒后/.test(r2.msg || ''), '第二次被拦：' + r2.msg);
  }

  console.log('\n[9] 数据上报：每次播放都带投放位');
  {
    ok(reports.length > 0, `共上报 ${reports.length} 条`);
    const bad = reports.filter((r) => !r.placement || !r.result);
    ok(bad.length === 0, '每条都带 placement 与 result');
    const kinds = [...new Set(reports.map((r) => r.result))].sort().join(',');
    ok(/complete/.test(kinds) && /impression/.test(kinds) && /error/.test(kinds),
      '三种事件都上报过：' + kinds);
  }

  console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
