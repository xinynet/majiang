
const child_process = require('child_process');
const automator = require('miniprogram-automator');

async function main() {
  console.log('1. Launching IDE with cli.bat auto...');
  const proc = child_process.spawn('cmd.exe', [
    '/c',
    'cli.bat auto --project C:/mydev/majiang/majiang-mp/dist/build/mp-weixin --auto-port 9420'
  ], {
    cwd: 'C:/Program Files (x86)/Tencent/微信web开发者工具'
  });

  proc.stdout.on('data', d => console.log('[CLI]:', d.toString().trim()));
  proc.stderr.on('data', d => console.log('[CLI ERR]:', d.toString().trim()));

  console.log('2. Waiting 12s for DevTools to open project and start automation WebSocket...');
  await new Promise(r => setTimeout(r, 12000));

  console.log('3. Connecting with automator.connect to ws://127.0.0.1:9420...');
  let mp = null;
  for (let i = 0; i < 20; i++) {
    try {
      mp = await automator.connect({
        wsEndpoint: 'ws://127.0.0.1:9420',
        timeout: 10000
      });
      console.log('Successfully connected to DevTools automator!');
      break;
    } catch (e) {
      console.log('Retry connecting... (' + (i + 1) + '/20):', e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!mp) {
    console.error('Failed to connect to automator within retry limit');
    process.exit(1);
  }

  const page = await mp.currentPage();
  console.log('Current page:', page.path);
  await new Promise(r => setTimeout(r, 3000));
  await mp.screenshot({ path: 'C:/mydev/majiang/mp-screenshot-test.png' });
  console.log('Screenshot saved to C:/mydev/majiang/mp-screenshot-test.png');
  await mp.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
