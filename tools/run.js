// tools/run.js — 零依赖 CDP 测试驱动: 启动 Edge headless → 打开游戏 → 模拟键盘 → 截图
// 用法:
//   node tools/run.js shot <out.png> [preset|keys] [waitMs]
// presets: menu | start | combat | move | dungeon | items | boss | win | death
// 例: node tools/run.js shot shots/combat.png combat
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8123/index.html';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------- 按键预设 -------
const PRESETS = {
  menu: [],                                // 停留主菜单
  start: [],                               // auto=1 直接开局
  combat: [
    'hold:ArrowRight:1800',
    'hold:KeyD:600',
    'hold:ArrowLeft:900',
    'hold:KeyA:500',
    'hold:ArrowUp:700',
    'hold:KeyW:400',
  ],
  move: ['hold:KeyW:900', 'hold:KeyS:600', 'hold:KeyA:900', 'hold:KeyD:700', 'hold:ArrowRight:400'],
  dungeon: ['hold:KeyS:200', 'hold:ArrowDown:300', 'hold:KeyW:800'],
  boss: ['hold:KeyS:120', 'hold:KeyW:1500'],
  items: ['tap:KeyE:60'],
  win: [],
  death: ['hold:KeyS:120', 'hold:KeyW:2000'],
  walkaround: ['hold:KeyW:800', 'hold:KeyD:600', 'hold:KeyS:800', 'hold:KeyA:600'],
};

// 主程序
async function main() {
  const [, , cmd, outFile, presetRaw, waitMsRaw] = process.argv;
  const preset = presetRaw && !/^\d+$/.test(presetRaw) ? presetRaw : 'start';
  const waitMs = parseInt(presetRaw && /^\d+$/.test(presetRaw) ? presetRaw : (waitMsRaw || '500'), 10);
  if (!outFile) { console.log('usage: node tools/run.js shot <out.png> [preset] [waitMs]'); process.exit(1); }
  const port = 9400 + Math.floor(Math.random() * 300);
  const userData = path.join(__dirname, '.edge-profile-' + port);
  const url = BASE + (preset === 'menu' ? '' : '?auto=1');
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    '--mute-audio', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--disable-crash-reporter',
    '--window-size=1010,700',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + userData,
    url,
  ];
  const child = spawn(EDGE, args, { stdio: ['ignore', 'ignore', fs.openSync(path.join(__dirname, '.edge-stderr.log'), 'w')] });
  console.log('edge spawned pid=' + child.pid + ' port=' + port);
  child.on('error', (e) => console.log('edge spawn error:', e.message));
  child.on('exit', (code, sig) => console.log('edge exited code=' + code + ' sig=' + sig));
  child.on('spawn', () => console.log('edge spawn event ok'));
  const kills = () => { try { child.kill(); } catch (e) { } };
  process.on('exit', kills);

  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJson('http://127.0.0.1:' + port + '/json/list');
      const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      if (i === 6 || i === 20) console.log('targets so far:', JSON.stringify(list.map((t) => ({ type: t.type, url: (t.url || '').slice(0, 60) }))).slice(0, 400));
    } catch (e) { /* not ready */ }
    await sleep(250);
  }
  if (!wsUrl) { console.error('无法连接 Edge CDP'); child.kill(); process.exit(1); }
  console.log('connected to page ws');

  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pend = new Map();
  const consoleErrs = [];
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { consoleErrs.push('EXC: ' + (m.params.exceptionDetails.text || '') + ' ' + (m.params.exceptionDetails.exception ? JSON.stringify(m.params.exceptionDetails.exception).slice(0, 300) : '')); }
      else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { consoleErrs.push('LOG: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300)); }
    };
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pend.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  // 等加载完成
  for (let i = 0; i < 40; i++) {
    try {
      const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (r.result && r.result.value === 'complete') break;
    } catch (e) { }
    await sleep(200);
  }
  await sleep(waitMs);

  // 执行按键序列
  const acts = PRESETS[preset] || (preset.includes(':') ? preset.split(',') : []);
  const keyInfo = {
    KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68],
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    KeyE: ['e', 69], Space: [' ', 32], KeyP: ['p', 80], KeyR: ['r', 82], Enter: ['Enter', 13],
  };
  async function pressKey(k, down) {
    const [key, vk] = keyInfo[k] || [k, 0];
    await send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: key, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  for (const a of acts) {
    const [op, kname, durRaw] = a.split(':');
    const dur = parseInt(durRaw, 10) || 600;
    if (op === 'hold') {
      await pressKey(kname, true);
      await sleep(dur);
      await pressKey(kname, false);
    } else if (op === 'tap') {
      await pressKey(kname, true);
      await sleep(dur || 60);
      await pressKey(kname, false);
    }
    await sleep(120);
  }
  // 动作后再等一下, 让画面稳定
  await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  console.log('saved ' + outFile + '  preset=' + preset + ' wait=' + waitMs + ' consoleErrors=' + consoleErrs.length);
  consoleErrs.slice(0, 12).forEach((e) => console.log('  ' + e));
  ws.close();
  child.kill();
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch (e) { }
  process.exit(consoleErrs.length ? 2 : 0);
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
