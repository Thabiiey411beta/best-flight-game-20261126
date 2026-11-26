// Aurora Courier — keyboard, mouse and touch input, normalised to a small
// control object the physics step reads each frame.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0; // -1..1 across the canvas
    this.mouseY = 0; // -1..1 down the canvas
    this.mouseActive = false;
    this.touchX = 0;
    this.touchY = 0;
    this.touchActive = false;
    this.pressed = new Set(); // keys pressed since last consume()
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.mouseActive = true;
    });
    canvas.addEventListener('mousedown', () => { this.mouseActive = true; });
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchActive = true;
      this.updateTouch(e);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.updateTouch(e);
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.touchActive = false; });
  }

  updateTouch(e) {
    const t = e.touches[0];
    const r = this.canvas.getBoundingClientRect();
    this.touchX = ((t.clientX - r.left) / r.width) * 2 - 1;
    this.touchY = ((t.clientY - r.top) / r.height) * 2 - 1;
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  consume(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  // Steering: keyboard arrows/WASD first, then pointer position.
  // Returns { pitch: -1..1 (up positive), roll: -1..1 (right positive),
  // throttle: -1..1, pointer: boolean }.
  controls() {
    let pitch = 0, roll = 0, throttle = 0;
    if (this.down('arrowup', 'w')) pitch += 1;
    if (this.down('arrowdown', 's')) pitch -= 1;
    if (this.down('arrowleft', 'a')) roll -= 1;
    if (this.down('arrowright', 'd')) roll += 1;
    if (this.down('shift')) throttle += 1;
    if (this.down('control')) throttle -= 1;
    // Mouse: hold the pointer off-centre to steer; centre is neutral.
    if (this.mouseActive && !this.touchActive) {
      const mx = this.mouseX, my = this.mouseY;
      if (Math.abs(mx) > 0.12) roll += Math.max(-1, Math.min(1, mx * 1.4));
      if (Math.abs(my) > 0.12) pitch -= Math.max(-1, Math.min(1, my * 1.4));
    }
    if (this.touchActive) {
      roll += Math.max(-1, Math.min(1, this.touchX * 1.5));
      pitch -= Math.max(-1, Math.min(1, this.touchY * 1.5));
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttle: Math.max(-1, Math.min(1, throttle)),
      pointer: this.mouseActive || this.touchActive,
    };
  }
}
