// art/pix.js — 硬像素精灵光栅器: 无抗锯齿 + 自动粗描边(以撒式黑描边暗黑卡通风)
// 所有图案在 1x1 像素网格上用图元(椭圆/矩形/点/环)描绘, 输出 canvas, 渲染时放大整数倍。
import { cached } from '../util.js';

export function hex2rgb(hex) {
  if (hex[0] === '#') hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export class PixBuf {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.n = w * h;
    this.r = new Uint8ClampedArray(this.n);
    this.g = new Uint8ClampedArray(this.n);
    this.b = new Uint8ClampedArray(this.n);
    this.a = new Uint8ClampedArray(this.n);
  }
  _i(x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return -1;
    return yi * this.w + xi;
  }
  _blend(i, [cr, cg, cb], alpha) {
    if (alpha >= 1) {
      this.r[i] = cr; this.g[i] = cg; this.b[i] = cb; this.a[i] = 255;
    } else if (alpha > 0) {
      const sa = alpha * 255;
      const da = this.a[i];
      const oa = sa + da * (1 - alpha);
      if (oa <= 0) return;
      this.r[i] = (cr * sa + this.r[i] * da * (1 - alpha)) / oa;
      this.g[i] = (cg * sa + this.g[i] * da * (1 - alpha)) / oa;
      this.b[i] = (cb * sa + this.b[i] * da * (1 - alpha)) / oa;
      this.a[i] = oa;
    }
  }
  set(x, y, hex, alpha = 1) {
    const i = this._i(x, y);
    if (i < 0) return;
    this._blend(i, hex2rgb(hex), alpha);
  }
  // 1x1..n 笔刷
  px(x, y, hex, alpha = 1, size = 1) {
    if (size <= 1) return this.set(x, y, hex, alpha);
    for (let dy = -size + 1; dy < size; dy++)
      for (let dx = -size + 1; dx < size; dx++)
        this.set(x + dx / 1, y + dy / 1, hex, alpha);
  }
  rect(x, y, w, h, hex, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++)
        this.set(xx, yy, hex, alpha);
  }
  // 实心椭圆 (rx/ry 可半像素, 内部数学判定 → 硬边缘)
  ellipse(cx, cy, rx, ry, hex, alpha = 1) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(xx, yy, hex, alpha);
      }
  }
  ring(cx, cy, rx, ry, hex, th = 1) {
    const x0 = Math.floor(cx - rx - th), x1 = Math.ceil(cx + rx + th);
    const y0 = Math.floor(cy - ry - th), y1 = Math.ceil(cy + ry + th);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1 && d <= 1 + th / Math.max(rx, ry)) this.set(xx, yy, hex);
      }
  }
  hline(x, y, len, hex, alpha = 1) { for (let i = 0; i < len; i++) this.set(x + i, y, hex, alpha); }
  vline(x, y, len, hex, alpha = 1) { for (let i = 0; i < len; i++) this.set(x, y + i, hex, alpha); }
  // 自动描边: 所有与透明像素相邻的不透明像素外缘被覆盖成 outline 色(四周黑框)
  outline(hex = '#0a0705', th = 1) {
    const out = new Set();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.a[i] > 0) continue;
        for (let dy = -th; dy <= th; dy++)
          for (let dx = -th; dx <= th; dx++) {
            if (!dx && !dy) continue;
            const jx = x + dx, jy = y + dy;
            if (jx < 0 || jy < 0 || jx >= this.w || jy >= this.h) continue;
            if (this.a[jy * this.w + jx] > 0) { out.add(y * this.w + x); break; }
          }
      }
    const [cr, cg, cb] = hex2rgb(hex);
    for (const i of out) { this.r[i] = cr; this.g[i] = cg; this.b[i] = cb; this.a[i] = 255; }
  }
  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.n; i++) {
      img.data[i * 4] = this.r[i];
      img.data[i * 4 + 1] = this.g[i];
      img.data[i * 4 + 2] = this.b[i];
      img.data[i * 4 + 3] = this.a[i];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

// 组合式精灵定义入口: key 缓存, draw(buf) 描绘, 返回放大整数倍前的 canvas
export function pixSprite(key, w, h, draw, outlineColor = '#0a0705') {
  return cached('art:' + key, () => {
    const b = new PixBuf(w, h);
    draw(b);
    b.outline(outlineColor, 1);
    return b.toCanvas();
  });
}

// 简单圆点精灵
export function dotSprite(key, size, hex, outline = true) {
  return pixSprite(key, size, size, (b) => {
    b.ellipse(size / 2, size / 2, size / 2 - 0.4, size / 2 - 0.4, hex);
  }, outline ? '#0a0705' : 'transparent');
}
