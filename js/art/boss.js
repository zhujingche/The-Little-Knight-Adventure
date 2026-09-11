// art/boss.js — Boss 美术(巨型暗黑卡通怪)
import { pixSprite } from './pix.js';
import { cached } from '../util.js';

// ---------- 大眼魔王(Monstro 式弹跳怪) ----------
export function hopBossSprites() {
  return cached('boss:hop', () => {
    const mk = (squash) => pixSprite('boss:hop:' + squash, 30, 24, (b) => {
      const s = squash ? 0.82 : 1;
      const cy = squash ? 15 : 13.5;
      // 腿(落地挤压)
      b.ellipse(10, 19.6, 4.2, 2.6 * (squash ? 1.3 : 1), '#5c2c1c');
      b.ellipse(21, 19.6, 4.2, 2.6 * (squash ? 1.3 : 1), '#5c2c1c');
      // 大肚身体
      b.ellipse(15, cy, 13.2, 9.6 * s, '#6b2f20');
      b.ellipse(15, cy - 1.2, 11.4, 8.0 * s, '#8a3c28');
      b.ellipse(14.2, cy - 3.2, 8.4, 5.6 * s, '#a84e34');
      b.ellipse(12.6, cy - 5.6, 4.6, 3.0 * s, '#c46a48');
      // 疙瘩
      b.px(4.6, cy - 4.4, '#a84e34', 1, 1);
      b.px(25.4, cy - 3.6, '#8a3c28', 1, 1);
      b.px(7, cy - 8.6, '#8a3c28', 1, 1);
      b.px(23, cy - 8.2, '#8a3c28', 1, 1);
      // 巨眼(居中上方)
      const ey = cy - 3.4 * s;
      b.ellipse(15, ey, 5.6, 5.2 * s, '#fff4e0');
      b.ellipse(15, ey, 4.4, 4.1 * s, '#e8c050');
      b.ellipse(15, ey, 2.6, 3.4 * s, '#5a3a10');
      b.ellipse(15, ey + 1.2 * s, 1.4, 1.7 * s, '#1c1004');
      b.px(12.6, ey - 2.0, '#fff', 1, 1);
      // 怒眉
      b.rect(8.4, ey - 7.2 * s + 1, 5.4, 1.6, '#4a1e12');
      b.rect(16.2, ey - 7.2 * s + 1, 5.4, 1.6, '#4a1e12');
      // 血盆大口(下缘)
      b.ellipse(15, cy + 4.6 * s, 6.6, 3.4 * s, '#3a160e');
      b.ellipse(15, cy + 4.0 * s, 5.6, 2.4 * s, '#170805');
      // 獠牙
      b.px(9.4, cy + 2.8 * s, '#f0e6c8', 1, 1); b.px(11.6, cy + 2.2 * s, '#f0e6c8', 1, 1);
      b.px(18.4, cy + 2.2 * s, '#f0e6c8', 1, 1); b.px(20.6, cy + 2.8 * s, '#f0e6c8', 1, 1);
      b.px(10.2, cy + 6.8 * s, '#f0e6c8', 1, 1); b.px(19.8, cy + 6.8 * s, '#f0e6c8', 1, 1);
    });
    return [mk(false), mk(true)];
  });
}

// ---------- 骑士型 Boss 的每层配色(2层=幽蓝骸骨骑士 / 3层=赤黑深渊大骑士) ----------
const KNIGHT_PAL = {
  2: {
    cape1: '#1b2438', cape2: '#2f3f66', cape3: '#46598c',
    boot: '#1b2236', sole: '#0f1420',
    body1: '#202a44', body2: '#33406a', body3: '#4d6299',
    seam: '#182033', rivet: '#0f1420',
    pauld1: '#242f4c', pauld2: '#41527f',
    helm1: '#1a2236', helm2: '#33406a', horn1: '#33406a', horn2: '#42527f', horn3: '#5a6ca0',
    eye: '#8ff0ff', eyeCore: '#eaffff',
    blade1: '#aeb6c4', blade2: '#e6ecf4', hilt: '#5a4630', grip: '#2a2018', guard: '#d8dee8',
  },
  3: {
    cape1: '#5a1218', cape2: '#8e2028', cape3: '#b02c36',
    boot: '#23232c', sole: '#121218',
    body1: '#26262f', body2: '#3d3d4a', body3: '#565668',
    seam: '#20202a', rivet: '#12121a',
    pauld1: '#2c2c38', pauld2: '#4a4a5c',
    helm1: '#20202a', helm2: '#3c3c48', horn1: '#3c3c48', horn2: '#4c4c5c', horn3: '#5c5c70',
    eye: '#ff5a4a', eyeCore: '#ffd9c0',
    blade1: '#c8b6a4', blade2: '#f0e6dc', hilt: '#5a2a20', grip: '#2a1008', guard: '#e8c8b8',
  },
};

// ---------- 骑士型 Boss(2/3 层不同配色) ----------
export function knightBossSprites(tier = 3) {
  return cached('boss:knight:' + tier, () => {
    const p = KNIGHT_PAL[tier] || KNIGHT_PAL[3];
    const mk = (swing) => pixSprite('boss:knight:' + tier + ':' + swing, 30, 32, (b) => {
      // 披风
      b.ellipse(15, 24, 12.5, 8.6, p.cape1);
      b.ellipse(16.4, 22.6, 10.4, 6.8, p.cape2);
      b.ellipse(18, 21, 8, 4.8, p.cape3);
      // 腿(重靴)
      b.rect(9.4, 26.4, 4.6, 5, p.boot);
      b.rect(16, 26.4, 4.6, 5, p.boot);
      b.rect(8.4, 30.4, 6.4, 1.6, p.sole);
      b.rect(15, 30.4, 6.4, 1.6, p.sole);
      // 躯干铠甲
      b.ellipse(15, 21.2, 7.6, 7.2, p.body1);
      b.ellipse(15, 20.4, 6.4, 5.6, p.body2);
      b.ellipse(15.2, 19.4, 5.0, 4.2, p.body3);
      // 板甲缝
      b.rect(13.4, 16.6, 3.2, 7.6, p.seam);
      b.px(13.8, 18.6, p.rivet, 1, 1); b.px(16.2, 18.6, p.rivet, 1, 1);
      // 肩甲
      b.ellipse(7.4, 16.2, 4.2, 3.4, p.pauld1);
      b.ellipse(7.6, 15.6, 3.2, 2.6, p.pauld2);
      b.ellipse(22.6, 16.2, 4.2, 3.4, p.pauld1);
      b.ellipse(22.4, 15.6, 3.2, 2.6, p.pauld2);
      // 头: 尖角盔
      b.ellipse(15, 10.4, 5.8, 5.6, p.helm1);
      b.ellipse(15, 10.2, 4.6, 4.4, p.helm2);
      // 盔角(向上尖刺)
      b.px(10.4, 4.4, p.horn1, 1, 1); b.px(11, 3.4, p.horn2, 1, 1); b.px(11.6, 2.6, p.horn2, 1, 1); b.px(12.2, 1.8, p.horn3, 1, 1);
      b.px(19.6, 4.4, p.horn1, 1, 1); b.px(19, 3.4, p.horn2, 1, 1); b.px(18.4, 2.6, p.horn2, 1, 1); b.px(17.8, 1.8, p.horn3, 1, 1);
      b.px(15, 3.2, p.horn1, 1, 1); b.px(15, 2.2, p.horn3, 1, 1);
      // 发光竖瞳
      b.rect(13.6, 9.6, 1.3, 3.0, p.eye);
      b.rect(15.1, 9.6, 1.3, 3.0, p.eye);
      b.px(13.6, 10.8, p.eyeCore, 1, 1);
      // 嘴部黑暗
      b.rect(14, 13.4, 2.0, 0.9, '#0c0c10');
      // 持巨剑手臂(挥动帧抬起)
      const armY = swing ? 11 : 14.5;
      b.hline(22.6, armY + 4, 5.6, p.helm2, 1);
      if (swing) {
        b.rect(25.8, 3.4, 2.6, 13, p.blade1);
        b.rect(26.6, 3.4, 0.9, 13, p.blade2);
        b.rect(25.4, 15.6, 3.4, 2.6, p.hilt);
        b.rect(25.0, 17.6, 4.2, 1.2, p.grip);
        b.rect(24.6, 2.4, 5.0, 1.4, p.guard);
      } else {
        b.rect(23.8, 16.6, 2.4, 11.4, p.blade1);
        b.rect(24.6, 16.6, 0.8, 11.4, p.blade2);
        b.rect(23.4, 27.2, 3.2, 1.6, p.hilt);
        b.rect(22.8, 28.6, 4.4, 1.2, p.grip);
      }
    });
    return [mk(false), mk(true)];
  });
}
