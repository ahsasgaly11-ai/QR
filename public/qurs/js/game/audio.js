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
function playBuf(k) { if (AC && buf[k]) { const s = AC.createBufferSource(); s.buffer = buf[k]; s.connect(master); s.start(); return true; } return false; }

export const SND = {
  tick() { tone(880, 0, 0.06, 'square', 0.08); },
  lock() { tone(523, 0, 0.12, 'triangle', 0.25); tone(784, 0.1, 0.12, 'triangle', 0.25); tone(1047, 0.2, 0.25, 'triangle', 0.3); },
  hit(t) {
    if (t === 0) { boom(0, 0.18, 1800, 0.5); tone(520, 0, 0.16, 'triangle', 0.3, 780); }
    else if (t === 1) { boom(0, 0.3, 1400, 0.7); [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.2, 'triangle', 0.28)); }
    else if (t === 2) { boom(0, 0.7, 900, 1); tone(90, 0, 0.5, 'sine', 0.7, 40); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08 + i * 0.06, 0.28, 'sawtooth', 0.14)); }
    else { boom(0, 1.4, 700, 1.2); tone(70, 0, 1.1, 'sine', 0.9, 30); boom(0.5, 0.5, 2500, 0.5); boom(0.9, 0.5, 3000, 0.5); boom(1.4, 0.6, 2600, 0.5);
      [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.25 + i * 0.13, 0.3, 'square', 0.12)); [262, 330, 392].forEach((f) => tone(f, 1.35, 1.2, 'sawtooth', 0.1)); }
  },
  firework() { boom(0, 0.35, 2600, 0.35); },
  miss() { tone(220, 0, 0.3, 'sawtooth', 0.15, 90); },
  ok() { if (!playBuf('ok')) [659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.3)); },
  bad() { if (!playBuf('bad')) { tone(200, 0, 0.25, 'sawtooth', 0.2, 140); tone(140, 0.2, 0.4, 'sawtooth', 0.2, 90); } },
  turn() { tone(440, 0, 0.12, 'triangle', 0.25); tone(660, 0.12, 0.2, 'triangle', 0.25); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.12, 0.4, 'triangle', 0.28)); boom(0.7, 0.8, 2500, 0.5); },
};
