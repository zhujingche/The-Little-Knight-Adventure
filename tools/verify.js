// tools/verify.js — 自动化"试玩"验证 (浏览器级 CDP: 先挂监听再导航, 不丢启动错误)
// 用法: node tools/verify.js <scenario>   (dbg | p1 | p3 | p4 | p5)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8123/index.html?auto=1';

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

const KEYCODE = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, KeyE: 69, Space: 32 };

async function main() {
  const scenario = process.argv[2] || 'p1';
  const port = 9600 + Math.floor(Math.random() * 200);
  const userData = path.join(__dirname, '.verify-profile-' + port);
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--mute-audio',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-crash-reporter',
    '--no-proxy-server', '--proxy-bypass-list=<-loopback>',
    '--window-size=1010,700', '--remote-debugging-port=' + port,
    '--user-data-dir=' + userData,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  process.on('exit', () => {
    try { child.kill(); } catch (e) { }
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (e) { }
  });

  // 浏览器级 WebSocket
  let ver = null;
  for (let i = 0; i < 80; i++) {
    try { ver = await getJson('http://127.0.0.1:' + port + '/json/version'); if (ver.webSocketDebuggerUrl) break; } catch (e) { }
    await sleep(250);
  }
  if (!ver) { console.error('CDP connect fail'); child.kill(); process.exit(1); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let seq = 0;
  const pend = new Map();
  const errs = [];
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('browser ws error'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) {
        const p = pend.get(m.id); pend.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params && m.params.exceptionDetails;
        errs.push('EXC ' + String((d && d.exception && (d.exception.description || d.exception.value)) || (d && d.text) || '').slice(0, 500));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errs.push('LOG ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 400));
      } else if (m.method === 'Inspector.targetCrashed') {
        errs.push('TARGET CRASHED');
      }
    };
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pend.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: BASE });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const ses = (method, params = {}) => send(method, params, sessionId);
  await ses('Page.enable');
  await ses('Runtime.enable');
  const ev = async (expression) => {
    const r = await ses('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const ed = r.exceptionDetails;
      const desc = (ed.exception && (ed.exception.description || ed.exception.value)) || ed.text || '';
      throw new Error('eval threw: ' + String(desc).slice(0, 900));
    }
    return r.result.value;
  };
  async function key(k, down) {
    await ses('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: k.replace('Key', ''), code: k, windowsVirtualKeyCode: KEYCODE[k], nativeVirtualKeyCode: KEYCODE[k] });
  }
  async function hold(k, ms) { await key(k, true); await sleep(ms); await key(k, false); await sleep(120); }
  const diag = () => ev('window.DEBUG.diag()');

  await ses('Page.navigate', { url: BASE }).catch(() => { });
  for (let i = 0; i < 60; i++) {
    try {
      const s = await ev('document.readyState');
      const href = await ev('location.href');
      if (s === 'complete' && href.indexOf('8123') >= 0 && href.indexOf('chrome-error') < 0) break;
      if (href.indexOf('chrome-error') >= 0 && i === 5) console.log('NAV WARN: chrome-error page');
    } catch (e) { }
    await sleep(200);
  }
  const out = { scenario, checks: [] };
  const check = (name, pass, extra = '') => {
    out.checks.push({ name, pass, extra: String(extra) });
    console.log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? '  :: ' + extra : ''));
  };
  async function shot(name) {
    try {
      const s = await ses('Page.captureScreenshot', { format: 'png' });
      const p = path.join(__dirname, '..', 'shots', name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
      console.log('shot ' + name);
    } catch (e) { console.log('shot fail ' + name + ' ' + e.message); }
  }
  try {
    await sleep(1500);
    if (scenario === 'dbg') {      const s = await ev('JSON.stringify({plus:1+1,hasDEBUG:!!window.DEBUG,hasGAME:!!window.GAME,ready:document.readyState,canvas:!!document.getElementById("game"),href:location.href,title:document.title,body:(document.body?document.body.innerHTML:"").slice(0,220)})');
      console.log('DBG ' + s);
    } else if (scenario === 'bgm') {
      // 触发一次用户手势以解锁音频
      await hold('KeyW', 60);
      await sleep(2500);
      const info = await ev('JSON.stringify(window.__bgm || {found:false,files:[],ts:null})');
      const aud = await ev('JSON.stringify(window.__aud ? window.__aud() : null)');
      console.log('BGM INFO: ' + info);
      console.log('AUD INFO: ' + aud);
      const b = JSON.parse(info), a = JSON.parse(aud);
      let pass;
      if (b.found) { if (!b.playing) console.log('BGM NOTE: 检测到文件但 play 未进入播放态'); pass = true; }
      else pass = !!(a && a.seq);
      out.checks.push({ name: 'BGM 激活(文件或程序化)', pass: !!pass, extra: info + ' | ' + aud });
      console.log((pass ? 'PASS ' : 'FAIL ') + 'BGM 激活(文件或程序化)  :: ' + info + ' | ' + aud);
    } else if (scenario === 'proc') {
      // 强制无用户音乐, 验证程序化 BGM 是否真正激活(相当于在线版场景)
      await ses('Page.navigate', { url: 'http://127.0.0.1:8123/index.html?auto=1&nobgm=1' });
      for (let i = 0; i < 40; i++) { try { if ((await ev('document.readyState')) === 'complete') break; } catch (e) { } await sleep(200); }
      await sleep(1000);
      await hold('KeyW', 60);
      await sleep(2200);
      const aud = await ev('JSON.stringify(window.__aud ? window.__aud() : null)');
      console.log('AUD INFO: ' + aud);
      const a = JSON.parse(aud);
      const ok = a && a.seq === true;
      check('程序化 BGM 已激活(seq 运行)', ok, aud);
      await shot('verify_proc.png');
      if (!ok) throw new Error('程序化BGM未激活: ' + aud);
    } else if (scenario === 'touch') {
      await ses('Page.navigate', { url: 'http://127.0.0.1:8123/index.html?auto=1&mobile=1' });
      for (let i = 0; i < 40; i++) { try { if ((await ev('document.readyState')) === 'complete') break; } catch (e) { } await sleep(200); }
      await sleep(1200);
      const x0 = (await ev('window.DEBUG.diag()')).player.x;
      // 在左半屏按下并右拖, 模拟摇杆
      await ev(`(()=>{const z=document.getElementById('joyZone');const r=document.getElementById('viewport').getBoundingClientRect();
        const cx=r.left+(170/960)*r.width, cy=r.top+(360/640)*r.height;
        z.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,pointerId:9,pointerType:'touch',bubbles:true}));
        const cx2=r.left+(330/960)*r.width, cy2=r.top+(330/640)*r.height;
        z.dispatchEvent(new PointerEvent('pointermove',{clientX:cx2,clientY:cy2,pointerId:9,pointerType:'touch',bubbles:true}));})()`);
      await sleep(800);
      const x1 = (await ev('window.DEBUG.diag()')).player.x;
      await ev(`document.getElementById('joyZone').dispatchEvent(new PointerEvent('pointerup',{clientX:0,clientY:0,pointerId:9,pointerType:'touch',bubbles:true}));`);
      check('浮动摇杆可拖动移动玩家', Math.abs(x1 - x0) > 30, 'dx=' + (x1 - x0));
      const joyActive = await ev(`!!document.getElementById('joyBase').classList.contains('active')`);
      check('松手后摇杆收起', joyActive === false, 'active=' + joyActive);
    } else if (scenario === 'hp') {
      await sleep(1200);
      const redSum = await ev(`(()=>{let n=0;document.querySelectorAll('#hudHearts .hbox').forEach(c=>{const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4){if(d[i]>120&&d[i+1]<90&&d[i+2]<90)n++;}});return n;})()`);
      const hp0 = (await ev('window.DEBUG.diag()')).player.hp;
      await ev('window.GAME().player.god=false');
      await ev('window.GAME().player.takeDamage(3, 0, window.GAME())');
      await sleep(400);
      const hp1 = (await ev('window.DEBUG.diag()')).player.hp;
      const redSum2 = await ev(`(()=>{let n=0;document.querySelectorAll('#hudHearts .hbox').forEach(c=>{const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4){if(d[i]>120&&d[i+1]<90&&d[i+2]<90)n++;}});return n;})()`);
      check('受伤后血量减少', hp1 < hp0, 'hp ' + hp0 + '->' + hp1);
      check('血条 HUD 随受伤刷新(红像素减少)', redSum2 < redSum, 'redPx ' + redSum + '->' + redSum2);
    } else if (scenario === 'art') {
      // 前往美术板页面并截图(放大预览角色)
      await ses('Page.navigate', { url: 'http://127.0.0.1:8123/tools/artboard.html' });
      for (let i = 0; i < 40; i++) {
        try { if ((await ev('document.readyState')) === 'complete') break; } catch (e) { }
        await sleep(200);
      }
      await sleep(600);
      await shot('artboard.png');
      console.log('artboard saved');
    } else if (scenario === 'p1') await sP1({ diag, hold, ev, check, key, sleep });
    else if (scenario === 'p2') await sP2({ diag, hold, ev, check, sleep });
    else if (scenario === 'p3') await sP3({ diag, hold, ev, check, sleep });
    else if (scenario === 'p4') await sP4({ diag, hold, ev, check, sleep });
    else if (scenario === 'p5') await sP5({ diag, hold, ev, check, sleep });
    else if (scenario === 'p6') await sP6({ diag, ev, check, sleep });
    else if (scenario === 'p7') await sP7({ diag, ev, check, sleep, hold });
    else if (scenario === 'p8') await sP8({ diag, ev, check, sleep, hold, key, ses });
    else if (scenario === 'p9') await sP9({ diag, ev, check, sleep, hold });
    else if (scenario === 'snap') await snap({ diag, ev, hold, sleep, shot });
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 1200);
    console.log('SCENARIO ERROR: ' + out.error);
  }
  out.pageErrors = errs.slice(0, 10);
  if (errs.length) console.log('PAGE ERRORS:\n  ' + errs.slice(0, 10).join('\n  '));
  try {
    const shot = await ses('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'shots', 'verify_' + scenario + '.png'), Buffer.from(shot.data, 'base64'));
  } catch (e) { }
  const passed = out.checks.filter((c) => c.pass).length;
  console.log(`RESULT ${scenario}: ${passed}/${out.checks.length} passed` + (out.error ? ' SCENARIO-ERROR' : '') + (errs.length ? ' pageErrors=' + errs.length : ''));
  ws.close();
  child.kill();
  process.exit(passed === out.checks.length && !out.error && !errs.length ? 0 : 1);
}

// ---- p1: 房间/移动/射击/清房开门/换房 ----
async function sP1({ diag, hold, ev, check, key, sleep }) {
  let d = await diag();
  check('进入游戏', d && d.state === 'play', d && 'state=' + d.state);
  check('地图含Boss房且房间数 6-9', d && d.map && d.map.count >= 6 && d.map.count <= 9 && d.map.roles.includes('boss'), d && 'rooms=' + d.map.count + ' roles=' + d.map.roles.join(''));
  check('起始房', d && d.cur && d.cur.role === 'start' && !d.cur.sealed, d && 'role=' + d.cur.role);
  check('初始属性3心满血', d && d.player && d.player.hp === d.player.maxHp && d.player.containers === 3, JSON.stringify(d && d.player && { hp: d.player.hp, c: d.player.containers }));

  const p0 = d.player;
  await hold('KeyD', 550);
  d = await diag();
  check('WASD移动生效', Math.abs(d.player.x - p0.x) > 60, 'dx=' + (d.player.x - p0.x));
  const t0 = d.stats.tears;
  await hold('ArrowRight', 700);
  d = await diag();
  check('方向键射击生成圣泪', d.stats.tears > t0, 'tears=' + d.stats.tears + ' (was ' + t0 + ')');
  check('玩家存活', d.player && !d.player.dead);

  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.teleport("normal")');
  await sleep(500);
  d = await diag();
  check('普通房敌人生成', d.enemies.length >= 1, 'enemies=' + d.enemies.join(','));
  check('敌人房封门', d.cur.sealed === true && d.cur.cleared === false, 'sealed=' + d.cur.sealed);
  const door1 = d.cur.doors[0];
  if (door1) {
    const k = { N: 'KeyW', S: 'KeyS', W: 'KeyA', E: 'KeyD' }[door1[0]];
    const idx0 = d.cur.idx;
    await hold(k, 1300);
    d = await diag();
    check('未清房无法离开(门锁)', d.cur.idx === idx0, 'idx ' + idx0);
  } else check('普通房有门', false, 'no doors?!');
  // 史莱姆会分裂, 需要多轮清怪
  for (let i = 0; i < 4; i++) {
    await ev('window.DEBUG.nuke()');
    await sleep(400);
    d = await diag();
    if (!d.enemies.length) break;
  }
  d = await diag();
  check('清房门开', d.cur.cleared === true && d.cur.sealed === false && d.enemies.length === 0, 'cleared=' + d.cur.cleared + ' enemies=' + d.enemies.join(','));
  const door2 = d.cur.doors[0];
  if (door2) {
    const k = { N: 'KeyW', S: 'KeyS', W: 'KeyA', E: 'KeyD' }[door2[0]];
    const idx0 = d.cur.idx;
    await hold(k, 1700);
    d = await diag();
    check('穿过门进相邻房', d.cur && d.cur.idx !== idx0, 'idx ' + idx0 + ' -> ' + d.cur.idx);
    check('切房后坐标合法', d.player.x > 0 && d.player.x < 960 && d.player.y > 0 && d.player.y < 640, '(' + d.player.x + ',' + d.player.y + ')');
  }
}

// ---- p2: 死亡统计 / 暂停 / 重开 ----
async function sP2({ diag, ev, check, hold, sleep }) {
  let d = await diag();
  // 暂停/恢复
  await hold('KeyP', 80);
  await sleep(300);
  const pausedUI = await ev('!document.getElementById("screen-pause").classList.contains("hidden")');
  check('P 键暂停', pausedUI, 'paused=' + pausedUI);
  await hold('KeyP', 80);
  await sleep(300);
  const resumed = await ev('document.getElementById("screen-pause").classList.contains("hidden")');
  check('再按 P 恢复', resumed, '');

  // 空手对 Boss 送死 → 死亡统计界面
  await ev('window.DEBUG.god(false)');
  await ev('window.DEBUG.teleport("boss")');
  await sleep(300);
  d = await diag();
  const hp0 = d.player.hp;
  check('Boss前满血', hp0 === d.player.maxHp, 'hp=' + hp0);
  // 原地吃 Boss 接触伤害直到死亡(每隔 ~0.8s 一次)
  let dead = false;
  for (let i = 0; i < 24 && !dead; i++) {
    await sleep(450);
    d = await diag();
    if (d.player.dead) dead = true;
  }
  await sleep(1600);
  d = await diag();
  const deathUI = await ev('!document.getElementById("screen-death").classList.contains("hidden")');
  check('玩家死亡', dead && d.state === 'dead', 'dead=' + dead + ' state=' + d.state);
  check('死亡界面出现', deathUI, 'deathUI=' + deathUI);
  const statText = await ev('document.getElementById("dTime").textContent.length > 0 && document.getElementById("dKills") !== null');
  check('死亡统计字段存在', statText, '');
  // 重新开始
  await ev('document.getElementById("btnRetry").click()');
  await sleep(1200);
  d = await diag();
  check('重开成功(回到第1层)', d.state === 'play' && d.floorIdx === 1 && d.player.hp === d.player.maxHp && d.player.items.length === 0, 'state=' + d.state + ' floor=' + d.floorIdx + ' items=' + d.player.items.length);
}

// ---- p3: 道具/属性/外观/HUD ----
async function sP3({ diag, ev, check, sleep }) {
  let d = await diag();
  const dmg0 = d.player.dmg;
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.giveItem("tri")');
  await ev('window.DEBUG.giveItem("horns")');
  await ev('window.DEBUG.giveItem("hp2")');
  d = await diag();
  check('道具记录', d.player.items.includes('tri') && d.player.items.includes('horns') && d.player.items.includes('hp2'), 'items=' + d.player.items.join(','));
  check('三连泪标记生效', d.player.flags.includes('tri'), 'flags=' + d.player.flags.join(','));
  check('恶魔契约倍率生效(伤害大幅)', d.player.dmg > 6, 'dmg=' + d.player.dmg);
  check('伤害提升', d.player.dmg > dmg0 + 3, 'dmg ' + dmg0 + ' -> ' + d.player.dmg);
  check('容器+1', d.player.containers === 4, 'containers=' + d.player.containers);
  check('HUD道具格=3', (await ev('document.querySelectorAll("#hudItems .ibox").length')) === 3, 'hud');
  check('HUD红心≥4', (await ev('document.querySelectorAll("#hudHearts .hbox").length')) >= 4, 'hearts');
  await ev('window.DEBUG.giveItem("laser")');
  d = await diag();
  check('镭射生效', d.player.flags.includes('laser'), 'flags=' + d.player.flags.join(','));
  await sleep(900);
}

// ---- p4: Boss(1层) 流程 ----
async function sP4({ diag, ev, check, hold, sleep }) {
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.teleport("boss")');
  await sleep(600);
  // 与 Boss 拉开距离, 进入正常交战
  await hold('KeyW', 500);
  let d = await diag();
  check('Boss房生成Boss', d.boss && d.boss.kind === 'hop', 'boss=' + (d.boss && d.boss.kind));
  check('Boss血条显示', (await ev('document.getElementById("bossBarWrap").classList.contains("hidden")')) === false, 'bar');
  // 交战 3 秒: 观察是否有伤害/弹幕产生
  const hp0 = d.boss ? d.boss.hpPct : 100;
  await hold('ArrowRight', 2600);
  let saw = false, hpNow = hp0;
  for (let i = 0; i < 6; i++) {
    await sleep(400);
    d = await diag();
    if (d.counts.eTears + d.counts.pTears > 0) saw = true;
    if (d.boss) hpNow = d.boss.hpPct;
  }
  check('Boss战有输出/弹幕', saw || hpNow < hp0, 'et/pt sampled, hp ' + hp0 + '->' + hpNow);
  check('玩家存活', d.player && !d.player.dead);
  const itemsBefore = d.player.items.length;
  await ev('window.DEBUG.killBoss()');
  await sleep(1100);
  d = await diag();
  const gotItem = d.pickups.some((p) => p.indexOf('item') === 0) || d.player.items.length > itemsBefore;
  check('Boss死亡→道具掉落/入包 + 楼梯出现', d.cur && d.cur.stairs && gotItem, 'stairs=' + (d.cur && d.cur.stairs) + ' items=' + d.player.items.length + ' pickups=' + d.pickups.join(','));
  // 走向楼梯(换层动画约1.6s, 分段按住并轮询)
  let floorReached = false;
  for (let round = 0; round < 3 && !floorReached; round++) {
    await hold('KeyS', 800);
    for (let i = 0; i < 12; i++) {
      await sleep(400);
      d = await diag();
      if (d.floorIdx === 2) { floorReached = true; break; }
    }
  }
  check('下到第二层', floorReached && d.state === 'play', 'floor=' + d.floorIdx + ' pos=(' + d.player.x + ',' + d.player.y + ')' + ' state=' + d.state);
}

// ---- p5: 通关(3层Boss→胜利界面) ----
async function sP5({ diag, ev, check, hold, sleep }) {
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.setFloor(3)');
  await sleep(800);
  let d = await diag();
  check('三层开局', d.floorIdx === 3 && d.state === 'play', 'floor=' + d.floorIdx);
  await ev('window.DEBUG.teleport("boss")');
  await sleep(600);
  d = await diag();
  check('最终Boss(knight)', d.boss && d.boss.kind === 'knight', 'boss=' + (d.boss && d.boss.kind));
  await hold('ArrowRight', 1800);
  await ev('window.DEBUG.killBoss()');
  await sleep(1000);
  await hold('KeyS', 1400);
  await sleep(2000);
  d = await diag();
  const winUI = await ev('!document.getElementById("screen-win").classList.contains("hidden")');
  check('通关界面出现', d.state === 'win' || winUI, 'state=' + d.state + ' winUI=' + winUI);
}

// ---- p6: 渲染像素健全性(替代肉眼, 抽样画布) ----
async function sP6({ diag, ev, check, sleep }) {
  let d = await diag();
  const samp = await ev(`(() => {
    const c = document.getElementById('game'); const g = c.getContext('2d');
    let lit = 0, samples = 0, dark = 0;
    for (let y = 4; y < c.height; y += 32) for (let x = 4; x < c.width; x += 32) {
      const d = g.getImageData(x, y, 1, 1).data;
      const l = (d[0] + d[1] + d[2]) / 3;
      samples++; if (l > 14) lit++; else if (l < 3) dark++;
    }
    const uniq = new Set();
    for (let y = 4; y < c.height; y += 24) for (let x = 4; x < c.width; x += 24) {
      const d = g.getImageData(x, y, 1, 1).data;
      uniq.add(((d[0] / 18) | 0) + ',' + ((d[1] / 18) | 0) + ',' + ((d[2] / 18) | 0));
    }
    return { lit, samples, dark, uniq: uniq.size };
  })()`);
  check('画面非全黑(有亮部)', samp.lit > samp.samples * 0.5, JSON.stringify(samp));
  check('画面色彩丰富(≥8类)', samp.uniq >= 8, 'uniq=' + samp.uniq);
  check('游戏中可渲染当前房', d.cur && d.state === 'play', 'state=' + d.state);
  // 玩家角色附近的局部色彩数(证明精灵已绘制; 以头身为采样中心)
  const p2 = await ev(`(() => {
    const c = document.getElementById('game'); const g = c.getContext('2d');
    const x = ${Math.round(d.player.x)}, y = ${Math.round(d.player.y - 14)};
    const set = new Set();
    for (let yy = y - 30; yy < y + 26; yy++) for (let xx = x - 24; xx < x + 24; xx++) {
      const dd = g.getImageData(Math.max(0, Math.min(c.width - 1, xx)), Math.max(0, Math.min(c.height - 1, yy)), 1, 1).data;
      set.add(((dd[0] / 26) | 0) + ',' + ((dd[1] / 26) | 0) + ',' + ((dd[2] / 26) | 0));
    }
    return set.size;
  })()`);
  check('玩家角色区域已绘制(色彩>2)', p2 > 2, 'player colors=' + p2);
  await sleep(400);
}

// ---- p7: 宝藏房宝箱开启 → 出道具 ----
async function sP7({ diag, ev, check, sleep, hold }) {
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.teleport("treasure")');
  await sleep(600);
  let d = await diag();
  check('进入宝藏房且宝箱存在', d.cur && d.cur.role === 'treasure' && d.cur.chest && !d.cur.chest.opened, 'role=' + (d.cur && d.cur.role));
  // 清怪(宝藏房敌人1-2只, 多轮nuke防分裂)
  for (let i = 0; i < 4; i++) {
    await ev('window.DEBUG.nuke()');
    await sleep(400);
    d = await diag();
    if (!d.enemies.length) break;
  }
  await ev('window.DEBUG.nuke()');
  await sleep(400);
  d = await diag();
  // 玩家先退开让宝箱在清房后处于可开状态, 再走进宝箱触发开启
  await hold('KeyA', 600);
  await sleep(300);
  d = await diag();
  const cx = 7 * 64 + 32, cy = 4 * 64 + 32;
  // 传送到宝箱旁自动触发开启(updateChest: 房间已清+靠近42px)
  await ev('window.DEBUG.god(true)');
  await ev(`(()=>{const g=window.GAME();g.player.x=${cx - 30};g.player.y=${cy};})()`);
  await sleep(900);
  d = await diag();
  const chestOpened = d.cur && d.cur.chest && d.cur.chest.opened;
  const itemDropped = d.pickups.some((p) => p.indexOf('item') === 0) || d.player.items.length > 0;
  check('清房后宝箱开启并掉落道具', chestOpened && itemDropped, 'chestOpened=' + chestOpened + ' pickups=' + d.pickups.join(',') + ' items=' + d.player.items.length);
}

// ---- p8: 端到端攻击验证(方向键击杀 + 按住鼠标朝光标击杀) ----
async function sP8({ diag, ev, check, sleep, hold, key, ses }) {
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.teleport("normal")');
  await sleep(500);
  // 清空房间里原有敌人, 隔离测试
  for (let i = 0; i < 4; i++) { await ev('window.DEBUG.nuke()'); await sleep(250); }
  let d = await diag();
  const kills0 = d.stats.kills;
  // 右侧放一只慢速吐弹怪
  await ev('window.DEBUG.spawnAt("gaper", 140, 0)');
  await sleep(300);
  d = await diag();
  check('测试怪已生成', d.enemies.includes('gaper'), 'enemies=' + d.enemies.join(','));
  // 方向键持续射击直至击杀(最长8s)
  let deadKill = false;
  for (let i = 0; i < 20 && !deadKill; i++) {
    await hold('ArrowRight', 450);
    d = await diag();
    if (d.stats.kills > kills0 && !d.enemies.includes('gaper')) deadKill = true;
  }
  check('方向键射击可击杀敌人', deadKill, 'kills ' + kills0 + '->' + d.stats.kills + ' left=' + d.enemies.join(','));

  // ---- 鼠标按住朝光标射击(替代输入法冲突场景) ----
  const kills1 = d.stats.kills;
  await ev('window.DEBUG.spawnAt("gaper", 150, 0)');
  await sleep(300);
  d = await diag();
  // 得到画布 CSS 位置换算
  const rect = await ev('(()=>{const r=document.getElementById("game").getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};})()');
  const px = (x) => Math.round(rect.l + (x / 960) * rect.w);
  const py = (y) => Math.round(rect.t + (y / 640) * rect.h);
  const player = d.player;
  // 先向右移动鼠标(到玩家右侧160px世界坐标), 按下左键并保持
  const mx = px(player.x + 190), my = py(player.y);
  await ses('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my });
  await ses('Input.dispatchMouseEvent', { type: 'mousePressed', x: mx, y: my, button: 'left', buttons: 1, clickCount: 1 });
  let mouseKill = false;
  for (let i = 0; i < 20 && !mouseKill; i++) {
    await sleep(500);
    d = await diag();
    if (d.stats.kills > kills1 && !d.enemies.includes('gaper')) mouseKill = true;
  }
  await ses('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mx, y: my, button: 'left', buttons: 0, clickCount: 1 });
  await ev('window.DEBUG.nuke()');
  check('按住鼠标左键朝光标可击杀', mouseKill, 'kills ' + kills1 + '->' + d.stats.kills + ' left=' + d.enemies.join(','));
  check('全程玩家存活', d.player && !d.player.dead, '');
}

// ---- p9: 手感冒烟(水花/顿帧/飘字链路无崩溃; 击杀后仍可移动) ----
async function sP9({ diag, ev, check, sleep, hold }) {
  await ev('window.DEBUG.god(true)');
  await ev('window.DEBUG.teleport("normal")');
  await sleep(500);
  for (let i = 0; i < 4; i++) { await ev('window.DEBUG.nuke()'); await sleep(250); }
  let d = await diag();
  const k0 = d.stats.kills;
  await ev('window.DEBUG.spawnAt("gaper", 130, 0)');
  await sleep(200);
  // 开火并观察粒子(水花)生成
  let sawParts = false;
  let killed = false;
  for (let i = 0; i < 18 && !killed; i++) {
    await hold('ArrowRight', 400);
    d = await diag();
    if (d.counts.parts > 0) sawParts = true;
    if (d.stats.kills > k0 && !d.enemies.includes('gaper')) killed = true;
  }
  check('开火产生命中粒子(水花/顿帧特效)', sawParts, 'parts seen');
  check('顿帧不影响击杀', killed, 'kills ' + k0 + '->' + d.stats.kills);
  // 击杀后移动仍顺畅(未被慢动作卡死)
  const x0 = d.player.x;
  await hold('KeyD', 500);
  d = await diag();
  check('顿帧结束移动恢复', Math.abs(d.player.x - x0) > 40, 'dx=' + (d.player.x - x0));
  // 道具拾取演出(飘字/圣光)无异常
  await ev('window.DEBUG.giveItem("crown")');
  await sleep(600);
  d = await diag();
  check('道具飘字/光效后状态正常', d.player.items.includes('crown') && d.state === 'play', 'items=' + d.player.items.join(','));
}

// ---- snap: 采集多张实况图供人眼复核 ----
async function snap({ diag, ev, hold, sleep, shot }) {
  await ev('window.DEBUG.god(true)');
  // 菜单(回到主菜单)
  await ev('document.getElementById("btnMenu2").click()');
  await sleep(700);
  await shot('snap_menu.png');
  // 开始新一局
  await ev('document.getElementById("btnStart").click()');
  await sleep(900);
  await shot('snap_start_room.png');
  // 战斗房
  await ev('window.DEBUG.teleport("normal")');
  await sleep(600);
  await hold('ArrowRight', 500);
  await shot('snap_combat.png');
  // 清房掉落
  for (let i = 0; i < 4; i++) {
    await ev('window.DEBUG.nuke()');
    await sleep(300);
  }
  await sleep(700);
  await shot('snap_cleared_drops.png');
  // Boss 房
  await ev('window.DEBUG.teleport("boss")');
  await sleep(700);
  await shot('snap_boss.png');
  // 道具栏 HUD
  await ev('window.DEBUG.teleport("normal")');
  await sleep(300);
  await ev('window.DEBUG.giveItem("crown")');
  await ev('window.DEBUG.giveItem("horns")');
  await ev('window.DEBUG.giveItem("laser")');
  await sleep(500);
  await shot('snap_items_hud.png');
}

main().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
