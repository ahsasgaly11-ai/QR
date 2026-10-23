// ---------------------------------------------------------------------------
// «وضع السبورة» لأي لعبة HTML مرفوعة على الموقع: الكاميرا والمعايرة وتتبّع اليد
// من محرّك ألعاب السبورة نفسه (tracker.js, calibrate.js, settings.js)، ثم تحويل
// الأيدي إلى نقرات وسحب (hand-gestures.js) تُرسل إلى جسر داخل إطار اللعبة
// (HAND_SHIM في local-store.ts) يبثّها أحداث مؤشر حقيقية، فتعمل اللعبة كما لو
// لُمست شاشتها. اللعبة لا تُعدَّل، والإطار المعزول لا يحتاج صلاحيات إضافية.
//
// الاستعمال من صفحة التشغيل (activity-player.tsx):
//   const hm = await createHandMouse({ host, getFrame, onState });
//   hm.open();   // يفتح اللوحة (الكاميرا، المعايرة، مدة البقاء، نقر/سحب)
//   hm.destroy();
//
// الإحداثيات: المتتبّع يعطي موضع اليد مطبّعًا على نافذة المتصفّح (المعايرة
// تُرسم على الشاشة كلها)، فيُحوَّل إلى بكسل داخل إطار اللعبة من مستطيله.
// ---------------------------------------------------------------------------
import { HandTracker } from './tracker.js';
import { autoCalibrate, manualCalibrate } from './calibrate.js';
import { loadSettings, saveSettings } from './settings.js';
import { QUALITY } from './tracking.js';
import { HandGestures } from './hand-gestures.js';

const NS = 'http://www.w3.org/2000/svg';
export const HAND_MSG = '__qaHand';
const RING_R = 24;
const RING_LEN = 2 * Math.PI * RING_R;
const COLORS = ['#8a1538', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be185d'];
const CSS_URL = new URL('../css/hand-mouse.css', import.meta.url).href;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function ensureCss() {
  if (document.querySelector(`link[data-hm-css]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = CSS_URL;
  l.dataset.hmCss = '1';
  document.head.appendChild(l);
}

const PANEL_HTML = `
  <div class="hm-head">
    <h2>وضع السبورة: اللعب باليد</h2>
    <button class="hm-tbtn" data-a="close" aria-label="إغلاق">✕</button>
  </div>
  <p class="hm-msg" data-bad="0" aria-live="polite"></p>
  <section>
    <h3>١. الكاميرا <span class="hm-muted" data-el="camText">الكاميرا متوقفة</span></h3>
    <p class="hm-help">ثبّت الجهاز في منتصف الصف مواجهًا للسبورة مباشرة، على حامل مرتفع فوق رؤوس الطلاب، بحيث تملأ الصورة المعروضة الكادر. المعايرة مشتركة مع ألعاب السبورة الذكية على هذا الجهاز.</p>
    <div class="hm-row">
      <select data-el="camSelect" aria-label="اختيار الكاميرا"></select>
      <button class="hm-btn" data-a="cam">تشغيل الكاميرا</button>
    </div>
    <div class="hm-row">
      <button class="hm-btn ghost" data-a="preview">إظهار معاينة الكاميرا</button>
      <span class="hm-muted" data-el="fps" dir="rtl"></span>
    </div>
    <canvas class="hm-preview" data-el="preview" hidden></canvas>
  </section>
  <section>
    <h3>٢. المعايرة</h3>
    <p class="hm-help">تربط ما تراه الكاميرا بمكانه على السبورة. ابتعدوا عن السبورة أثناءها (٨ ثوانٍ تقريبًا)، وأعدها كلما تحرّك الحامل.</p>
    <div class="hm-row">
      <button class="hm-btn primary" data-a="auto">معايرة تلقائية</button>
      <button class="hm-btn ghost" data-a="manual">معايرة يدوية</button>
    </div>
    <p class="hm-cal" data-el="cal"></p>
  </section>
  <section>
    <h3>٣. التحكّم</h3>
    <fieldset class="hm-field">
      <legend>ما الذي يفعله بقاء اليد؟</legend>
      <label><input type="radio" name="hmMode" value="tap"> نقرة فقط (ألعاب الاختيار والأزرار)</label>
      <label><input type="radio" name="hmMode" value="drag"> نقرة أو سحب: ابقَ لتلتقط، تحرّك، ثم ابقَ لتُفلت</label>
    </fieldset>
    <label class="hm-field">مدة إبقاء اليد <output data-el="dwellVal"></output>
      <input data-el="dwell" type="range" min="300" max="1500" step="50">
    </label>
    <label class="hm-field">دقة تتبّع اليد
      <select data-el="quality">
        <option value="normal">عادية — أسرع، للأجهزة القديمة</option>
        <option value="high">عالية — تكبير منطقة السبورة</option>
        <option value="max">قصوى — مسح وتركيز على كل يد (مستحسنة لأيدي الصغار)</option>
      </select>
    </label>
    <label class="hm-check"><input type="checkbox" data-el="optHands"> إظهار دائرة اليد على السبورة</label>
    <label class="hm-check"><input type="checkbox" data-el="optSim"> تجربة بلا كاميرا: الماوس يتصرف كيد</label>
    <p class="hm-help warn">دقة اليد على السبورة بضعة سنتيمترات: الأزرار والعناصر الكبيرة تعمل جيدًا، أما الصغيرة جدًا والكتابة فلا.</p>
  </section>`;

/**
 * @param {{host: HTMLElement, getFrame: () => HTMLIFrameElement | null, onState?: (s: {active:boolean, calibrated:boolean}) => void}} o
 */
export async function createHandMouse({ host, getFrame, onState = () => {} }) {
  ensureCss();
  const settings = loadSettings();
  settings.handMode ||= 'tap';
  const persist = () => saveSettings(settings);

  const root = el('div', 'hm-root');
  const layer = svgEl('svg', { class: 'hm-layer', 'aria-hidden': 'true' });
  const bar = el('div', 'hm-bar');
  const chip = el('button', 'hm-chip', 'بلا كاميرا');
  chip.type = 'button';
  chip.dataset.state = 'off';
  chip.title = 'الكاميرا والإعدادات';
  const settingsBtn = el('button', 'hm-tbtn', '⚙');
  settingsBtn.type = 'button';
  settingsBtn.title = 'الكاميرا والإعدادات';
  const offBtn = el('button', 'hm-tbtn', '✋');
  offBtn.type = 'button';
  offBtn.title = 'إيقاف وضع السبورة';
  bar.append(chip, settingsBtn, offBtn);
  const panel = el('aside', 'hm-panel', PANEL_HTML);
  panel.hidden = true;
  // طبقة شفافة تلتقط الماوس فوق الإطار أثناء «المحاكاة بالماوس» فقط (الإطار يبتلع الأحداث)
  const catcher = el('div', 'hm-catch');
  catcher.hidden = true;
  root.append(catcher, layer, bar, panel);
  host.appendChild(root);
  const $ = (name) => panel.querySelector(`[data-el="${name}"]`);
  const act = (name) => panel.querySelector(`[data-a="${name}"]`);

  // الكاميرا المخفية (شرط Safari: فيديو موجود ومشغَّل)
  const video = document.createElement('video');
  Object.assign(video, { playsInline: true, muted: true, autoplay: true });
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
  root.appendChild(video);

  const gestures = new HandGestures({ dwellMs: () => settings.dwellMs, mode: () => settings.handMode });
  let hands = []; // آخر أيدٍ من المتتبّع (مطبّعة على النافذة)
  let sim = false;
  let simPos = null;
  const cursors = new Map();

  const tracker = new HandTracker({
    video,
    getHandPoint: () => settings.handPoint,
    onHands: (hs) => (hands = hs),
    onStatus: (state, text) => {
      $('camText').textContent = text;
      chip.dataset.state = state === 'running' ? (settings.calibration?.H ? 'ok' : 'wait') : state === 'loading' ? 'wait' : state === 'error' ? 'bad' : 'off';
      updateChip();
      onState({ active: tracker.active, calibrated: !!settings.calibration?.H });
    },
    onQuality: () => syncPanel(),
  });
  tracker.setQuality(settings.trackQuality);
  if (settings.calibration?.H) tracker.setCalibration(settings.calibration.H);

  function updateChip() {
    let text = 'بلا كاميرا';
    if (sim) text = 'محاكاة بالماوس';
    else if (chip.dataset.state === 'wait') text = tracker.active ? 'تحتاج معايرة' : 'جارٍ التشغيل…';
    else if (chip.dataset.state === 'bad') text = 'خطأ في الكاميرا';
    else if (chip.dataset.state === 'ok') text = 'اليد جاهزة' + (tracker.fps > 0 ? ` • ${tracker.fps.toLocaleString('ar-EG')} إطار/ث` : '');
    chip.textContent = text;
    chip.classList.toggle('slow', tracker.active && tracker.fps > 0 && tracker.fps < 10);
  }

  // ---------------------------------------------------------------- إرسال إلى اللعبة
  function post(ev) {
    const f = getFrame();
    f?.contentWindow?.postMessage({ [HAND_MSG]: ev }, '*');
  }

  /** موضع اليد (مطبّع على النافذة) ← بكسل داخل إطار اللعبة */
  function toFrame(h) {
    const f = getFrame();
    if (!f) return null;
    const r = f.getBoundingClientRect();
    const px = h.x * innerWidth - r.left;
    const py = h.y * innerHeight - r.top;
    const inside = px >= 0 && py >= 0 && px <= r.width && py <= r.height;
    // داخل الإطار يُحصر الموضع عند حافته: كف عند الطرف تبقى على العنصر الطرفي
    return { id: h.id, x: Math.max(0, Math.min(r.width, px)), y: Math.max(0, Math.min(r.height, py)), inside, rect: r };
  }

  let raf = 0;
  let lastChip = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const src = sim ? (simPos ? [{ id: 0, ...simPos }] : []) : hands;
    const mapped = src.map(toFrame).filter(Boolean);
    const events = gestures.update(mapped, now);
    for (const e of events) if (e.type !== 'leave') post({ t: e.type, id: e.id, x: e.x, y: e.y });
    draw(mapped);
    if (now - lastChip > 250) {
      lastChip = now;
      updateChip();
      if (!panel.hidden) {
        $('fps').textContent = tracker.active ? `${tracker.fps} إطار/ث • ${Math.round(tracker.inferMs)} م.ث استدلال • ${tracker.backendLabel}` : '';
        if (!$('preview').hidden) tracker.drawPreview($('preview'));
      }
    }
  }

  function draw(mapped) {
    const f = getFrame();
    const r = f?.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const show = settings.showHands;
    const alive = new Set();
    for (const c of gestures.cursors()) {
      alive.add(c.id);
      let g = cursors.get(c.id);
      if (!g) {
        g = svgEl('g', { class: 'hm-cursor' });
        const color = COLORS[c.id % COLORS.length];
        const ringBg = svgEl('circle', { r: RING_R, class: 'hm-ring-bg' });
        const ring = svgEl('circle', { r: RING_R, class: 'hm-ring', transform: 'rotate(-90)', 'stroke-dasharray': `0 ${RING_LEN}` });
        ring.style.stroke = color;
        const dot = svgEl('circle', { r: 8, class: 'hm-dot' });
        dot.style.fill = color;
        g.append(ringBg, ring, dot);
        g._ring = ring;
        layer.appendChild(g);
        cursors.set(c.id, g);
      }
      // من إحداثيات الإطار إلى إحداثيات المضيف
      const x = (r ? r.left - hr.left : 0) + c.x;
      const y = (r ? r.top - hr.top : 0) + c.y;
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      g.classList.toggle('is-down', c.down);
      g.classList.toggle('is-out', !c.inside);
      g.style.display = show ? '' : 'none';
      g._ring.setAttribute('stroke-dasharray', `${(c.progress * RING_LEN).toFixed(1)} ${RING_LEN}`);
    }
    for (const [id, g] of cursors) if (!alive.has(id)) {
      g.remove();
      cursors.delete(id);
    }
  }

  // ---------------------------------------------------------------- محاكاة بالماوس
  const onMove = (e) => {
    if (!sim) return;
    simPos = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
  };
  const onLeave = () => {
    if (sim) simPos = null;
  };
  function setSim(on) {
    sim = !!on;
    simPos = null;
    catcher.hidden = !sim;
    for (const e of gestures.reset()) post({ t: e.type, id: e.id, x: e.x, y: e.y });
    updateChip();
  }
  catcher.addEventListener('pointermove', onMove);
  catcher.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointermove', onMove);

  // ---------------------------------------------------------------- اللوحة
  const msg = (text, bad = false) => {
    const m = panel.querySelector('.hm-msg');
    m.textContent = text;
    m.dataset.bad = bad ? '1' : '0';
  };
  async function refreshCameras() {
    const sel = $('camSelect');
    try {
      const cams = await tracker.listCameras();
      sel.replaceChildren(new Option('الكاميرا الخلفية (تلقائي)', ''));
      cams.forEach((c, i) => sel.appendChild(new Option(c.label || `كاميرا ${i + 1}`, c.deviceId)));
      sel.value = cams.some((c) => c.deviceId === settings.cameraId) ? settings.cameraId : '';
    } catch {
      /* بعد السماح بالكاميرا */
    }
  }
  function syncPanel() {
    $('dwell').value = settings.dwellMs;
    $('dwellVal').textContent = `${(settings.dwellMs / 1000).toLocaleString('ar-EG')} ث`;
    $('quality').value = settings.trackQuality;
    for (const r of panel.querySelectorAll('input[name=hmMode]')) r.checked = r.value === settings.handMode;
    $('optHands').checked = settings.showHands;
    $('optSim').checked = sim;
    act('cam').textContent = tracker.active ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا';
    const cal = settings.calibration;
    const res = $('cal');
    if (!cal?.H) {
      res.textContent = 'لم تُعايَر بعد.';
      res.dataset.q = 'none';
    } else {
      const when = new Date(cal.at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
      let q = '';
      if (typeof cal.error === 'number') {
        const label = cal.error < 1.5 ? 'ممتازة' : cal.error < 3 ? 'جيدة' : 'ضعيفة — أعد المعايرة أو جرّب اليدوية';
        q = ` • الدقة: ${label}`;
        res.dataset.q = cal.error < 1.5 ? 'good' : cal.error < 3 ? 'ok' : 'bad';
      } else res.dataset.q = 'ok';
      res.textContent = `معايَرة ${cal.method === 'manual' ? 'يدويًا' : 'تلقائيًا'} • ${when}${q}`;
      if (tracker.active && tracker.effQuality !== settings.trackQuality) res.textContent += ` • خُفّضت الدقة تلقائيًا إلى «${QUALITY[tracker.effQuality].label}»`;
    }
    updateChip();
  }
  function openPanel() {
    panel.hidden = false;
    syncPanel();
    refreshCameras();
  }
  function closePanel() {
    panel.hidden = true;
    $('preview').hidden = true;
    act('preview').textContent = 'إظهار معاينة الكاميرا';
  }
  async function startCamera() {
    try {
      const id = await tracker.start($('camSelect').value || settings.cameraId || undefined);
      settings.cameraId = $('camSelect').value ? id : '';
      persist();
      refreshCameras();
      if (!settings.calibration?.H) msg('الكاميرا تعمل. الخطوة التالية: المعايرة التلقائية.');
    } catch (err) {
      console.error(err);
      tracker.onStatus('error', 'تعذّر تشغيل الكاميرا');
      const m = String(err?.message || err);
      if (m === 'nosimd') msg('هذا الجهاز قديم ولا يدعم نموذج تتبّع اليد. حدّث النظام إلى iOS/iPadOS 16.4 أو أحدث.', true);
      else if (err?.name === 'NotAllowedError') msg('رُفض إذن الكاميرا. من إعدادات المتصفح اسمح بالكاميرا لهذا الموقع ثم أعد المحاولة.', true);
      else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') msg('لم تُعثر على الكاميرا المختارة. اختر «الكاميرا الخلفية (تلقائي)».', true);
      else msg(`تعذّر التشغيل: ${m}`, true);
    }
    syncPanel();
  }
  async function calibrate(manual) {
    if (!tracker.active) await startCamera();
    if (!tracker.active) return;
    closePanel();
    try {
      const cal = manual ? await manualCalibrate(tracker, host) : await autoCalibrate(tracker, host);
      openPanel();
      if (!cal) return msg('أُلغيت المعايرة اليدوية.');
      if (cal.failed) return msg(cal.failed, true);
      settings.calibration = cal;
      tracker.setCalibration(cal.H);
      persist();
      syncPanel();
      onState({ active: tracker.active, calibrated: true });
      msg(cal.error < 3 || manual ? 'تمت المعايرة. ضع يدك على السبورة وتأكّد أن الدائرة تتبعها، ثم أغلق اللوحة والعبوا.' : 'تمت المعايرة لكن الدقة ضعيفة. ثبّت الحامل وخفّف الضوء على السبورة ثم أعدها، أو استعمل اليدوية.', !manual && cal.error >= 3);
    } catch (err) {
      openPanel();
      msg(err?.message || 'فشلت المعايرة.', true);
    }
  }

  act('close').addEventListener('click', closePanel);
  settingsBtn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  chip.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  act('cam').addEventListener('click', () => {
    if (tracker.active) {
      tracker.stop();
      syncPanel();
    } else startCamera();
  });
  $('camSelect').addEventListener('change', () => tracker.active && startCamera());
  act('auto').addEventListener('click', () => calibrate(false));
  act('manual').addEventListener('click', () => calibrate(true));
  act('preview').addEventListener('click', () => {
    const p = $('preview');
    p.hidden = !p.hidden;
    act('preview').textContent = p.hidden ? 'إظهار معاينة الكاميرا' : 'إخفاء المعاينة';
  });
  $('dwell').addEventListener('input', (e) => {
    settings.dwellMs = Number(e.target.value);
    persist();
    syncPanel();
  });
  $('quality').addEventListener('change', (e) => {
    settings.trackQuality = e.target.value;
    tracker.setQuality(settings.trackQuality);
    persist();
    syncPanel();
  });
  for (const r of panel.querySelectorAll('input[name=hmMode]')) {
    r.addEventListener('change', () => {
      settings.handMode = r.value;
      persist();
      for (const e of gestures.reset()) post({ t: e.type, id: e.id, x: e.x, y: e.y });
    });
  }
  $('optHands').addEventListener('change', (e) => {
    settings.showHands = e.target.checked;
    persist();
  });
  $('optSim').addEventListener('change', (e) => setSim(e.target.checked));

  // ---------------------------------------------------------------- التشغيل
  raf = requestAnimationFrame(frame);
  const api = {
    open: openPanel,
    close: closePanel,
    setSim,
    get tracker() {
      return tracker;
    },
    get gestures() {
      return gestures;
    },
    settings,
    /** يبدأ الكاميرا مباشرة (بعد نقرة المستخدم) إن سبقت معايرة الجهاز. */
    async autoStart() {
      if (settings.calibration?.H && !sim) await startCamera();
      else openPanel();
    },
    destroy() {
      cancelAnimationFrame(raf);
      for (const e of gestures.reset()) post({ t: e.type, id: e.id, x: e.x, y: e.y });
      tracker.stop();
      document.removeEventListener('pointermove', onMove);
      root.remove();
      onState({ active: false, calibrated: !!settings.calibration?.H });
    },
  };
  offBtn.addEventListener('click', () => api.onOff?.());
  window.__handMouse = api;
  return api;
}
