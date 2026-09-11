// room.js — 房间对象: 布局生成/装饰/敌人生成位/门与封锁/BG渲染
// 房间网格 15x10, 边框为墙; 门洞在边墙上单个格: N(7,0) S(7,9) W(0,5) E(14,5)
import { CFG, THEMES } from '../config.js';
import { Rng } from '../util.js';
import { neighborsOf, enemyPool } from './dungeon.js';
import { rockSprite, spikeSprite, chestSprite, pedestalSprite, skullSprite, boneSprite, mushroomSprite, torchSprite, skullMarkSprite } from '../art/world.js';

export const T = CFG.TILE, COLS = CFG.COLS, ROWS = CFG.ROWS;
export const DOOR_CELL = { N: { cx: 7, cy: 0 }, S: { cx: 7, cy: 9 }, W: { cx: 0, cy: 5 }, E: { cx: 14, cy: 5 } };
export const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };

// 主题附加配色(低饱和)
const TX = {
  1: { wall: '#3a4146', wallTop: '#596268', mortar: '#262c31', stain: ['#2e3a3a', '#263133', '#35413c', '#283033'], light: '#a8c8c0' },
  2: { wall: '#343a45', wallTop: '#4f5866', mortar: '#242a33', stain: ['#2b3038', '#232830', '#323844'], light: '#9fc8d8' },
  3: { wall: '#272e37', wallTop: '#46515c', mortar: '#181d24', stain: ['#202a2e', '#1c2429', '#2a3338'], light: '#8fb8c4' },
};

export class Room {
  constructor(floor, idx) {
    const node = floor.nodes[idx];
    this.floor = floor;
    this.idx = idx;
    this.node = node;
    this.role = node.role;
    this.themeNo = floor.themeNo;
    this.rng = new Rng((floor.seed * 65599 + idx * 17) >>> 0);
    // 门
    this.doors = neighborsOf(floor, idx).map(n => ({
      ...n,
      cell: DOOR_CELL[n.dir],
      boss: n.to === floor.bossRoom,
    }));
    this.tiles = new Uint8Array(COLS * ROWS);      // 内部障碍: 1=岩石 2=尖刺
    this.rockVar = new Uint8Array(COLS * ROWS);
    this.decors = [];      // {cx,cy,kind,flip}
    this.stains = [];      // {cx,cy,r,color,alpha}
    this.pending = [];     // 待生成的敌人 {kind,x,y,mini}
    this.sealed = false;   // 有敌人/未清时封门
    this.cleared = false;
    this.spawned = false;
    this.chest = null;     // {x,y,opened,content}
    this.bg = null;
    this.entryVisited = 0;
    this._build();
  }

  _cell(cx, cy) { return cy * COLS + cx; }
  inside(cx, cy) { return cx >= 1 && cx <= 13 && cy >= 1 && cy <= 8; }
  isWall(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    if (cx === 0 || cx === 14 || cy === 0 || cy === 9) {
      // 门洞非墙
      for (const d of this.doors) if (d.cell.cx === cx && d.cell.cy === cy) return false;
      return true;
    }
    return false;
  }
  solid(cx, cy) {
    // 封门(有敌人)时, 门洞也被铁栅栏堵住 —— 真正挡住玩家
    if (this.sealed) {
      for (const d of this.doors) if (d.cell.cx === cx && d.cell.cy === cy) return true;
    }
    if (this.isWall(cx, cy)) return true;
    const t = this.tiles[this._cell(cx, cy)];
    return t === 1;   // 尖刺非实体
  }
  // 该格是否为某种内部障碍
  tileType(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 0;
    if (this.isWall(cx, cy)) return 0;
    return this.tiles[this._cell(cx, cy)];
  }
  doorPassable() { return !this.sealed; }

  _build() {
    const rng = this.rng;
    // ---- 障碍 ----
    const isDoorLane = (cx, cy) => {
      for (const d of this.doors) {
        const dc = d.cell;
        // 门道前方留 2 格走廊
        const dx = Math.abs(cx - dc.cx), dy = Math.abs(cy - dc.cy);
        const horiz = dc.cx === 0 || dc.cx === 14;
        if (horiz) { if (dy === 0 && dx <= 2) return true; }
        else if (dx === 0 && dy <= 2) return true;
      }
      return false;
    };
    const ringFree = (cx, cy) => cx === 1 || cx === 13 || cy === 1 || cy === 8;
    if (this.role !== 'boss') {
      const rockCount = this.role === 'start' ? rng.int(1, 2) :
        this.role === 'treasure' ? rng.int(1, 3) :
          Math.min(7, rng.int(2, 4) + this.floor.floorIdx);
      let placed = 0, guard = 0;
      while (placed < rockCount && guard++ < 200) {
        const cx = rng.int(1, 13), cy = rng.int(1, 8);
        if (ringFree(cx, cy)) continue;
        if (isDoorLane(cx, cy)) continue;
        const i = this._cell(cx, cy);
        if (this.tiles[i]) continue;
        // 别把中心出生区堵死(只堵离中心足够远)
        if (Math.abs(cx - 7) <= 1 && Math.abs(cy - 4) <= 1 && placed < rockCount - 1) continue;
        this.tiles[i] = 1;
        this.rockVar[i] = rng.int(0, 1);
        placed++;
      }
    } else {
      // Boss 房少量掩体(边缘)
      const spots = [[3, 2], [11, 2], [3, 6], [11, 6]];
      for (const [cx, cy] of spots) {
        if (rng.chance(0.5)) { this.tiles[this._cell(cx, cy)] = 1; this.rockVar[this._cell(cx, cy)] = rng.int(0, 1); }
      }
    }
    // 装饰(骷髅/骨/蘑菇/烛台)与污渍
    for (let i = 0; i < 26; i++) {
      const cx = rng.int(0, 14), cy = rng.int(0, 9);
      if (!this.inside(cx, cy)) continue;
      if (this.tiles[this._cell(cx, cy)]) continue;
      if (ringFree(cx, cy) && this.role !== 'boss') continue;
      if (rng.chance(0.4)) {
        const r = rng.float(0.3, 0.9);
        const col = rng.pick(TX[this.themeNo].stain);
        this.stains.push({ cx, cy, r, color: col, alpha: rng.float(0.25, 0.5) });
      }
      if (this.decors.length < 13 && rng.chance(0.32)) {
        const kind = rng.pick(['skull', 'bone', 'bone', 'mush', 'mush']);
        this.decors.push({ cx, cy, kind, flip: rng.chance(0.5), seed: rng.int(0, 99) });
      }
    }
    // 火把: 贴墙的室内格
    const torchSpots = [[1, 2], [13, 2], [1, 6], [13, 6], [3, 1], [11, 1], [3, 8], [11, 8], [7, 1], [7, 8]];
    let torches = 0;
    for (const [cx, cy] of torchSpots) {
      if (this.role === 'boss' && (cx === 1 || cx === 13)) continue;
      if (!this.tiles[this._cell(cx, cy)] && torches < 4 && rng.chance(0.55)) {
        this.decors.push({ cx, cy, kind: 'torch', flip: false, seed: rng.int(0, 99) });
        torches++;
      }
    }
    // 中心祭坛/宝箱(奖励房)
    if (this.role === 'treasure') {
      this.chest = { x: 7 * T + T / 2, y: 4 * T + T / 2, opened: false };
    }
    // ---- 敌人名单 ----
    if (this.role === 'normal' || this.role === 'treasure') {
      const pool = enemyPool(this.floor.floorIdx);
      const n = this.role === 'treasure' ? rng.int(1, 2) : Math.min(5, 2 + this.floor.floorIdx + rng.int(0, 1));
      const attempts = [];
      let g = 0;
      while (attempts.length < n && g++ < 300) {
        const cx = rng.int(3, 11), cy = rng.int(2, 6);
        if (this.tiles[this._cell(cx, cy)]) continue;
        if (isDoorLane(cx, cy) && !ringFree(cx, cy)) continue;
        // 保持彼此与中心距离
        const px = cx * T + T / 2, py = cy * T + T / 2;
        if (Math.abs(cx - 7) <= 1 && Math.abs(cy - 4) <= 1) continue;
        let tooClose = false;
        for (const a of attempts) if (Math.hypot(a.x - px, a.y - py) < 2.2 * T) { tooClose = true; break; }
        if (tooClose) continue;
        attempts.push({ x: px, y: py });
      }
      for (const a of attempts) {
        const kind = rng.pick(pool);
        this.pending.push({ kind, x: a.x, y: a.y, mini: kind === 'slime' && rng.chance(0.4) });
      }
      // 精英怪: 15% 概率挑一只(金环外观/2.4倍血/必掉道具)
      if (attempts.length && rng.chance(0.16)) {
        const a = attempts[rng.int(0, attempts.length - 1)];
        const p = this.pending.find(pp => pp.x === a.x && pp.y === a.y);
        if (p) p.elite = true;
      }
    }
  }

  // ---- BG 预渲染(地板/墙/装饰/岩石/门) ----
  ensureBg() {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = CFG.VIEW_W; c.height = CFG.VIEW_H;
    const g = c.getContext('2d');
    const th = THEMES[this.themeNo];
    const tx = TX[this.themeNo];
    const rng = this.rng;
    const h = (v) => (v * 73856093 ^ (v >> 3) * 19349663) & 0xffff;

    // 地板
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const x = cx * T, y = cy * T;
        const wall = this.isWall(cx, cy);
        let col;
        if (wall) {
          // 墙砖
          const base = (cx * 7 + cy * 13 + (h(cx * 3 + cy * 5) % 3)) % 3 === 0 ? tx.wallTop : tx.wall;
          g.fillStyle = base;
          g.fillRect(x, y, T, T);
          // 砖缝
          g.fillStyle = tx.mortar;
          if ((cy + (cx % 2)) % 2 === 0) g.fillRect(x, y + T - 2, T, 2);
          else g.fillRect(x + T - 2, y, 2, T);
          // 上沿受光
          g.fillStyle = 'rgba(255,240,200,0.10)';
          g.fillRect(x, y, T, 2);
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.fillRect(x, y + T - 3, T, 1);
        } else {
          const v = (h(cx * 31 + cy * 17) % th.floor.length);
          g.fillStyle = th.floor[v];
          g.fillRect(x, y, T, T);
          // 细微颗粒
          const specks = 2 + (h(cx * 5 + cy * 9) % 3);
          for (let i = 0; i < specks; i++) {
            const sx = x + ((h(cx + i * 13 + cy * 7) * 53) % 61);
            const sy = y + ((h(cy + i * 29 + cx * 3) * 47) % 61);
            g.fillStyle = (h(sx + sy * 11) & 1) ? th.floorDark : 'rgba(255,255,255,0.05)';
            g.fillRect(sx, sy, 2, 2);
          }
        }
      }
    }
    // 靠近墙的地板阴影(环境光遮蔽)
    for (let cy = 0; cy < ROWS; cy++)
      for (let cx = 0; cx < COLS; cx++) {
        if (this.isWall(cx, cy) || this.tiles[this._cell(cx, cy)]) continue;
        let adjWall = 0;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]])
          if (this.isWall(cx + dx, cy + dy)) adjWall++;
        if (adjWall) {
          g.fillStyle = 'rgba(0,0,0,' + (0.18 * adjWall) + ')';
          g.fillRect(cx * T, cy * T, T, T);
        }
      }
    // 污渍
    for (const s of this.stains) {
      g.globalAlpha = s.alpha;
      g.fillStyle = s.color;
      g.beginPath();
      g.ellipse(s.cx * T + T / 2, s.cy * T + T / 2, T * 0.42 * s.r, T * 0.3 * s.r, 0, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
    // 门洞(先画洞再画框)
    for (const d of this.doors) {
      const { cx, cy } = d.cell;
      const x = cx * T, y = cy * T;
      g.fillStyle = '#030208';
      g.fillRect(x, y, T, T);
      // 门框
      const horiz = d.dir === 'N' || d.dir === 'S';
      const fw = horiz ? 8 : T, fh = horiz ? T : 8;
      g.fillStyle = tx.wallTop;
      if (horiz) { g.fillRect(x, y, fw, fh); g.fillRect(x + T - fw, y, fw, fh); }
      else { g.fillRect(x, y, fw, fh); g.fillRect(x, y + T - fh, fw, fh); }
      // 门洞透光色(微弱)
      g.fillStyle = 'rgba(120,110,140,0.12)';
      g.fillRect(x + 4, y + 4, T - 8, T - 8);
    }
    // 装饰与岩石
    const rockS = [rockSprite(0), rockSprite(1)];
    const kinds = { skull: skullSprite(), bone: boneSprite(), mush: mushroomSprite(), torch: torchSprite() };
    for (const d of this.decors) {
      const sp = kinds[d.kind];
      const x = d.cx * T + T / 2, y = d.cy * T + T / 2;
      g.imageSmoothingEnabled = false;
      g.save();
      if (d.flip) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }
      const sc = 3;
      g.drawImage(sp, x - (sp.width * sc) / 2, y - (sp.height * sc) / 2 + (d.kind === 'torch' ? -6 : 0), sp.width * sc, sp.height * sc);
      g.restore();
    }
    // 尖刺与岩石(铺在地砖上)
    const spikeSp = spikeSprite();
    for (let cy = 1; cy <= 8; cy++)
      for (let cx = 1; cx <= 13; cx++) {
        const i = this._cell(cx, cy);
        const t = this.tiles[i];
        const x = cx * T, y = cy * T;
        if (t === 1) {
          const sp = rockS[this.rockVar[i]];
          g.imageSmoothingEnabled = false;
          g.drawImage(sp, x + T / 2 - (sp.width * 2.4) / 2, y + T / 2 - (sp.height * 2.4) / 2 + 6, sp.width * 2.4, sp.height * 2.4);
        } else if (t === 2) {
          g.imageSmoothingEnabled = false;
          g.drawImage(spikeSp, x + T / 2 - (spikeSp.width * 2.2) / 2, y + T - spikeSp.height * 2.2 - 2, spikeSp.width * 2.2, spikeSp.height * 2.2);
        }
      }
    // 中央祭坛台(奖励/宝箱房间的底座)
    if (this.chest) {
      const sp = chestSprite(false);
      g.imageSmoothingEnabled = false;
      g.drawImage(sp, this.chest.x - (sp.width * 3) / 2, this.chest.y - (sp.height * 3) / 2 - 6, sp.width * 3, sp.height * 3);
    }
    // Boss 门: 门前画警示骷髅头
    for (const d of this.doors) {
      if (!d.boss) continue;
      const { cx, cy } = d.cell;
      const px = cx * T + T / 2;
      const py = (d.dir === 'N') ? cy * T + T : (d.dir === 'S') ? cy * T - T : (d.dir === 'W') ? cy * T + T / 2 : cy * T + T / 2;
      const sp = skullMarkSprite();
      const sc = 3;
      g.imageSmoothingEnabled = false;
      g.drawImage(sp, px - (sp.width * sc) / 2, py - 20 - (sp.height * sc) / 2 + (d.dir === 'N' ? 6 : d.dir === 'S' ? -6 : 0), sp.width * sc, sp.height * sc);
    }
    // 暗角晕影
    const vg = g.createRadialGradient(480, 320, 220, 480, 320, 640);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = vg;
    g.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    this.bg = c;
    return c;
  }
}
