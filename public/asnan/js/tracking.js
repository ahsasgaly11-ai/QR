// ---------------------------------------------------------------------------
// منطق التتبّع (دوال صافية قابلة للاختبار، بلا كاميرا ولا DOM):
//
// ١) التكبير على السبورة: نقصّ من إطار الكاميرا منطقة السبورة فقط (من المعايرة)،
//    ونقسمها إلى «بلاطات» متداخلة يُشغَّل على كل منها كاشف اليد. كاشف الكف في
//    MediaPipe يصغّر الصورة كلها إلى ١٩٢×١٩٢ قبل البحث، فيد طفل بعيدة تصير بضع
//    بكسلات وتضيع؛ القصّ والتقسيم يكبّرانها ١٫٦–٢٫٦ مرة في عين الكاشف.
//
// ٢) دمج البلاطات: اليد في منطقة التداخل تُكشف مرتين؛ نُبقي الأوضح.
//
// ٣) هوية كل يد عبر الإطارات: مطابقة بالموضع المتوقَّع (السرعة)، وبجهة اليد
//    (يمنى/يسرى) وحجمها، فلا تتبادل يدا طفلين متجاورين هويتيهما. ويتّسع نطاق
//    المطابقة كلما طال اختفاء اليد (حُجبت بجسم الطفل) حتى ٣ ثوانٍ.
//
// ٤) «المسح والتركيز» (الدقة القصوى): بدل بلاطات ثابتة كثيرة كل إطار، يُمسح كل
//    إطار جزءان صغيران من شبكة ٤×٣ على السبورة (تكبير ≈٥×) لاكتشاف الأيدي، وكل
//    يد مكتشفة تحصل على «نافذة تركيز» مقصوصة حولها تتبعها إطارًا بإطار، فتبقى
//    اليد الصغيرة كبيرة في عين الكاشف طوال السحب.
// ---------------------------------------------------------------------------
import { applyH, invert3, OneEuro } from './geometry.js';

/** إعدادات الدقة: أعمدة × صفوف البلاطات، ومقدار تكبير اليد التقريبي في عين الكاشف. */
export const QUALITY = {
  normal: { cols: 1, rows: 1, label: 'عادية' },
  high: { cols: 2, rows: 1, label: 'عالية' },
  max: { cols: 4, rows: 3, smart: true, scanPerFrame: 2, label: 'قصوى' },
};
export const QUALITY_ORDER = ['normal', 'high', 'max'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * منطقة السبورة في إطار الكاميرا (مطبّعة) مع هامش لليد التي تتجاوز الحافة قليلًا.
 * @param {number[]|null} H مصفوفة الكاميرا ← الشاشة
 */
export function boardRoi(H, margin = 0.1) {
  const full = { x: 0, y: 0, w: 1, h: 1 };
  if (!H) return full;
  const inv = invert3(H);
  if (!inv) return full;
  const pts = [[-0.04, -0.04], [1.04, -0.04], [1.04, 1.04], [-0.04, 1.04]].map(([x, y]) => applyH(inv, x, y));
  if (pts.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return full;
  let x0 = Math.min(...pts.map((p) => p.x));
  let x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y));
  let y1 = Math.max(...pts.map((p) => p.y));
  const mx = (x1 - x0) * margin;
  const my = (y1 - y0) * margin;
  x0 = clamp01(x0 - mx);
  x1 = clamp01(x1 + mx);
  y0 = clamp01(y0 - my);
  y1 = clamp01(y1 + my);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return full;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * يقسم المنطقة إلى بلاطات متداخلة (التداخل ≥ حجم يد، فكل يد تقع كاملة في بلاطة واحدة على الأقل).
 * @returns {{x:number,y:number,w:number,h:number}[]} مطبّعة على إطار الكاميرا
 */
export function makeTiles(roi, cols, rows, overlap = 0.22) {
  const tw = roi.w / (cols - (cols - 1) * overlap);
  const th = roi.h / (rows - (rows - 1) * overlap);
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ x: roi.x + c * tw * (1 - overlap), y: roi.y + r * th * (1 - overlap), w: tw, h: th });
    }
  }
  return tiles;
}

/**
 * يدمج اكتشافات البلاطات: اليد المكشوفة في بلاطتين تبقى مرة واحدة (الأوضح والأبعد عن حافة بلاطتها).
 * @param {{cx:number,cy:number,size:number,score:number,edge:number}[]} dets مطبّعة على الكاميرا، size بنسبة عرض الإطار
 * @param {number} aspect عرض الإطار ÷ ارتفاعه
 */
export function mergeDetections(dets, aspect) {
  const q = (d) => d.score + 0.6 * Math.min(d.edge, 0.2);
  const sorted = [...dets].sort((a, b) => q(b) - q(a));
  const kept = [];
  for (const d of sorted) {
    const dup = kept.some((k) => {
      const dist = Math.hypot(d.cx - k.cx, (d.cy - k.cy) / aspect);
      return dist < 0.6 * Math.max(d.size, k.size);
    });
    if (!dup) kept.push(d);
  }
  return kept;
}

/** أقصى مدة تُحفظ فيها هوية يد مختفية (حجبها جسم الطفل أو خرجت من الصورة لحظة). */
export const TRACK_MEMORY_MS = 3000;

/**
 * مطابقة الأيدي عبر الإطارات بإحداثيات الشاشة المطبّعة.
 */
export class HandMatcher {
  constructor({ aspect = 1.6, memoryMs = TRACK_MEMORY_MS } = {}) {
    this.aspect = aspect; // عرض الشاشة ÷ ارتفاعها: المسافات تُقاس متساوية في الاتجاهين
    this.memoryMs = memoryMs;
    this.tracks = new Map();
    this.nextId = 1;
  }

  clear() {
    this.tracks.clear();
  }

  /** نطاق المطابقة يتّسع مع طول الاختفاء: يد عادت بعد حجب تُعرف وإن تحرّكت. */
  static gate(dtMs) {
    return 0.1 + 0.22 * Math.min(1, dtMs / 1500);
  }

  _predict(tr, t) {
    const dt = Math.min(300, t - tr.seen) / 1000; // لا نستقرئ أبعد من ٠٫٣ ث
    return { x: tr.rx + tr.vx * dt, y: tr.ry + tr.vy * dt };
  }

  _dist(a, b) {
    return Math.hypot((a.x - b.x) * this.aspect, a.y - b.y) / this.aspect;
  }

  /**
   * @param {{x:number,y:number,handed?:string,size?:number}[]} dets
   * @returns {{id:number,x:number,y:number,handed?:string}[]}
   */
  update(dets, t) {
    for (const [id, tr] of this.tracks) if (t - tr.seen > this.memoryMs) this.tracks.delete(id);
    const pairs = [];
    dets.forEach((d, di) => {
      for (const [id, tr] of this.tracks) {
        const dt = t - tr.seen;
        const p = this._predict(tr, t);
        const dist = this._dist(d, p);
        if (dist > HandMatcher.gate(dt)) continue;
        let cost = dist;
        if (d.handed && tr.handed && d.handed !== tr.handed) cost += 0.04;
        if (d.size && tr.size) cost += 0.06 * Math.abs(Math.log(d.size / tr.size));
        cost += 0.00002 * dt; // الأحدث أولى عند التساوي
        pairs.push({ di, id, cost });
      }
    });
    pairs.sort((a, b) => a.cost - b.cost);
    const usedD = new Set();
    const usedT = new Set();
    const out = [];
    for (const { di, id } of pairs) {
      if (usedD.has(di) || usedT.has(id)) continue;
      usedD.add(di);
      usedT.add(id);
      out.push(this._update(this.tracks.get(id), dets[di], t));
    }
    dets.forEach((d, di) => {
      if (usedD.has(di)) return;
      const tr = { id: this.nextId++, rx: d.x, ry: d.y, vx: 0, vy: 0, seen: t, fresh: true };
      this.tracks.set(tr.id, tr);
      out.push(this._update(tr, d, t));
    });
    return out;
  }

  _update(tr, d, t) {
    const dt = t - tr.seen;
    // بعد اختفاء طويل نبدأ المرشّح من الموضع الجديد بدل أن «يزحف» المؤشر إليه
    if (tr.fresh || dt > 400) {
      tr.fx = new OneEuro({ minCutoff: 1.1, beta: 6, dCutoff: 1 });
      tr.fy = new OneEuro({ minCutoff: 1.1, beta: 6, dCutoff: 1 });
      tr.vx = 0;
      tr.vy = 0;
    } else if (dt > 0) {
      const k = 0.5; // تنعيم السرعة
      tr.vx = k * tr.vx + (1 - k) * ((d.x - tr.rx) / (dt / 1000));
      tr.vy = k * tr.vy + (1 - k) * ((d.y - tr.ry) / (dt / 1000));
    }
    tr.fresh = false;
    tr.rx = d.x;
    tr.ry = d.y;
    tr.seen = t;
    if (d.handed) tr.handed = d.handed;
    if (d.size) tr.size = tr.size ? 0.7 * tr.size + 0.3 * d.size : d.size;
    tr.x = tr.fx.filter(d.x, t);
    tr.y = tr.fy.filter(d.y, t);
    return { id: tr.id, x: tr.x, y: tr.y, handed: tr.handed };
  }
}

/**
 * نافذة تركيز مربعة (بالبكسل) حول يد: ضلعها ٧ أضعاف المسافة من الرسغ إلى قاعدة الوسطى
 * (اليد كلها ≈ ٢٫٢ ضعفها)، فتشغل اليد ثلث النافذة تقريبًا مهما صغرت في الإطار.
 * @param {{cx:number, cy:number, size:number}} h مطبّعة؛ size بنسبة عرض الإطار
 * @param {number} aspect عرض الإطار ÷ ارتفاعه
 */
export function focusCrop(h, aspect) {
  const side = Math.max(0.09, Math.min(0.75, 7 * h.size)); // بنسبة العرض
  const w = side;
  const hh = Math.min(1, side * aspect); // الضلع نفسه بنسبة الارتفاع
  const x = Math.max(0, Math.min(1 - w, h.cx - w / 2));
  const y = Math.max(0, Math.min(1 - hh, h.cy - hh / 2));
  return { x, y, w, h: hh };
}
