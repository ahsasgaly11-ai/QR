// ---------------------------------------------------------------------------
// المعايرة: ربط كل نقطة في صورة الكاميرا بموضعها على الشاشة المعروضة.
//
// التلقائية: تُعرض الشاشة سوداء، ثم تظهر دائرة بيضاء في كل زاوية بالتتابع.
// الفرق بين إطار «قبل» و«بعد» يكشف مكان الدائرة في عين الكاميرا مهما كانت
// إضاءة الصف (الإضاءة الثابتة والوهج يُطرحان في الفرق). نقطة خامسة في المنتصف
// تقيس دقة المعايرة فعليًا بدل افتراضها.
//
// اليدوية: تُعرض أربع علامات مرقّمة، وتُلتقط صورة، ويلمس المعلم العلامات فيها.
// ---------------------------------------------------------------------------
import { applyH, homographyFrom4, isConvexQuad, polygonArea } from './geometry.js';

/** مواضع العلامات على الشاشة (مطبّعة) بترتيب دوران: أعلى يسار، أعلى يمين، أسفل يمين، أسفل يسار. */
export const MARKERS = [
  { x: 0.1, y: 0.12 },
  { x: 0.9, y: 0.12 },
  { x: 0.9, y: 0.88 },
  { x: 0.1, y: 0.88 },
];
const CHECK = { x: 0.5, y: 0.5 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CalibError extends Error {}

function averageFrames(frames) {
  const out = new Float32Array(frames[0].gray.length);
  for (const f of frames) for (let i = 0; i < out.length; i++) out[i] += f.gray[i] / frames.length;
  return { gray: out, w: frames[0].w, h: frames[0].h };
}

async function grabAvg(tracker, n = 3, gap = 70) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const f = tracker.grabGray(320);
    if (!f) throw new CalibError('الكاميرا لا ترسل صورة.');
    frames.push(f);
    if (i < n - 1) await sleep(gap);
  }
  return averageFrames(frames);
}

/**
 * يحدد مركز البقعة التي أضاءت بين الإطارين A و B.
 * يُرجع {x, y} مطبّعة، أو يرمي خطأ مفهومًا إن كانت البقعة غير واضحة.
 */
export function locateSpot(A, B) {
  const { w, h } = A;
  const n = w * h;
  const diff = new Float32Array(n);
  for (let i = 0; i < n; i++) diff[i] = Math.max(0, B.gray[i] - A.gray[i]);
  // تنعيم 3×3 يزيل ضجيج البكسلات المنفردة قبل البحث عن القمة
  const sm = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += diff[(y + dy) * w + x + dx];
      sm[y * w + x] = s / 9;
    }
  }
  let max = 0;
  let mi = 0;
  for (let i = 0; i < n; i++) if (sm[i] > max) (max = sm[i]), (mi = i);
  if (max < 22) throw new CalibError('لم تظهر العلامة في الكاميرا. تأكّد أن الكاميرا ترى الصورة المعروضة كاملة.');
  const thr = max * 0.5;
  const mx = mi % w;
  const my = (mi / w) | 0;
  const R = Math.round(w * 0.1);
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let y = Math.max(0, my - R); y < Math.min(h, my + R); y++) {
    for (let x = Math.max(0, mx - R); x < Math.min(w, mx + R); x++) {
      const v = sm[y * w + x];
      if (v < thr) continue;
      const wt = v - thr;
      sw += wt;
      sx += wt * (x + 0.5);
      sy += wt * (y + 0.5);
    }
  }
  if (sw <= 0) throw new CalibError('العلامة غير واضحة.');
  const cx = sx / sw;
  const cy = sy / sw;
  // تغيّر واسع خارج نافذة البقعة يعني حركة أمام الكاميرا لا علامة
  let far = 0;
  let near = 0;
  for (let i = 0; i < n; i++) {
    if (sm[i] < thr) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (Math.abs(x - mx) < R && Math.abs(y - my) < R) near++;
    else far++;
  }
  if (far > near * 0.6 + 8) throw new CalibError('تحرّك شيء أمام الكاميرا أثناء المعايرة. ابتعدوا عن السبورة وأعيدوا المحاولة.');
  return { x: cx / w, y: cy / h };
}

/** يتحقق من الرباعي ويبني المصفوفة. */
export function buildCalibration(cam, screen = MARKERS) {
  if (!isConvexQuad(cam)) throw new CalibError('ترتيب العلامات في الكاميرا غير صحيح. حاول مجددًا.');
  if (polygonArea(cam) < 0.02) throw new CalibError('الصورة المعروضة صغيرة جدًا في الكاميرا. قرّب الحامل أو اجعل الكاميرا ترى السبورة أوضح.');
  const H = homographyFrom4(cam, screen);
  if (!H) throw new CalibError('تعذّر حساب المعايرة.');
  return { cam, screen, H, at: Date.now() };
}

/**
 * نسبة الخطأ مئويًّا من عرض الشاشة بين الموضع المتوقّع والمرصود.
 * @param {{x:number,y:number}} predicted مطبّعة
 * @param {{x:number,y:number}} truth مطبّعة
 * @param {number} aspect عرض الشاشة ÷ ارتفاعها
 */
export function errorPct(predicted, truth, aspect) {
  return Math.hypot((predicted.x - truth.x) * aspect, predicted.y - truth.y) / aspect * 100;
}

function makeOverlay(root, bg) {
  const ov = document.createElement('div');
  ov.className = 'calib-overlay';
  ov.style.background = bg;
  root.appendChild(ov);
  return ov;
}

function spot(ov, p, r, color = '#fff') {
  const d = document.createElement('div');
  d.className = 'calib-spot';
  Object.assign(d.style, {
    left: `${p.x * 100}%`,
    top: `${p.y * 100}%`,
    width: `${2 * r}px`,
    height: `${2 * r}px`,
    background: color,
  });
  ov.appendChild(d);
  return d;
}

/**
 * المعايرة التلقائية.
 * @param {import('./tracker.js').HandTracker} tracker
 * @param {HTMLElement} root
 * @param {{settleMs?:number, onProgress?:(i:number,n:number)=>void}} o
 */
export async function autoCalibrate(tracker, root, { settleMs = 950, onProgress } = {}) {
  const ov = makeOverlay(root, '#000');
  const label = document.createElement('div');
  label.className = 'calib-label';
  label.textContent = 'معايرة… ابتعدوا عن السبورة';
  ov.appendChild(label);
  const r = Math.round(Math.min(innerWidth, innerHeight) * 0.06);
  const aspect = innerWidth / innerHeight;
  try {
    await sleep(1300); // زمن انتقال الصورة عبر Apple TV وتكيّف إضاءة الكاميرا
    const targets = [...MARKERS, CHECK];
    const found = [];
    for (let i = 0; i < targets.length; i++) {
      onProgress?.(i, targets.length);
      const A = await grabAvg(tracker);
      const s = spot(ov, targets[i], r);
      await sleep(settleMs);
      const B = await grabAvg(tracker);
      s.remove();
      found.push(locateSpot(A, B));
      await sleep(settleMs * 0.8);
    }
    const cal = buildCalibration(found.slice(0, 4));
    const pred = applyH(cal.H, found[4].x, found[4].y);
    cal.error = pred ? errorPct(pred, CHECK, aspect) : 99;
    cal.method = 'auto';
    return cal;
  } finally {
    ov.remove();
  }
}

/**
 * المعايرة اليدوية: لقطة فيها أربع علامات مرقّمة، والمعلم يلمسها بالترتيب.
 * @returns {Promise<object|null>} null إن ألغى المعلم
 */
export async function manualCalibrate(tracker, root) {
  const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706'];
  const ov = makeOverlay(root, '#fff');
  const r = Math.round(Math.min(innerWidth, innerHeight) * 0.05);
  MARKERS.forEach((p, i) => {
    const s = spot(ov, p, r, colors[i]);
    s.textContent = String(i + 1);
    s.classList.add('numbered');
  });
  await sleep(1500);
  const shot = tracker.snapshot();
  ov.innerHTML = '';
  if (!shot) {
    ov.remove();
    throw new CalibError('الكاميرا لا ترسل صورة.');
  }

  return new Promise((resolve) => {
    ov.style.background = '#111';
    const img = shot;
    img.className = 'calib-shot';
    ov.appendChild(img);
    const hint = document.createElement('div');
    hint.className = 'calib-hint';
    ov.appendChild(hint);
    const bar = document.createElement('div');
    bar.className = 'calib-bar';
    bar.innerHTML = '<button class="btn sm" data-a="undo">تراجع</button><button class="btn sm" data-a="cancel">إلغاء</button>';
    ov.appendChild(bar);
    const pts = [];
    const dots = [];
    const update = () => {
      hint.innerHTML = pts.length < 4
        ? `المس مركز العلامة <b style="color:${colors[pts.length]}">${pts.length + 1}</b> في الصورة`
        : 'تمّ';
    };
    update();
    const finish = (val) => {
      ov.remove();
      resolve(val);
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'cancel') finish(null);
      if (a === 'undo' && pts.length) {
        pts.pop();
        dots.pop().remove();
        update();
      }
    });
    img.addEventListener('pointerdown', (e) => {
      const rect = img.getBoundingClientRect();
      // الصورة معروضة بـ object-fit: contain؛ نحسب المساحة الفعلية للصورة داخل العنصر
      const s = Math.min(rect.width / img.width, rect.height / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      const ox = rect.left + (rect.width - dw) / 2;
      const oy = rect.top + (rect.height - dh) / 2;
      const x = (e.clientX - ox) / dw;
      const y = (e.clientY - oy) / dh;
      if (x < 0 || x > 1 || y < 0 || y > 1 || pts.length >= 4) return;
      pts.push({ x, y });
      const d = document.createElement('div');
      d.className = 'calib-tap';
      Object.assign(d.style, { left: `${e.clientX}px`, top: `${e.clientY}px`, borderColor: colors[pts.length - 1] });
      ov.appendChild(d);
      dots.push(d);
      update();
      if (pts.length === 4) {
        setTimeout(() => {
          try {
            const cal = buildCalibration(pts);
            cal.method = 'manual';
            cal.error = null;
            finish(cal);
          } catch (err) {
            finish({ failed: err.message });
          }
        }, 250);
      }
    });
  });
}

export { CalibError };
