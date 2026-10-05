// جمع بيانات التدريب: التقاط إطارات من الكاميرا مع وسم مواقع الكرات، ثم تصدير ملف يحوّله سكربت التدريب إلى صيغة YOLO.
import { store } from '../content/store.js';
import { applyH } from '../vision/geometry.js';

let $, app, auto = false, autoT = 0, shot = null;
export function initCollect(a, q) { app = a; $ = q;
  $('btnColShot').onclick = () => capture();
  $('btnColAuto').onclick = () => { auto = !auto; $('btnColAuto').setAttribute('aria-pressed', String(auto)); $('btnColAuto').textContent = auto ? 'إيقاف التسجيل التلقائي' : 'تسجيل تلقائي'; if (auto) tick(); };
  app.onCollectTap = (vx, vy) => { if (shot) { const r = ballRadiusPx(); shot.boxes.push({ x: vx * shot.k, y: vy * shot.k, r: r * shot.k }); renderShot(); } };
}
export async function enterCollect() { shot = null; $('colCard').hidden = true; updateCount(); setStatus('وجّه الكاميرا نحو القرص ثم التقط إطارات بكرات ملتصقة؛ المس كل كرة في الصورة لوسمها.'); }
function setStatus(t) { $('colStatus').textContent = t; }
async function updateCount() { $('colCount').textContent = 'العينات: ' + (await store.sampleCount()); }
function ballRadiusPx() { const H = app.vision.pose.H; if (!H) return 20; const a = applyH(H, 0, 0), b = applyH(H, 0.115, 0); return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function capture() {
  const src = app.vision.src; if (!src) return;
  const k = Math.min(1, 1280 / src.w), cv = document.createElement('canvas'); cv.width = Math.round(src.w * k); cv.height = Math.round(src.h * k);
  cv.getContext('2d').drawImage(src.el, 0, 0, cv.width, cv.height);
  const p = app.vision.pose, boxes = [];
  if (p.H) for (const b of p.balls || []) { const q = applyH(p.H, b[0], b[1]); boxes.push({ x: q[0] * k, y: q[1] * k, r: ballRadiusPx() * k }); } // وسم مبدئي من الكاشف الكلاسيكي
  shot = { cv, k, boxes, H: p.H, w: cv.width, h: cv.height };
  renderShot();
}
function renderShot() {
  const el = $('colCard'); el.innerHTML = ''; el.hidden = false; el.style.setProperty('--qc', '#3fb6ff');
  const wrap = document.createElement('div'); wrap.style.position = 'relative'; const img = document.createElement('img'); img.src = shot.cv.toDataURL('image/jpeg', 0.85); img.alt = 'الإطار الملتقط'; wrap.append(img);
  img.onload = () => { const s = img.clientWidth / shot.w; for (const b of shot.boxes) { const d = document.createElement('div'); d.className = 'colbox'; d.style.left = (b.x - b.r) * s + 'px'; d.style.top = (b.y - b.r) * s + 'px'; d.style.width = d.style.height = b.r * 2 * s + 'px'; wrap.append(d); } };
  img.onclick = (e) => { const r = img.getBoundingClientRect(), s = shot.w / r.width, x = (e.clientX - r.left) * s, y = (e.clientY - r.top) * s; const i = shot.boxes.findIndex((b) => Math.hypot(b.x - x, b.y - y) < b.r * 1.2); if (i >= 0) shot.boxes.splice(i, 1); else shot.boxes.push({ x, y, r: ballRadiusPx() * shot.k }); renderShot(); };
  const row = document.createElement('div'); row.className = 'row';
  const info = document.createElement('span'); info.className = 'note'; info.textContent = 'المس كرة لإضافتها، والمسها مرة أخرى لحذفها. الكرات الموسومة: ' + shot.boxes.length;
  const save = document.createElement('button'); save.className = 'btn green sm'; save.textContent = 'حفظ العينة'; save.onclick = async () => { await store.addSample({ id: Date.now().toString(36), jpg: img.src, w: shot.w, h: shot.h, boxes: shot.boxes, H: shot.H, at: Date.now() }); shot = null; el.hidden = true; updateCount(); };
  const skip = document.createElement('button'); skip.className = 'btn sm'; skip.textContent = 'إهمال'; skip.onclick = () => { shot = null; el.hidden = true; };
  const exp = document.createElement('button'); exp.className = 'btn sm'; exp.textContent = 'تصدير كل العينات'; exp.onclick = exportAll;
  const clr = document.createElement('button'); clr.className = 'btn sm red'; clr.textContent = 'مسح العينات'; clr.onclick = async () => { await store.clearSamples(); updateCount(); };
  row.append(save, skip, exp, clr); el.append(wrap, info, row);
}
function tick() { if (!auto || app.mode !== 'collect') return; if (!shot && performance.now() - autoT > 1500) { autoT = performance.now(); capture(); if (shot.boxes.length) { store.addSample({ id: Date.now().toString(36), jpg: shot.cv.toDataURL('image/jpeg', 0.85), w: shot.w, h: shot.h, boxes: shot.boxes, H: shot.H, at: Date.now(), auto: true }).then(updateCount); shot = null; $('colCard').hidden = true; } else { shot = null; $('colCard').hidden = true; } } setTimeout(tick, 300); }
export async function exportAll() { const s = await store.samples(); const lines = s.map((x) => JSON.stringify(x)).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines], { type: 'application/x-ndjson' })); a.download = 'qurs-samples-' + new Date().toISOString().slice(0, 10) + '.jsonl'; a.click(); }
