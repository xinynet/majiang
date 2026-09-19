const a = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
const out = process.env.QA_OUT || 'C:/Users/Administrator/WorkBuddy AI/2026-09-18-01-19-11';
(async () => {
  const mp = await a.connect({wsEndpoint:'ws://127.0.0.1:9420',timeout:15000});
  const events=[]; mp.on('exception',e=>events.push(e)); mp.on('console',e=>events.push(e));
  try {
    const home = await mp.currentPage();
    const saved = await mp.callWxMethod('getStorageSync','majiang_user_profile_v2');
    fs.writeFileSync(path.join(out,'qa-original-profile.json'),JSON.stringify(saved,null,2));
    await mp.evaluate(() => { const original=wx.navigateTo; wx.navigateTo=function(opts){ const fail=opts.fail; opts.fail=e=>{console.error('QA_NAV_FAILED',opts.url,e);if(fail)fail(e);}; return original.call(wx,opts);}; });
    await (await home.$('.spr-btnStart')).tap();
    await home.waitFor(1200);
    console.log('AFTER_START', (await mp.currentPage()).path);
    console.log('EVENTS',JSON.stringify(events));
    if((await mp.currentPage()).path==='pages/index/index') {
      await (await home.$('.spr-tileLucky')).tap();
      await home.waitFor(500);
      await mp.screenshot({path:path.join(out,'before-lucky.png')});
      console.log('LUCKY_IMG',await (await home.$('.lucky-header-art')).attribute('src'));
      await (await home.$('.modal-close-circle')).tap();
      await (await home.$('.spr-chestLevel')).tap();
      console.log('CHEST_EXISTS',Boolean(await home.$('.reward-dialog')));
    }
    fs.writeFileSync(path.join(out,'repro-before.json'),JSON.stringify({page:(await mp.currentPage()).path,events},null,2));
  } finally { mp.disconnect(); }
})().catch(e=>{console.error(e);process.exit(1)});
