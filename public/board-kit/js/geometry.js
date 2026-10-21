// ---------------------------------------------------------------------------
// الهندسة: مصفوفة الإسقاط (Homography) بين صورة الكاميرا وشاشة العرض،
// ومرشّح One Euro لتنعيم مؤشر اليد، وتخطيط قوس الأسنان.
//
// كل الإحداثيات هنا مُطبَّعة:
//   • الكاميرا: (0..1) من عرض الإطار وارتفاعه — فلا تتأثر المعايرة بتغيّر دقة الكاميرا.
//   • الشاشة: (0..1) من عرض نافذة الصفحة وارتفاعها — فلا تتأثر بتغيّر حجم الآيباد.
// ---------------------------------------------------------------------------

/** يحلّ نظامًا خطيًا A·x = b بالحذف الغاوسي مع الارتكاز الجزئي. يعيد null إن كان منفردًا. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * مصفوفة الإسقاط H (3×3 مسطّحة، h33 = 1) التي تنقل src[i] إلى dst[i] لأربع نقاط.
 * @param {{x:number,y:number}[]} src
 * @param {{x:number,y:number}[]} dst
 */
export function homographyFrom4(src, dst) {
  if (src.length !== 4 || dst.length !== 4) throw new Error('homography needs 4 points');
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  if (!h || h.some((n) => !Number.isFinite(n))) return null;
  return [...h, 1];
}

/** يطبّق H على نقطة. يعيد null إن وقعت النقطة على «خط الأفق» (مقام قريب من الصفر). */
export function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-9) return null;
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

/** معكوس مصفوفة 3×3 (لرسم حدود الشاشة فوق معاينة الكاميرا). */
export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
}

/** هل الرباعي (بترتيب الدوران) محدّب وغير متقاطع؟ — شرط معايرة سليمة. */
export function isConvexQuad(p) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    const c = p[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) return false;
    const s = Math.sign(z);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** مساحة مضلّع (قيمة مطلقة) بصيغة الحذاء. */
export function polygonArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

// ---------------------------------------------------------------------------
// مرشّح One Euro (Casiez وآخرون، CHI 2012): ينعّم الارتعاش حين تكون اليد ساكنة،
// ويقلّل التأخّر حين تتحرك بسرعة — أفضل من المتوسط المتحرك لمؤشرات اليد.
// ---------------------------------------------------------------------------
class LowPass {
  constructor() {
    this.y = null;
  }
  filter(x, alpha) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
}

const alphaFor = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.t = null;
    this.prev = null;
  }
  filter(value, tMs) {
    if (this.t === null) {
      this.t = tMs;
      this.prev = value;
      this.dx.filter(0, 1);
      return this.x.filter(value, 1);
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const d = (value - this.prev) / dt;
    this.prev = value;
    const ed = this.dx.filter(d, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(ed);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
}

// ---------------------------------------------------------------------------
// قوس الأسنان.
// ---------------------------------------------------------------------------

/**
 * منحنى القوس (خط أعناق الأسنان): نصف قطع ناقص يتباعد طرفاه قليلًا كما في الفك
 * الحقيقي (الطواحن أبعد عن بعضها من الضواحك)، مع طول القوس التراكمي.
 *   • الفك العلوي «∩»: القواطع في الأعلى، والطواحن تنزل إلى الطرفين.
 *   • الفك السفلي «∪»: القواطع في الأسفل، والطواحن تصعد إلى الطرفين.
 * المركز (center) نقطة داخل التجويف تُستعمل لمعرفة اتجاه «الداخل».
 * @param {{cx:number, top:number, w:number, h:number, jaw:'upper'|'lower', spread?:number}} o
 */
export function archCurve({ cx, top, w, h, jaw, spread = 0.12 }, samples = 600) {
  const a = w / 2;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const th = -Math.PI / 2 + (Math.PI * i) / samples;
    const sx = Math.sign(th) * a * ((1 - spread) * Math.sin(Math.abs(th)) + spread * (1 - Math.cos(th)));
    const depth = 1 - Math.cos(th); // 0 عند القواطع، 1 عند الطرف
    const x = cx + sx;
    const y = jaw === 'upper' ? top + h * depth : top + h * (1 - depth);
    pts.push({ x, y });
  }
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const center = { x: cx, y: jaw === 'upper' ? top + h * 1.15 : top - h * 0.15 };
  return { pts, acc, length: acc[acc.length - 1], center };
}

/** العمودي على المماس متجهًا نحو داخل القوس. */
export function inwardNormal(curve, x, y, tx, ty) {
  let nx = -ty;
  let ny = tx;
  if (nx * (curve.center.x - x) + ny * (curve.center.y - y) < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

/** النقطة والمماس عند طول قوس معيّن (استيفاء خطي بين العيّنات). */
export function pointAtLength(curve, L) {
  const { pts, acc } = curve;
  let lo = 0;
  let hi = acc.length - 1;
  L = Math.max(0, Math.min(acc[hi], L));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (acc[mid] < L) lo = mid;
    else hi = mid;
  }
  const seg = acc[hi] - acc[lo] || 1;
  const t = (L - acc[lo]) / seg;
  const a = pts[lo];
  const b = pts[hi];
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const tl = Math.hypot(tx, ty) || 1;
  return { x: a.x + tx * t, y: a.y + ty * t, tx: tx / tl, ty: ty / tl };
}

/**
 * يوزّع الأسنان على القوس بحسب عرضها الحقيقي (مم) وطول القوس، ويعيد لكل سن
 * مركزه وزاوية دورانه بحيث يتجه التاج نحو داخل الفم (والجذر نحو الخارج).
 * @param {{widthMm:number}[]} teeth مرتّبة من طرف إلى طرف
 * @param {ReturnType<typeof archCurve>} curve
 * @param {number} gapRatio الفراغ بين سنّين كنسبة من متوسط العرض
 */
export function placeOnArch(teeth, curve, gapRatio = 0.1) {
  const sumMm = teeth.reduce((s, t) => s + t.widthMm, 0);
  const meanMm = sumMm / teeth.length;
  const gaps = teeth.length - 1;
  // الطول = k·مجموع العروض + k·نسبة الفراغ·متوسط العرض·عدد الفراغات
  const k = curve.length / (sumMm + gapRatio * meanMm * gaps);
  const gap = gapRatio * meanMm * k;
  let L = 0;
  return {
    scale: k,
    slots: teeth.map((t) => {
      const width = t.widthMm * k;
      const mid = L + width / 2;
      L += width + gap;
      const p = pointAtLength(curve, mid);
      const { nx, ny } = inwardNormal(curve, p.x, p.y, p.tx, p.ty);
      // نُدير الرسم المحلي (التاج نحو +y) ليتجه نحو الداخل.
      const angle = (Math.atan2(ny, nx) * 180) / Math.PI - 90;
      return { x: p.x, y: p.y, angle, width, nx, ny };
    }),
  };
}
