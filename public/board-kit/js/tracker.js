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
