// enemy.js — 普通敌人: 配置/受击/AI(以撒式行为区分)
import { CFG } from '../config.js';
import { moveCircle, drawSprite, angleTo } from '../util.js';
import { monsterFrame } from '../art/monsters.js';
import { sfx } from '../audio.js';
import { Projectile } from '../engine/projectiles.js';

const T = CFG.TILE;

// kind 配置: hp 基准/速度/半径/接触伤害(半心)/是否飞行/击退抗性
const DEFS = {
  fly:    { hp: 9,  speed: 105, r: 8.5,  contact: 1, fly: true,  kb: 1.0, seed: 0 },
  slime:  { hp: 20, speed: 52,  r: 13,   contact: 2, fly: false, kb: 0.55 },
  slimelet:{ hp: 8, speed: 78,  r: 8.5,  contact: 1, fly: false, kb: 0.75 },
  gaper:  { hp: 24, speed: 58,  r: 13,   contact: 2, fly: false, kb: 0.5 },
  skelly: { hp: 38, speed: 66,  r: 11,   contact: 3, fly: false, kb: 0.35 },
  imp:    { hp: 28, speed: 66,  r: 11,   contact: 2, fly: false, kb: 0.55 },
};

export class Enemy {
  constructor(kind, x, y, game, opts = {}) {
    const d = DEFS[kind] || DEFS.fly;
    this.kind = kind;
    this.x = x; this.y = y;
    this.r = d.r;
    this.fly = d.fly;
    this.kbRes = d.kb;
    this.speed = d.speed * (opts.speedMul || 1);
    this.hp = d.hp * (opts.hpMul || 1) * CFG.ENEMY_HP_SCALE[Math.min(game.floorIdx, 3)] || 1;
    this.maxHp = this.hp;
    this.contact = d.contact;
    this.dead = false;
    this.hitFlash = 0;
    this.t = Math.random() * 10;
    this.vx = 0; this.vy = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.shootT = 1 + Math.random() * 2;
    this.ang = Math.random() * 6.28;
    this.game = game;
    this.elite = !!opts.elite;
    if (this.elite) { this.hp *= 2.4; this.maxHp = this.hp; this.speed *= 1.15; }
  }

  get halfHp() { return this.hp / this.maxHp; }

  hurt(dmg, ang, game) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.1;
    const kb = 130 * (this.kind === 'skelly' ? 0.4 : 1) * this.kbRes;
    this.vx += Math.cos(ang) * kb;
    this.vy += Math.sin(ang) * kb;
    game.parts.blood(this.x, this.y, ang, 3);
    if (this.hp <= 0) {
      this.dead = true;
      game.onEnemyKilled(this);
    }
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.behave(dt, game);
  }

  // ---- 基础移动(带岩石碰撞) ----
  move(dt, game, vx, vy) {
    this.vx = vx; this.vy = vy;
    let mx = this.vx, my = this.vy;
    const room = game.currentRoom;
    if (!this.fly) {
      const mv = moveCircle(this.x, this.y, this.r, mx, my, dt, (cx, cy) => room.solid(cx, cy));
      this.x = mv.x; this.y = mv.y;
    } else {
      // 飞行: 只被房间边界限制
      this.x += mx * dt; this.y += my * dt;
      const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      this.x = cl(this.x, this.r + 8, CFG.VIEW_W - this.r - 8);
      this.y = cl(this.y, this.r + 8, CFG.VIEW_H - this.r - 8);
      // 轻微规避岩石
      const cx = Math.floor(this.x / T), cy = Math.floor(this.y / T);
      if (room.tileType(cx, cy) === 1) { this.x -= mx * dt; this.y -= my * dt; }
    }
    this.vx *= Math.pow(0.02, dt);
    this.vy *= Math.pow(0.02, dt);
    this.ang = Math.atan2(this.vy, this.vx);
  }
  behave(dt, game) {
    const p = game.player;
    if (!p || p.dead) return;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const move = (vx, vy) => this.move(dt, game, vx, vy);

    switch (this.kind) {
      case 'fly': {
        // 正弦漂移追踪 + 随机急转
        this.ang += Math.sin(this.t * 3.1) * 1.4 * dt * 8;
        const a = Math.atan2(uy, ux) + Math.sin(this.t * 5.3) * 0.9 + (Math.random() - 0.5) * 1.2 * dt;
        const sp = this.speed * (0.75 + Math.sin(this.t * 6) * 0.25);
        move(Math.cos(a) * sp, Math.sin(a) * sp);
        break;
      }
      case 'slime':
      case 'slimelet': {
        // 缓慢逼近, 偶发弹跳加速
        const sp = this.speed * (1 + Math.sin(this.t * 3.4) * 0.25);
        move(ux * sp, uy * sp);
        break;
      }
      case 'gaper': {
        // 保持射程 + 吐弹
        if (d < 130) move(-ux * this.speed, -uy * this.speed);
        else if (d > 220) move(ux * this.speed, uy * this.speed);
        else move(ux * this.speed * 0.3, uy * this.speed * 0.3);
        this.shootT -= dt;
        if (this.shootT <= 0 && d < 480) {
          this.shootT = 1.9 + Math.random() * 0.6;
          const a = angleTo(this.x, this.y, p.x, p.y);
          this.aimTear(game, a, 3, 'R', 200);
          this.telegraph = 0.18;
        }
        break;
      }
      case 'skelly': {
        // 三段式: 追近 → 举剑蓄力 → 突刺冲锋
        if (this.state === 'idle') {
          move(ux * this.speed, uy * this.speed);
          if (d < 260) { this.state = 'windup'; this.stateT = 0.5; }
        } else if (this.state === 'windup') {
          move(ux * this.speed * 0.15, uy * this.speed * 0.15);
          this.stateT -= dt;
          this.telegraph = this.stateT;
          if (this.stateT <= 0) { this.state = 'lunge'; this.stateT = 0.55; this.lungeA = Math.atan2(uy, ux); }
        } else if (this.state === 'lunge') {
          move(Math.cos(this.lungeA) * this.speed * 5.4, Math.sin(this.lungeA) * this.speed * 5.4);
          this.stateT -= dt;
          if (this.stateT <= 0) { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      }
      case 'imp': {
        // 环绕 + 三向瞄准吐火
        const orbit = d < 170 ? 1 : (d > 250 ? -0.6 : 0.2);
        const side = Math.sin(this.t * 1.2) > 0 ? 1 : -1;
        move((-ux + side * uy * 0.9) * this.speed * orbit, (-uy - side * ux * 0.9) * this.speed * orbit);
        this.shootT -= dt;
        if (this.shootT <= 0 && d < 520) {
          this.shootT = 1.7 + Math.random() * 0.7;
          const a = angleTo(this.x, this.y, p.x, p.y);
          for (const off of [-0.2, 0, 0.2]) this.aimTear(game, a + off, 1.2, 'R', 190);
        }
        break;
      }
    }
  }

  aimTear(game, a, dmg, color = 'R', speed = 190) {
    const p = new Projectile({
      x: this.x, y: this.y - 4,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, radius: 4.6, range: 640, enemy: true, color,
    });
    game.eTears.push(p);
  }

  draw(g) {
    if (this.dead) return;
    const fr = monsterFrame(this.kind, this.t, this.kind === 'slimelet');
    const bob = Math.sin(this.t * 8) * (this.kind === 'slime' || this.kind === 'slimelet' ? 0.4 : 1.2);
    // 影子
    g.fillStyle = 'rgba(0,0,0,0.33)';
    g.beginPath(); g.ellipse(this.x, this.y + 8, this.r * 0.95, this.r * 0.4, 0, 0, 7); g.fill();
    // 蓄力警示(骷髅闪烁红线)
    if (this.state === 'windup') {
      g.globalAlpha = 0.25 + Math.sin(this.t * 30) * 0.15;
      g.strokeStyle = '#ff3333';
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, 30, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    const flip = this.vx < -10;
    drawSprite(g, fr, this.x, this.y - 6 + bob, 1, flip);
    if (this.hitFlash > 0) {
      g.globalAlpha = Math.min(0.45, this.hitFlash * 4);
      g.fillStyle = '#ffd9a8';
      g.beginPath(); g.arc(this.x, this.y, this.r + 1, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    // 精英金环
    if (this.elite) {
      g.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.25;
      g.strokeStyle = '#ffcf5a';
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, this.r + 5, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
  }
}
