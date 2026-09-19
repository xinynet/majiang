#!/usr/bin/env node
/* 运营后台页面自检：不开浏览器也能验的那部分。
 *
 * 为什么要有它：`public/index.html` 的逻辑全写在一个 <script> 块里，而这个块曾经因为
 * 一行 innerHTML 拼接里的双引号没转义而**整块语法错误**——页面打开一切正常，
 * 但统计不刷新、保存按钮没反应，肉眼很难看出来。这里做三件事：
 *
 *   1. 把 <script> 抽出来过一遍语法（就是当初漏掉的那一关）；
 *   2. 用一个最小 DOM 桩跑广告那几个函数，验 renderAds → collectAds 能原样往返；
 *   3. 校验脚本里 getElementById 用到的每个 id 在 HTML 里都真的存在（防手滑打错）。
 *
 * 运行：node server/admin-check.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(HTML, 'utf8');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; };

const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!script) { console.error('index.html 里找不到 <script> 块'); process.exit(1); }

console.log('[1] <script> 块语法');
{
  let err = null;
  try { new vm.Script(script); } catch (e) { err = e; }
  ok(!err, err ? '语法错误：' + err.message : '解析通过');
  if (err) { console.log('\n1 FAILED'); process.exit(1); }
}

console.log('\n[2] getElementById 用到的 id 都在 HTML 里');
{
  const ids = new Set();
  const re = /getElementById\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(script))) ids.add(m[1]);
  ok(ids.size > 0, `脚本里共引用 ${ids.size} 个 id`);
  for (const id of ids) {
    ok(html.includes('id="' + id + '"'), `id="${id}" 存在`);
  }
}

console.log('\n[3] 广告配置：渲染进表单再收回来，要能原样往返');
{
  /* 最小 DOM 桩：只实现这几个函数用到的那点 API。 */
  const created = [];
  function makeEl(tag) {
    const el = {
      tagName: tag, value: '', innerText: '', innerHTML: '', checked: false,
      className: '', type: '', dataset: {}, style: { cssText: '' }, children: [],
      appendChild(c) { this.children.push(c); created.push(c); return c; },
    };
    return el;
  }
  const byId = {};
  const document = {
    getElementById(id) { return (byId[id] = byId[id] || makeEl('input')); },
    createElement(tag) { return makeEl(tag); },
    createTextNode(t) { return { text: t }; },
    querySelectorAll(sel) {
      const cls = sel.replace(/^\./, '');
      return created.filter((el) => el.className === cls);
    },
  };
  const sandbox = {
    document,
    window: {},
    fetch: () => Promise.reject(new Error('自检不联网')),
    setTimeout, console, Math, Number, String, JSON, confirm: () => false,
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);

  const cfg = {
    enabled: true,
    provider: 'wechat',
    rewardedVideoUnitId: 'adunit-0123456789ab',
    bannerUnitId: 'adunit-ba9876543210',
    minIntervalSeconds: 30,
    fallbackToMock: false,
    placements: {
      luckyBag: true, piggy: false, stamina: true, shopCoins: true,
      shopTool: false, refill: true, cardsChest: true, cardsDetail: false,
    },
  };
  sandbox.renderAds(cfg);
  const back = sandbox.collectAds();

  ok(back.provider === cfg.provider, `provider 往返：${back.provider}`);
  ok(back.rewardedVideoUnitId === cfg.rewardedVideoUnitId, '激励视频广告位 ID 往返');
  ok(back.bannerUnitId === cfg.bannerUnitId, 'Banner 广告位 ID 往返');
  ok(back.minIntervalSeconds === 30, `最小间隔往返：${back.minIntervalSeconds}`);
  ok(back.enabled === true && back.fallbackToMock === false, '两个布尔开关往返（注意 false 不能被当成缺省）');
  ok(JSON.stringify(back.placements) === JSON.stringify(cfg.placements),
    '8 个投放位开关逐个往返：' + JSON.stringify(back.placements));

  /* 投放位清单必须和客户端对得上，否则后台关了开关客户端不认。 */
  const ADS_JS = path.join(__dirname, '..', 'majiang-game', 'src', 'ads.js');
  if (fs.existsSync(ADS_JS)) {
    const clientKeys = (fs.readFileSync(ADS_JS, 'utf8').match(/PLACEMENTS = \{([\s\S]*?)\}/) || [])[1] || '';
    const missing = Object.keys(cfg.placements).filter((k) => !clientKeys.includes(k));
    ok(missing.length === 0, missing.length ? '客户端 ads.js 缺投放位：' + missing.join(',') : '投放位清单与客户端 ads.js 一致');
  } else {
    ok(false, '找不到 majiang-game/src/ads.js');
  }

  console.log('\n[4] 广告数据表能按投放位渲染');
  sandbox.renderAdStats({ byPlacement: { luckyBag: { impressions: 10, completions: 7, errors: 1 } } });
  const tbody = byId['ads-stats-tbody'];
  ok(tbody.children.length === 8, `8 个投放位各一行，实际 ${tbody.children.length} 行`);
  const first = tbody.children[0].innerHTML;
  ok(first.includes('>10<') && first.includes('>7<') && first.includes('70%'),
    '首行数据与完成率：' + first.replace(/<[^>]+>/g, ' ').trim());
}

console.log('\n' + (fails ? `${fails} FAILED` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
