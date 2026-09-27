// tools/cdp.js — 极简 CDP 工具: 用无头 Edge 打开页面并执行一段 JS, 打印结果
// 用法: node tools/cdp.js <url> "<js表达式>" [等待毫秒] [截图输出路径]
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const expr = process.argv[3] || 'document.title';
const waitMs = parseInt(process.argv[4] || '2500', 10);
const shotPath = process.argv[5] || '';
if (!url) { console.error('用法: node tools/cdp.js <url> "<js表达式>" [等待毫秒] [截图路径]'); process.exit(1); }

const port = 9500 + Math.floor(Math.random() * 400);
const profile = path.join(os.tmpdir(), 'cdp_' + Date.now());
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(300);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      target = list.find((t) => t.type === 'page');
    } catch (e) { }
  }
  if (!target) throw new Error('无法连接调试端口');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url });
  await sleep(waitMs);
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result.value, null, 2));
  if (shotPath) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.error('截图已保存: ' + shotPath);
  }
  ws.close();
}

main().then(() => { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { } process.exit(0); })
  .catch((e) => { console.error('错误: ' + e.message); edge.kill(); process.exit(1); });
