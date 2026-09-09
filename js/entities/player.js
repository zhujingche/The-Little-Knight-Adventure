// player.js — 主角实体: 移动/射击(四向+斜向)/受击/属性(以撒式, 圣泪为攻击)
import { CFG } from '../config.js';
import { moveCircle, drawSprite } from '../util.js';
import { getKnight, eyeAnchors } from '../art/player.js';
import { iconSprite } from '../art/icons.js';
import { ITEM_MAP } from '../items.js';
import { sfx } from '../audio.js';
import { input } from '../input.js';
import { Projectile } from '../engine/projectiles.js';

const P = CFG.PLAYER;
const T = CFG.TILE;

export class Player {
  constructor() {
    this.x = 480; this.y = 300;
    this.radius = P.radius;
    this.resetStats();
    this.dead = false;
    this.face = { x: 0, y: 1 };
    this.moveT = 0;
    this.animT = Math.random() * 9;
    this.fireCd = 0;
    this.aim = null;
    this.shotSide = 0;
    this.iTimer = 0;
    this.hurtFlash = 0;
    this.kb = { x: 0, y: 0 };
    this.stepT = 0;
    this.shootPose = 0;      // 射击后坐抖动
    this.items = [];         // 收集的道具 id
    this.visuals = [];       // 外观叠加层 id
    this.walkCycle = 0;
  }

  resetStats() {
    this.containers = P.baseHp;
    this.hp = this.containers * 2;   // 半心单位
    this.addDmg = 0;
    this.dmgMult = 1;
    this.rateBonus = 0;      // 每点约 +22% 射速
    this.addSpeed = 0;
    this.addRange = 0;
    this.addContainers = 0;
    // 圣泪强化
    this.f = { pierce: false, homing: false, split: false, burn: false, spectral: false, laser: false, tri: false, quad: false, spread: false, giga: false, crit: false, luck: 0 };
    this.fired = 0;
  }

  get dmg() { return (P.baseDmg + this.addDmg) * this.dmgMult; }
  get interval() {
    return Math.max(P.minInterval, P.baseInterval / (1 + this.rateBonus * 0.22));
  }
  get speed() { return P.baseSpeed + this.addSpeed; }
  get rangeTiles() { return Math.max(2.6, P.baseRange + this.addRange); }
  get maxHp() { return (P.baseHp + this.addContainers) * 2; }

  heal(halves) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + halves);
    return this.hp - before;
  }

  takeDamage(halves, ang, game) {
    if (this.dead || this.iTimer > 0 || this.god) return false;
    this.hp -= halves;
    this.iTimer = P.iFrames;
    this.hurtFlash = 0.18;
    this.kb.x = Math.cos(ang) * 260;
    this.kb.y = Math.sin(ang) * 260;
    sfx('hurt');
    if (game) {
      game.hpDirty = true;   // 通知 HUD 及时刷新血条
      game.shake(5);
      game.parts.blood(this.x, this.y, ang, 8);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (game) game.onPlayerDied();
    }
    return true;
  }

  update(dt, game) {
    if (this.dead) return;
    this.iTimer = Math.max(0, this.iTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.fireCd -= dt;
    this.shootPose = Math.max(0, this.shootPose - dt * 5);
    this.animT += dt;

    // ---- 移动 ----
    const mv = input.moveVec();
    const moving = Math.hypot(mv.x, mv.y) > 0.01;
    let vx = 0, vy = 0;
    if (moving) { vx = mv.x * this.speed; vy = mv.y * this.speed; this.face = { x: mv.x, y: mv.y }; }
    vx += this.kb.x; vy += this.kb.y;
    this.kb.x *= Math.pow(0.001, dt); this.kb.y *= Math.pow(0.001, dt);
    if (Math.abs(this.kb.x) < 4) this.kb.x = 0;
    if (Math.abs(this.kb.y) < 4) this.kb.y = 0;
    const room = game.currentRoom;
    const res = moveCircle(this.x, this.y, this.radius, vx, vy, dt, (cx, cy) => room.solid(cx, cy));
    this.x = res.x; this.y = res.y;
    if (moving) {
      this.walkCycle += dt * 9;
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.3; game.parts.dust(this.x, this.y + 8); sfx('step'); }
    } else this.walkCycle = 0;

    // ---- 射击(方向键优先; 无方向键时按住鼠标左键朝光标射击) ----
    const dirs = input.aimDirs();
    if (dirs.length) {
      let ax = 0, ay = 0;
      for (const d of dirs) { ax += d.x; ay += d.y; }
      const l = Math.hypot(ax, ay) || 1;
      this.aim = { x: ax / l, y: ay / l };
    } else if (input.mouseDown) {
      const m = input.mouseWorld();
      const dx = m.x - this.x, dy = m.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) this.aim = { x: dx / d, y: dy / d };
      else this.aim = null;
    } else this.aim = null;

    if (this.aim && this.fireCd <= 0) {
      this.fire(game, this.aim);
      this.fireCd = this.interval;
      this.face = { x: this.aim.x, y: this.aim.y };
      this.shootPose = 1;
    }
    // 门检测
    game.checkDoorTransition(this);
  }

  fire(game, aim) {
    const { x, y } = this;
    const speed = CFG.TEAR.speed;
    const ang = Math.atan2(aim.y, aim.x);
    const baseOpts = {
      x, y, dmg: this.dmg, owner: this, radius: this.f.giga ? CFG.TEAR.radius * 2.1 : CFG.TEAR.radius,
      range: this.rangeTiles * T,
      pierce: this.f.pierce, homing: this.f.homing, spectral: this.f.spectral,
      burn: this.f.burn, split: this.f.split,
      big: this.f.giga, critChance: this.f.crit ? 0.15 : 0,
    };
    const shots = [];
    if (this.f.laser) {
      game.spawnLaser(this, ang, baseOpts);
      sfx('laser');
      return;
    }
    if (this.f.quad) {
      const off = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      for (const o of off) shots.push({ a: ang + o, sp: speed });
    } else if (this.f.tri) {
      for (const o of [-0.22, 0, 0.22]) shots.push({ a: ang + o, sp: speed });
    } else if (this.f.spread) {
      // 五连扇形, 射程略减
      for (const o of [-0.44, -0.22, 0, 0.22, 0.44]) shots.push({ a: ang + o, sp: speed });
      baseOpts.range = baseOpts.range * 0.82;
    } else shots.push({ a: ang, sp: speed });

    // 发射锚点(从眼睛位置, 依朝向选择, 左右交替)
    const cardinal = Math.abs(aim.y) > Math.abs(aim.x) ? (aim.y > 0 ? 'down' : 'up') : 'side';
    let anchors = eyeAnchors()[cardinal] || [{ x: 0, y: -6 }];
    if (cardinal === 'side' && aim.x < 0) anchors = anchors.map(a => ({ x: -a.x, y: a.y }));
    const eye = anchors[this.shotSide % anchors.length];
    this.shotSide++;
    const ox = eye.x + aim.x * 4, oy = eye.y + aim.y * 4;

    for (const s of shots) {
      let dmg = this.dmg;
      let crit = false;
      if (this.f.crit && Math.random() < 0.15) { dmg *= 2; crit = true; }
      const p = new Projectile({
        ...baseOpts,
        dmg,
        crit,
        x: this.x + ox, y: this.y + oy,
        vx: Math.cos(s.a) * s.sp, vy: Math.sin(s.a) * s.sp,
      });
      game.pTears.push(p);
    }
    this.fired++;
    sfx('shoot');
    if (this.f.giga) game.shake(2.2); else game.shake(0.35);
    // 枪口微光
    game.parts.sparkle(this.x + ox, this.y + oy, this.f.crit && Math.random() < 0.15 ? '#ffd98a' : '#dff2ff', 2);
  }

  draw(g) {
    if (this.dead) return;
    const bob = Math.sin(this.walkCycle * 0.8) * 1.6;
    const sq = this.shootPose > 0 ? Math.sin(this.shootPose * Math.PI) * -1.5 : 0;
    // 后坐力: 身体向射击反方向短暂后仰
    const rec = this.shootPose > 0 ? Math.sin(this.shootPose * Math.PI) * 4 : 0;
    const rx = (this.face ? -this.face.x : 0) * rec;
    const ry = (this.face ? -this.face.y : 0) * rec;
    // 影子(配合更大身躯)
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(this.x, this.y + 14, 13, 5.5, 0, 0, 7); g.fill();
    // 无敌闪烁
    const blink = this.iTimer > 0 && Math.floor(this.iTimer * 18) % 2 === 0;
    if (blink) g.globalAlpha = 0.45;
    const { s, flip } = getKnight(this.face);
    const yoff = bob + sq;
    // 开火瞬间微放大(帅气后坐); 基础尺寸已由更大画布承载
    const pop = this.shootPose > 0 ? 1 + Math.sin(this.shootPose * Math.PI) * 0.05 : 1;
    drawSprite(g, s, this.x + rx, this.y - 4 + yoff + ry, pop, flip);
    // 瞄准时目镜发光(青蓝)
    if (this.aim && !this.dead) {
      let o = 'down';
      if (Math.abs(this.face.x) >= Math.abs(this.face.y)) o = 'side';
      else o = this.face.y > 0 ? 'down' : 'up';
      let anchors = eyeAnchors()[o] || [];
      if (o === 'side' && this.face.x < 0) anchors = anchors.map(a => ({ x: -a.x, y: a.y }));
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gl = 0.30 + Math.sin(this.animT * 9) * 0.12 + (this.shootPose > 0 ? 0.25 : 0);
      for (const a of anchors) {
        const gx = this.x + rx + a.x, gy = this.y - 4 + yoff + ry + a.y;
        const gr = g.createRadialGradient(gx, gy, 1, gx, gy, 8);
        gr.addColorStop(0, 'rgba(235,240,246,' + Math.min(0.4, gl * 0.6) + ')');
        gr.addColorStop(1, 'rgba(190,205,220,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(gx, gy, 8, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    // 受击闪(柔和红晕圈代替白块)
    if (this.hurtFlash > 0) {
      g.globalAlpha = Math.min(0.3, this.hurtFlash * 1.8);
      g.fillStyle = '#ff5545';
      g.beginPath(); g.arc(this.x, this.y - 4, 14, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // ---- 外观改造层(道具环绕标记 + 光晕) ----
    if (this.visuals && this.visuals.length) {
      const t = this.walkCycle * 0.4;
      const offs = {
        crown: [0, -40], halo: [0, -44], goggles: [0, -26],
        horns: [0, -20], wing: [0, -38], scarf: [0, -30],
      };
      this.visuals.forEach((v, i) => {
        const item = ITEM_MAP.get(v);
        if (!item) return;
        const base = offs[v] || [0, -34];
        const sw = Math.sin(t + i * 1.7) * 3;
        const icon = iconSprite(v, item.aura);
        g.globalAlpha = 0.92;
        drawSprite(g, icon, this.x + base[0], this.y + base[1] + sw, 0.5);
        // 光环微光
        if (v === 'halo') {
          g.globalAlpha = 0.5 + Math.sin(this.walkCycle * 0.7) * 0.15;
          g.strokeStyle = item.aura;
          g.lineWidth = 3;
          g.beginPath(); g.ellipse(this.x, this.y - 8, 26, 20, 0.4, 0, Math.PI * 2); g.stroke();
        }
        if (v === 'wing') {
          g.globalAlpha = 0.35;
          g.fillStyle = '#fff';
          g.beginPath(); g.ellipse(this.x - 18, this.y - 2, 12, 7, -0.4, 0, 7); g.fill();
          g.beginPath(); g.ellipse(this.x + 18, this.y - 2, 12, 7, 0.4, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
      });
      // 恶魔红晕
      if (this.visuals.includes('horns')) {
        g.globalAlpha = 0.14 + Math.sin(this.walkCycle * 0.5) * 0.06;
        g.fillStyle = '#ff3030';
        g.beginPath(); g.ellipse(this.x, this.y - 4, 26, 30, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
    }
  }
}
