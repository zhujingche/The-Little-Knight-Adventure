// audio.js — WebAudio 合成音效 + 程序化 BGM(原声占位) + 用户自定义音乐替换
// 自定义音乐: 把 mp3 放入 assets/bgm/ 并命名为 bgm_1.mp3 / bgm_2.mp3 / bgm_3.mp3,
// 游戏会按 1→2→3→1 循环播放, 替换内置程序化占位 BGM。
let AC = null;
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let noiseBuf = null;
let muted = false;

export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.9; masterGain.connect(AC.destination);
    sfxGain = AC.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(masterGain);
    musicGain = AC.createGain(); musicGain.gain.value = 0.42; musicGain.connect(masterGain);
    // 噪声缓冲
    const len = AC.sampleRate * 1.0;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}

export function setMuted(m) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.9;
}
export function isMuted() { return muted; }

function env(g, t0, vol, a, dec, sus) {
  const g2 = g.gain;
  g2.cancelScheduledValues(t0);
  g2.setValueAtTime(0.0001, t0);
  g2.linearRampToValueAtTime(vol, t0 + a);
  g2.exponentialRampToValueAtTime(Math.max(0.0001, sus), t0 + a + dec);
  return g2;
}

function tone(freq, dur, { type = 'square', vol = 0.25, slide = 0, delay = 0, attack = 0.004, dec = 0, out = 'sfx' } = {}) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  const dest = out === 'music' ? musicGain : sfxGain;
  o.connect(g); g.connect(dest);
  env(g, t0, vol, attack, dec || dur * 0.9, 0.0001);
  o.start(t0); o.stop(t0 + dur + (dec || dur) + 0.1);
}

function noise(dur, { vol = 0.2, filter = 1200, q = 0.7, delay = 0, slide = 0, out = 'sfx' } = {}) {
  if (!AC || muted || !noiseBuf) return;
  const t0 = AC.currentTime + delay;
  const src = AC.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(filter, t0);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, filter + slide), t0 + dur);
  f.Q.value = q;
  const g = AC.createGain();
  const dest = out === 'music' ? musicGain : sfxGain;
  src.connect(f); f.connect(g); g.connect(dest);
  env(g, t0, vol, 0.004, dur * 0.9, 0.0001);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

// ---------- 音效 ----------
const sfxDefs = {
  shoot: () => { tone(720, 0.07, { type: 'triangle', vol: 0.16, slide: -260 }); noise(0.05, { vol: 0.05, filter: 3200 }); },
  laser: () => { tone(1500, 0.12, { type: 'sawtooth', vol: 0.1, slide: -900 }); },
  hit: () => { noise(0.08, { vol: 0.22, filter: 900 }); tone(180, 0.09, { type: 'square', vol: 0.14, slide: -60 }); },
  splash: () => { noise(0.05, { vol: 0.13, filter: 2600 }); tone(1050, 0.05, { type: 'triangle', vol: 0.08, slide: -420 }); },
  slash: () => { noise(0.14, { vol: 0.18, filter: 2400, slide: -1500 }); tone(940, 0.1, { type: 'triangle', vol: 0.13, slide: 520 }); },
  parry: () => { tone(1760, 0.09, { type: 'square', vol: 0.14, slide: 420 }); tone(2640, 0.07, { type: 'triangle', vol: 0.1, delay: 0.03 }); noise(0.05, { vol: 0.1, filter: 5200 }); },
  death: () => { tone(230, 0.5, { type: 'sawtooth', vol: 0.2, slide: -170 }); tone(450, 0.42, { type: 'triangle', vol: 0.15, slide: -320, delay: 0.05 }); noise(0.42, { vol: 0.2, filter: 480, slide: -320 }); },
  die: () => { noise(0.16, { vol: 0.25, filter: 700, slide: -500 }); tone(300, 0.16, { type: 'sawtooth', vol: 0.12, slide: -220 }); },
  hurt: () => { tone(130, 0.22, { type: 'square', vol: 0.26, slide: -80 }); noise(0.12, { vol: 0.2, filter: 600 }); },
  pickup: () => { tone(880, 0.08, { type: 'square', vol: 0.16 }); tone(1320, 0.1, { type: 'square', vol: 0.16, delay: 0.07 }); },
  heart: () => { tone(660, 0.07, { type: 'triangle', vol: 0.18 }); tone(990, 0.12, { type: 'triangle', vol: 0.18, delay: 0.06 }); },
  item: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.09 })); noise(0.1, { vol: 0.06, filter: 5000 }); },
  door: () => { noise(0.3, { vol: 0.3, filter: 300, slide: 120 }); tone(70, 0.3, { type: 'sine', vol: 0.3, slide: 30 }); },
  unlock: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.14, delay: i * 0.06 })); },
  chest: () => { tone(240, 0.1, { type: 'square', vol: 0.2, slide: 80 }); noise(0.06, { vol: 0.1, filter: 2000 }); },
  bossRoar: () => { tone(90, 0.7, { type: 'sawtooth', vol: 0.3, slide: -40 }); tone(60, 0.7, { type: 'sine', vol: 0.35, slide: -25, delay: 0.05 }); noise(0.5, { vol: 0.12, filter: 300 }); },
  slam: () => { noise(0.25, { vol: 0.4, filter: 240, slide: 90 }); tone(55, 0.25, { type: 'sine', vol: 0.4, slide: -20 }); },
  stairs: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.2, delay: i * 0.1 })); },
  win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.2, delay: i * 0.13 })); },
  ui: () => { tone(900, 0.05, { type: 'square', vol: 0.12 }); },
  step: () => { noise(0.04, { vol: 0.05, filter: 800 }); },
  explode: () => { noise(0.4, { vol: 0.4, filter: 500, slide: -300 }); tone(80, 0.3, { type: 'sine', vol: 0.3 }); },
};

export function sfx(name) {
  if (!AC) return;
  const f = sfxDefs[name];
  if (f) { try { f(); } catch (e) { } }
}

// ---------- 程序化 BGM(占位原创小调, 可用自定义音乐替换) ----------
const BGMS = [];
let bgmMode = 'procedural';   // 'procedural' | 'files'
let userBgm = [];
let currentFloorKey = 1;
let bossMode = false;
let seqTimer = null;
let seqStep = 0;
let nextNoteTime = 0;

// 黑暗地牢氛围音阶(每层不同小调)
const SCALES = {
  1: { root: 110, notes: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 7] },   // D 小调风
  2: { root: 98, notes: [0, 2, 3, 5, 7, 10, 12], chords: [0, 7, 5, 3] },    // 更压抑
  3: { root: 87.3, notes: [0, 1, 3, 5, 6, 8, 10], chords: [0, 3, 8, 6] },   // 炼狱感
};

const midi = (root, semis) => root * Math.pow(2, semis / 12);

function startSequencer() {
  if (!AC || seqTimer || bgmMode === 'files') return;
  stopSequencer();
  seqStep = 0; nextNoteTime = AC.currentTime + 0.1;
  seqTimer = setInterval(() => {
    if (!AC) return;
    const ahead = 0.18;
    while (nextNoteTime < AC.currentTime + ahead) {
      scheduleStep(seqStep, nextNoteTime);
      nextNoteTime += bossMode ? 0.09 : 0.19;
      seqStep = (seqStep + 1) % (bossMode ? 8 : 16);
    }
  }, 60);
}

function scheduleStep(step, t) {
  const S = SCALES[currentFloorKey] || SCALES[1];
  const spb = bossMode ? 0.09 : 0.19;
  // 低音根音长音
  const chordRoot = S.chords[Math.floor(step / 4) % S.chords.length];
  if (step % 4 === 0) {
    const r = midi(S.root, chordRoot);
    tone(r, spb * 3.4, { type: 'sine', vol: 0.62, out: 'music', delay: Math.max(0, t - AC.currentTime), attack: 0.02, dec: spb * 3 });
    // 暗黑五度
    tone(r * 1.5, spb * 3.4, { type: 'sine', vol: 0.34, out: 'music', delay: Math.max(0, t - AC.currentTime) });
  }
  // 稀疏琶音(随机走向的阴郁小调)
  if (step % 2 === 0 && Math.random() < (bossMode ? 1 : 0.6)) {
    const sc = S.notes;
    const base = S.root * 4;
    const idx = (sc.length + (Math.floor(step / 2) % sc.length) + Math.floor(Math.random() * 2) - 1) % sc.length;
    const semis = sc[idx];
    tone(midi(base, semis) * 2, spb * (bossMode ? 0.8 : 0.9), {
      type: 'triangle', vol: 0.3, out: 'music', delay: Math.max(0, t - AC.currentTime), attack: 0.01, dec: spb
    });
  }
  // 心跳鼓(Boss 紧张感 / 常规房间稀疏闷鼓)
  if (bossMode) {
    if (step % 2 === 0) noise(spb * 0.7, { vol: 0.3, filter: 160, out: 'music', delay: Math.max(0, t - AC.currentTime) });
    if (step % 8 === 4) noise(spb * 0.5, { vol: 0.18, filter: 900, out: 'music', delay: Math.max(0, t - AC.currentTime) });
  } else if (step % 8 === 4 && Math.random() < 0.5) {
    noise(spb * 1.1, { vol: 0.1, filter: 120, out: 'music', delay: Math.max(0, t - AC.currentTime) });
  }
}

export function stopSequencer() {
  if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
}

// 切换 BGM: floor=层数, boss=是否Boss战
export function setMusic(floor, boss = false) {
  if (!AC) return;
  currentFloorKey = floor; bossMode = boss;
  if (bgmMode === 'procedural') startSequencer();   // 幂等: 已在跑则忽略
  else if (!curAudioEl) playFile(userFiles[0] || BGM_NAMES[0]);
}
// 调试: 当前 BGM 状态(供自动化验证)
window.__aud = () => ({ music: bgmMode, seq: !!seqTimer, files: userFiles.length, floor: currentFloorKey, boss: bossMode });

// ---------- 自定义音乐(文件) ----------
// 关键: 自动播放策略要求 play() 必须发生在“用户手势的同一个调用栈”里,
// 所以这里提供 unlockUserBgm(): 由 main 在首次 pointerdown/keydown 中同步调用。
// 采用 <audio> 元素流式播放(边下边播), 不再整包 fetch, 手机上也几乎立刻出声。
const BGM_NAMES = ['assets/bgm/bgm_1.mp3', 'assets/bgm/bgm_2.mp3', 'assets/bgm/bgm_3.mp3'];
let userFiles = [];
let userIdx = 0;
let curAudioEl = null;
let curUrl = '';

function playFile(url) {
  if (!AC || !url) return Promise.resolve(false);
  if (curAudioEl) { try { curAudioEl.pause(); } catch (e) { } curAudioEl = null; }
  const el = new Audio(url);
  el.preload = 'auto';
  el.volume = 1;
  curAudioEl = el;
  curUrl = url;
  window.__bgm = Object.assign({}, window.__bgm || {}, { current: url, playing: false, error: null });
  el.addEventListener('playing', () => { bgmMode = 'files'; if (window.__bgm) window.__bgm.playing = true; stopSequencer(); });
  el.addEventListener('ended', () => {
    if (window.__bgm) window.__bgm.playing = false;
    curAudioEl = null;
    const list = userFiles.length ? userFiles : [url];
    userIdx = (userIdx + 1) % list.length;
    playFile(list[userIdx]);
  });
  el.addEventListener('error', () => { if (window.__bgm) window.__bgm.error = 'file-error'; });
  return el.play().then(() => { if (window.__bgm) window.__bgm.playing = true; return true; })
    .catch(() => { if (window.__bgm) window.__bgm.error = 'blocked-or-missing'; return false; });
}

// 必须同步在用户手势里调用: 立刻尝试播放第一个候选音乐文件
export function unlockUserBgm() {
  if (!AC) return;
  if (new URLSearchParams(location.search).get('nobgm') === '1') return;
  userIdx = 0;
  playFile(BGM_NAMES[0]).then((ok) => {
    if (!ok && bgmMode !== 'files') { bgmMode = 'procedural'; startSequencer(); }
  });
}

// 异步检测实际存在的自定义音乐(用 HEAD, 不下载整首), 用于排播放列表
export async function tryLoadUserBgm() {
  if (new URLSearchParams(location.search).get('nobgm') === '1') {
    window.__bgm = { found: false, files: [], ts: Date.now() };
    return false;
  }
  const found = [];
  for (const n of BGM_NAMES) {
    try {
      const r = await fetch(n, { method: 'HEAD' });
      if (r.ok) found.push(n);
    } catch (e) { /* 忽略缺失文件 */ }
  }
  if (found.length) {
    userFiles = found;
    console.log('[BGM] 检测到自定义音乐, 将循环播放:', found);
    window.__bgm = Object.assign({}, window.__bgm || {}, { found: true, files: found.slice() });
    // 若当前播放的不是列表第一首, 切到第一首
    if (curUrl !== found[0]) { userIdx = 0; playFile(found[0]); }
    return true;
  }
  window.__bgm = { found: false, files: [], ts: Date.now() };
  return false;
}

export { AC, sfxGain, musicGain };
