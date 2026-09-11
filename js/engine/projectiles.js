// projectiles.js — 圣泪(玩家弹)与敌人弹; 具备以撒式强化字段
import { drawSprite } from '../util.js';
import { tearSprite, bladeSprite } from '../art/world.js';

export class Projectile {
  constructor(opts) {
    this.x = opts.x; this.y = opts.y;
    this.vx = opts.vx; this.vy = opts.vy;
    this.dmg = opts.dmg;
    this.blade = !!opts.blade;           // 骨钉光刃(斩击波)
    this.size = opts.size || 1;          // 视觉/判定缩放
    this.radius = (opts.radius || 5.5) * (this.blade ? 1 : 1);
    this.big = !!opts.big;               // 巨型圣泪(更大/更重)
    this.crit = !!opts.crit;             // 暴击(金色)
    this.range = opts.range || 420;      // 飞行距离上限(px)
    this.traveled = 0;
    this.enemy = !!opts.enemy;           // 敌人弹?
    this.color = opts.color || (this.enemy ? 'R' : 'W');
    // 强化
    this.pierce = !!opts.pierce;
    this.homing = !!opts.homing;
    this.spectral = !!opts.spectral;     // 穿墙
    this.burn = !!opts.burn;
    this.split = !!opts.split;
    this.laser = !!opts.laser;           // 激光(非普通弹, 由game处理)
    this.hitSet = new Set();
    this.dead = false;
    this.t = 0;
    this.prevX = opts.x; this.prevY = opts.y;
    this.owner = opts.owner || null;
  }
  update(dt) {
    if (this.dead) return;
    this.prevX = this.x; this.prevY = this.y;
    // 追踪
    if (this.homing && this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const cur = Math.atan2(this.vy, this.vx);
      const want = Math.atan2(dy, dx);
      let da = want - cur;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const turn = Math.max(-6.5, Math.min(6.5, da));
      const a = cur + turn * dt;
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.traveled += Math.hypot(this.vx, this.vy) * dt;
    this.t += dt;
    if (this.traveled > this.range) this.dead = true;
  }
  draw(g) {
    if (this.blade) {
      const ang = Math.atan2(this.vy, this.vx);
      const prog = Math.max(0, Math.min(1, this.traveled / this.range));
      const sc = (0.95 + prog * 0.75) * (this.size || 1);
      const alpha = prog > 0.75 ? (1 - prog) / 0.25 : 1;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = 22 * sc;
      const glow = g.createRadialGradient(this.x, this.y, 1, this.x, this.y, gr);
      glow.addColorStop(0, 'rgba(150,225,255,0.34)');
      glow.addColorStop(1, 'rgba(60,140,255,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(this.x, this.y, gr, 0, Math.PI * 2); g.fill();
      g.restore();
      drawSprite(g, bladeSprite(), this.x, this.y, sc, false, false, ang, alpha);
      return;
    }
    const sp = tearSprite(this.color);
    // 残影
    g.globalAlpha = 0.22;
    drawSprite(g, sp, this.prevX, this.prevY, this.big ? 0.95 : 0.6, false, false, 0, 0.25);
    g.globalAlpha = 1;
    // 自身(带微光)
    const gr = this.big ? 24 : 16;
    const glow = g.createRadialGradient(this.x, this.y, 1, this.x, this.y, gr);
    glow.addColorStop(0, this.enemy ? 'rgba(255,120,90,0.3)' : (this.crit ? 'rgba(255,214,120,0.36)' : 'rgba(190,225,255,0.3)'));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(this.x - gr, this.y - gr, gr * 2, gr * 2);
    drawSprite(g, sp, this.x, this.y, this.big ? 1.15 : 0.72);
    if (this.crit) {
      drawSprite(g, tearSprite('F'), this.x, this.y, this.big ? 1.25 : 0.82);
    }
    if (this.burn) {
      drawSprite(g, tearSprite('F'), this.x, this.y, (this.big ? 1.25 : 0.8));
    }
  }
}
