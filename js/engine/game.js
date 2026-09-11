// game.js — 主引擎: 状态/地牢/实体/碰撞/奖励/切房/切层/激光
import { CFG, THEMES } from '../config.js';
import { drawSprite } from '../util.js';
import { genFloor } from './dungeon.js';
import { Room, T, DOOR_CELL, OPP } from './room.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';
import { Projectile } from './projectiles.js';
import { Particles } from './particles.js';
import { rollItem, applyItem, ITEM_MAP } from '../items.js';
import { sfx, setMusic } from '../audio.js';
import { input } from '../input.js';
import { hud } from '../ui/hud.js';
import { chestSprite, heartPickupSprite, pedestalSprite } from '../art/world.js';
import { iconSprite } from '../art/icons.js';

const VIEW_W = CFG.VIEW_W, VIEW_H = CFG.VIEW_H;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.state = 'idle';
    this.floorIdx = 1;
    this.floor = null;
    this.rooms = [];
    this.currentRoomIdx = -1;
    this.currentRoom = null;
    this.player = null;
    this.enemies = [];
    this.boss = null;
    this.pTears = [];
    this.eTears = [];
    this.lasers = [];
    this.parts = new Particles();
    this.pickups = [];
    this.stairs = null;
    this.switch = null;        // 房间切换动画
    this.switchDeep = null;    // 深层切换(进层)
    this.shakeT = 0;
    this.shakeMag = 0;
    this.hitStop = 0;          // 受击顿帧(慢动作)
    this.roomHadHostiles = false;
    this.statTimer = 0;
    this.hpDirty = true;
    this.itemDirty = true;
    this.deathAnimT = 0;
    this.fxTime = 0;
    this.paused = false;
    this.resetStats();
  }

  resetStats() {
    this.stats = { kills: 0, items: 0, time: 0, rooms: 0, tears: 0, floor: 1 };
  }

  // ================= 流程 =================
  startRun() {
    this.resetStats();
    this.floorIdx = 1;
    this.player = new Player();
    this.enemies = [];
    this.boss = null;
    this.pTears = [];
    this.eTears = [];
    this.lasers = [];
    this.pickups = [];
    this.stairs = null;
    this.switch = null;
    this.switchDeep = null;
    this.deathAnimT = 0;
    this.hitStop = 0;
    this.buildFloor();
    this.state = 'play';
    this.hpDirty = this.itemDirty = true;
    hud.showGameUI(true);
  }

  buildFloor() {
    const seed = (Math.random() * 0x7fffffff) | 0;
    this.floor = genFloor(this.floorIdx, seed);
    this.floor.seed = seed;
    this.rooms = this.floor.nodes.map((n, i) => new Room(this.floor, i));
    // 起始房入场
    const start = this.floor.startRoom;
    this.enterRoom(start, { x: 7 * T + T / 2, y: 5 * T + T / 2 }, null);
  }

  get theme() { return THEMES[this.floor ? this.floor.themeNo : 1]; }

  // 进入房间; fromDir 为进入方向(用于出生点), 未提供则用中心点
  enterRoom(idx, spawn, fromDir) {
    if (this.floor.rooms) { /* reserved */ }
    const room = this.rooms[idx];
    this.currentRoomIdx = idx;
    this.currentRoom = room;
    room.ensureBg();
    room.entryVisited++;
    room.visited = true;
    // 敌人生成
    this.enemies = [];
    this.boss = null;
    this.lasers = [];
    this.stairs = room.stairs || null;
    this.roomHadHostiles = false;

    if (!room.spawned) {
      room.spawned = true;
      const isBossRoom = room.role === 'boss';
      if (isBossRoom) {
        if (!room.cleared) {
          const kind = this.floorIdx === 1 ? 'hop' : 'knight';
          const hpMul = this.floorIdx === 3 ? 520 / 380 : 1;
          this.boss = new Boss(kind, 7 * T + T / 2, 4 * T + T / 2, this, {
            hp: kind === 'hop' ? 210 * (1 + (this.floorIdx - 1) * 0.25) : 380 * hpMul,
            speedMul: this.floorIdx >= 3 ? 1.18 : 1,
          });
          this.roomHadHostiles = true;
          room.bossLive = true;
          room.sealed = true;
          sfx('bossRoar');
          hud.roomToast('⚠ BOSS · ' + (kind === 'hop' ? '大眼魔王' : '深渊大骑士') + ' ⚠', true);
          hud.bossBar(true, 1, kind === 'knight', kind === 'hop' ? '大眼魔王' : '深渊大骑士');
        }
      } else {
        for (const p of room.pending) {
          const e = new Enemy(p.kind, p.x, p.y, this, { mini: p.mini, elite: p.elite });
          this.enemies.push(e);
        }
        if (this.enemies.length) {
          this.roomHadHostiles = true;
          room.sealed = true;
        } else room.cleared = true;
      }
    } else if (this.enemies.length === 0 && this.roomHadHostiles && !room.cleared) {
      // 若敌人已清但标记未结算(离开后再回)不会发生——锁门机制保证
      room.cleared = true;
    }
    // 玩家位置
    const p = this.player;
    if (p) {
      if (spawn) { p.x = spawn.x; p.y = spawn.y; }
      p.dead = false;
    }
    this.pickups = room.pickups || (room.pickups = []);
    this.pickups.forEach(pk => pk.t = 0);
    // 通知
    const name = { start: '起点房间', normal: '地牢', treasure: '宝藏室', boss: 'BOSS 房' }[room.role];
    hud.roomToast((this.floorIdx <= 3 ? ['I', 'II', 'III'][this.floorIdx - 1] : 'IV') + '层 · ' + (THEMES[this.floor.themeNo].name) + ' · ' + name);
    setMusic(this.floorIdx, !!this.boss);
    hud.floorLabel(this.floorIdx);
    this.hpDirty = this.itemDirty = true;
  }

  spawnEnemyAt(kind, x, y, opts = {}) {
    const e = new Enemy(kind, x, y, this, opts);
    this.enemies.push(e);
    this.roomHadHostiles = true;
    this.currentRoom.sealed = true;
    return e;
  }

  // ================= 更新 =================
  tick(dtRaw) {
    if (this.paused) return;
    let dt = dtRaw * CFG.TIME_SCALE;
    dt = Math.min(dt, 1 / 20);
    this.fxTime += dt;
    if (this.state === 'play' && this.player && !this.player.dead) {
      this.stats.time += dt;
      this.statTimer += dt;
      this.stats.tears = this.player.fired;
    }
    // 死亡表演
    if (this.deathAnimT > 0) {
      this.deathAnimT -= dt;
      this.parts.update(dt);
      if (this.deathAnimT <= 0) this.state = 'dead';
    }
    if (this.state === 'dead' || this.state === 'win' || this.state === 'dying') {
      this.parts.update(dt);
      return;
    }
    if (this.state !== 'play') return;

    // 房间切换中: 只播淡入淡出
    if (this.switch) {
      this.switch.T -= dt;
      this.parts.update(dt);
      if (this.switch.T <= 0) {
        if (!this.switch.done) {
          this.switch.done = true;
          this.enterRoom(this.switch.to, this.switch.spawn, null);
          this.switch.T = 0.24; // 淡入时长
        } else this.switch = null;
      }
      return;
    }
    if (this.switchDeep) {
      this.switchDeep.T -= dt;
      this.parts.update(dt);
      if (this.switchDeep.T <= 0) {
        if (!this.switchDeep.done) {
          this.switchDeep.done = true;
          this._doFloorAdvance();
          this.switchDeep.T = 0.5;
        } else { this.switchDeep = null; }
      }
      return;
    }

    this.updateGameplay(dt);
  }

  updateGameplay(dt) {
    const room = this.currentRoom;
    const p = this.player;
    // 顿帧: 震动/顿帧按真实时间消退, 其余世界时间放慢, 营造受击手感
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.hitStop = Math.max(0, this.hitStop - dt);
    if (this.hitStop > 0) dt *= 0.45;   // 轻顿帧: 短暂减速而非冻结

    // 玩家
    if (p && !p.dead) {
      p.update(dt, this);
      if (p.hpDirty) { this.hpDirty = true; p.hpDirty = false; }
    }

    // 敌人(含Boss)
    for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this);
    // 敌人分离
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = (a.r + b.r) * 0.72;
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
    // 清理死亡敌人
    if (this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);

    // 弹体
    this.updateTears(dt);
    this.updateLasers(dt);

    // 接触伤害(敌人/弹 vs 玩家)
    if (p && !p.dead && p.iTimer <= 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < p.radius + e.r - 3) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.vx -= Math.cos(a) * 90; e.vy -= Math.sin(a) * 90;
          p.takeDamage(e.contact, a, this);
          break;
        }
      }
    }

    // 拾取物 & 宝箱
    this.updatePickups(dt);
    this.updateChest();
    // 楼梯
    if (this.stairs && p && !p.dead) {
      const d = Math.hypot(p.x - this.stairs.x, p.y - this.stairs.y);
      if (d < 34) this.startFloorAdvance();
    }
    // Boss血条
    if (this.boss && !this.boss.dead) hud.bossBar(true, this.boss.halfHp, this.boss.kind !== 'hop', this.boss.kind === 'hop' ? '大眼魔王' : '深渊大骑士');
    else if (this.state === 'play') hud.bossBar(false);

    this.parts.update(dt);
    // 心跳HUD刷新
    if (this.hpDirty) { hud.setHearts(p.maxHp / 2, p.hp, p.maxHp / 2); this.hpDirty = false; }
    if (this.itemDirty) { hud.setItems(p); this.itemDirty = false; }
  }

  // ---------------- 圣泪/敌弹 ----------------
  updateTears(dt) {
    const room = this.currentRoom;
    const p = this.player;
    const torn = [];
    for (let i = this.pTears.length - 1; i >= 0; i--) {
      const t = this.pTears[i];
      if (t.dead) { this.pTears.splice(i, 1); continue; }
      // 追踪目标
      if (t.homing) {
        let best = null, bd = 1e9;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        if (!best && this.boss && !this.boss.dead) {
          const d = (this.boss.x - t.x) ** 2 + (this.boss.y - t.y) ** 2;
          if (d < bd) { bd = d; best = this.boss; }
        }
        t.target = best;
      }
      t.update(dt);
      // 墙碰撞
      const cx = Math.floor(t.x / T), cy = Math.floor(t.y / T);
      if (!t.spectral && room.solid(cx, cy)) {
        t.dead = true;
        this.parts.puff(t.x, t.y, '#bfd8ef', 4, 2.5);
        continue;
      }
      // 命中敌人
      let hit = false;
      for (const e of this.enemies) {
        if (e.dead || t.hitSet.has(e)) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) < e.r + t.radius) {
          this.damageEnemy(e, t.dmg, Math.atan2(t.vy, t.vx), t);
          t.hitSet.add(e);
          if (t.burn) { e.burnT = Math.max(e.burnT || 0, 1.8); e._burnTick = 0; }
          if (t.split) this.splitTear(t);
          if (!t.pierce) { hit = true; }
          break;
        }
      }
      if (!hit && this.boss && !this.boss.dead && !t.hitSet.has(this.boss)) {
        if (Math.hypot(this.boss.x - t.x, this.boss.y - t.y) < this.boss.r + t.radius) {
          this.damageEnemy(this.boss, t.dmg, Math.atan2(t.vy, t.vx), t);
          t.hitSet.add(this.boss);
          if (t.burn) { this.boss.burnT = 1.8; this.boss._burnTick = 0; }
          if (t.split) this.splitTear(t);
          if (!t.pierce) hit = true;
        }
      }
      if (hit || (t.dead && t.split)) {
        if (t.split && !t.hitSet.size) this.splitTear(t);
        t.dead = true;
      }
      // 到期分裂
      if (!t.dead && t.traveled >= t.range - 1 && t.split) { this.splitTear(t); t.dead = true; }
      this.stats.tears += 0; // fired计数在player中
    }
    this.pTears = this.pTears.filter(t => !t.dead);

    // 敌人弹
    for (let i = this.eTears.length - 1; i >= 0; i--) {
      const t = this.eTears[i];
      t.update(dt);
      const cx = Math.floor(t.x / T), cy = Math.floor(t.y / T);
      if (room.solid(cx, cy)) {
        this.parts.puff(t.x, t.y, '#ffb0a0', 3, 2);
        this.eTears.splice(i, 1);
        continue;
      }
      if (p && !p.dead && p.iTimer <= 0) {
        if (Math.hypot(p.x - t.x, p.y - t.y) < p.radius + t.radius) {
          const a = Math.atan2(t.vy, t.vx);
          p.takeDamage(t.dmg, a, this);
          this.parts.sparkle(t.x, t.y, '#ffffff', 3);
          this.eTears.splice(i, 1);
          continue;
        }
      }
      if (t.traveled > t.range) this.eTears.splice(i, 1);
    }
  }

  damageEnemy(e, dmg, ang, tear) {
    e.hurt(dmg, ang, this);
    if (tear) {
      this.parts.blood(e.x, e.y, ang, 3);
      this.parts.splash(e.x, e.y, tear.color === 'R' ? '#ffb0a0' : (tear.color === 'F' ? '#ffca7a' : '#cfe6ff'), 7);
      sfx('splash');
      this.hitStop = Math.min(0.07, this.hitStop + 0.03);
    }
  }

  splitTear(t) {
    const sp = 130;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const ch = new Projectile({
        x: t.x, y: t.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        dmg: t.dmg * 0.5, radius: 3.4, range: t.range * 0.45,
        pierce: false, split: false, homing: t.homing, spectral: t.spectral, color: t.color,
      });
      this.pTears.push(ch);
    }
  }

  // ---------------- 激光 ----------------
  spawnLaser(owner, ang, opts) {
    this.lasers.push({
      owner, ang, x: owner.x, y: owner.y,
      dmg: owner.dmg * 0.38, life: 0.30, t: 0,
      tick: 0, last: 0, color: '#9fe8ff',
      range: 800,
    });
  }
  updateLasers(dt) {
    const p = this.player;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const L = this.lasers[i];
      L.t += dt;
      if (L.t > L.life) { this.lasers.splice(i, 1); continue; }
      L.last -= dt;
      // 射线端
      const cos = Math.cos(L.ang), sin = Math.sin(L.ang);
      let ex = L.x, ey = L.y, len = 0;
      const room = this.currentRoom;
      while (len < L.range) {
        ex += cos * 8; ey += sin * 8; len += 8;
        const cx = Math.floor(ex / T), cy = Math.floor(ey / T);
        if (room.solid(cx, cy)) { len += 20; break; }
        if (ex < 8 || ey < 8 || ex > VIEW_W - 8 || ey > VIEW_H - 8) break;
      }
      L.endX = ex; L.endY = ey; L.len = len;
      if (L.last <= 0) {
        L.last = 0.11;
        // 伤害线内所有敌人(粗判定)
        const hitt = (e) => {
          if (e.dead) return false;
          const dx = e.x - L.x, dy = e.y - L.y;
          const proj = dx * cos + dy * sin;
          if (proj < 0 || proj > len) return false;
          const perp = Math.abs(-sin * dx + cos * dy);
          return perp < e.r + 7;
        };
        let any = false;
        for (const e of this.enemies) {
          if (hitt(e)) {
            e.hurt(L.dmg, Math.atan2(sin, cos), this);
            e.burnT = Math.max(e.burnT || 0, 1.0);
            any = true;
          }
        }
        if (this.boss && !this.boss.dead && hitt(this.boss)) {
          this.boss.hurt(L.dmg, Math.atan2(sin, cos), this);
          any = true;
        }
        if (any) {
          this.parts.sparkle(ex - cos * 20, ey - sin * 20, '#cfefff', 2);
          sfx('hit');
        }
      }
      // 枪口火花
      if (Math.random() < 0.35) this.parts.sparkle(L.x + cos * 14, L.y + sin * 14, L.color, 1);
    }
  }

  // ---------------- 敌人死亡/清房 ----------------
  onEnemyKilled(e) {
    this.stats.kills++;
    sfx('die');
    this.parts.puff(e.x, e.y, '#e0c8a8', 7, 4);
    this.parts.blood(e.x, e.y, Math.random() * 6.28, 5);
    this.parts.ring(e.x, e.y, '#ffffff', 6);
    this.parts.sparkle(e.x, e.y, '#ffe9c0', 4);
    this.hitStop = Math.min(0.08, this.hitStop + 0.03);
    this.shake(2.5);
    // 分裂史莱姆
    if (e.kind === 'slime') {
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2 + 0.3;
        this.spawnEnemyAt('slimelet', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, { speedMul: 1.1 });
      }
      hud.roomToast('史莱姆分裂了！');
    }
    // 掉落
    this.maybeDrop(e);
    this.checkRoomClear();
  }

  maybeDrop(e) {
    const room = this.currentRoom;
    const roll = Math.random();
    if (e.elite) { this.spawnItemPedestal(e.x, e.y); return; }
    if (roll < 0.08 + this.floorIdx * 0.01) { this.spawnItemPedestal(e.x, e.y); return; }
    if (roll < 0.28) this.spawnHeartPickup(e.x, e.y, Math.random() < 0.4 ? 1 : 2);
  }

  checkRoomClear() {
    const room = this.currentRoom;
    if (room.cleared) return;
    const aliveEnemies = this.enemies.some(e => !e.dead);
    const bossAlive = this.boss && !this.boss.dead;
    if (!this.roomHadHostiles) return;
    if (aliveEnemies || bossAlive) return;
    this.clearRoom(room);
  }

  clearRoom(room) {
    room.cleared = true;
    room.sealed = false;
    room.bossLive = false;
    this.stats.rooms++;
    this.parts.ring(7 * T + T / 2, 4 * T + T / 2, '#ffe9a0', 30);
    sfx('unlock');
    hud.roomToast('门开了……');
    // 普通房/奖励房: 清房奖励
    if (room.role === 'normal' || room.role === 'treasure') {
      const r = Math.random();
      if (room.role === 'treasure' || r < 0.3) {
        this.spawnItemPedestal(7 * T + T / 2, 4 * T + T / 2);
      } else if (r < 0.55) {
        this.spawnHeartPickup(7 * T + T / 2, 4 * T + T / 2, 2);
      }
    }
    this.hpDirty = true;
  }

  // Boss 死亡
  onBossKilled(boss) {
    sfx('bossRoar');
    this.shake(10);
    this.parts.blood(boss.x, boss.y, 0, 20);
    this.parts.ring(boss.x, boss.y, '#ffe9a0', 60);
    for (let i = 0; i < 22; i++) this.parts.puff(boss.x, boss.y, '#d8b090', 1, 6);
    this.stats.kills++;
    const room = this.currentRoom;
    // 必掉 BOSS 道具
    this.spawnItemPedestal(7 * T + T / 2, 3 * T + T / 2);
    // 出现下一层楼梯(记录到房间, 离开再回来仍存在)
    this.stairs = { x: 7 * T + T / 2, y: 6 * T + T / 2, t: 0 };
    room.stairs = this.stairs;
    // 若仍有召唤小兵存活则等小兵清完
    if (this.enemies.some(e => !e.dead)) {
      hud.roomToast('深渊大骑士倒下了！先清理残兵…');
      this.boss = null;
      hud.bossBar(false);
      return;
    }
    this.boss = null;
    hud.bossBar(false);
    hud.roomToast('BOSS 被击败！走向楼梯 ↓');
    this.clearRoom(room);
  }

  // ---------------- 拾取物 ----------------
  spawnHeartPickup(x, y, amount) {
    this.pickups.push({ kind: 'heart', x, y, amount, t: 0, taken: false });
  }
  spawnItemPedestal(x, y) {
    const item = rollItem(this);
    if (!item) return;
    this.pickups.push({ kind: 'item', x, y, item, t: 0, taken: false });
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.t += dt;
      if (p && !p.dead) {
        const d = Math.hypot(p.x - pk.x, p.y - (pk.y - 4));
        if (d < 30) {
          if (pk.kind === 'heart') {
            if (p.hp < p.maxHp) {
              p.heal(pk.amount);
              sfx('heart');
              this.parts.sparkle(pk.x, pk.y, '#ff7a7a', 6);
              this.parts.text(pk.x, pk.y - 22, '+♥', '#ff8a8a', 0.9, 13);
              pk.taken = true;
              this.hpDirty = true;
            }
          } else if (pk.kind === 'item' && pk.item) {
            applyItem(this, pk.item);
            pk.taken = true;
          }
        }
      }
    }
    this.pickups = this.pickups.filter(pk => !pk.taken);
    this.currentRoom.pickups = this.pickups;
  }

  onItemCollected(item) {
    this.stats.items++;
    this.itemDirty = true;
    this.hpDirty = true;
    sfx('item');
    hud.flashItem(item);
    const x = this.player.x, y = this.player.y;
    // 圣光柱 + 扩散环 + 飘字
    this.parts.ring(x, y - 8, '#ffe9a0', 20);
    this.parts.sparkle(x, y - 14, '#fff2b0', 18);
    this.parts.text(x, y - 34, item.name, item.aura || '#ffe08a', 1.5, 12);
    for (let i = 0; i < 6; i++) {
      this.parts.spawn({
        x: x - 6 + i * 2.4, y: y - 60 + Math.sin(i) * 6,
        vx: 0, vy: -10, life: 0.5, t: 0, size: 2.2, color: i % 2 ? '#fff6d8' : '#ffd98a',
        grav: 0, fade: true, kind: 'dot',
      });
    }
    this.shake(3);
    hud.setHearts(this.player.maxHp / 2, this.player.hp, this.player.maxHp / 2);
  }

  updateChest() {
    const room = this.currentRoom;
    if (!room.chest || room.chest.opened || !room.cleared) return;
    const p = this.player;
    if (!p || p.dead) return;
    if (Math.hypot(p.x - room.chest.x, p.y - room.chest.y) < 42) {
      room.chest.opened = true;
      sfx('chest');
      this.parts.ring(room.chest.x, room.chest.y, '#ffe9a0', 26);
      this.spawnItemPedestal(room.chest.x, room.chest.y);
      const extra = Math.random();
      if (extra < 0.45) this.spawnHeartPickup(room.chest.x - 26, room.chest.y, 2);
      if (extra > 0.65) this.spawnHeartPickup(room.chest.x + 26, room.chest.y, 2);
    }
  }

  // ---------------- 门/切换 ----------------
  checkDoorTransition(p) {
    if (this.switch || this.state !== 'play' || p.dead) return;
    const room = this.currentRoom;
    if (!room.cleared && room.roomHadHostiles) return; // 未清不许走
    if (this.boss && !this.boss.dead) return;
    for (const d of room.doors) {
      const c = d.cell;
      const cx0 = c.cx * T, cy0 = c.cy * T;
      const nearX = Math.abs(p.x - (cx0 + T / 2)) < T * 0.85;
      const nearY = Math.abs(p.y - (cy0 + T / 2)) < T * 0.85;
      if (!nearX || !nearY) continue;
      // 触发: 玩家足够深入门洞
      let trig = false;
      const center = c.cx * T + T / 2, mcenter = c.cy * T + T / 2;
      if (d.dir === 'N' && p.y < cy0 + T * 0.62 && Math.abs(p.x - center) < T * 0.55) trig = true;
      if (d.dir === 'S' && p.y > cy0 + T * 0.38 && Math.abs(p.x - center) < T * 0.55) trig = true;
      if (d.dir === 'W' && p.x < cx0 + T * 0.62 && Math.abs(p.y - mcenter) < T * 0.55) trig = true;
      if (d.dir === 'E' && p.x > cx0 + T * 0.38 && Math.abs(p.y - mcenter) < T * 0.55) trig = true;
      if (!trig) continue;
      const toRoom = this.rooms[d.to];
      const sp = this.spawnFor(toRoom, OPP[d.dir]);
      this.switch = { T: 0.22, to: d.to, spawn: sp, done: false };
      sfx('door');
      return;
    }
  }

  spawnFor(room, fromDir) {
    // fromDir: 玩家进入该房的门方向
    const cell = DOOR_CELL[fromDir];
    let x = 7 * T + T / 2, y = 4 * T + T / 2;
    const inset = 34;
    if (fromDir === 'N') { x = cell.cx * T + T / 2; y = cell.cy * T + T + inset; }
    if (fromDir === 'S') { x = cell.cx * T + T / 2; y = cell.cy * T - inset; }
    if (fromDir === 'W') { x = cell.cx * T + T + inset; y = cell.cy * T + T / 2; }
    if (fromDir === 'E') { x = cell.cx * T - inset; y = cell.cy * T + T / 2; }
    return { x, y };
  }

  // ---------------- 进层 / 胜负 ----------------
  startFloorAdvance() {
    if (this.switchDeep) return;
    if (this.floorIdx >= CFG.DUNGEON.floorsToWin) {
      // 通关
      this.switchDeep = { T: 1.4, done: false, win: true, dur: 1.4, tin: 0.5 };
    } else {
      this.switchDeep = { T: 1.1, done: false, win: false, dur: 1.1, tin: 0.5 };
    }
    sfx('stairs');
    this.player.control = false;
  }
  _doFloorAdvance() {
    if (this.switchDeep && this.switchDeep.win) { this.finishRun(true); return; }
    this.floorIdx++;
    this.stats.floor = this.floorIdx;
    // 楼层过渡回复半颗红心
    const p = this.player;
    p.heal(1);
    this.hpDirty = true;
    this.buildFloor();
  }

  onPlayerDied() {
    this.state = 'dying';
    this.deathAnimT = 1.6;
    const p = this.player;
    // 红心碎裂 + 白光 + 大顿帧
    this.parts.heartShards(p.x, p.y - 6);
    this.parts.ring(p.x, p.y - 6, '#fff', 22);
    this.hitStop = 0.25;
    this.shake(12);
    sfx('death');
    hud.bossBar(false);
    this.stats.time = this.statTimer;
  }
  finishRun(win) {
    this.state = win ? 'win' : 'dead';
    this.stats.time = this.statTimer;
    this.player.dead = true;
    hud.bossBar(false);
    if (win) sfx('win');
  }

  shake(mag) {
    this.shakeT = Math.max(this.shakeT, 0.22);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  // 诊断快照(自动化验证)
  diag() {
    const room = this.currentRoom;
    const p = this.player;
    const pc = room ? room.pickups : [];
    return {
      state: this.state, floorIdx: this.floorIdx,
      cur: room ? {
        idx: room.idx, role: room.role, cleared: room.cleared, sealed: room.sealed,
        spawned: room.spawned, doors: room.doors.map(d => d.dir + (d.boss ? '*' : '') + ':' + d.to),
        chest: room.chest ? { opened: room.chest.opened } : null,
        stairs: !!room.stairs,
      } : null,
      map: this.floor ? {
        count: this.floor.nodes.length,
        roles: this.floor.nodes.map(n => n.role),
        start: this.floor.startRoom, boss: this.floor.bossRoom,
      } : null,
      player: p ? {
        x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, maxHp: p.maxHp,
        containers: p.containers + p.addContainers, items: p.items.slice(),
        dmg: +p.dmg.toFixed(2), interval: +p.interval.toFixed(3),
        speed: Math.round(p.speed), range: +p.rangeTiles.toFixed(2),
        flags: Object.keys(p.f).filter(k => p.f[k]),
        slashes: p.slashes || 0,
        dead: p.dead, god: !!p.god,
      } : null,
      enemies: this.enemies.filter(e => !e.dead).map(e => e.kind),
      boss: this.boss && !this.boss.dead ? { kind: this.boss.kind, hpPct: Math.round(this.boss.halfHp * 100), state: this.boss.state } : null,
      counts: {
        pTears: this.pTears.length, eTears: this.eTears.length, lasers: this.lasers.length,
        blades: this.pTears.filter(t => t.blade).length, parts: this.parts.list.length,
      },
      pickups: pc.map(k => k.kind + (k.item ? ':' + k.item.id : ':' + (k.amount || ''))),
      stats: { ...this.stats },
      time: +this.statTimer.toFixed(1),
    };
  }

  // ================= 渲染 =================
  draw() {
    const g = this.g;
    // 适配超采样分辨率(逻辑 960x640, 内部可能 1920x1280)
    const vs = this.canvas ? this.canvas.width / VIEW_W : 1;
    g.setTransform(vs, 0, 0, vs, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!this.currentRoom) { this.drawIdle(g); return; }
    const room = this.currentRoom;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= 1 / 60;
      const m = this.shakeMag;
      sx = (Math.random() - 0.5) * m * (this.shakeT / 0.22);
      sy = (Math.random() - 0.5) * m * (this.shakeT / 0.22);
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    g.save();
    g.translate(Math.round(sx), Math.round(sy));
    // BG
    g.drawImage(room.bg || room.ensureBg(), 0, 0);
    // 火把光
    this.drawLights(g, room);
    // 拾取物/宝箱/楼梯
    this.drawPickups(g);
    this.drawChest(g, room);
    this.drawStairs(g);
    // 敌人 & Boss
    for (const e of this.enemies) e.draw(g);
    if (this.boss) this.boss.draw(g);
    // 玩家
    if (this.player) this.player.draw(g);
    // 弹体
    for (const t of this.pTears) t.draw(g);
    for (const t of this.eTears) t.draw(g);
    this.drawLasers(g);
    this.parts.draw(g);
    // 门锁
    this.drawDoorLocks(g, room);
    g.restore();
    // 鼠标瞄准准星
    if (this.state === 'play' && input.mouseDown && this.player && !this.player.dead) {
      const m = input.mouseWorld();
      g.save();
      g.strokeStyle = 'rgba(255,235,180,0.85)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(m.x, m.y, 7, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(m.x - 12, m.y); g.lineTo(m.x - 4, m.y);
      g.moveTo(m.x + 4, m.y); g.lineTo(m.x + 12, m.y);
      g.moveTo(m.x, m.y - 12); g.lineTo(m.x, m.y - 4);
      g.moveTo(m.x, m.y + 4); g.lineTo(m.x, m.y + 12);
      g.stroke();
      g.restore();
    }
    // 切房淡入淡出
    if (this.switch) {
      const k = this.switch.done ? Math.max(0, Math.min(1, this.switch.T / 0.24)) : Math.max(0, Math.min(1, (0.22 - this.switch.T) / 0.22));
      g.fillStyle = 'rgba(2,2,6,' + (this.switch.done ? 1 - k : k) + ')';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.switchDeep) {
      const sd = this.switchDeep;
      const a = sd.done ? Math.max(0, sd.T / sd.tin) : Math.max(0, (sd.dur - sd.T) / sd.dur);
      g.fillStyle = 'rgba(1,1,4,' + Math.min(1, a) + ')';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // 死亡红晕
    if (this.state === 'dying' || this.state === 'dead') {
      const a = this.state === 'dead' ? 0.5 : Math.min(0.6, (1.5 - this.deathAnimT) * 0.5);
      g.fillStyle = 'rgba(120,0,0,' + a + ')';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawIdle(g) {
    g.fillStyle = '#0a0806';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---------------- 楼层小地图 ----------------
  knownRoom(i) {
    const r = this.rooms[i];
    if (!r) return false;
    if (r.visited) return true;
    // 已探索房间的相邻房间: 显示为“已知轮廓”
    for (const d of r.doors) {
      const nb = this.rooms[d.to];
      if (nb && nb.visited) return true;
    }
    return false;
  }

  drawMinimap(g) {
    if (!this.floor) return;
    const W = g.canvas.width, H = g.canvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0a0d12';
    g.fillRect(0, 0, W, H);
    const nodes = this.floor.nodes;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const n of nodes) {
      minX = Math.min(minX, n.gx); maxX = Math.max(maxX, n.gx);
      minY = Math.min(minY, n.gy); maxY = Math.max(maxY, n.gy);
    }
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const pad = 10;
    const cw = (W - pad * 2) / cols, ch = (H - pad * 2) / rows;
    const size = Math.max(9, Math.min(cw, ch) - 7);
    const pos = (n) => ({ x: pad + (n.gx - minX) * cw + cw / 2, y: pad + (n.gy - minY) * ch + ch / 2 });

    // 门连线
    g.strokeStyle = '#2b3542';
    g.lineWidth = 2;
    for (let i = 0; i < nodes.length; i++) {
      if (!this.knownRoom(i)) continue;
      const p = pos(nodes[i]);
      for (const d of this.rooms[i].doors) {
        if (!this.knownRoom(d.to)) continue;
        const q = pos(nodes[d.to]);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      }
    }
    // 房间格
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i], r = this.rooms[i];
      const p = pos(n);
      const x = p.x - size / 2, y = p.y - size / 2;
      if (!this.knownRoom(i)) { continue; }   // 未探索: 不显示(保留迷雾)
      let col = '#3d4a5c';
      if (n.role === 'start') col = '#37756f';
      else if (n.role === 'treasure') col = '#8a6a24';
      else if (n.role === 'boss') col = '#7d2b2b';
      g.fillStyle = r.visited ? col : '#1d232c';
      g.fillRect(x, y, size, size);
      g.strokeStyle = r.visited ? '#8195aa' : '#39434f';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      if (r.visited) {
        g.fillStyle = '#eaf1f8';
        g.font = 'bold 11px monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (n.role === 'boss') g.fillText('☠', p.x, p.y + 1);
        else if (n.role === 'treasure') g.fillText('▣', p.x, p.y + 1);
        else if (n.role === 'start') g.fillText('⌂', p.x, p.y + 1);
        else if (r.cleared) g.fillText('·', p.x, p.y + 1);
      }
      if (i === this.currentRoomIdx) {
        g.strokeStyle = '#ffe9a0';
        g.lineWidth = 2;
        g.strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
      }
      if (r.stairs && r.visited) {
        g.fillStyle = '#8ff0ff';
        g.font = 'bold 10px monospace';
        g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText('▼', p.x, y + size + 1);
      }
    }
  }

  drawLights(g, room) {
    const torches = room.decors.filter(d => d.kind === 'torch');
    if (!torches.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const flick = 0.7 + Math.sin(this.fxTime * 9 + torches[0].seed) * 0.12;
    for (const t of torches) {
      const x = t.cx * T + T / 2, y = t.cy * T + T / 2 - 14;
      const f = flick * (0.85 + Math.sin(this.fxTime * 13 + t.seed * 3) * 0.15);
      const grad = g.createRadialGradient(x, y, 4, x, y, 120);
      // 低饱和冷调环境光(虫巢磷光)
      const col = '168,196,206';
      grad.addColorStop(0, 'rgba(' + col + ',' + (0.15 * f) + ')');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 120, 0, 7);
      g.fill();
    }
    g.restore();
  }

  drawPickups(g) {
    const heartSp = heartPickupSprite();
    const pedSp = pedestalSprite();
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(pk.t * 3 + pk.x * 0.02) * 3;
      if (pk.kind === 'heart') {
        const sp = heartSp;
        g.save();
        g.shadowColor = 'rgba(255,80,80,0.5)';
        g.shadowBlur = 12;
        drawSprite(g, sp, pk.x, pk.y - 8 + bob, 1);
        g.restore();
      } else if (pk.kind === 'item' && pk.item) {
        const item = pk.item;
        // 光柱底座
        g.save();
        g.globalCompositeOperation = 'lighter';
        const grad = g.createRadialGradient(pk.x, pk.y - 6, 2, pk.x, pk.y - 6, 40);
        grad.addColorStop(0, item.aura + 'aa');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(pk.x, pk.y - 6, 40, 0, 7); g.fill();
        g.restore();
        drawSprite(g, pedSp, pk.x, pk.y + 2, 1);
        // 旋转微光 + 图标
        const icon = iconSprite(item.id, item.aura);
        const bounce = Math.abs(Math.sin(pk.t * 2)) * 4;
        drawSprite(g, icon, pk.x, pk.y - 22 - bounce, 1);
      }
    }
  }

  drawChest(g, room) {
    if (!room.chest) return;
    const sp = chestSprite(room.chest.opened);
    const bob = room.chest.opened ? 0 : Math.sin(this.fxTime * 2.4) * 1.5;
    drawSprite(g, sp, room.chest.x, room.chest.y - 10 + bob, 1);
    if (room.cleared && !room.chest.opened) {
      g.save();
      g.globalAlpha = 0.5 + Math.sin(this.fxTime * 4) * 0.25;
      g.strokeStyle = '#ffe9a0';
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(room.chest.x, room.chest.y - 12, 40, 28, 0, 0, 7); g.stroke();
      g.restore();
    }
  }

  drawStairs(g) {
    if (!this.stairs) return;
    const s = this.stairs;
    s.t = (s.t || 0) + 1 / 60;
    // 发光洞 + 台阶
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grad = g.createRadialGradient(s.x, s.y, 2, s.x, s.y, 46);
    grad.addColorStop(0, 'rgba(120,220,255,' + (0.35 + Math.sin(s.t * 3) * 0.15) + ')');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(s.x, s.y, 46, 0, 7); g.fill();
    g.restore();
    g.fillStyle = '#0a0a14';
    g.beginPath(); g.ellipse(s.x, s.y + 4, 26, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#5a6470';
    for (let i = 0; i < 4; i++) {
      g.fillRect(s.x - 16 + i * 3, s.y - 2 + i * 4, 32 - i * 5, 3);
      g.fillStyle = '#39414c';
      g.fillRect(s.x - 16 + i * 3, s.y + 1 + i * 4, 32 - i * 5, 1.5);
    }
    g.fillStyle = '#0a0a14';
    g.beginPath(); g.ellipse(s.x, s.y + 2, 12, 8, 0, 0, 7); g.fill();
    // 箭头提示
    g.fillStyle = '#bfe8ff';
    g.font = '14px monospace';
    g.textAlign = 'center';
    g.globalAlpha = 0.6 + Math.sin(s.t * 5) * 0.3;
    g.fillText('▼', s.x, s.y - 24);
    g.globalAlpha = 1;
    g.restore();
  }

  drawLasers(g) {
    for (const L of this.lasers) {
      if (L.endX === undefined) continue;
      const cos = Math.cos(L.ang), sin = Math.sin(L.ang);
      const sx = L.x + cos * 12, sy = L.y + sin * 12 - 2;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const grad = g.createLinearGradient(sx, sy, L.endX, L.endY);
      grad.addColorStop(0, 'rgba(190,240,255,0.9)');
      grad.addColorStop(1, 'rgba(120,180,255,0.35)');
      g.strokeStyle = grad;
      g.lineCap = 'round';
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(L.endX, L.endY); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(L.endX, L.endY); g.stroke();
      g.restore();
    }
  }

  drawDoorLocks(g, room) {
    if (!room.sealed) return;
    g.save();
    for (const d of room.doors) {
      const c = d.cell;
      const x0 = c.cx * T, y0 = c.cy * T;
      // 铁栅栏
      g.fillStyle = 'rgba(10,10,14,0.55)';
      g.fillRect(x0, y0, T, T);
      const bars = 3;
      for (let i = 0; i < bars; i++) {
        const vertical = d.dir === 'N' || d.dir === 'S';
        const pos = vertical ? x0 + T * (0.25 + i * 0.25) : y0 + T * (0.25 + i * 0.25);
        g.fillStyle = d.boss ? '#7c2a22' : '#565b66';
        if (vertical) g.fillRect(pos - 3, y0 + 4, 6, T - 8);
        else g.fillRect(x0 + 4, pos - 3, T - 8, 6);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        if (vertical) g.fillRect(pos - 3, y0 + 4, 2, T - 8);
        else g.fillRect(x0 + 4, pos - 3, T - 8, 2);
      }
    }
    g.restore();
  }
}
