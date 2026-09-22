// ---------------------------------------------------------------------------
//  أدوات مشتركة بين مكوّني الخريطة الحرارية (البطاقة + العرض الكامل):
//  المقاييس، الإسقاط الجغرافي، تدرّج الألوان، اختبار «نقطة داخل مضلّع»،
//  والوضع الليلي.
// ---------------------------------------------------------------------------

import { QATAR_BBOX as GEO } from '@/data/qatar-geo';

// --- المقاييس --------------------------------------------------------------
export type MetricKey = 'users' | 'plays' | 'downloads';
export type MapMode = 'heat' | 'regions';

export const METRIC_LABEL: Record<MetricKey, string> = {
  users: 'المستخدمون',
  plays: 'مرّات اللعب',
  downloads: 'التنزيلات',
};

export const METRIC_UNIT: Record<MetricKey, string> = {
  users: 'مستخدم',
  plays: 'لعبة',
  downloads: 'تنزيل',
};

/** مقياس كل مدرسة: عدّادات تراكمية + توزيع يومي (لمستخدمين) للخطّ الزمني. */
export interface SchoolMetric {
  users: number;
  plays: number;
  downloads: number;
  /** توزيع يومي لعدد المستخدمين الجدد: { 'YYYY-MM-DD': n }. */
  days: Record<string, number>;
}

export function emptyMetric(): SchoolMetric {
  return { users: 0, plays: 0, downloads: 0, days: {} };
}

export function metricValue(m: SchoolMetric | undefined, k: MetricKey): number {
  if (!m) return 0;
  return m[k] || 0;
}

// --- الخطّ الزمني ----------------------------------------------------------
/** مصفوفة تواريخ آخر n يومًا تصاعديًّا (YYYY-MM-DD). */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** تنعيم smoothstep في [0,1]. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * القيمة التراكمية للمستخدمين حتى يومٍ ما (فهرس dayIdx ضمن نافذة days[]).
 * إن لم يتوفّر توزيع يومي حقيقي (بيانات قديمة تراكمية فقط)، تُنمذَج القيمة
 * كمنحنى تصاعدي حتى الإجمالي الحالي — للعرض التوضيحي فقط.
 */
export function usersUpToDay(
  m: SchoolMetric | undefined,
  days: string[],
  dayIdx: number
): number {
  if (!m) return 0;
  const keys = Object.keys(m.days || {});
  const realSum = keys.reduce((s, k) => s + (m.days[k] || 0), 0);
  if (realSum > 0) {
    let acc = 0;
    for (let i = 0; i <= dayIdx; i++) acc += m.days[days[i]] || 0;
    return acc;
  }
  // نمذجة: منحنى تصاعدي ثابت لكل مدرسة يصل إلى users في آخر يوم.
  const total = m.users || 0;
  if (total <= 0) return 0;
  return Math.round(total * ease((dayIdx + 1) / days.length));
}

// --- الإسقاط الجغرافي (خط الطول/العرض → 0..1) ------------------------------
export function normX(lng: number) {
  return (lng - GEO.lngMin) / (GEO.lngMax - GEO.lngMin);
}
export function normY(lat: number) {
  return (GEO.latMax - lat) / (GEO.latMax - GEO.latMin);
}
export const MAP_LAT_MID = (GEO.latMin + GEO.latMax) / 2;
export const MAP_ASPECT =
  (GEO.latMax - GEO.latMin) /
  ((GEO.lngMax - GEO.lngMin) * Math.cos((MAP_LAT_MID * Math.PI) / 180));

// --- تدرّج الحرارة (ذهبي → عنّابي) -----------------------------------------
const RAMP: { t: number; c: [number, number, number]; a: number }[] = [
  { t: 0.0, c: [246, 224, 156], a: 0 },
  { t: 0.15, c: [244, 214, 138], a: 0.5 },
  { t: 0.4, c: [224, 170, 52], a: 0.74 },
  { t: 0.68, c: [176, 42, 84], a: 0.88 },
  { t: 1.0, c: [106, 15, 46], a: 0.96 },
];

export function buildHeatLUT(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = RAMP[0];
    let hi = RAMP[RAMP.length - 1];
    for (let k = 0; k < RAMP.length - 1; k++) {
      if (t >= RAMP[k].t && t <= RAMP[k + 1].t) {
        lo = RAMP[k];
        hi = RAMP[k + 1];
        break;
      }
    }
    const f = (t - lo.t) / (hi.t - lo.t || 1);
    lut[i * 4] = lo.c[0] + (hi.c[0] - lo.c[0]) * f;
    lut[i * 4 + 1] = lo.c[1] + (hi.c[1] - lo.c[1]) * f;
    lut[i * 4 + 2] = lo.c[2] + (hi.c[2] - lo.c[2]) * f;
    lut[i * 4 + 3] = (lo.a + (hi.a - lo.a) * f) * 255;
  }
  return lut;
}

/** لون التدرّج عند نسبة t∈[0,1] كـ rgba() — لتلوين المناطق (choropleth). */
export function rampColor(t: number, alpha = 1): string {
  const x = Math.max(0, Math.min(1, t));
  let lo = RAMP[0];
  let hi = RAMP[RAMP.length - 1];
  for (let k = 0; k < RAMP.length - 1; k++) {
    if (x >= RAMP[k].t && x <= RAMP[k + 1].t) {
      lo = RAMP[k];
      hi = RAMP[k + 1];
      break;
    }
  }
  const f = (x - lo.t) / (hi.t - lo.t || 1);
  const r = Math.round(lo.c[0] + (hi.c[0] - lo.c[0]) * f);
  const g = Math.round(lo.c[1] + (hi.c[1] - lo.c[1]) * f);
  const b = Math.round(lo.c[2] + (hi.c[2] - lo.c[2]) * f);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const HEAT_GRADIENT_CSS =
  'linear-gradient(90deg, rgba(244,214,138,0.5), #e0aa34, #b02a54, #6a0f2e)';

// --- هندسة -----------------------------------------------------------------
/** اختبار «نقطة داخل أيٍّ من حلقات المضلّع» (ray casting). */
export function pointInRings(
  lng: number,
  lat: number,
  rings: [number, number][][]
): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0],
        yi = ring[i][1];
      const xj = ring[j][0],
        yj = ring[j][1];
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

// --- الوضع الليلي ----------------------------------------------------------
export function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return (
    root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark')
  );
}
