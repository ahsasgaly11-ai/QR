// محرك الرؤية ٤ — تتبّع صور طبيعي (Natural Image Tracking) بأسلوب أنظمة الواقع المعزز الاحترافية:
//   ١) التعرف: ميزات ORB من صورة القرص المرجعية ↔ ميزات الإطار، مطابقة Hamming، ثم RANSAC لحساب الهوموغرافي.
//   ٢) التتبع: تدفق بصري هرمي (Lucas–Kanade) للنقاط بين الإطارات مع فحص أمامي-خلفي، وهوموغرافي جديد كل إطار.
//   ٣) الإنعاش: إعادة مطابقة ORB داخل نافذة القرص كل بضعة إطارات حتى لا ينجرف التتبع ولا يُفقد مع الحركة.
//   ٤) التعلّم: بعد أول قفل يلتقط المحرك صورة القرص الحقيقي بإضاءة الصف ويبني منها مرجعًا ثانيًا للتعرف الفوري.
//   ٥) الكرات: تقويم صورة القرص إلى شبكة قانونية (warpPerspective) وطرح الخلفية مع تعويض الإضاءة وتأكيد الاستقرار.
// يعمل في Web Worker فوق OpenCV (WebAssembly). لا يعتمد على ألوان القرص، فيعمل مع أي إضاءة وكاميرا وزاوية.
'use strict';
const post = (type, d) => self.postMessage(Object.assign({ type }, d || {}));
let cv = null, ready = false, failed = false;
const REF = { size: 512, cx: 256, cy: 256, R: 248 };          // الصورة المرجعية القانونية: u=(x-cx)/R
const RINGS = [0.162, 0.614, 0.969];                            // أنصاف أقطار الحلقات المقاسة من القرص الحقيقي
const BP = [[0, -1], [1, 0], [0, 1], [-1, 0]];
let src = { w: 1280, h: 720 }, PW = 0, PH = 0, mode = 'scan', paused = false, armT = 0, sens = 38;
let frame = null;                                               // {data,width,height} الإطار الحالي RGBA
const M = {};                                                   // مصفوفات دائمة (لا نخصّص ذاكرة كل إطار)
const refs = [];                                                // مراجع التعرف: {live, scale, kp:[u,v,...], des:Mat}
const trk = { pts: [], H: null, ok: false, lost: 99, q: 0, rms: 1, inl: 0, stable: 0, move: 1, jump: false, mode: 'search', frames: 0, lastDet: -99, live: false, rad: 0, prevH: null };
const scan = { manual: false, good: 0, locked: false };
let liveAt = 0;

/* ---------- جبر الهوموغرافي ---------- */
function solveH(B, P) {
  const A = []; for (let i = 0; i < 4; i++) { const x = B[i][0], y = B[i][1], X = P[i][0], Y = P[i][1]; A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]); A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; if (Math.abs(A[p][c]) < 1e-10) return null; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; } }
  const h = []; for (let i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]); h.push(1); return h;
}
function inv3(m) { const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C; return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det]; }
function mul3(a, b) { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; }
const apply = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
const norm9 = (m) => m.map((v) => v / m[8]);
const C_UV = [REF.R, 0, REF.cx, 0, REF.R, REF.cy, 0, 0, 1], C_INV = inv3(C_UV);   // uv ↔ بكسل المرجع القانوني
const b2v = (u, v) => apply(trk.H, u, v);
function radiusPx(H) { const c = apply(H, 0, 0), e = apply(H, 1, 0), f = apply(H, 0, 1); return (Math.hypot(e[0] - c[0], e[1] - c[1]) + Math.hypot(f[0] - c[0], f[1] - c[1])) / 2; }
// هوموغرافي معقول؟ مركز داخل الصورة تقريبًا، حجم مناسب، رباعي محدّب، منظور غير متطرف
function saneH(H) {
  if (!H || !isFinite(H[0]) || !isFinite(H[8]) || Math.abs(H[8]) < 1e-9) return false;
  const c = apply(H, 0, 0), r = radiusPx(H); if (!(r > 22 && r < Math.max(PW, PH) * 1.2)) return false;
  if (c[0] < -r || c[1] < -r || c[0] > PW + r || c[1] > PH + r) return false;
  const q = BP.map((p) => apply(H, p[0], p[1])); let sgn = 0;
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], d = q[(i + 2) % 4], cr = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]); if (!sgn) sgn = Math.sign(cr); else if (Math.sign(cr) !== sgn) return false; }
  const w1 = H[6] * 1 + H[8], w2 = -H[6] + H[8], w3 = H[7] + H[8], w4 = -H[7] + H[8]; if (Math.min(w1, w2, w3, w4) <= 0.25 * Math.abs(H[8])) return false;
  const e1 = Math.hypot(q[1][0] - q[3][0], q[1][1] - q[3][1]), e2 = Math.hypot(q[0][0] - q[2][0], q[0][1] - q[2][1]); return Math.min(e1, e2) / Math.max(e1, e2) > 0.22;
}

/* ---------- تحميل OpenCV ---------- */
async function loadCV() {
  let url = '../../vendor/opencv.js';
  try { // تنزيل بمؤشر تقدّم (أول مرة فقط؛ بعدها من مخزن التطبيق)
    const r = await fetch(url); if (!r.ok) throw new Error('http ' + r.status);
    const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), chunks = []; let got = 0, lastP = -1;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; const p = total ? Math.floor((got / total) * 100) : -1; if (p !== lastP) { lastP = p; post('engine', { state: 'loading', pct: p }); } }
    url = URL.createObjectURL(new Blob(chunks, { type: 'text/javascript' }));
  } catch (e) { url = '../../vendor/opencv.js'; }
  post('engine', { state: 'compiling' });
  importScripts(url);
  let m = self.cv; if (m && typeof m.then === 'function') m = await m; else if (m && !m.Mat) await new Promise((res) => { m.onRuntimeInitialized = res; });
  if (!m || !m.Mat || !m.ORB) throw new Error('opencv api');
  cv = m;
}
function initMats() {
  M.orbFull = new cv.ORB(1000, 1.2, 8, 19, 0, 2, cv.ORB_HARRIS_SCORE, 31, 10);
  M.orbRoi = new cv.ORB(500, 1.2, 8, 19, 0, 2, cv.ORB_HARRIS_SCORE, 31, 10);
  M.bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
  M.none = new cv.Mat(); M.kp = new cv.KeyPointVector(); M.des = new cv.Mat(); M.mm = new cv.DMatchVectorVector();
  M.win = new cv.Size(15, 15); M.crit = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, 20, 0.03);
  M.warp = new cv.Mat(); M.pA = new cv.Mat(); M.pB = new cv.Mat(); M.warpM = new cv.Mat(3, 3, cv.CV_64F); M.gsz = new cv.Size(G, G); M.rsz = new cv.Size(REF.size, REF.size); M.refWarp = new cv.Mat();
}
// بناء مجموعة مراجع (ثلاثة مقاييس) من صورة رمادية قانونية ٥١٢×٥١٢
function buildRefs(gray512, live) {
  const out = [];
  for (const scale of [1, 0.6, 0.36]) {
    const s = Math.round(REF.size * scale), img = new cv.Mat(); if (scale === 1) gray512.copyTo(img); else cv.resize(gray512, img, new cv.Size(s, s), 0, 0, cv.INTER_AREA);
    const mask = cv.Mat.zeros(s, s, cv.CV_8UC1); cv.circle(mask, new cv.Point(REF.cx * scale, REF.cy * scale), Math.round(REF.R * scale * 0.985), new cv.Scalar(255), -1);
    const orb = new cv.ORB(scale === 1 ? 1000 : scale > 0.5 ? 700 : 450, 1.2, 8, 15, 0, 2, cv.ORB_HARRIS_SCORE, 31, 8);
    const kp = new cv.KeyPointVector(), des = new cv.Mat(); orb.detectAndCompute(img, mask, kp, des);
    const uv = new Float32Array(kp.size() * 2); for (let i = 0; i < kp.size(); i++) { const p = kp.get(i).pt; uv[i * 2] = (p.x / scale - REF.cx) / REF.R; uv[i * 2 + 1] = (p.y / scale - REF.cy) / REF.R; }
    out.push({ live, scale, kp: uv, des, n: kp.size() }); kp.delete(); orb.delete(); mask.delete(); img.delete();
  }
  return out;
}
function setRefs(list, live) { for (let i = refs.length - 1; i >= 0; i--) if (refs[i].live === live) { refs[i].des.delete(); refs.splice(i, 1); } for (const r of list) refs.push(r); }

/* ---------- التعرف بالميزات ---------- */
// يعيد أفضل هوموغرافي (uv → بكسل إطار المعالجة) ونقاطه الداخلة. rect: نافذة بحث اختيارية، Hp: وضعية سابقة لترشيح المطابقات.
function detect(rect, Hp) {
  const roi = rect ? M.gray.roi(rect) : M.gray, orb = rect ? M.orbRoi : M.orbFull, ox = rect ? rect.x : 0, oy = rect ? rect.y : 0;
  // إضاءة ضعيفة: تمديد خطي للتباين قبل استخراج الميزات (موازنة الهيستوغرام الكاملة تُغرق الصورة بزوايا الضجيج فتضيع ميزات القرص)
  let img = roi; if (M.mean < 95) { cv.convertScaleAbs(roi, M.eq, Math.min(3.5, 120 / Math.max(10, M.mean)), 0); img = M.eq; }
  orb.detectAndCompute(img, M.none, M.kp, M.des);
  if (rect) roi.delete();
  const nk = M.kp.size(); if (nk < 12) return null;
  const fx = new Float32Array(nk), fy = new Float32Array(nk); for (let i = 0; i < nk; i++) { const p = M.kp.get(i).pt; fx[i] = p.x + ox; fy[i] = p.y + oy; }
  // ترتيب المراجع: المرجع الحي أولًا، ثم المقياس الأقرب لحجم القرص المتوقع
  const expR = Hp ? radiusPx(Hp) : trk.rad || 0;
  const order = refs.slice().sort((a, b) => (a.live !== b.live ? (a.live ? -1 : 1) : expR ? Math.abs(Math.log((a.scale * REF.R) / expR)) - Math.abs(Math.log((b.scale * REF.R) / expR)) : 0));
  const gate = Hp ? Math.max(10, radiusPx(Hp) * 0.08) : 0;
  let best = null;
  for (const ref of order) {
    if (ref.n < 12) continue;
    M.mm.delete(); M.mm = new cv.DMatchVectorVector(); M.bf.knnMatch(M.des, ref.des, M.mm, 2);   // knnMatch يُلحق بالمتجه ولا يفرغه، لذا نبدأ بمتجه جديد
    const srcA = [], dstA = [], uvA = [];
    for (let i = 0; i < M.mm.size(); i++) { const v = M.mm.get(i), two = v.size() >= 2, a = two ? v.get(0) : null, b = two ? v.get(1) : null; v.delete(); if (!two || a.distance >= 0.8 * b.distance || a.distance > 64) continue;
      const u = ref.kp[a.trainIdx * 2], w = ref.kp[a.trainIdx * 2 + 1], x = fx[a.queryIdx], y = fy[a.queryIdx];
      if (gate) { const p = apply(Hp, u, w); if (Math.hypot(p[0] - x, p[1] - y) > gate) continue; }
      srcA.push(u * REF.R + REF.cx, w * REF.R + REF.cy); dstA.push(x, y); uvA.push(u, w); }
    const n = srcA.length / 2; if (n < 12) continue;
    const sm = cv.matFromArray(n, 1, cv.CV_32FC2, srcA), dm = cv.matFromArray(n, 1, cv.CV_32FC2, dstA), msk = new cv.Mat();
    let Hm = null; try { Hm = cv.findHomography(sm, dm, cv.RANSAC, 3.0, msk, 2000, 0.995); } catch (e) { Hm = null; }
    if (Hm && !Hm.empty()) {
      const Hr = Array.from(Hm.data64F), H = norm9(mul3(Hr, C_UV)); let inl = 0, err = 0; const pts = [];
      for (let i = 0; i < n; i++) if (msk.data[i]) { const p = apply(H, uvA[i * 2], uvA[i * 2 + 1]), e = Math.hypot(p[0] - dstA[i * 2], p[1] - dstA[i * 2 + 1]); inl++; err += e; pts.push({ x: dstA[i * 2], y: dstA[i * 2 + 1], u: uvA[i * 2], v: uvA[i * 2 + 1] }); }
      if (inl >= 14 && inl >= n * 0.25 && saneH(H) && (!best || inl > best.inl)) best = { H, pts, inl, err: err / inl, ref };
    }
    if (Hm) Hm.delete(); sm.delete(); dm.delete(); msk.delete();
    if (best && best.inl >= 45) break;   // كافٍ؛ لا نهدر وقتًا على بقية المراجع
  }
  return best;
}

/* ---------- التتبع بالتدفق البصري ---------- */
function trackLK() {
  const P = trk.pts, n = P.length; if (n < 8 || !M.prevGray) return null;
  const arr = new Float32Array(n * 2); for (let i = 0; i < n; i++) { arr[i * 2] = P[i].x; arr[i * 2 + 1] = P[i].y; }
  const p0 = cv.matFromArray(n, 1, cv.CV_32FC2, arr), p1 = new cv.Mat(), p2 = new cv.Mat(), s1 = new cv.Mat(), s2 = new cv.Mat(), e1 = new cv.Mat(), e2 = new cv.Mat();
  let res = null;
  try {
    cv.calcOpticalFlowPyrLK(M.prevGray, M.gray, p0, p1, s1, e1, M.win, 3, M.crit, 0, 1e-4);
    cv.calcOpticalFlowPyrLK(M.gray, M.prevGray, p1, p2, s2, e2, M.win, 3, M.crit, 0, 1e-4);
    const d1 = p1.data32F, d2 = p2.data32F, srcA = [], dstA = [], uvA = [];
    for (let i = 0; i < n; i++) { if (!s1.data[i] || !s2.data[i]) continue; const x = d1[i * 2], y = d1[i * 2 + 1]; if (x < 2 || y < 2 || x > PW - 3 || y > PH - 3) continue;
      if (Math.hypot(d2[i * 2] - arr[i * 2], d2[i * 2 + 1] - arr[i * 2 + 1]) > 1.0) continue;             // فحص أمامي-خلفي: نقطة انزلقت عن مكانها
      srcA.push(P[i].u * REF.R + REF.cx, P[i].v * REF.R + REF.cy); dstA.push(x, y); uvA.push(P[i].u, P[i].v); }
    const m = srcA.length / 2; if (m >= 8) {
      const sm = cv.matFromArray(m, 1, cv.CV_32FC2, srcA), dm = cv.matFromArray(m, 1, cv.CV_32FC2, dstA), msk = new cv.Mat();
      let Hm = null; try { Hm = cv.findHomography(sm, dm, cv.RANSAC, 2.5, msk, 1000, 0.995); } catch (e) { Hm = null; }
      if (Hm && !Hm.empty()) { const H = norm9(mul3(Array.from(Hm.data64F), C_UV)); let inl = 0, err = 0; const pts = [];
        for (let i = 0; i < m; i++) if (msk.data[i]) { const p = apply(H, uvA[i * 2], uvA[i * 2 + 1]); inl++; err += Math.hypot(p[0] - dstA[i * 2], p[1] - dstA[i * 2 + 1]); pts.push({ x: dstA[i * 2], y: dstA[i * 2 + 1], u: uvA[i * 2], v: uvA[i * 2 + 1] }); }
        if (inl >= 8 && inl >= m * 0.5 && saneH(H)) res = { H, pts, inl, err: err / inl }; }
      if (Hm) Hm.delete(); sm.delete(); dm.delete(); msk.delete(); }
  } catch (e) { res = null; }
  p0.delete(); p1.delete(); p2.delete(); s1.delete(); s2.delete(); e1.delete(); e2.delete();
  return res;
}
// نافذة البحث حول القرص (لإنعاش الميزات بسرعة)
function boardRect(H, k) { const q = []; for (let a = 0; a < 360; a += 30) q.push(apply(H, k * Math.sin((a * Math.PI) / 180), -k * Math.cos((a * Math.PI) / 180)));
  let x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(PW, Math.ceil(x1)); y1 = Math.min(PH, Math.ceil(y1)); if (x1 - x0 < 40 || y1 - y0 < 40) return null; return new cv.Rect(x0, y0, x1 - x0, y1 - y0); }
function accept(R, fromDetect) {
  const prev = trk.H; let H = R.H;
  if (prev) { const c0 = apply(prev, 0, 0), c1 = apply(H, 0, 0), rad = radiusPx(prev), mv = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    trk.jump = mv > rad * 0.12; trk.move = mv / rad; if (mv < 0.35 && !fromDetect) H = norm9(prev.map((v, i) => v * 0.5 + H[i] * 0.5)); }   // ثابت: تنعيم خفيف يزيل الرجفة
  else { trk.jump = false; trk.move = 1; }
  trk.prevH = prev; trk.H = H; trk.pts = R.pts; trk.inl = R.inl; trk.rad = radiusPx(H); trk.rms = R.err / trk.rad; trk.ok = true; trk.lost = 0;
  trk.q = R.inl >= 40 && R.err < 1.6 ? 3 : R.inl >= 18 ? 2 : 1;
  trk.stable = trk.q >= 2 && !trk.jump ? trk.stable + 1 : 0;
}
function track() {
  trk.frames++; const T0 = performance.now();
  if (scan.manual) { trk.ok = !!trk.H; trk.jump = false; trk.mode = 'manual'; trk.stable = trk.ok ? trk.stable + 1 : 0; trk.move = 0; return; }
  let R = trk.ok ? trackLK() : null, fromDetect = false;
  const refresh = !R || trk.frames - trk.lastDet >= 10 || R.inl < 30;
  if (refresh) { const prior = R ? R.H : trk.ok ? trk.H : null, rect = prior ? boardRect(prior, 1.25) : null;
    const D = detect(rect, prior); trk.lastDet = trk.frames;
    if (D && (!R || D.inl >= 14)) { // دمج: نقاط المطابقة المرجعية + ما بقي من نقاط التتبع المتسقة مع الوضعية الجديدة
      const pts = D.pts.slice(0, 160); if (R) for (const p of R.pts) { const q = apply(D.H, p.u, p.v); if (Math.hypot(q[0] - p.x, q[1] - p.y) < 2 && pts.length < 200) pts.push(p); }
      R = { H: D.H, pts, inl: D.inl + (R ? R.inl : 0), err: D.err }; fromDetect = true; }
    else if (!R && rect) { const D2 = detect(null, null); if (D2) { R = D2; fromDetect = true; } } }   // فشلت النافذة: بحث كامل فورًا
  trk.tTrack = performance.now() - T0;
  if (R) { accept(R, fromDetect); trk.mode = fromDetect ? 'detect' : 'track'; return; }
  trk.ok = false; trk.lost++; trk.q = 0; trk.stable = 0; trk.move = 1; trk.mode = 'search'; trk.pts = []; if (trk.lost > 20) trk.H = null;
}
// تعلّم القرص الحقيقي: مرجع حي بإضاءة الصف وكاميرا الجهاز نفسها (يرفع سرعة التعرف ودقته لاحقًا)
function learnLive(t) {
  if (!trk.ok || trk.stable < 8 || trk.inl < 35 || trk.rad < 70 || (liveAt && t - liveAt < 20000) || (mode === 'play' && cb.busyFrac > 0.02)) return;
  const Mi = mul3(C_UV, inv3(trk.H)); M.warpM.data64F.set(Mi);
  cv.warpPerspective(M.gray, M.refWarp, M.warpM, M.rsz, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(128));
  setRefs(buildRefs(M.refWarp, true), true); trk.live = true; liveAt = t;
}

/* ---------- كشف الكرات على شبكة القرص القانونية ---------- */
const G = 160, EXT = 1.22, N = G * G;
const cb = { map: new Int8Array(N), cur: new Uint8Array(N * 3), prev: new Uint8Array(N * 3), bg: new Float32Array(N * 3), clean: new Float32Array(N * 3), mask: new Uint8Array(N), er: new Uint8Array(N), lab: new Int32Array(N), st: new Int32Array(N), age: new Uint16Array(N), balls: [], cands: [], flight: null, out: new Uint8Array(N), hi: new Uint8Array(N), tmp: new Uint8Array(N), busyFrac: 0, hasClean: false };
for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const u = ((i + 0.5) / G * 2 - 1) * EXT, v = ((j + 0.5) / G * 2 - 1) * EXT; cb.out[j * G + i] = u * u + v * v > 1 ? 1 : 0; }
const g2b = (x, y) => [((x + 0.5) / G * 2 - 1) * EXT, ((y + 0.5) / G * 2 - 1) * EXT];
function sampleBoard() { // تقويم القرص إلى الشبكة: بكسل الشبكة ← بكسل الإطار عبر معكوس H
  const S = [G / (2 * EXT), 0, G / 2 - 0.5, 0, G / (2 * EXT), G / 2 - 0.5, 0, 0, 1];  // uv → شبكة
  const Mg = mul3(S, inv3(trk.H)); M.warpM.data64F.set(Mg);
  cv.warpPerspective(M.rgba, M.warp, M.warpM, M.gsz, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
  const d = M.warp.data, cur = cb.cur, Hi = inv3(Mg);
  for (let k = 0; k < N; k++) { const j = k * 4, q = k * 3; cur[q] = d[j]; cur[q + 1] = d[j + 1]; cur[q + 2] = d[j + 2]; }
  // صلاحية الخلايا: خارج الإطار أو خارج دائرة الحساب لا تُحسب (الحافة 4 بكسل حتى لا يدخل الاستيفاء مع الخارج)
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const k = j * G + i; if (cb.out[k] && (i < 4 || j < 4 || i >= G - 4 || j >= G - 4)) { cb.map[k] = -1; continue; }
    const w = Hi[6] * i + Hi[7] * j + Hi[8], x = (Hi[0] * i + Hi[1] * j + Hi[2]) / w, y = (Hi[3] * i + Hi[4] * j + Hi[5]) / w; cb.map[k] = x < 1 || y < 1 || x >= PW - 2 || y >= PH - 2 ? -1 : 1; }
}
function rebase() { sampleBoard(); { let sm = 0, n = 0; for (let k = 0; k < N; k++) if (cb.map[k] >= 0 && !cb.out[k]) { const j = k * 3; sm += cb.cur[j] + cb.cur[j + 1] + cb.cur[j + 2]; n++; } cb.bmean = n ? sm / (3 * n) : 120; } if (!M.cleanRgba) M.cleanRgba = new cv.Mat(); M.rgba.copyTo(M.cleanRgba); cb.cleanH = trk.H.slice(); for (let i = 0; i < N * 3; i++) { cb.bg[i] = cb.cur[i]; cb.clean[i] = cb.cur[i]; cb.prev[i] = cb.cur[i]; } cb.age.fill(0); cb.cands = []; cb.balls = []; cb.flight = null; cb.hasClean = true; }
function sdiffT(ref, k, gain, thr) { // فرق يتحمّل إزاحة خلية واحدة، حتى لا يُحسب اهتزاز الصورة تغيّرًا
  const cur = cb.cur, j = k * 3, r = cur[j], g = cur[j + 1], b = cur[j + 2];
  let best = Math.max(Math.abs(r - ref[j] * gain), Math.abs(g - ref[j + 1] * gain), Math.abs(b - ref[j + 2] * gain)); if (best <= thr) return best;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const kk = k + dy * G + dx; if (kk < 0 || kk >= N || cb.map[kk] < 0) continue; const q = kk * 3;
    const d = Math.max(Math.abs(r - ref[q] * gain), Math.abs(g - ref[q + 1] * gain), Math.abs(b - ref[q + 2] * gain)); if (d < best) { best = d; if (best <= thr) return best; } }
  return best;
}
const SP = { P: 72, R: 0.17 };   // رقعة دقيقة حول الكرة (٧٢ بكسل لمدى ±٠٫١٧ من نصف قطر القرص) تُقوَّم من الإطار الكامل
function subpixel(u0, v0, gc) { // مركز الكرة بدقة: تقويم الإطار الحالي ولقطة القرص الفارغ (كلٌّ بهوموغرافيّه) إلى الرقعة نفسها ثم مركز مرجّح بالفرق
  if (!M.cleanRgba || !cb.cleanH) return { u: u0, v: v0 };
  const P = SP.P, Rr = SP.R, k = P / (2 * Rr), S = [k, 0, (Rr - u0) * k, 0, k, (Rr - v0) * k, 0, 0, 1], sz = new cv.Size(P, P);
  M.warpM.data64F.set(mul3(S, inv3(trk.H))); cv.warpPerspective(M.rgba, M.pA, M.warpM, sz, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
  M.warpM.data64F.set(mul3(S, inv3(cb.cleanH))); cv.warpPerspective(M.cleanRgba, M.pB, M.warpM, sz, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
  const a = M.pA.data, b = M.pB.data, thr = (cb.S || sens) * 0.8; let sw = 0, su = 0, sv = 0;
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const j = (y * P + x) * 4; if (!a[j + 3] || !b[j + 3]) continue;
    const u = u0 + (x + 0.5) / k - Rr, v = v0 + (y + 0.5) / k - Rr; if (u * u + v * v > 1.1) continue;
    const d = Math.max(Math.abs(a[j] - b[j] * gc), Math.abs(a[j + 1] - b[j + 1] * gc), Math.abs(a[j + 2] - b[j + 2] * gc)); if (d <= thr) continue; const w = d - thr; sw += w; su += u * w; sv += v * w; }
  return sw < 1 ? { u: u0, v: v0 } : { u: su / sw, v: sv / sw };
}
function cvStep(t) {
  // لا نبحث عن كرات إلا والتتبع موثوق ومستقر؛ وضعية مهتزة أو قفزة تُزيح الصورة المقوَّمة فتبدو حواف القرص كأنها كرات
  if (!trk.ok || trk.jump || (trk.stable < 5 && !scan.manual) || !cb.hasClean) { cb.cands.length = 0; cb.flight = null; return; }
  sampleBoard();
  const cur = cb.cur, prev = cb.prev, bg = cb.bg, clean = cb.clean, map = cb.map, mask = cb.mask, er = cb.er, age = cb.age; let sc = 0, sb = 0, sl = 0;
  for (let k = 0; k < N; k++) { if (map[k] < 0) continue; const j = k * 3; sc += cur[j] + cur[j + 1] + cur[j + 2]; sb += bg[j] + bg[j + 1] + bg[j + 2]; sl += clean[j] + clean[j + 1] + clean[j + 2]; }
  const cl = (v) => Math.min(1.4, Math.max(0.7, v)), gain = cl(sb > 0 ? sc / sb : 1), gc = cl(sl > 0 ? sc / sl : 1);
  const S = (cb.S = sens * Math.max(0.6, Math.min(1, (cb.bmean || 120) / 110)));   // قرص داكن: فروق أصغر بالقيمة المطلقة
  // ١) الطيران: ما تحرك بين إطارين متتاليين
  let mot = 0, mx = 0, my = 0;
  for (let k = 0; k < N; k++) { if (map[k] < 0) continue; const j = k * 3; const d = Math.max(Math.abs(cur[j] - prev[j]), Math.abs(cur[j + 1] - prev[j + 1]), Math.abs(cur[j + 2] - prev[j + 2]));
    prev[j] = cur[j]; prev[j + 1] = cur[j + 1]; prev[j + 2] = cur[j + 2]; if (d > 40) { mot++; mx += k % G; my += (k / G) | 0; } }
  if (mot >= 10 && mot < 700) { const p = g2b(mx / mot, my / mot), fl = cb.flight;
    if (fl && t - fl.t < 400 && Math.hypot(p[0] - fl.u, p[1] - fl.v) < 0.6) { fl.n++; fl.u = p[0]; fl.v = p[1]; fl.t = t; } else cb.flight = { u: p[0], v: p[1], t, n: 1 };
    if (!paused && cb.flight.n >= 2) post('trail', { u: p[0], v: p[1] }); }
  else if (cb.flight && t - cb.flight.t > 700) cb.flight = null;
  // ٢) الاستقرار: ما يختلف عن الخلفية ويثبت (عتبتان: منخفضة لكرة قريبة اللون من خانتها، وعالية للتغير الواضح)
  const lo = S * 0.6, hi = cb.hi;
  for (let k = 0; k < N; k++) { if (map[k] < 0 || cb.out[k]) { mask[k] = 0; hi[k] = 0; continue; } const j = k * 3, d = sdiffT(bg, k, gain, lo);
    if (d > lo) { mask[k] = 1; hi[k] = d > S ? 1 : 0; if (++age[k] > 90) { bg[j] = cur[j]; bg[j + 1] = cur[j + 1]; bg[j + 2] = cur[j + 2]; age[k] = 0; } }
    else { mask[k] = 0; hi[k] = 0; age[k] = 0; bg[j] += (cur[j] - bg[j]) * 0.08; bg[j + 1] += (cur[j + 1] - bg[j + 1]) * 0.08; bg[j + 2] += (cur[j + 2] - bg[j + 2]) * 0.08; } }
  // بوابة الهدوء: كرة واحدة تغيّر نحو ١٪ من سطح القرص؛ تغيّر واسع = شخص أمام القرص أو اهتزاز أو تبدّل إضاءة: لا نحكم
  let cnt = 0, ins = 0; for (let k = 0; k < N; k++) { if (map[k] >= 0 && !cb.out[k]) { ins++; cnt += mask[k]; } }
  cb.busyFrac = ins ? cnt / ins : 1; if (cb.busyFrac > 0.085) { cb.cands.length = 0; cb.flight = null; return; }
  const tmp = cb.tmp; tmp.fill(0); for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const k = y * G + x; tmp[k] = mask[k] | mask[k - 1] | mask[k + 1] | mask[k - G] | mask[k + G]; }
  er.fill(0); for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const k = y * G + x; er[k] = tmp[k] & tmp[k - 1] & tmp[k + 1] & tmp[k - G] & tmp[k + G]; }
  tmp.fill(0); for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const k = y * G + x; tmp[k] = er[k] & er[k - 1] & er[k + 1] & er[k - G] & er[k + G]; }
  er.set(tmp);
  const lab = cb.lab, st = cb.st; lab.fill(0); let L = 0; const found = [];
  for (let i = 0; i < N; i++) { if (!er[i] || lab[i]) continue; L++; let sp = 0, a = 0, sx = 0, sy = 0, x0 = G, x1 = 0, y0 = G, y1 = 0, dc = 0, db = 0, nh = 0; st[sp++] = i; lab[i] = L;
    while (sp) { const p = st[--sp], x = p % G, y = (p / G) | 0; a++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      nh += hi[p]; if (a < 900) { dc += sdiffT(clean, p, gc, 0); db += sdiffT(bg, p, gain, 0); }
      if (er[p - 1] && !lab[p - 1]) { lab[p - 1] = L; st[sp++] = p - 1; } if (er[p + 1] && !lab[p + 1]) { lab[p + 1] = L; st[sp++] = p + 1; }
      if (er[p - G] && !lab[p - G]) { lab[p - G] = L; st[sp++] = p - G; } if (er[p + G] && !lab[p + G]) { lab[p + G] = L; st[sp++] = p + G; } }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, ar = bw / bh;
    if (a < 26 || a > 900 || bw > 44 || bh > 44) continue;                                    // ليست بحجم كرة
    const fill = a / (bw * bh), strong = nh >= a * 0.2;
    if (strong ? fill < 0.45 || ar < 0.45 || ar > 2.2 : fill < 0.6 || ar < 0.65 || ar > 1.55) continue;   // تغيّر ضعيف: نقبله فقط إن كان مستديرًا بوضوح
    const p = g2b(sx / a, sy / a); if (Math.hypot(p[0], p[1]) > 1.0) continue;
    found.push({ a, u: p[0], v: p[1], clean: dc < db * 0.5, strong, x0, x1, y0, y1, n: 1 }); }
  const next = [];
  for (const f of found) { const c = cb.cands.find((c) => !c.used && Math.hypot(c.u - f.u, c.v - f.v) < 0.07 && f.a > c.a * 0.5 && f.a < c.a * 2);
    if (c) { c.used = 1; f.n = c.n + 1; f.first = c.first; f.move = Math.hypot(c.u - f.u, c.v - f.v); } else { f.first = t; f.move = 1; }
    const fl = cb.flight, fromFlight = fl && t - fl.t < 900 && Math.hypot(fl.u - f.u, fl.v - f.v) < 0.35;
    const need = (fromFlight && trk.move < 0.004 ? 4 : 5) + (f.strong ? 0 : 4);
    if (f.n < need || t - f.first < 200 || f.move > (f.strong ? 0.022 : 0.04)) { next.push(f); continue; }
    for (let y = Math.max(0, f.y0 - 3); y <= Math.min(G - 1, f.y1 + 3); y++) for (let x = Math.max(0, f.x0 - 3); x <= Math.min(G - 1, f.x1 + 3); x++) { const k = y * G + x, j = k * 3; bg[j] = cur[j]; bg[j + 1] = cur[j + 1]; bg[j + 2] = cur[j + 2]; age[k] = 0; }
    if (f.clean) continue;                                                                   // عاد القرص فارغًا هنا: كرة أُزيلت
    const sp = subpixel(f.u, f.v, gc);
    if (cb.balls.some((b) => Math.hypot(b.u - sp.u, b.v - sp.v) < 0.08 || Math.hypot(b.u - f.u, b.v - f.v) < 0.08)) continue;   // الكرة نفسها (كرة جديدة ملاصقة تبعد ≥ قطر كرة فتُحتسب)
    cb.balls.push({ u: sp.u, v: sp.v }); cb.flight = null; if (!paused) post('hit', { u: sp.u, v: sp.v }); }
  cb.cands = next;
  cb.balls = cb.balls.filter((b) => { const gx = Math.round((b.u / EXT + 1) / 2 * G - 0.5), gy = Math.round((b.v / EXT + 1) / 2 * G - 0.5); let s = 0, n = 0;
    for (let y = gy - 2; y <= gy + 2; y++) for (let x = gx - 2; x <= gx + 2; x++) { if (x < 0 || y < 0 || x >= G || y >= G) continue; const k = y * G + x; if (map[k] < 0) continue; s += sdiffT(clean, k, gc, S); n++; }
    return !n || s / n > S * 0.8; });
}

/* ---------- وضعية الكاميرا ثلاثية الأبعاد من الهوموغرافي ---------- */
const pose3 = { ok: false };
function updatePose(Hv) {
  const f = Math.max(src.w, src.h) * 1.05, cx = src.w / 2, cy = src.h / 2, H = Hv;
  const m = [(H[0] - cx * H[6]) / f, (H[1] - cx * H[7]) / f, (H[2] - cx * H[8]) / f, (H[3] - cy * H[6]) / f, (H[4] - cy * H[7]) / f, (H[5] - cy * H[8]) / f, H[6], H[7], H[8]];
  let r1 = [m[0], m[3], m[6]], r2 = [m[1], m[4], m[7]], t = [m[2], m[5], m[8]]; const n1 = Math.hypot(...r1), n2 = Math.hypot(...r2), lam = 2 / (n1 + n2);
  r1 = r1.map((v) => v * lam); r2 = r2.map((v) => v * lam); t = t.map((v) => v * lam); if (t[2] < 0) { r1 = r1.map((v) => -v); r2 = r2.map((v) => -v); t = t.map((v) => -v); }
  const d = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2]; r2 = r2.map((v, i) => v - d * r1[i]); const n2b = Math.hypot(...r2); r2 = r2.map((v) => v / n2b); const n1b = Math.hypot(...r1); r1 = r1.map((v) => v / n1b);
  const r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  Object.assign(pose3, { r1, r2, r3, t, f, cx, cy, ok: true });
}

/* ---------- حلقة الإطار ---------- */
function enterScan() { mode = 'scan'; scan.manual = false; scan.good = 0; scan.locked = false; trk.H = null; trk.ok = false; trk.lost = 99; trk.pts = []; trk.stable = 0; trk.prevH = null; cb.balls = []; cb.cands = []; cb.hasClean = false; }
function resetTrack() { trk.H = null; trk.ok = false; trk.lost = 99; trk.pts = []; trk.stable = 0; trk.prevH = null; scan.locked = false; scan.good = 0; cb.cands = []; cb.flight = null; cb.hasClean = false; if (M.prevGray) { M.prevGray.delete(); M.prevGray = null; } }
const toVideo = (H) => { const s = src.w / PW; return norm9([H[0] * s, H[1] * s, H[2] * s, H[3] * s, H[4] * s, H[5] * s, H[6], H[7], H[8]]); };
const fromVideo = (H) => { const s = PW / src.w; return norm9([H[0] * s, H[1] * s, H[2] * s, H[3] * s, H[4] * s, H[5] * s, H[6], H[7], H[8]]); };
function onFrame(m) {
  const t = m.t, t0 = performance.now();
  if (m.w !== PW || m.h !== PH) { PW = m.w; PH = m.h; if (M.rgba) { M.rgba.delete(); M.gray.delete(); M.eq.delete(); if (M.prevGray) M.prevGray.delete(); M.prevGray = null; } M.rgba = new cv.Mat(PH, PW, cv.CV_8UC4); M.gray = new cv.Mat(PH, PW, cv.CV_8UC1); M.eq = new cv.Mat(); cb.hasClean = false; if (M.cleanRgba) { M.cleanRgba.delete(); M.cleanRgba = null; } }
  frame = new Uint8ClampedArray(m.buf); M.rgba.data.set(frame); cv.cvtColor(M.rgba, M.gray, cv.COLOR_RGBA2GRAY);
  M.mean = cv.mean(M.gray)[0];
  if (mode === 'scan') { track(); if (trk.ok) { scan.good++; if (scan.good >= 2 && !scan.locked) { scan.locked = true; post('locked', {}); } } else { scan.good = 0; if (trk.lost > 15) scan.locked = false; } }
  else if (mode === 'arming') { track(); if (t - armT > 1100) { if (trk.ok && trk.stable >= 3) { rebase(); mode = 'play'; post('playing'); } else armT = t; } }
  else if (mode === 'play') { track(); const T1 = performance.now(); cvStep(t); trk.tCv = performance.now() - T1; }
  if (mode !== 'play' || trk.frames % 30 === 0) learnLive(t);
  // الإطار الحالي يصبح السابق للتدفق البصري
  if (!M.prevGray) M.prevGray = new cv.Mat(); M.gray.copyTo(M.prevGray);
  let Hv = null, pts = null; if (trk.H) { Hv = toVideo(trk.H); pts = BP.map((q) => apply(Hv, q[0], q[1])); updatePose(Hv); } else pose3.ok = false;
  post('pose', { ms: performance.now() - t0, score: trk.inl, tm: trk.mode + (trk.live ? '+live' : ''), stable: trk.stable, busy: cb.busyFrac || 0, pw: PW, ph: PH, ok: trk.ok, q: trk.q, rms: trk.rms, lost: trk.lost, jump: trk.jump, locked: scan.locked, manual: scan.manual, mode, pts, H: Hv, inl: trk.inl, engine: 'cv', dbg: [trk.tTrack | 0, trk.tCv | 0, trk.pts.length, refs.length, cb.cands.length],
    pose3: pose3.ok ? { r1: pose3.r1, r2: pose3.r2, r3: pose3.r3, t: pose3.t, f: pose3.f, cx: pose3.cx, cy: pose3.cy } : null, balls: cb.balls.map((b) => [b.u, b.v]), rings: RINGS });
}
let refImg = null;
function handle(m) {
  switch (m.type) {
    case 'ref': refImg = m; if (ready) installRef(); break;
    case 'init': src = { w: m.w, h: m.h }; enterScan(); break;
    case 'dims': src = { w: m.w, h: m.h }; resetTrack(); break;
    case 'scan': enterScan(); break;
    case 'manual': scan.manual = m.on; if (m.on && !trk.H && PW) { const r = Math.min(PW, PH) * 0.3, cx = PW / 2, cy = PH / 2; trk.H = solveH(BP, [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]); } if (m.on) { trk.ok = !!trk.H; trk.stable = 10; } else { scan.locked = false; scan.good = 0; trk.pts = []; trk.ok = false; } break;
    case 'setPts': if (m.pts) { const H = solveH(BP, m.pts); if (H) trk.H = fromVideo(H); } break;
    case 'rotate': if (trk.H && scan.manual) { const a = (120 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); trk.H = norm9(mul3(trk.H, [c, -s, 0, s, c, 0, 0, 0, 1])); } break;
    case 'arm': mode = 'arming'; armT = m.t; break;
    case 'pause': paused = m.on; break;
    case 'rebase': if (trk.ok && frame) { rebase(); liveAt = 0; } break;
    case 'sens': sens = m.v; break;
    case 'frame': if (!ready) { post('pose', { ok: false, q: 0, rms: 1, lost: 99, jump: false, locked: false, manual: false, mode, pts: null, H: null, pose3: null, balls: [], rings: RINGS, engine: failed ? 'fail' : 'loading', pw: m.w, ph: m.h }); return; } onFrame(m); break;
  }
}
function installRef() { if (!refImg || !cv) return; const g = new cv.Mat(refImg.h, refImg.w, cv.CV_8UC1), d = new Uint8ClampedArray(refImg.buf); for (let i = 0, n = refImg.w * refImg.h; i < n; i++) g.data[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 151 + d[i * 4 + 2] * 28) >> 8;
  let g512 = g; if (refImg.w !== REF.size) { g512 = new cv.Mat(); cv.resize(g, g512, M.rsz, 0, 0, cv.INTER_AREA); g.delete(); }
  setRefs(buildRefs(g512, false), false); g512.delete(); refImg = null; }
self.onmessage = (e) => { try { handle(e.data); } catch (err) { if (e.data && e.data.type === 'frame') { resetTrack(); post('pose', { ok: false, q: 0, rms: 1, lost: 99, jump: false, locked: false, manual: scan.manual, mode, pts: null, H: null, pose3: null, balls: [], rings: RINGS, engine: 'cv', err: String((err && err.message) || err) }); } } };
loadCV().then(() => { initMats(); ready = true; installRef(); post('engine', { state: 'ready' }); }).catch((err) => { failed = true; post('engine', { state: 'fail', err: String((err && err.message) || err) }); });
