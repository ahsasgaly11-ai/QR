// مصدر الصورة (كاميرا أو مشهد تجريبي) + ضخ الإطارات إلى عامل الرؤية مع ضغط خلفي (لا نرسل إطارًا جديدًا قبل رد العامل).
import { drawBoard } from './geometry.js';

const PROC_MAX = 800, PROC_MIN = 480; // أطول ضلع لصورة المعالجة؛ يُخفَّض تلقائيًا على الأجهزة الأبطأ

export class VisionClient extends EventTarget {
  constructor() {
    super();
    this.busy = false;
    this.src = null; // {el,w,h,demo}
    this.proc = document.createElement('canvas');
    this.pctx = this.proc.getContext('2d', { willReadFrequently: true });
    this.pose = { ok: false, q: 0, mode: 'scan', H: null, pts: null, pose3: null, balls: [], rings: [0.165, 0.615, 0.965] };
    this.frameId = 0; this.newFrame = true; this.lastSent = 0; this.lastRoundTrip = 0;
    this.brightness = 0.5; this.procMax = PROC_MAX; this.stat = { n: 0, t0: performance.now(), fps: 0, ms: 0, rt: 0 };
    this.demo = null; this.engine = { name: 'cv', state: 'loading', pct: 0 }; this.sent = [];
    this.#spawn(window.__forceLegacyEngine ? 'legacy' : 'cv');
  }
  // محرك الرؤية ٤ (OpenCV WebAssembly: ميزات + تدفق بصري) وإلا المحرك الاحتياطي (ألوان + حواف) إن تعذّر تحميله
  #spawn(name) {
    if (this.worker) this.worker.terminate();
    this.engine = { name, state: name === 'cv' ? 'loading' : 'ready', pct: 0 };
    this.worker = new Worker(name === 'cv' ? './js/vision/engine-cv.js' : './js/vision/worker.js');
    this.worker.onmessage = (e) => this.#onMessage(e.data);
    this.worker.onerror = (e) => { this.busy = false; if (name === 'cv' && this.engine.state !== 'ready') this.#fallback('worker error'); };
    this.busy = false;
    if (name === 'cv') { this.#loadRef(); this.engineTimer = setTimeout(() => { if (this.engine.state !== 'ready') this.#fallback('timeout'); }, 90000); }
    // أعد إرسال حالة المصدر إلى المحرك الجديد
    for (const m of this.sent) this.worker.postMessage(m);
    this.dispatchEvent(new CustomEvent('engine', { detail: this.engine }));
  }
  #fallback(reason) { if (this.engine.name !== 'cv') return; clearTimeout(this.engineTimer); this.engine.fallbackReason = reason; this.#spawn('legacy'); }
  async #loadRef() { // الصورة المرجعية القانونية للقرص (يُفكّ ترميزها هنا لأن بعض المتصفحات لا تدعم ذلك داخل العامل)
    try { const img = new Image(); img.src = './assets/board-ref.png'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height);
      if (this.engine.name === 'cv') this.worker.postMessage({ type: 'ref', buf: d.data.buffer, w: c.width, h: c.height }, [d.data.buffer]); }
    catch (e) { this.#fallback('ref'); }
  }
  #onMessage(m) {
    if (m.type === 'pose') { this.busy = false; const now = performance.now(); this.lastRoundTrip = now - this.lastSent; this.pose = m;
      // قياس الأداء والتكيّف: إن طال زمن الإطار نخفّض دقة المعالجة حتى يلحق التتبع بحركة اليد
      this.stat.n++; this.stat.ms = this.stat.ms * 0.9 + (m.ms || 0) * 0.1; this.stat.rt = this.stat.rt * 0.9 + this.lastRoundTrip * 0.1;
      if (now - this.stat.t0 > 1000) { this.stat.fps = (this.stat.n * 1000) / (now - this.stat.t0); this.stat.n = 0; this.stat.t0 = now;
        // المعيار زمن المعالجة لا عدد الإطارات: الكاميرا نفسها تُبطئ إطاراتها في الإضاءة الضعيفة، وهذا ليس بطئًا في الجهاز
        if (!this.src?.demo && m.mode === 'play') { if (this.stat.ms > 34 && this.procMax > PROC_MIN) this.procMax = Math.max(PROC_MIN, this.procMax - 80); else if (this.stat.ms < 14 && this.procMax < PROC_MAX) this.procMax = Math.min(PROC_MAX, this.procMax + 40); } }
      this.dispatchEvent(new CustomEvent('pose', { detail: m })); return; }
    if (m.type === 'engine') { Object.assign(this.engine, m); delete this.engine.type; if (m.state === 'ready') clearTimeout(this.engineTimer); if (m.state === 'fail') { this.#fallback(m.err); return; } }
    this.dispatchEvent(new CustomEvent(m.type, { detail: m }));
  }
  send(msg) { if (msg.type === 'init' || msg.type === 'dims') this.sent = [{ type: 'init', w: msg.w, h: msg.h }]; else if (msg.type === 'sens') this.sent.push(msg); this.worker.postMessage(msg); }

  async openCamera(facing = 'environment') {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nosupport');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } } });
    // تركيز وتعريض مستمران إن دعمهما الجهاز (يقلّل ضبابية الحركة والتذبذب)
    try { const tr = stream.getVideoTracks()[0], caps = tr.getCapabilities?.() || {}, adv = {}; if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous'; if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous'; if (Object.keys(adv).length) await tr.applyConstraints({ advanced: [adv] }); } catch {}
    const el = document.createElement('video');
    el.setAttribute('playsinline', ''); el.muted = true; el.autoplay = true; el.srcObject = stream;
    await el.play();
    await new Promise((r) => { const k = () => (el.videoWidth ? r() : setTimeout(k, 30)); k(); });
    this.stop();
    this.src = { el, w: el.videoWidth, h: el.videoHeight, demo: false, stream };
    if (el.requestVideoFrameCallback) { const onF = () => { this.newFrame = true; if (this.src?.el === el) el.requestVideoFrameCallback(onF); }; el.requestVideoFrameCallback(onF); } else this.rvfc = false;
    this.send({ type: 'init', w: this.src.w, h: this.src.h });
    return this.src;
  }
  openDemo(landscape) {
    this.stop();
    const cv = document.createElement('canvas'); cv.width = landscape ? 1280 : 720; cv.height = landscape ? 720 : 1280;
    const r = Math.min(cv.width, cv.height) * 0.36;
    this.demo = { cv, T: { cx: cv.width / 2, cy: cv.height / 2, r, sy: 0.93, rot: (4 * Math.PI) / 180 }, T0: null, shake: false, balls: [], img: null, imgGeo: null, raw: null, rawBalls: [] };
    this.demo.T0 = { ...this.demo.T };
    // المشهد التجريبي يعرض صورة القرص الحقيقي (المرجع القانوني) لا رسمًا تخطيطيًا
    const d = this.demo, img = new Image(); img.onload = () => { if (this.demo === d && !d.img) { d.img = img; d.imgGeo = { cx: 256, cy: 256, r: 248 }; } }; img.src = './assets/board-ref.png';
    this.src = { el: cv, w: cv.width, h: cv.height, demo: true };
    this.send({ type: 'init', w: cv.width, h: cv.height });
    return this.src;
  }
  stop() { if (this.src?.stream) this.src.stream.getTracks().forEach((t) => t.stop()); this.src = null; }

  drawDemo(t) {
    const d = this.demo, c = d.cv.getContext('2d'), w = d.cv.width, h = d.cv.height;
    if (d.raw) { // صورة ثابتة (منظور) مع حركة يد اختيارية وعائق متحرك وإضاءة متغيرة (للاختبار الآلي)
      const m = d.rawMotion || null; c.save(); c.fillStyle = '#9aa39d'; c.fillRect(0, 0, w, h);
      if (m) { const k = m.amp || 0; c.translate(w / 2 + k * (Math.sin(t / 310) * 1.0 + Math.sin(t / 97) * 0.4), h / 2 + k * (Math.sin(t / 260 + 1) * 0.8 + Math.sin(t / 71) * 0.4)); c.rotate((m.rot || 0) * Math.sin(t / 530)); const z = 1 + (m.zoom || 0) * Math.sin(t / 700); c.scale(z, z); c.translate(-w / 2, -h / 2); }
      c.drawImage(d.raw, 0, 0, w, h); for (const b of d.rawBalls) ball(c, b.x, b.y, b.r); c.restore();
      if (d.occluder) { const o = d.occluder, x = o.x0 + (t - o.t0) * o.vx; c.fillStyle = o.col || '#3a2f28'; c.fillRect(x, o.y, o.w, o.h); c.fillStyle = '#d9b48f'; c.beginPath(); c.arc(x + o.w / 2, o.y - 10, o.w * 0.35, 0, 7); c.fill(); }
      if (d.light != null) { const L = d.light; c.fillStyle = L < 1 ? `rgba(0,0,0,${1 - L})` : `rgba(255,255,255,${Math.min(0.6, L - 1)})`; c.fillRect(0, 0, w, h); }
      return; }
    const T = d.T, T0 = d.T0, k = d.shake ? 1 : 0;
    T.cx = T0.cx + k * (22 * Math.sin(t / 170) + 9 * Math.sin(t / 61)); T.cy = T0.cy + k * (16 * Math.sin(t / 230 + 1) + 8 * Math.sin(t / 47));
    T.rot = T0.rot + k * 0.05 * Math.sin(t / 390); T.r = T0.r * (1 + k * 0.05 * Math.sin(t / 510));
    if (d.real) { T.cx += 3.5 * Math.sin(t / 23) + 2.5 * Math.sin(t / 37 + 2) + (Math.random() - 0.5) * 2.5; T.cy += 3 * Math.sin(t / 29 + 1) + 2.5 * Math.sin(t / 41) + (Math.random() - 0.5) * 2.5; T.rot += 0.006 * Math.sin(t / 53); }
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfd6d2'); g.addColorStop(1, '#aab4ae'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9ece6'; c.fillRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8); c.strokeStyle = '#7d8a83'; c.lineWidth = 6; c.strokeRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
    c.save(); c.translate(T.cx, T.cy); c.rotate(T.rot); c.scale(T.r, T.r * T.sy);
    if (d.img) { const G = d.imgGeo; c.drawImage(d.img, -G.cx / G.r, -G.cy / G.r, d.img.width / G.r, d.img.height / G.r); } else drawBoard(c);
    for (const b of d.balls) { const k2 = Math.min(1, (t - b.t0) / 240), e = 1 - (1 - k2) * (1 - k2); ball(c, b.u + (1 - e) * b.du, b.v + (1 - e) * b.dv, 0.115 * (1 + (1 - e) * 1.6), b.col, e > 0.98); }
    c.restore();
    if (d.real) { // ضجيج الحساس + وميض التعريض التلقائي
      if (!d.noise) { const n = document.createElement('canvas'); n.width = n.height = 256; const nc = n.getContext('2d'), im = nc.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v; im.data[i + 1] = Math.random() * 255; im.data[i + 2] = Math.random() * 255; im.data[i + 3] = 255; } nc.putImageData(im, 0, 0); d.noise = n; }
      c.save(); c.globalAlpha = 0.09; c.globalCompositeOperation = 'overlay'; const ox = -Math.random() * 256, oy = -Math.random() * 256; for (let y = oy; y < h; y += 256) for (let x = ox; x < w; x += 256) c.drawImage(d.noise, x, y); c.restore();
      const fl = 0.05 * Math.sin(t / 900) + 0.03 * Math.sin(t / 130); c.fillStyle = fl > 0 ? `rgba(255,255,255,${fl})` : `rgba(0,0,0,${-fl})`; c.fillRect(0, 0, w, h); }
  }
  demoToBoard(x, y) { const T = this.demo.T, dx = x - T.cx, dy = y - T.cy, cs = Math.cos(-T.rot), sn = Math.sin(-T.rot); return [(dx * cs - dy * sn) / T.r, (dx * sn + dy * cs) / (T.r * T.sy)]; }
  demoBoardToVideo(u, v) { const T = this.demo.T, x = u * T.r, y = v * T.r * T.sy, c = Math.cos(T.rot), s = Math.sin(T.rot); return [T.cx + x * c - y * s, T.cy + x * s + y * c]; }

  // يُستدعى كل إطار رسم؛ يرسل إطارًا للعامل إن كان جاهزًا
  pump(t) {
    if (!this.src) return;
    if (this.src.demo) this.drawDemo(t);
    else { const el = this.src.el; if (el.videoWidth && (el.videoWidth !== this.src.w || el.videoHeight !== this.src.h)) { // iPhone/iPad: تدوير الجهاز يبدّل أبعاد الفيديو
      this.src.w = el.videoWidth; this.src.h = el.videoHeight; this.pose = { ...this.pose, ok: false, H: null, pts: null, pose3: null, balls: [] }; this.send({ type: 'dims', w: this.src.w, h: this.src.h }); this.dispatchEvent(new CustomEvent('dims')); } }
    const fresh = this.src.demo || this.newFrame || !this.src.el.requestVideoFrameCallback;
    if (this.busy && t - this.lastSent > 1500) this.busy = false; // حارس: لو لم يردّ العامل على إطار نكمل بالتالي ولا يتجمد التتبع
    if (this.busy || !fresh) return;
    this.newFrame = false;
    // أطول ضلع = procMax في الوضعين العرضي والطولي (كان الطولي يُعالَج بثلاثة أضعاف البكسلات)
    const M = this.procMax, land = this.src.w >= this.src.h, pw = land ? M : Math.round((M * this.src.w) / this.src.h), ph = land ? Math.round((M * this.src.h) / this.src.w) : M;
    if (this.proc.width !== pw || this.proc.height !== ph) { this.proc.width = pw; this.proc.height = ph; }
    this.pctx.drawImage(this.src.el, 0, 0, pw, ph);
    const img = this.pctx.getImageData(0, 0, pw, ph);
    // تقدير إضاءة البيئة من عيّنة متفرقة (لتلوين المؤثرات)
    let s = 0, n = 0; const d = img.data; for (let i = 0; i < d.length; i += 4 * 97) { s += d[i] + d[i + 1] + d[i + 2]; n++; }
    this.brightness = s / (n * 765);
    this.busy = true; this.lastSent = t;
    this.worker.postMessage({ type: 'frame', buf: img.data.buffer, w: pw, h: ph, t }, [img.data.buffer]);
  }
}

function ball(c, x, y, r, col, shadow) {
  if (shadow) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.34, r * 0.95, r * 0.9, 0, 0, 7); c.fill(); } // ظل الكرة على القماش
  const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, col ? col[0] : '#bfe6ff'); gr.addColorStop(0.55, col ? col[1] : '#3b8fe0'); gr.addColorStop(1, col ? col[2] : '#1c6fd1'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
