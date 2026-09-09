// art/world.js — 岩石/宝箱/红心/祭坛/圣泪/装饰物 硬像素美术
import { pixSprite } from './pix.js';

// ---------- 圣泪(子弹) ----------
export function tearSprite(color = 'W') {
  const cols = {
    W: { base: '#eef4ff', rim: '#8fb0d8', gloss: '#ffffff' },   // 圣洁白泪(主角)
    R: { base: '#ff6a55', rim: '#b3241a', gloss: '#ffd9d0' },    // 血红泪(敌人)
    G: { base: '#cf8fff', rim: '#7b2fc0', gloss: '#f0e2ff' },    // 暗紫泪(Boss)
    F: { base: '#ffd98a', rim: '#d88a1e', gloss: '#fff2cf' },    // 火焰金泪
  };
  const c = cols[color] || cols.W;
  return pixSprite('tear:' + color, 10, 10, (b) => {
    b.ellipse(5, 5, 4.3, 4.3, c.rim);
    b.ellipse(5, 5, 3.4, 3.4, c.base);
    b.ellipse(3.7, 3.4, 1.3, 1.5, c.gloss);
    b.ellipse(6.1, 6.6, 0.8, 0.8, c.rim);  // 底部轮廓
  });
}

// ---------- 岩石(1-3 级大小) ----------
const rockShape = (size) => {
  const s = size / 3;
  return [
    ['#5c6068', '#454a52', '#7c818c', 0],   // 主体灰
    ['#2c2f36', '#20242b', '#3c4048', 1],   // 暗角
    ['#6f8891', '#4a6a6e', '#8da6a2', 0],   // 苔藓绿
  ];
};
export function rockSprite(variant = 0) {
  return pixSprite('rock:' + variant, 26, 20, (b) => {
    const cx = 13;
    // 大块碎石: 两块椭球叠放
    b.ellipse(cx - 2, 10.5, 10, 8, '#3d424b');
    b.ellipse(cx - 3.5, 9.8, 7.4, 6, '#555b66');
    b.ellipse(cx - 5, 8.6, 4.4, 3.4, '#767d89');
    b.ellipse(cx - 5.6, 8.0, 2.4, 1.8, '#9aa2ae');
    // 旁边小石
    b.ellipse(cx + 8, 13.5, 5.5, 4.4, '#39404a');
    b.ellipse(cx + 7.2, 13.0, 3.6, 2.8, '#4d545f');
    // 苔藓
    if (variant % 2 === 0) {
      b.ellipse(cx - 7, 8.2, 1.4, 1.0, '#5d7a52');
      b.ellipse(cx + 2, 6.4, 1.0, 0.8, '#5d7a52');
    } else {
      b.ellipse(cx - 3, 11.4, 1.2, 0.7, '#6b5a3a');
      b.ellipse(cx + 6.4, 10.9, 1.0, 0.6, '#6b5a3a');
    }
  });
}

// ---------- 尖刺陷阱(地刺) ----------
export function spikeSprite() {
  return pixSprite('spike', 22, 12, (b) => {
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 4;
      // 金字塔形铁刺
      b.px(x + 1, 6, '#8d929c', 1, 1);
      b.px(x, 7, '#8d929c', 1, 1);
      b.px(x + 1, 7, '#aeb4bd', 1, 2);
      b.px(x, 8, '#5d626b', 1, 1);
      b.px(x + 1, 8, '#6d727c', 1, 2);
      b.px(x, 9, '#43474f', 1, 1);
      b.px(x + 1, 9, '#43474f', 1, 2);
    }
    b.rect(0, 10, 22, 2, '#31343b');
  });
}

// ---------- 宝箱 ----------
export function chestSprite(open = false) {
  return pixSprite('chest:' + open, 26, 18, (b) => {
    if (!open) {
      b.rect(2, 6, 22, 9, '#8a5a2b');
      b.rect(2, 6, 22, 3, '#a06a36');
      b.rect(4, 4, 18, 3, '#7c4f24');
      // 铁箍
      b.rect(4, 7, 2, 8, '#5d636d');
      b.rect(20, 7, 2, 8, '#5d636d');
      b.rect(11, 7, 4, 8, '#6a717c');
      // 锁扣
      b.rect(11.6, 6.5, 2.8, 2, '#c9b036');
      b.rect(12.2, 6.2, 1.6, 1.4, '#8a7a22');
    } else {
      b.rect(2, 8, 22, 8, '#7a4c20');
      b.rect(4, 9, 2, 7, '#4c4f57');
      b.rect(20, 9, 2, 7, '#4c4f57');
      b.rect(11, 9, 4, 7, '#5a606a');
      // 打开的盖
      b.rect(1, 2, 24, 3, '#96602e');
      b.rect(1, 1, 24, 2, '#a8703a');
      b.rect(4, 3, 2, 2, '#565b63');
      b.rect(20, 3, 2, 2, '#565b63');
      b.rect(12, 3, 2, 2, '#676d76');
      // 内里发光
      b.rect(4, 6, 18, 3, '#2a1d0d');
      b.ellipse(8, 7.4, 2.4, 1.2, '#ffe9a0');
    }
  });
}

// ---------- 红心(拾取物) ----------
export function heartPickupSprite() {
  return pixSprite('heartPick', 12, 11, (b) => {
    b.ellipse(3.4, 4, 2.4, 2.8, '#b01f1a');
    b.ellipse(8.6, 4, 2.4, 2.8, '#b01f1a');
    b.ellipse(6, 7, 3.4, 3.4, '#c93026');
    b.px(4, 3, '#ff8f82', 1, 1);
    b.px(6, 2.5, '#ffd0c9', 1, 1);
  });
}

// ---------- HUD 红心容器(满/半/空) ----------
export function hudHeart(state) {
  return pixSprite('hudHeart:' + state, 12, 11, (b) => {
    b.ellipse(3.4, 4, 2.5, 2.9, '#1a0c0a');
    b.ellipse(8.6, 4, 2.5, 2.9, '#1a0c0a');
    b.ellipse(6, 7.2, 3.6, 3.6, '#1a0c0a');
    if (state === 'empty') return;
    const fill = state === 'half' ? [2, 2, 8, 11] : [1, 1, 11, 11];
    for (let y = fill[1]; y < fill[3]; y++)
      for (let x = fill[0]; x < fill[2]; x++) {
        const dx = x - 6, dy = y - 7.2;
        const inHeart = ((x - 3.4) / 2.5) ** 2 + ((y - 4) / 2.9) ** 2 <= 1 ||
          ((x - 8.6) / 2.5) ** 2 + ((y - 4) / 2.9) ** 2 <= 1 ||
          (dx * dx) / (3.6 * 3.6) + (dy * dy) / (3.6 * 3.6) <= 1;
        if (!inHeart) continue;
        b.px(x, y, '#c93026', 1, 1);
      }
    b.px(4.6, 3.2, '#ff8f82', 1, 1);
    b.px(6.2, 2.6, '#ffd0c9', 1, 1);
  });
}

// ---------- 道具祭坛(基座) ----------
export function pedestalSprite() {
  return pixSprite('pedestal', 18, 12, (b) => {
    // 石台
    b.rect(3, 7, 12, 2, '#55503f');
    b.rect(5, 9, 8, 2, '#3c3830');
    b.rect(4, 6, 10, 2, '#6d6854');
    b.rect(5.5, 4, 7, 2, '#7b7660');
    b.rect(7, 3, 4, 2, '#8b866e');
    b.rect(7.8, 0.5, 2.4, 2.5, '#a39d82');
    b.px(7, 3.5, '#3c3830', 1, 1);
    b.px(10.5, 3.5, '#3c3830', 1, 1);
    b.px(8, 6.5, '#3c3830', 1, 1);
    b.px(11, 6.5, '#3c3830', 1, 1);
  });
}

// ---------- 装饰: 骷髅/骨头/蘑菇/火把(地板小物) ----------
export function skullSprite() {
  return pixSprite('decor:skull', 11, 9, (b) => {
    b.ellipse(5.5, 4.2, 4.6, 3.6, '#d8d2bc');
    b.ellipse(5.5, 6.2, 3.2, 2.0, '#c6bfa6');
    b.rect(4.1, 3.2, 1.6, 1.9, '#1c1a12');
    b.rect(7.1, 3.2, 1.6, 1.9, '#1c1a12');
    b.rect(5.9, 5.4, 1.0, 1.0, '#8f8872');
    b.px(2.2, 4.6, '#c6bfa6', 1, 1);
    b.px(8.8, 4.6, '#c6bfa6', 1, 1);
    b.px(3.4, 6.8, '#2b261a', 1, 1);
    b.px(7.4, 6.8, '#2b261a', 1, 1);
  });
}
export function boneSprite() {
  return pixSprite('decor:bone', 12, 5, (b) => {
    b.rect(2, 2, 8, 1, '#d8d2bc');
    b.px(1, 1, '#d8d2bc', 1, 1); b.px(1, 3, '#d8d2bc', 1, 1);
    b.px(11, 1, '#d8d2bc', 1, 1); b.px(11, 3, '#d8d2bc', 1, 1);
  });
}
export function mushroomSprite() {
  return pixSprite('decor:mush', 9, 8, (b) => {
    b.rect(3.8, 3, 1.4, 4, '#d8d2bc');
    b.ellipse(4.5, 3.2, 4, 2.4, '#9e4a3a');
    b.ellipse(4.2, 2.9, 3.2, 1.6, '#c06048');
    b.px(3, 2.2, '#ffe9c0', 1, 1);
    b.px(6.6, 3.4, '#ffe9c0', 1, 1);
  });
}
export function torchSprite() {
  return pixSprite('decor:torch', 10, 16, (b) => {
    b.rect(4, 8, 2, 7, '#6b4a26');
    b.rect(3, 14, 4, 2, '#4a2f14');
    b.rect(3.6, 8, 0.8, 2, '#8a6a3c');
    b.ellipse(5, 4.5, 2.4, 3.6, '#e8a13a');
    b.ellipse(5, 5.2, 1.6, 2.6, '#ffd35a');
    b.ellipse(5, 5.8, 0.9, 1.6, '#fff3bb');
  });
}
// 骷髅门上的警示标(骷髅+双骨)
export function skullMarkSprite() {
  return pixSprite('decor:skullmark', 14, 14, (b) => {
    b.ellipse(7, 6.6, 4.6, 4.0, '#e0dac4');
    b.rect(5.4, 5.4, 1.7, 2.1, '#171410');
    b.rect(8.9, 5.4, 1.7, 2.1, '#171410');
    b.rect(6.4, 8.2, 1.2, 1.1, '#9c957e');
    b.px(4.2, 7.0, '#2b261a', 1, 1);
    b.px(9.8, 7.0, '#2b261a', 1, 1);
    b.px(6.5, 9.6, '#171410', 1, 1);
    b.px(7.5, 9.6, '#171410', 1, 1);
    b.rect(1.6, 10.6, 3.4, 1, '#e0dac4');
    b.px(1.4, 10, '#e0dac4', 1, 1); b.px(5.2, 11.6, '#e0dac4', 1, 1);
    b.rect(9, 10.6, 3.4, 1, '#e0dac4');
    b.px(9.4, 11.6, '#e0dac4', 1, 1); b.px(13.2, 10, '#e0dac4', 1, 1);
  });
}
