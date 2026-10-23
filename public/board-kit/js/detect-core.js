// ---------------------------------------------------------------------------
// نواة الكشف: تشغيل MediaPipe Hand Landmarker على نوافذ مقصوصة من الإطار.
// تعمل في Worker (tracker-worker.js) أو في الخيط الرئيسي (tracker.js) بالكود
// نفسه؛ لا تعرف شيئًا عن المعايرة ولا الشاشة: تأخذ إطارًا (فيديو أو ImageBitmap)
// وقائمة نوافذ، وتعيد المعالم بإحداثيات كل نافذة.
//
// ثلاثة أنواع من النوافذ:
//   • tile   (الدقة العادية/العالية): بلاطة ثابتة لها كاشف «فيديو» خاص يتتبّع
//            أيديها بين الإطارات (كاشف الكف لا يعمل إلا حين يضيع التتبّع).
//   • scan   (الدقة القصوى): بلاطة من شبكة المسح، كاشف «صور» واحد يبحث عن أيدٍ
//            جديدة (كاشف الكف كاملًا).
//   • focus  (الدقة القصوى): نافذة لاصقة حول يد معروفة، لها كاشف «فيديو» في
//            خانتها، فتُتبَع اليد بلا كاشف الكف: أرخص بكثير وأثبت.
// ---------------------------------------------------------------------------

const HANDS_SCAN = 4;
const HANDS_FOCUS = 2;
export const MAX_FOCUS_SLOTS = 2; // كل كاشف نسخة كاملة من النموذج في ذاكرة معالج الرسوم؛ اثنان يكفيان ويد ثالثة يلتقطها المسح

/** حجم النافذة المرسلة للكاشف بالبكسل (ضلعها الأطول). الكاشف يصغّرها إلى ١٩٢/٢٢٤ على كل حال. */
export const CROP_PX = { tile: 1024, scan: 512, focus: 384 };

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const frameW = (f) => f.videoWidth || f.width || 0;
const frameH = (f) => f.videoHeight || f.height || 0;

export class DetectCore {
  /**
   * @param {{vendor:string, model:string, forceCpu?:boolean}} o
   */
  constructor({ vendor, model, forceCpu = false }) {
    this.vendor = vendor;
    this.model = model;
    this.forceCpu = forceCpu;
    this.api = null;
    this.delegate = null;
    this.mode = 'smart';
    this.tiles = []; // كواشف البلاطات (tiled)
    this.scanLm = null; // كاشف الصور للمسح (smart)
    this.focus = []; // كواشف نوافذ التركيز (smart)
    this.canvases = new Map();
  }

  async init() {
    if (this.api) return;
    const { FilesetResolver, HandLandmarker } = await import(`${this.vendor}vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${this.vendor}wasm`);
    // نوفّر نسخة SIMD فقط (كل آيباد وهاتف بنظام iOS 16.4 فأحدث يدعمها، وكل أندرويد حديث)
    if (/_nosimd_/.test(fileset.wasmBinaryPath)) throw new Error('nosimd');
    this.api = { fileset, HandLandmarker };
  }

  async _make(runningMode, numHands) {
    const { fileset, HandLandmarker } = this.api;
    const make = (delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: this.model, delegate },
        runningMode,
        numHands,
        // عتبات أخفض من الافتراضي: أيدي الأطفال صغيرة وجزئية الظهور أحيانًا،
        // والقصّ على السبورة يقلّل الاكتشافات الخاطئة من خارجها
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    if (!this.forceCpu && this.delegate !== 'CPU') {
      try {
        const lm = await make('GPU');
        this.delegate = 'GPU';
        return lm;
      } catch (e) {
        if (this.delegate === 'GPU') throw e; // كان يعمل ثم فشل: لا نخلط GPU وCPU في جلسة واحدة
      }
    }
    const lm = await make('CPU');
    this.delegate = 'CPU';
    return lm;
  }

  _closeLm(lm) {
    try {
      lm?.close();
    } catch {
      /* لا شيء */
    }
  }

  /**
   * يهيّئ الكواشف المطلوبة للوضع. يرمي خطأً إن تعذّر إنشاء أول كاشف.
   * @param {{mode:'smart'|'tiled', tiles?:number, focus?:number}} c
   * @returns {Promise<{tiles:number, focus:number}>} ما أمكن إنشاؤه فعلًا
   */
  async configure({ mode, tiles = 0, focus = 0 }) {
    await this.init();
    this.mode = mode;
    if (mode === 'smart') {
      for (const t of this.tiles) this._closeLm(t.lm);
      this.tiles = [];
      if (!this.scanLm) this.scanLm = await this._make('IMAGE', HANDS_SCAN);
      const want = Math.min(MAX_FOCUS_SLOTS, focus);
      while (this.focus.length > want) this._closeLm(this.focus.pop().lm);
      while (this.focus.length < want) {
        try {
          this.focus.push({ lm: await this._make('VIDEO', HANDS_FOCUS), lastTs: 0 });
        } catch {
          break; // نكتفي بما أمكن: الباقي يُمسح بكاشف الصور
        }
      }
      return { tiles: 0, focus: this.focus.length };
    }
    this._closeLm(this.scanLm);
    this.scanLm = null;
    for (const f of this.focus) this._closeLm(f.lm);
    this.focus = [];
    while (this.tiles.length > tiles) this._closeLm(this.tiles.pop().lm);
    while (this.tiles.length < tiles) {
      try {
        this.tiles.push({ lm: await this._make('VIDEO', HANDS_SCAN), lastTs: 0 });
      } catch (err) {
        if (!this.tiles.length) throw err;
        break;
      }
    }
    return { tiles: this.tiles.length, focus: 0 };
  }

  /** يرسم نافذة من الإطار على لوحة بحجم مناسب للكاشف. */
  _crop(key, frame, c, maxSide) {
    const fw = frameW(frame);
    const fh = frameH(frame);
    const sw = c.w * fw;
    const sh = c.h * fh;
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const cw = Math.max(16, Math.round(sw * k));
    const ch = Math.max(16, Math.round(sh * k));
    let cv = this.canvases.get(key);
    if (!cv) {
      cv = makeCanvas(cw, ch);
      this.canvases.set(key, cv);
    }
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    cv.getContext('2d', { willReadFrequently: false }).drawImage(frame, c.x * fw, c.y * fh, sw, sh, 0, 0, cw, ch);
    return cv;
  }

  /**
   * يشغّل الكواشف على النوافذ المطلوبة.
   * @param {HTMLVideoElement|ImageBitmap} frame
   * @param {{kind:'tile'|'scan'|'focus', slot?:number, x:number,y:number,w:number,h:number}[]} crops
   * @param {number} ts طابع متزايد (ms)
   * @returns {{i:number, landmarks:{x:number,y:number}[][], handedness:{score:number,categoryName:string}[]}[]}
   */
  run(frame, crops, ts) {
    const out = [];
    const full = (c) => c.w >= 0.999 && c.h >= 0.999 && (frameW(frame) <= CROP_PX.tile || this.mode !== 'tiled');
    crops.forEach((c, i) => {
      let res = null;
      if (c.kind === 'scan') {
        if (!this.scanLm) return;
        res = this.scanLm.detect(this._crop(`s${i}`, frame, c, CROP_PX.scan));
      } else {
        const slot = c.kind === 'focus' ? this.focus[c.slot] : this.tiles[c.slot];
        if (!slot) {
          // لا خانة فيديو لهذه النافذة (جهاز ضعيف): نستعمل كاشف الصور إن وُجد
          if (this.scanLm) res = this.scanLm.detect(this._crop(`s${i}`, frame, c, CROP_PX.scan));
          else return;
        } else {
          const t = Math.max(ts, slot.lastTs + 1);
          slot.lastTs = t;
          const src = c.kind === 'tile' && full(c) ? frame : this._crop(`${c.kind}${c.slot}`, frame, c, c.kind === 'focus' ? CROP_PX.focus : CROP_PX.tile);
          res = slot.lm.detectForVideo(src, t);
        }
      }
      if (!res?.landmarks?.length) return;
      out.push({
        i,
        landmarks: res.landmarks.map((lm) => lm.map((p) => ({ x: p.x, y: p.y }))),
        handedness: res.handedness.map((h) => ({ score: h?.[0]?.score ?? 0.5, categoryName: h?.[0]?.categoryName })),
      });
    });
    return out;
  }

  close() {
    for (const t of this.tiles) this._closeLm(t.lm);
    for (const f of this.focus) this._closeLm(f.lm);
    this._closeLm(this.scanLm);
    this.tiles = [];
    this.focus = [];
    this.scanLm = null;
    this.canvases.clear();
  }
}
