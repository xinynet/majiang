// playtest.cjs -> 连接 9420，模拟真人试玩，输出截图与结构化结果
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const QA_OUT = 'C:/Users/Administrator/WorkBuddy AI/2026-09-18-01-19-11';
const DIST = 'C:/mydev/majiang/majiang-mp/dist/build/mp-weixin';
const result = { steps: [], errors: [], consoleEvents: [] };
const log = (name, ok, detail) => {
  result.steps.push({ name, ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' | ' + String(detail) : ''));
};

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420', timeout: 20000 });
  log('connect', true, 'ws://127.0.0.1:9420');
  mp.on('exception', (e) => result.errors.push({ src: 'app', msg: (e && e.message) || 'exception', ...e }));
  mp.on('console', (e) => {
    if (e.type === 'error') result.consoleEvents.push({ type: 'error', args: (e.args || []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a)).slice(0, 120)) });
  });

  // 0) 确保在首页
  let page = await mp.currentPage();
  if (!page || !/pages\/index\/index/.test(page.path)) {
    await mp.reLaunch('/pages/index/index');
    await new Promise((r) => setTimeout(r, 2500));
  }
  page = await mp.currentPage();
  log('home-page', /pages\/index\/index/.test(page.path), page.path);
  await new Promise((r) => setTimeout(r, 1500));
  await mp.screenshot({ path: path.join(QA_OUT, 'after-home.png') });
  log('screenshot-home', true, 'after-home.png');

  // 1) 关卡宝箱弹窗
  try {
    await (await mp.pageStack ? null : null);
  } catch (e) { /* noop */ }
  try {
    const home = page;
    const chestBtn = await home.$('.spr-chestLevel');
    if (chestBtn) {
      await chestBtn.tap();
      await home.waitFor(900);
      const dlg = await home.$('.reward-dialog');
      log('level-chest-modal', !!dlg, dlg ? 'reward-dialog 出现' : '未出现 .reward-dialog');
      await mp.screenshot({ path: path.join(QA_OUT, 'after-level-chest.png') });
      const close = await home.$('.modal-close-circle');
      if (close) { await close.tap(); await home.waitFor(600); log('level-chest-close', true); }
    } else {
      log('level-chest-modal', false, '未找到 .spr-chestLevel');
    }
  } catch (e) { log('level-chest-modal', false, 'EXC ' + e.message); }

  // 2) 幸运礼包弹窗
  try {
    const home = await mp.currentPage();
    const btn = await home.$('.spr-tileLucky');
    if (btn) {
      await btn.tap();
      await home.waitFor(900);
      const art = await home.$('.lucky-header-art');
      const src = art ? await art.attribute('src') : null;
      log('lucky-modal', true, 'header-src=' + src);
      if (src) {
        const fileRel = src.replace(/^\//, '').split('?')[0];
        log('lucky-modal-img-exists', fs.existsSync(path.join(DIST, fileRel)), fileRel);
      }
      await mp.screenshot({ path: path.join(QA_OUT, 'after-lucky.png') });
      const close = await home.$('.modal-close-circle');
      if (close) { await close.tap(); await home.waitFor(600); log('lucky-close', true); }
    } else {
      log('lucky-modal', false, '未找到 .spr-tileLucky');
    }
  } catch (e) { log('lucky-modal', false, 'EXC ' + e.message); }

  // 3) 开始游戏 -> 游戏页
  try {
    const home = await mp.currentPage();
    await (await home.$('.spr-btnStart')).tap();
    await home.waitFor(3000);
    const now = await mp.currentPage();
    result.afterStart = now.path;
    log('start-game-navigate', /game|pkg-game/.test(now.path), now.path);
    if (/game/.test(now.path)) {
      await new Promise((r) => setTimeout(r, 2500));
      await mp.screenshot({ path: path.join(QA_OUT, 'after-game.png') });
      log('screenshot-game', true, 'after-game.png');
      const cc = await now.$('canvas');
      log('game-canvas', !!cc, cc ? 'canvas 存在' : 'canvas 未找到');
      // 返回首页
      await mp.navigateBack();
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) { log('start-game-navigate', false, 'EXC ' + e.message); }

  // 4) 集卡页图片完整性
  try {
    await mp.reLaunch('/pkg-cards/pages/cards/cards');
    await new Promise((r) => setTimeout(r, 2500));
    const cards = await mp.currentPage();
    log('cards-page', /cards/.test(cards.path), cards.path);
    const imgs = await cards.$$('image');
    let missing = 0, checked = 0, sample = [];
    for (const img of imgs.slice(0, 60)) {
      const src = await img.attribute('src');
      if (!src || !/\.(png|jpg|jpeg|gif|webp)/i.test(src)) continue;
      checked++;
      const rel = src.replace(/^\//, '').split('?')[0];
      const ok = /^https?:/.test(src) ? true : fs.existsSync(path.join(DIST, rel));
      if (!ok) { missing++; if (sample.length < 8) sample.push(rel); }
    }
    log('cards-images', missing === 0, `checked=${checked} missing=${missing} ${sample.join(',')}`);
    await mp.screenshot({ path: path.join(QA_OUT, 'after-cards.png') });
  } catch (e) { log('cards-page', false, 'EXC ' + e.message); }

  // 5) 结果落盘
  result.errorsCount = result.errors.length;
  result.consoleErrorCount = result.consoleEvents.length;
  fs.writeFileSync(path.join(QA_OUT, 'playtest-result.json'), JSON.stringify(result, null, 2));
  const fails = result.steps.filter((s) => !s.ok);
  console.log('===SUMMARY===');
  console.log('PASS=' + result.steps.filter((s) => s.ok).length, 'FAIL=' + fails.length, 'APP_EXCEPTIONS=' + result.errors.length, 'CONSOLE_ERRORS=' + result.consoleEvents.length);
  if (result.consoleEvents.length) console.log('CONSOLE_ERRS', JSON.stringify(result.consoleEvents.slice(0, 10)));
  await mp.disconnect();
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
