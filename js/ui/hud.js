// hud.js — DOM HUD: 红心/道具栏/层数/Boss血条/道具闪光/房间名
import { hudHeart } from '../art/world.js';
import { iconSprite } from '../art/icons.js';
import { ITEM_MAP } from '../items.js';
import { FLOOR_LABELS } from '../config.js';

const $ = (id) => document.getElementById(id);

function canvasFrom(src, cls) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  c.className = cls || '';
  return c;
}

export const hud = {
  heartsEl: null, itemsEl: null, flashT: null,
  init() {
    this.heartsEl = $('hudHearts');
    this.itemsEl = $('hudItems');
  },
  setHearts(containers, half, maxContainers) {
    if (!this.heartsEl) return;
    this.heartsEl.innerHTML = '';
    const shown = Math.max(containers, maxContainers);
    for (let i = 0; i < shown; i++) {
      const hp = Math.max(0, Math.min(2, half - i * 2));
      const st = hp === 2 ? 'full' : hp === 1 ? 'half' : 'empty';
      const el = canvasFrom(hudHeart(st), 'hbox');
      this.heartsEl.appendChild(el);
    }
  },
  setItems(player) {
    if (!this.itemsEl) return;
    this.itemsEl.innerHTML = '';
    for (const id of player.items) {
      const item = ITEM_MAP.get(id);
      if (!item) continue;
      const el = canvasFrom(iconSprite(id, item.aura), 'ibox');
      this.itemsEl.appendChild(el);
    }
  },
  flashItem(item) {
    if (!item) return;
    const box = $('itemFlash');
    const iconEl = document.createElement('canvas');
    const icon = iconSprite(item.id, item.aura);
    iconEl.width = icon.width * 4; iconEl.height = icon.height * 4;
    const g = iconEl.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(icon, 0, 0, iconEl.width, iconEl.height);
    iconEl.id = 'itemFlashIcon';
    $('itemFlashName').textContent = item.name;
    $('itemFlashDesc').textContent = item.desc;
    const old = $('itemFlashIcon');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    const cont = $('itemFlashName');
    cont.parentNode.insertBefore(iconEl, cont);
    box.classList.remove('hidden');
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => box.classList.add('hidden'), 2300);
  },
  roomToast(text, boss = false) {
    const el = $('roomLabel');
    el.textContent = text;
    el.classList.toggle('boss', !!boss);
    el.classList.remove('show');
    // 触发重排以便再次播放进场动画
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.roomT);
    this.roomT = setTimeout(() => el.classList.remove('show'), 2000);
  },
  floorLabel(floorIdx) {
    $('hudFloor').textContent = '第 ' + FLOOR_LABELS[Math.min(floorIdx - 1, FLOOR_LABELS.length - 1)] + ' 层';
  },
  bossBar(show, pct, isKnight, name = '') {
    const w = $('bossBarWrap');
    if (!w) return;
    w.classList.toggle('hidden', !show);
    if (show) {
      $('bossBarFill').style.width = Math.max(0, Math.min(100, pct * 100)) + '%';
      $('bossBarFill').classList.toggle('w', !!isKnight);
      $('bossName').textContent = name;
    }
  },
  showGameUI(show) {
    $('hud').classList.toggle('hidden', !show);
  },
  setPickups() { /* 预留: 拾取物计数 */ },
};
