// art/monsters.js — 普通敌人硬像素美术
// 通用约定: 头朝上(坐标向上为动画翻转), 帧缓存。
import { pixSprite } from './pix.js';
import { cached } from '../util.js';

// ---------- 飞行怪(蝇/蝠): 暗红圆身 + 大白眼 + 扑棱翅膀 ----------
export function flySprites() {
  return cached('mon:fly', () => {
    const mk = (wingUp) => pixSprite('mon:fly:' + wingUp, 16, 13, (b) => {
      // 翅膀(半透明淡灰)
      const wy = wingUp ? 2.2 : 6.2;
      b.ellipse(2.8, wy + 1.6, 3.6, 2.0, '#c3cacb', 0.55);
      b.ellipse(13.2, wy + 1.6, 3.6, 2.0, '#c3cacb', 0.55);
      // 身体
      b.ellipse(8, 7, 4.6, 4.4, '#5c1c12');
      b.ellipse(8, 6.6, 3.9, 3.7, '#8a2c1c');
      b.ellipse(7.2, 5.4, 2.3, 2.0, '#a5402a');
      // 愤怒大白眼 + 瞳孔
      b.ellipse(5.8, 6.4, 1.9, 1.7, '#fff4e0');
      b.ellipse(6.4, 6.9, 0.95, 1.05, '#181210');
      // 小獠牙
      b.px(6.8, 9.9, '#f2e8d0', 1, 1);
      b.px(8.4, 9.9, '#f2e8d0', 1, 1);
      // 尾刺
      b.px(8, 11.2, '#3a1008', 1, 1);
      // 翅上暗纹
      if (!wingUp) { b.ellipse(2.2, 7.4, 2.6, 1.0, '#8f9a9b', 0.35); b.ellipse(13.8, 7.4, 2.6, 1.0, '#8f9a9b', 0.35); }
    });
    return [mk(true), mk(false)];
  });
}

// ---------- 吐弹咕噜怪(盖博型): 灰绿软肉 + 血盆大口 ----------
export function gaperSprites() {
  return cached('mon:gaper', () => {
    const mk = (frame) => pixSprite('mon:gaper:' + frame, 18, 14, (b) => {
      const oy = frame === 0 ? 0 : 0.8; // 走路起伏
      // 身体(歪肉团)
      b.ellipse(9, 7 + oy, 7.4, 5.8, '#5d6b52');
      b.ellipse(9.4, 6.2 + oy, 6.2, 4.4, '#7d8c6e');
      b.ellipse(9.9, 4.9 + oy, 4.2, 2.6, '#97a886');
      // 顶/背疙瘩
      b.px(4.5, 3.6 + oy, '#5d6b52', 1, 1);
      b.px(13.5, 3.6 + oy, '#5d6b52', 1, 1);
      b.px(9, 1.6 + oy, '#4a5740', 1, 1);
      // 大嘴(占半张脸)
      b.ellipse(9, 9.1 + oy, 4.6, 2.9, '#2e2418');
      b.ellipse(9, 8.7 + oy, 3.9, 2.2, '#1a120a');
      // 上牙
      b.px(5.6, 7.6 + oy, '#efe8d4', 1, 1); b.px(7.1, 7.3 + oy, '#efe8d4', 1, 1);
      b.px(8.6, 7.2 + oy, '#efe8d4', 1, 1); b.px(10.1, 7.3 + oy, '#efe8d4', 1, 1);
      b.px(11.6, 7.6 + oy, '#efe8d4', 1, 1);
      // 下牙
      b.px(6.1, 10.6 + oy, '#efe8d4', 1, 1); b.px(7.6, 10.9 + oy, '#efe8d4', 1, 1);
      b.px(9.1, 10.9 + oy, '#efe8d4', 1, 1); b.px(10.6, 10.9 + oy, '#efe8d4', 1, 1);
      b.px(12.1, 10.6 + oy, '#efe8d4', 1, 1);
      // 小眼睛(顶部)
      b.px(6.3, 4.0 + oy, '#fff0d8', 1, 1); b.px(6.5, 4.0 + oy, '#1a1408', 1, 1);
      b.px(11.3, 4.0 + oy, '#fff0d8', 1, 1); b.px(11.1, 4.0 + oy, '#1a1408', 1, 1);
      // 手脚
      if (frame === 0) { b.px(2.2, 11.6 + oy, '#4a5740', 1, 1); b.px(15.2, 11.6 + oy, '#4a5740', 1, 1); }
      else { b.px(2.0, 11.2 + oy, '#4a5740', 1, 1); b.px(15.0, 11.2 + oy, '#4a5740', 1, 1); }
    });
    return [mk(0), mk(1)];
  });
}

// ---------- 骷髅兵(冲锋型) ----------
export function skellySprites() {
  return cached('mon:skelly', () => {
    const mk = (frame) => pixSprite('mon:skelly:' + frame, 16, 18, (b) => {
      const lunge = frame === 1;
      // 头骨
      b.ellipse(8, 3.6, 4.4, 3.4, '#dcd5bf');
      b.rect(6.4, 2.6, 1.7, 1.6, '#12100c');
      b.rect(9.9, 2.6, 1.7, 1.6, '#12100c');
      b.rect(7.5, 5.0, 1.0, 0.9, '#8f8872');
      b.px(6.0, 4.6, '#a8a18a', 1, 1); b.px(10.0, 4.6, '#a8a18a', 1, 1);
      b.rect(7.3, 6.0, 1.4, 1.4, '#1a1610');
      // 躯干(肋骨)
      b.ellipse(8, 10.2, 3.8, 3.6, '#c9c2ac');
      b.ellipse(8, 10.2, 2.9, 2.7, '#2e2a20');
      b.hline(5.6, 8.9, 4.8, '#dcd5bf', 1);
      b.hline(5.6, 10.0, 4.8, '#dcd5bf', 1);
      b.hline(5.6, 11.1, 4.8, '#dcd5bf', 1);
      // 锁骨/肩
      b.hline(4.6, 7.6, 6.8, '#b5ae98', 1);
      // 手臂(持锈剑)
      if (lunge) {
        b.hline(4.2, 9.4, 2.4, '#c9c2ac', 1);
        // 剑横举
        b.rect(4.4, 12.6, 2.6, 7.0, '#9aa1ae');  // 剑刃
        b.rect(4.0, 12.6, 0.9, 2.0, '#8a5a2b');   // 剑柄
        b.rect(5.6, 12.6, 0.7, 7.0, '#b6bdca');
      } else {
        b.hline(4.2, 9.4, 2.2, '#c9c2ac', 1);
        b.px(3.8, 9.4, '#c9c2ac', 1, 1);
        b.rect(5.0, 12.0, 2.0, 6.0, '#9aa1ae');   // 竖剑
        b.rect(4.4, 12.0, 0.8, 1.6, '#8a5a2b');
        b.rect(5.6, 12.0, 0.6, 6.0, '#b6bdca');
      }
      // 手骨
      b.px(3.4, 12.4, '#dcd5bf', 1, 1);
      b.px(3.4, 13.2, '#dcd5bf', 1, 1);
      // 骨盆 + 腿
      b.ellipse(8, 13.4, 2.6, 1.3, '#c9c2ac');
      b.rect(7, 13.8, 1.2, 2.8, '#b5ae98');
      b.rect(8.8, 13.8, 1.2, 2.8, '#b5ae98');
      b.px(6.9, 16.6, '#8a8470', 1, 1);
      b.px(8.7, 16.6, '#8a8470', 1, 1);
      // 眼中红点(狂怒)
      b.px(7.3, 3.3, '#ff5540', 1, 1);
      b.px(9.9, 3.3, '#ff5540', 1, 1);
    });
    return [mk(0), mk(1)];
  });
}

// ---------- 火焰小鬼(爆发射击) ----------
export function impSprites() {
  return cached('mon:imp', () => {
    const mk = (frame) => pixSprite('mon:imp:' + frame, 16, 14, (b) => {
      const oy = frame === 0 ? 0 : 0.7;
      // 身体(熔岩色)
      b.ellipse(8, 7.6 + oy, 5.6, 4.6, '#4e1a12');
      b.ellipse(8, 6.8 + oy, 4.7, 3.6, '#a13222');
      b.ellipse(7.4, 5.8 + oy, 3.1, 2.2, '#e2693c');
      // 熔岩裂缝(发光)
      b.rect(5.6, 8.6 + oy, 1.0, 1.2, '#ffab48');
      b.rect(8.9, 8.0 + oy, 1.0, 1.2, '#ffab48');
      b.rect(7.0, 10.2 + oy, 1.4, 1.0, '#ff7a30');
      // 角
      b.px(5.2, 1.6 + oy, '#e8d8c0', 1, 1); b.px(5.0, 0.8 + oy, '#e8d8c0', 1, 1);
      b.px(10.8, 1.6 + oy, '#e8d8c0', 1, 1); b.px(11.0, 0.8 + oy, '#e8d8c0', 1, 1);
      // 橙色大眼
      b.ellipse(6.3, 6.3 + oy, 1.6, 1.7, '#ffd460');
      b.ellipse(6.3, 6.5 + oy, 0.8, 1.0, '#3a1400');
      b.ellipse(9.7, 6.3 + oy, 1.6, 1.7, '#ffd460');
      b.ellipse(9.7, 6.5 + oy, 0.8, 1.0, '#3a1400');
      // 嘴
      b.rect(7.3, 9.4 + oy, 1.4, 0.9, '#2a0a04');
      // 尾
      b.px(8, 12.0 + oy, '#a13222', 1, 1);
      b.px(8, 12.9 + oy, '#e2693c', 1, 1);
    });
    return [mk(0), mk(1)];
  });
}

// ---------- 史莱姆(分裂怪) ----------
export function slimeSprites(mini = false) {
  const w = mini ? 11 : 15, h = mini ? 9 : 12;
  return cached('mon:slime:' + mini, () => {
    const mk = (frame) => pixSprite('mon:slime:' + mini + ':' + frame, w, h, (b) => {
      const s = mini ? 0.72 : 1;
      const cx = w / 2, cy = h / 2;
      const wob = frame === 0 ? 0 : 0.4 * s;
      // 水润青绿果冻
      b.ellipse(cx, cy + wob, 5.2 * s, 4.2 * s, '#1e6b3a');
      b.ellipse(cx - 0.4 * s, cy - 0.6 * s + wob, 4.0 * s, 3.0 * s, '#2f9250');
      b.ellipse(cx - 1.1 * s, cy - 1.3 * s + wob, 2.2 * s, 1.5 * s, '#5fc07e');
      // 高光
      b.ellipse(cx - 1.6 * s, cy - 1.9 * s + wob, 1.1 * s, 0.7 * s, '#b6ecc6', 0.8);
      // 眼睛
      b.ellipse(cx - 1.7 * s, cy - 0.4 * s + wob, 1.3 * s, 1.4 * s, '#eafff0');
      b.ellipse(cx - 1.7 * s, cy - 0.2 * s + wob, 0.6 * s, 0.8 * s, '#0d3018');
      b.ellipse(cx + 1.7 * s, cy - 0.4 * s + wob, 1.3 * s, 1.4 * s, '#eafff0');
      b.ellipse(cx + 1.7 * s, cy - 0.2 * s + wob, 0.6 * s, 0.8 * s, '#0d3018');
      // 嘴
      b.ellipse(cx, cy + 1.9 * s + wob, 1.3 * s, 0.7 * s, '#0d3018');
    });
    return [mk(0), mk(1)];
  });
}

// 通过类型取帧: type + animTime 秒 → canvas
const KINDS = {
  fly: flySprites,
  gaper: gaperSprites,
  skelly: skellySprites,
  imp: impSprites,
  slime: slimeSprites,
};
export function monsterFrames(kind, mini = false) {
  if (kind === 'slime' || kind === 'slimelet') return slimeSprites(mini);
  const f = KINDS[kind];
  return f ? f() : flySprites();
}
export function monsterFrame(kind, t, mini = false) {
  const fr = monsterFrames(kind, mini);
  const idx = Math.floor(t * 9) % fr.length;
  return fr[idx];
}
