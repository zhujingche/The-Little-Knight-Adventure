// 小骑士的探险 — 数学/工具/像素画基元

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rnd(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const sign = (v) => v < 0 ? -1 : (v > 0 ? 1 : 0);

// 可复现随机(地牢生成用)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 任意种子随机源
export class Rng {
  constructor(seed) { this.f = mulberry32(seed); }
  float(a = 1, b) { return b === undefined ? this.f() * a : a + this.f() * (b - a); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
}

// ---- 像素画工具 ----
// rows: string[], 每个字符对应调色板一种颜色; '.' 透明
// pal:  { char: '#rrggbb' }
export function buildPixels(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y] || '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      const col = pal[ch];
      const i = (y * w + x) * 4;
      if (!col) { img.data[i + 3] = 0; continue; }
      const n = parseInt(col.slice(1), 16);
      img.data[i] = (n >> 16) & 255;
      img.data[i + 1] = (n >> 8) & 255;
      img.data[i + 2] = n & 255;
      img.data[i + 3] = col.length === 7 ? 255 : parseInt(col.slice(7), 16);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// 缓存单例精灵
const spriteCache = new Map();
export function cached(key, make) {
  let c = spriteCache.get(key);
  if (!c) { c = make(); spriteCache.set(key, c); }
  return c;
}

// 把像素 canvas 按整数倍放大(硬像素)
export function upscale(src, factor, key) {
  return cached((key || 'up:') + factor, () => {
    const c = document.createElement('canvas');
    c.width = src.width * factor; c.height = src.height * factor;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  });
}

// 以像素风绘制 canvas 精灵(自动缩放到整数倍)
export function drawSprite(ctx, sprite, x, y, scale = 1, flipX = false, flipY = false, rot = 0, alpha = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  const s = CFG_SPR_SCALE_G * scale;
  const w = sprite.width * s, h = sprite.height * s;
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}
// 供 drawSprite 使用的缩放(避免循环依赖, 由 main 注入)
export let CFG_SPR_SCALE_G = 3;
export function setGlobalSpriteScale(v) { CFG_SPR_SCALE_G = v; }

// 简单画一块纯色像素圆(特效用)
export function pxCircle(r, fill, key) {
  return cached('pxc:' + r + ':' + fill + (key || ''), () => {
    const d = Math.max(1, Math.ceil(r * 2));
    const c = document.createElement('canvas'); c.width = d; c.height = d;
    const g = c.getContext('2d');
    g.fillStyle = fill;
    g.beginPath(); g.arc(d / 2, d / 2, r, 0, TAU); g.fill();
    return c;
  });
}

export function cssVarColor() { /* noop for future */ }

// 简易计时格式化
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// 圆形实体移动+格碰撞(轴分离)。solidAt(cx,cy) 判定某格是否实心。
// 返回 {x,y,hitX,hitY}
export function moveCircle(px, py, r, vx, vy, dt, solidAt) {
  const T = 64;
  const cell = (v) => Math.floor(v / T);
  const isSolid = (x, y) => {
    const x0 = cell(x - r), x1 = cell(x + r), y0 = cell(y - r), y1 = cell(y + r);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        if (solidAt(cx, cy)) return true;
    return false;
  };
  let nx = px, ny = py, hitX = false, hitY = false;
  // X 轴
  nx = px + vx * dt;
  if (isSolid(nx, py)) {
    if (vx > 0) nx = cell(nx + r) * T - r - 0.01;
    else if (vx < 0) nx = (cell(nx - r) + 1) * T + r + 0.01;
    else {
      // 静止被卡: 推回最近可用侧
      nx = px;
      const left = cell(nx - r) * T + r, right = (cell(nx + r) + 1) * T - r;
      nx = (nx - left) < (right - nx) ? left : right;
    }
    hitX = true;
  }
  // Y 轴
  ny = py + vy * dt;
  if (isSolid(nx, ny)) {
    if (vy > 0) ny = cell(ny + r) * T - r - 0.01;
    else if (vy < 0) ny = (cell(ny - r) + 1) * T + r + 0.01;
    else {
      ny = py;
      const top = cell(ny - r) * T + r, bot = (cell(ny + r) + 1) * T - r;
      ny = (ny - top) < (bot - ny) ? top : bot;
    }
    hitY = true;
  }
  return { x: nx, y: ny, hitX, hitY };
}

// 2D vector
export class Vec { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }

export function dpr(ctx) { return 1; }
