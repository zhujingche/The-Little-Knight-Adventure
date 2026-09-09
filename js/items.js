// items.js — 道具目录/应用/随机池(以撒式: 改变攻击/属性/外观)
// 结构: { id, name, desc, aura, w, floorMin, apply(p, game) }
export const ITEMS = [
  // ---- 改变攻击方式 ----
  { id: 'tri', name: '三连圣泪', desc: '发射圣泪变成三发扇形齐射', aura: '#7fc8ff', w: 3, apply(p) { p.f.tri = true; } },
  { id: 'quad', name: '四方圣泪', desc: '朝上下左右同时射出圣泪', aura: '#7fa8ff', w: 2, apply(p) { p.f.quad = true; } },
  { id: 'pierce', name: '贯穿圣泪', desc: '圣泪可穿透敌人继续飞行', aura: '#ffe9a0', w: 3, apply(p) { p.f.pierce = true; p.addDmg += 0.6; } },
  { id: 'spectral', name: '幽灵圣泪', desc: '圣泪可穿过岩石障碍', aura: '#b8b0e8', w: 3, apply(p) { p.f.spectral = true; p.addRange += 1; } },
  { id: 'homing', name: '圣光指引', desc: '圣泪自动追踪最近的敌人', aura: '#ffe98a', w: 3, apply(p) { p.f.homing = true; } },
  { id: 'split', name: '裂心圣泪', desc: '圣泪命中或到期时分裂为四颗小泪', aura: '#ff9ad0', w: 3, apply(p) { p.f.split = true; p.rateBonus += 0.3; } },
  { id: 'burn', name: '狱火圣泪', desc: '圣泪附带灼烧, 点燃敌人持续掉血', aura: '#ff7a30', w: 3, apply(p) { p.f.burn = true; p.addDmg += 1.0; } },
  { id: 'laser', name: '圣光镭射', desc: '圣泪被替换为持续照射的圣光镭射', aura: '#8ff0ff', w: 2, apply(p) { p.f.laser = true; p.addDmg += 2.6; } },
  // ---- 属性 ----
  { id: 'dmg1', name: '勇力圣印', desc: '伤害 +1.8', aura: '#ff8f6a', w: 5, apply(p) { p.addDmg += 1.8; } },
  { id: 'dmg2', name: '圣光之怒', desc: '伤害 x1.5, 射速稍降', aura: '#ff5545', w: 3, apply(p) { p.dmgMult *= 1.5; p.rateBonus -= 0.35; } },
  { id: 'rate1', name: '急速祝福', desc: '射速大幅提升, 射程略减', aura: '#9fe86a', w: 4, apply(p) { p.rateBonus += 1.5; p.addRange -= 0.7; } },
  { id: 'rate2', name: '疾风翎羽', desc: '射速提升', aura: '#a0e8d0', w: 5, apply(p) { p.rateBonus += 0.8; } },
  { id: 'spd1', name: '疾风之靴', desc: '移动速度提升', aura: '#9ad6ff', w: 5, apply(p) { p.addSpeed += 26; } },
  { id: 'spd2', name: '轻羽之靴', desc: '移动速度小幅提升', aura: '#bfe8ff', w: 6, apply(p) { p.addSpeed += 13; } },
  { id: 'rng1', name: '鹰眼透镜', desc: '圣泪射程提升', aura: '#9adfff', w: 4, apply(p) { p.addRange += 1.6; } },
  { id: 'hp1', name: '勇者之心', desc: '红心容器 +1 并完全回复', aura: '#ff6a6a', w: 5, apply(p) { p.addContainers += 1; p.heal(p.maxHp); } },
  { id: 'hp2', name: '圣盾之心', desc: '红心容器 +1', aura: '#ff8a7a', w: 3, apply(p) { p.addContainers += 1; } },
  // ---- 外观改造(带少量增益) ----
  { id: 'crown', name: '王者之冠', desc: '头戴王冠, 伤害 +0.6', aura: '#ffe08a', w: 3, apply(p) { p.addDmg += 0.6; p.visuals.push('crown'); } },
  { id: 'halo', name: '神圣光环', desc: '身后浮现圣环, 射程 +0.8', aura: '#fff2b0', w: 3, apply(p) { p.addRange += 0.8; p.visuals.push('halo'); } },
  { id: 'goggles', name: '魔导护目镜', desc: '戴上魔导目镜, 射程 +1.0', aura: '#7ce0ff', w: 4, apply(p) { p.addRange += 1.0; p.visuals.push('goggles'); } },
  { id: 'horns', name: '恶魔契约', desc: '献上圣洁换取力量: 伤害 x1.6, 速度大幅提升', aura: '#c04040', w: 2, apply(p) { p.dmgMult *= 1.6; p.addSpeed += 30; p.addDmg += 1.2; p.visuals.push('horns'); } },
  { id: 'wing', name: '天使之翼', desc: '背生圣翼, 速度 +18 射速 +0.4', aura: '#ffffff', w: 3, apply(p) { p.addSpeed += 18; p.rateBonus += 0.4; p.visuals.push('wing'); } },
  { id: 'scarf', name: '血红披风', desc: '披上猩红披风, 射速 +0.5', aura: '#d04050', w: 3, apply(p) { p.rateBonus += 0.5; p.visuals.push('scarf'); } },
  // ---- 更多泪弹形态 ----
  { id: 'giga', name: '巨人圣泪', desc: '圣泪巨大沉重: 伤害 x1.8, 射速降低', aura: '#ffd98a', w: 2, apply(p) { p.f.giga = true; p.dmgMult *= 1.8; p.rateBonus -= 0.4; } },
  { id: 'spread', name: '五向散射泪', desc: '一次射出五发扇形圣泪, 射程略减', aura: '#8fe0c0', w: 3, apply(p) { p.f.spread = true; } },
  { id: 'crit', name: '幸运圣戒', desc: '15% 概率圣泪造成双倍暴击', aura: '#ffe98a', w: 3, apply(p) { p.f.crit = true; p.addSpeed += 6; } },
];

export const ITEM_MAP = new Map(ITEMS.map(i => [i.id, i]));

export function rollItem(game) {
  const owned = new Set(game.player.items);
  const pool = ITEMS.filter(i => (i.floorMin || 1) <= game.floorIdx && !owned.has(i.id));
  if (!pool.length) return null;
  const total = pool.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const i of pool) { r -= i.w; if (r <= 0) return i; }
  return pool[pool.length - 1];
}

// 应用道具 + 全局反馈
export function applyItem(game, item) {
  const p = game.player;
  p.items.push(item.id);
  item.apply(p, game);
  game.onItemCollected(item);
}
