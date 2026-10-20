// ---------------------------------------------------------------------------
// متتبّع الأيدي: كاميرا الآيباد ← MediaPipe Hand Landmarker ← مصفوفة المعايرة
// ← مؤشرات على الشاشة.
//
// الكاميرا تعمل في عنصر فيديو مخفي؛ صورتها لا تُرسم على الصفحة أبدًا (إلا في
// معاينة لوحة المعلم عند طلبها)، فلا تظهر في انعكاس الشاشة على السبورة.
//
// لكل يد مُعرّف ثابت عبر الإطارات (مطابقة بأقرب مسافة)، ومرشّح One Euro لكل
// محور، فيبقى المؤشر ثابتًا حين تثبت اليد ويتبعها بلا تأخّر حين تتحرك.
// ---------------------------------------------------------------------------
import { applyH, invert3, OneEuro } from './geometry.js';

const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;
const MODEL = new URL('../models/hand_landmarker.task', import.meta.url).href;

/** مدة بقاء أثر اليد بعد اختفائها — إن ظهرت خلالها قريبًا من مكانها تحتفظ بمعرّفها (وبالسن الذي تحمله). */
export const TRACK_TTL_MS = 900;
const MATCH_DIST = 0.16; // أقصى قفزة مقبولة بين إطارين (نسبة من الشاشة)
const MAX_HANDS = 4;

// معالم اليد في MediaPipe: 0 الرسغ، 5/9/13/17 قواعد الأصابع، 8 طرف السبابة.
const PALM = [0, 5, 9, 13, 17];
const INDEX_TIP = 8;

export class HandTracker {
  /**
   * @param {{video: HTMLVideoElement, onHands: (hands:{id:number,x:number,y:number}[], t:number)=>void,
   *          onStatus?: (state:string, text:string)=>void, getHandPoint: ()=>'palm'|'finger'}} o
   */
  constructor({ video, onHands, onStatus, getHandPoint }) {
    this.video = video;
    this.onHands = onHands;
    this.onStatus = onStatus || (() => {});
    this.getHandPoint = getHandPoint;
    this.landmarker = null;
    this.stream = null;
    this.H = null;
    this.tracks = new Map();
    this.nextId = 1;
    this.running = false;
    this.lastTs = 0;
    this.lastVideoTime = -1;
    this.fps = 0;
    this._fpsCount = 0;
    this._fpsT = 0;
    this.lastResult = null; // آخر معالم خام (للمعاينة)
    this.delegate = null;
    this.forceCpu = false;
    this._errors = 0;
  }

  setCalibration(H) {
    this.H = H || null;
    this.tracks.clear();
  }

  get active() {
    return !!this.stream;
  }

  async listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  }

  async loadModel() {
    if (this.landmarker) return this.landmarker;
    this.onStatus('loading', 'تحميل نموذج تتبّع اليد…');
    const { FilesetResolver, HandLandmarker } = await import(`${VENDOR}vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
    if (/_nosimd_/.test(fileset.wasmBinaryPath)) {
      // نوفّر نسخة SIMD فقط (كل آيباد بنظام iPadOS 16.4 فأحدث يدعمها)
      throw new Error('nosimd');
    }
    const make = (delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        numHands: MAX_HANDS,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      // ‎?cpu في الرابط يفرض المعالج (للتشخيص إن أساء معالج الرسوم التصرّف على جهاز ما)
      if (this.forceCpu || new URLSearchParams(location.search).has('cpu')) throw new Error('cpu forced');
      this.landmarker = await make('GPU');
      this.delegate = 'GPU';
    } catch {
      this.landmarker = await make('CPU');
      this.delegate = 'CPU';
    }
    return this.landmarker;
  }

  async start(deviceId) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
    const video = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: 'environment' } };
    Object.assign(video, { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } });
    this.onStatus('loading', 'تشغيل الكاميرا…');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    await this.loadModel();
    this.running = true;
    this.tracks.clear();
    this.onStatus('running', 'الكاميرا تعمل');
    this._schedule();
    const track = this.stream.getVideoTracks()[0];
    return track?.getSettings?.().deviceId || deviceId || '';
  }

  async _fallbackToCpu() {
    try {
      this.landmarker?.close();
    } catch {
      /* لا شيء */
    }
    this.landmarker = null;
    this.forceCpu = true;
    try {
      await this.loadModel();
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
    this.tracks.clear();
    this.lastResult = null;
    this.onStatus('off', 'الكاميرا متوقفة');
  }

  _schedule() {
    if (!this.running) return;
    const v = this.video;
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => this._tick());
    else requestAnimationFrame(() => this._tick());
  }

  _tick() {
    if (!this.running) return;
    try {
      const v = this.video;
      if (v.paused && v.srcObject) v.play().catch(() => {}); // بعد قفل الآيباد أو تبديل التطبيق
      if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime && this.landmarker) {
        this.lastVideoTime = v.currentTime;
        let ts = performance.now();
        if (ts <= this.lastTs) ts = this.lastTs + 1; // الطوابع يجب أن تتزايد تمامًا
        this.lastTs = ts;
        const res = this.landmarker.detectForVideo(v, ts);
        this.lastResult = res;
        this._process(res?.landmarks || [], ts);
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

  _countFps(t) {
    this._fpsCount++;
    if (t - this._fpsT >= 1000) {
      this.fps = Math.round((this._fpsCount * 1000) / (t - this._fpsT));
      this._fpsCount = 0;
      this._fpsT = t;
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

  _process(landmarks, t) {
    // تنظيف الآثار القديمة
    for (const [id, tr] of this.tracks) if (t - tr.seen > TRACK_TTL_MS) this.tracks.delete(id);
    if (!this.H) {
      this.onHands([], t);
      return;
    }

    // ١) نقل كل يد إلى إحداثيات الشاشة، مع إهمال ما يقع خارج الصورة المعروضة.
    const dets = [];
    for (const lm of landmarks) {
      const c = this.handCamPoint(lm);
      const p = applyH(this.H, c.x, c.y);
      if (!p) continue;
      if (p.x < -0.06 || p.x > 1.06 || p.y < -0.06 || p.y > 1.06) continue;
      dets.push(p);
    }

    // ٢) مطابقة جشعة بأقرب مسافة بين الأيدي الحالية والآثار السابقة.
    const pairs = [];
    dets.forEach((d, di) => {
      for (const [id, tr] of this.tracks) {
        const dist = Math.hypot(d.x - tr.x, d.y - tr.y);
        if (dist < MATCH_DIST * (1 + (t - tr.seen) / TRACK_TTL_MS)) pairs.push({ di, id, dist });
      }
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const usedD = new Set();
    const usedT = new Set();
    const out = [];
    for (const { di, id } of pairs) {
      if (usedD.has(di) || usedT.has(id)) continue;
      usedD.add(di);
      usedT.add(id);
      out.push(this._update(this.tracks.get(id), dets[di], t));
    }
    dets.forEach((d, di) => {
      if (usedD.has(di)) return;
      const id = this.nextId++;
      const tr = {
        id,
        fx: new OneEuro({ minCutoff: 1.1, beta: 6, dCutoff: 1 }),
        fy: new OneEuro({ minCutoff: 1.1, beta: 6, dCutoff: 1 }),
        x: d.x,
        y: d.y,
        seen: t,
      };
      this.tracks.set(id, tr);
      out.push(this._update(tr, d, t));
    });
    this.onHands(out, t);
  }

  _update(tr, d, t) {
    tr.x = tr.fx.filter(d.x, t);
    tr.y = tr.fy.filter(d.y, t);
    tr.seen = t;
    return { id: tr.id, x: tr.x, y: tr.y };
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

  /** يرسم معاينة الكاميرا للمعلم: الصورة، ومعالم الأيدي، وحدود الشاشة المعايَرة. */
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
    for (const lm of this.lastResult?.landmarks || []) {
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
