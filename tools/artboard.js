// artboard.js — 把当前小骑士放大画出来给决策用(正面/侧面/背面 + 敌我对照)
import { knightDown, knightUp, knightSide } from '/js/art/player.js';
import { gaperSprites, flySprites, slimeSprites } from '/js/art/monsters.js';
import { rockSprite } from '/js/art/world.js';

const c = document.getElementById('art');
const g = c.getContext('2d');
g.imageSmoothingEnabled = false;
const S = 7; // 放大倍数

function stamp(sprite, x, y, s = S, flip = false) {
  const w = sprite.width * s, h = sprite.height * s;
  g.save();
  g.translate(x, y);
  if (flip) g.scale(-1, 1);
  g.drawImage(sprite, -w / 2, -h / 2, w, h);
  g.restore();
}

function label(txt, x, y) {
  g.fillStyle = '#cfd6dd';
  g.font = '13px "Courier New", monospace';
  g.textAlign = 'center';
  g.globalAlpha = 0.85;
  g.fillText(txt, x, y);
  g.globalAlpha = 1;
}

function draw() {
  g.clearRect(0, 0, c.width, c.height);
  // 背景(冷灰, 模拟游戏地板)
  for (let y = 0; y < c.height; y += 64)
    for (let x = 0; x < c.width; x += 64) {
      g.fillStyle = ((x + y) / 64 % 2) ? '#3b434b' : '#414a52';
      g.fillRect(x, y, 64, 64);
    }
  g.fillStyle = 'rgba(10,14,18,0.6)';
  g.fillRect(0, 0, c.width, c.height);

  // 主角三视图(放大到 7x, 居中排)
  const down = knightDown(), side = knightSide(), up = knightUp();
  stamp(side, 250, 300, S);   // 侧面(朝右)
  stamp(down, 500, 300, S);   // 正面
  stamp(up, 750, 300, S);     // 背面
  label('侧面', 250, 560);
  label('正面', 500, 560);
  label('背面', 750, 560);

  // 敌人参照(下方一行, 4x)
  const gaper = gaperSprites()[0], fly = flySprites()[0], slime = slimeSprites()[0];
  stamp(fly, 110, 150, 4);
  stamp(slime, 280, 150, 4);
  stamp(gaper, 460, 150, 4);
  const rock = rockSprite(0);
  stamp(rock, 640, 150, 3);
  label('敌·飞行', 110, 210);
  label('敌·史莱姆', 280, 210);
  label('敌·咕噜怪', 460, 210);
  label('岩石', 640, 210);

  label('「小骑士」当前造型 · V8（放大 7 倍预览）', 500, 40);
}
draw();
