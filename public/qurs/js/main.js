// نقطة الدخول: يربط الكاميرا بعامل الرؤية، ومشهد الواقع المعزز بوضعية الكاميرا، ومنطق اللعبة بالواجهة.
import { VisionClient } from './vision/camera.js';
import { rings, zoneAt, tierOf, TIERS, zoneColor, applyH, inv3, drawBoard } from './vision/geometry.js';
import { ARScene } from './render/arscene.js';
import { Game } from './game/state.js';
import { SND, setMuted, isMuted } from './game/audio.js';
import { store, TEAM_COL } from './content/store.js';
import { connectCloud } from './content/firebase.js';
import { initEditor, openEditor } from './ui/editor.js';
import { initCollect, enterCollect } from './ui/collect.js';
import { FIREBASE_CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
export const app = { mode: 'home', vision: null, ar: null, game: null, fit: { ox: 0, oy: 0, sc: 1 }, W: 0, H: 0, tapOn: false, drag: -1, manual: false };

/* ---------- التهيئة ---------- */
await store.load();
if (FIREBASE_CONFIG) connectCloud(FIREBASE_CONFIG).then(async (c) => { store.cloud = c; try { const cfg = await c.loadConfig(); if (cfg) { store.cfg = Object.assign(store.cfg, cfg); homeUI(); } } catch {} }).catch(() => {});
const vision = (app.vision = new VisionClient());
const ar = (app.ar = new ARScene($('gl')));
const game = (app.game = new Game(store));
ar.onFirework = () => SND.firework();
initEditor(app, $); initCollect(app, $);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.standalone === false && /iPad|iPhone/.test(navigator.userAgent)) $('installHint').hidden = false;

/* ---------- التخطيط ---------- */
function resize() {
  app.W = window.innerWidth; app.H = window.innerHeight; const dpr = Math.min(2, devicePixelRatio || 1);
  if (vision.src) {
    const s = vision.src, cover = Math.max(app.W / s.w, app.H / s.h), contain = Math.min(app.W / s.w, app.H / s.h);
    const sc = cover / contain < 1.3 ? cover : contain, w = s.w * sc, h = s.h * sc, ox = (app.W - w) / 2, oy = (app.H - h) / 2;
    app.fit = { ox, oy, sc };
    for (const el of [bgc || s.el, $('gl'), $('ov')]) { el.style.left = ox + 'px'; el.style.top = oy + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }
    if (bgc) { bgc.width = Math.round(w * dpr); bgc.height = Math.round(h * dpr); }
    ar.resize(Math.round(w), Math.round(h), Math.min(dpr, quality));
    $('ov').width = Math.round(w * dpr); $('ov').height = Math.round(h * dpr);
  }
  if (vision.src?.demo && app.mode !== 'play') { /* المشهد التجريبي يتبع اتجاه الشاشة */ }
}
window.addEventListener('resize', resize);
const v2s = (p) => [app.fit.ox + p[0] * app.fit.sc, app.fit.oy + p[1] * app.fit.sc];
const s2v = (x, y) => [(x - app.fit.ox) / app.fit.sc, (y - app.fit.oy) / app.fit.sc];

/* ---------- الشاشات ---------- */
function show(mode) {
  app.mode = mode;
  $('home').hidden = mode !== 'home'; $('stage').hidden = mode === 'home';
  $('scanUI').hidden = mode !== 'scan'; $('playUI').hidden = mode !== 'play' && mode !== 'arming'; $('collectUI').hidden = mode !== 'collect';
}
let bgc = null;
let mediaEl = null;
function attachMedia() { if (mediaEl) mediaEl.remove(); bgc = null;
  if (vision.src.demo) { bgc = document.createElement('canvas'); mediaEl = bgc; } else { mediaEl = vision.src.el; mediaEl.style.objectFit = 'fill'; }
  mediaEl.className = 'media'; $('stage').prepend(mediaEl); resize(); }
async function startCam() {
  $('camMsg').className = 'note'; $('camMsg').textContent = 'جارٍ فتح الكاميرا…';
  try { await vision.openCamera(app.facing || 'environment'); attachMedia(); enterScan(); try { navigator.wakeLock?.request('screen').catch(() => {}); } catch {} $('btnFlip').hidden = false; }
  catch (e) { $('camMsg').className = 'note err'; $('camMsg').textContent = e?.name === 'NotAllowedError' ? 'لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح ثم أعد المحاولة.' : 'تعذّر فتح الكاميرا. افتح التطبيق من رابط https في Safari أو Chrome، أو جرّب اللعبة بدون كاميرا.'; }
}
function startDemo() { vision.openDemo(window.innerWidth >= window.innerHeight); attachMedia(); enterScan(); $('btnShake').hidden = false; }
function enterScan() { show('scan'); app.manual = false; $('btnManual').setAttribute('aria-pressed', 'false'); $('btnArm').disabled = true; vision.send({ type: 'scan' }); setStatus('scanStatus', 'وجّه الكاميرا نحو القرص…', ''); ar.setGrid('strong'); }
function setStatus(id, t, cls) { const e = $(id); if (e.textContent !== t) e.textContent = t; e.className = 'status ' + (cls || ''); }
function goHome() { vision.stop(); if (mediaEl) { mediaEl.remove(); mediaEl = null; } show('home'); $('endSheet').hidden = true; homeUI(); }
let armT = 0;
function arm() { app.mode = 'arming'; armT = performance.now(); $('scanUI').hidden = true; $('playUI').hidden = false; vision.send({ type: 'arm', t: armT }); }
function beginPlay() { show('play'); $('playStatus').hidden = true; $('more').hidden = true; $('qcard').hidden = true; ar.setGrid(gridMode);
  if (game.keep) { game.keep = false; } else game.start(); SND.lock(); banner('ابدأوا الرمي!\nدور ' + game.teams[game.cur].name, 2200); }

/* ---------- أحداث عامل الرؤية ---------- */
vision.addEventListener('locked', () => { if (app.mode === 'scan') { SND.lock(); $('btnArm').disabled = false; } });
vision.addEventListener('playing', () => { if (app.mode === 'arming') beginPlay(); });
vision.addEventListener('hit', (e) => { if (app.mode === 'play' && !game.paused) game.hit(e.detail.u, e.detail.v, true); });
vision.addEventListener('trail', (e) => { if (app.mode === 'play') ar.trail(e.detail.u, e.detail.v); });
vision.addEventListener('pose', (e) => { const p = e.detail; if (p.rings) { rings.bull = p.rings[0]; rings.inner = p.rings[1]; rings.rim = p.rings[2]; }
  if (app.mode === 'scan') { if (p.manual) return; if (p.ok) setStatus('scanStatus', p.locked ? 'تم التعرف على القرص — اضغط «ابدأ اللعب»' : 'جارٍ التعرف على القرص…', p.locked ? 'ok' : ''); else if (p.lost > 12) { $('btnArm').disabled = true; setStatus('scanStatus', 'وجّه الكاميرا نحو القرص…', ''); } }
  if (app.mode === 'play') { const q = $('trkq'); const txt = !p.ok ? 'التتبع: مفقود' : p.q >= 3 ? 'التتبع: ممتاز' : p.q === 2 ? 'التتبع: جيد' : 'التتبع: ضعيف'; if (q.textContent !== txt) { q.textContent = txt; q.className = 'chip q' + (p.ok ? p.q : 0); }
    if (!p.ok && p.lost > 25) { $('playStatus').hidden = false; setStatus('playStatus', 'القرص غير ظاهر للكاميرا…', 'warn'); } else $('playStatus').hidden = true; }
});

/* ---------- أحداث اللعبة ---------- */
game.addEventListener('change', chips);
game.addEventListener('hit', (e) => { const { z, u, v, t } = e.detail; ar.hit(z, u, v, () => { $('stage').classList.add('cine'); setTimeout(() => $('stage').classList.remove('cine'), 3200); flash(1); });
  SND.hit(t); if (t >= 1) flash(0.25 + t * 0.15); if (t >= 1) shake(); });
game.addEventListener('miss', (e) => { SND.miss(); ar.text(e.detail.u, e.detail.v, 0.1, 'خارج القرص', '#ffb4a6', 0.14, 1.2); });
game.addEventListener('question', (e) => ask(e.detail));
game.addEventListener('turn', (e) => { SND.turn(); banner((game.teams.length > 1 ? 'دور ' + e.detail.team.name : 'جولة جديدة') + '\nاجمعوا الكرات ثم ارموا', 2600); });
game.addEventListener('end', (e) => { SND.win(); const r = $('rank'); r.innerHTML = ''; e.detail.ranking.forEach((t, i) => { const d = document.createElement('div'); d.style.setProperty('--tc', t.c); const a = document.createElement('span'); a.textContent = (i === 0 ? 'الأول: ' : '') + t.name + (t.prizes.length ? ' — ' + t.prizes.length + ' جائزة' : ''); const b = document.createElement('span'); b.textContent = t.score; d.append(a, b); r.append(d); }); $('endSheet').hidden = false; });

function chips() { const el = $('chips'); el.innerHTML = ''; game.teams.forEach((t, i) => { const d = document.createElement('div'); d.className = 'chip' + (i === game.cur ? ' on' : ''); d.style.setProperty('--tc', t.c);
  const nm = document.createElement('span'); nm.textContent = t.name; const dot = document.createElement('i'), sc = document.createElement('b'); sc.textContent = t.score; d.append(dot, nm, sc);
  if (i === game.cur) { const b = document.createElement('span'); b.className = 'balls'; for (let k = 0; k < store.cfg.balls; k++) { const s = document.createElement('span'); if (k >= game.left) s.className = 'used'; b.append(s); } d.append(b); } el.append(d); }); }
let bannerT = 0; function banner(t, ms) { const b = $('banner'); b.textContent = t; b.style.whiteSpace = 'pre-line'; b.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => (b.hidden = true), ms); }
function flash(a) { const f = $('flash'); f.style.opacity = Math.min(0.75, a); setTimeout(() => (f.style.opacity = 0), 90); }
function shake() { const s = $('stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
function ask({ z, t, q }) {
  const el = $('qcard'), T = TIERS[t], tr = store.cfg.tiers[t]; el.innerHTML = ''; el.style.setProperty('--qc', T.c); el.hidden = false;
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const head = mk('div', 'qhead'); head.append(mk('span', '', 'خانة ' + z.pts + ' — مستوى ' + T.name), mk('span', '', 'مكافأة الإجابة: +' + tr.bonus)); el.append(head, mk('p', 'qtext', q.q));
  const done = (ok) => { game.answer(ok, t, q); if (ok) { SND.ok(); ar.celebrate(); ar.text(0, 0, 0.3, '+' + tr.bonus, '#ffd23d', 0.3, 1.6); const pz = q.prize || tr.prize; el.append(mk('div', 'prize', pz ? 'الجائزة: ' + pz : 'إجابة صحيحة!')); } else { SND.bad(); shake(); }
    if (q.a) el.append(mk('div', 'ans', q.a)); const nx = mk('button', 'btn primary', 'متابعة'); nx.onclick = () => { el.hidden = true; game.after(); }; el.append(nx); nx.focus(); };
  if (q.opts) { const box = mk('div', 'opts'); q.opts.forEach((o, i) => { const b = mk('button', 'btn', o); b.onclick = () => { [...box.children].forEach((c, k) => { c.disabled = true; if (k === q.right) c.classList.add('right'); }); if (i !== q.right) b.classList.add('wrong'); done(i === q.right); }; box.append(b); }); el.append(box); }
  else { const row = mk('div', 'row'), y = mk('button', 'btn green', 'إجابة صحيحة'), n = mk('button', 'btn red', 'إجابة خاطئة'); y.onclick = () => { row.remove(); done(true); }; n.onclick = () => { row.remove(); done(false); }; row.append(y, n); el.append(row); }
}

/* ---------- الحلقة الرئيسية ---------- */
let lastT = 0, gridMode = 'soft', frameAvg = 16, quality = 2;
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  // جودة تكيفية: إن بطؤ الرسم على جهاز قديم نخفض دقة طبقة المؤثرات لا دقة الرؤية
  frameAvg = frameAvg * 0.95 + Math.min(200, dt * 1000) * 0.05;
  if (frameAvg > 45 && quality > 0.6) { quality = Math.max(0.6, quality - 0.3); ar.resize(ar.w, ar.h, quality); frameAvg = 16; }
  if (app.mode === 'home' || !vision.src) return;
  vision.pump(t);
  if (bgc) bgc.getContext('2d').drawImage(vision.src.el, 0, 0, bgc.width, bgc.height);
  const p = vision.pose;
  ar.setPose(p.pose3, vision.src.w, vision.src.h); ar.setLight(vision.brightness);
  if (app.mode === 'arming') { const left = 1.1 - (t - armT) / 1000; overlayText(left > 0 ? 'ألتقط صورة القرص… أبعد يدك والكرات عنه' : ''); }
  else if (app.mode !== 'scan') overlayText('');
  ar.step(dt, t); ar.render(t, app.mode === 'play' ? p.balls : []);
  drawOverlay(t, p);
}
requestAnimationFrame(loop);
let ovText = '';
function overlayText(s) { ovText = s; }
function drawOverlay(t, p) {
  const c = $('ov').getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), w = $('ov').width / dpr, h = $('ov').height / dpr;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const sc = app.fit.sc;
  if (app.mode === 'scan' && !p.H) { const r = Math.min(w, h) * 0.32, a = t / 700; c.strokeStyle = 'rgba(246,207,28,.8)'; c.lineWidth = 4; c.setLineDash([26, 18]); c.lineDashOffset = -t / 30; c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.stroke(); c.setLineDash([]); c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); c.stroke(); }
  if (app.mode === 'scan' && app.manual && p.pts) { const hs = p.pts.map((q) => [q[0] * sc, q[1] * sc]).concat([[applyH(p.H, 0, 0)[0] * sc, applyH(p.H, 0, 0)[1] * sc]]); hs.forEach((q, i) => { c.fillStyle = i === 4 ? '#f6cf1c' : '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(q[0], q[1], i === 4 ? 14 : 18, 0, 7); c.fill(); c.stroke(); }); }
  if (ovText) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 ' + Math.max(22, Math.min(w, h) * 0.05) + 'px Tajawal, sans-serif'; c.lineWidth = 6; c.strokeStyle = '#000a'; c.strokeText(ovText, w / 2, h * 0.8); c.fillStyle = '#fff'; c.fillText(ovText, w / 2, h * 0.8); }
  if (app.mode === 'play' && game.paused) { c.fillStyle = '#000a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 44px Tajawal, sans-serif'; c.textAlign = 'center'; c.fillText('إيقاف مؤقت', w / 2, h / 2); }
}

/* ---------- اللمس على المشهد ---------- */
const ov = $('ov');
ov.addEventListener('pointerdown', (e) => {
  const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, p = vision.pose;
  if (app.mode === 'scan' && app.manual && p.pts) { const sc = app.fit.sc, hs = p.pts.map((q) => [q[0] * sc, q[1] * sc]).concat([[applyH(p.H, 0, 0)[0] * sc, applyH(p.H, 0, 0)[1] * sc]]); let bi = -1, bd = 48; hs.forEach((q, i) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bi = i; } }); app.drag = bi; app.px = x; app.py = y; ov.setPointerCapture(e.pointerId); return; }
  if (app.mode === 'play' && !game.paused && !game.busy) {
    if (vision.src.demo) { const b = vision.demoToBoard(x / app.fit.sc, y / app.fit.sc); vision.demo.balls.push({ u: b[0], v: b[1], du: (Math.random() - 0.5) * 0.6, dv: 1.6, t0: performance.now() }); }
    else if (app.tapOn && p.H) { const b = applyH(inv3(p.H), x / app.fit.sc, y / app.fit.sc); if (Math.hypot(b[0], b[1]) <= 1.04) game.hit(b[0], b[1], false); }
  }
  if (app.mode === 'collect') app.onCollectTap?.(x / app.fit.sc, y / app.fit.sc);
});
ov.addEventListener('pointermove', (e) => { if (app.mode !== 'scan' || app.drag < 0 || !vision.pose.pts) return; const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = (x - app.px) / app.fit.sc, dy = (y - app.py) / app.fit.sc; app.px = x; app.py = y;
  const pts = vision.pose.pts.map((q) => q.slice()); if (app.drag === 4) pts.forEach((q) => { q[0] += dx; q[1] += dy; }); else { pts[app.drag][0] += dx; pts[app.drag][1] += dy; } vision.pose.pts = pts; vision.send({ type: 'setPts', pts }); });
ov.addEventListener('pointerup', () => { app.drag = -1; });

/* ---------- الأزرار ---------- */
function seg(id, vals, get, set) { const el = $(id); el.innerHTML = ''; vals.forEach((v) => { const b = document.createElement('button'); b.textContent = v; b.setAttribute('aria-pressed', String(get() === v)); b.onclick = () => { set(v); seg(id, vals, get, set); }; el.append(b); }); }
function teamInputs() { const el = $('teamInputs'); el.innerHTML = ''; for (let i = 0; i < store.cfg.nTeams; i++) { const inp = document.createElement('input'); inp.type = 'text'; inp.id = 'team' + i; inp.className = 'teamin'; inp.value = store.cfg.teams[i]; inp.maxLength = 18; inp.setAttribute('aria-label', 'اسم الفريق ' + (i + 1)); inp.style.borderInlineStartColor = TEAM_COL[i]; inp.oninput = () => { store.cfg.teams[i] = inp.value; store.save(); }; el.append(inp); } }
function homeUI() { seg('segTeams', [1, 2, 3, 4], () => store.cfg.nTeams, (v) => { store.cfg.nTeams = v; store.save(); teamInputs(); }); seg('segBalls', [1, 2, 3, 5], () => store.cfg.balls, (v) => { store.cfg.balls = v; store.save(); }); teamInputs();
  $('className').value = store.cfg.className || ''; const c = $('logo').getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 600, 600); c.translate(300, 300); c.scale(290, 290); drawBoard(c); }
$('className').oninput = () => { store.cfg.className = $('className').value; store.save(); };
$('btnCam').onclick = startCam; $('btnDemo').onclick = startDemo; $('btnScanBack').onclick = goHome;
$('btnFlip').onclick = () => { app.facing = app.facing === 'user' ? 'environment' : 'user'; startCam(); };
$('btnManual').onclick = () => { app.manual = !app.manual; $('btnManual').setAttribute('aria-pressed', String(app.manual)); vision.send({ type: 'manual', on: app.manual });
  if (app.manual) { $('btnArm').disabled = false; setStatus('scanStatus', 'اسحب النقاط البيضاء إلى حافة القرص. في الضبط اليدوي يجب أن يبقى الجهاز ثابتًا', 'warn'); } else { $('btnArm').disabled = true; } };
$('btnRot').onclick = () => vision.send({ type: 'rotate' });
$('btnArm').onclick = arm;
$('btnMute').onclick = () => { setMuted(!isMuted()); $('btnMute').textContent = isMuted() ? 'الصوت: مكتوم' : 'الصوت: يعمل'; };
$('btnUndo').onclick = () => { if (game.undo()) { $('qcard').hidden = true; banner('تم التراجع عن آخر رمية', 1400); } };
$('btnNext').onclick = () => { $('qcard').hidden = true; game.next(); };
$('btnMore').onclick = () => { const m = $('more'); m.hidden = !m.hidden; $('btnMore').setAttribute('aria-expanded', String(!m.hidden)); };
$('btnPause').onclick = () => { game.paused = !game.paused; vision.send({ type: 'pause', on: game.paused }); $('btnPause').textContent = game.paused ? 'متابعة اللعب' : 'إيقاف مؤقت'; $('more').hidden = true; };
$('btnQ').onclick = () => { store.cfg.qOn = !store.cfg.qOn; store.save(); $('btnQ').textContent = store.cfg.qOn ? 'الأسئلة: تعمل' : 'الأسئلة: متوقفة'; };
$('btnRecal').onclick = () => { game.keep = true; enterScan(); };
$('btnRebase').onclick = () => { vision.send({ type: 'rebase' }); $('more').hidden = true; banner('تم أخذ لقطة مرجعية جديدة', 1400); };
$('btnTap').onclick = () => { app.tapOn = !app.tapOn; $('btnTap').textContent = app.tapOn ? 'التسجيل باللمس: يعمل' : 'التسجيل باللمس: متوقف'; };
$('btnGrid').onclick = () => { gridMode = gridMode === 'soft' ? 'off' : gridMode === 'off' ? 'strong' : 'soft'; ar.setGrid(gridMode); $('btnGrid').textContent = 'الشبكة: ' + { soft: 'خفيفة', off: 'مخفية', strong: 'قوية' }[gridMode]; };
$('btnShake').onclick = () => { if (!vision.demo) return; vision.demo.shake = !vision.demo.shake; $('btnShake').textContent = vision.demo.shake ? 'اهتزاز الكاميرا: يعمل' : 'اهتزاز الكاميرا: متوقف'; };
$('btnFs').onclick = () => { const d = document, el = d.documentElement; try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => {}); } } catch { banner('ثبّت التطبيق على الشاشة الرئيسية ليعمل بملء الشاشة', 1800); } $('more').hidden = true; };
$('btnEdit').onclick = () => openEditor(); $('btnEdit2').onclick = () => { $('more').hidden = true; game.paused = true; vision.send({ type: 'pause', on: true }); $('btnPause').textContent = 'متابعة اللعب'; openEditor(); };
$('btnEnd').onclick = () => { $('more').hidden = true; game.end(); };
$('btnAgain').onclick = () => { $('endSheet').hidden = true; game.start(); vision.send({ type: 'rebase' }); if (vision.demo) vision.demo.balls.length = 0; };
$('btnHome').onclick = goHome;
$('btnCollect').onclick = async () => { try { await vision.openCamera(app.facing || 'environment'); } catch { vision.openDemo(innerWidth >= innerHeight); } attachMedia(); show('collect'); vision.send({ type: 'scan' }); enterCollect(); };
$('btnColBack').onclick = goHome;

/* ---------- سجل النتائج ---------- */
$('btnResults').onclick = async () => { const list = $('resList'); list.innerHTML = ''; const rs = await store.results(); if (!rs.length) list.innerHTML = '<p class="note">لا توجد نتائج بعد.</p>';
  for (const r of rs) { const d = document.createElement('div'); d.style.setProperty('--tc', '#f6cf1c'); const a = document.createElement('span'); a.innerHTML = ''; const title = document.createElement('span'); title.textContent = (r.className ? r.className + ' — ' : '') + new Date(r.at).toLocaleString('ar-QA'); const sm = document.createElement('small'); sm.textContent = r.teams.map((t) => t.name + ': ' + t.score).join(' | '); a.append(title, sm); const b = document.createElement('span'); b.textContent = Math.max(...r.teams.map((t) => t.score)); d.append(a, b); list.append(d); }
  $('resultsSheet').hidden = false; };
$('btnResClose').onclick = () => ($('resultsSheet').hidden = true);
$('btnResClear').onclick = async () => { await store.clearResults(); $('btnResults').click(); };
$('btnResExport').onclick = async () => { const rs = await store.results(); const rows = [['التاريخ', 'الصف', 'الفريق', 'النقاط', 'الإصابات', 'الجوائز']]; for (const r of rs) for (const t of r.teams) rows.push([new Date(r.at).toISOString(), r.className, t.name, t.score, t.hits, (t.prizes || []).join('؛')]);
  const csv = '﻿' + rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'qurs-results.csv'; a.click(); };

homeUI(); resize();
window.__t = { app, vision, ar, game, store, rings, zoneAt, applyH, inv3 };
