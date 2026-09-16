/**
 * 趣味麻将碰 - 后台管理与配置服务
 * 提供游戏全局配置API、统计API与Web管理后台界面
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
  reviveReward: { clearTray: 3, addSeconds: 120 }
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
      const config = readJson(CONFIG_FILE, DEFAULT_CONFIG);
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
          const current = readJson(CONFIG_FILE, DEFAULT_CONFIG);
          const merged = { ...current, ...updated };
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

  if (pathname === '/api/config/reset' && req.method === 'POST') {
    writeJson(CONFIG_FILE, DEFAULT_CONFIG);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: DEFAULT_CONFIG, msg: '已重置为默认配置' }));
    return;
  }

  if (pathname === '/api/stats') {
    if (req.method === 'GET') {
      const stats = readJson(STATS_FILE, {
        totalGames: 128,
        totalWins: 89,
        totalAds: 54,
        toolUsage: { clear: 42, shuffle: 28, undo: 35, magnet: 21 },
        lastUpdated: new Date().toISOString()
      });
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
          const stats = readJson(STATS_FILE, {
            totalGames: 0, totalWins: 0, totalAds: 0,
            toolUsage: { clear: 0, shuffle: 0, undo: 0, magnet: 0 },
            lastUpdated: new Date().toISOString()
          });
          if (delta.game) stats.totalGames = (stats.totalGames || 0) + 1;
          if (delta.win) stats.totalWins = (stats.totalWins || 0) + 1;
          if (delta.ad) stats.totalAds = (stats.totalAds || 0) + 1;
          if (delta.tool) {
            stats.toolUsage = stats.toolUsage || {};
            stats.toolUsage[delta.tool] = (stats.toolUsage[delta.tool] || 0) + 1;
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
  console.log('==================================================');
});
