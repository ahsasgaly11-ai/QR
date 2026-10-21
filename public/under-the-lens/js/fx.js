// ---------------------------------------------------------------------------
// مؤثرات «عالَمٌ تحت العدسة»: أصوات مُركّبة بـ Web Audio (بلا ملفات)، وموسيقى
// توليدية خافتة على مقام الرست (بأرباع الصوت الحقيقية)، وطبقة جسيمات خفيفة.
// مؤثرات المحرّك (sfx من board-kit) تبقى للالتقاط والصواب والفوز؛ هنا ما يخصّ اللعبة:
// هبوب، وطقطقة ضبط التركيز (كمقبض المجهر)، ولمعان، وضربة منخفضة، وقفل يُفتح.
// ---------------------------------------------------------------------------
let ctx = null;
let out = null;
let musicGain = null;
let noiseBuf = null;
let enabled = true;

/** iOS: لا صوت إلا بعد لمسة من المستخدم على الجهاز. */
function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(out);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });

export function setFxSound(on) {
  enabled = !!on;
  if (!enabled) music.stop();
}

function tone(freq, t, dur, { type = 'sine', gain = 0.4, slideTo = 0, dest = null } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || out);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
function noise(t, dur, { f0 = 400, f1 = 2400, q = 1.2, gain = 0.3 } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp).connect(g).connect(out);
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}

export const fxs = {
  /** هبوب: الأداة تطير */
  whoosh(dur = 0.5) {
    noise(0, dur, { f0: 300, f1: 2600, q: 0.9, gain: 0.28 });
  },
  /** طقطقة ضبط التركيز: نقرات تتسارع ثم تهدأ */
  focus(dur = 1.2) {
    if (!ctx || !enabled) return;
    let t = 0;
    let gap = 0.11;
    while (t < dur) {
      noise(t, 0.03, { f0: 3200, f1: 2800, q: 6, gain: 0.22 });
      tone(1800, t, 0.025, { type: 'square', gain: 0.03 });
      t += gap;
      gap = Math.max(0.045, gap * 0.9);
    }
  },
  /** لمعان: الصورة صارت واضحة */
  shimmer() {
    [1568, 1976, 2349, 3136].forEach((f, i) => tone(f, i * 0.06, 0.35, { type: 'sine', gain: 0.12 }));
  },
  /** ضربة منخفضة سينمائية */
  boom() {
    tone(110, 0, 0.9, { type: 'sine', gain: 0.55, slideTo: 38 });
    noise(0, 0.5, { f0: 180, f1: 60, q: 0.7, gain: 0.2 });
  },
  /** خطأ لطيف (أهدأ من sawtooth) */
  bonk() {
    tone(300, 0, 0.18, { type: 'sine', gain: 0.35, slideTo: 190 });
    tone(240, 0.09, 0.22, { type: 'triangle', gain: 0.18, slideTo: 170 });
  },
  /** ضباب: العدسة لا تكفي */
  blur() {
    tone(520, 0, 0.5, { type: 'sine', gain: 0.18, slideTo: 330 });
    noise(0, 0.5, { f0: 900, f1: 300, q: 2, gain: 0.12 });
  },
  /** قفل يُفتح ثم نغمة مكافأة */
  unlock() {
    noise(0, 0.05, { f0: 2500, f1: 2000, q: 5, gain: 0.35 });
    noise(0.08, 0.05, { f0: 1800, f1: 1500, q: 5, gain: 0.35 });
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18 + i * 0.09, 0.4, { type: 'triangle', gain: 0.3 }));
  },
};

// ---------------------------------------------------------------- الموسيقى
// مقام الرست على «دو»: دو ري مي½♭ فا صول لا سي½♭ (أرباع الصوت تُكتب 3.5 و10.5 نصف درجة)
const RAST = [0, 2, 3.5, 5, 7, 9, 10.5, 12];
const BASE = 130.81; // دو٣
const hz = (st) => BASE * Math.pow(2, st / 12);

export const music = {
  on: false,
  tempo: 0.46,
  _t: 0,
  _step: 0,
  _deg: 4,
  _timer: 0,
  start(fast = false) {
    if (!ctx || !enabled) return;
    this.tempo = fast ? 0.32 : 0.46;
    if (this.on) return;
    this.on = true;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.11, ctx.currentTime, 0.8);
    this._t = ctx.currentTime + 0.1;
    this._schedule();
  },
  faster() {
    this.tempo = 0.32;
  },
  stop() {
    this.on = false;
    clearTimeout(this._timer);
    if (ctx && musicGain) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  },
  _schedule() {
    if (!this.on || !ctx) return;
    while (this._t < ctx.currentTime + 0.6) {
      const t = this._t - ctx.currentTime;
      // نغمة أرضية كل أربع خطوات
      if (this._step % 8 === 0) {
        tone(hz(-12), t, this.tempo * 7.5, { type: 'sine', gain: 0.5, dest: musicGain });
        tone(hz(-5), t, this.tempo * 7.5, { type: 'sine', gain: 0.22, dest: musicGain });
      }
      // لحن متجوّل خطوة صغيرة لأعلى أو لأسفل، يستريح أحيانًا
      if (Math.random() > 0.18) {
        this._deg = Math.max(0, Math.min(RAST.length - 1, this._deg + [-1, -1, 1, 1, 0, 2, -2][(Math.random() * 7) | 0]));
        tone(hz(RAST[this._deg] + 12), t, this.tempo * 1.6, { type: 'triangle', gain: 0.32, dest: musicGain });
      }
      // إيقاع خفيف (دُم/تَك)
      if (this._step % 4 === 0) tone(90, t, 0.18, { type: 'sine', gain: 0.35, slideTo: 50, dest: musicGain });
      else if (this._step % 4 === 2) tone(900, t, 0.04, { type: 'square', gain: 0.04, dest: musicGain });
      this._step++;
      this._t += this.tempo;
    }
    this._timer = setTimeout(() => this._schedule(), 200);
  },
};

// ---------------------------------------------------------------- الجسيمات
/** طبقة جسيمات على لوحة 2D فوق البطاقات (لا تستقبل اللمس). الإحداثيات بوحدة u. */
export class Particles {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ps = [];
    this.rings = [];
    this.scale = 1;
    this.reduced = false;
  }
  resize(wPx, hPx, scale) {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    this.cv.width = Math.round(wPx * dpr);
    this.cv.height = Math.round(hPx * dpr);
    this.scale = scale * dpr;
  }
  get busy() {
    return this.ps.length > 0 || this.rings.length > 0;
  }
  burst(x, y, color, n = 36) {
    const count = this.reduced ? Math.round(n / 4) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 180 + Math.random() * 420;
      this.ps.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 520, life: 0.7 + Math.random() * 0.5, t: 0,
        r: 5 + Math.random() * 8, color: Math.random() < 0.3 ? '#ffd667' : color, star: Math.random() < 0.45, rot: Math.random() * 6,
      });
    }
  }
  ring(x, y, r0, color) {
    this.rings.push({ x, y, r0, t: 0, life: this.reduced ? 0.3 : 0.6, color });
  }
  confetti(VW, n = 160) {
    const count = this.reduced ? 30 : n;
    const cols = ['#8a1538', '#0e7490', '#f2b51b', '#2f8a3c', '#e8604c', '#7c3aed', '#ffffff'];
    for (let i = 0; i < count; i++) {
      this.ps.push({
        x: Math.random() * VW, y: -40 - Math.random() * 500, vx: (Math.random() - 0.5) * 120, vy: 160 + Math.random() * 220, g: 60,
        life: 3.6, t: 0, r: 9 + Math.random() * 9, color: cols[i % cols.length], conf: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9,
      });
    }
  }
  clear() {
    this.ps = [];
    this.rings = [];
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }
  frame(dt) {
    const c = this.ctx;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.busy) return;
    c.save();
    c.scale(this.scale, this.scale);
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.life;
      c.globalAlpha = Math.max(0, 1 - k);
      c.strokeStyle = r.color;
      c.lineWidth = 14 * (1 - k) + 2;
      c.beginPath();
      c.arc(r.x, r.y, r.r0 * (1 + k * 0.5), 0, Math.PI * 2);
      c.stroke();
    }
    this.rings = this.rings.filter((r) => r.t < r.life);
    for (const p of this.ps) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.vr || 3) * dt;
      const k = p.t / p.life;
      c.globalAlpha = p.conf ? Math.min(1, (p.life - p.t) * 2) : Math.max(0, 1 - k * k);
      c.fillStyle = p.color;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      if (p.conf) c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      else if (p.star) {
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? p.r * 0.45 : p.r;
          const a = (i / 10) * Math.PI * 2;
          c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.fill();
      } else {
        c.beginPath();
        c.arc(0, 0, p.r * 0.6, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    this.ps = this.ps.filter((p) => p.t < p.life);
    c.restore();
  }
}
