// art/player.js — 主角「小骑士」硬像素帧 (v10: 无披风 + 可爱圆头)
// 画布 22x30, 中心 (11,15); 渲染放大 3 倍 → 66x90。
// 可爱向: 更圆更大的头、圆滚滚大黑眼睛(带小白高光)、小圆角、纯黑细身+小脚丫、右手骨钉。
import { pixSprite } from './pix.js';

const W = 22, H = 30, CX = 11, CY = 15, SCALE = 3;

const M1 = '#f1ecdf';   // 骨白高
const M2 = '#d8d1c1';   // 骨白中
const M3 = '#a29b8c';   // 骨白影
const BODY = '#1f232d'; // 身体
const BODD = '#0d0f15'; // 身体暗
const RIM = '#657389';  // 冷光
const N1 = '#eef1f5';   // 剑刃亮
const N2 = '#aab3c0';   // 剑刃灰
const N3 = '#6d7787';   // 剑刃暗
const GR = '#10131a';   // 剑柄
const E = '#000000';    // 空洞(大而圆)
const SP = '#ffffff';   // 眼睛高光

// ---- 小圆角(可爱, 向上微弯, 短而圆润) ----
function horn(b, cx, cy, side) {
  const s = side;
  const bx = cx - s * 4.0, top = cy - 3.2;
  b.rect(bx, top + 2.0, 2, 2, M3);
  b.rect(bx - s * 0.9, top + 0.8, 2, 2, M2);
  b.rect(bx - s * 1.4, top - 0.4, 2, 2, M1);
  b.rect(bx - s * 1.4, top - 1.6, 1, 1, M1);
  // 圆润光影
  b.px(bx - s * 0.4, top + 1.2, M1, 1, 1);
  b.px(bx - s * 1.2, top - 0.2, M2, 1, 1);
}

// ---- 可爱大头(更圆更大) ----
function head(b, cx, cy, face = true, profile = false) {
  b.ellipse(cx, cy + 0.2, 6.3, 5.8, M3);
  b.ellipse(cx, cy - 0.4, 5.7, 5.2, M2);
  b.ellipse(cx - 1.0, cy - 1.5, 4.7, 4.0, M1);
  b.px(cx - 5.6, cy + 1.6, RIM, 1, 1);
  b.px(cx - 4.4, cy - 2.6, '#ffffff', 1, 1);
  if (face) {
    if (!profile) {
      // 圆滚滚大黑洞 + 小白高光(呆萌)
      b.ellipse(cx - 2.6, cy + 1.4, 2.3, 2.8, E);
      b.ellipse(cx + 2.6, cy + 1.4, 2.3, 2.8, E);
      b.px(cx - 3.4, cy + 0.4, SP, 1, 1);
      b.px(cx - 3.0, cy + 0.2, SP, 1, 1);
      b.px(cx + 1.8, cy + 0.4, SP, 1, 1);
      b.px(cx + 2.2, cy + 0.2, SP, 1, 1);
      // 中间白脊(短)
      b.rect(cx - 0.5, cy + 0.6, 1.0, 2.2, M1);
    } else {
      b.ellipse(cx + 4.6, cy + 1.3, 2.0, 2.8, E);
      b.px(cx + 4.0, cy + 0.2, SP, 1, 1);
      b.rect(cx - 3.0, cy - 1.0, 1.0, 3.2, M3);
    }
  } else {
    b.rect(cx - 1.4, cy - 0.8, 2.8, 0.9, M3);
    b.rect(cx - 1.4, cy + 0.8, 2.8, 0.9, M3);
  }
}

// ---- 银长剑骨钉(斜握右上, 清晰剑刃+护手+黑柄) ----
function nail(b, hx, hy) {
  b.rect(hx - 1, hy, 2, 3, GR);
  b.rect(hx - 2, hy - 1, 5, 1, N3);
  b.px(hx - 2, hy - 2, N2, 1, 1);
  b.px(hx + 2, hy - 2, N2, 1, 1);
  const edges = [
    [hx - 1, hy - 4], [hx, hy - 6], [hx + 1, hy - 8], [hx + 2, hy - 10], [hx + 3, hy - 12], [hx + 4, hy - 14],
  ];
  for (const [ex, ey] of edges) {
    b.rect(ex, ey, 2, 2, N2);
    b.rect(ex, ey, 2, 1, N1);
    b.px(ex + 1, ey + 1, N3, 1, 1);
  }
  b.px(hx + 4, hy - 15, N1, 1, 1);
  b.px(hx, hy - 7, N1, 1, 1);
  b.px(hx + 2, hy - 11, N1, 1, 1);
}

// ---- 黑细身(无披风, 无腿? 留两只小脚) ----
function slimBody(b, cx, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    b.rect(cx - 1, y, 2, 1, BODD);
    b.rect(cx, y, 1, 1, BODY);
  }
  for (let y = y0 + 1; y <= y0 + 4; y++) b.px(cx - 2, y, RIM, 1, 1);
}

function feet(b, cx, y) {
  b.ellipse(cx - 2.2, y + 0.4, 1.5, 1.4, BODD);
  b.ellipse(cx + 2.2, y + 0.4, 1.5, 1.4, BODD);
  b.px(cx - 2.6, y + 1.0, BODY, 1, 1);
  b.px(cx + 2.6, y + 1.0, BODY, 1, 1);
}

// ============ 正面(朝下) ============
export const knightDown = () => pixSprite('knight:down', W, H, (b) => {
  feet(b, CX, 19.6);
  slimBody(b, CX, 12.6, 19.4);
  // 左臂小短手, 右手握钉
  b.px(CX - 3, 13.6, BODD, 1, 1); b.px(CX - 3, 14.6, BODD, 1, 1);
  b.px(CX + 4, 13.8, BODD, 1, 1);
  nail(b, CX + 5, 15.2);
  horn(b, CX, 7.0, -1);
  horn(b, CX, 7.0, 1);
  head(b, CX, 7.2, true, false);
  b.px(CX - 1, 12.2, BODD, 1, 1);
  b.px(CX + 1, 12.2, BODD, 1, 1);
});

// ============ 背面(朝上) ============
export const knightUp = () => pixSprite('knight:up', W, H, (b) => {
  feet(b, CX, 19.6);
  slimBody(b, CX, 12.6, 19.4);
  horn(b, CX, 7.0, -1);
  horn(b, CX, 7.0, 1);
  head(b, CX, 7.2, false, false);
  // 骨钉露出一角(斜右上)
  b.px(CX + 6, 11, N2, 1, 1); b.px(CX + 7, 10, N2, 1, 1); b.px(CX + 8, 9, N1, 1, 1);
});

// ============ 侧面(朝右) ============
export const knightSide = () => pixSprite('knight:side', W, H, (b) => {
  feet(b, CX + 1, 19.6);
  slimBody(b, CX + 1, 12.6, 19.4);
  b.px(CX + 3, 13.6, BODD, 1, 1); b.px(CX + 4, 14.4, BODD, 1, 1);
  nail(b, CX + 5.5, 15.0);
  horn(b, CX + 1, 7.0, -1);
  horn(b, CX + 1, 7.0, 1);
  head(b, CX + 1, 7.2, true, true);
});

export function getKnight(direction) {
  if (direction.y < -0.4 && Math.abs(direction.x) < 0.6) return { s: knightUp(), flip: false };
  if (direction.y > 0.4 && Math.abs(direction.x) < 0.6) return { s: knightDown(), flip: false };
  return { s: knightSide(), flip: direction.x < 0 };
}

// 圣泪发射锚点(空洞眼窝位置 → 世界偏移 ×3)
export function eyeAnchors() {
  return {
    down: [{ x: -8, y: -19 }, { x: 8, y: -19 }],
    up: [{ x: -8, y: -19 }, { x: 8, y: -19 }],
    side: [{ x: 14, y: -19 }],
  };
}
