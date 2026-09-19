/* 广告投放。真实激励视频（wx.createRewardedVideoAd）+ 后台下发的投放配置 + 数据上报。
 *
 * 为什么不把广告位 ID 写死在代码里：广告位换了、某个入口的广告出问题要临时关掉、
 * 过审期间要整体切回本地模拟——这些都不该重新发一次版。所以配置放在运营后台
 * （`server/` 的 `/api/ads`），客户端启动时拉一次，拉不到就用上次缓存、再不行用兜底默认值。
 * 后台那一页在 `server/public/index.html` 的「广告投放」卡片。
 *
 * ## 三条路径
 *
 *   provider = 'wechat'  真实激励视频。要求：基础库 2.0.4+、后台填了 adunit- 开头的广告位 ID、
 *                        小游戏已开通流量主。任何一条不满足都走下面的兜底。
 *   provider = 'mock'    本地模拟浮层（`modals.js` 画的那个 3 秒进度条）。开发预览、过审前用，
 *                        绝不会真的请求广告。
 *   投放位被关 / 总开关关  直接发奖，不弹任何东西——后台那两个下拉框的说明就是这么写的。
 *
 * ## 几个容易做错的地方
 *
 * - **同一个广告位只能有一个实例**。`wx.createRewardedVideoAd` 对同一 adUnitId 返回的是
 *   同一个对象，`onClose` 反复注册会累积回调，播一次触发 N 次发 N 份奖励。
 *   所以这里自己缓存实例，`onClose` / `onError` 只注册一次，转发给当次的 pending。
 * - **只有看完才发奖**。`onClose(res)` 的 `res.isEnded` 为 true 才算看完；基础库 2.1.0 以下
 *   `res` 是 undefined，那种老环境按看完处理（官方文档的兼容写法）。
 * - **show() 可能 reject**（广告没预加载好），要 `load()` 之后重试一次再放弃。
 * - **拉不到广告要不要照发奖**，是运营决策不是技术决策：后台 `fallbackToMock` 决定。
 *   开发期开着方便自测；正式运营应该关掉，否则拉不到广告也白送。
 *
 * ## 上线前必须做的两件事（代码里做不了）
 *
 * 1. 小游戏后台开通流量主、创建激励视频广告位，把 adunit- 开头的 ID 填进运营后台；
 * 2. 把 `API_BASE` 换成线上的 **https** 地址，并在小游戏后台「开发设置 - 服务器域名」
 *    里把它加进 request 合法域名。没配的话 `wx.request` 会直接失败，
 *    客户端会安静地退回缓存/默认配置（不会白屏，但后台就管不着它了）。
 *
 * 后台的地址解析、超时、缓存降级都在 `backend.js`（每日一关也用同一套）。
 *
 * ## 浏览器预览里为什么永远拉不到后台
 *
 * 预览垫片**有** `wx.request`（也有 `createRewardedVideoAd`），但它会把请求重写到
 * 预览服务自己的源上：实测 `http://localhost:3000/api/ads` 直接 curl 是 200，
 * 从游戏里发出去拿回来的却是预览服务的 **404**。所以预览里 provider 永远停在兜底的
 * `mock`，后台改了不会生效——这不是 bug，验广告配置要用
 * `mp-tools/ads-check.cjs`（Node 里直连后台）或真机。
 */
const PLACEMENTS = {
  luckyBag: '首页 · 幸运礼包解锁',
  piggy: '首页 · 存钱罐领取',
  stamina: '首页 · 看广告补满体力',
  shopCoins: '商城 · 免费领金币',
  shopTool: '商城 · 免费领道具',
  refill: '牌桌 · 道具补给免费拿',
  cardsChest: '集卡 · 视频宝箱',
  cardsDetail: '集卡 · 卡片详情补碎片',
};

const { storage, getJSON, post } = require('./backend.js');

const CACHE_KEY = 'majiang_ads_config_v1';

/* 兜底配置：后台连不上时用它。默认走本地模拟——宁可不投放，也不能在没配广告位的情况下
 * 让玩家点了没反应。 */
const FALLBACK = {
  enabled: true,
  provider: 'mock',
  rewardedVideoUnitId: '',
  bannerUnitId: '',
  fallbackToMock: true,
  minIntervalSeconds: 0,
  placements: Object.keys(PLACEMENTS).reduce((o, k) => { o[k] = true; return o; }, {}),
};

let config = FALLBACK;
let lastShownAt = 0;
/** adUnitId -> { ad, pending }，见文件头「同一个广告位只能有一个实例」。 */
const instances = new Map();

/** 拉后台配置。永远不 reject——广告配置拉不到只该降级，不该让启动流程挂掉。 */
function init() {
  const cached = storage(CACHE_KEY);
  if (cached && typeof cached === 'object') config = { ...FALLBACK, ...cached };

  return new Promise((resolve) => {
    getJSON('/api/ads', {
      tag: 'ads',
      onData: (data) => {
        config = { ...FALLBACK, ...data };
        storage(CACHE_KEY, config);
        console.log('[ads] 配置已更新', config.provider, config.enabled ? '开启' : '关闭');
      },
      done: () => resolve(config),
    });
  });
}

/** 上报一次广告事件。fire-and-forget，失败不重试也不提示——统计不该打扰玩家。 */
function report(placement, result) {
  post('/api/stats', { ad: true, placement, result });
}

function placementOn(placement) {
  const map = config.placements || {};
  return map[placement] !== false;
}

function getInstance(unitId) {
  if (instances.has(unitId)) return instances.get(unitId);
  const ad = wx.createRewardedVideoAd({ adUnitId: unitId });
  const state = { ad, pending: null };
  /* 只注册一次，转发给当次请求。重复注册会让一次播放触发多次发奖。 */
  ad.onClose((res) => {
    const p = state.pending;
    state.pending = null;
    if (p) p.onClose(res);
  });
  ad.onError((err) => {
    const p = state.pending;
    state.pending = null;
    if (p) p.onError(err);            // 没有 pending 时是预加载期的报错，忽略
    else console.warn('[ads] 预加载报错', (err && err.errMsg) || err);
  });
  instances.set(unitId, state);
  return state;
}

/**
 * 播一次激励视频。
 *
 * @param {string} placement  投放位 key，见 PLACEMENTS
 * @param {object} opts
 *   - mock(done)    播本地模拟浮层，播完调 done()。由调用方（modals.js）提供，
 *                   因为浮层是画在它那一层的。
 *   - onReward()    发奖。只有「看完」才会调到。
 *   - onFail(msg)   没看完/拉不到广告。msg 已经是给玩家看的话术，调用方通常直接 toast。
 */
function showRewarded(placement, { mock, onReward, onFail } = {}) {
  const fail = (msg) => { if (onFail) onFail(msg); };
  const reward = () => { report(placement, 'complete'); if (onReward) onReward(); };
  const playMock = () => {
    report(placement, 'impression');
    if (mock) mock(reward);
    else reward();
  };

  // 总开关或这个投放位被后台关掉：直接发奖，不弹任何东西
  if (!config.enabled || !placementOn(placement)) { if (onReward) onReward(); return; }

  if (config.provider !== 'wechat') { playMock(); return; }

  const unitId = config.rewardedVideoUnitId || '';
  const usable = typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function'
    && /^adunit-/.test(unitId);
  if (!usable) {
    /* 没配广告位、或基础库太老没有这个接口。这不是玩家的错，别让他卡在这儿。 */
    console.warn('[ads] 真实广告不可用（广告位=' + (unitId || '未配置') + '），走兜底');
    report(placement, 'error');
    if (config.fallbackToMock) playMock();
    else fail('广告暂时不可用，请稍后再试');
    return;
  }

  const gap = (config.minIntervalSeconds || 0) * 1000;
  if (gap > 0 && Date.now() - lastShownAt < gap) {
    const wait = Math.ceil((gap - (Date.now() - lastShownAt)) / 1000);
    fail('休息一下，' + wait + ' 秒后再看视频吧');
    return;
  }

  const state = getInstance(unitId);
  if (state.pending) { fail('广告正在播放中'); return; }

  state.pending = {
    onClose: (res) => {
      /* 基础库 2.1.0 以下 res 是 undefined，那种老环境按看完处理（官方兼容写法）。 */
      const ended = !res || res.isEnded;
      if (ended) reward();
      else { report(placement, 'impression'); fail('看完整段视频才能领取奖励哦'); }
    },
    onError: (err) => {
      console.warn('[ads] 播放失败', (err && err.errMsg) || err);
      report(placement, 'error');
      if (config.fallbackToMock) playMock();
      else fail('广告加载失败，请稍后再试');
    },
  };

  lastShownAt = Date.now();
  report(placement, 'impression');
  const onShowFailed = (e) => {
    const p = state.pending;
    state.pending = null;
    if (p) p.onError(e);
  };
  try {
    /* show() 可能因为没预加载好而 reject，load() 后重试一次再放弃。 */
    const p = state.ad.show();
    if (p && typeof p.catch === 'function') {
      p.catch(() => state.ad.load().then(() => state.ad.show()).catch(onShowFailed));
    }
  } catch (e) {
    onShowFailed(e);
  }
}

module.exports = {
  PLACEMENTS,
  init,
  showRewarded,
  report,
  /** 给调试/自测用：读当前生效的配置。 */
  current: () => config,
};
