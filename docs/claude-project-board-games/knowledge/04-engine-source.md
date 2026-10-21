# مصدر محرّك board-kit كاملًا (مولَّد 2026-10-21)
للاطلاع فقط: الألعاب **تستورد** هذه الوحدات من `/board-kit/js/…` ولا تنسخها ولا تعدّلها.
إن احتاجت لعبة سلوكًا عامًّا جديدًا فاقترح تعديل المحرّك صراحة (مع اختباراته) بدل الالتفاف عليه في اللعبة.

> **مستوى الرسوميات لكل لعبة يحدّده الملف 10** (تقنية «دانة الصف» و«مختبر العدسة المكبّرة»): three.js الكلاسيكي (`three.module.min.js` مع `three/addons/`)، وإضاءة بيئية PMREM، ومواد فيزيائية، وعالم بالمظلِّلات، و`EffectComposer` للتوهّج والتدرّج اللوني. أي عبارة هنا تقدّم WebGPU على أنه المسار الأساسي، أو تمنع `ShaderMaterial` و`EffectComposer`، يحلّ محلّها الملف 10. مثال مطبَّق: `public/germ-hunters/`.

## `public/board-kit/js/app.js`

```js
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
    <h3>عرض الشاشة على جهاز العرض (أي طريقة تكفي)</h3>
    <ul>
      <li><b>هاتف أندرويد:</b> «بث الشاشة» / Screen Mirroring مباشرة إلى جهاز العرض (Miracast مدمج في أجهزة Epson التفاعلية)، بلا أي جهاز إضافي.</li>
      <li><b>آيفون أو آيباد بلا Apple TV:</b> تطبيق <b>Epson iProjection</b> المجاني ← اتصل بجهاز العرض (على شبكة Wi-Fi نفسها، أو بمسح رمز QR المعروض) ← «Mirror device screen»، ثم ارجع إلى Safari.</li>
      <li><b>مع Apple TV:</b> مركز التحكم ← انعكاس الشاشة ← Apple TV.</li>
      <li><b>بكابل:</b> محوّل USB-C أو Lightning إلى HDMI ← منفذ HDMI في جهاز العرض (أسرع طريقة وبلا تأخير).</li>
      <li>المعايرة تقيس تأخير الانعكاس تلقائيًا وتعمل مع كل الطرق؛ إن كان التأخير كبيرًا فزِد «مدة إبقاء اليد».</li>
    </ul>
    <h3>نصائح للحصة</h3>
    <ul>
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
      // تأخير انعكاس الشاشة (يُقاس في المعايرة التلقائية): تطبيق iProjection عبر Wi-Fi أبطأ من الكابل أو Apple TV
      if (typeof cal.latencyMs === 'number') {
        res.textContent += ` • تأخير الانعكاس ${(cal.latencyMs / 1000).toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ث`;
        if (cal.latencyMs > 700) res.textContent += ' (كبير: زِد «مدة إبقاء اليد» قليلًا، أو استعمل كابل HDMI أو Screen Mirroring)';
      }
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
```

## `public/board-kit/js/input.js`

```js
// ---------------------------------------------------------------------------
// محرّك التفاعل: يوحّد ثلاثة مصادر للمؤشرات في منطق واحد:
//   • يد الطالب على السبورة (من الكاميرا): «اللمس بالبقاء» — تبقى اليد على
//     الهدف مدة قصيرة فتمتلئ حلقة حولها ثم يُنفَّذ الفعل. الكاميرا لا تعرف هل
//     لامست اليد السبورة أم اقتربت منها، فالبقاء هو ما يميّز النية عن المرور.
//   • لمس شاشة الجهاز أو الماوس: فوري (ضغط، سحب، إفلات).
//   • محاكاة اليد بالماوس (للتجربة دون كاميرا): الماوس يتصرف كيد بالضبط.
//
// السن «المركون»: إن اختفت اليد الحاملة لسنّ (حجبها جسم الطفل أو صغرت عن
// الكاميرا) لا يعود السن فورًا؛ يبقى مكانه بضع ثوانٍ مع دائرة نابضة، وأول يد
// تظهر قربه تلتقطه وتكمل السحب.
//
// اللعبة تعرّف «الأهداف» (بطاقات، أزرار، خانات)، والمحرّك يقرر أي هدف تحت كل
// مؤشر ومتى يُنفَّذ، ثم يستدعي game.press / game.drop / game.cancel.
// ---------------------------------------------------------------------------
import { TRACK_TTL_MS } from './tracker.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_R = 30;
const RING_LEN = 2 * Math.PI * RING_R;
const HAND_COLORS = ['#8a1538', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be185d'];
/** بعد هذه المدة بلا رؤية يُعدّ السن المحمول «مركونًا». */
const PARK_AFTER_MS = 250;
/** أقصى مدة يبقى فيها السن مركونًا قبل أن يعود إلى بطاقته. */
export const PARK_MS = 4000;
/** نطاق التقاط السن المركون (بوحدات المسرح u)، ويتّسع مع الوقت. */
const ADOPT_R0 = 150;
const ADOPT_R1 = 330;

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export class Interaction {
  /**
   * @param {{stage: HTMLElement, game: any, getDwellMs: ()=>number, getShowHands: ()=>boolean}} o
   */
  constructor({ stage, game, getDwellMs, getShowHands }) {
    this.stage = stage;
    this.game = game;
    this.getDwellMs = getDwellMs;
    this.getShowHands = getShowHands;
    /** @type {Map<string, any>} */
    this.cursors = new Map();
    this.layer = null;
    this.hovered = new Set();
    this.sim = false; // محاكاة اليد بالماوس
    this.simPos = null;
    this._colorIdx = 0;
    this._bindPointer();
  }

  /** يُستدعى بعد كل إعادة رسم للعبة: طبقة المؤشرات فوق كل شيء. */
  attachLayer(layer) {
    this.layer = layer;
    for (const c of this.cursors.values()) c.g = null;
  }

  // ---------------------------------------------------------------- الأيدي
  /**
   * @param {{id:number,x:number,y:number}[]} hands إحداثيات مطبّعة على نافذة الصفحة كلها
   * (المعايرة تُرسم على النافذة، والمسرح قد يصغر عنها بحواف الشاشة الآمنة في الهواتف).
   */
  updateHands(hands, t) {
    const { VW, VH } = this.game;
    const r = this.stage.getBoundingClientRect();
    for (const h of hands) {
      const key = `h${h.id}`;
      let c = this.cursors.get(key);
      if (!c) {
        c = this._newCursor(key, 'hand');
        this.cursors.set(key, c);
      }
      // يُحصر المؤشر داخل المسرح: كف عند الحافة الطرفية يبقى فوق البطاقة الطرفية
      const x = ((h.x * innerWidth - r.left) / r.width) * VW;
      const y = ((h.y * innerHeight - r.top) / r.height) * VH;
      c.x = Math.max(0, Math.min(VW, x));
      c.y = Math.max(0, Math.min(VH, y));
      c.seen = t;
      if (c.parked) c.parked = false;
    }
  }

  _newCursor(key, source) {
    return {
      key,
      source,
      x: 0,
      y: 0,
      seen: performance.now(),
      holding: null,
      team: null, // فريق السن المحمول: لا يوضع إلا في فك فريقه
      born: performance.now(),
      parked: false,
      dwellId: null,
      dwellStart: 0,
      consumed: null, // آخر هدف نُفّذ عليه فعل؛ لا يتكرر حتى تغادره اليد
      progress: 0,
      color: HAND_COLORS[this._colorIdx++ % HAND_COLORS.length],
      g: null,
    };
  }

  // ---------------------------------------------------------------- الأهداف
  /** المسافة إلى الهدف (0 داخل المستطيل)، أو Infinity خارجه. `grow` يوسّع الهدف (لليد ولثبات البقاء). */
  _hit(t, x, y, grow = 0) {
    if (t.rect) {
      const { x: rx, y: ry, w, h } = t.rect;
      const pad = (t.pad ?? 12) + grow;
      const dx = Math.max(rx - pad - x, 0, x - (rx + w + pad));
      const dy = Math.max(ry - pad - y, 0, y - (ry + h + pad));
      return dx === 0 && dy === 0 ? 0 : Infinity;
    }
    const d = Math.hypot(t.x - x, t.y - y);
    return d <= t.r * (1 + grow / 60) ? d : Infinity;
  }

  /**
   * هل يقبل الهدف ما تحمله اليد؟ للخانة أن تعرّف accepts(c) بنفسها، وإلا فخانة لها
   * فريق (team) لا تقبل إلا ما التُقط من بطاقات الفريق نفسه.
   */
  _accepts(c, t) {
    if (t.kind !== 'slot') return true;
    if (typeof t.accepts === 'function') return t.accepts(c);
    return !c.team || c.team === 'all' || !t.team || t.team === 'all' || t.team === c.team;
  }

  /** أقرب هدف مناسب لحالة المؤشر. */
  targetFor(c) {
    const targets = this.game.targets();
    const hand = c.source !== 'pointer';
    // ثبات البقاء: يبقى الهدف الحالي ما دامت اليد قريبة منه، وإن صارت خانة مجاورة أقرب قليلًا
    if (hand && c.dwellId) {
      const cur = targets.find((t) => t.id === c.dwellId && t.enabled !== false);
      if (cur && this._accepts(c, cur) && this._hit(cur, c.x, c.y, 22) < Infinity) return cur;
    }
    let best = null;
    let bestD = Infinity;
    const kinds = c.holding ? ['slot', 'card'] : ['card', 'button'];
    for (const kind of kinds) {
      for (const t of targets) {
        if (t.kind !== kind || t.enabled === false || !this._accepts(c, t)) continue;
        const d = this._hit(t, c.x, c.y, hand ? 10 : 0);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best) return best; // الخانات أولًا حين تحمل اليد سنًّا
    }
    return null;
  }

  // ---------------------------------------------------------------- كل إطار
  frame(now) {
    const dwell = this.getDwellMs();
    if (this.sim && this.simPos) this.updateHands([{ id: 0, ...this.simPos }], now);
    this.hovered.clear();
    for (const [key, c] of this.cursors) {
      if (c.source === 'pointer') {
        if (c.holding) {
          const t = this.targetFor(c);
          if (t?.kind === 'slot') this.hovered.add(t.id);
        }
        continue;
      }
      const lost = now - c.seen;
      if (c.holding) {
        // اختفت اليد الحاملة: يُركن السن مكانه، ويعود إلى بطاقته إن طال الغياب
        if (lost > PARK_MS) {
          this.game.cancel(c);
          c.g?.remove();
          this.cursors.delete(key);
          continue;
        }
        if (lost > PARK_AFTER_MS) {
          c.parked = true;
          c.dwellId = null;
          c.progress = 0;
          continue;
        }
      } else if (lost > TRACK_TTL_MS) {
        c.g?.remove();
        this.cursors.delete(key);
        continue;
      }
      if (!c.holding) this._adopt(c, now);
      const t = this.targetFor(c);
      const id = t?.id ?? null;
      if (c.consumed && c.consumed !== id) c.consumed = null;
      if (id && c.consumed !== id) this.hovered.add(id);
      if (!id || c.consumed === id) {
        c.dwellId = null;
        c.progress = 0;
        continue;
      }
      if (c.dwellId !== id) {
        c.dwellId = id;
        c.dwellStart = now;
      }
      // الإفلات على خانة أسرع قليلًا من الالتقاط: اليد تكون قد استقرت بعد الحركة
      const need = c.holding && t.kind === 'slot' ? dwell * 0.85 : dwell;
      c.progress = Math.min(1, (now - c.dwellStart) / need);
      if (c.progress >= 1) {
        c.progress = 0;
        c.dwellId = null;
        c.consumed = id;
        this._fire(c, t);
      }
    }
    this.game.setHovered(this.hovered);
    this._draw(now);
  }

  /** يد ظهرت قرب سن مركون تلتقطه (غالبًا اليد نفسها بعد حجب، بهوية جديدة). */
  _adopt(c, now) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.cursors.values()) {
      if (!p.parked || !p.holding || p === c) continue;
      if (c.born < p.seen) continue; // يد كانت ظاهرة قبل الركن ليست اليد المفقودة
      const r = ADOPT_R0 + (ADOPT_R1 - ADOPT_R0) * Math.min(1, (now - p.seen) / 2000);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < r && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (!best) return;
    c.holding = best.holding;
    c.team = best.team;
    c.consumed = null;
    c.dwellId = null;
    best.holding = null;
    best.g?.remove();
    this.cursors.delete(best.key);
  }

  _fire(c, t) {
    if (c.holding) {
      if (t.kind === 'slot') this.game.drop(c, t);
      else if (t.kind === 'card') this.game.press(c, t); // تبديل السن أو إعادته
    } else {
      this.game.press(c, t);
    }
  }

  // ---------------------------------------------------------------- الرسم
  _draw(now) {
    if (!this.layer) return;
    const show = this.getShowHands();
    for (const c of this.cursors.values()) {
      if (!c.g) {
        c.g = svgEl('g', { class: `cursor ${c.source}` });
        c.held = svgEl('g', { class: 'held' });
        c.ringBg = svgEl('circle', { r: RING_R, class: 'ring-bg' });
        c.ring = svgEl('circle', {
          r: RING_R,
          class: 'ring',
          'stroke-dasharray': `0 ${RING_LEN}`,
          transform: 'rotate(-90)',
        });
        c.dot = svgEl('circle', { r: 9, class: 'dot' });
        c.ring.style.stroke = c.color;
        c.dot.style.fill = c.color;
        c.g.append(c.held, c.ringBg, c.ring, c.dot);
        this.layer.appendChild(c.g);
        c.heldType = null;
      }
      if (c.heldType !== c.holding) {
        c.held.replaceChildren();
        if (c.holding) c.held.appendChild(this.game.heldIcon(c.holding, c.team));
        c.heldType = c.holding;
      }
      c.g.classList.toggle('parked', !!c.parked);
      const stale = c.source === 'hand' && now - c.seen > 160;
      c.g.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
      c.g.style.opacity = c.source === 'pointer' ? (c.holding ? '1' : '0') : c.parked ? '0.8' : stale ? '0.35' : '1';
      const ringVisible = c.source !== 'pointer' && (show || c.holding);
      c.ringBg.style.display = ringVisible ? '' : 'none';
      c.ring.style.display = ringVisible ? '' : 'none';
      c.dot.style.display = c.source !== 'pointer' && show ? '' : 'none';
      c.ring.setAttribute('stroke-dasharray', `${(c.progress * RING_LEN).toFixed(1)} ${RING_LEN}`);
    }
  }

  // ---------------------------------------------------------------- اللمس والماوس
  _toView(e) {
    const r = this.stage.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.game.VW,
      y: ((e.clientY - r.top) / r.height) * this.game.VH,
    };
  }

  _bindPointer() {
    const stage = this.stage;
    stage.addEventListener('pointerdown', (e) => {
      if (this.sim && e.pointerType === 'mouse') return;
      const p = this._toView(e);
      const key = `p${e.pointerId}`;
      const c = this._newCursor(key, 'pointer');
      Object.assign(c, p);
      this.cursors.set(key, c);
      const t = this.targetFor(c);
      if (t) this.game.press(c, t);
      if (c.holding) stage.setPointerCapture?.(e.pointerId);
      else this.cursors.delete(key);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (this.sim && e.pointerType === 'mouse') {
        this.simPos = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
        return;
      }
      const c = this.cursors.get(`p${e.pointerId}`);
      if (!c) return;
      Object.assign(c, this._toView(e));
    });
    const end = (e, cancelled) => {
      const key = `p${e.pointerId}`;
      const c = this.cursors.get(key);
      if (!c) return;
      if (c.holding) {
        const t = cancelled ? null : this.targetFor(c);
        if (t?.kind === 'slot') this.game.drop(c, t);
        else this.game.cancel(c);
      }
      c.g?.remove();
      this.cursors.delete(key);
    };
    stage.addEventListener('pointerleave', (e) => {
      if (this.sim && e.pointerType === 'mouse') this.simPos = null;
    });
    stage.addEventListener('pointerup', (e) => end(e, false));
    stage.addEventListener('pointercancel', (e) => end(e, true));
  }

  setSim(on) {
    this.sim = !!on;
    if (!on) this.simPos = null;
  }

  /** يُستدعى عند تغيير الشاشة: تُلغى كل الأسنان المحمولة. */
  reset() {
    for (const c of this.cursors.values()) {
      c.holding = null;
      c.team = null;
      c.consumed = null;
      c.dwellId = null;
      c.g?.remove();
      c.g = null;
    }
    for (const [k, c] of this.cursors) if (c.source === 'pointer' || c.parked) this.cursors.delete(k);
  }
}
```

## `public/board-kit/js/audio.js`

```js
// ---------------------------------------------------------------------------
// الأصوات: مؤثرات مُركّبة بـ Web Audio (لا ملفات)، ونطق اسم السن بالعربية.
// على iOS لا يعمل الصوت إلا بعد لمسة من المستخدم، فيُستدعى unlock() من أول زر.
// الصوت ينتقل مع انعكاس الشاشة (Apple TV، أو Screen Mirroring، أو iProjection، أو HDMI) إلى سمّاعة جهاز العرض.
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let enabled = true;
let speechEnabled = true;
let arVoice = null;

export function setSound(on) {
  enabled = !!on;
}
export function setSpeech(on) {
  speechEnabled = !!on;
}

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
  pickVoice();
}

function tone(freq, start, dur, { type = 'sine', gain = 0.6, slideTo = null } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  pick() {
    tone(520, 0, 0.12, { type: 'triangle', gain: 0.4, slideTo: 780 });
  },
  hover() {
    tone(900, 0, 0.05, { type: 'sine', gain: 0.12 });
  },
  correct() {
    tone(660, 0, 0.16, { type: 'triangle', gain: 0.5 });
    tone(990, 0.11, 0.24, { type: 'triangle', gain: 0.45 });
  },
  wrong() {
    tone(220, 0, 0.22, { type: 'sawtooth', gain: 0.22, slideTo: 150 });
  },
  back() {
    tone(500, 0, 0.14, { type: 'sine', gain: 0.25, slideTo: 320 });
  },
  click() {
    tone(740, 0, 0.07, { type: 'square', gain: 0.12 });
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'triangle', gain: 0.4 }));
  },
};

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const choose = () => {
    const voices = window.speechSynthesis.getVoices();
    arVoice = voices.find((v) => /^ar(-|_|$)/i.test(v.lang)) || null;
  };
  choose();
  if (!arVoice) window.speechSynthesis.addEventListener?.('voiceschanged', choose, { once: true });
}

/** ينطق نصًا عربيًا قصيرًا (اسم السن). يتجاهل الطلب إن لم يوجد صوت عربي. */
export function say(text) {
  if (!speechEnabled || !('speechSynthesis' in window) || !arVoice) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = arVoice;
    u.lang = arVoice.lang;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* النطق ميزة إضافية؛ فشلها لا يوقف اللعبة */
  }
}
```

## `public/board-kit/js/settings.js`

```js
// ---------------------------------------------------------------------------
// إعدادات الجهاز: تُحفظ في متصفّح الجهاز (localStorage) وتشترك فيها كل ألعاب
// السبورة على الموقع نفسه — فالمعايرة تُجرى مرة واحدة للصف وتصلح لكل لعبة ما
// دام الحامل في مكانه. كل قراءة وكتابة محميّة لأن التخزين قد يكون معطّلًا
// (التصفّح الخاص)؛ عندها تعمل اللعبة بالقيم الافتراضية.
// ---------------------------------------------------------------------------

const KEY = 'board-kit.settings.v1';
/** مفاتيح ألعاب قديمة كانت تحفظ إعداداتها وحدها: تُنقل مرة واحدة. */
const LEGACY_KEYS = ['asnan.settings.v1'];

export const DEFAULTS = {
  dwellMs: 700, // مدة إبقاء اليد لالتقاط عنصر أو إسقاطه
  handPoint: 'palm', // palm = منتصف الكف، finger = طرف السبابة
  reachTop: 0, // نسبة أعلى الشاشة المحجوزة للعناوين فقط (0..0.45) حين لا يصل الطلاب للأعلى
  sideInset: 0, // هامش جانبي (0..0.2 من العرض) يُبعد البطاقات عن طرفي الصورة
  trackQuality: 'max', // normal | high | max: تكبير منطقة السبورة لأيدي الأطفال الصغيرة (تنخفض تلقائيًا للأجهزة البطيئة)
  sound: true,
  speech: true,
  showHands: true, // إظهار مؤشر اليد على الجدار
  cameraId: '', // آخر كاميرا اختيرت
  calibration: null, // { cam: [{x,y}×4] مطبّعة, screen: [{x,y}×4] مطبّعة, H, at, error }
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadSettings() {
  let saved = read(KEY);
  if (!saved) {
    for (const k of LEGACY_KEYS) {
      saved = read(k);
      if (saved) break;
    }
  }
  return { ...DEFAULTS, ...(saved || {}) };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين غير متاح: تبقى الإعدادات لهذه الجلسة فقط */
  }
}
```

## `public/board-kit/js/tracker.js`

```js
// ---------------------------------------------------------------------------
// متتبّع الأيدي: كاميرا الجهاز ← MediaPipe Hand Landmarker ← مصفوفة المعايرة
// ← مؤشرات على الشاشة.
//
// الكاميرا تعمل في عنصر فيديو مخفي؛ صورتها لا تُرسم على الصفحة أبدًا (إلا في
// معاينة لوحة المعلم عند طلبها)، فلا تظهر في انعكاس الشاشة على السبورة.
//
// لأيدي الأطفال الصغيرة والبعيدة: بعد المعايرة نقصّ منطقة السبورة من الإطار
// ونقسمها إلى بلاطات، لكل بلاطة كاشف مستقل (يحتفظ بتتبّعه بين الإطارات)، ثم
// تُدمج الأيدي وتُطابق هويتها عبر الإطارات (راجع tracking.js).
// ---------------------------------------------------------------------------
import { applyH, invert3 } from './geometry.js';
import { boardRoi, makeTiles, mergeDetections, focusCrop, HandMatcher, QUALITY, QUALITY_ORDER } from './tracking.js';

const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;
const MODEL = new URL('../models/hand_landmarker.task', import.meta.url).href;

/** بعد هذه المدة بلا رؤية تختفي دائرة اليد الفارغة (اليد الحاملة لسنّ تبقى أطول، راجع input.js). */
export const TRACK_TTL_MS = 900;
const HANDS_PER_TILE = 4;
const MAX_TILE_SIDE = 1280;
const MAX_CROP_SIDE = 640; // نوافذ «المسح والتركيز» صغيرة أصلًا
const MAX_FOCUS = 6;
const FOCUS_KEEP_MS = 450; // تبقى نافذة التركيز مكان اليد المفقودة لحظة (حجب قصير)

// معالم اليد في MediaPipe: 0 الرسغ، 5/9/13/17 قواعد الأصابع، 8 طرف السبابة.
const PALM = [0, 5, 9, 13, 17];
const INDEX_TIP = 8;

export class HandTracker {
  /**
   * @param {{video: HTMLVideoElement, onHands: (hands:{id:number,x:number,y:number}[], t:number)=>void,
   *          onStatus?: (state:string, text:string)=>void, getHandPoint: ()=>'palm'|'finger',
   *          onQuality?: (q:string)=>void}} o
   */
  constructor({ video, onHands, onStatus, getHandPoint, onQuality }) {
    this.video = video;
    this.onHands = onHands;
    this.onStatus = onStatus || (() => {});
    this.onQuality = onQuality || (() => {});
    this.getHandPoint = getHandPoint;
    this.api = null; // { fileset, HandLandmarker }
    this.detectors = []; // [{ lm, canvas, ctx }] كاشف «فيديو» لكل بلاطة
    this.imageLm = null; // كاشف «صور» واحد لوضع المسح والتركيز
    this.focus = []; // الأيدي التي تتبعها نوافذ التركيز
    this.scanIdx = 0;
    this._cropCanvas = null;
    this.lastCrops = [];
    this.stream = null;
    this.H = null;
    this.quality = 'max';
    this.effQuality = 'max'; // قد تنخفض تلقائيًا إن كان الجهاز بطيئًا
    this.tiles = [{ x: 0, y: 0, w: 1, h: 1 }];
    this.roi = { x: 0, y: 0, w: 1, h: 1 };
    this.matcher = new HandMatcher();
    this.running = false;
    this.lastTs = 0;
    this.lastVideoTime = -1;
    this.fps = 0;
    this._fpsCount = 0;
    this._fpsT = 0;
    this._slowSecs = 0;
    this._layoutAt = 0;
    this.lastHands = []; // آخر معالم بإحداثيات الكاميرا (للمعاينة)
    this.delegate = null;
    this.forceCpu = false;
    this._errors = 0;
    this._busy = false;
  }

  setCalibration(H) {
    this.H = H || null;
    this.matcher.clear();
    this._layout();
  }

  /** @param {'normal'|'high'|'max'} q */
  setQuality(q) {
    if (!QUALITY[q]) return;
    this.quality = q;
    this.effQuality = q;
    this._slowSecs = 0;
    this._layout();
  }

  get active() {
    return !!this.stream;
  }

  _layout() {
    this._layoutAt = performance.now();
    this._slowSecs = 0;
    if (!this.H) {
      this.roi = { x: 0, y: 0, w: 1, h: 1 };
      this.tiles = [this.roi];
      return;
    }
    this.roi = boardRoi(this.H, 0.1);
    const { cols, rows, smart } = QUALITY[this.effQuality];
    // البلاطات تُبنى بالبكسل الحقيقي: نسبة الإطار تؤثر في شكلها
    this.tiles = makeTiles(this.roi, cols, rows, smart ? 0.25 : 0.22);
    // في المسح: تمريرة على السبورة كلها ضمن الدور، لتُكتشف اليد الكبيرة (قريبة من الكاميرا) التي لا تسعها الأجزاء
    if (smart) this.tiles.unshift({ ...this.roi });
    this.focus = [];
    this.scanIdx = 0;
  }

  get smart() {
    return !!(this.H && QUALITY[this.effQuality].smart);
  }

  /** عدد كواشف «الفيديو» المطلوبة الآن (لا شيء في وضع المسح والتركيز). */
  _neededDetectors() {
    return this.smart ? 0 : this.tiles.length;
  }

  async listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  }

  async _loadApi() {
    if (this.api) return this.api;
    this.onStatus('loading', 'تحميل نموذج تتبّع اليد…');
    const { FilesetResolver, HandLandmarker } = await import(`${VENDOR}vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
    if (/_nosimd_/.test(fileset.wasmBinaryPath)) {
      // نوفّر نسخة SIMD فقط (كل آيباد وهاتف بنظام iOS 16.4 فأحدث يدعمها، وكل أندرويد حديث)
      throw new Error('nosimd');
    }
    this.api = { fileset, HandLandmarker };
    return this.api;
  }

  async _makeLandmarker(runningMode = 'VIDEO') {
    const { fileset, HandLandmarker } = await this._loadApi();
    const make = (delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode,
        numHands: HANDS_PER_TILE,
        // عتبات أخفض من الافتراضي: أيدي الأطفال صغيرة وجزئية الظهور أحيانًا،
        // والقصّ على السبورة يقلّل الاكتشافات الخاطئة من خارجها
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    // ‎?cpu في الرابط يفرض المعالج المركزي (للتشخيص)
    const wantCpu = this.forceCpu || new URLSearchParams(location.search).has('cpu');
    if (!wantCpu) {
      try {
        const lm = await make('GPU');
        this.delegate = 'GPU';
        return lm;
      } catch {
        /* نتراجع إلى المعالج المركزي */
      }
    }
    const lm = await make('CPU');
    this.delegate = 'CPU';
    return lm;
  }

  /** كاشف لكل بلاطة؛ إن عجز الجهاز عن إنشائها كلها نخفّض الدقة. */
  async _ensureDetectors() {
    if (this.smart && !this.imageLm) {
      try {
        this.imageLm = await this._makeLandmarker('IMAGE');
      } catch (err) {
        if (!this.detectors.length && !this._degrade('تعذّر تشغيل الدقة القصوى')) throw err;
        return this._ensureDetectors();
      }
    }
    if (!this.smart && this.imageLm) {
      try {
        this.imageLm.close();
      } catch {
        /* لا شيء */
      }
      this.imageLm = null;
    }
    const need = this._neededDetectors();
    while (this.detectors.length > need) {
      const d = this.detectors.pop();
      try {
        d.lm.close();
      } catch {
        /* لا شيء */
      }
    }
    while (this.detectors.length < need) {
      try {
        const lm = await this._makeLandmarker();
        const canvas = document.createElement('canvas');
        this.detectors.push({ lm, canvas, ctx: canvas.getContext('2d') });
      } catch (err) {
        if (this.detectors.length === 0) throw err;
        this._degrade('تعذّر تشغيل كل أقسام الدقة على هذا الجهاز');
        return;
      }
    }
  }

  _degrade(reason) {
    const i = QUALITY_ORDER.indexOf(this.effQuality);
    if (i <= 0) return false;
    this.effQuality = QUALITY_ORDER[i - 1];
    this._layout();
    this.matcher.clear();
    this.onQuality(this.effQuality);
    this.onStatus('running', `${reason}: الدقة الآن «${QUALITY[this.effQuality].label}»`);
    return true;
  }

  async start(deviceId) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
    const video = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
    // دقة أعلى = تفاصيل أكثر لليد الصغيرة بعد القصّ على السبورة
    Object.assign(video, { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } });
    this.onStatus('loading', 'تشغيل الكاميرا…');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    this.effQuality = this.quality;
    this._layout();
    await this._ensureDetectors();
    this.running = true;
    this.matcher.clear();
    this.onStatus('running', 'الكاميرا تعمل');
    this._schedule();
    const track = this.stream.getVideoTracks()[0];
    return track?.getSettings?.().deviceId || deviceId || '';
  }

  _closeDetectors() {
    for (const lm of [...this.detectors.map((d) => d.lm), this.imageLm]) {
      try {
        lm?.close();
      } catch {
        /* لا شيء */
      }
    }
    this.detectors = [];
    this.imageLm = null;
  }

  async _fallbackToCpu() {
    this._closeDetectors();
    this.forceCpu = true;
    try {
      await this._ensureDetectors();
      this.onStatus('running', 'الكاميرا تعمل (المعالج المركزي)');
    } catch (err) {
      this.onStatus('error', 'تعذّر تشغيل تتبّع اليد');
      console.error(err);
      return;
    }
    this._schedule();
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.matcher.clear();
    this.lastHands = [];
    this.onStatus('off', 'الكاميرا متوقفة');
  }

  _schedule() {
    if (!this.running) return;
    const v = this.video;
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => this._tick());
    else requestAnimationFrame(() => this._tick());
  }

  async _tick() {
    if (!this.running) return;
    try {
      const v = this.video;
      if (v.paused && v.srcObject) v.play().catch(() => {}); // بعد قفل الجهاز أو تبديل التطبيق
      if (this.detectors.length !== this._neededDetectors() || (this.smart && !this.imageLm)) await this._ensureDetectors();
      const ready = this.smart ? !!this.imageLm : this.detectors.length > 0;
      if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime && ready) {
        this.lastVideoTime = v.currentTime;
        let ts = performance.now();
        if (ts <= this.lastTs) ts = this.lastTs + 1; // الطوابع يجب أن تتزايد تمامًا
        this.lastTs = ts;
        if (this.smart) this._detectSmart(ts);
        else this._detect(ts);
        this._countFps(ts);
        this._errors = 0;
      }
    } catch (err) {
      console.error('[asnan] detect', err);
      // معالج الرسوم قد يُنشئ النموذج ثم يفشل أثناء العمل على بعض الأجهزة: ننتقل للمعالج المركزي
      if (++this._errors >= 5 && this.delegate === 'GPU') {
        this._errors = 0;
        this._fallbackToCpu();
        return;
      }
    }
    this._schedule();
  }

  /** يحوّل نتيجة كاشف على نافذة (بلاطة أو نافذة تركيز) إلى أيدٍ بإحداثيات الكاميرا. */
  _handsFrom(res, tile, aspect, out) {
    (res?.landmarks || []).forEach((lmT, j) => {
      const lm = lmT.map((p) => ({ x: tile.x + p.x * tile.w, y: tile.y + p.y * tile.h }));
      const c = this.handCamPoint(lm);
      const hd = res.handedness?.[j]?.[0];
      const tx = (c.x - tile.x) / tile.w;
      const ty = (c.y - tile.y) / tile.h;
      out.push({
        lm,
        cx: c.x,
        cy: c.y,
        size: Math.hypot(lm[0].x - lm[9].x, (lm[0].y - lm[9].y) / aspect),
        score: hd?.score ?? 0.5,
        handed: hd?.categoryName,
        edge: Math.min(tx, 1 - tx, ty, 1 - ty),
      });
    });
  }

  /** يرسم جزءًا من الإطار على لوحة بحجم مناسب للكاشف. */
  _crop(canvas, ctx, tile, maxSide) {
    const v = this.video;
    const sw = tile.w * v.videoWidth;
    const sh = tile.h * v.videoHeight;
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const cw = Math.max(16, Math.round(sw * k));
    const ch = Math.max(16, Math.round(sh * k));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.drawImage(v, tile.x * v.videoWidth, tile.y * v.videoHeight, sw, sh, 0, 0, cw, ch);
    return canvas;
  }

  /** الدقة القصوى: مسح جزأين من الشبكة + نافذة تركيز لكل يد معروفة. */
  _detectSmart(ts) {
    const v = this.video;
    const aspect = v.videoWidth / v.videoHeight;
    if (!this._cropCanvas) {
      this._cropCanvas = document.createElement('canvas');
      this._cropCtx = this._cropCanvas.getContext('2d', { willReadFrequently: false });
    }
    this.focus = this.focus.filter((f) => ts - f.seen <= FOCUS_KEEP_MS);
    const crops = this.focus.map((f) => {
      // نستبق حركة اليد: مركز النافذة حيث نتوقعها في هذا الإطار
      const dt = Math.min(200, ts - f.seen) / 1000;
      return focusCrop({ cx: f.cx + f.vx * dt, cy: f.cy + f.vy * dt, size: f.size }, aspect);
    });
    // لا أيدي متتبَّعة الآن: الوقت كله للمسح، فنمسح جزءًا إضافيًا لنجدها أسرع
    const scans = QUALITY[this.effQuality].scanPerFrame + (this.focus.length ? 0 : 1);
    for (let i = 0; i < scans && this.tiles.length; i++) {
      crops.push(this.tiles[this.scanIdx]);
      this.scanIdx = (this.scanIdx + 1) % this.tiles.length;
    }
    const raw = [];
    for (const c of crops) {
      const img = this._crop(this._cropCanvas, this._cropCtx, c, MAX_CROP_SIDE);
      this._handsFrom(this.imageLm.detect(img), c, aspect, raw);
    }
    this.lastCrops = crops;
    const merged = mergeDetections(raw, aspect);
    // تحديث نوافذ التركيز: كل يد مكتشفة تُتبَع، والمفقودة تبقى لحظة مكانها
    const next = [];
    for (const d of merged.slice(0, MAX_FOCUS)) {
      const prev = this.focus.find((f) => Math.hypot(f.cx - d.cx, (f.cy - d.cy) / aspect) < 3 * Math.max(f.size, d.size));
      const dt = prev ? Math.max(1, ts - prev.seen) / 1000 : 0;
      next.push({
        cx: d.cx,
        cy: d.cy,
        size: d.size,
        seen: ts,
        vx: prev ? 0.5 * prev.vx + 0.5 * ((d.cx - prev.cx) / dt) : 0,
        vy: prev ? 0.5 * prev.vy + 0.5 * ((d.cy - prev.cy) / dt) : 0,
      });
      if (prev) prev.taken = true;
    }
    for (const f of this.focus) if (!f.taken && next.length < MAX_FOCUS) next.push({ ...f, vx: 0, vy: 0 });
    this.focus = next;
    this.lastHands = merged.map((d) => d.lm);
    this._emit(merged, ts);
  }

  _detect(ts) {
    const v = this.video;
    const aspect = v.videoWidth / v.videoHeight;
    const raw = [];
    this.tiles.forEach((tile, i) => {
      const det = this.detectors[i];
      if (!det) return;
      const full = tile.w >= 0.999 && tile.h >= 0.999;
      const src = full ? v : this._crop(det.canvas, det.ctx, tile, MAX_TILE_SIDE);
      this._handsFrom(det.lm.detectForVideo(src, ts), tile, aspect, raw);
    });
    const merged = this.tiles.length > 1 ? mergeDetections(raw, aspect) : raw;
    this.lastCrops = this.tiles;
    this.lastHands = merged.map((d) => d.lm);
    this._emit(merged, ts);
  }

  _emit(dets, t) {
    if (!this.H) {
      this.onHands([], t);
      return;
    }
    this.matcher.aspect = innerWidth / Math.max(1, innerHeight);
    const pts = [];
    for (const d of dets) {
      const p = applyH(this.H, d.cx, d.cy);
      if (!p) continue;
      // هامش واسع خارج حدود الصورة: كف الطفل عند حافة البطاقة الطرفية قد يقع خارجها قليلًا
      if (p.x < -0.15 || p.x > 1.15 || p.y < -0.15 || p.y > 1.15) continue;
      const a = applyH(this.H, d.lm[0].x, d.lm[0].y);
      const b = applyH(this.H, d.lm[9].x, d.lm[9].y);
      const size = a && b ? Math.hypot((a.x - b.x) * this.matcher.aspect, a.y - b.y) : undefined;
      pts.push({ x: p.x, y: p.y, handed: d.handed, size });
    }
    this.onHands(this.matcher.update(pts, t), t);
  }

  _countFps(t) {
    this._fpsCount++;
    if (t - this._fpsT >= 1000) {
      this.fps = Math.round((this._fpsCount * 1000) / (t - this._fpsT));
      this._fpsCount = 0;
      this._fpsT = t;
      // جهاز بطيء على هذه الدقة ٤ ثوانٍ متتالية: نخفّضها درجة (بعد مهلة الإحماء:
      // الإطارات الأولى بطيئة دائمًا بينما يُجهَّز النموذج)
      const warm = t - this._layoutAt > 6000;
      if (warm && this.fps > 0 && this.fps < 7 && this.effQuality !== 'normal') {
        if (++this._slowSecs >= 4) {
          this._slowSecs = 0;
          this._degrade('الجهاز بطيء على هذه الدقة');
        }
      } else this._slowSecs = 0;
    }
  }

  /** نقطة اليد في إحداثيات الكاميرا المطبّعة. */
  handCamPoint(lm) {
    if (this.getHandPoint() === 'finger') return { x: lm[INDEX_TIP].x, y: lm[INDEX_TIP].y };
    let x = 0;
    let y = 0;
    for (const i of PALM) {
      x += lm[i].x;
      y += lm[i].y;
    }
    return { x: x / PALM.length, y: y / PALM.length };
  }

  /**
   * يلتقط إطارًا رماديًا مصغّرًا (للمعايرة التلقائية). يُرجع شدة الإضاءة 0..255 لكل بكسل.
   * @param {number} width عرض الإطار المصغّر
   */
  grabGray(width = 320) {
    const v = this.video;
    if (!v.videoWidth) return null;
    const w = width;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const c = this._grabCanvas || (this._grabCanvas = document.createElement('canvas'));
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(v, 0, 0, w, h);
    const { data } = g.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return { gray, w, h };
  }

  /** لقطة ملوّنة كاملة من الكاميرا (للمعايرة اليدوية). */
  snapshot() {
    const v = this.video;
    if (!v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c;
  }

  /** نسبة مساحة السبورة من إطار الكاميرا (لتنبيه المعلم إن كانت الكاميرا بعيدة). */
  boardShare() {
    if (!this.H) return null;
    const inv = invert3(this.H);
    if (!inv) return null;
    const p = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => applyH(inv, x, y));
    if (p.some((q) => !q)) return null;
    let s = 0;
    for (let i = 0; i < 4; i++) s += p[i].x * p[(i + 1) % 4].y - p[(i + 1) % 4].x * p[i].y;
    return Math.abs(s) / 2;
  }

  /** يرسم معاينة الكاميرا للمعلم: الصورة، ومعالم الأيدي، وحدود الشاشة المعايَرة، وأقسام التكبير. */
  drawPreview(canvas) {
    const v = this.video;
    if (!v.videoWidth) return;
    const w = canvas.clientWidth || 320;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    canvas.style.height = `${h}px`;
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(v, 0, 0, w, h);
    if (this.H) {
      g.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      g.lineWidth = 1.5;
      for (const t of this.lastCrops.length ? this.lastCrops : this.tiles) g.strokeRect(t.x * w, t.y * h, t.w * w, t.h * h);
      const inv = invert3(this.H);
      if (inv) {
        g.strokeStyle = '#ffd34d';
        g.lineWidth = 2.5;
        g.setLineDash([8, 6]);
        g.beginPath();
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([x, y], i) => {
          const p = applyH(inv, x, y);
          if (!p) return;
          if (i === 0) g.moveTo(p.x * w, p.y * h);
          else g.lineTo(p.x * w, p.y * h);
        });
        g.closePath();
        g.stroke();
        g.setLineDash([]);
      }
    }
    for (const lm of this.lastHands) {
      g.fillStyle = '#22d3ee';
      for (const p of lm) {
        g.beginPath();
        g.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
        g.fill();
      }
      const c = this.handCamPoint(lm);
      g.fillStyle = '#ff3d71';
      g.beginPath();
      g.arc(c.x * w, c.y * h, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
}
```

## `public/board-kit/js/tracking.js`

```js
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
/** يد وحيدة اختفت ثم ظهرت يد وحيدة: نطاق أوسع للمطابقة خلال هذه المدة. */
const SOLO_MEMORY_MS = 1500;
const SOLO_GATE = 0.5;

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
    // حركة سريعة غاب فيها الكشف إطارات: يد واحدة اختفت حديثًا ويد واحدة جديدة ظهرت ⇒ هي نفسها
    // (طفل يسحب بسرعة)، ولو قفزت أبعد من نطاق المطابقة العادي. مع أكثر من يد لا نخمّن.
    const freeD = dets.map((_, i) => i).filter((i) => !usedD.has(i));
    const freeT = [...this.tracks.values()].filter((tr) => !usedT.has(tr.id) && t - tr.seen > 0 && t - tr.seen < SOLO_MEMORY_MS);
    if (freeD.length === 1 && freeT.length === 1 && this._dist(dets[freeD[0]], freeT[0]) < SOLO_GATE) {
      usedD.add(freeD[0]);
      usedT.add(freeT[0].id);
      out.push(this._update(freeT[0], dets[freeD[0]], t));
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
```

## `public/board-kit/js/calibrate.js`

```js
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
```

## `public/board-kit/js/geometry.js`

```js
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
```

## `public/board-kit/css/kit.css`

```css
/* ----------------------------------------------------------------------------
   board-kit — التصميم المشترك لألعاب السبورة الذكية (لمس السبورة باليد):
   • خلفية فاتحة دافئة: جهاز العرض يضيف ضوءًا ولا يصنع سوادًا، فالخلفيات الداكنة
     تبدو رمادية باهتة على السبورة في صف مضاء، أما الفاتحة فتبقى واضحة.
   • كل مقاسات المسرح بوحدة --u (ارتفاع الشاشة = 1000u) فتتناسب مع أي جهاز.
   • مكوّنات جاهزة: الترويسة والشرائح (.hud-header .chip)، أزرار القوائم (.opt)،
     صف البطاقات وبطاقته (.tray .card، و.compact للضيقة)، شريط الفريق (.team-bar)،
     الرسائل (.toast .fact)، النتيجة (.result)، مؤشر اليد، أدوات المعلم ولوحته، المعايرة.
   • ألوان العناصر بالمتغير --c على العنصر، ولون الفريق بالمتغير --team.
---------------------------------------------------------------------------- */
@font-face {
  font-family: 'Baloo Bhaijaan 2';
  font-weight: 400 800;
  font-display: swap;
  src: url(/fonts/baloo-bhaijaan-2-arabic-8ba627.woff2) format('woff2');
}
@font-face {
  font-family: 'Baloo Bhaijaan 2';
  font-weight: 400 800;
  font-display: swap;
  src: url(/fonts/baloo-bhaijaan-2-latin-963184.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+2000-206F, U+2190-23FF, U+25A0-27BF;
}
@font-face {
  font-family: 'Readex Pro';
  font-weight: 300 700;
  font-display: swap;
  src: url(/fonts/readex-pro-arabic-982df5.woff2) format('woff2');
}

:root {
  --maroon: #8a1538;
  --maroon-d: #5f0d26;
  --gold: #c9961a;
  --gold-l: #ffe7a3;
  --ink: #2a1f1a;
  --muted: #6d6158;
  --paper: #fbf6ec;
  --card: #ffffff;
  --line: #e2d5bd;
  --ok: #15803d;
  --bad: #c0262d;
  --u: 1px;
  --fh: 'Baloo Bhaijaan 2', 'Readex Pro', system-ui, sans-serif;
  --fb: 'Readex Pro', 'Baloo Bhaijaan 2', system-ui, sans-serif;
}


* { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--fb);
  -webkit-text-size-adjust: 100%;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}

/* الكاميرا: موجودة ومشغّلة (شرط Safari لاستمرار الإطارات) لكنها غير مرئية */
#cam {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 2px;
  height: 2px;
  opacity: 0.01; /* لا display:none ولا شفافية تامة: بعض إصدارات Safari توقف تحديث إطارات الفيديو غير المرئي */
  pointer-events: none;
}

#stage {
  position: fixed;
  /* حواف الشاشة الآمنة (نتوء الكاميرا وشريط الإيماءة في الهواتف بالوضع الأفقي) */
  top: env(safe-area-inset-top, 0px);
  right: env(safe-area-inset-right, 0px);
  bottom: env(safe-area-inset-bottom, 0px);
  left: env(safe-area-inset-left, 0px);
  overflow: hidden;
  touch-action: none;
  background:
    radial-gradient(120% 90% at 50% 40%, #fffdf8 0%, #f8f0e1 70%, #efe3cc 100%);
}
#board, #fx {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
#fx { pointer-events: none; }
#hud { position: absolute; inset: 0; }

/* ---------------------------------------------------------------- مؤشر اليد */
.ring-bg { fill: rgba(255, 255, 255, 0.38); stroke: rgba(40, 20, 10, 0.22); stroke-width: 9; }
.ring { fill: none; stroke-width: 10; stroke-linecap: round; }
.dot { stroke: #fff; stroke-width: 3.5; }
.held-halo { fill: color-mix(in srgb, var(--c) 22%, transparent); stroke: var(--c); stroke-width: 4; }
/* سن مركون (اختفت اليد الحاملة): دائرة متقطعة نابضة تدعو الطفل لوضع يده عليه */
.cursor.parked .ring-bg {
  stroke: var(--gold);
  stroke-dasharray: 10 8;
  stroke-width: 7;
  transform-box: fill-box;
  transform-origin: center;
  animation: parkPulse 0.9s ease-in-out infinite;
}
.cursor.parked .dot { display: none; }
@keyframes parkPulse {
  0%, 100% { transform: scale(1.6); opacity: 0.9; }
  50% { transform: scale(2.1); opacity: 0.5; }
}

/* ---------------------------------------------------------------- الترويسة */
.hud-header {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: calc(var(--u) * 96);
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 24);
  padding: 0 calc(var(--u) * 40);
  padding-left: max(calc(var(--u) * 40), 250px); /* أدوات المعلم في الزاوية اليسرى */
}
.title {
  margin: 0;
  font-family: var(--fh);
  font-weight: 800;
  font-size: calc(var(--u) * 54);
  line-height: 1;
  color: var(--maroon);
}
.title.small { font-size: calc(var(--u) * 44); }
.chips { display: flex; gap: calc(var(--u) * 12); margin-inline: auto; }
.chip {
  font-family: var(--fh);
  font-weight: 700;
  font-size: calc(var(--u) * 30);
  padding: calc(var(--u) * 6) calc(var(--u) * 22);
  border-radius: 999px;
  background: #fff;
  border: calc(var(--u) * 3) solid var(--line);
  color: var(--ink);
  white-space: nowrap;
}
.chip.warn { color: var(--bad); }
.chip.time { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }

.menu-head {
  flex-direction: column;
  justify-content: center;
  height: auto;
  padding-top: calc(var(--u) * 18);
  gap: calc(var(--u) * 6);
}
.menu-head .lead {
  margin: 0;
  font-size: calc(var(--u) * 24);
  color: var(--muted);
  text-align: center;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--u) * 26);
  font-family: var(--fh);
  font-weight: 700;
  font-size: calc(var(--u) * 26);
}
.legend .lg { display: inline-flex; align-items: center; gap: calc(var(--u) * 8); }
.legend .lg i {
  width: calc(var(--u) * 22);
  height: calc(var(--u) * 22);
  border-radius: 50%;
  background: var(--c);
}

/* ---------------------------------------------------------------- أزرار وبطاقات (أهداف لليد) */
.menu-panel {
  position: absolute;
  left: calc(var(--u) * 50);
  right: calc(var(--u) * 50);
  bottom: calc(var(--u) * 16);
  display: grid;
  gap: calc(var(--u) * 16);
}
.menu-row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: calc(var(--u) * 18); }
.opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--u) * 118);
  padding: calc(var(--u) * 10) calc(var(--u) * 16);
  border-radius: calc(var(--u) * 26);
  background: var(--card);
  border: calc(var(--u) * 4) solid var(--line);
  box-shadow: 0 calc(var(--u) * 6) 0 #e6d8bd;
  text-align: center;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
}
.opt b { font-family: var(--fh); font-weight: 800; font-size: calc(var(--u) * 38); line-height: 1.15; }
.opt small { font-size: calc(var(--u) * 21); color: var(--muted); }
.opt.on { background: var(--maroon); border-color: var(--maroon-d); box-shadow: 0 calc(var(--u) * 6) 0 var(--maroon-d); color: #fff; }
.opt.on small { color: #ffe3ea; }
.opt.start { background: linear-gradient(#ffd667, #e9ad21); border-color: #b9820d; box-shadow: 0 calc(var(--u) * 6) 0 #a8740a; color: #3b2400; }
.opt.start small { color: #5b3a00; }
.opt.off { opacity: 0.45; }
.opt.hover, .card.hover {
  transform: translateY(calc(var(--u) * -4)) scale(1.03);
  box-shadow: 0 0 0 calc(var(--u) * 8) rgba(201, 150, 26, 0.45), 0 calc(var(--u) * 10) calc(var(--u) * 20) rgba(0, 0, 0, 0.12);
}

.tray-wrap {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 6);
}
.tray {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: 100%;
  gap: calc(var(--u) * 20);
}

/* الفرق: لون لكل فريق على شريطه وإطار بطاقاته وسنّه المحمول */
.team-bar {
  height: calc(var(--u) * 40);
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 14);
  padding: 0 calc(var(--u) * 16);
  border-radius: 999px;
  background: var(--team);
  color: #fff;
  font-family: var(--fh);
  font-size: calc(var(--u) * 24);
}
.team-bar b { font-weight: 800; white-space: nowrap; }
.tb-bar { flex: 1; height: calc(var(--u) * 14); border-radius: 999px; background: rgba(255, 255, 255, 0.3); overflow: hidden; }
.tb-bar i { display: block; height: 100%; width: 0; background: #ffd667; transition: width 0.4s; }
.tb-mist { white-space: nowrap; font-weight: 700; }
.tray-wrap[data-team] .card { border-color: var(--team); border-top-color: var(--c, var(--team)); }
.held-item[data-team] .held-halo { stroke: var(--team); stroke-width: 7; }
.res-team { color: var(--team); }
.res-team b { color: var(--team) !important; }
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 14);
  padding: calc(var(--u) * 12) calc(var(--u) * 18);
  border-radius: calc(var(--u) * 26);
  background: var(--card);
  border: calc(var(--u) * 4) solid var(--line);
  border-top: calc(var(--u) * 14) solid var(--c);
  box-shadow: 0 calc(var(--u) * 6) 0 #e6d8bd;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
  min-width: 0;
  overflow: hidden;
}
.card > svg, .card > img { height: 100%; max-width: 34%; flex: none; }
.card-body { display: flex; flex-direction: column; min-width: 0; }
.card-body b { font-family: var(--fh); font-weight: 800; font-size: calc(var(--u) * 42); line-height: 1.1; color: var(--c); }
.card-body small { font-size: calc(var(--u) * 22); color: var(--muted); }
.card .count { font-family: var(--fh); font-weight: 700; font-size: calc(var(--u) * 24); color: var(--ink); }
.card.done, .card.empty { opacity: 0.38; }

/* بطاقة ضيقة: الأيقونة فوق الاسم */
.tray.compact { gap: calc(var(--u) * 12); }
.tray.compact .card {
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--u) * 4);
  padding: calc(var(--u) * 8) calc(var(--u) * 6);
  text-align: center;
}
.tray.compact .card > svg, .tray.compact .card > img { height: 46%; max-width: 70%; }
.tray.compact .card-body { align-items: center; }
.tray.compact .card-body b { font-size: calc(var(--u) * 32); }
.tray.compact .card-body small { display: none; }
.tray.compact .card .count { font-size: calc(var(--u) * 22); }
.card.done::after {
  content: '✓';
  position: absolute;
  top: calc(var(--u) * 6);
  left: calc(var(--u) * 14);
  font-size: calc(var(--u) * 40);
  color: var(--ok);
}
.card.shake { animation: shake 0.45s; }
.card.hint { animation: glow 0.8s ease-in-out infinite; }

/* ---------------------------------------------------------------- رسائل */
.toast {
  position: absolute;
  top: calc(var(--u) * 104);
  left: 50%;
  transform: translate(-50%, calc(var(--u) * -10));
  padding: calc(var(--u) * 10) calc(var(--u) * 30);
  border-radius: 999px;
  font-family: var(--fh);
  font-weight: 800;
  font-size: calc(var(--u) * 34);
  background: #fff;
  border: calc(var(--u) * 3) solid var(--line);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }
.toast.bad { color: var(--bad); border-color: #f2b6b6; }
.toast.hint { color: #8a5a00; border-color: var(--gold); background: #fff8e1; }
.toast.info { color: var(--muted); }
.toast.win { color: #6b4a00; background: linear-gradient(#ffe48a, #ffd15c); border-color: var(--gold); font-size: calc(var(--u) * 44); }

.fact {
  position: absolute;
  top: calc(var(--u) * 166);
  left: 50%;
  width: min(78%, calc(var(--u) * 1100));
  transform: translateX(-50%);
  padding: calc(var(--u) * 14) calc(var(--u) * 26);
  border-radius: calc(var(--u) * 20);
  background: rgba(255, 255, 255, 0.96);
  border-inline-start: calc(var(--u) * 12) solid var(--c, var(--gold));
  box-shadow: 0 calc(var(--u) * 8) calc(var(--u) * 24) rgba(0, 0, 0, 0.12);
  font-size: calc(var(--u) * 28);
  line-height: 1.5;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}
.fact b { font-family: var(--fh); font-weight: 800; color: var(--c); margin-inline-end: calc(var(--u) * 6); }
.fact.show { opacity: 1; }

/* ---------------------------------------------------------------- النتيجة */
.result {
  position: absolute;
  left: calc(var(--u) * 40);
  right: calc(var(--u) * 40);
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'main stats btns' 'legend legend btns';
  align-items: center;
  gap: calc(var(--u) * 14) calc(var(--u) * 30);
  padding: calc(var(--u) * 18) calc(var(--u) * 30);
  border-radius: calc(var(--u) * 30);
  background: rgba(255, 255, 255, 0.95);
  border: calc(var(--u) * 4) solid var(--line);
  box-shadow: 0 calc(var(--u) * 12) calc(var(--u) * 30) rgba(0, 0, 0, 0.1);
}
.res-main { grid-area: main; text-align: center; }
.stars { font-size: calc(var(--u) * 64); line-height: 1; letter-spacing: calc(var(--u) * 6); }
.star { color: #e5dccb; }
.star.on { color: #f2b51b; text-shadow: 0 calc(var(--u) * 3) 0 #b07d05; }
.res-msg { font-family: var(--fh); font-weight: 800; font-size: calc(var(--u) * 36); color: var(--maroon); }
.winner { font-family: var(--fh); font-weight: 800; font-size: calc(var(--u) * 30); color: #8a5a00; }
.res-stats { grid-area: stats; display: flex; flex-wrap: wrap; gap: calc(var(--u) * 12) calc(var(--u) * 28); font-size: calc(var(--u) * 26); color: var(--muted); }
.res-stats b { font-family: var(--fh); font-weight: 800; font-size: calc(var(--u) * 34); color: var(--ink); margin-inline-start: calc(var(--u) * 6); }
.result .legend { grid-area: legend; justify-content: flex-start; font-size: calc(var(--u) * 22); }
.res-btns { grid-area: btns; display: grid; gap: calc(var(--u) * 14); width: calc(var(--u) * 300); }
.res-btns .opt { min-height: calc(var(--u) * 96); }

/* ---------------------------------------------------------------- أدوات المعلم */
#teacher {
  position: fixed;
  top: max(8px, env(safe-area-inset-top));
  left: max(8px, env(safe-area-inset-left));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 6px;
  direction: ltr;
}
.tbtn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.85);
  color: var(--ink);
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
}
.cam-chip {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.12);
  direction: rtl;
}
.cam-chip::before { content: '●'; margin-inline-end: 6px; color: #9ca3af; }
.cam-chip[data-state='ok']::before { color: #16a34a; }
.cam-chip[data-state='wait']::before { color: #d97706; }
.cam-chip[data-state='bad']::before { color: #dc2626; }

#panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  width: min(460px, 94vw);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 16px 18px max(24px, env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.2);
  font-size: 15px;
  line-height: 1.6;
  -webkit-user-select: text;
  user-select: text;
}
#panel[hidden] { display: none; }
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-head h2 { margin: 0; font-family: var(--fh); color: var(--maroon); font-size: 22px; }
#panel section { border-top: 1px solid #eee3d0; padding: 10px 0; }
#panel h3 { margin: 4px 0 6px; font-size: 17px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#camStatus { font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 999px; background: #f3f4f6; }
#camStatus[data-state='running'] { background: #dcfce7; color: #166534; }
#camStatus[data-state='loading'] { background: #fef3c7; color: #92400e; }
#camStatus[data-state='error'] { background: #fee2e2; color: #991b1b; }
.help { margin: 4px 0 8px; color: #57534e; font-size: 14px; }
.help.warn { color: #92400e; font-size: 13px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0; }
.btn {
  font: inherit;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #d6c7aa;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.btn.primary { background: var(--maroon); border-color: var(--maroon-d); color: #fff; }
.btn.ghost { background: #faf6ee; }
.btn.sm { padding: 6px 12px; font-size: 15px; }
select { font: inherit; padding: 7px 10px; border-radius: 10px; border: 1px solid #d6c7aa; max-width: 230px; background: #fff; }
.muted { color: #78716c; font-size: 13px; }
#preview { width: 100%; border-radius: 10px; background: #000; display: block; }
#preview[hidden] { display: none; }
.cal-result { margin: 6px 0 0; font-size: 14px; padding: 6px 10px; border-radius: 8px; background: #f5f5f4; }
.cal-result[data-q='good'] { background: #dcfce7; color: #14532d; }
.cal-result[data-q='ok'] { background: #fef9c3; color: #713f12; }
.cal-result[data-q='bad'] { background: #fee2e2; color: #7f1d1d; }
.panel-msg:empty { display: none; }
.panel-msg { margin: 8px 0; padding: 8px 12px; border-radius: 10px; background: #ecfdf5; color: #065f46; font-size: 14px; }
.panel-msg[data-bad='1'] { background: #fef2f2; color: #991b1b; }
.field { display: block; margin: 8px 0; border: 0; padding: 0; }
.field output { color: var(--maroon); font-weight: 700; margin-inline-start: 6px; }
.field input[type='range'] { width: 100%; }
.field legend { font-weight: 600; padding: 0; }
.field label, .check { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
.placement { display: block; width: 100%; max-width: 360px; margin: 2px auto 6px; background: #faf6ee; border-radius: 10px; }
.tips ul { margin: 4px 0; padding-inline-start: 20px; color: #57534e; font-size: 14px; }

/* ---------------------------------------------------------------- المعايرة */
.calib-overlay { position: fixed; inset: 0; z-index: 100; }
.calib-spot {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.calib-spot.numbered {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font: 800 34px var(--fh);
  box-shadow: 0 0 0 6px #fff, 0 0 0 9px #111;
}
.calib-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3a3a3a;
  font: 700 24px var(--fh);
}
.calib-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; touch-action: none; }
.calib-hint {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 999px;
  background: #fff;
  font: 700 20px var(--fh);
  pointer-events: none;
}
.calib-bar { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
.calib-tap {
  position: fixed;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 4px solid;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 0 2px #fff;
}

/* الهواتف بالوضع الأفقي: شاشة قصيرة، فأدوات المعلم أصغر */
@media (max-height: 500px) {
  .tbtn { width: 30px; height: 30px; font-size: 15px; }
  .cam-chip { font-size: 11px; padding: 4px 9px; }
  #teacher { gap: 4px; }
  .hud-header { padding-left: max(calc(var(--u) * 40), 200px); }
  #panel { font-size: 14px; width: min(420px, 70vw); }
}

/* الصورة على السبورة أفقية: في الوضع العمودي نطلب تدوير الجهاز */
#rotate { display: none; }
@media (orientation: portrait) and (max-aspect-ratio: 4/5) {
  #rotate {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
    color: var(--maroon);
    font: 800 32px var(--fh);
  }
}

/* ---------------------------------------------------------------- حركات */
@keyframes pop {
  0% { transform: scale(0.2); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6%); }
  40% { transform: translateX(6%); }
  60% { transform: translateX(-4%); }
  80% { transform: translateX(4%); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 calc(var(--u) * 4) rgba(201, 150, 26, 0.3); }
  50% { box-shadow: 0 0 0 calc(var(--u) * 14) rgba(201, 150, 26, 0.75); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition: none !important; }
}
```
