// particles.js — 轻量粒子系统(血溅/烟尘/闪光/泪花)
export class Particles {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  spawn(p) { this.list.push(p); }
  // 便捷生成
  blood(x, y, dirAngle = 0, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = dirAngle + (Math.random() - 0.5) * 1.6;
      const sp = 40 + Math.random() * 110;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.3, t: 0,
        size: 1.5 + Math.random() * 2.2, color: Math.random() < 0.7 ? '#a81f16' : '#7c120c',
        grav: 260, fade: true, kind: 'dot',
      });
    }
  }
  puff(x, y, color, n = 8, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 60;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.4 + Math.random() * 0.3, t: 0,
        size: size * (0.6 + Math.random() * 0.8), color, grav: 40, fade: true, kind: 'dot',
      });
    }
  }
  ring(x, y, color, size = 6) {
    this.spawn({ x, y, vx: 0, vy: 0, life: 0.3, t: 0, size, color, kind: 'ring', fade: true });
  }
  dust(x, y) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 8, y: y + 6,
      vx: (Math.random() - 0.5) * 24, vy: -14 - Math.random() * 10,
      life: 0.28, t: 0, size: 1.5 + Math.random() * 1.4,
      color: 'rgba(150,120,90,0.5)', grav: 0, fade: true, kind: 'dot',
    });
  }
  sparkle(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 90;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.2, t: 0, size: 1.4, color, grav: 60, fade: true, kind: 'dot',
      });
    }
  }
  // 圣泪水花(命中敌人/墙壁时的小液滴四溅)
  splash(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const sp = 46 + Math.random() * 90;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.24, t: 0,
        size: 1.3 + Math.random() * 1.8, color, grav: 320, fade: true, kind: 'dot',
      });
    }
  }
  // 红心碎片(死亡演出)
  heartShards(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 90 + Math.random() * 220;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.5, t: 0,
        size: 2.4 + Math.random() * 3, color: Math.random() < 0.5 ? '#c93026' : '#8e1512',
        grav: 380, fade: true, kind: 'dot',
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        life: 0.5 + Math.random() * 0.4, t: 0, size: 4.5,
        color: '#fff2e0', grav: 60, fade: true, kind: 'dot',
      });
    }
  }
  // 飘字
  text(x, y, txt, color = '#fff', life = 1.1, size = 11) {
    this.spawn({ x, y, vx: 0, vy: -44, life, t: 0, txt, color, size, kind: 'text', fade: true });
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.t += dt;
      if (p.t >= p.life) { l.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vx !== undefined) p.vx *= (1 - 1.6 * dt);
    }
  }
  draw(g) {
    for (const p of this.list) {
      const k = p.t / p.life;
      const alpha = p.fade ? 1 - k : 1;
      g.globalAlpha = Math.max(0, alpha);
      if (p.kind === 'ring') {
        g.strokeStyle = p.color;
        g.lineWidth = 2.5 * (1 - k) + 0.5;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.5 + k * 2.2), 0, Math.PI * 2);
        g.stroke();
      } else if (p.kind === 'text') {
        const gr = (1 - k);
        g.fillStyle = p.color;
        g.font = (p.size || 11) + 'px "Press Start 2P", monospace';
        g.textAlign = 'center';
        g.globalAlpha = Math.max(0, alpha);
        g.shadowColor = 'rgba(0,0,0,0.9)';
        g.shadowBlur = 4;
        g.fillText(p.txt, Math.round(p.x), Math.round(p.y));
        g.shadowBlur = 0;
      } else {
        g.fillStyle = p.color;
        const s = p.size * (p.kind === 'dot' ? 1 - k * 0.3 : 1);
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.5, s), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}
