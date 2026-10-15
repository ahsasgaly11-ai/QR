// ---------------------------------------------------------------------------
// إعادة الاستهداف (retargeting): يحوّل ملف الحركة المستخلص من مقطع مؤدٍّ بشري
// (public/sign/poses/*.json) إلى حركة الشخصية ثلاثية الأبعاد بأبعادها هي.
//
// المبادئ:
// - موضع المعصم يُنقل نسبةً إلى منتصف الكتفين وبمقياس عرض الكتفين، فتبقى
//   إشارات التلامس (الذقن، الصدر، الجبهة) في مكانها على جسم الشخصية مهما
//   اختلف طول المؤدّي أو بُعده عن الكاميرا. ثم يُحلّ المرفق بالحركية العكسية
//   (IK) بطول ذراعَي الشخصية، مع توجيه المرفق من مرفق المؤدّي.
// - اليد: اتجاهات عظام الأصابع من البيانات، بأطوال ثابتة لكل عظمة (وسيط المقطع)
//   فلا «تمتطّ» الأصابع مع ضجيج الكشف.
// - الرأس والجذع من معالم الوجه والكتفين بتخميد، وتعابير الوجه (العلامات غير
//   اليدوية) بعد طرح خطّ الأساس الخاصّ بالمؤدّي.
// - يُقصّ السكون في أوّل المقطع وآخره (اليدان منسدلتان) لتتّصل الإشارات
//   ببعضها اتّصالًا طبيعيًّا بدل العودة إلى وضع الراحة بين كل إشارتين.
//
// وحدة واحدة بلا تبعيات (تُختبر وتُشغَّل خارج WebGL).
// ---------------------------------------------------------------------------

import {
  buildHand,
  frameFrom,
  handToWorld,
  localHand,
  measureHand,
  palmFrame,
  relaxedAngles,
  smoothAngles,
  smoothFrames,
  type HandAngles,
  type PalmFrame,
  type Side,
} from './sign-hand';

export type V3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

/** ملف الحركة: الإصدار 1 (x,y) والإصدار 2 (x,y,z + الوجه). */
export interface PoseFileAny {
  v: number;
  fps: number;
  ar?: number;
  src?: string;
  fk?: string[];
  frames: {
    p: number[][] | null;
    l: number[][] | null;
    r: number[][] | null;
    h?: number[][] | null;
    f?: number[] | null;
    /** اليدان بالمتر (الإصدار 3) */
    L?: number[][] | null;
    R?: number[][] | null;
  }[];
}

// تعابير الوجه التي تؤدّيها الشخصية (بالترتيب)
export const FACE = [
  'browInnerUp',
  'browDownLeft',
  'browDownRight',
  'browOuterUpLeft',
  'browOuterUpRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeWideLeft',
  'eyeWideRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'jawOpen',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthPucker',
  'mouthFunnel',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthPressLeft',
  'mouthPressRight',
  'cheekPuff',
] as const;
export type FaceKey = (typeof FACE)[number];
export const FACE_INDEX = Object.fromEntries(FACE.map((k, i) => [k, i])) as Record<FaceKey, number>;

// ---- أبعاد الشخصية (بالمتر) — الافتراضية؛ المشهد ثلاثي الأبعاد يمرّر أبعاد الشخصية المحمَّلة ----
export interface RigDims {
  shoulderY: number;
  shoulderX: number;
  upperArm: number;
  forearm: number;
  hand: number;
  headCenter: V3;
  headR: V3;
  torsoR: [number, number];
  hipY: number;
  /** يد الشخصية في الراحة بإطار كفّها المحلي (sign-hand.ts) */
  handLocal?: { L: V3[]; R: V3[] };
  /** موضع الفم (مرجع إشارات التلامس مع الوجه) */
  mouth?: V3;
}
export const DEFAULT_RIG: RigDims = {
  shoulderY: 1.45,
  shoulderX: 0.19, // نصف عرض الكتفين
  upperArm: 0.29,
  forearm: 0.26,
  hand: 0.1, // من المعصم إلى مفصل الإصبع الأوسط (أكبر قليلًا للوضوح)
  headCenter: [0, 1.672, 0.005] as V3,
  headR: [0.092 * 1.18, 0.118 * 1.18, 0.104 * 1.18] as V3, // بمقياس الرأس في المشهد
  torsoR: [0.235, 0.145] as [number, number], // نصفا قطر مقطع الجذع (x, z)
  hipY: 0.95,
};

/** إطار حالة الشخصية — كل ما يلزم لرسمها، وقابل للمزج خطّيًّا. */
export interface AvatarState {
  /** هدف المعصم الأيسر/الأيمن (المؤدّي) وموجّه المرفق */
  lw: V3;
  lp: V3;
  rw: V3;
  rp: V3;
  /** مفاصل اليد الـ21 نسبةً إلى المعصم */
  lh: V3[];
  rh: V3[];
  head: Quat;
  /** ميل الجذع (roll) ودورانه (yaw) بالراديان */
  torso: [number, number];
  face: number[];
}

export interface Motion {
  fps: number;
  frames: AvatarState[];
  /** مدى الأداء الفعلي بعد قصّ السكون [أوّل، آخر] */
  start: number;
  end: number;
}

// ---- عمليات متّجهات صغيرة --------------------------------------------------
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

export function quatFromEuler(yaw: number, pitch: number, roll: number): Quat {
  // ترتيب YXZ: دوران حول y ثم x ثم z
  const cy = Math.cos(yaw / 2),
    sy = Math.sin(yaw / 2);
  const cp = Math.cos(pitch / 2),
    sp = Math.sin(pitch / 2);
  const cr = Math.cos(roll / 2),
    sr = Math.sin(roll / 2);
  return [
    cy * sp * cr + sy * cp * sr,
    sy * cp * cr - cy * sp * sr,
    cy * cp * sr - sy * sp * cr,
    cy * cp * cr + sy * sp * sr,
  ];
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb: Quat = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  d = Math.abs(d);
  if (d > 0.9995) {
    const r: Quat = [
      a[0] + (bb[0] - a[0]) * t,
      a[1] + (bb[1] - a[1]) * t,
      a[2] + (bb[2] - a[2]) * t,
      a[3] + (bb[3] - a[3]) * t,
    ];
    const l = Math.hypot(...r) || 1;
    return [r[0] / l, r[1] / l, r[2] / l, r[3] / l];
  }
  const th = Math.acos(d);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [
    a[0] * wa + bb[0] * wb,
    a[1] * wa + bb[1] * wb,
    a[2] * wa + bb[2] * wb,
    a[3] * wa + bb[3] * wb,
  ];
}

export function mixState(a: AvatarState, b: AvatarState, t: number): AvatarState {
  return {
    lw: lerp(a.lw, b.lw, t),
    lp: lerp(a.lp, b.lp, t),
    rw: lerp(a.rw, b.rw, t),
    rp: lerp(a.rp, b.rp, t),
    lh: a.lh.map((p, i) => lerp(p, b.lh[i], t)),
    rh: a.rh.map((p, i) => lerp(p, b.rh[i], t)),
    head: slerp(a.head, b.head, t),
    torso: [a.torso[0] + (b.torso[0] - a.torso[0]) * t, a.torso[1] + (b.torso[1] - a.torso[1]) * t],
    face: a.face.map((v, i) => v + (b.face[i] - v) * t),
  };
}

// ---- اليد ------------------------------------------------------------------
// عظام اليد (MediaPipe Hands): أبٌ ← ابن
export const HAND_BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

// قالب يد يمنى مرتخية في إطارها المحلّي: x = جهة الإبهام، y = الأصابع، z = باطن الكفّ
const HAND_TEMPLATE: V3[] = [
  [0, 0, 0],
  [0.024, 0.022, 0.012], [0.038, 0.042, 0.024], [0.046, 0.062, 0.03], [0.05, 0.079, 0.034],
  [0.025, 0.085, 0.004], [0.027, 0.119, 0.016], [0.026, 0.139, 0.028], [0.025, 0.155, 0.04],
  [0.005, 0.088, 0.003], [0.005, 0.126, 0.017], [0.005, 0.149, 0.03], [0.005, 0.167, 0.043],
  [-0.014, 0.083, 0.003], [-0.015, 0.116, 0.017], [-0.016, 0.137, 0.03], [-0.016, 0.153, 0.042],
  [-0.031, 0.075, 0.003], [-0.034, 0.099, 0.014], [-0.035, 0.114, 0.024], [-0.036, 0.127, 0.033],
];

/** يد مرتخية موجّهة: up = اتجاه الأصابع، thumb = جهة الإبهام، palm = اتجاه الباطن. */
export function orientedHand(up: V3, thumb: V3, palm: V3, handLen = DEFAULT_RIG.hand): V3[] {
  const k = handLen / 0.088;
  return HAND_TEMPLATE.map(([x, y, z]) => mul(add(add(mul(thumb, x), mul(up, y)), mul(palm, z)), k));
}

/** يد الراحة المحلية: من أبعاد الشخصية إن توفّرت، وإلا القالب (يمنى؛ اليسرى مرآتها). */
export function handLocalOf(RIG: RigDims, side: Side): V3[] {
  if (RIG.handLocal) return RIG.handLocal[side];
  const k = RIG.hand / 0.088;
  return HAND_TEMPLATE.map(([x, y, z]) => [side === 'R' ? x * k : -x * k, y * k, z * k] as V3);
}

/** يد مرتخية موجّهة (الأصابع نحو up، الباطن نحو palm) بهندسة يد الشخصية. */
export function relaxedHand(RIG: RigDims, side: Side, up: V3, palm: V3): V3[] {
  const loc = handLocalOf(RIG, side);
  return handToWorld(buildHand(relaxedAngles(loc), loc), frameFrom(up, palm));
}

/** وضع الراحة: الذراعان منسدلتان قليلًا للأمام، والكفّان نحو الجسم. */
export function restState(RIG: RigDims = DEFAULT_RIG): AvatarState {
  const y = RIG.shoulderY;
  const sx = RIG.shoulderX;
  return {
    lw: [sx + 0.03, y - 0.5, 0.1],
    lp: [sx + 0.32, y - 0.3, -0.2],
    rw: [-sx - 0.03, y - 0.5, 0.1],
    rp: [-sx - 0.32, y - 0.3, -0.2],
    // اليسرى (عند +x): الباطن نحو -x — قالب اليمنى معكوس
    lh: relaxedHand(RIG, 'L', norm([0.05, -1, 0.15]), [-1, 0, 0]),
    rh: relaxedHand(RIG, 'R', norm([-0.05, -1, 0.15]), [1, 0, 0]),
    head: [0, 0, 0, 1],
    torso: [0, 0],
    face: FACE.map(() => 0),
  };
}

// ---- IK بعظمتين ------------------------------------------------------------
/** يحلّ المرفق والمعصم: من الكتف S إلى الهدف T بموجّه P. */
export function solveArm(
  S: V3,
  T: V3,
  P: V3,
  L1 = DEFAULT_RIG.upperArm,
  L2 = DEFAULT_RIG.forearm
): { elbow: V3; wrist: V3; perp: V3; dir: V3 } {
  const v = sub(T, S);
  const dist = clamp(len(v), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const dir = norm(v);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let perp = sub(sub(P, S), mul(dir, dot(sub(P, S), dir)));
  if (len(perp) < 1e-5) perp = sub([0, -1, -0.3], mul(dir, dot([0, -1, -0.3], dir)));
  perp = norm(perp);
  return { elbow: add(add(S, mul(dir, a)), mul(perp, h)), wrist: add(S, mul(dir, dist)), perp, dir };
}

// ---- التحضير -----------------------------------------------------------------
type MaybeV3 = V3 | null;

/** يملأ الفجوات بأقرب قيمة سابقة ثم لاحقة. */
function fill<T>(xs: (T | null)[]): (T | null)[] {
  const out = [...xs];
  let last: T | null = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) last = out[i];
    else out[i] = last;
  }
  last = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (xs[i] != null) last = xs[i];
    else if (out[i] == null) out[i] = last;
  }
  return out;
}

/** تنعيم زمني (نواة 1-2-1 مكرّرة) لسلسلة متّجهات. */
function smoothV(xs: V3[], passes = 2): V3[] {
  let cur = xs;
  for (let k = 0; k < passes; k++) {
    cur = cur.map((p, i) => {
      const a = cur[Math.max(0, i - 1)];
      const b = cur[Math.min(cur.length - 1, i + 1)];
      return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4, (a[2] + 2 * p[2] + b[2]) / 4];
    });
  }
  return cur;
}
function smoothN(xs: number[], passes = 2): number[] {
  let cur = xs;
  for (let k = 0; k < passes; k++) {
    cur = cur.map((p, i) => (cur[Math.max(0, i - 1)] + 2 * p + cur[Math.min(cur.length - 1, i + 1)]) / 4);
  }
  return cur;
}

// مقياس العمق: z في MediaPipe مبالغ فيه وضجيجه عالٍ؛ نخمّده.
const Z_DAMP = 0.4;

// ---- توحيد اليد المسيطرة -------------------------------------------------------
// مصادر القاموس مختلفة: بعض المؤدّين يشيرون باليمنى وبعضهم باليسرى (أو المقطع
// معكوس). الإشارة المعكوسة صحيحة لغويًّا (هكذا يؤدّيها الأعسر)، فنعكس المقاطع
// التي تسيطر فيها اليد الأخرى لتؤدّي الشخصية كل الإشارات باليد نفسها.
// اليد المعتمدة: ما يسمّيه MediaPipe «اليسرى» (pose 15) — الأغلب في القاموس.
const POSE_MIRROR: [number, number][] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
  [17, 18], [19, 20], [21, 22], [23, 24],
];

function dominantIsOther(file: PoseFileAny): boolean {
  let L = 0,
    R = 0;
  for (const f of file.frames) {
    const p = f.p;
    if (!p || !p[16] || !p[15] || !p[11] || !p[12]) continue;
    const w = Math.hypot(p[11][0] - p[12][0], p[11][1] - p[12][1]) || 0.2;
    // كم ترتفع كل يد فوق مستوى الخصر تقريبًا
    L += Math.max(0, p[11][1] + 1.3 * w - p[15][1]);
    R += Math.max(0, p[12][1] + 1.3 * w - p[16][1]);
  }
  return R > L * 1.25 && R > 0.5;
}

export function mirrorPoseFile(file: PoseFileAny): PoseFileAny {
  const mx = (r: number[]) => [1 - r[0], ...r.slice(1)];
  const fk = file.fk || [];
  const swapName = (n: string) =>
    n.endsWith('Left') ? n.slice(0, -4) + 'Right' : n.endsWith('Right') ? n.slice(0, -5) + 'Left' : n;
  const faceMap = fk.map((n) => fk.indexOf(swapName(n)));
  return {
    ...file,
    frames: file.frames.map((f) => {
      let p = f.p ? f.p.map(mx) : null;
      if (p) {
        const q = [...p];
        for (const [a, b] of POSE_MIRROR) {
          if (a < q.length && b < q.length) [q[a], q[b]] = [p[b], p[a]];
        }
        p = q;
      }
      let h = f.h ? f.h.map(mx) : null;
      if (h && h.length >= 3) h = [h[0], h[2], h[1], ...h.slice(3)];
      const nx = (r: number[]) => [-r[0], ...r.slice(1)];
      return {
        p,
        l: f.r ? f.r.map(mx) : null,
        r: f.l ? f.l.map(mx) : null,
        L: f.R ? f.R.map(nx) : null,
        R: f.L ? f.L.map(nx) : null,
        h,
        f: f.f ? faceMap.map((j, i) => f.f![j >= 0 ? j : i] ?? 0) : null,
      };
    }),
  };
}

export function prepareMotion(input: PoseFileAny, RIG: RigDims = DEFAULT_RIG): Motion | null {
  const file = input.frames?.length && dominantIsOther(input) ? mirrorPoseFile(input) : input;
  const frames = file.frames || [];
  if (!frames.length) return null;
  const ar = file.ar || 1;
  // تمريرات التنعيم بحسب معدّل الإطارات: مصادر الصور المتحرّكة (4–6 إطارات/ث) إطارها
  // الواحد ربع ثانية تقريبًا، فتمريرتان تمحوان ذروة الحركة.
  const SP = (file.fps || 15) < 10 ? 1 : 2;
  const hasZ = (row?: number[] | null) => !!row && row.length >= 4;
  // نقطة الجسم i كمتّجه في فضاء الصورة (x بمقياس العرض، y للأعلى، z نحو الكاميرا)
  const P = (f: (typeof frames)[number], i: number): MaybeV3 => {
    const r = f.p?.[i];
    if (!r) return null;
    const z = hasZ(r) ? r[2] : 0;
    return [r[0] * ar, -r[1], -z * ar * Z_DAMP];
  };
  const shoulders = frames.map((f) => {
    const l = P(f, 11),
      r = P(f, 12);
    return l && r ? { l, r } : null;
  });
  const widths = shoulders.filter(Boolean).map((s) => Math.hypot(s!.l[0] - s!.r[0], s!.l[1] - s!.r[1]));
  if (widths.length < frames.length * 0.4) return null;
  // عرض الكتفين الظاهر يتقلّص إذا التفت المؤدّي؛ نأخذ الأعرض (الربيع الأعلى)
  const W = quantile(widths, 0.9);
  if (!(W > 0)) return null;
  const k = (RIG.shoulderX * 2) / W;
  const rest = restState(RIG);
  const n = frames.length;
  const SL: V3 = [RIG.shoulderX, RIG.shoulderY, 0];
  const SR: V3 = [-RIG.shoulderX, RIG.shoulderY, 0];
  const v1 = !frames.some((f) => f.p?.[15] && hasZ(f.p[15]));

  // رفع ثنائي الأبعاد إلى ثلاثي بقيد طول العظمة: x,y من الصورة (موثوقان)،
  // ومقدار العمق من طول العظمة المعروف، وإشارته فقط من z الخاصّ بـMediaPipe
  // (مقداره مبالغ فيه كثيرًا في المقاطع المسطّحة).
  const seg = (a: V3, b: V3, L: number): V3 => {
    let dx = (b[0] - a[0]) * k,
      dy = (b[1] - a[1]) * k;
    const d = Math.hypot(dx, dy);
    if (d >= L) {
      dx *= L / d;
      dy *= L / d;
      return [dx, dy, 0];
    }
    const dz = b[2] - a[2];
    const sign = v1 || Math.abs(dz) < 0.02 ? 1 : Math.sign(dz);
    return [dx, dy, sign * Math.sqrt(L * L - d * d)];
  };
  const liftArm = (si: number, ei: number, wi: number, S0: V3) => {
    const el: MaybeV3[] = [];
    const wr: MaybeV3[] = [];
    for (const f of frames) {
      const s = P(f, si),
        e = P(f, ei),
        w = P(f, wi);
      if (!s || !e || !w) {
        el.push(null);
        wr.push(null);
        continue;
      }
      const E = add(S0, seg(s, e, RIG.upperArm));
      el.push(E);
      wr.push(add(E, seg(e, w, RIG.forearm)));
    }
    const e2 = fill(el),
      w2 = fill(wr);
    return { e: e2, w: w2 };
  };
  const L = liftArm(11, 13, 15, SL);
  const R = liftArm(12, 14, 16, SR);
  let lw = smoothV(L.w.map((x) => x ?? rest.lw), SP);
  let rw = smoothV(R.w.map((x) => x ?? rest.rw), SP);
  const le = smoothV(L.e.map((x) => x ?? rest.lp), SP);
  const re = smoothV(R.e.map((x) => x ?? rest.rp), SP);

  const pushFront = (w: V3): V3 => {
    const [x, y] = w;
    let z = w[2];
    // لا تخترق اليد الجذع
    if (y < RIG.shoulderY + 0.04 && y > RIG.hipY - 0.1) {
      const ex = clamp(x / (RIG.torsoR[0] + 0.03), -1, 1);
      const front = RIG.torsoR[1] * Math.sqrt(1 - ex * ex) + 0.045;
      if (Math.abs(x) < RIG.torsoR[0] + 0.03) z = Math.max(z, front);
    }
    // ولا الرأس
    const hc = RIG.headCenter,
      hr = RIG.headR;
    const d = [(x - hc[0]) / (hr[0] + 0.03), (y - hc[1]) / (hr[1] + 0.02), (z - hc[2]) / (hr[2] + 0.035)];
    const q = d[0] * d[0] + d[1] * d[1];
    if (q < 1 && d[0] * d[0] + d[1] * d[1] + d[2] * d[2] < 1) z = hc[2] + (hr[2] + 0.035) * Math.sqrt(1 - q);
    return [x, y, z];
  };
  // إشارات التلامس مع الوجه (الفم، الذقن، العين، الأنف): حين تقترب اليد من وجه
  // المؤدّي نقيس موضعها نسبةً إلى فمه لا إلى كتفيه، فتصل يد الشخصية إلى المكان
  // نفسه من وجهها مهما انحنى رأس المؤدّي أو اختلفت نسب جسمه.
  const mouthA: V3 = RIG.mouth ?? [RIG.headCenter[0], RIG.headCenter[1] - 0.05, RIG.headCenter[2] + RIG.headR[2]];
  const mouthD = frames.map((f) => {
    const a = P(f, 9),
      b = P(f, 10);
    return a && b ? lerp(a, b, 0.5) : null;
  });
  const faceAnchor = (wi: number, hk: 'l' | 'r') => {
    const tgt: (V3 | null)[] = [];
    const wts: number[] = [];
    frames.forEach((f, i) => {
      const m = mouthD[i];
      const h = f[hk];
      // مركز اليد (منتصف الكفّ) أدقّ من معصم هيكل الجسم
      const c = h && h.length >= 21 ? ([((h[0][0] + h[9][0]) / 2) * ar, -(h[0][1] + h[9][1]) / 2, 0] as V3) : P(f, wi);
      const w0 = P(f, wi);
      if (!m || !c || !w0) {
        tgt.push(null);
        wts.push(0);
        return;
      }
      // تحت الفم تُحسب المسافة أطول (اليد على الصدر أسفل الذقن ليست تلامسًا مع الوجه)
      const below = Math.max(0, m[1] - c[1]);
      const dist = Math.hypot(c[0] - m[0], Math.min(0, m[1] - c[1]) + below * 1.8) / W;
      wts.push(1 - smoothstep(0.38, 0.72, dist));
      tgt.push([mouthA[0] + (w0[0] - m[0]) * k, mouthA[1] + (w0[1] - m[1]) * k, mouthA[2] + 0.035]);
    });
    return { tgt, w: smoothN(wts, SP) };
  };
  const fl = faceAnchor(15, 'l'),
    fr = faceAnchor(16, 'r');
  lw = lw.map((w, i) => (fl.tgt[i] && fl.w[i] > 0.01 ? lerp(w, fl.tgt[i]!, fl.w[i]) : w));
  rw = rw.map((w, i) => (fr.tgt[i] && fr.w[i] > 0.01 ? lerp(w, fr.tgt[i]!, fr.w[i]) : w));
  lw = lw.map(pushFront);
  rw = rw.map(pushFront);
  // الموجّه: مرفق المؤدّي مدفوعًا قليلًا للخارج والخلف (مرفق طبيعي)
  const pole = (e: V3, side: number): V3 => add(e, [side * 0.05, -0.03, -0.04]);
  // اليد المنسدلة (على الفخذ أو الركبة عند الجلوس) ليست جزءًا من الإشارة:
  // تُمزج نحو وضع الراحة كلّما انخفضت.
  const activity = (w: V3) => clamp((w[1] - (RIG.shoulderY - 0.47)) / 0.11, 0, 1);

  // ---- اليدان ----
  // اليدان: زوايا مفاصل تشريحية (sign-hand.ts) تُبنى على يد الشخصية نفسها
  const handSeries = (side: Side) => {
    const key = side === 'L' ? 'l' : 'r';
    const raw: (V3[] | null)[] = frames.map((f) => {
      // المعالم بالمتر أدقّ عمقًا؛ وإلا المطبَّعة
      const w = f[side];
      if (w && w.length >= 21) return w.map((r) => [r[0], -r[1], -r[2]] as V3);
      const h = f[key];
      if (!h || h.length < 21) return null;
      return h.map((r) => [r[0] * ar, -r[1], -(r.length >= 3 ? r[2] : 0) * ar] as V3);
    });
    if (!raw.some(Boolean)) return null;
    const restLoc = handLocalOf(RIG, side);
    const pf: (PalmFrame | null)[] = raw.map((h) => (h ? palmFrame(h, side) : null));
    const ang: (HandAngles | null)[] = raw.map((h) => (h ? measureHand(localHand(h, side), restLoc) : null));
    const frs = smoothFrames(fill(pf) as PalmFrame[], SP);
    const angs = smoothAngles(fill(ang) as HandAngles[], SP);
    return frs.map((f, i) => handToWorld(buildHand(angs[i], restLoc), f));
  };
  const lhS = handSeries('L');
  const rhS = handSeries('R');
  // يد غائبة طوال المقطع: يد مرتخية على امتداد الساعد، باطنها نحو الجسم
  const relaxedAlong = (w: V3, e: V3, side: number): V3[] =>
    relaxedHand(RIG, side > 0 ? 'L' : 'R', norm(sub(w, e)), [-side, 0, 0.2]);

  // ---- الرأس والجذع ----
  const headAngles = frames.map((f) => {
    const h = f.h;
    if (!h || h.length < 5) return null;
    const v = (r: number[]): V3 => [r[0] * ar, -r[1], -(r[2] ?? 0) * ar];
    const eyeR = v(h[1]),
      eyeL = v(h[2]),
      chin = v(h[3]),
      top = v(h[4]);
    const x = norm(sub(eyeL, eyeR));
    const up = sub(top, chin);
    const z = norm(cross(x, up));
    const y = cross(z, x);
    const yaw = Math.atan2(z[0], z[2]);
    const pitch = Math.asin(clamp(-z[1], -1, 1));
    const roll = Math.atan2(-x[1], y[1]);
    return [yaw, pitch, roll] as V3;
  });
  const haveHead = headAngles.some(Boolean);
  let heads: Quat[];
  if (haveHead) {
    const filled = fill(headAngles) as V3[];
    const med: V3 = [0, 1, 2].map((a) => median(filled.map((e) => e[a]))) as V3;
    const sm = smoothV(filled, SP);
    heads = sm.map((e) =>
      quatFromEuler(
        clamp((e[0] - med[0]) * 0.8, -0.6, 0.6),
        clamp((e[1] - med[1]) * 0.8, -0.45, 0.45),
        clamp((e[2] - med[2]) * 0.8, -0.35, 0.35)
      )
    );
  } else heads = frames.map(() => [0, 0, 0, 1]);

  const rolls = smoothN(
    (fill(shoulders.map((s) => (s ? Math.atan2(s.l[1] - s.r[1], s.l[0] - s.r[0]) : null))) as number[]).map(
      (v) => v ?? 0
    ),
    SP
  );
  const yaws = smoothN(
    (fill(shoulders.map((s) => (s ? Math.atan2(s.l[2] - s.r[2], s.l[0] - s.r[0]) : null))) as number[]).map(
      (v) => v ?? 0
    ),
    SP + 1
  );
  const rollMed = median(rolls),
    yawMed = median(yaws);

  // ---- الوجه: خطّ أساس المؤدّي (الربيع الأدنى) يُطرح، ثم تضخيم للوضوح ----
  const fk = file.fk || [];
  const faceIdx = FACE.map((name) => fk.indexOf(name));
  const faceRaw = frames.map((f) => (f.f ? faceIdx.map((i) => (i >= 0 ? f.f![i] ?? 0 : 0)) : null));
  const faceFilled = fill(faceRaw) as (number[] | null)[];
  let faces: number[][];
  if (faceFilled.some(Boolean)) {
    const ff = faceFilled.map((x) => x ?? FACE.map(() => 0));
    faces = FACE.map((name, j) => {
      const col = ff.map((x) => x[j]);
      const b = quantile(col, 0.2);
      // الرمش لا يُطرح أساسه (عينان مفتوحتان = 0)؛ والباقي يُضخَّم قليلًا
      const gain = name.startsWith('eyeBlink') ? 1.15 : 1.35;
      const baseLine = name.startsWith('eyeBlink') ? quantile(col, 0.1) : b;
      return smoothN(col.map((v) => clamp((v - baseLine) * gain, 0, 1)), 1);
    }).reduce<number[][]>((acc, col, j) => {
      col.forEach((v, i) => ((acc[i] ||= [])[j] = v));
      return acc;
    }, []);
  } else faces = frames.map(() => FACE.map(() => 0));

  const out: AvatarState[] = [];
  const actL = smoothN(lw.map(activity), SP);
  const actR = smoothN(rw.map(activity), SP);
  for (let i = 0; i < n; i++) {
    const lp = pole(le[i], 1),
      rp = pole(re[i], -1);
    const la = solveArm(SL, lw[i], lp, RIG.upperArm, RIG.forearm);
    const ra = solveArm(SR, rw[i], rp, RIG.upperArm, RIG.forearm);
    const lh = lhS ? lhS[i] : relaxedAlong(la.wrist, la.elbow, 1);
    const rh = rhS ? rhS[i] : relaxedAlong(ra.wrist, ra.elbow, -1);
    const a = actL[i],
      b = actR[i];
    out.push({
      lw: lerp(rest.lw, lw[i], a),
      lp: lerp(rest.lp, lp, a),
      rw: lerp(rest.rw, rw[i], b),
      rp: lerp(rest.rp, rp, b),
      lh: lh.map((p, j) => lerp(rest.lh[j], p, a)),
      rh: rh.map((p, j) => lerp(rest.rh[j], p, b)),
      head: heads[i],
      torso: [clamp((rolls[i] - rollMed) * 0.5, -0.1, 0.1), clamp((yaws[i] - yawMed) * 0.4, -0.2, 0.2)],
      face: faces[i],
    });
  }

  // ---- قصّ السكون: الأداء حيث تكون إحدى اليدين مرفوعة ----
  const raised = (w: V3) => w[1] > RIG.shoulderY - 0.36;
  let start = out.findIndex((s) => raised(s.lw) || raised(s.rw));
  let end = n - 1 - [...out].reverse().findIndex((s) => raised(s.lw) || raised(s.rw));
  if (start < 0 || end < start) {
    start = 0;
    end = n - 1;
  } else {
    start = Math.max(0, start - 1);
    end = Math.min(n - 1, end + 1);
  }
  // مقاطع KArSL مُبطّأة مرّتين عند الاستيراد (لوضوح شكل اليد في الفيديو)؛ المترجم
  // يؤدّيها أسرع قليلًا من ذلك لتتّصل الجملة بإيقاع طبيعي مع بقائها واضحة.
  const rate = /karsl/i.test(file.src || '') ? 1.6 : 1;
  return { fps: (file.fps || 15) * rate, frames: out, start, end };
}
