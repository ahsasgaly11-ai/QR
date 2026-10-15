// ---------------------------------------------------------------------------
// تصادم اليدين والذراعين مع الملابس والرأس: مجسّم شعاعي مخبوز في signer.json
// (لكل ارتفاع وزاوية حول محور الجذع أبعد نقطة من الثوب والياقة والغترة والوجه).
// قبل الحركية العكسية تُفحص مفاصل الكفّ والأصابع ومنتصف الساعد؛ أي نقطة داخل
// الملابس تدفع المعصم إلى الخارج بقدر اختراقها، ثم يُحلّ المرفق، وإن دخل المرفق
// الجذعَ يُدفع موجّهه إلى الخارج. فتلامس الأصابع الوجه أو الصدر ولا تخترقهما.
// ---------------------------------------------------------------------------
import type { V3 } from './sign-motion';

export interface RadialCollider {
  axis: [number, number]; // (x, z) لمحور الجذع
  y0: number;
  dy: number;
  na: number;
  ny: number;
  /** أنصاف الأقطار بالمليمتر، صفًّا لكل ارتفاع */
  r: number[];
}

/** نصف قطر سطح الملابس عند ارتفاع y وزاوية ang (0 = الأمام)، أو 0 خارج النطاق. */
export function surfaceRadius(c: RadialCollider, y: number, ang: number): number {
  const fy = (y - c.y0) / c.dy;
  if (fy < 0 || fy > c.ny - 1) return 0;
  const fa = ((ang + Math.PI) / (2 * Math.PI)) * c.na - 0.5;
  const y0 = Math.floor(fy),
    y1 = Math.min(c.ny - 1, y0 + 1),
    ty = fy - y0;
  const a0 = Math.floor(fa),
    ta = fa - a0;
  const ia0 = ((a0 % c.na) + c.na) % c.na,
    ia1 = (ia0 + 1) % c.na;
  const g = (yy: number, aa: number) => c.r[yy * c.na + aa] / 1000;
  const r0 = g(y0, ia0) * (1 - ta) + g(y0, ia1) * ta;
  const r1 = g(y1, ia0) * (1 - ta) + g(y1, ia1) * ta;
  return r0 * (1 - ty) + r1 * ty;
}

/** اختراق نقطة (موجب = داخل) مع هامش، واتجاه الدفع الأفقي إلى الخارج. */
export function penetration(c: RadialCollider, p: V3, margin: number): { depth: number; dir: V3 } {
  const dx = p[0] - c.axis[0],
    dz = p[2] - c.axis[1];
  const d = Math.hypot(dx, dz) || 1e-6;
  const ang = Math.atan2(dx, dz);
  const rs = surfaceRadius(c, p[1], ang);
  if (rs <= 0) return { depth: 0, dir: [0, 0, 1] };
  // أمام الجسم والوجه: الدفع إلى الأمام أساسًا (اليد أمام الوجه تبقى أمامه ولا
  // تنزلق إلى جانبيه)؛ على الجانبين والخلف: شعاعيًّا
  const front = Math.max(0, Math.cos(ang));
  let ux = (dx / d) * (1 - 0.75 * front),
    uz = dz / d + 0.75 * front;
  const ul = Math.hypot(ux, uz) || 1;
  ux /= ul;
  uz /= ul;
  // العمق على طول اتجاه الدفع: كم يلزم لبلوغ السطح
  const need = rs + margin - d;
  return { depth: need > 0 ? need / Math.max(0.35, ux * (dx / d) + uz * (dz / d)) : need, dir: [ux, 0, uz] };
}

// هوامش (متر): نصف سُمك الجزء + مسافة أمان صغيرة
const M_FINGER = 0.011;
const M_PALM = 0.02;
const M_FORE = 0.05; // الكمّ حول الساعد
const M_ELBOW = 0.055;

/**
 * يدفع هدف المعصم خارج الملابس. `hand` مفاصل الكفّ نسبةً إلى المعصم،
 * `solve(target)` يعيد {elbow, wrist} للهدف (حركية عكسية).
 */
export function resolveWrist(
  c: RadialCollider,
  target: V3,
  hand: V3[],
  solve: (t: V3) => { elbow: V3; wrist: V3 }
): V3 {
  let t: V3 = [...target];
  for (let iter = 0; iter < 3; iter++) {
    const { elbow, wrist } = solve(t);
    let best = 0;
    let push: V3 = [0, 0, 0];
    const test = (p: V3, m: number) => {
      const { depth, dir } = penetration(c, p, m);
      if (depth > best) {
        best = depth;
        push = [dir[0] * depth, 0, dir[2] * depth];
      }
    };
    for (let j = 0; j < 21; j++) {
      const h = hand[j];
      test([wrist[0] + h[0], wrist[1] + h[1], wrist[2] + h[2]], j === 0 || j % 4 === 1 ? M_PALM : M_FINGER);
    }
    for (const k of [0.35, 0.7]) {
      test(
        [elbow[0] + (wrist[0] - elbow[0]) * k, elbow[1] + (wrist[1] - elbow[1]) * k, elbow[2] + (wrist[2] - elbow[2]) * k],
        M_FORE
      );
    }
    if (best < 5e-4) break;
    t = [t[0] + push[0], t[1], t[2] + push[2]];
  }
  return t;
}

/** إن دخل المرفق (أو منتصف العضد) الجذعَ يُعاد الموجّه إلى خارجه. */
export function resolvePole(c: RadialCollider, shoulder: V3, elbow: V3, pole: V3): V3 | null {
  const mid: V3 = [(shoulder[0] + elbow[0]) / 2, (shoulder[1] + elbow[1]) / 2, (shoulder[2] + elbow[2]) / 2];
  const a = penetration(c, elbow, M_ELBOW);
  const b = penetration(c, mid, M_ELBOW);
  const w = a.depth >= b.depth ? a : b;
  if (w.depth <= 5e-4) return null;
  return [pole[0] + w.dir[0] * (w.depth + 0.05), pole[1], pole[2] + w.dir[2] * (w.depth + 0.05)];
}
