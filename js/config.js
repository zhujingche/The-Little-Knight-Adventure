// 小骑士的探险 — 全局配置与常量
export const CFG = {
  VIEW_W: 960,
  VIEW_H: 640,
  TILE: 64,
  COLS: 15,       // 房间网格列(含墙)
  ROWS: 10,       // 房间网格行(含墙)
  SPR_SCALE: 3,   // 像素精灵放大倍数(硬像素风)

  // ---- 角色基础属性(以撒式: 泪弹=攻击) ----
  PLAYER: {
    radius: 10.5,
    baseHp: 3,           // 红心容器数
    maxContainers: 9,
    baseDmg: 3.4,        // 单颗圣泪伤害
    baseInterval: 0.46,  // 发泪间隔(秒)
    baseSpeed: 158,      // px/s
    baseRange: 5.6,      // 圣泪飞行格数(tile)
    minInterval: 0.075,
    iFrames: 0.75,       // 受伤无敌(秒)
    hitStop: 0.16,
    knockRes: 0.35,
  },

  // ---- 数值成长每点 ----
  STAT_DMG_UP: 0.9,      // 每级 +伤害
  STAT_RATE_UP: 0.16,    // 每级 射速提升(间隔 *= (1-r)) -> 伤害率
  STAT_SPEED_UP: 13,     // 每级 +px/s
  STAT_RANGE_UP: 0.8,    // 每级 +格
  STAT_HP_UP: 1,         // 每级 +红心容器

  TEAR: { speed: 250, radius: 5.5, knock: 60, critChance: 0 },

  // ---- 地牢生成 ----
  DUNGEON: {
    minRooms: 5,
    maxRooms: 8,
    floorsToWin: 3,
    mapW: 9,
    mapH: 7,
  },

  // ---- 敌人参数(每层敌人受伤倍率随层数上涨) ----
  ENEMY_HP_SCALE: { 1: 1.0, 2: 1.5, 3: 2.0 },

  TIME_SCALE: 1,
};

// 地牢主题(美术配色): 依层数切换(低饱和、灰蓝暗绿、虫巢废墟感)
export const THEMES = {
  1: {
    name: '残破虫巢',
    floor: ['#4a4f52', '#47504e', '#4e5457', '#434b49'],
    floorDark: '#31393c',
    wall: '#3a4146',
    wallTop: '#596268',
    accent: '#232a2f',
    torch: true,
  },
  2: {
    name: '幽暗墓窟',
    floor: ['#414650', '#3e434c', '#454a54', '#3b414b'],
    floorDark: '#2c313b',
    wall: '#343a45',
    wallTop: '#4f5866',
    accent: '#1d212a',
    torch: true,
  },
  3: {
    name: '废弃深巢',
    floor: ['#333a40', '#303740', '#363d43', '#2e353d'],
    floorDark: '#21262d',
    wall: '#272e37',
    wallTop: '#46515c',
    accent: '#14181e',
    torch: false,
    ember: false,
  },
};

export const FLOOR_LABELS = ['I', 'II', 'III', 'IV', 'V'];
