// boss.js — Boss 实体: 大眼魔王(弹跳) & 深渊大骑士(冲刺/召唤/弹幕)
import { CFG } from '../config.js';
import { moveCircle, drawSprite, angleTo } from '../util.js';
import { hopBossSprites, knightBossSprites } from '../art/boss.js';
import { Projectile } from '../engine/projectiles.js';
import { sfx } from '../audio.js';

const T = CFG.TILE;

export class Boss {
  constructor(kind, x, y, game, opts = {}) {
    this.kind = kind; // 'hop' | 'knight'
    this.tier = opts.tier || (kind === 'hop' ? 1 : 3);
    this.game = game;
    this.x = x; this.y = y;
    this.r = kind === 'hop' ? 20 : 17;
    this.hp = opts.hp || (kind === 'hop' ? 210 : 380);
    this.maxHp = this.hp;
    this.dead = false;
    this.t = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.hitFlash = 0;
    this.ang = 0;
    this.targetX = x; this.targetY = y;
    this.speedMul = opts.speedMul || 1;
    this.vx = 0; this.vy = 0;
    this.enraged = false;
    this.burnT = 0;
    this.kbRes = 0.12;
  }
  get halfHp() { return Math.max(0, this.hp / this.maxHp); }

  hurt(dmg, ang, game) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    const kb = 40 * this.kbRes;
    this.vx += Math.cos(ang) * kb;
    this.vy += Math.sin(ang) * kb;
    game.parts.blood(this.x, this.y, ang, 5);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      game.onBossKilled(this);
    }
  }

  aim(game, a, dmg, speed = 220, color = 'G', n = 1, spread = 0) {
    const base = n === 1 ? [a] : Array.from({ length: n }, (_, i) => a + (i - (n - 1) / 2) * spread);
    for (const aa of base) {
      const p = new Projectile({
        x: this.x, y: this.y - 6,
        vx: Math.cos(aa) * speed, vy: Math.sin(aa) * speed,
        dmg, radius: 5.6, range: 900, enemy: true, color,
      });
      game.eTears.push(p);
    }
  }
  radial(game, n, dmg, speed = 180, offset = 0, color = 'G') {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2;
      const p = new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        dmg, radius: 5.6, range: 800, enemy: true, color,
      });
      game.eTears.push(p);
    }
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.burnT > 0) {
      this.burnT -= dt;
      this._burnTick = (this._burnTick || 0) - dt;
      if (this._burnTick <= 0) {
        this._burnTick = 0.5;
        this.hurt(3, Math.random() * 6.28, game);
        game.parts.sparkle(this.x + (Math.random() - 0.5) * 30, this.y - 10, '#ff8a30', 3);
      }
    }
    if (this.kind === 'hop') this.aiHop(dt, game);
    else this.aiKnight(dt, game);
    this.vx *= Math.pow(0.01, dt);
    this.vy *= Math.pow(0.01, dt);
  }

  // 通用移动(落地/冲刺碰撞)
  moveBy(dt, game, vx, vy) {
    const room = game.currentRoom;
    const mv = moveCircle(this.x, this.y, this.r * 0.9, vx, vy, dt, (cx, cy) => room.solid(cx, cy));
    this.x = mv.x; this.y = mv.y;
  }

  // ================= 大眼魔王(跳砸) =================
  aiHop(dt, game) {
    const p = game.player;
    if (!p || p.dead) return;
    const enraged = this.halfHp < 0.5;
    this.enraged = enraged;
    switch (this.state) {
      case 'idle': {
        this.stateT -= dt;
        // 缓慢挪近 / 保持距离
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = this.speedMul * (enraged ? 85 : 62);
        if (d > 330) this.moveBy(dt, game, dx / d * sp, dy / d * sp);
        else if (d < 170) this.moveBy(dt, game, -dx / d * sp * 0.5, -dy / d * sp * 0.5);
        if (this.stateT <= 0) {
          if (enraged && Math.random() < 0.4) {
            // 弹幕阶段: 对准玩家扇形喷吐
            this.aim(game, angleTo(this.x, this.y, p.x, p.y), 1.5, 240, 'G', 7, 0.16);
            this.state = 'volley'; this.stateT = 0.9;
          } else {
            // 起跳瞄准玩家附近
            const jx = p.x + (Math.random() - 0.5) * 150;
            const jy = p.y + (Math.random() - 0.5) * 150;
            this.targetX = Math.max(80, Math.min(CFG.VIEW_W - 80, jx));
            this.targetY = Math.max(80, Math.min(CFG.VIEW_H - 80, jy));
            this.state = 'telegraph'; this.stateT = enraged ? 0.42 : 0.6;
          }
        }
        break;
      }
      case 'volley': {
        this.stateT -= dt;
        if (this.stateT <= 0) { this.state = 'idle'; this.stateT = 0.7; }
        break;
      }
      case 'telegraph': {
        this.stateT -= dt;
        // 起跳, 空中 0.5s
        if (this.stateT <= 0) { this.state = 'air'; this.stateT = 0.5; this.vx = 0; }
        break;
      }
      case 'air': {
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.x = this.targetX; this.y = this.targetY;
          this.slam(game, enraged ? 130 : 100);
          this.state = 'rest'; this.stateT = enraged ? 0.6 : 0.95;
        }
        break;
      }
      case 'rest': {
        this.stateT -= dt;
        if (this.stateT <= 0) { this.state = 'idle'; this.stateT = 0.15; }
        break;
      }
    }
  }

  slam(game, radius) {
    sfx('slam');
    game.shake(9);
    game.parts.ring(this.x, this.y, '#ff9a6a', radius * 0.5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      game.parts.spawn({
        x: this.x, y: this.y, vx: Math.cos(a) * (140 + Math.random() * 120), vy: Math.sin(a) * (140 + Math.random() * 120),
        life: 0.45, t: 0, size: 3 + Math.random() * 4, color: Math.random() < 0.6 ? '#7c4a30' : '#a86a44', grav: 300, fade: true, kind: 'dot',
      });
    }
    const p = game.player;
    if (!p || p.dead) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d < radius + p.radius) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      p.takeDamage(4, a, game);
    }
  }

  // ================= 深渊大骑士 =================
  aiKnight(dt, game) {
    const p = game.player;
    if (!p || p.dead) return;
    const enraged = this.halfHp < 0.4;
    if (enraged && !this.enraged) { this.enraged = true; this.radial(game, 18, 1, 170, Math.random()); sfx('bossRoar'); }
    this.enraged = enraged;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.spawnCd = (this.spawnCd || 0) - dt;
    this.shootCd = (this.shootCd || 0) - dt;
    this.novaCd = (this.novaCd || 0) - dt;

    switch (this.state) {
      case 'idle': {
        const sp = this.speedMul * (enraged ? 105 : 82);
        this.moveBy(dt, game, ux * sp, uy * sp);
        this.stateT -= dt;
        // 召唤小兵
        if (this.spawnCd <= 0 && d > 60) {
          this.spawnCd = enraged ? 4 : 6.5;
          const adds = game.enemies.filter(e => !e.dead).length;
          if (adds < (enraged ? 4 : 3)) {
            for (let i = 0; i < (enraged ? 2 : 1); i++) {
              const a = Math.random() * Math.PI * 2;
              const sx = Math.max(40, Math.min(CFG.VIEW_W - 40, this.x + Math.cos(a) * 90));
              const sy = Math.max(40, Math.min(CFG.VIEW_H - 40, this.y + Math.sin(a) * 90));
              game.spawnEnemyAt(enraged ? 'imp' : 'skelly', sx, sy);
            }
            game.parts.ring(this.x, this.y, '#c060a0', 40);
            sfx('bossRoar');
            this.state = 'roar'; this.stateT = 0.7;
          }
        }
        // 冲刺
        if (this.state === 'idle' && this.stateT <= 0) {
          this.state = 'dashTele'; this.stateT = enraged ? 0.34 : 0.5;
          this.dashA = Math.atan2(uy, ux);
        }
        break;
      }
      case 'roar': {
        this.stateT -= dt;
        if (this.stateT <= 0) this.state = 'idle';
        break;
      }
      case 'dashTele': {
        // 蓄力预警(红线)
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.state = 'dash';
          this.stateT = enraged ? 0.5 : 0.65;
        }
        break;
      }
      case 'dash': {
        const sp = this.speedMul * (enraged ? 620 : 500);
        this.moveBy(dt, game, Math.cos(this.dashA) * sp, Math.sin(this.dashA) * sp);
        // 冲刺沿途剑气残影
        if (Math.random() < 0.3) game.parts.sparkle(this.x, this.y, '#9fd8ff', 1);
        this.stateT -= dt;
        if (this.stateT <= 0) { this.state = 'idle'; this.stateT = enraged ? 0.25 : 0.6; }
        break;
      }
      case 'idle': break;
    }
    // 远程三向与环形弹幕(独立冷却)
    if (this.shootCd <= 0 && this.state !== 'dash') {
      this.shootCd = enraged ? 1.5 : 2.3;
      this.aim(game, angleTo(this.x, this.y, p.x, p.y), 1.6, enraged ? 260 : 230, 'G', 3, 0.17);
    }
    if (this.novaCd <= 0 && this.state !== 'dashTele') {
      this.novaCd = enraged ? 5 : 8;
      this.radial(game, enraged ? 26 : 20, 1.1, enraged ? 200 : 175, Math.random());
    }
  }

  draw(g) {
    if (this.dead) return;
    const bob = Math.sin(this.t * 3) * 1.5;
    // 阴影(空中时变小)
    const air = this.state === 'air' || this.state === 'dash';
    g.fillStyle = air ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)';
    const shS = air ? 0.55 : 1;
    g.beginPath(); g.ellipse(this.x, this.y + (this.kind === 'hop' ? 22 : 28), this.r * shS * 1.3, this.r * shS * 0.55, 0, 0, 7); g.fill();
    if (this.state === 'air') {
      // 空中目标落点警示
      const k = (this.stateT === undefined ? 0 : this.stateT);
      g.globalAlpha = 0.4 + 0.3 * Math.sin(this.t * 30);
      g.strokeStyle = '#ff5545';
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(this.targetX, this.targetY, 60 + (this.stateT > 0 ? (0.6 - this.stateT) * 60 : 60), 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    if (this.state === 'dashTele') {
      // 冲刺警示线
      const len = 700;
      const p = this.game.player;
      if (p) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        g.globalAlpha = 0.35 + 0.2 * Math.sin(this.t * 26);
        g.strokeStyle = '#ff4a3a';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(this.x, this.y);
        g.lineTo(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    if (this.kind === 'hop') {
      const frames = hopBossSprites();
      const squash = this.state === 'rest' || this.state === 'telegraph';
      const s = squash ? 1 : 1;
      const scaleY = (this.state === 'rest') ? 0.82 : (this.state === 'air' ? 1.06 : 1);
      // 空中抬升
      const yy = this.y - 6 + bob;
      g.globalAlpha = 1;
      drawSprite(g, frames[squash ? 1 : 0], this.x, this.state === 'air' ? this.y - 60 : yy, s);
    } else {
      const frames = knightBossSprites(this.tier);
      const swing = this.state === 'dash' || this.state === 'roar';
      const flip = false;
      drawSprite(g, frames[swing ? 1 : 0], this.x, this.y - 12 + bob, 1, flip);
    }
    if (this.hitFlash > 0) {
      g.globalAlpha = Math.min(0.55, this.hitFlash * 5);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(this.x, this.y, this.r + 6, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    // Boss 怒意红晕
    if (this.enraged) {
      g.globalAlpha = 0.15 + Math.sin(this.t * 8) * 0.1;
      g.fillStyle = '#ff2020';
      g.beginPath(); g.arc(this.x, this.y, this.r + 14, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  }
}
