// مصدر الصورة (كاميرا أو مشهد تجريبي) + ضخ الإطارات إلى عامل الرؤية مع ضغط خلفي (لا نرسل إطارًا جديدًا قبل رد العامل).
import { drawBoard } from './geometry.js';

const PW = 800;

export class VisionClient extends EventTarget {
  constructor() {
    super();
    this.worker = new Worker('./js/vision/worker.js');
    this.worker.onmessage = (e) => this.#onMessage(e.data);
    this.busy = false;
    this.src = null; // {el,w,h,demo}
    this.proc = document.createElement('canvas');
    this.pctx = this.proc.getContext('2d', { willReadFrequently: true });
    this.pose = { ok: false, q: 0, mode: 'scan', H: null, pts: null, pose3: null, balls: [], rings: [0.165, 0.615, 0.965] };
    this.frameId = 0; this.newFrame = true; this.lastSent = 0; this.lastRoundTrip = 0;
    this.brightness = 0.5;
    this.demo = null;
  }
  #onMessage(m) {
    if (m.type === 'pose') { this.busy = false; this.lastRoundTrip = performance.now() - this.lastSent; this.pose = m; this.dispatchEvent(new CustomEvent('pose', { detail: m })); return; }
    this.dispatchEvent(new CustomEvent(m.type, { detail: m }));
  }
  send(msg) { this.worker.postMessage(msg); }

  async openCamera(facing = 'environment') {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nosupport');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } } });
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
    this.src = { el: cv, w: cv.width, h: cv.height, demo: true };
    this.send({ type: 'init', w: cv.width, h: cv.height });
    return this.src;
  }
  stop() { if (this.src?.stream) this.src.stream.getTracks().forEach((t) => t.stop()); this.src = null; }

  drawDemo(t) {
    const d = this.demo, c = d.cv.getContext('2d'), w = d.cv.width, h = d.cv.height;
    if (d.raw) { c.drawImage(d.raw, 0, 0, w, h); for (const b of d.rawBalls) ball(c, b.x, b.y, b.r); return; }
    const T = d.T, T0 = d.T0, k = d.shake ? 1 : 0;
    T.cx = T0.cx + k * (22 * Math.sin(t / 170) + 9 * Math.sin(t / 61)); T.cy = T0.cy + k * (16 * Math.sin(t / 230 + 1) + 8 * Math.sin(t / 47));
    T.rot = T0.rot + k * 0.05 * Math.sin(t / 390); T.r = T0.r * (1 + k * 0.05 * Math.sin(t / 510));
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfd6d2'); g.addColorStop(1, '#aab4ae'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9ece6'; c.fillRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8); c.strokeStyle = '#7d8a83'; c.lineWidth = 6; c.strokeRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
    c.save(); c.translate(T.cx, T.cy); c.rotate(T.rot); c.scale(T.r, T.r * T.sy);
    if (d.img) { const G = d.imgGeo; c.drawImage(d.img, -G.cx / G.r, -G.cy / G.r, d.img.width / G.r, d.img.height / G.r); } else drawBoard(c);
    for (const b of d.balls) { const k2 = Math.min(1, (t - b.t0) / 240), e = 1 - (1 - k2) * (1 - k2); ball(c, b.u + (1 - e) * b.du, b.v + (1 - e) * b.dv, 0.115 * (1 + (1 - e) * 1.6), b.col, e > 0.98); }
    c.restore();
  }
  demoToBoard(x, y) { const T = this.demo.T, dx = x - T.cx, dy = y - T.cy, cs = Math.cos(-T.rot), sn = Math.sin(-T.rot); return [(dx * cs - dy * sn) / T.r, (dx * sn + dy * cs) / (T.r * T.sy)]; }
  demoBoardToVideo(u, v) { const T = this.demo.T, x = u * T.r, y = v * T.r * T.sy, c = Math.cos(T.rot), s = Math.sin(T.rot); return [T.cx + x * c - y * s, T.cy + x * s + y * c]; }

  // يُستدعى كل إطار رسم؛ يرسل إطارًا للعامل إن كان جاهزًا
  pump(t) {
    if (!this.src) return;
    if (this.src.demo) this.drawDemo(t);
    const fresh = this.src.demo || this.newFrame || !this.src.el.requestVideoFrameCallback;
    if (this.busy || !fresh) return;
    this.newFrame = false;
    const ph = Math.round((PW * this.src.h) / this.src.w);
    if (this.proc.width !== PW || this.proc.height !== ph) { this.proc.width = PW; this.proc.height = ph; }
    this.pctx.drawImage(this.src.el, 0, 0, PW, ph);
    const img = this.pctx.getImageData(0, 0, PW, ph);
    // تقدير إضاءة البيئة من عيّنة متفرقة (لتلوين المؤثرات)
    let s = 0, n = 0; const d = img.data; for (let i = 0; i < d.length; i += 4 * 97) { s += d[i] + d[i + 1] + d[i + 2]; n++; }
    this.brightness = s / (n * 765);
    this.busy = true; this.lastSent = t;
    this.worker.postMessage({ type: 'frame', buf: img.data.buffer, w: PW, h: ph, t }, [img.data.buffer]);
  }
}

function ball(c, x, y, r, col, shadow) {
  if (shadow) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.34, r * 0.95, r * 0.9, 0, 0, 7); c.fill(); } // ظل الكرة على القماش
  const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, col ? col[0] : '#bfe6ff'); gr.addColorStop(0.55, col ? col[1] : '#3b8fe0'); gr.addColorStop(1, col ? col[2] : '#1c6fd1'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
