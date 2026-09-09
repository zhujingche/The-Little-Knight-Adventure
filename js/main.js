// main.js — 启动/主循环/界面/移动端控制
import { Game } from './engine/game.js';
import { input } from './input.js';
import { hud } from './ui/hud.js';
import { initAudio, sfx, setMuted, isMuted, setMusic, tryLoadUserBgm } from './audio.js';
import { fmtTime, drawSprite } from './util.js';
import { getKnight } from './art/player.js';
import { monsterFrame } from './art/monsters.js';
import { ITEM_MAP, applyItem } from './items.js';
import { CFG } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');
const $ = (id) => document.getElementById(id);

let game = null;
let appMode = 'menu';   // menu | play
let gameOver = false;
let lastT = performance.now();
const query = new URLSearchParams(location.search);

// ---------- 缩放适配(2倍超采样抗糊) ----------
const RENDER_SCALE = 2; // 画布内部超采样倍数
function fit() {
  const s = Math.min(window.innerWidth / CFG.VIEW_W, window.innerHeight / CFG.VIEW_H);
  viewport.style.transform = 'scale(' + s + ')';
  document.body.style.background = '#05050a';
  // 超采样分辨率: 内部像素 = 逻辑960x640 × RENDER_SCALE
  canvas.width = CFG.VIEW_W * RENDER_SCALE;
  canvas.height = CFG.VIEW_H * RENDER_SCALE;
}
window.addEventListener('resize', fit);
fit();

// ---------- HUD 初始化 ----------
hud.init();

// ---------- 界面切换 ----------
const screens = {
  menu: $('screen-menu'), pause: $('screen-pause'),
  death: $('screen-death'), win: $('screen-win'),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  if (name) screens[name].classList.remove('hidden');
}

// ---------- 鼠标瞄准(换算到世界坐标; 画布被CSS缩放) ----------
function canvasWorldPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = CFG.VIEW_W / r.width, sy = CFG.VIEW_H / r.height;
  return {
    x: Math.max(0, Math.min(CFG.VIEW_W, (clientX - r.left) * sx)),
    y: Math.max(0, Math.min(CFG.VIEW_H, (clientY - r.top) * sy)),
  };
}
function handleMouseMove(e) {
  const w = canvasWorldPos(e.clientX, e.clientY);
  input.setMouse(w.x, w.y);
}
function handleMouseDown(e) {
  const w = canvasWorldPos(e.clientX, e.clientY);
  input.setMouse(w.x, w.y);
  input.setMouseDown(true);
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { } }
  e.preventDefault();
}
canvas.addEventListener('pointermove', handleMouseMove);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('pointerdown', handleMouseDown);
canvas.addEventListener('mousedown', handleMouseDown);
window.addEventListener('pointerup', () => input.setMouseDown(false));
window.addEventListener('mouseup', () => input.setMouseDown(false));
canvas.addEventListener('pointercancel', () => input.setMouseDown(false));
canvas.addEventListener('mouseleave', () => { if (canvas.matches(':active')) return; input.setMouseDown(false); });

// ---------- 音频解锁 ----------
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = initAudio();
  if (audioUnlocked) {
    tryLoadUserBgm();
    if (appMode === 'play') setMusic(game ? game.floorIdx : 1);
  }
}
window.addEventListener('pointerdown', unlockAudio, { once: false });
window.addEventListener('keydown', unlockAudio, { once: false });

// ---------- 音效开关 ----------
$('btnAudio').addEventListener('click', () => {
  setMuted(!isMuted());
  $('btnAudio').textContent = '音效: ' + (isMuted() ? '关' : '开');
  sfx('ui');
});

// ---------- 主菜单按钮 ----------
function toMenu() {
  game = null;
  appMode = 'menu';
  gameOver = false;
  hud.showGameUI(false);
  showScreen('menu');
}
$('btnStart').addEventListener('click', () => { sfx('ui'); startGame(); });
$('btnMenu2').addEventListener('click', () => { sfx('ui'); toMenu(); });
$('btnMenu3').addEventListener('click', () => { sfx('ui'); toMenu(); });
$('btnRetry').addEventListener('click', () => { sfx('ui'); startGame(); });
$('btnAgain').addEventListener('click', () => { sfx('ui'); startGame(); });
$('btnResume').addEventListener('click', () => { sfx('ui'); if (game) game.paused = false; showScreen(null); });
$('btnRestartP').addEventListener('click', () => { sfx('ui'); startGame(); });
$('btnQuitP').addEventListener('click', () => { sfx('ui'); toMenu(); });
$('btnHelp').addEventListener('click', () => {
  $('helpBox').classList.toggle('hidden');
  sfx('ui');
});

function startGame() {
  if (!game) game = new Game(canvas);
  hud.setItems({ items: [] });
  hud.showGameUI(true);
  gameOver = false;
  showScreen(null);
  appMode = 'play';
  game.paused = false;
  game.startRun();
  // 把焦点让给画布, 保证键盘(方向键)立刻生效
  try { canvas.focus(); } catch (e) { }
  if (audioUnlocked) setMusic(game.floorIdx);
}

// ---------- 统计展示 ----------
function fillStats(prefix, st) {
  $(prefix + 'Kills').textContent = st.kills;
  $(prefix + 'Items').textContent = st.items;
  $(prefix + 'Time').textContent = fmtTime(st.time);
  $(prefix + 'Rooms').textContent = st.rooms;
  $(prefix + 'Tears').textContent = st.tears;
  const f = $('dFloor');
  if (f) f.textContent = st.floor + '层';
}
function showDeath() {
  gameOver = true;
  fillStats('d', game.stats);
  showScreen('death');
  sfx('hurt');
}
function showWin() {
  gameOver = true;
  fillStats('w', game.stats);
  showScreen('win');
}

// ---------- 菜单背景绘制 ----------
const menuCanvas = $('menuCanvas');
const mg = menuCanvas.getContext('2d');
menuCanvas.width = CFG.VIEW_W * 2;
menuCanvas.height = CFG.VIEW_H * 2;
let menuT = 0;
function drawMenu() {
  menuT += 1 / 60;
  mg.setTransform(2, 0, 0, 2, 0, 0);
  mg.imageSmoothingEnabled = false;
  mg.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  // 地板
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 15; x++) {
      mg.fillStyle = ((x * 7 + y * 13) & 3) === 0 ? '#4a3728' : '#53402f';
      mg.fillRect(x * 64, y * 64, 64, 64);
      if (((x * 3 + y * 5) % 5) === 0) { mg.fillStyle = '#43301f'; mg.fillRect(x * 64 + 20, y * 64 + 30, 3, 3); }
    }
  mg.fillStyle = 'rgba(0,0,0,0.45)';
  mg.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  // 角色剪影
  drawMenuSprite();
  // 火把光
  mg.globalCompositeOperation = 'lighter';
  const flick = 0.5 + Math.sin(menuT * 8) * 0.15;
  for (const [lx, ly] of [[90, 380], [870, 380]]) {
    const gr = mg.createRadialGradient(lx, ly, 4, lx, ly, 150);
    gr.addColorStop(0, 'rgba(255,170,80,' + (0.25 * flick) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = gr;
    mg.fillRect(lx - 150, ly - 150, 300, 300);
  }
  mg.globalCompositeOperation = 'source-over';
  const vg = mg.createRadialGradient(480, 320, 160, 480, 320, 700);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  mg.fillStyle = vg;
  mg.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
}
function drawMenuSprite() {
  const bob = Math.sin(menuT * 2.2) * 4;
  const bob2 = Math.sin(menuT * 3.1) * 6;
  // 主角(左, 巨大)
  mg.fillStyle = 'rgba(0,0,0,0.4)';
  mg.beginPath(); mg.ellipse(250, 440, 46, 16, 0, 0, 7); mg.fill();
  const kf = getKnight({ x: 1, y: 0 });
  drawSprite(mg, kf.s, 250, 420 + bob, 2, false);
  // 咕噜怪
  mg.fillStyle = 'rgba(0,0,0,0.4)';
  mg.beginPath(); mg.ellipse(610, 452, 34, 12, 0, 0, 7); mg.fill();
  drawSprite(mg, monsterFrame('gaper', menuT), 610, 436 + bob, 1.3, false);
  // 苍蝇环绕
  drawSprite(mg, monsterFrame('fly', menuT * 1.4), 520 + Math.sin(menuT * 2) * 40, 300 + bob2, 1, false);
  drawSprite(mg, monsterFrame('fly', menuT * 1.4 + 3), 700 + Math.cos(menuT * 1.7) * 36, 260 + Math.sin(menuT * 2.6) * 30, 1, false);
  // 大眼魔王(后景剪影)
  mg.globalAlpha = 0.5;
  const hop = monsterFrame('fly', menuT);
  drawSprite(mg, hop, 810, 470 + bob, 1, false);
  mg.globalAlpha = 1;
  // 漂动光点
  mg.fillStyle = 'rgba(255,240,200,0.5)';
  for (let i = 0; i < 8; i++) {
    const a = menuT * 0.4 + i * 1.7;
    mg.globalAlpha = 0.3 + Math.sin(menuT * 2 + i) * 0.2;
    mg.beginPath(); mg.arc(120 + i * 96 + Math.sin(a) * 14, 130 + Math.sin(menuT + i * 2) * 22, 2.4, 0, 7); mg.fill();
  }
  mg.globalAlpha = 1;
}

// ---------- 主循环 ----------
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (appMode === 'menu') drawMenu();

  if (game && appMode === 'play') {
    // 暂停键
    if (input.pause() && !gameOver) {
      game.paused = !game.paused;
      showScreen(game.paused ? 'pause' : null);
      sfx('ui');
    }
    if (input.pressedCode('KeyR') && gameOver) { startGame(); }
    if (!game.paused) game.tick(dt);
    game.draw();
    // 结束检测
    if (!gameOver && game.state === 'dead') showDeath();
    if (!gameOver && game.state === 'win') showWin();
    // FPS
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) {
      const el = $('fps');
      if (showFps) el.textContent = Math.round(fpsN / fpsAcc) + ' fps';
      fpsAcc = 0; fpsN = 0;
    }
  }
  if (input.pressedCode('KeyF')) {
    showFps = !showFps;
    $('fps').classList.toggle('hidden', !showFps);
  }
  input.clearFrame();
  requestAnimationFrame(loop);
}

let fpsAcc = 0, fpsN = 0, showFps = false;

// ---------- 移动端虚拟控制 ----------
function enableTouch() {
  const tu = $('touchui');
  tu.classList.remove('hidden');
  // 把一套十字键绑定到指定虚拟按键
  function bindPad(root, map) {
    root.querySelectorAll('.fbtn').forEach(b => {
      const set = (on, e) => {
        input.vDir(map[b.dataset.dir], on);
        b.classList.toggle('pressed', on);
        if (e) { try { b.setPointerCapture(e.pointerId); } catch (err) { } }
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true, e); });
      b.addEventListener('pointerup', (e) => set(false, e));
      b.addEventListener('pointercancel', (e) => set(false, e));
      b.addEventListener('pointerleave', (e) => set(false, e));
    });
  }
  // 左下: 移动(WASD); 右下: 射击(方向键)
  bindPad($('movePad'), { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' });
  bindPad($('firePad'), { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' });

  // 防误触菜单
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (coarse || 'ontouchstart' in window) enableTouch();
else if (query.get('mobile') === '1') enableTouch();   // 调试: 桌面强制启用触屏控制

// ---------- 启动 ----------
showScreen('menu');
if (query.get('auto') === '1') {
  setTimeout(() => { startGame(); }, 300);
}
requestAnimationFrame(loop);

// 调试句柄(供自动化测试 / 试玩验证使用)
window.GAME = () => game;
window.START = startGame;
window.DEBUG = {
  teleport(role) {
    if (!game) return;
    const room = game.rooms.find(r => r.role === role);
    if (!room) return;
    game.currentRoom.sealed = false;
    game.enemies = [];
    game.enterRoom(room.idx, { x: 7 * CFG.TILE + 32, y: 4 * CFG.TILE + 32 }, null);
  },
  nuke() {
    if (!game) return;
    for (const e of game.enemies.slice()) if (!e.dead) e.hurt(1e9, 0, game);
    if (game.boss && !game.boss.dead) game.boss.hurt(1e9, 0, game);
  },
  god(on) { if (game && game.player) game.player.god = !!on; },
  heal() { if (game && game.player) { game.player.hp = game.player.maxHp; game.hpDirty = true; } },
  giveItem(id) {
    if (!game) return;
    const it = ITEM_MAP.get(id);
    if (it) applyItem(game, it);
  },
  killBoss() {
    if (!game || !game.boss || game.boss.dead) return;
    game.boss.hurt(1e9, 0, game);
  },
  spawnAt(kind, dx, dy) {
    if (!game || !game.player) return;
    game.spawnEnemyAt(kind, game.player.x + (dx | 0), game.player.y + (dy | 0));
  },
  setFloor(n) {
    if (!game) return;
    game.floorIdx = Math.max(1, Math.min(3, n | 0));
    game.buildFloor();
  },
  diag() { return game ? game.diag() : null; },
};
