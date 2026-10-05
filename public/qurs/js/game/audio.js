// الصوت: يعمل على iPad/iPhone بعد أول لمسة، حتى مع مفتاح الصامت (ملف صامت متكرر يفتح قناة الصوت).
let AC = null, master = null, muted = false, buf = {}, silentEl = null;

export function unlock() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(AC.destination);
    for (const [k, f] of [['ok', 'sfx/correct.mp3'], ['bad', 'sfx/wrong.mp3']]) fetch(f).then((r) => r.arrayBuffer()).then((b) => AC.decodeAudioData(b, (d) => (buf[k] = d), () => {})).catch(() => {});
    try {
      const n = 4410, ab = new ArrayBuffer(44 + n), dv = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 44100, true); dv.setUint32(28, 44100, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
      new Uint8Array(ab, 44).fill(128); silentEl = new Audio(URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }))); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.play().catch(() => {});
    } catch {}
  }
  if (AC.state !== 'running') AC.resume().catch(() => {});
}
['pointerdown', 'touchstart', 'click', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export const isMuted = () => muted;

function tone(f, t, d, type, g, f2) { if (!AC) return; const o = AC.createOscillator(), ga = AC.createGain(), t0 = AC.currentTime + t; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d); ga.gain.setValueAtTime(0.0001, t0); ga.gain.exponentialRampToValueAtTime(g || 0.3, t0 + 0.012); ga.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(ga); ga.connect(master); o.start(t0); o.stop(t0 + d + 0.05); }
export function boom(t, d, cut, g) { if (!AC) return; const n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), ga = AC.createGain(), t0 = AC.currentTime + t; s.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(Math.max(60, cut / 8), t0 + d);
  ga.gain.value = g; s.connect(f); f.connect(ga); ga.connect(master); s.start(t0); }
function crackle(t, dur, n, g) { if (!AC) return; for (let i = 0; i < n; i++) { const t0 = AC.currentTime + t + Math.random() * dur, len = 0.012 + Math.random() * 0.03, b = AC.createBuffer(1, Math.floor(AC.sampleRate * len), AC.sampleRate), ch = b.getChannelData(0); for (let k = 0; k < ch.length; k++) ch[k] = (Math.random() * 2 - 1) * (1 - k / ch.length);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), ga = AC.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = 1800 + Math.random() * 3000; ga.gain.value = g * (0.4 + Math.random() * 0.6); s.connect(f); f.connect(ga); ga.connect(master); s.start(t0); } }
function whoosh(t, d, g) { if (!AC) return; const n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(i / n, 1.5);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), ga = AC.createGain(), t0 = AC.currentTime + t; s.buffer = b; f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(250, t0); f.frequency.exponentialRampToValueAtTime(3200, t0 + d); ga.gain.value = g; s.connect(f); f.connect(ga); ga.connect(master); s.start(t0); }
function playBuf(k) { if (AC && buf[k]) { const s = AC.createBufferSource(); s.buffer = buf[k]; s.connect(master); s.start(); return true; } return false; }

export const SND = {
  tick() { tone(880, 0, 0.06, 'square', 0.08); },
  lock() { tone(523, 0, 0.12, 'triangle', 0.25); tone(784, 0.1, 0.12, 'triangle', 0.25); tone(1047, 0.2, 0.25, 'triangle', 0.3); },
  hit(t) {
    if (t === 0) { boom(0, 0.22, 1700, 0.55); tone(120, 0, 0.14, 'sine', 0.35, 60); crackle(0.02, 0.25, 8, 0.25); }
    else if (t === 1) { boom(0, 0.45, 1300, 0.8); tone(95, 0, 0.3, 'sine', 0.6, 45); crackle(0.03, 0.6, 18, 0.3); }
    else if (t === 2) { boom(0, 0.9, 900, 1.1); boom(0.02, 0.5, 3200, 0.45); tone(80, 0, 0.6, 'sine', 0.85, 34); crackle(0.05, 1.3, 40, 0.32); [0.24, 0.41, 0.58, 0.75].forEach((d) => boom(d, 0.3, 1500, 0.4)); }
    else { whoosh(0, 0.36, 0.5); tone(160, 0, 0.36, 'sawtooth', 0.12, 900);
      boom(0.36, 1.8, 650, 1.3); boom(0.37, 0.7, 3600, 0.55); tone(62, 0.36, 1.4, 'sine', 1.0, 26); tone(45, 0.4, 1.8, 'sine', 0.6, 22); crackle(0.45, 2.8, 110, 0.34);
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 1.1 + i * 0.12, 0.4, 'triangle', 0.14)); [262, 330, 392, 523].forEach((f) => tone(f, 1.9, 1.3, 'sawtooth', 0.07)); }
  },
  firework() { boom(0, 0.4, 2400, 0.4); crackle(0.05, 0.45, 14, 0.22); },
  miss() { tone(220, 0, 0.3, 'sawtooth', 0.15, 90); },
  ok() { if (!playBuf('ok')) [659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.3)); },
  bad() { if (!playBuf('bad')) { tone(200, 0, 0.25, 'sawtooth', 0.2, 140); tone(140, 0.2, 0.4, 'sawtooth', 0.2, 90); } },
  turn() { tone(440, 0, 0.12, 'triangle', 0.25); tone(660, 0.12, 0.2, 'triangle', 0.25); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.12, 0.4, 'triangle', 0.28)); boom(0.7, 0.8, 2500, 0.5); },
};
