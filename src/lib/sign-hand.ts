// ---------------------------------------------------------------------------
// محلّل الأصابع التشريحي: يحوّل معالم يد المؤدّي (21 نقطة) إلى زوايا مفاصل
// ضمن الحدود الطبيعية، ثم يعيد بناء يد الشخصية بهندستها هي.
//
// لماذا؟ توجيه كل سلامية نحو معلمها مباشرةً ينقل ضجيج الكشف كما هو: أصابع تنثني
// جانبيًّا أو للخلف أو تتمطّط. اليد الحقيقية ليست كذلك:
//   • المفصل السنعي (MCP): ثني نحو الراحة + تبعيد جانبي محدود.
//   • المفصلان بين السلاميات (PIP/DIP): مفصلا ثني فقط، في مستوى الإصبع،
//     لا ينثنيان جانبيًّا ولا للخلف إلا قليلًا.
//   • الإبهام: حرّ أكثر عند قاعدته، وبزوايا محدودة في مفصليه الآخرين.
// فنقيس الزوايا في إطار الكفّ، ونقيّدها، وننعّمها زمنيًّا، ثم نبني اليد من
// أطوال عظام الشخصية ومواضع مفاصل كفّها في وضع الراحة — فلا تشوّه في الكفّ.
//
// الإطار المحلي للكفّ: y على امتداد الكفّ (الرسغ ← قاعدة الوسطى)، z نحو باطن
// الكفّ، x = y × z. يُحسب بالطريقة نفسها ليدي المؤدّي والشخصية فتتطابق الزوايا.
// ---------------------------------------------------------------------------
import type { V3 } from './sign-motion';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth01 = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export type Side = 'L' | 'R';

/** إطار الكفّ: [x, y, z] أعمدة متعامدة (z نحو الباطن). */
export interface PalmFrame {
  x: V3;
  y: V3;
  z: V3;
}

/** زوايا اليد: لكل إصبع (سبّابة، وسطى، بنصر، خنصر) [ثني MCP، تبعيد، PIP، DIP]، والإبهام اتجاهاته الثلاثة محلّيًّا. */
export interface HandAngles {
  fingers: [number, number, number, number][];
  thumb: [V3, V3, V3];
}

const FINGERS = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const THUMB = [1, 2, 3, 4];

/** حدود المفاصل (راديان): [MCP ثني، تبعيد، PIP، DIP] */
const LIMITS = {
  mcp: [-0.3, 1.65] as const,
  abd: [-0.32, 0.32] as const,
  pip: [-0.08, 1.9] as const,
  dip: [-0.08, 1.4] as const,
  thumbMp: 1.05,
  thumbIp: 1.45,
};

export function palmFrame(h: V3[], side: Side): PalmFrame {
  const y = norm(sub(h[9], h[0]));
  const across = sub(h[5], h[17]); // من الخنصر إلى السبّابة
  let z = norm(side === 'R' ? cross(across, y) : cross(y, across));
  z = norm(sub(z, mul(y, dot(z, y))));
  const x = cross(y, z);
  return { x, y, z };
}

const toLocal = (f: PalmFrame, v: V3): V3 => [dot(v, f.x), dot(v, f.y), dot(v, f.z)];
const toWorld = (f: PalmFrame, v: V3): V3 => add(add(mul(f.x, v[0]), mul(f.y, v[1])), mul(f.z, v[2]));

/** يد في إطارها المحلي (الرسغ عند الأصل). */
export function localHand(h: V3[], side: Side): V3[] {
  const f = palmFrame(h, side);
  return h.map((p) => toLocal(f, sub(p, h[0])));
}

/** زاوية الثني الموقّعة من الاتجاه a إلى b نحو الباطن (z). */
function signedBend(a: V3, b: V3): number {
  let perp = sub([0, 0, 1], mul(a, a[2]));
  if (len(perp) < 1e-4) perp = cross(a, [1, 0, 0]);
  perp = norm(perp);
  return Math.atan2(dot(b, perp), dot(b, a));
}

/** يقيس زوايا يد المؤدّي نسبةً إلى يد الشخصية في الراحة (كلتاهما محلّيّتان). */
export function measureHand(data: V3[], restLocal: V3[]): HandAngles {
  const fingers = FINGERS.map(([m, p, d, t]) => {
    const r1 = norm(sub(restLocal[p], restLocal[m]));
    const d1 = norm(sub(data[p], data[m]));
    const d2 = norm(sub(data[d], data[p]));
    const d3 = norm(sub(data[t], data[d]));
    const elR = Math.atan2(r1[2], Math.hypot(r1[0], r1[1]));
    const azR = Math.atan2(r1[0], r1[1]);
    // التبعيد من إسقاط السلامية الأولى على مستوى الكفّ؛ لا يُقاس حين ينطوي الإصبع
    const proj = Math.hypot(d1[0], d1[1]);
    let abd = Math.atan2(d1[0], d1[1]) - azR;
    abd = Math.atan2(Math.sin(abd), Math.cos(abd)) * clamp((proj - 0.35) / 0.4, 0, 1);
    abd = clamp(abd, ...LIMITS.abd);
    // مستوى الإصبع: (h أفقيًّا على امتداده، z نحو الباطن) — زوايا متّصلة حتى 180°
    const h: V3 = [Math.sin(azR + abd), Math.cos(azR + abd), 0];
    const phi = (v: V3) => Math.atan2(v[2], dot(v, h));
    const p1 = phi(d1),
      p2 = phi(d2),
      p3 = phi(d3);
    const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
    const flex = clamp(p1 - elR, ...LIMITS.mcp);
    const pip = clamp(wrap(p2 - p1), ...LIMITS.pip);
    let dip = clamp(wrap(p3 - p2), ...LIMITS.dip);
    // DIP قليل الثقة في الكشف ومقرون تشريحيًّا بـPIP (≈ ثلثاه)
    dip = 0.5 * dip + 0.5 * clamp(pip * 0.68, ...LIMITS.dip);
    // وضوح شكل اليد: الكشف يُقلّل انثناء الإصبع المطويّ (مخفيّ خلف الكفّ) ويُضيف
    // ارتعاشًا للمفرود. أشكال اليد في لغة الإشارة فئات واضحة، فنحسم الطرفين:
    // إصبع منطوٍ في معظمه ← مطويّ تمامًا، ومفرود تقريبًا ← مفرود تمامًا.
    const curl = flex + pip + dip;
    const closed = smooth01(1.65, 2.55, curl);
    const open = 1 - smooth01(0.35, 0.8, curl);
    let f: [number, number, number, number] = [flex, abd, pip, dip];
    f = f.map((v, i) => v + ([1.45, f[1] * 0.3, 1.7, 1.0][i] - v) * closed) as typeof f;
    f = f.map((v, i) => v + ([0, f[1], 0, 0][i] - v) * open) as typeof f;
    return f;
  });
  const [a, b, c, e] = THUMB;
  const t1 = norm(sub(data[b], data[a]));
  let t2 = norm(sub(data[c], data[b]));
  let t3 = norm(sub(data[e], data[c]));
  t2 = limitBend(t1, t2, LIMITS.thumbMp);
  t3 = limitBend(t2, t3, LIMITS.thumbIp);
  return { fingers, thumb: [t1, t2, t3] };
}

/** يحدّ زاوية الانحناء بين اتجاهين متتاليين، في مستويهما نفسه. */
function limitBend(a: V3, b: V3, maxAng: number): V3 {
  const ang = Math.acos(clamp(dot(a, b), -1, 1));
  if (ang <= maxAng) return b;
  const perp = sub(b, mul(a, dot(a, b)));
  if (len(perp) < 1e-6) return a;
  const p = norm(perp);
  return norm(add(mul(a, Math.cos(maxAng)), mul(p, Math.sin(maxAng))));
}

/** يبني يد الشخصية (محلّيًّا) من الزوايا وهندسة راحتها. */
export function buildHand(ang: HandAngles, restLocal: V3[]): V3[] {
  const out: V3[] = restLocal.map((p) => [...p] as V3);
  FINGERS.forEach(([m, p, d, t], fi) => {
    const [flex, abd, pip, dip] = ang.fingers[fi];
    const r1 = norm(sub(restLocal[p], restLocal[m]));
    const L1 = len(sub(restLocal[p], restLocal[m]));
    const L2 = len(sub(restLocal[d], restLocal[p]));
    const L3 = len(sub(restLocal[t], restLocal[d]));
    const el = Math.atan2(r1[2], Math.hypot(r1[0], r1[1])) + flex;
    const az = Math.atan2(r1[0], r1[1]) + abd;
    // كل السلاميات في مستوى الإصبع نفسه: (h على امتداده، z نحو الباطن)
    const h: V3 = [Math.sin(az), Math.cos(az), 0];
    const dirAt = (a: number): V3 => add(mul(h, Math.cos(a)), [0, 0, Math.sin(a)]);
    const d1 = dirAt(el);
    const d2 = dirAt(el + pip);
    const d3 = dirAt(el + pip + dip);
    out[p] = add(out[m], mul(d1, L1));
    out[d] = add(out[p], mul(d2, L2));
    out[t] = add(out[d], mul(d3, L3));
  });
  const [a, b, c, e] = THUMB;
  const T1 = len(sub(restLocal[b], restLocal[a]));
  const T2 = len(sub(restLocal[c], restLocal[b]));
  const T3 = len(sub(restLocal[e], restLocal[c]));
  out[b] = add(out[a], mul(ang.thumb[0], T1));
  out[c] = add(out[b], mul(ang.thumb[1], T2));
  out[e] = add(out[c], mul(ang.thumb[2], T3));
  return out;
}

/** اليد في الإطار العالمي: المحلية × إطار الكفّ، منقولة إلى الرسغ (هنا الأصل). */
export function handToWorld(local: V3[], f: PalmFrame): V3[] {
  return local.map((p) => toWorld(f, p));
}

/** زوايا يد مرتخية طبيعية (السكون وغياب الكشف): الأصابع منثنية قليلًا، الخنصر أكثر. */
export function relaxedAngles(restLocal: V3[]): HandAngles {
  const fingers = [0, 1, 2, 3].map(
    (i) => [0.18 + i * 0.07, 0, 0.32 + i * 0.08, 0.22 + i * 0.05] as [number, number, number, number]
  );
  const [a, b, c, e] = THUMB;
  const t1 = norm(sub(restLocal[b], restLocal[a]));
  const t2 = limitBend(t1, norm(add(sub(restLocal[c], restLocal[b]), [0, 0, 0.004])), 0.25);
  const t3 = limitBend(t2, norm(add(sub(restLocal[e], restLocal[c]), [0, 0, 0.006])), 0.3);
  return { fingers, thumb: [t1, t2, t3] };
}

/** مزج زوايا (للتنعيم والانتقال). */
export function mixAngles(a: HandAngles, b: HandAngles, t: number): HandAngles {
  return {
    fingers: a.fingers.map((f, i) => f.map((v, j) => v + (b.fingers[i][j] - v) * t)) as HandAngles['fingers'],
    thumb: a.thumb.map((v, i) => norm(add(mul(v, 1 - t), mul(b.thumb[i], t)))) as HandAngles['thumb'],
  };
}

/** تنعيم زمني لسلسلة زوايا (نواة 1-2-1). */
export function smoothAngles(xs: HandAngles[], passes = 2): HandAngles[] {
  let cur = xs;
  for (let k = 0; k < passes; k++) {
    cur = cur.map((h, i) => {
      const a = cur[Math.max(0, i - 1)];
      const b = cur[Math.min(cur.length - 1, i + 1)];
      return mixAngles(mixAngles(a, b, 0.5), h, 0.5);
    });
  }
  return cur;
}

/** تنعيم زمني لإطارات الكفّ مع إعادة التعامد. */
export function smoothFrames(xs: PalmFrame[], passes = 2): PalmFrame[] {
  let cur = xs;
  for (let k = 0; k < passes; k++) {
    cur = cur.map((f, i) => {
      const a = cur[Math.max(0, i - 1)];
      const b = cur[Math.min(cur.length - 1, i + 1)];
      const y = norm(add(add(a.y, b.y), mul(f.y, 2)));
      let z = norm(add(add(a.z, b.z), mul(f.z, 2)));
      z = norm(sub(z, mul(y, dot(z, y))));
      return { x: cross(y, z), y, z };
    });
  }
  return cur;
}

/** إطار كفّ من اتجاه الأصابع واتجاه الباطن المطلوبين. */
export function frameFrom(up: V3, palm: V3): PalmFrame {
  const y = norm(up);
  const z = norm(sub(palm, mul(y, dot(palm, y))));
  return { x: cross(y, z), y, z };
}
