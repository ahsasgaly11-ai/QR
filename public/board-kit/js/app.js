// ---------------------------------------------------------------------------
// غلاف لعبة السبورة: يبني المسرح والكاميرا المخفية وأدوات المعلم ولوحة الإعدادات،
// ويربط الكاميرا ↔ المتتبّع ↔ محرّك التفاعل ↔ اللعبة. كل لعبة جديدة تكتفي بـ:
//
//   import { startBoardApp } from '../../board-kit/js/app.js';
//   import { Game } from './game.js';
//   startBoardApp({ appId: 'my-game', title: 'اسم اللعبة', createGame: (els) => new Game(els) });
//
// عقد اللعبة (Game) — راجع board-kit/README_AR.md:
//   VW, VH, scale        أبعاد المسرح بوحدة u (VH = 1000 دائمًا)، والبكسل لكل u
//   input                يضبطه الغلاف: محرّك التفاعل (input.cursors…)
//   setSettings(s)       إعدادات الجهاز (reachTop, sideInset, …)
//   render()             يرسم الشاشة الحالية (يُستدعى عند تغيّر الحجم والإعدادات)
//   targets()            الأهداف: {id, kind:'button'|'card'|'slot', rect|{x,y,r}, enabled, team?, accepts?}
//   setHovered(ids)      إبراز الأهداف التي تحت الأيدي
//   press(c, t)          لمس زر أو بطاقة (c.holding/c.team يضبطهما للالتقاط)
//   drop(c, t)           إفلات ما تحمله اليد c على الخانة t
//   cancel(c)            ضاع ما تحمله اليد (اختفت طويلًا أو أُفلت خارج الخانات)
//   heldIcon(id, team)   رسم SVG للعنصر المحمول تحت اليد
//   toMenu()             زر «القائمة» في أدوات المعلم
//   tickClock()          اختياري: يُستدعى ٤ مرات في الثانية (مؤقت)
// ---------------------------------------------------------------------------
import { Interaction } from './input.js';
import { HandTracker } from './tracker.js';
import { autoCalibrate, manualCalibrate } from './calibrate.js';
import { loadSettings, saveSettings } from './settings.js';
import { QUALITY } from './tracking.js';
import { unlock, setSound, setSpeech } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';

const PANEL_HTML = ({ speechLabel, reachLabel }) => `
  <div class="panel-head">
    <h2>الكاميرا والإعدادات</h2>
    <button id="btnClose" class="tbtn" aria-label="إغلاق">✕</button>
  </div>
  <p id="panelMsg" class="panel-msg" aria-live="polite"></p>

  <section>
    <h3>١. الكاميرا <span id="camStatus" data-state="off"><span id="camText">الكاميرا متوقفة</span></span></h3>
    <p class="help">ثبّت الجهاز (آيباد أو هاتف بالوضع الأفقي) على حامل في <b>زاوية جانبية قريبة من السبورة</b>، ووجّه الكاميرا الخلفية لترى الصورة المعروضة كاملة. <b>لا تضعه على طاولة خلف الطلاب</b>: أجسامهم تحجب أيديهم، والبُعد يُصغّر أيديهم على الكاميرا.</p>
    <svg class="placement" viewBox="0 0 320 150" role="img" aria-label="مكان الجهاز: في زاوية جانبية قريبة من السبورة، لا خلف الطلاب">
      <rect x="40" y="10" width="240" height="14" rx="3" fill="#e2d5bd"/>
      <text x="160" y="21" text-anchor="middle" font-size="10" fill="#5f0d26">السبورة</text>
      <circle cx="120" cy="45" r="11" fill="#cbd5e1"/><circle cx="185" cy="48" r="11" fill="#cbd5e1"/>
      <text x="152" y="72" text-anchor="middle" font-size="9" fill="#57534e">الطلاب</text>
      <rect x="282" y="34" width="22" height="15" rx="3" fill="#15803d" transform="rotate(-35 293 41)"/>
      <path d="M284 34 L250 18 M284 34 L262 54" stroke="#15803d" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>
      <text x="292" y="72" text-anchor="middle" font-size="10" fill="#15803d" font-weight="700">✓ هنا</text>
      <rect x="143" y="118" width="24" height="16" rx="3" fill="#b91c1c"/>
      <text x="155" y="146" text-anchor="middle" font-size="10" fill="#b91c1c" font-weight="700">✗ لا: خلف الطلاب</text>
      <path d="M155 116 L155 62" stroke="#b91c1c" stroke-width="1.5" stroke-dasharray="3 3"/>
    </svg>
    <div class="row">
      <select id="camSelect" aria-label="اختيار الكاميرا"></select>
      <button id="btnCam" class="btn">تشغيل الكاميرا</button>
    </div>
    <div class="row">
      <button id="btnPreview" class="btn ghost">إظهار معاينة الكاميرا</button>
      <span id="fps" class="muted" dir="rtl"></span>
    </div>
    <p class="help warn">المعاينة تظهر على السبورة أيضًا (لأن الشاشة منعكسة)؛ استعملها لضبط الحامل فقط ثم أخفِها.</p>
    <canvas id="preview" hidden data-on="0"></canvas>
  </section>

  <section>
    <h3>٢. المعايرة</h3>
    <p class="help">تربط ما تراه الكاميرا بمكانه على السبورة. أعدها كلما تحرّك الحامل. ابتعدوا عن السبورة أثناءها (٨ ثوانٍ تقريبًا). المعايرة مشتركة بين كل ألعاب السبورة على هذا الجهاز.</p>
    <div class="row">
      <button id="btnAuto" class="btn primary">معايرة تلقائية</button>
      <button id="btnManual" class="btn ghost">معايرة يدوية</button>
    </div>
    <p id="calResult" class="cal-result"></p>
  </section>

  <section>
    <h3>٣. اللعب</h3>
    <label class="field">مدة إبقاء اليد <output id="dwellVal"></output>
      <input id="dwell" type="range" min="400" max="1500" step="50">
    </label>
    <label class="field">${reachLabel} <output id="reachVal"></output>
      <input id="reach" type="range" min="0" max="45" step="1">
    </label>
    <label class="field">دقة تتبّع اليد
      <select id="quality">
        <option value="normal">عادية — أسرع، للأجهزة القديمة</option>
        <option value="high">عالية — تكبير منطقة السبورة</option>
        <option value="max">قصوى — مسح وتركيز على كل يد (مستحسنة لأيدي الصغار)</option>
      </select>
    </label>
    <p id="qualityNote" class="help warn"></p>
    <label class="field">إبعاد البطاقات عن طرفي الصورة <output id="sideVal"></output>
      <input id="side" type="range" min="0" max="20" step="1">
    </label>
    <fieldset class="field">
      <legend>نقطة اللمس</legend>
      <label><input type="radio" name="handPoint" value="palm"> منتصف الكف (أثبت)</label>
      <label><input type="radio" name="handPoint" value="finger"> طرف السبابة (أدق للأيدي الصغيرة)</label>
    </fieldset>
    <label class="check"><input id="optHands" type="checkbox"> إظهار دائرة اليد على السبورة</label>
    <label class="check"><input id="optSound" type="checkbox"> المؤثرات الصوتية</label>
    <label class="check"><input id="optSpeech" type="checkbox"> ${speechLabel}</label>
    <label class="check"><input id="optSim" type="checkbox"> تجربة بلا كاميرا: الماوس يتصرف كيد</label>
  </section>

  <section class="tips">
    <h3>نصائح للحصة</h3>
    <ul>
      <li>من مركز التحكم في الآيباد أو الآيفون اختر <b>انعكاس الشاشة</b> ← Apple TV (وفي أندرويد: «بث الشاشة»).</li>
      <li>أضف الصفحة إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) لتعمل بملء الشاشة.</li>
      <li>اترك الجهاز على الشاحن، وفعّل «الوصول الموجّه» حتى لا يخرج أحد من اللعبة.</li>
      <li>يمكنك أيضًا اللعب بلمس شاشة الجهاز مباشرة (بلا كاميرا).</li>
    </ul>
  </section>`;

function el(tag, attrs = {}, ns) {
  const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

/** يبني عناصر الصفحة الثابتة (لا تحتاج اللعبة إلى كتابتها في index.html). */
function buildShell({ title, speechLabel, reachLabel }) {
  // الكاميرا: عنصر فيديو مخفي — صورته لا تُعرض على الصفحة فلا تنتقل إلى السبورة
  const video = el('video', { id: 'cam', playsinline: '', muted: '', autoplay: '', 'aria-hidden': 'true' });
  const stage = el('main', { id: 'stage', 'data-screen': 'menu' });
  const board = el('svg', { id: 'board', preserveAspectRatio: 'none', 'aria-label': title }, NS);
  const hud = el('div', { id: 'hud' });
  const fx = el('svg', { id: 'fx', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, NS);
  stage.append(board, hud, fx);
  // أدوات المعلم: تُلمس على شاشة الجهاز فقط، ولا تتفاعل مع يد الطالب
  const nav = el('nav', { id: 'teacher', 'aria-label': 'أدوات المعلم' });
  nav.innerHTML = `
    <span id="camChip" class="cam-chip" data-state="off">بلا كاميرا</span>
    <button id="btnHome" class="tbtn" title="القائمة" aria-label="القائمة">⌂</button>
    <button id="btnFull" class="tbtn" title="ملء الشاشة" aria-label="ملء الشاشة">⛶</button>
    <button id="btnSettings" class="tbtn" title="الكاميرا والإعدادات" aria-label="الكاميرا والإعدادات">⚙</button>`;
  const panel = el('aside', { id: 'panel', hidden: '' });
  panel.innerHTML = PANEL_HTML({ speechLabel, reachLabel });
  const rotate = el('div', { id: 'rotate', 'aria-hidden': 'true' });
  rotate.textContent = 'أدِر الجهاز أفقيًا 🔄';
  document.body.prepend(video, stage, nav, panel, rotate);
  return { video, stage, board, hud, fx, panel };
}

/**
 * @param {{appId:string, title:string, createGame:(els:{stage,board,hud,fx})=>any,
 *          speechLabel?:string, reachLabel?:string}} o
 */
export function startBoardApp({
  appId,
  title,
  createGame,
  speechLabel = 'نطق الأسماء عند الإجابة الصحيحة',
  reachLabel = 'لا يصل الطلاب إلى أعلى السبورة؟ أنزِل منطقة اللعب',
}) {
  const shell = buildShell({ title, speechLabel, reachLabel });
  const $ = (s) => document.querySelector(s);
  const { stage, panel } = shell;
  const settings = loadSettings();
  const params = new URLSearchParams(location.search);

  const game = createGame({ stage, board: shell.board, hud: shell.hud, fx: shell.fx });
  game.setSettings(settings);
  const input = new Interaction({
    stage,
    game,
    getDwellMs: () => settings.dwellMs,
    getShowHands: () => settings.showHands,
  });
  game.input = input;

  const camStatus = $('#camStatus');
  const camChip = $('#camChip');
  const tracker = new HandTracker({
    video: shell.video,
    getHandPoint: () => settings.handPoint,
    onHands: (hands, t) => input.updateHands(hands, t),
    onStatus: (state, text) => {
      camStatus.dataset.state = state;
      camStatus.title = text;
      $('#camText').textContent = text;
      updateCamChip();
    },
    // خفّض المتتبّع الدقة تلقائيًا لبطء الجهاز: نعرض ذلك في اللوحة دون تغيير اختيار المعلم
    onQuality: () => syncPanel(),
  });
  tracker.setQuality(settings.trackQuality);
  if (settings.calibration?.H) tracker.setCalibration(settings.calibration.H);
  setSound(settings.sound);
  setSpeech(settings.speech);

  const persist = () => saveSettings(settings);

  // --------------------------------------------------------------- الحلقة
  let lastClock = 0;
  function loop(now) {
    input.frame(now);
    if (now - lastClock > 250) {
      lastClock = now;
      game.tickClock?.();
      if (!panel.hidden && $('#preview').dataset.on === '1') tracker.drawPreview($('#preview'));
      if (!panel.hidden) $('#fps').textContent = tracker.active ? `${tracker.fps} إطار/ث • ${tracker.delegate || ''}` : '';
    }
    requestAnimationFrame(loop);
  }

  // --------------------------------------------------------------- الشاشة
  let resizeT = 0;
  const rerender = (ms = 120) => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => game.render(), ms);
  };
  addEventListener('resize', () => rerender());
  // منع التكبير بالإصبعين والقائمة المنبثقة عند الضغط المطوّل
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // إبقاء الشاشة مضاءة أثناء الحصة (iOS 16.4+)
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') keepAwake();
  });
  // أول لمسة على الشاشة تفتح الصوت (شرط iOS) وقفل الإضاءة
  stage.addEventListener('pointerdown', () => {
    unlock();
    if (!wakeLock) keepAwake();
  }, { capture: true });

  // --------------------------------------------------------------- لوحة المعلم
  function updateCamChip() {
    const st = camStatus.dataset.state;
    let text = 'بلا كاميرا';
    let cls = 'off';
    if (st === 'loading') (text = 'جارٍ التشغيل…'), (cls = 'wait');
    else if (st === 'error') (text = 'خطأ في الكاميرا'), (cls = 'bad');
    else if (st === 'running') {
      if (settings.calibration?.H) (text = 'اليد جاهزة'), (cls = 'ok');
      else (text = 'تحتاج معايرة'), (cls = 'wait');
    }
    if (input.sim) (text = 'محاكاة بالماوس'), (cls = 'ok');
    camChip.textContent = text;
    camChip.dataset.state = cls;
  }

  function openPanel() {
    panel.hidden = false;
    syncPanel();
    refreshCameras();
  }
  function closePanel() {
    panel.hidden = true;
    $('#preview').dataset.on = '0';
    $('#preview').hidden = true;
    $('#btnPreview').textContent = 'إظهار معاينة الكاميرا';
  }

  const pct = (v) => Math.round(v * 100).toLocaleString('ar-EG');
  function syncPanel() {
    $('#dwell').value = settings.dwellMs;
    $('#dwellVal').textContent = `${(settings.dwellMs / 1000).toLocaleString('ar-EG')} ث`;
    $('#quality').value = settings.trackQuality;
    $('#qualityNote').textContent =
      tracker.active && tracker.effQuality !== settings.trackQuality
        ? `خُفّضت تلقائيًا إلى «${QUALITY[tracker.effQuality].label}» لأن الجهاز بطيء عليها.`
        : '';
    $('#side').value = Math.round((settings.sideInset || 0) * 100);
    $('#sideVal').textContent = settings.sideInset > 0 ? `${pct(settings.sideInset)}٪ من كل جانب` : 'بلا هامش';
    $('#reach').value = Math.round(settings.reachTop * 100);
    $('#reachVal').textContent = settings.reachTop > 0 ? `${pct(settings.reachTop)}٪ من الأعلى` : 'الشاشة كلها';
    for (const r of document.querySelectorAll('input[name=handPoint]')) r.checked = r.value === settings.handPoint;
    $('#optSound').checked = settings.sound;
    $('#optSpeech').checked = settings.speech;
    $('#optHands').checked = settings.showHands;
    $('#optSim').checked = input.sim;
    $('#btnCam').textContent = tracker.active ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا';
    const cal = settings.calibration;
    const res = $('#calResult');
    if (!cal?.H) {
      res.textContent = 'لم تُعايَر بعد.';
      res.dataset.q = 'none';
    } else {
      const when = new Date(cal.at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
      let q = '';
      if (typeof cal.error === 'number') {
        const label = cal.error < 1.5 ? 'ممتازة' : cal.error < 3 ? 'جيدة' : 'ضعيفة — أعد المعايرة أو جرّب اليدوية';
        q = ` • الدقة: ${label} (خطأ ${cal.error.toFixed(1)}٪ من العرض)`;
        res.dataset.q = cal.error < 1.5 ? 'good' : cal.error < 3 ? 'ok' : 'bad';
      } else res.dataset.q = 'ok';
      res.textContent = `معايَرة ${cal.method === 'manual' ? 'يدويًا' : 'تلقائيًا'} • ${when}${q}`;
      // السبورة صغيرة في عين الكاميرا = أيدي الأطفال صغيرة جدًا على الكاشف
      const share = tracker.boardShare();
      if (share !== null && share < 0.2) {
        res.textContent += ` • السبورة تشغل ${pct(share)}٪ فقط من صورة الكاميرا: قرّب الجهاز من السبورة.`;
        res.dataset.q = 'bad';
      }
    }
    updateCamChip();
  }

  async function refreshCameras() {
    const sel = $('#camSelect');
    try {
      const cams = await tracker.listCameras();
      sel.replaceChildren(new Option('الكاميرا الخلفية (تلقائي)', ''));
      cams.forEach((c, i) => sel.appendChild(new Option(c.label || `كاميرا ${i + 1}`, c.deviceId)));
      sel.value = cams.some((c) => c.deviceId === settings.cameraId) ? settings.cameraId : '';
    } catch {
      /* القائمة تظهر بعد السماح بالكاميرا */
    }
  }

  function msg(text, bad = false) {
    const m = $('#panelMsg');
    m.textContent = text;
    m.dataset.bad = bad ? '1' : '0';
  }

  async function startCamera() {
    try {
      const id = await tracker.start($('#camSelect').value || settings.cameraId || undefined);
      settings.cameraId = $('#camSelect').value ? id : '';
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

  $('#btnSettings').addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  $('#btnClose').addEventListener('click', closePanel);
  $('#btnHome').addEventListener('click', () => game.toMenu());
  // ملء الشاشة غير مدعوم في Safari على iPhone: نخفي الزر هناك (الحل: «إضافة إلى الشاشة الرئيسية»)
  const root = document.documentElement;
  $('#btnFull').hidden = !(root.requestFullscreen || root.webkitRequestFullscreen);
  $('#btnFull').addEventListener('click', () => {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    else (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
  });

  $('#btnCam').addEventListener('click', () => {
    unlock();
    if (tracker.active) {
      tracker.stop();
      syncPanel();
    } else startCamera();
  });
  $('#camSelect').addEventListener('change', () => {
    if (tracker.active) startCamera();
  });

  $('#btnAuto').addEventListener('click', async () => {
    if (!tracker.active) await startCamera();
    if (!tracker.active) return;
    closePanel();
    try {
      const cal = await autoCalibrate(tracker, document.body);
      settings.calibration = cal;
      tracker.setCalibration(cal.H);
      persist();
      openPanel();
      msg(
        cal.error < 3
          ? 'تمت المعايرة. جرّب: ضع يدك على السبورة وتأكّد أن الدائرة تتبعها.'
          : 'تمت المعايرة لكن الدقة ضعيفة. ثبّت الحامل وأطفئ الضوء القريب من السبورة ثم أعدها، أو استعمل المعايرة اليدوية.',
        cal.error >= 3
      );
    } catch (err) {
      openPanel();
      msg(err?.message || 'فشلت المعايرة.', true);
    }
  });

  $('#btnManual').addEventListener('click', async () => {
    if (!tracker.active) await startCamera();
    if (!tracker.active) return;
    closePanel();
    try {
      const cal = await manualCalibrate(tracker, document.body);
      openPanel();
      if (!cal) return msg('أُلغيت المعايرة اليدوية.');
      if (cal.failed) return msg(cal.failed, true);
      settings.calibration = cal;
      tracker.setCalibration(cal.H);
      persist();
      syncPanel();
      msg('تمت المعايرة اليدوية. جرّب بوضع يدك على السبورة.');
    } catch (err) {
      openPanel();
      msg(err?.message || 'فشلت المعايرة.', true);
    }
  });

  $('#btnPreview').addEventListener('click', () => {
    const p = $('#preview');
    const on = p.dataset.on !== '1';
    p.dataset.on = on ? '1' : '0';
    p.hidden = !on;
    $('#btnPreview').textContent = on ? 'إخفاء المعاينة' : 'إظهار معاينة الكاميرا';
  });

  $('#dwell').addEventListener('input', (e) => {
    settings.dwellMs = Number(e.target.value);
    persist();
    syncPanel();
  });
  $('#quality').addEventListener('change', (e) => {
    settings.trackQuality = e.target.value;
    tracker.setQuality(settings.trackQuality);
    persist();
    syncPanel();
  });
  $('#side').addEventListener('input', (e) => {
    settings.sideInset = Number(e.target.value) / 100;
    persist();
    syncPanel();
    rerender(150);
  });
  $('#reach').addEventListener('input', (e) => {
    settings.reachTop = Number(e.target.value) / 100;
    persist();
    syncPanel();
    rerender(150);
  });
  for (const r of document.querySelectorAll('input[name=handPoint]')) {
    r.addEventListener('change', () => {
      settings.handPoint = r.value;
      persist();
    });
  }
  $('#optSound').addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    setSound(settings.sound);
    persist();
  });
  $('#optSpeech').addEventListener('change', (e) => {
    settings.speech = e.target.checked;
    setSpeech(settings.speech);
    persist();
  });
  $('#optHands').addEventListener('change', (e) => {
    settings.showHands = e.target.checked;
    persist();
  });
  $('#optSim').addEventListener('change', (e) => {
    input.setSim(e.target.checked);
    updateCamChip();
  });

  // --------------------------------------------------------------- البدء
  if (params.has('sim')) input.setSim(true);
  game.render();
  updateCamChip();
  requestAnimationFrame(loop);
  // إن سبق تشغيل الكاميرا ومعايرتها على هذا الجهاز نعيد تشغيلها مباشرة (المتصفح يتذكر الإذن للموقع)
  if (settings.calibration?.H && !params.has('sim') && navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'camera' })
      .then((p) => p.state === 'granted' && startCamera())
      .catch(() => {});
  }

  // للاختبار الآلي
  const api = { game, input, tracker, settings };
  window.__board = api;
  window[`__${appId}`] = api;
  return api;
}
