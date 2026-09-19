// launch-ide.cjs -> 以自动化模式拉起微信开发者工具（长驻后台）
const automator = require('miniprogram-automator');
const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PROJECT = 'C:\\mydev\\majiang\\majiang-mp\\dist\\build\\mp-weixin';

(async () => {
  console.log('[launch] starting IDE with automation port 9420 ...');
  const miniProgram = await automator.launch({
    cliPath: CLI,
    projectPath: PROJECT,
    port: 9420,
    timeout: 180000,
  });
  const page = await miniProgram.currentPage();
  console.log('[launch] OK, current page =', page && page.path);
  const sys = await miniProgram.systemInfo();
  console.log('[launch] SDK =', sys.SDKVersion);
  // 保持连接 30 分钟，供后续 playtest 复用（断开客户端不影响 IDE 侧 9420 监听）
  await new Promise((r) => setTimeout(r, 30 * 60 * 1000));
  await miniProgram.disconnect();
  console.log('[launch] idle done');
})().catch((e) => {
  console.error('[launch] FAIL:', e.message);
  process.exit(1);
});
