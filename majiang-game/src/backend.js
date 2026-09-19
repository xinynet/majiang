/* 运营后台的客户端（`server/` 那一坨）。
 *
 * 抽出来的原因：广告投放（ads.js）和每日一关（daily.js）都要从同一个后台拉配置、
 * 往同一个统计接口上报，地址解析、超时兜底、缓存、失败降级这几件事一模一样，
 * 没必要各写一遍——写两遍的下场通常是其中一份忘了加超时。
 *
 * 三条硬规矩：
 *
 * 1. **永远不 reject。** 拉不到配置只该降级到缓存/默认值，不该让启动流程挂掉。
 * 2. **永远不打扰玩家。** 上报失败就算了，不重试也不弹提示。
 * 3. **每个响应都要判 code。** 浏览器预览的 wx 垫片会把请求重写到预览服务自己的源，
 *    于是稳定返回 404——这种「连上了但不是我们的后台」必须和「后台没开」区分开，
 *    所以非预期响应会把状态码打进日志。
 *
 * 地址：开发期指向本机起的 server/；上线换成 https 域名并在小游戏后台配 request 合法域名。
 * 调试时可以 `wx.setStorageSync('majiang_api_base', 'http://192.168.1.5:3000')` 临时改指向，
 * 省得改代码重编。
 */
const API_BASE = 'http://localhost:3000';
const API_BASE_KEY = 'majiang_api_base';
const REQUEST_TIMEOUT = 4000;

/** 读写本地存储。存储满了或被禁用都不该影响业务，所以吞掉异常。 */
function storage(key, value) {
  try {
    if (value === undefined) return wx.getStorageSync(key);
    wx.setStorageSync(key, value);
  } catch (e) { /* 忽略 */ }
  return undefined;
}

function apiBase() {
  return storage(API_BASE_KEY) || API_BASE;
}

function canRequest() {
  return typeof wx !== 'undefined' && typeof wx.request === 'function';
}

/**
 * GET 一个 `{ code: 0, data: ... }` 形状的接口。
 * 拿到合法响应就把 data 交给 onData；其余情况（没网、超时、非预期响应）都只打日志。
 * 无论哪条路径，done() 都保证被调用且只调用一次。
 */
function getJSON(path, { onData, done = () => {}, tag = 'backend' } = {}) {
  if (!canRequest()) {
    console.log('[' + tag + '] 运行环境没有 wx.request，使用本地配置');
    done();
    return;
  }
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  try {
    wx.request({
      url: apiBase() + path,
      method: 'GET',
      timeout: REQUEST_TIMEOUT,
      success: (res) => {
        const body = res && res.data;
        if (body && body.code === 0 && body.data && typeof body.data === 'object') {
          try { onData(body.data); } catch (e) { console.error('[' + tag + '] 处理响应出错', e); }
        } else {
          console.warn('[' + tag + '] ' + path + ' 返回了非预期内容，继续用缓存/默认值。HTTP '
            + ((res && res.statusCode) || '?') + ' from ' + apiBase());
        }
        finish();
      },
      fail: (e) => {
        console.warn('[' + tag + '] ' + path + ' 拉取失败，用缓存/默认值：', (e && e.errMsg) || e);
        finish();
      },
    });
  } catch (e) {
    finish();
  }
  // 有些实现 fail 不回调，兜一层，免得调用方的 Promise 永远挂着
  setTimeout(finish, REQUEST_TIMEOUT + 500);
}

/** POST 一条统计。fire-and-forget。 */
function post(path, data) {
  if (!canRequest()) return;
  try {
    wx.request({
      url: apiBase() + path,
      method: 'POST',
      timeout: REQUEST_TIMEOUT,
      header: { 'Content-Type': 'application/json' },
      data,
      fail: () => {},
    });
  } catch (e) { /* 同上 */ }
}

module.exports = { apiBase, storage, getJSON, post, API_BASE_KEY, REQUEST_TIMEOUT };
