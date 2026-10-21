// ---------------------------------------------------------------------------
// مؤثرات «صيّادو الجراثيم»: أصوات مُركّبة بـ Web Audio (بلا ملفات ولا حقوق)،
// وموسيقى توليدية خافتة على مقام الحجاز، وصوت مكاني للفريقين (StereoPannerNode)،
// وطبقة جسيمات ثنائية الأبعاد (قصاصات، وحلقات، و«جراثيم مضيئة» للطبقة C الهادئة).
// مؤثرات المحرّك (sfx من board-kit) تبقى للالتقاط والصواب والفوز؛ هنا ما يخص اللعبة:
// مصباح يُضاء، ومروحة هواء، وعطسة، وفقاعات، ومسح، وسلة، ولمعان، وضربة منخفضة.
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

/** وجهة الصوت: يمين (الفريق الأول) أو يسار (الفريق الثاني) أو الوسط. */
function bus(pan = 0) {
  if (!pan || !ctx.createStereoPanner) return out;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(out);
  return p;
}

function tone(freq, t, dur, { type = 'sine', gain = 0.4, slideTo = 0, dest = null, pan = 0 } = {}) {
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
  o.connect(g).connect(dest || bus(pan));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
function noise(t, dur, { f0 = 400, f1 = 2400, q = 1.2, gain = 0.3, attack = 0.35, pan = 0, type = 'bandpass' } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = dur > 0.9;
  const bp = ctx.createBiquadFilter();
  bp.type = type;
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.max(0.01, dur * attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp).connect(g).connect(bus(pan));
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}

export const fxs = {
  /** هبوب: شيء يطير */
  whoosh(dur = 0.5, pan = 0) {
    noise(0, dur, { f0: 300, f1: 2600, q: 0.9, gain: 0.26, pan });
  },
  /** مصباح الضوء البنفسجي يُضاء: نقرة مفتاح ثم طنين خافت */
  lamp(pan = 0) {
    noise(0, 0.04, { f0: 3000, f1: 2600, q: 6, gain: 0.35, attack: 0.1, pan });
    tone(120, 0.05, 0.9, { type: 'sawtooth', gain: 0.035, pan });
    tone(240, 0.05, 0.9, { type: 'sine', gain: 0.05, pan });
    [880, 1320, 1760].forEach((f, i) => tone(f, 0.08 + i * 0.07, 0.5, { type: 'sine', gain: 0.07, pan }));
  },
  /** مروحة تنفخ الهواء */
  fan(dur = 1.0, pan = 0) {
    noise(0, dur, { f0: 220, f1: 900, q: 0.6, gain: 0.3, attack: 0.25, pan, type: 'lowpass' });
    noise(0.05, dur * 0.9, { f0: 1500, f1: 3500, q: 0.8, gain: 0.08, attack: 0.3, pan });
  },
  /** عطسة كرتونية: شهيق صاعد ثم انفجار هواء */
  achoo(pan = 0) {
    tone(260, 0, 0.45, { type: 'triangle', gain: 0.12, slideTo: 520, pan });
    noise(0, 0.45, { f0: 600, f1: 1800, q: 2, gain: 0.12, attack: 0.8, pan });
    noise(0.48, 0.38, { f0: 4200, f1: 900, q: 0.9, gain: 0.42, attack: 0.08, pan });
    tone(300, 0.48, 0.25, { type: 'triangle', gain: 0.16, slideTo: 140, pan });
  },
  /** رذاذ يتوقف عند منديل أو مرفق */
  thud(pan = 0) {
    noise(0, 0.18, { f0: 500, f1: 200, q: 1.2, gain: 0.3, attack: 0.1, pan });
    tone(140, 0, 0.2, { type: 'sine', gain: 0.3, slideTo: 80, pan });
  },
  /** فقاعات صابون */
  bubbles(pan = 0) {
    for (let i = 0; i < 9; i++) {
      const f = 700 + Math.random() * 900;
      tone(f, i * 0.09 + Math.random() * 0.05, 0.09, { type: 'sine', gain: 0.12, slideTo: f * 1.8, pan });
    }
  },
  /** مسح الطاولة */
  swish(pan = 0) {
    noise(0, 0.35, { f0: 900, f1: 2800, q: 1, gain: 0.2, pan });
    noise(0.4, 0.35, { f0: 2800, f1: 900, q: 1, gain: 0.2, pan });
  },
  /** المنديل يسقط في السلة ويُغلق غطاؤها */
  bin(pan = 0) {
    noise(0, 0.35, { f0: 400, f1: 2200, q: 0.9, gain: 0.2, pan });
    tone(180, 0.4, 0.25, { type: 'square', gain: 0.07, slideTo: 90, pan });
    noise(0.4, 0.08, { f0: 1200, f1: 800, q: 3, gain: 0.3, attack: 0.1, pan });
  },
  /** لمعان: انكشف شيء */
  shimmer(pan = 0) {
    [1568, 1976, 2349, 3136].forEach((f, i) => tone(f, i * 0.06, 0.35, { type: 'sine', gain: 0.11, pan }));
  },
  /** ضربة منخفضة سينمائية */
  boom() {
    tone(110, 0, 0.9, { type: 'sine', gain: 0.55, slideTo: 38 });
    noise(0, 0.5, { f0: 180, f1: 60, q: 0.7, gain: 0.2 });
  },
  /** خطأ لطيف */
  bonk(pan = 0) {
    tone(300, 0, 0.18, { type: 'sine', gain: 0.35, slideTo: 190, pan });
    tone(240, 0.09, 0.22, { type: 'triangle', gain: 0.18, slideTo: 170, pan });
  },
  /** إطفاء الأنوار (منتصف اللعبة) */
  lightsOut() {
    noise(0, 0.05, { f0: 2500, f1: 2000, q: 5, gain: 0.35, attack: 0.1 });
    tone(196, 0.1, 1.6, { type: 'sine', gain: 0.25, slideTo: 98 });
    [587, 622, 740, 880].forEach((f, i) => tone(f, 0.5 + i * 0.16, 0.7, { type: 'triangle', gain: 0.13 }));
  },
};

// ---------------------------------------------------------------- الموسيقى
// مقام الحجاز على «ري»: ري مي♭ فا# صول لا سي♭ دو ري — مقام مختلف عن ألعاب القسم الأخرى (الرست).
const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12];
const BASE = 146.83; // ري٣
const hz = (st) => BASE * Math.pow(2, st / 12);

export const music = {
  on: false,
  tempo: 0.42,
  _t: 0,
  _step: 0,
  _deg: 4,
  _timer: 0,
  start(fast = false) {
    if (!ctx || !enabled) return;
    this.tempo = fast ? 0.3 : 0.42;
    if (this.on) return;
    this.on = true;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.1, ctx.currentTime, 0.8);
    this._t = ctx.currentTime + 0.1;
    this._schedule();
  },
  faster() {
    this.tempo = 0.3;
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
      if (this._step % 8 === 0) {
        tone(hz(-12), t, this.tempo * 7.5, { type: 'sine', gain: 0.5, dest: musicGain });
        tone(hz(-5), t, this.tempo * 7.5, { type: 'sine', gain: 0.2, dest: musicGain });
      }
      if (Math.random() > 0.2) {
        this._deg = Math.max(0, Math.min(HIJAZ.length - 1, this._deg + [-1, -1, 1, 1, 0, 2, -2][(Math.random() * 7) | 0]));
        tone(hz(HIJAZ[this._deg] + 12), t, this.tempo * 1.5, { type: 'triangle', gain: 0.3, dest: musicGain });
      }
      // إيقاع خفيف (دُم/تَك) كإيقاع المقسوم المبسّط
      if (this._step % 8 === 0 || this._step % 8 === 3) tone(88, t, 0.18, { type: 'sine', gain: 0.35, slideTo: 48, dest: musicGain });
      else if (this._step % 2 === 0) tone(950, t, 0.035, { type: 'square', gain: 0.035, dest: musicGain });
      this._step++;
      this._t += this.tempo;
    }
    this._timer = setTimeout(() => this._schedule(), 200);
  },
};

// ---------------------------------------------------------------- الجسيمات ثنائية الأبعاد
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
    const cols = ['#6d28d9', '#8a1538', '#0e7490', '#f2b51b', '#10b981', '#e8604c', '#ffffff'];
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
  frame(dt, extra) {
    const c = this.ctx;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.save();
    c.scale(this.scale, this.scale);
    extra?.(c, dt);
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

// ---------------------------------------------------------------- جراثيم مضيئة ثنائية الأبعاد (الطبقة C)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * نسخة هادئة من نظام الجراثيم بلا WebGL: نقاط مضيئة تنتقل بين «من» و«إلى»
 * بالواجهة نفسها التي يستعملها المشهد ثلاثي الأبعاد (cling/move/fade). الإحداثيات بوحدة u.
 */
export class GermDots {
  constructor(n = 70) {
    this.n = n;
    this.dots = [];
    this.glow = 0;
    this.glowTo = 0;
    this.t = 1;
    this.dur = 1;
  }
  /** pts: [{x,y}] مواضع الوصول؛ from: دالة تعطي موضع البداية لكل نقطة */
  set(pts, { from = null, dur = 0.6, alphaTo = 1, alphaFrom = null, delay = 0.35 } = {}) {
    const prev = this.dots;
    this.dots = pts.slice(0, this.n).map((p, i) => {
      const old = prev[i];
      const f = from ? from(i) : old ? { x: old.tx, y: old.ty } : { x: p.x, y: p.y };
      return {
        fx: f.x, fy: f.y, tx: p.x, ty: p.y,
        fa: alphaFrom ?? (from ? 0 : old ? old.ta : 0), ta: alphaTo,
        d: Math.random() * delay, r: 4 + Math.random() * 6, h: Math.random(), w: Math.random() * 6,
      };
    });
    this.t = 0;
    this.dur = Math.max(0.05, dur);
  }
  /** يحرّك نقاطًا مختارة إلى مواضع جديدة (والباقي يبقى) */
  move(fn, { dur = 0.8, delay = 0.35 } = {}) {
    for (const [i, d] of this.dots.entries()) {
      const r = fn(d, i);
      d.fx = d.tx;
      d.fy = d.ty;
      d.fa = d.ta;
      if (r) {
        d.tx = r.x;
        d.ty = r.y;
        d.ta = r.a ?? d.ta;
      }
      d.d = Math.random() * delay;
    }
    this.t = 0;
    this.dur = Math.max(0.05, dur);
  }
  clear() {
    this.dots = [];
  }
  draw(c, dt, now) {
    this.t = Math.min(1, this.t + dt / this.dur);
    this.glow += (this.glowTo - this.glow) * Math.min(1, dt * 8);
    if (this.glow < 0.02 || !this.dots.length) return;
    for (const d of this.dots) {
      const k = Math.max(0, Math.min(1, (this.t - d.d) / (1 - 0.35)));
      const e = ease(k);
      const x = d.fx + (d.tx - d.fx) * e + Math.sin(now * 3 + d.w * 9) * 2;
      const y = d.fy + (d.ty - d.fy) * e + Math.cos(now * 2.4 + d.w * 7) * 2 - Math.sin(k * Math.PI) * 30;
      const a = (d.fa + (d.ta - d.fa) * e) * this.glow;
      if (a < 0.02) continue;
      c.globalAlpha = a * 0.35;
      c.fillStyle = d.h < 0.6 ? '#d9ff4a' : '#8ff8ff';
      c.beginPath();
      c.arc(x, y, d.r * 2.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = a;
      c.beginPath();
      c.arc(x, y, d.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}
