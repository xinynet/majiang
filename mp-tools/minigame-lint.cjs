#!/usr/bin/env node
/* 小游戏运行时专属静态检查：查那些「浏览器预览里一切正常，开发者工具/真机一加载就崩」的写法。
 *
 * 起因是一次真实事故：`src/screen.js` 在模块顶层写了 `const screen = {...}`，
 * 而小游戏运行时把每个模块包在一个函数里执行，那个作用域里**已经有一个 `screen`**
 * （浏览器风格的全局）。于是：
 *
 *   SyntaxError: Identifier 'screen' has already been declared
 *   → module 'src/screen.js' is not defined, require args is './src/screen.js'
 *   → 整个游戏起不来
 *
 * 而浏览器预览的打包器不注入这些名字，预览里跑得好好的——这类问题只有装进微信才暴露，
 * 反馈回路最长，所以值得用一个静态检查钉死。
 *
 * 查三类：
 *   1. 模块顶层声明的标识符撞上运行时注入的全局（上面那件事）；
 *   2. ESM 语法（import / export）——小游戏运行时是 CommonJS，`import` 直接 SyntaxError；
 *   3. 裸调用 `requestAnimationFrame`——模块作用域里它是 undefined，真机上
 *      `TypeError: requestAnimationFrame is not a function`，同样只有装进微信才暴露。
 *      要走 platform.js 的 raf()（从 GameGlobal / globalThis 上取，并有 setTimeout 兜底）。
 *
 * 运行：node mp-tools/minigame-lint.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'majiang-game');

/* 小游戏运行时/浏览器垫片里可能已经存在的名字。模块顶层再声明同名就是 SyntaxError。
 *
 * 老实说：真正被实测证明会撞的只有 `screen`（上面那次事故）。其余是按「浏览器风格全局」
 * 推断的预防性清单，可能偏严。之所以可以偏严——改一个撞名的局部变量成本几乎为零，
 * 而漏一个的代价是「装进微信才发现整个游戏起不来」。哪天确认某个名字其实安全，
 * 从这里删掉即可，别反过来把检查关掉。 */
const RESERVED = new Set([
  'screen', 'window', 'document', 'navigator', 'location', 'history', 'performance',
  'localStorage', 'sessionStorage', 'self', 'top', 'parent', 'frames', 'name', 'status',
  'length', 'origin', 'closed', 'event', 'alert', 'atob', 'btoa', 'fetch',
  'XMLHttpRequest', 'WebSocket', 'Image', 'Audio', 'canvas', 'wx', 'global', 'globalThis',
  'module', 'exports', 'require', 'define', 'console',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'static' || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

const files = walk(ROOT).sort();
console.log(`[1] 模块顶层标识符不得与运行时注入的全局同名（共 ${files.length} 个文件）`);

/* 只看顶格写的声明：本项目的风格里，模块顶层的 const/let/function 一定在第 0 列，
 * 缩进的都在函数体内部（那是新作用域，不会撞）。这样不用引 parser 也足够可靠。 */
const DECL = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=;]|^function\s+([A-Za-z_$][\w$]*)\s*\(/;
let hits = 0;
for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = DECL.exec(line);
    if (!m) return;
    const name = m[1] || m[2];
    if (!RESERVED.has(name)) return;
    hits++;
    ok(false, `${rel}:${i + 1} 顶层声明了 \`${name}\`，它在小游戏运行时里已存在 → 加载期 SyntaxError`);
  });
}
if (!hits) ok(true, '没有撞名的顶层声明');

console.log('\n[2] 不得使用 ESM 语法（小游戏运行时是 CommonJS）');
let esm = 0;
for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*import\s+[\w{*]/.test(line) || /^\s*export\s+(default|const|function|class|\{)/.test(line)) {
      esm++;
      ok(false, `${rel}:${i + 1} ${line.trim().slice(0, 60)}`);
    }
  });
}
if (!esm) ok(true, '没有 import / export');

console.log('\n[3] 不得裸调用 requestAnimationFrame（模块作用域里它是 undefined）');
{
  let bare = 0;
  for (const file of files) {
    const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    /* platform.js 是唯一允许碰它的地方：raf() 就在那儿从全局对象上取。 */
    if (rel.endsWith('src/platform.js')) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/[/*]/.test(line) || /^\s*\*/.test(line)) return;   // 注释里提到不算
      if (/(?<![.\w])(request|cancel)AnimationFrame\s*\(/.test(line)) {
        bare++;
        ok(false, `${rel}:${i + 1} 裸调用帧接口，请改用 platform.js 的 raf()`);
      }
    });
  }
  if (!bare) ok(true, '没有裸调用');
}

console.log('\n[4] game.js 的调试开关必须是空的（提交前不能带着 DEBUG_SCENE 上线）');
{
  const g = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const m = /const DEBUG_SCENE = '([^']*)'/.exec(g);
  ok(m && m[1] === '', m ? `DEBUG_SCENE = '${m[1]}'` : '没找到 DEBUG_SCENE');
}

console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
