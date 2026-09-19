#!/usr/bin/env node
/* 小游戏 MCP 命令行驱动（守护进程版）。
 *
 * 为什么需要它：`@weadmin/weixin-minigame-helper-mcp` 是个 stdio MCP server，
 * 正常用法是 AI host 启动时读 mcp.json 把它拉起来，工具直接出现在工具表里。
 * 但 host 的工具表是会话启动时定的，配置刚写进去的那个会话接不上，
 * 而这条预览回路是小游戏侧唯一可用的验收手段（见 HANDOFF_FIX_RECORD.md R4 四：
 * miniprogram-automator 是按页面/组件树建模的，驱动不了小游戏）。
 *
 * 为什么必须常驻：run_game / get_logs / capture_screenshot 的状态全在 server 进程内存里
 *  —— 预览 HTTP 服务、浏览器页面的 websocket、日志缓冲区都挂在它身上。
 * 「起进程 → 调一次 → 杀进程」的做法第二条命令就会拿到 "Game is not running"。
 * 所以这里把 server 放进一个后台守护进程，再用一个本地 HTTP 控制口转发命令。
 *
 * 用法：
 *   node mp-tools/minigame-mcp.cjs run     [--dir <游戏目录>]   启动/热重载预览（幂等）
 *   node mp-tools/minigame-mcp.cjs cycle   [--dir <游戏目录>]   run + 只看 error/warn 日志
 *   node mp-tools/minigame-mcp.cjs logs    [--filter <正则>] [--lines <n>]
 *   node mp-tools/minigame-mcp.cjs shot    [--out <png路径>]
 *   node mp-tools/minigame-mcp.cjs tools | status | stop
 *
 * 首次 run 之后要在浏览器里打开它返回的 URL，游戏才真正开始跑；
 * 没有打开过页面时 shot / logs 会报 "Game is not running"。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const SERVER = process.env.MINIGAME_MCP_SERVER
  || 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@weadmin/weixin-minigame-helper-mcp/mcp/index.js';
const GAME_DIR = path.resolve(__dirname, '..', 'majiang-game');
const CTRL_PORT = Number(process.env.MINIGAME_CTRL_PORT || 4123);
const LOG_FILE = path.join(__dirname, 'work', 'minigame-mcp-daemon.log');

function argOf(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/* ------------------------------------------------------------------ 守护进程侧 */

/** 包住一个常驻的 stdio MCP server，暴露 call(name, args)。 */
function createMcpClient() {
  const child = spawn(process.execPath, [SERVER, '--platform', 'skill'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let buf = '';
  let nextId = 100;
  let ready = null;

  const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');

  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('{')) continue;   // server 偶尔往 stdout 混打日志行
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
    }
  });
  child.stderr.on('data', (d) => fs.appendFileSync(LOG_FILE, d.toString()));
  child.on('exit', (code) => {
    fs.appendFileSync(LOG_FILE, `\n[daemon] MCP server 退出，code=${code}\n`);
    process.exit(1);
  });

  const request = (method, params) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    send({ jsonrpc: '2.0', id, method, params });
  });

  ready = request('initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'majiang-cli', version: '1.0.0' }
  }).then(() => { send({ jsonrpc: '2.0', method: 'notifications/initialized' }); });

  return {
    list: async () => { await ready; return request('tools/list', {}); },
    call: async (name, args) => { await ready; return request('tools/call', { name, arguments: args || {} }); }
  };
}

function runDaemon() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, `[daemon] 启动于 ${new Date().toISOString()}\n`);
  const mcp = createMcpClient();

  http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const reply = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (req.url === '/ping') return reply(200, { ok: true, pid: process.pid });
      if (req.url === '/stop') { reply(200, { ok: true }); setTimeout(() => process.exit(0), 50); return; }
      try {
        const { name, args } = JSON.parse(body || '{}');
        const result = name === 'tools/list' ? await mcp.list() : await mcp.call(name, args);
        reply(200, { ok: true, result });
      } catch (e) {
        reply(200, { ok: false, error: String(e.message || e) });
      }
    });
  }).listen(CTRL_PORT, '127.0.0.1', () => {
    fs.appendFileSync(LOG_FILE, `[daemon] 控制口 http://127.0.0.1:${CTRL_PORT}\n`);
  });
}

/* ------------------------------------------------------------------ 客户端侧 */

function post(urlPath, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload || {});
    const req = http.request({
      host: '127.0.0.1', port: CTRL_PORT, path: urlPath, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.setTimeout(timeoutMs || 240000, () => { req.destroy(new Error('控制口请求超时')); });
    req.on('error', reject);
    req.end(data);
  });
}

async function ensureDaemon() {
  try { await post('/ping', {}, 2000); return false; } catch { /* 没起来，下面拉一个 */ }
  const out = fs.openSync(LOG_FILE.replace('.log', '-stdout.log'), 'a');
  const child = spawn(process.execPath, [__filename, '__daemon__'], {
    detached: true, stdio: ['ignore', out, out]
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { await post('/ping', {}, 2000); return true; } catch { /* 继续等 */ }
  }
  throw new Error(`守护进程起不来，看 ${LOG_FILE}`);
}

async function callTool(name, args) {
  const r = await post('/call', { name, args });
  if (!r.ok) throw new Error(r.error);
  return r.result;
}

/** MCP 的 content 数组里文本和图片混在一起，分开拿。 */
const textOf = (r) => (r?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
const imageOf = (r) => (r?.content || []).find((c) => c.type === 'image');

async function main() {
  if (process.argv[2] === '__daemon__') return runDaemon();

  const cmd = process.argv[2] || 'run';
  const dir = path.resolve(argOf('dir', GAME_DIR));

  if (cmd === 'stop') {
    try { await post('/stop', {}, 3000); console.log('守护进程已停'); } catch { console.log('守护进程本来就没在跑'); }
    return;
  }

  const started = await ensureDaemon();
  if (started) console.log(`[daemon] 已拉起 (控制口 ${CTRL_PORT})`);

  if (cmd === 'status') { console.log(JSON.stringify(await post('/ping', {}, 3000))); return; }

  if (cmd === 'tools') {
    const r = await callTool('tools/list');
    console.log(r.tools.map((t) => `${t.name}  —  ${t.description.split('\n')[0]}`).join('\n'));
    return;
  }

  if (cmd === 'run' || cmd === 'cycle') {
    console.log('--- run_game ---\n' + textOf(await callTool('run_game', { workspacePath: dir })));
    if (cmd === 'run') return;
    await new Promise((r) => setTimeout(r, 2500));
    const logs = await callTool('get_logs', {
      filter: 'error|warn|Error|Warning|Uncaught|TypeError|ReferenceError', lines: 60
    });
    console.log('--- logs(error|warn) ---\n' + (textOf(logs) || '(干净)'));
    return;
  }

  if (cmd === 'logs') {
    const args = {};
    const f = argOf('filter', null); if (f) args.filter = f;
    const n = argOf('lines', null); if (n) args.lines = Number(n);
    console.log(textOf(await callTool('get_logs', args)) || '(无日志)');
    return;
  }

  if (cmd === 'shot') {
    const out = path.resolve(argOf('out', path.join(__dirname, '..', 'devtools_shots', 'minigame.png')));
    const r = await callTool('capture_screenshot', {});
    const img = imageOf(r);
    if (!img) { console.log(textOf(r) || '(截图失败，无 image 内容)'); process.exitCode = 1; return; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(img.data, 'base64'));
    console.log(`截图已写入 ${out} (${Math.round(fs.statSync(out).size / 1024)}K)`);
    return;
  }

  console.error(`未知命令 ${cmd}；可用：run / cycle / logs / shot / tools / status / stop`);
  process.exitCode = 2;
}

main().catch((e) => { console.error(String(e.message || e)); process.exitCode = 1; });
