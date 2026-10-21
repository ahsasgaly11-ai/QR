// ---------------------------------------------------------------------------
// الأصوات: مؤثرات مُركّبة بـ Web Audio (لا ملفات)، ونطق اسم السن بالعربية.
// على iOS لا يعمل الصوت إلا بعد لمسة من المستخدم، فيُستدعى unlock() من أول زر.
// الصوت ينتقل مع انعكاس الشاشة إلى Apple TV ثم إلى سمّاعة جهاز العرض.
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let enabled = true;
let speechEnabled = true;
let arVoice = null;

export function setSound(on) {
  enabled = !!on;
}
export function setSpeech(on) {
  speechEnabled = !!on;
}

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
  pickVoice();
}

function tone(freq, start, dur, { type = 'sine', gain = 0.6, slideTo = null } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  pick() {
    tone(520, 0, 0.12, { type: 'triangle', gain: 0.4, slideTo: 780 });
  },
  hover() {
    tone(900, 0, 0.05, { type: 'sine', gain: 0.12 });
  },
  correct() {
    tone(660, 0, 0.16, { type: 'triangle', gain: 0.5 });
    tone(990, 0.11, 0.24, { type: 'triangle', gain: 0.45 });
  },
  wrong() {
    tone(220, 0, 0.22, { type: 'sawtooth', gain: 0.22, slideTo: 150 });
  },
  back() {
    tone(500, 0, 0.14, { type: 'sine', gain: 0.25, slideTo: 320 });
  },
  click() {
    tone(740, 0, 0.07, { type: 'square', gain: 0.12 });
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'triangle', gain: 0.4 }));
  },
};

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const choose = () => {
    const voices = window.speechSynthesis.getVoices();
    arVoice = voices.find((v) => /^ar(-|_|$)/i.test(v.lang)) || null;
  };
  choose();
  if (!arVoice) window.speechSynthesis.addEventListener?.('voiceschanged', choose, { once: true });
}

/** ينطق نصًا عربيًا قصيرًا (اسم السن). يتجاهل الطلب إن لم يوجد صوت عربي. */
export function say(text) {
  if (!speechEnabled || !('speechSynthesis' in window) || !arVoice) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = arVoice;
    u.lang = arVoice.lang;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* النطق ميزة إضافية؛ فشلها لا يوقف اللعبة */
  }
}
