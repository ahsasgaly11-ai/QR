// هندسة القرص وتحويلاته (الخيط الرئيسي). أنصاف الأقطار تُحدَّث من عامل الرؤية بعد المعايرة الذاتية.
export const Z_OUT = [30, 10, 40, 10, 50, 10, 60, 10, 70, 10, 20, 10];
export const Z_IN = [150, 100, 160, 110, 170, 120, 180, 130, 190, 80, 140, 90];
export const ANG0 = -1.0;
export const rings = { bull: 0.165, inner: 0.615, rim: 0.965 };
export const CLS_OUT = (i) => [2, 3, 2, 1][i % 4];
export const CLS_IN = (i) => [3, 1, 3, 2][i % 4];
export const COL = { 1: '#e8452c', 2: '#f6cf1c', 3: '#17804f', o: '#f0703f' };
export const TIERS = [
  { key: 'easy', name: 'سهل', c: '#39d98a' },
  { key: 'mid', name: 'متوسط', c: '#f6cf1c' },
  { key: 'hard', name: 'صعب', c: '#ff7a3d' },
  { key: 'legend', name: 'أسطوري', c: '#ff3d6e' },
];
export const tierOf = (p) => (p >= 200 ? 3 : p >= 80 ? 2 : p >= 20 ? 1 : 0);

export function zoneAt(u, v) {
  const r = Math.hypot(u, v);
  if (r > 1.04) return null;
  if (r < rings.bull) return { id: 'b', pts: 200, cls: 1, ring: 'b', idx: 0 };
  let a = (Math.atan2(u, -v) * 180) / Math.PI - ANG0;
  a = ((a % 360) + 360) % 360;
  const i = Math.floor(a / 30) % 12;
  return r < rings.inner
    ? { id: 'i' + i, pts: Z_IN[i], cls: CLS_IN(i), ring: 'i', idx: i }
    : { id: 'o' + i, pts: Z_OUT[i], cls: CLS_OUT(i), ring: 'o', idx: i };
}
export const zoneColor = (z) => (z.ring === 'o' && z.cls === 1 ? COL.o : COL[z.cls]);
export const allZoneIds = () => ['b', ...Array.from({ length: 12 }, (_, i) => 'i' + i), ...Array.from({ length: 12 }, (_, i) => 'o' + i)];
export const zoneById = (id) => (id === 'b' ? { id, pts: 200, ring: 'b', idx: 0 } : { id, pts: (id[0] === 'i' ? Z_IN : Z_OUT)[+id.slice(1)], ring: id[0], idx: +id.slice(1) });

export function applyH(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}
export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

// يرسم القرص في إحداثيات الوحدة (نصف القطر = ١) على سياق Canvas 2D
export function drawBoard(c) {
  c.save(); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill();
  const seg = (r0, r1, i, col) => { const a0 = ((i * 30 + ANG0 - 90) * Math.PI) / 180, a1 = a0 + Math.PI / 6; c.fillStyle = col; c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); c.fill(); };
  for (let i = 0; i < 12; i++) { seg(0.615, 0.965, i, CLS_OUT(i) === 1 ? COL.o : COL[CLS_OUT(i)]); seg(0.165, 0.615, i, COL[CLS_IN(i)]); }
  c.strokeStyle = '#0a0a0a'; c.lineWidth = 0.028;
  for (let i = 0; i < 12; i++) { const a = ((i * 30 + ANG0 - 90) * Math.PI) / 180; c.beginPath(); c.moveTo(Math.cos(a) * 0.165, Math.sin(a) * 0.165); c.lineTo(Math.cos(a), Math.sin(a)); c.stroke(); }
  c.beginPath(); c.arc(0, 0, 0.615, 0, 7); c.stroke();
  c.fillStyle = COL[1]; c.beginPath(); c.arc(0, 0, 0.165, 0, 7); c.fill(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const lab = (r, i, t, cl, s) => { const a = ((i * 30 + 15 + ANG0 - 90) * Math.PI) / 180; c.fillStyle = cl === 2 ? '#d8341f' : '#fff'; c.font = 'italic 800 ' + s + 'px Georgia,serif'; c.fillText(t, Math.cos(a) * r, Math.sin(a) * r); };
  for (let i = 0; i < 12; i++) { lab(0.8, i, Z_OUT[i], CLS_OUT(i), 0.17); lab(0.42, i, Z_IN[i], CLS_IN(i), 0.105); }
  c.fillStyle = '#fff'; c.font = 'italic 800 0.12px Georgia,serif'; c.fillText('200', 0, 0.005); c.restore();
}
