/**
 * 趣味麻将碰 - 后台管理与配置服务
 * 提供游戏全局配置API、统计API与Web管理后台界面
 *
 * 广告投放也归这里管（见 DEFAULT_CONFIG.ads）：广告位 ID、总开关、每个投放位的
 * 单独开关、防刷间隔，都是后台改完客户端下次启动就生效，不用重新发版。
 * 客户端拉的是 /api/ads 而不是 /api/config——那个精简接口只给它要的字段，
 * 关卡表、道具赠送这些跟广告无关的东西不必下发。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'game-config.json');
const STATS_FILE = path.join(DATA_DIR, 'game-stats.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 默认配置
const DEFAULT_CONFIG = {
  gameTitle: '趣味麻将碰',
  announcement: '凑齐三张相同麻将即可消除！合理使用下方4大道具助力通关！',
  roundSeconds: 600,
  adRewardCount: 1,
  initialTools: {
    clear: 1,
    shuffle: 1,
    undo: 1,
    magnet: 1
  },
  levels: [
    { level: 1, tiles: 30, types: 8, time: 600, desc: '新手初试' },
    { level: 2, tiles: 105, types: 22, time: 600, desc: '渐入佳境' },
    { level: 3, tiles: 120, types: 26, time: 600, desc: '层峦叠嶂' },
    { level: 4, tiles: 135, types: 30, time: 600, desc: '牌海遨游' },
    { level: 5, tiles: 150, types: 34, time: 600, desc: '大师对决' }
  ],
  gmMode: false,
  allowRevive: true,
  reviveReward: { clearTray: 3, addSeconds: 120 },
  /* 每日一关。弹窗上那几个数字全从这里下发：
   *   - challengers / clearers 是给玩家看的「多少人挑战、多少人通关」，运营自己定；
   *   - attemptsPerDay 是每天几次机会，客户端按本地日期 00:00 重置；
   *   - starMultiplier / coinReward 必须和弹窗美术上印的「3倍 / x200」一致，
   *     改了数值记得连美术一起换，否则玩家看到的和拿到的对不上。 */
  dailyLevel: {
    theme: '发财啦',
    challengers: 94540,
    clearers: 428,
    attemptsPerDay: 1,
    starMultiplier: 3,
    coinReward: 200
  },

  /* 广告投放。provider 决定客户端走哪条路：
   *   wechat —— 真实激励视频（wx.createRewardedVideoAd），需要先填广告位 ID；
   *   mock   —— 本地模拟浮层，开发预览和过审前用，绝不会真的请求广告。
   * fallbackToMock 只在 wechat 拉不到广告时兜底：开发期开着方便自测，
   * 正式上线应关掉——否则拉不到广告也照发奖励，等于白送。 */
  ads: {
    enabled: true,
    provider: 'mock',
    rewardedVideoUnitId: '',
    bannerUnitId: '',
    fallbackToMock: true,
    minIntervalSeconds: 0,
    /* 每个投放位可以单独关掉，出问题时不用整个停掉广告。key 与客户端 ads.js 里的一致。 */
    placements: {
      luckyBag: true,
      piggy: true,
      stamina: true,
      shopCoins: true,
      shopTool: true,
      refill: true,
      cardsChest: true,
      cardsDetail: true
    }
  }
};

const DEFAULT_STATS = {
  totalGames: 0,
  totalWins: 0,
  totalAds: 0,
  toolUsage: { clear: 0, shuffle: 0, undo: 0, magnet: 0 },
  /* 广告效果按投放位分开记：哪个位置拉不到广告、哪个位置用户爱看完，
   * 只有分开记才看得出来。 */
  ads: { impressions: 0, completions: 0, errors: 0, byPlacement: {} },
  lastUpdated: new Date().toISOString()
};

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading ' + file + ':', e.message);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing ' + file + ':', e.message);
    return false;
  }
}

/** 深合并默认值。老的配置文件里没有 ads 这一节，读出来得先补齐，
 *  否则后台打开是空的、客户端拉到的也是 undefined。数组整体覆盖（关卡表就该整张换）。 */
function withDefaults(stored, defaults) {
  const out = Array.isArray(defaults) ? defaults.slice() : { ...defaults };
  if (!stored || typeof stored !== 'object') return out;
  for (const [k, v] of Object.entries(stored)) {
    const d = defaults ? defaults[k] : undefined;
    if (v && typeof v === 'object' && !Array.isArray(v) && d && typeof d === 'object' && !Array.isArray(d)) {
      out[k] = withDefaults(v, d);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

const loadConfig = () => withDefaults(readJson(CONFIG_FILE, DEFAULT_CONFIG), DEFAULT_CONFIG);
const loadStats = () => withDefaults(readJson(STATS_FILE, DEFAULT_STATS), DEFAULT_STATS);

// 确保配置文件存在
if (!fs.existsSync(CONFIG_FILE)) {
  writeJson(CONFIG_FILE, DEFAULT_CONFIG);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const H5_DIR = path.join(__dirname, '../majiang-mp/dist/build/h5');

const server = http.createServer((req, res) => {
  // CORS 响应头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // JSON API 路由
  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      const config = loadConfig();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: config, msg: 'success' }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updated = JSON.parse(body);
          const current = loadConfig();
          /* 深合并：后台可能只提交 ads 里的一两项，浅合并会把同级其它字段抹掉。 */
          const merged = withDefaults(updated, current);
          writeJson(CONFIG_FILE, merged);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 0, data: merged, msg: '配置保存成功' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, msg: 'JSON解析错误: ' + err.message }));
        }
      });
      return;
    }
  }

  /* 客户端（小游戏 / 小程序）启动时拉这个，而不是整份 /api/config：
   * 只给广告要用的字段，省流量，也避免把关卡表、GM 开关这类后台参数下发到端上。 */
  if (pathname === '/api/ads' && req.method === 'GET') {
    const ads = loadConfig().ads || DEFAULT_CONFIG.ads;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: ads, msg: 'success' }));
    return;
  }

  /* 每日一关的展示数值。和 /api/ads 一样是给客户端的精简接口。 */
  if (pathname === '/api/daily' && req.method === 'GET') {
    const daily = loadConfig().dailyLevel || DEFAULT_CONFIG.dailyLevel;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: daily, msg: 'success' }));
    return;
  }

  if (pathname === '/api/config/reset' && req.method === 'POST') {
    writeJson(CONFIG_FILE, DEFAULT_CONFIG);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: DEFAULT_CONFIG, msg: '已重置为默认配置' }));
    return;
  }

  if (pathname === '/api/stats') {
    if (req.method === 'GET') {
      const stats = loadStats();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: stats, msg: 'success' }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const delta = JSON.parse(body);
          const stats = loadStats();
          if (delta.game) stats.totalGames = (stats.totalGames || 0) + 1;
          if (delta.win) stats.totalWins = (stats.totalWins || 0) + 1;
          if (delta.tool) {
            stats.toolUsage = stats.toolUsage || {};
            stats.toolUsage[delta.tool] = (stats.toolUsage[delta.tool] || 0) + 1;
          }

          /* 广告上报。老客户端只发 { ad: true }，新客户端发
           * { ad: true, placement: 'luckyBag', result: 'impression' | 'complete' | 'error' }。
           * totalAds 继续按「播放量」记（impression），后台那四张卡不用改口径。 */
          if (delta.ad) {
            const result = delta.result || 'impression';
            const key = String(delta.placement || 'unknown').slice(0, 32);
            const slot = stats.ads.byPlacement[key]
              || (stats.ads.byPlacement[key] = { impressions: 0, completions: 0, errors: 0 });
            if (result === 'complete') { stats.ads.completions++; slot.completions++; }
            else if (result === 'error') { stats.ads.errors++; slot.errors++; }
            else { stats.ads.impressions++; slot.impressions++; stats.totalAds = (stats.totalAds || 0) + 1; }
          }
          stats.lastUpdated = new Date().toISOString();
          writeJson(STATS_FILE, stats);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 0, data: stats }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, msg: e.message }));
        }
      });
      return;
    }
  }

  // 静态文件服务（管理后台与游戏H5预览）
  let baseDir = PUBLIC_DIR;
  let subPath = pathname;

  if (pathname === '/game' || pathname.startsWith('/game/')) {
    baseDir = H5_DIR;
    subPath = pathname.replace(/^\/game\/?/, '') || 'index.html';
  } else if (pathname === '/' || pathname === '/admin' || pathname.startsWith('/admin')) {
    baseDir = PUBLIC_DIR;
    subPath = 'index.html';
  }

  let filePath = path.join(baseDir, subPath);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(baseDir, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('趣味麻将碰 后台配置服务 已启动:');
  console.log('管理后台界面: http://localhost:' + PORT + '/admin');
  console.log('游戏H5界面:   http://localhost:' + PORT + '/game');
  console.log('配置接口:     http://localhost:' + PORT + '/api/config');
  console.log('广告配置接口: http://localhost:' + PORT + '/api/ads   （客户端拉这个）');
  console.log('每日一关接口: http://localhost:' + PORT + '/api/daily');
  console.log('==================================================');
});
