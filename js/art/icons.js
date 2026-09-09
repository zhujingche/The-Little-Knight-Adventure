// art/icons.js — 道具徽章图标(彩底圆徽 + 简单符号)
import { pixSprite } from './pix.js';

function emblem(b, id) {
  const cx = 7, cy = 7;
  const px = (x, y, c) => b.px(x, y, c, 1, 1);
  switch (id) {
    case 'tri': [5, 7, 9].forEach((x, i) => b.ellipse(x, 8 - Math.abs(x - 7) * 1.4, 1.3, 1.3, '#fff')); b.ellipse(7, 4.6, 1.6, 1.6, '#fff'); break;
    case 'quad': b.ellipse(7, 3.4, 1.2, 1.2, '#fff'); b.ellipse(7, 10.6, 1.2, 1.2, '#fff'); b.ellipse(3.4, 7, 1.2, 1.2, '#fff'); b.ellipse(10.6, 7, 1.2, 1.2, '#fff'); break;
    case 'pierce': b.ellipse(4.6, 7.4, 2, 2, '#fff'); b.rect(6.4, 3.6, 1.6, 5.4, '#fff'); b.px(8.4, 3, '#fff', 1, 1); b.px(8.4, 3.9, '#fff', 1, 1); break;
    case 'spectral': b.ellipse(7, 6.6, 2.6, 2.6, '#fff'); b.ellipse(7, 5.6, 2.2, 2.0, id ? '#000' : '#000'); b.px(8.2, 5.4, '#7f6fd0', 1, 1); b.rect(4.8, 9.4, 4.4, 1.4, '#fff'); break;
    case 'homing': b.ellipse(7, 7, 2.6, 2.6, '#fff'); b.ellipse(6, 6, 1.3, 1.3, '#7a5a10'); b.ellipse(9.6, 3.6, 1.5, 1.5, '#fff'); b.px(11.5, 3.2, '#fff', 1, 1); break;
    case 'split': for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; b.ellipse(cx + Math.cos(a) * 3.4, cy + Math.sin(a) * 3.4, 1.1, 1.1, '#fff'); } b.ellipse(7, 7, 1.7, 1.7, '#fff'); break;
    case 'burn': b.ellipse(7, 7.6, 2.6, 3.4, '#fff'); b.ellipse(7, 8.8, 1.5, 1.9, '#e8801f'); b.ellipse(5.9, 5.4, 1.1, 1.1, '#fff'); break;
    case 'laser': b.rect(2, 6.4, 10, 1.6, '#fff'); b.ellipse(4, 7.2, 2.4, 2.6, '#b0f0ff'); b.ellipse(10.4, 7.2, 2.2, 2.4, '#fff'); break;
    case 'dmg1': b.rect(6, 3, 2, 8, '#fff'); b.rect(2.6, 8, 8.8, 2, '#fff'); b.px(3, 7, '#d0d0d0', 1, 1); break;
    case 'dmg2': for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; px(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, i % 2 ? '#fff' : '#ffd0a0'); } b.ellipse(7, 7, 2, 2, '#fff'); break;
    case 'rate1': b.px(6.8, 3.4, '#fff', 1, 1); b.px(6.8, 4.2, '#fff', 1, 1); b.px(7.2, 3.8, '#ffe0a0', 1, 1); b.rect(8, 4.4, 2.4, 1, '#ffd0a0'); b.rect(8.6, 5.4, 3.2, 1, '#ffd0a0'); b.rect(9.2, 6.4, 3.8, 1, '#fff'); b.rect(8.4, 7.4, 4.4, 1, '#fff'); break;
    case 'rate2': b.ellipse(4.4, 9, 2.2, 1, '#fff'); b.ellipse(9.6, 5, 3, 1.6, '#fff'); b.ellipse(10.4, 8.2, 2.6, 1.2, '#fff'); b.ellipse(4.8, 5.2, 2.2, 1, '#fff'); break;
    case 'spd1': b.rect(3.2, 8.6, 2.2, 3, '#fff'); b.rect(8.6, 8.6, 2.2, 3, '#fff'); b.rect(2.6, 5.6, 8.8, 3.2, '#fff'); b.rect(4, 4.6, 6, 1.2, '#fff'); break;
    case 'spd2': b.ellipse(7, 9.2, 3, 1.6, '#fff'); b.rect(4.6, 5, 1, 3.4, '#fff'); b.rect(9.4, 5, 1, 3.4, '#fff'); b.rect(3.4, 6.4, 1.2, 2, '#fff'); b.rect(10.4, 6.4, 1.2, 2, '#fff'); break;
    case 'rng1': b.ellipse(7, 7, 3.2, 2.6, '#fff'); b.ellipse(7, 7, 1.9, 1.6, '#3a7ab0'); b.px(8, 6.4, '#fff', 1, 1); b.px(3.4, 3.6, '#fff', 1, 1); b.px(10.4, 10.4, '#fff', 1, 1); break;
    case 'hp1': b.ellipse(4.6, 5, 2, 2.4, '#fff'); b.ellipse(9.4, 5, 2, 2.4, '#fff'); b.ellipse(7, 8.2, 2.8, 2.8, '#fff'); b.px(6, 4, '#ffc0b0', 1, 1); break;
    case 'hp2': b.rect(3.4, 3.6, 7.2, 8.4, '#fff'); b.px(3.4, 3.4, '#fff', 1, 1); b.px(10.4, 3.4, '#fff', 1, 1); b.px(2.8, 5, '#fff', 1, 1); b.px(11, 5, '#fff', 1, 1); b.ellipse(7, 8, 3.2, 3.2, '#ff6666'); break;
    case 'crown': b.rect(3.6, 5.4, 6.8, 4, '#ffd23a'); b.px(4.4, 3.2, '#ffd23a', 1, 1); b.px(7, 2.4, '#ffd23a', 1, 1); b.px(9.6, 3.2, '#ffd23a', 1, 1); b.px(3.4, 6, '#fff', 1, 1); b.px(7, 6.4, '#fff', 1, 1); b.px(10.4, 6, '#fff', 1, 1); b.rect(3.6, 9.6, 6.8, 1, '#fff'); break;
    case 'halo': b.ellipse(7, 7, 5, 2.2, '#fff', 0); b.ring(7, 7, 4.6, 1.9, '#ffe98a', 1.1); b.ring(7, 7, 4.6, 1.9, '#fff', 0.5); break;
    case 'goggles': b.ellipse(4.8, 7, 2.2, 1.8, '#7ce0ff'); b.ellipse(9.2, 7, 2.2, 1.8, '#7ce0ff'); b.rect(3.2, 6.4, 1.4, 1.2, '#000'); b.rect(9.4, 6.4, 1.4, 1.2, '#000'); b.rect(6.4, 6.4, 1.2, 1.4, '#000'); break;
    case 'horns': b.px(3.6, 2.8, '#fff', 1, 1); b.px(4, 3.6, '#fff', 1, 1); b.px(4.2, 4.6, '#fff', 1, 1); b.px(10.4, 2.8, '#fff', 1, 1); b.px(10, 3.6, '#fff', 1, 1); b.px(9.8, 4.6, '#fff', 1, 1); b.ellipse(5, 8, 2, 3, '#ff4040'); b.ellipse(9, 8, 2, 3, '#ff4040'); b.rect(7, 4.4, 1.2, 2.2, '#c03030'); b.rect(7, 8, 1.2, 3, '#c03030'); break;
    case 'wing': b.ellipse(3.6, 8.4, 3.4, 2.2, '#fff'); b.ellipse(10.4, 8.4, 3.4, 2.2, '#fff'); b.ellipse(4.8, 6.2, 1.8, 1.2, '#fff'); b.ellipse(9.2, 6.2, 1.8, 1.2, '#fff'); break;
    case 'scarf': b.px(3.2, 5, '#ff4040', 1, 1); b.px(4.4, 5.8, '#ff4040', 1, 1); b.px(5.8, 6.2, '#d03030', 1, 1); b.px(7, 6, '#d03030', 1, 1); b.px(8.2, 6.4, '#d03030', 1, 1); b.px(9.6, 7, '#ff4040', 1, 1); b.px(10.6, 7.8, '#a02020', 1, 1); b.rect(6.8, 9.4, 4.2, 1, '#ff4040'); break;
    case 'giga': b.ellipse(7, 7.5, 4.7, 4.7, '#fff'); b.ellipse(7, 7.5, 3.5, 3.5, '#ffd98a'); b.px(5.3, 5.8, '#fff', 1, 1); b.px(8.7, 9.2, '#c8841e', 1, 1); break;
    case 'spread': for (let i = 0; i < 5; i++) { const a = -0.55 + i * 0.275; b.ellipse(7 + Math.sin(a) * 4.7, 7 - Math.cos(a) * 4.7, 1.15, 1.15, '#eafff0'); } b.ellipse(7, 7, 1.1, 1.1, '#c8fff0'); break;
    case 'crit': b.ellipse(7, 7, 2.6, 2.6, '#fff'); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; b.px(7 + Math.cos(a) * 5.8, 7 + Math.sin(a) * 5.8, i % 2 ? '#fff' : '#ffd050', 1, 1); } b.px(7, 6.4, '#ffd050', 1, 1); break;
    default: b.ellipse(7, 7, 2.6, 2.6, '#fff');
  }
}

export function iconSprite(id, aura) {
  return pixSprite('icon:' + id, 14, 14, (b) => {
    // 徽章底(深色圆 + 光晕)
    b.ellipse(7, 7, 6.6, 6.6, '#1c1c24');
    b.ellipse(7, 7, 5.6, 5.6, aura || '#555');
    b.ellipse(7, 7, 5.6, 5.6, 'rgba(0,0,0,0.25)');
    b.ellipse(5.4, 4.8, 1.4, 1.2, 'rgba(255,255,255,0.28)');
    emblem(b, id);
  }, '#0a0705');
}
