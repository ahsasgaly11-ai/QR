// ---------------------------------------------------------------------------
// أصوات «أسبوع الزكام» بـ Web Audio API (مُركّبة بالكود: بلا ملفات ولا حقوق).
//   • مؤثرات اللعبة: عطسة «ها… تشو!»، وحجز الرذاذ بالمرفق أو المنديل، وسلة، وماء وفقاعات،
//     ومسح، وجرعة ماء، وباب، وتكّات الساعة، وجرس المدرسة، وشهقة الزكام، وهتاف.
//   • صوت مكاني للسباق: أصوات صف اللاعب الأول يمينًا والثاني يسارًا (StereoPannerNode).
//   • موسيقى خافتة توليدية على مقام البيات (بربع تون: درجته الثانية منخفضة ربع صوت)
//     بإيقاع الوحدة البطيء، يتسارع بعد منتصف الأسبوع.
//   • زر الكتم في أدوات المعلم. iOS لا يُطلق الصوت إلا بعد لمسة: نفتح السياق عند أول لمسة
//     أو ضغطة على الصفحة (ومعه مؤثرات المحرّك).
// ---------------------------------------------------------------------------
import { unlock as kitUnlock, setSound as kitSound } from '/board-kit/js/audio.js';

let ctx = null;
let out = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
let allow = () => true; // إعداد «المؤثرات الصوتية» في لوحة المعلم
const listeners = new Set();

function ensure() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : 0.6;
      // ضاغط خفيف: يحمي سمّاعة جهاز العرض من الذروات
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      out.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(out);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ctx.onstatechange = () => emit();
    }
    if (ctx.state === 'suspended') ctx.resume().then(emit, emit);
  } catch {
    ctx = null;
  }
}
function onGesture() {
  ensure();
  kitUnlock();
  emit();
}
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, onGesture, { capture: true, passive: true });

function emit() {
  for (const f of listeners) f(audioState());
}
/** 'locked' (يحتاج لمسة) | 'on' | 'muted' */
export function audioState() {
  if (muted) return 'muted';
  if (!ctx || ctx.state !== 'running') return 'locked';
  return 'on';
}
export function onAudioState(f) {
  listeners.add(f);
  f(audioState());
}
export function setAllow(fn) {
  allow = fn;
}
export function setMuted(on, kitOn = true) {
  muted = !!on;
  if (out) out.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05);
  kitSound(!muted && kitOn);
  if (muted) speechSynthesis?.cancel?.();
  emit();
}
export function isMuted() {
  return muted;
}

const live = () => ctx && !muted && allow();

function bus(pan = 0) {
  if (!pan || !ctx.createStereoPanner) return out;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(out);
  return p;
}
function tone(freq, t, dur, { type = 'sine', gain = 0.3, slideTo = 0, pan = 0, dest = null, attack = 0.015 } = {}) {
  if (!live()) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || bus(pan));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
function noise(t, dur, { f0 = 500, f1 = 2000, q = 1, gain = 0.25, attack = 0.3, pan = 0, type = 'bandpass' } = {}) {
  if (!live()) return;
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.max(0.008, dur * attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(bus(pan));
  s.start(t0, Math.random());
  s.stop(t0 + dur + 0.05);
}

export const fxs = {
  /** «ها… تشو!»: شهيقان صاعدان ثم انفجار هواء */
  achoo(pan = 0, cough = false) {
    if (cough) {
      noise(0, 0.22, { f0: 900, f1: 400, q: 0.8, gain: 0.32, attack: 0.05, pan });
      noise(0.28, 0.2, { f0: 800, f1: 350, q: 0.8, gain: 0.26, attack: 0.05, pan });
      tone(170, 0, 0.18, { type: 'triangle', gain: 0.12, slideTo: 110, pan });
      return;
    }
    tone(300, 0, 0.32, { type: 'triangle', gain: 0.07, slideTo: 520, pan, attack: 0.2 });
    noise(0, 0.32, { f0: 700, f1: 1800, q: 2, gain: 0.08, attack: 0.8, pan });
    noise(0.36, 0.42, { f0: 4800, f1: 700, q: 0.7, gain: 0.45, attack: 0.05, pan });
    tone(330, 0.36, 0.22, { type: 'triangle', gain: 0.12, slideTo: 150, pan });
  },
  /** المرفق أو المنديل يحجز الرذاذ: ضربة ناعمة مكتومة */
  block(pan = 0) {
    noise(0, 0.16, { f0: 700, f1: 200, q: 1.2, gain: 0.28, attack: 0.08, pan, type: 'lowpass' });
    tone(150, 0, 0.18, { type: 'sine', gain: 0.25, slideTo: 90, pan });
  },
  /** لمعان (صواب، شفاء) */
  sparkle(pan = 0) {
    [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.055, 0.35, { type: 'sine', gain: 0.07, pan }));
  },
  bin(pan = 0) {
    tone(880, 0, 0.12, { type: 'square', gain: 0.04, pan });
    noise(0.02, 0.1, { f0: 3000, f1: 1500, q: 3, gain: 0.12, attack: 0.1, pan });
    tone(420, 0.25, 0.12, { type: 'triangle', gain: 0.15, slideTo: 300, pan });
  },
  water(pan = 0) {
    noise(0, 1.3, { f0: 2400, f1: 1800, q: 0.6, gain: 0.12, attack: 0.15, pan, type: 'highpass' });
  },
  bubbles(pan = 0) {
    for (let i = 0; i < 10; i++) {
      const f = 600 + Math.random() * 1000;
      tone(f, 0.1 + i * 0.11 + Math.random() * 0.05, 0.09, { type: 'sine', gain: 0.09, slideTo: f * 1.9, pan });
    }
  },
  wipe(pan = 0) {
    for (let i = 0; i < 6; i++) noise(i * 0.2, 0.18, { f0: 1500, f1: 3400, q: 1.1, gain: 0.12, attack: 0.5, pan });
  },
  gulp(pan = 0) {
    tone(220, 0, 0.12, { type: 'sine', gain: 0.2, slideTo: 380, pan });
    tone(200, 0.2, 0.12, { type: 'sine', gain: 0.18, slideTo: 360, pan });
  },
  door(pan = 0) {
    tone(140, 0, 0.5, { type: 'sawtooth', gain: 0.03, slideTo: 210, pan, attack: 0.2 });
    noise(0.55, 0.12, { f0: 400, f1: 200, q: 1, gain: 0.2, attack: 0.1, pan, type: 'lowpass' });
  },
  /** تكّات الساعة أثناء مرور الوقت */
  tick(pan = 0) {
    for (let i = 0; i < 6; i++) tone(2600, i * 0.17, 0.03, { type: 'square', gain: 0.025, pan });
  },
  /** جرس المدرسة: بداية الموقف */
  cue(pan = 0) {
    tone(988, 0, 0.6, { type: 'sine', gain: 0.1, pan });
    tone(784, 0.18, 0.7, { type: 'sine', gain: 0.1, pan });
  },
  sniff(pan = 0) {
    noise(0, 0.25, { f0: 1800, f1: 3000, q: 2.5, gain: 0.06, attack: 0.7, pan });
  },
  /** خطأ لطيف (لا لوم): نغمتان هابطتان ناعمتان */
  oops(pan = 0) {
    tone(392, 0, 0.18, { type: 'triangle', gain: 0.14, pan });
    tone(330, 0.13, 0.26, { type: 'triangle', gain: 0.12, pan });
  },
  /** منتصف الأسبوع: عدسة تظهر */
  mid(pan = 0) {
    tone(523, 0, 0.5, { type: 'sine', gain: 0.08, slideTo: 1046, pan });
    [659, 784, 988].forEach((f, i) => tone(f, 0.25 + i * 0.09, 0.4, { type: 'triangle', gain: 0.06, pan }));
  },
  /** لهب يشتعل: نفَس هواء صاعد، وزئير منخفض، وطقطقة جمرات */
  flame(pan = 0) {
    noise(0, 0.5, { f0: 200, f1: 1800, q: 0.7, gain: 0.32, attack: 0.08, pan, type: 'lowpass' });
    noise(0.05, 1.1, { f0: 160, f1: 90, q: 0.6, gain: 0.22, attack: 0.15, pan, type: 'lowpass' });
    tone(110, 0, 0.6, { type: 'sine', gain: 0.22, slideTo: 60, pan });
    for (let i = 0; i < 10; i++) noise(0.15 + Math.random() * 0.9, 0.025, { f0: 2500 + Math.random() * 2500, f1: 1800, q: 5, gain: 0.08 + Math.random() * 0.06, attack: 0.1, pan, type: 'bandpass' });
    [784, 1175, 1568].forEach((f, i) => tone(f, 0.12 + i * 0.07, 0.5, { type: 'sine', gain: 0.05, pan }));
  },
  /** غوص في قطرة: «بلوب» مائي، وفقاعات، وصدى منخفض */
  dive(pan = 0) {
    tone(520, 0, 0.35, { type: 'sine', gain: 0.25, slideTo: 140, pan });
    noise(0, 0.6, { f0: 1200, f1: 300, q: 1.5, gain: 0.18, attack: 0.1, pan, type: 'lowpass' });
    for (let i = 0; i < 8; i++) {
      const f = 400 + Math.random() * 700;
      tone(f, 0.3 + i * 0.12, 0.12, { type: 'sine', gain: 0.07, slideTo: f * 1.6, pan });
    }
    tone(70, 0.1, 2.4, { type: 'sine', gain: 0.12, pan, attack: 0.4 });
  },
  /** ضربة منخفضة للافتتاح */
  boom() {
    tone(90, 0, 1.4, { type: 'sine', gain: 0.45, slideTo: 38 });
    noise(0, 0.9, { f0: 300, f1: 60, q: 0.7, gain: 0.18, attack: 0.02, type: 'lowpass' });
  },
  whoosh(pan = 0) {
    noise(0, 0.6, { f0: 300, f1: 2600, q: 0.9, gain: 0.18, pan });
  },
  cheer(pan = 0) {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.35, { type: 'triangle', gain: 0.12, pan }));
    for (let i = 0; i < 8; i++) noise(0.3 + i * 0.05, 0.08, { f0: 2500, f1: 4000, q: 4, gain: 0.04, pan });
  },
};

// ---------------------------------------------------------------------------
// الموسيقى: مقام البيات على «ري» (ري، مي نصف بيمول، فا، صول، لا، سي بيمول، دو)
// نغمة أرضية (ري + لا) وقانون خفيف يتجوّل على درجات المقام بإيقاع الوحدة.
// ---------------------------------------------------------------------------
const BAYATI = [0, 1.5, 3, 5, 7, 8, 10, 12]; // بأنصاف الأصوات (1.5 = ربع تون)
const ROOT = 146.83; // ري
const hz = (semi) => ROOT * Math.pow(2, semi / 12);

export const music = {
  on: false,
  fast: false,
  _timer: 0,
  _step: 0,
  _deg: 4,
  start() {
    ensure();
    if (!ctx || this.on) return;
    this.on = true;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.11, ctx.currentTime, 1.2);
    this._drone();
    this._tick();
  },
  stop() {
    this.on = false;
    clearTimeout(this._timer);
    if (ctx && musicBus) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  },
  speedUp() {
    this.fast = true;
  },
  reset() {
    this.fast = false;
  },
  _drone() {
    if (!this.on) return;
    setTimeout(() => this._drone(), 8000);
    if (!live()) return;
    // نغمة أرضية تتنفّس ببطء (تتجدد كل ٨ ثوانٍ)
    for (const [f, g] of [[hz(-12), 0.22], [hz(-5), 0.12]]) {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const gg = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      o.type = 'sawtooth';
      o.frequency.value = f;
      gg.gain.setValueAtTime(0.0001, t0);
      gg.gain.exponentialRampToValueAtTime(g, t0 + 2);
      gg.gain.setValueAtTime(g, t0 + 6.5);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 8.4);
      o.connect(lp).connect(gg).connect(musicBus);
      o.start(t0);
      o.stop(t0 + 8.5);
    }
  },
  _tick() {
    if (!this.on) return;
    const beat = this.fast ? 0.27 : 0.36;
    // إيقاع الوحدة: دُم … تك تك دُم تك
    const pattern = [1, 0, 0, 1, 1, 0, 1, 0];
    const st = this._step % 8;
    if (live()) {
      if (pattern[st]) {
        const low = st === 0 || st === 4;
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(low ? 110 : 330, t0);
        o.frequency.exponentialRampToValueAtTime(low ? 55 : 220, t0 + 0.12);
        g.gain.setValueAtTime(low ? 0.5 : 0.18, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (low ? 0.25 : 0.08));
        o.connect(g).connect(musicBus);
        o.start(t0);
        o.stop(t0 + 0.3);
      }
      // لحن متجوّل: خطوة صغيرة على المقام كل نبضتين
      if (st % 2 === 0 && Math.random() < 0.8) {
        this._deg = Math.max(0, Math.min(BAYATI.length - 1, this._deg + [-1, -1, 1, 1, 0, 2, -2][Math.floor(Math.random() * 7)]));
        const f = hz(BAYATI[this._deg] + 12);
        const t0 = ctx.currentTime;
        // قانون: نقرة حادة تخفت بسرعة (موجة مثلثية + توافقي)
        for (const [m, gn] of [[1, 0.16], [2, 0.05]]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f * m;
          g.gain.setValueAtTime(gn, t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
          o.connect(g).connect(musicBus);
          o.start(t0);
          o.stop(t0 + 1);
        }
      }
    }
    this._step++;
    this._timer = setTimeout(() => this._tick(), beat * 1000);
  },
};
