// ---------------------------------------------------------------------------
// الربط: الكاميرا ↔ المتتبّع ↔ محرّك التفاعل ↔ اللعبة ↔ لوحة المعلم.
// ---------------------------------------------------------------------------
import { Game } from './game.js';
import { Interaction } from './input.js';
import { HandTracker } from './tracker.js';
import { autoCalibrate, manualCalibrate } from './calibrate.js';
import { loadSettings, saveSettings } from './store.js';
import { QUALITY } from './tracking.js';
import { unlock, setSound, setSpeech } from './audio.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const settings = loadSettings();
const params = new URLSearchParams(location.search);

const game = new Game({ stage, board: $('#board'), hud: $('#hud'), fx: $('#fx') });
game.setSettings(settings);
const input = new Interaction({
  stage,
  game,
  getDwellMs: () => settings.dwellMs,
  getShowHands: () => settings.showHands,
});
game.input = input;

const camStatus = $('#camStatus');
const tracker = new HandTracker({
  video: $('#cam'),
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

function persist() {
  saveSettings(settings);
}

// ----------------------------------------------------------------- الحلقة
let lastClock = 0;
function loop(now) {
  input.frame(now);
  if (now - lastClock > 250) {
    lastClock = now;
    game.tickClock();
    if (!panel.hidden && $('#preview').dataset.on === '1') tracker.drawPreview($('#preview'));
    if (!panel.hidden) $('#fps').textContent = tracker.active ? `${tracker.fps} إطار/ث • ${tracker.delegate || ''}` : '';
  }
  requestAnimationFrame(loop);
}

// ----------------------------------------------------------------- الشاشة
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => game.render(), 120);
});
// منع التكبير بالإصبعين والقائمة المنبثقة عند الضغط المطوّل على iPad
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// إبقاء الشاشة مضاءة أثناء الحصة (iPadOS 16.4+)
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

// ----------------------------------------------------------------- لوحة المعلم
const panel = $('#panel');
const camChip = $('#camChip');

function updateCamChip() {
  const st = camStatus.dataset.state;
  const cal = settings.calibration;
  let text = 'بلا كاميرا';
  let cls = 'off';
  if (st === 'loading') (text = 'جارٍ التشغيل…'), (cls = 'wait');
  else if (st === 'error') (text = 'خطأ في الكاميرا'), (cls = 'bad');
  else if (st === 'running') {
    if (cal?.H) (text = 'اليد جاهزة'), (cls = 'ok');
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

function syncPanel() {
  $('#dwell').value = settings.dwellMs;
  $('#dwellVal').textContent = `${(settings.dwellMs / 1000).toLocaleString('ar-EG')} ث`;
  $('#quality').value = settings.trackQuality;
  $('#qualityNote').textContent =
    tracker.active && tracker.effQuality !== settings.trackQuality
      ? `خُفّضت تلقائيًا إلى «${QUALITY[tracker.effQuality].label}» لأن الجهاز بطيء عليها.`
      : '';
  $('#side').value = Math.round((settings.sideInset || 0) * 100);
  $('#sideVal').textContent = settings.sideInset > 0 ? `${Math.round(settings.sideInset * 100).toLocaleString('ar-EG')}٪ من كل جانب` : 'بلا هامش';
  $('#reach').value = Math.round(settings.reachTop * 100);
  $('#reachVal').textContent = settings.reachTop > 0 ? `${Math.round(settings.reachTop * 100).toLocaleString('ar-EG')}٪ من الأعلى` : 'الشاشة كلها';
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
      res.textContent += ` • السبورة تشغل ${Math.round(share * 100).toLocaleString('ar-EG')}٪ فقط من صورة الكاميرا: قرّب الجهاز من السبورة.`;
      res.dataset.q = 'bad';
    }
  }
  updateCamChip();
}

async function refreshCameras() {
  const sel = $('#camSelect');
  try {
    const cams = await tracker.listCameras();
    sel.replaceChildren();
    const auto = new Option('الكاميرا الخلفية (تلقائي)', '');
    sel.appendChild(auto);
    cams.forEach((c, i) => sel.appendChild(new Option(c.label || `كاميرا ${i + 1}`, c.deviceId)));
    sel.value = cams.some((c) => c.deviceId === settings.cameraId) ? settings.cameraId : '';
  } catch {
    /* القائمة تظهر بعد السماح بالكاميرا */
  }
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
    if (m === 'nosimd') msg('هذا الجهاز قديم ولا يدعم نموذج تتبّع اليد. حدّث iPadOS إلى 16.4 أو أحدث.', true);
    else if (err?.name === 'NotAllowedError') msg('رُفض إذن الكاميرا. من إعدادات Safari اسمح بالكاميرا لهذا الموقع ثم أعد المحاولة.', true);
    else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') msg('لم تُعثر على الكاميرا المختارة. اختر «الكاميرا الخلفية (تلقائي)».', true);
    else msg(`تعذّر التشغيل: ${m}`, true);
  }
  syncPanel();
}

function msg(text, bad = false) {
  const m = $('#panelMsg');
  m.textContent = text;
  m.dataset.bad = bad ? '1' : '0';
}

$('#btnSettings').addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
$('#btnClose').addEventListener('click', closePanel);
$('#btnHome').addEventListener('click', () => game.toMenu());
// ملء الشاشة غير مدعوم في Safari على iPhone: نخفي الزر هناك (الحل: «إضافة إلى الشاشة الرئيسية»)
const canFull = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
$('#btnFull').hidden = !canFull;
$('#btnFull').addEventListener('click', () => {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
  else {
    const el = d.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }
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
  const prevSim = input.sim;
  try {
    const cal = await autoCalibrate(tracker, document.body);
    settings.calibration = cal;
    tracker.setCalibration(cal.H);
    persist();
    openPanel();
    msg(cal.error < 3 ? 'تمت المعايرة. جرّب: ضع يدك على السبورة وتأكّد أن الدائرة تتبعها.' : 'تمت المعايرة لكن الدقة ضعيفة. ثبّت الحامل وأطفئ الضوء القريب من السبورة ثم أعدها، أو استعمل المعايرة اليدوية.', cal.error >= 3);
  } catch (err) {
    openPanel();
    msg(err?.message || 'فشلت المعايرة.', true);
  }
  input.setSim(prevSim);
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
  clearTimeout(resizeT);
  resizeT = setTimeout(() => game.render(), 150);
});
$('#reach').addEventListener('input', (e) => {
  settings.reachTop = Number(e.target.value) / 100;
  persist();
  syncPanel();
  clearTimeout(resizeT);
  resizeT = setTimeout(() => game.render(), 150);
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

// ----------------------------------------------------------------- البدء
if (params.has('sim')) input.setSim(true);
game.render();
updateCamChip();
requestAnimationFrame(loop);
// إن سبق تشغيل الكاميرا ومعايرتها على هذا الجهاز نعيد تشغيلها مباشرة (Safari يتذكر الإذن للموقع)
if (settings.calibration?.H && !params.has('sim') && navigator.permissions?.query) {
  navigator.permissions
    .query({ name: 'camera' })
    .then((p) => p.state === 'granted' && startCamera())
    .catch(() => {});
}

// للاختبار الآلي فقط
window.__asnan = { game, input, tracker, settings };
