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

/** متوسط الفرق المطلق بين إطارين: صغير = المشهد ثابت. */
export function meanAbsDiff(A, B) {
  let s = 0;
  for (let i = 0; i < A.gray.length; i++) s += Math.abs(A.gray[i] - B.gray[i]);
  return s / A.gray.length;
}

/** أقصى انتظار لظهور العلامة: يغطي أبطأ انعكاس شاشة (تطبيق iProjection عبر Wi-Fi قد يتأخر ثانية أو أكثر). */
export const MAX_WAIT_MS = 6000;
const POLL_MS = 120;

/**
 * قلب المعايرة التلقائية بلا DOM (قابل للاختبار): لا يفترض زمنًا ثابتًا لوصول الصورة إلى
 * جهاز العرض. يختلف التأخير كثيرًا بين طرق الانعكاس: كابل HDMI (شبه فوري)، Apple TV،
 * Screen Mirroring (Miracast) المدمج في جهاز العرض، وتطبيق Epson iProjection (الأبطأ).
 * لذا: ننتظر حتى يثبت المشهد، ثم نُظهر كل علامة ونفحص الإطارات حتى نراها في مكانها
 * مرتين متتاليتين، ونقيس التأخير، ولا نعرض العلامة التالية حتى تختفي السابقة.
 *
 * @param {{grab:()=>Promise<{gray,w,h}>|{gray,w,h}, show:(i:number)=>void, hide:()=>void,
 *          sleep:(ms:number)=>Promise<void>, now:()=>number, aspect:number,
 *          targets?:{x:number,y:number}[], onProgress?:(i:number,n:number)=>void}} io
 */
export async function runAutoCalibration({ grab, show, hide, sleep: wait, now, aspect, targets = [...MARKERS, CHECK], onProgress }) {
  const grabAvgOf = async (n) => {
    const frames = [];
    for (let i = 0; i < n; i++) {
      const f = await grab();
      if (!f) throw new CalibError('الكاميرا لا ترسل صورة.');
      frames.push(f);
      if (i < n - 1) await wait(60);
    }
    return averageFrames(frames);
  };

  // ١) الشاشة السوداء وصلت والكاميرا كيّفت إضاءتها: إطاران متتاليان شبه متطابقين
  let prev = await grabAvgOf(1);
  const t0 = now();
  let calm = 0;
  await wait(500);
  while (now() - t0 < MAX_WAIT_MS) {
    const cur = await grabAvgOf(1);
    calm = meanAbsDiff(prev, cur) < 2.5 ? calm + 1 : 0;
    prev = cur;
    if (calm >= 3) break;
    await wait(POLL_MS * 2);
  }

  const found = [];
  const delays = [];
  for (let i = 0; i < targets.length; i++) {
    onProgress?.(i, targets.length);
    const A = await grabAvgOf(3);
    show(i);
    const shownAt = now();
    let last = null;
    let firstSeen = 0;
    let lastErr = null;
    let p = null;
    while (now() - shownAt < MAX_WAIT_MS) {
      await wait(POLL_MS);
      try {
        const q = locateSpot(A, await grabAvgOf(1));
        if (!firstSeen) firstSeen = now();
        if (last && Math.hypot(q.x - last.x, q.y - last.y) < 0.012) {
          // ثبتت العلامة: قياس نهائي أدق بمتوسط عدة إطارات
          p = locateSpot(A, await grabAvgOf(3));
          break;
        }
        last = q;
      } catch (err) {
        lastErr = err;
        last = null;
      }
    }
    hide();
    if (!p) {
      if (lastErr && !/لم تظهر/.test(lastErr.message)) throw lastErr;
      throw new CalibError('لم تظهر العلامة في الكاميرا خلال ٦ ثوانٍ. تأكّد أن الكاميرا ترى الصورة المعروضة كاملة، وأن انعكاس الشاشة يعمل.');
    }
    found.push(p);
    const delay = firstSeen - shownAt;
    delays.push(delay);
    // لا نصوّر «قبل» العلامة التالية حتى تختفي هذه من الصورة المعروضة (بعد التأخير نفسه)
    await wait(Math.min(3000, Math.max(300, delay + 250)));
  }
  const cal = buildCalibration(found.slice(0, 4));
  if (found[4]) {
    const pred = applyH(cal.H, found[4].x, found[4].y);
    cal.error = pred ? errorPct(pred, targets[4], aspect) : 99;
  }
  const sorted = [...delays].sort((a, b) => a - b);
  cal.latencyMs = Math.round(sorted[Math.floor(sorted.length / 2)]); // التأخير الوسيط
  cal.method = 'auto';
  return cal;
}

/**
 * المعايرة التلقائية على الشاشة: خلفية سوداء ودائرة بيضاء في كل زاوية بالتتابع.
 * @param {import('./tracker.js').HandTracker} tracker
 * @param {HTMLElement} root
 */
export async function autoCalibrate(tracker, root, { onProgress } = {}) {
  const ov = makeOverlay(root, '#000');
  const label = document.createElement('div');
  label.className = 'calib-label';
  label.textContent = 'معايرة… ابتعدوا عن السبورة';
  ov.appendChild(label);
  const r = Math.round(Math.min(innerWidth, innerHeight) * 0.06);
  const targets = [...MARKERS, CHECK];
  let current = null;
  try {
    return await runAutoCalibration({
      grab: () => tracker.grabGray(320),
      show: (i) => (current = spot(ov, targets[i], r)),
      hide: () => current?.remove(),
      sleep,
      now: () => performance.now(),
      aspect: innerWidth / innerHeight,
      targets,
      onProgress,
    });
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
  const before = tracker.grabGray(160);
  const ov = makeOverlay(root, '#fff');
  const r = Math.round(Math.min(innerWidth, innerHeight) * 0.05);
  MARKERS.forEach((p, i) => {
    const s = spot(ov, p, r, colors[i]);
    s.textContent = String(i + 1);
    s.classList.add('numbered');
  });
  // ننتظر وصول العلامات إلى السبورة (يختلف تأخير الانعكاس بين HDMI وApple TV وMiracast وiProjection):
  // تتغيّر الصورة عمّا قبلها ثم تثبت، أو تمضي ٦ ثوانٍ
  const t0 = performance.now();
  let prev = null;
  let changed = false;
  let calm = 0;
  await sleep(400);
  while (performance.now() - t0 < MAX_WAIT_MS) {
    const cur = tracker.grabGray(160);
    if (!cur || !before) break;
    if (!changed && meanAbsDiff(before, cur) > 6) changed = true;
    calm = changed && prev && meanAbsDiff(prev, cur) < 2.5 ? calm + 1 : 0;
    if (calm >= 2) break;
    prev = cur;
    await sleep(200);
  }
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
