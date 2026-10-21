// ---------------------------------------------------------------------------
// الطبقة C الهادئة (بلا WebGL): الواجهة نفسها التي يقدّمها scene3d.js، لكن الحجرة تعرض
// رمز الشيء (HTML في game.js) والجراثيم نقاط مضيئة على لوحة ثنائية الأبعاد.
// تُختار حين يطلب الجهاز تقليل الحركة، أو تفشل تهيئة الأبعاد الثلاثة، أو يُفرض ?tier=C،
// أو ينزل منظّم الجودة من B. اللعبة قابلة للعب بالكامل هنا: الأهداف هي نفسها.
// ---------------------------------------------------------------------------
import { GermDots } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class FlatView {
  constructor() {
    this.tier = 'C';
    this.reduced = false;
    this.teams = {};
    this.onSound = () => {};
    this._timers = new Set();
  }
  dispose() {
    this._clearTimers();
  }
  layout() {}
  setTeams(spec) {
    for (const id of Object.keys(this.teams)) if (!spec[id]) delete this.teams[id];
    for (const [id, s] of Object.entries(spec)) {
      const T = (this.teams[id] ||= { id, dots: new GermDots(70) });
      T.booth = s.booth;
      T.zone = s.zone;
      const b = s.booth;
      T.c = { x: b.x + b.w / 2, y: b.y + b.h * 0.56 };
      T.R = Math.min(b.w, b.h) * 0.3;
    }
  }
  team(id) {
    return this.teams[id];
  }
  later(fn, ms) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, this.reduced ? ms * 0.4 : ms);
    this._timers.add(t);
  }
  _clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
  }
  /** نقاط في قرص حول مركز (توزيع منتظم بالمساحة) */
  _disc(cx, cy, rx, ry, n) {
    return Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      return { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
    });
  }

  preview() {}
  lampOn(id) {
    if (this.teams[id]) this.teams[id].dots.glowTo = 1;
  }
  lampOff(id) {
    if (this.teams[id]) this.teams[id].dots.glowTo = 0;
  }
  cling(id) {
    const T = this.teams[id];
    if (!T) return;
    const pts = this._disc(T.c.x, T.c.y, T.R * 0.95, T.R * 0.85, 60);
    T.dots.set(pts, { from: (i) => ({ x: pts[i].x + rnd(-60, 60), y: pts[i].y - 70 }), dur: 0.7 });
  }
  blow(id, grip) {
    const T = this.teams[id];
    if (!T) return;
    const dir = id === 'b' ? -1 : 1;
    T.dots.move((d) => (Math.random() < grip ? null : { x: d.tx + dir * rnd(300, 700), y: d.ty - rnd(60, 260), a: 0 }), { dur: 1.2 });
  }
  endTest(id) {
    const T = this.teams[id];
    if (!T) return;
    this.lampOff(id);
    this.later(() => T.dots.clear(), 450);
  }
  shake() {}

  vignette(id, item) {
    const T = this.teams[id];
    if (!T) return;
    const { c, R } = T;
    const D = T.dots;
    D.clear();
    const sc = item.scene;
    const left = { x: c.x - R * 1.15, y: c.y - R * 0.1 };
    if (sc === 'spray' || sc === 'tissue' || sc === 'elbow') {
      this.later(() => this.onSound(id, 'achoo'), 300);
      this.later(() => {
        const pts = sc === 'spray'
          ? Array.from({ length: 60 }, () => ({ x: c.x + rnd(-0.4, 2.0) * R, y: c.y + rnd(-0.5, 0.9) * R }))
          : this._disc(c.x - R * 0.15, c.y, R * 0.12, R * 0.4, 60);
        D.set(pts, { from: () => ({ x: left.x + rnd(-6, 6), y: left.y + rnd(-6, 6) }), alphaFrom: 1, dur: sc === 'spray' ? 1.1 : 0.45 });
        if (sc !== 'spray') this.later(() => this.onSound(id, 'thud'), 250);
      }, 820);
      if (sc === 'tissue') this.later(() => D.move(() => ({ x: c.x - R * 0.15 + rnd(-8, 8), y: c.y + rnd(-8, 8) }), { dur: 0.35 }), 1700);
      return;
    }
    if (sc === 'shake' || sc === 'food') {
      const a = this._disc(c.x - R * 1.1, c.y, R * 0.45, R * 0.55, 56);
      this.later(() => D.set(a, { from: (i) => ({ x: a[i].x, y: a[i].y - 50 }), dur: 0.5 }), 350);
      this.later(() => {
        this.onSound(id, 'whoosh');
        D.move((d, i) => (i % 2 === 0 ? { x: d.tx + R * 2.2, y: d.ty } : null), { dur: 0.7 });
      }, 1420);
      return;
    }
    if (sc === 'leave' || sc === 'clean') {
      const band = () => ({ x: c.x + rnd(-1.6, 1.6) * R, y: c.y + R * 0.55 + rnd(-0.15, 0.15) * R });
      if (sc === 'leave') {
        const a = this._disc(c.x - R * 0.15, c.y + R * 0.2, R * 0.25, R * 0.25, 56);
        this.later(() => D.set(a, { from: (i) => ({ x: a[i].x, y: a[i].y - 50 }), dur: 0.5 }), 300);
        this.later(() => D.move(() => band(), { dur: 1.2 }), 1100);
      } else {
        const a = Array.from({ length: 56 }, band);
        this.later(() => D.set(a, { from: (i) => ({ x: a[i].x, y: a[i].y - 50 }), dur: 0.6 }), 300);
        this.later(() => this.onSound(id, 'swish'), 900);
        for (let s = 0; s < 4; s++) {
          const xCut = c.x - 1.6 * R + (s + 1) * 0.8 * R;
          this.later(() => D.move((d) => (d.tx < xCut ? { x: d.tx, y: d.ty - 20, a: 0 } : null), { dur: 0.35 }), 1000 + s * 260);
        }
      }
      return;
    }
    if (sc === 'wash') {
      const a = this._disc(c.x, c.y, R * 0.7, R * 0.8, 60);
      this.later(() => D.set(a, { from: (i) => ({ x: a[i].x, y: a[i].y - 50 }), dur: 0.5 }), 250);
      this.later(() => this.onSound(id, 'bubbles'), 800);
      this.later(() => D.move((d) => ({ x: d.tx + rnd(-40, 40), y: d.ty + rnd(250, 500), a: 0 }), { dur: 1.2 }), 1150);
      return;
    }
    if (sc === 'bin') {
      const a = this._disc(c.x - R * 1.2, c.y - R * 0.4, R * 0.3, R * 0.3, 50);
      this.later(() => D.set(a, { from: (i) => ({ x: a[i].x, y: a[i].y - 40 }), dur: 0.45 }), 250);
      this.later(() => {
        this.onSound(id, 'bin');
        D.move(() => ({ x: c.x + R * 1.1 + rnd(-15, 15), y: c.y + R * 0.4 + rnd(-15, 15) }), { dur: 0.6 });
      }, 900);
      this.later(() => D.move((d) => ({ x: d.tx, y: d.ty + 40, a: 0 }), { dur: 0.35 }), 1550);
    }
  }

  midHands(id, on) {
    const T = this.teams[id];
    if (!T) return;
    if (!on) {
      this.lampOff(id);
      this.later(() => T.dots.clear(), 400);
      return;
    }
    const z = T.zone;
    const cx = (z.x0 + z.x1) / 2;
    const cy = z.top + (z.bottom - z.top) * 0.47;
    const s = Math.min((z.x1 - z.x0) * 0.2, (z.bottom - z.top) * 0.28);
    const pts = [...this._disc(cx - s * 1.0, cy, s * 0.7, s * 0.9, 35), ...this._disc(cx + s * 1.0, cy, s * 0.7, s * 0.9, 35)];
    T.dots.n = 70;
    this.lampOn(id);
    this.later(() => T.dots.set(pts, { from: (i) => ({ x: pts[i].x + rnd(-200, 200), y: pts[i].y - 200 }), dur: 1.3 }), 900);
  }

  intro() {
    for (const T of Object.values(this.teams)) {
      const pts = this._disc(T.c.x, T.c.y, T.R * 1.2, T.R, 50);
      this.lampOn(T.id);
      T.dots.set(pts, { from: () => ({ x: rnd(T.zone.x0, T.zone.x1), y: rnd(T.zone.top, T.zone.bottom) }), dur: 1.2 });
      this.later(() => this.lampOff(T.id), 1700);
      this.later(() => T.dots.clear(), 2300);
    }
  }
  startMeasure() {}
  stopMeasure() {
    return 0;
  }
  async warmUp() {}
  reset() {
    this._clearTimers();
    for (const T of Object.values(this.teams)) {
      T.dots.clear();
      T.dots.glowTo = 0;
    }
  }
  /** يُرسم داخل حلقة الجسيمات ثنائية الأبعاد (fx.js) */
  draw(c, dt) {
    const now = performance.now() / 1000;
    for (const T of Object.values(this.teams)) T.dots.draw(c, dt, now);
  }
}
