// dungeon.js — 随机地牢生成(以撒式: 每层 5-8 个普通/奖励房间 + 1 个 Boss 房, 4 向门连通)
import { CFG, THEMES } from '../config.js';
import { Rng } from '../util.js';

export function genFloor(floorIdx, seed) {
  const rng = new Rng((seed * 7919 + floorIdx * 104729) >>> 0);
  const { mapW: MW, mapH: MH, minRooms, maxRooms } = CFG.DUNGEON;
  const want = minRooms + rng.int(0, maxRooms - minRooms);

  // 1) 从中央随机生长的连通房间簇
  const used = new Map();      // "gx,gy" -> node index
  const nodes = [];
  const sx = rng.int(2, MW - 3), sy = rng.int(2, MH - 3);
  const key = (x, y) => x + ',' + y;
  const addCell = (x, y) => {
    if (used.has(key(x, y))) return;
    const idx = nodes.length;
    nodes.push({ gx: x, gy: y, role: 'normal' });
    used.set(key(x, y), idx);
  };
  addCell(sx, sy);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let guard = 0;
  while (nodes.length < want && guard++ < 300) {
    const n = nodes[rng.int(0, nodes.length - 1)];
    const dirs = DIRS.slice().sort(() => rng.float() - 0.5);
    let ok = false;
    for (const [dx, dy] of dirs) {
      const x = n.gx + dx, y = n.gy + dy;
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      if (used.has(key(x, y))) continue;
      addCell(x, y); ok = true; break;
    }
    if (!ok && nodes.length < want) {
      // 全部堵死则把簇内随机一格平移重试
      addCell(nodes[0].gx + 1, nodes[0].gy);
    }
  }

  // 2) 计算最短路径深度, 在最远端旁挂 Boss 房
  const adjOf = (idx) => {
    const n = nodes[idx], out = [];
    for (const [dx, dy] of DIRS) {
      const j = used.get(key(n.gx + dx, n.gy + dy));
      if (j !== undefined) out.push(j);
    }
    return out;
  };
  const bfs = (src) => {
    const dist = new Array(nodes.length).fill(-1);
    dist[src] = 0;
    const q = [src];
    while (q.length) {
      const i = q.shift();
      for (const j of adjOf(i)) if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
    }
    return dist;
  };
  const distFromStart = bfs(0);
  // 最远节点
  let far = 0, farD = -1;
  for (let i = 0; i < nodes.length; i++) if (distFromStart[i] > farD) { farD = distFromStart[i]; far = i; }
  // 在 far 旁找空闲格挂 Boss; 找不到则沿路径找可挂点
  const tryAttach = (baseIdx) => {
    const dirs = DIRS.slice().sort(() => rng.float() - 0.5);
    for (const [dx, dy] of dirs) {
      const x = nodes[baseIdx].gx + dx, y = nodes[baseIdx].gy + dy;
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      if (used.has(key(x, y))) continue;
      const idx = nodes.length;
      nodes.push({ gx: x, gy: y, role: 'boss' });
      used.set(key(x, y), idx);
      return idx;
    }
    return -1;
  };
  let bossIdx = tryAttach(far);
  if (bossIdx < 0) {
    // 顺路径往 start 找
    let cur = far;
    while (distFromStart[cur] > 1) {
      for (const j of adjOf(cur)) if (distFromStart[j] === distFromStart[cur] - 1) { cur = j; break; }
      bossIdx = tryAttach(cur);
      if (bossIdx >= 0) break;
    }
  }
  if (bossIdx < 0) { // 兜底: 强加一格
    bossIdx = nodes.length;
    nodes.push({ gx: far.gx + 1, gy: far.gy, role: 'boss' });
    used.set(key(far.gx + 1, far.gy), bossIdx);
  }

  // 3) 角色: start / treasure(选 1-2 个较深处的普通房)
  nodes[0].role = 'start';
  const normalIdx = [];
  for (let i = 1; i < nodes.length; i++) if (nodes[i].role !== 'boss') normalIdx.push(i);
  normalIdx.sort((a, b) => distFromStart[b] - distFromStart[a]);
  const treasureCount = normalIdx.length >= 3 ? rng.int(1, Math.min(2, Math.floor(normalIdx.length / 2))) : (normalIdx.length === 2 ? 1 : 0);
  for (let i = 0; i < treasureCount && i < normalIdx.length; i++) {
    nodes[normalIdx[i]].role = 'treasure';
  }
  // 商店房: 房间数够多时保证 1 间(排在宝藏房之后)
  if (normalIdx.length - treasureCount >= 2) {
    nodes[normalIdx[treasureCount]].role = 'shop';
  }

  // 4) Boss 房要经由"它的上一个房间"可达(挂在它连接到的普通房)
  const bossAdj = adjOf(bossIdx);
  nodes[bossIdx].gateIdx = bossAdj.length ? bossAdj[0] : (bossIdx - 1 >= 0 ? bossIdx - 1 : 0);

  return {
    floorIdx,
    themeNo: THEMES[Math.min(floorIdx, 3)] ? Math.min(floorIdx, 3) : 3,
    startRoom: 0,
    bossRoom: bossIdx,
    nodes,
    used,
  };
}

// 某个节点相邻的门方向 → 邻居节点idx (含Boss门)
export function neighborsOf(floor, idx) {
  const n = floor.nodes[idx];
  const out = [];
  const DIRS = [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E']];
  for (const [dx, dy, d] of DIRS) {
    const j = floor.used.get((n.gx + dx) + ',' + (n.gy + dy));
    if (j !== undefined) out.push({ dir: d, to: j });
  }
  return out;
}

// 普通房间敌人池(按层)
export function enemyPool(floorIdx) {
  if (floorIdx >= 3) return ['fly', 'gaper', 'slime', 'skelly', 'imp'];
  if (floorIdx === 2) return ['fly', 'gaper', 'slime', 'skelly'];
  return ['fly', 'gaper', 'slime'];
}
