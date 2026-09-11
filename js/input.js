// input.js — 键盘 + 虚拟(触屏)输入统一管理
class Input {
  constructor() {
    this.keys = new Set();
    this.vKeys = new Set();
    this.joy = { x: 0, y: 0, active: false };
    this.pressed = new Set();   // 本帧按下(用于交互等)
    this.eaten = false;
    this.touchMode = false;     // 触屏模式(启用虚拟按键时置 true)
    this.slashBuffer = 0;       // 斩击输入缓冲(秒), 保证快速点按也能触发
    this._bind();
  }
  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this._block(e)) { e.preventDefault(); }
      if (this._block(e)) this.pressed.add(e.code);
      if (e.code === 'KeyJ' || e.code === 'KeyK') this.queueSlash();   // 快速点按也生效
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.pressed.clear(); });
  }
  _block(e) {
    const c = e.code;
    // 阻止方向键/空格/Tab 的默认行为(页面滚动、焦点跳转)
    return c.startsWith('Arrow') || c === 'Space' || c === 'KeyP' || c === 'KeyE' || c === 'Tab';
  }
  down(code) { return this.keys.has(code) || this.vKeys.has(code); }
  queueSlash() { this.slashBuffer = 0.18; }   // 点按斩击: 缓冲 0.18s
  // 鼠标瞄准(世界坐标由 main 换算后写入)
  setMouse(x, y) { this.mouse = { x, y, down: this.mouse ? this.mouse.down : false }; }
  setMouseDown(d) { if (this.mouse) this.mouse.down = d; }
  get mouseDown() { return !!(this.mouse && this.mouse.down); }
  mouseWorld() { return this.mouse ? { x: this.mouse.x, y: this.mouse.y } : { x: 480, y: 320 }; }
  // 本帧刚按下(任意键/指定键)
  pressedAny() { return this.pressed.size > 0; }
  pressedCode(code) { return this.pressed.has(code); }
  clearFrame() { this.pressed.clear(); }

  // ---- 移动(键盘 WASD; 或虚拟摇杆) ----
  moveVec() {
    if (this.joy.active && (Math.abs(this.joy.x) > 0.12 || Math.abs(this.joy.y) > 0.12)) {
      return { x: this.joy.x, y: this.joy.y };
    }
    let x = 0, y = 0;
    if (this.down('KeyW')) y -= 1;
    if (this.down('KeyS')) y += 1;
    if (this.down('KeyA')) x -= 1;
    if (this.down('KeyD')) x += 1;
    const l = Math.hypot(x, y);
    if (l > 0) { x /= l; y /= l; }
    return { x, y };
  }
  // ---- 射击: 独立四个方向(方向键) ----
  aimDirs() {
    const res = [];
    if (this.down('ArrowUp')) res.push({ x: 0, y: -1 });
    if (this.down('ArrowDown')) res.push({ x: 0, y: 1 });
    if (this.down('ArrowLeft')) res.push({ x: -1, y: 0 });
    if (this.down('ArrowRight')) res.push({ x: 1, y: 0 });
    return res;
  }
  aiming() { return this.aimDirs().length > 0; }

  interact() { return this.pressedCode('KeyE') || this.pressedCode('Space'); }
  pause() { return this.pressedCode('KeyP') || this.pressedCode('Escape'); }

  setVirtualMove(x, y) { this.joy.x = x; this.joy.y = y; this.joy.active = Math.hypot(x, y) > 0.05; }
  vDir(d, on) { if (on) this.vKeys.add(d); else this.vKeys.delete(d); }
}
export const input = new Input();
