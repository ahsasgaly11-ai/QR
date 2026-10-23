// ---------------------------------------------------------------------------
// متتبّع الأيدي: كاميرا الجهاز ← MediaPipe Hand Landmarker ← مصفوفة المعايرة
// ← مؤشرات على الشاشة.
//
// الكاميرا تعمل في عنصر فيديو مخفي؛ صورتها لا تُرسم على الصفحة أبدًا (إلا في
// معاينة لوحة المعلم عند طلبها)، فلا تظهر في انعكاس الشاشة على السبورة.
//
// السرعة والاستجابة (ثلاث طبقات):
//   ١) الاستدلال في Worker منفصل (tracker-worker.js): الإطار يُنقل ImageBitmap
//      بلا نسخ، فلا يوقف الاستدلالُ رسمَ المشهد ثلاثي الأبعاد ولا العكس. إن لم
//      يتوفّر معالج الرسوم داخل الـWorker (أجهزة أقدم) نرجع إلى الخيط الرئيسي.
//   ٢) عمل أقل في كل إطار (tracking.js: planFrame): كل يد معروفة لها نافذة
//      «لاصقة» يتتبّعها كاشف فيديو بلا كاشف الكف، والمسح عن أيدٍ جديدة بلاطة
//      واحدة في الإطار حين توجد أيدٍ (ثلاث حين لا توجد).
//   ٣) تعويض التأخير: تأخير الكاميرا والاستدلال يُقاس، ويُستبق موضع اليد بسرعتها
//      (HandMatcher.lead) فتصل الدائرة إلى حيث اليد الآن.
//
// لأيدي الأطفال الصغيرة والبعيدة: بعد المعايرة نقصّ منطقة السبورة من الإطار
// ونقسمها إلى بلاطات (راجع tracking.js).
// ---------------------------------------------------------------------------
import { applyH, invert3 } from './geometry.js';
import { boardRoi, makeTiles, mergeDetections, stickyFocus, planFrame, HandMatcher, QUALITY, QUALITY_ORDER, MAX_LEAD_MS } from './tracking.js';
import { DetectCore, MAX_FOCUS_SLOTS } from './detect-core.js';

const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;
const MODEL = new URL('../models/hand_landmarker.task', import.meta.url).href;
const WORKER_URL = new URL('./tracker-worker.js', import.meta.url);

/** بعد هذه المدة بلا رؤية تختفي دائرة اليد الفارغة (اليد الحاملة لسنّ تبقى أطول، راجع input.js). */
export const TRACK_TTL_MS = 900;
const FOCUS_KEEP_MS = 450; // تبقى نافذة التركيز مكان اليد المفقودة لحظة (حجب قصير)

// معالم اليد في MediaPipe: 0 الرسغ، 5/9/13/17 قواعد الأصابع، 8 طرف السبابة.
const PALM = [0, 5, 9, 13, 17];
const INDEX_TIP = 8;

const params = () => new URLSearchParams(location.search);

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
    this.lastCrops = [];
    this.delegate = null;
    this.forceCpu = params().has('cpu');
    this._errors = 0;
    // الخلفية: worker أو main؛ تُحدَّد عند أول تشغيل
    this.backend = null;
    this.worker = null;
    this.core = null;
    this._inflight = null; // {ts, crops, at} الإطار الذي ينتظر نتيجته
    this.inferMs = 0; // زمن الاستدلال للإطار الأخير
    this.latencyMs = 0; // من التقاط الإطار إلى وصول نتيجته
    this.focus = []; // الأيدي المتتبَّعة بنوافذ لاصقة: {cx,cy,size,seen,vx,vy,win,slot}
    this.focusSlots = 0; // كم خانة فيديو للتركيز أنشأتها النواة
    this.scanIdx = 0;
    this._configured = '';
    this._pending = null; // رسالة تنتظر ردّها من الـWorker
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
    this.focus = [];
    this.scanIdx = 0;
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
  }

  get smart() {
    return !!(this.H && QUALITY[this.effQuality].smart);
  }

  async listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  }

  // ---------------------------------------------------------------- الخلفية
  _canWorker() {
    if (params().get('mt') === 'main') return false;
    return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
  }

  /** يختار الخلفية مرة واحدة: Worker بمعالج الرسوم، وإلا الخيط الرئيسي. */
  async _setupBackend() {
    if (this.backend) return;
    if (this._canWorker()) {
      try {
        const w = new Worker(WORKER_URL, { type: 'module', name: 'hand-tracker' });
        w.onmessage = (e) => this._dispatch(e.data);
        w.onerror = (e) => {
          console.error('[board-kit] worker', e.message || e);
          if (this._pending) this._pending.reject(e.error || new Error(e.message || 'worker error'));
          else this._workerFailed();
        };
        const ready = await this._ask(w, { type: 'init', vendor: VENDOR, model: MODEL, forceCpu: this.forceCpu }, 'ready', 20000);
        // معالج الرسوم غير متاح داخل الـWorker (iOS أقدم من 17): الخيط الرئيسي بمعالج الرسوم أسرع من Worker بالمعالج المركزي
        if (ready.delegate === 'CPU' && !this.forceCpu) {
          w.postMessage({ type: 'close' });
        } else {
          this.worker = w;
          this.backend = 'worker';
          this.delegate = ready.delegate;
          return;
        }
      } catch (err) {
        if (String(err?.message || err) === 'nosimd') throw err;
        console.warn('[board-kit] worker غير متاح، نتابع في الخيط الرئيسي', err);
      }
    }
    this.core = new DetectCore({ vendor: VENDOR, model: MODEL, forceCpu: this.forceCpu });
    await this.core.init();
    this.backend = 'main';
  }

  /** رسالة ذات ردّ واحد (للتهيئة والإعداد)؛ نتائج الإطارات التي تصل أثناءها تمرّ إلى معالجها. */
  _ask(w, msg, expect, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this._pending = null;
        reject(new Error('worker timeout'));
      }, timeoutMs);
      this._pending = {
        expect,
        resolve: (m) => {
          clearTimeout(t);
          this._pending = null;
          resolve(m);
        },
        reject: (err) => {
          clearTimeout(t);
          this._pending = null;
          reject(err);
        },
      };
      w.postMessage(msg);
    });
  }

  _dispatch(m) {
    const p = this._pending;
    if (p && (m.type === p.expect || m.type === 'error')) {
      if (m.type === 'error') p.reject(new Error(m.message || m.code));
      else p.resolve(m);
      return;
    }
    this._onWorkerMessage(m);
  }

  /** يهيّئ الكواشف للوضع والدقة الحاليين (مرة لكل تغيّر). */
  async _configure() {
    const mode = this.smart ? 'smart' : 'tiled';
    const key = `${mode}:${this.tiles.length}:${this.backend}`;
    if (this._configured === key) return;
    const want = { type: 'configure', mode, tiles: mode === 'tiled' ? this.tiles.length : 0, focus: mode === 'smart' ? MAX_FOCUS_SLOTS : 0 };
    let got;
    if (this.backend === 'worker') {
      got = await this._ask(this.worker, want, 'configured', 30000);
    } else {
      got = await this.core.configure(want);
      this.delegate = this.core.delegate;
    }
    if (got.delegate) this.delegate = got.delegate;
    this._configured = key;
    this.focusSlots = got.focus;
    if (mode === 'tiled' && got.tiles < this.tiles.length) {
      // الجهاز عجز عن كواشف كل البلاطات: نخفّض الدقة ونعيد الإعداد
      if (this._degrade('تعذّر تشغيل كل أقسام الدقة على هذا الجهاز')) {
        this._configured = '';
        return this._configure();
      }
      this.tiles = this.tiles.slice(0, Math.max(1, got.tiles));
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

  async _workerFailed() {
    if (this.backend !== 'worker') return;
    try {
      this.worker?.terminate();
    } catch {
      /* لا شيء */
    }
    this.worker = null;
    this.backend = null;
    this._inflight = null;
    this._configured = '';
    this.delegate = null;
    try {
      this.core = new DetectCore({ vendor: VENDOR, model: MODEL, forceCpu: this.forceCpu });
      await this.core.init();
      this.backend = 'main';
      this.onStatus('running', 'الكاميرا تعمل (الخيط الرئيسي)');
    } catch (err) {
      console.error(err);
      this.onStatus('error', 'تعذّر تشغيل تتبّع اليد');
      this.running = false;
    }
  }

  async _fallbackToCpu() {
    this.core?.close();
    this.forceCpu = true;
    this._configured = '';
    this.delegate = null;
    try {
      this.core = new DetectCore({ vendor: VENDOR, model: MODEL, forceCpu: true });
      await this.core.init();
      await this._configure();
      this.onStatus('running', 'الكاميرا تعمل (المعالج المركزي)');
    } catch (err) {
      this.onStatus('error', 'تعذّر تشغيل تتبّع اليد');
      console.error(err);
      this.running = false;
    }
  }

  // ---------------------------------------------------------------- التشغيل
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
    this.onStatus('loading', 'تحميل نموذج تتبّع اليد…');
    await this._setupBackend();
    await this._configure();
    this.running = true;
    this._inflight = null;
    this.matcher.clear();
    this.onStatus('running', 'الكاميرا تعمل');
    this._schedule();
    const track = this.stream.getVideoTracks()[0];
    return track?.getSettings?.().deviceId || deviceId || '';
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.matcher.clear();
    this.lastHands = [];
    this.focus = [];
    this._inflight = null;
    this.onStatus('off', 'الكاميرا متوقفة');
  }

  _schedule() {
    if (!this.running) return;
    const v = this.video;
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => this._tick());
    else requestAnimationFrame(() => this._tick());
  }

  /** نوافذ هذا الإطار حسب الوضع. */
  _plan() {
    if (!this.smart) return this.tiles.map((t, i) => ({ kind: 'tile', slot: i, x: t.x, y: t.y, w: t.w, h: t.h }));
    const { scanPerFrame } = QUALITY[this.effQuality];
    // جهاز بطيء وأيدٍ متتبَّعة: المسح (كاشف الكف، الأغلى) كل إطارين أو ثلاثة بدل كل إطار،
    // فتحتفظ نوافذ التركيز بكل الوقت وتلحق الدائرة باليد
    this._frameNo = (this._frameNo || 0) + 1;
    const skip = this.focus.length ? (this.inferMs > 90 ? 3 : this.inferMs > 55 ? 2 : 1) : 1;
    if (skip > 1 && this._frameNo % skip) {
      const { crops } = planFrame({ tiles: [], focus: this.focus, scanIdx: this.scanIdx, scanPerFrame });
      return crops;
    }
    const { crops, scanIdx } = planFrame({ tiles: this.tiles, focus: this.focus, scanIdx: this.scanIdx, scanPerFrame });
    this.scanIdx = scanIdx;
    return crops;
  }

  async _tick() {
    if (!this.running) return;
    try {
      const v = this.video;
      if (v.paused && v.srcObject) v.play().catch(() => {}); // بعد قفل الجهاز أو تبديل التطبيق
      if (!this.backend) await this._setupBackend();
      await this._configure();
      // إطار جديد ولا إطار قيد الاستدلال: لا نكدّس الإطارات (تأخير أقل من إطارات أكثر)
      if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime && !this._inflight) {
        this.lastVideoTime = v.currentTime;
        let ts = performance.now();
        if (ts <= this.lastTs) ts = this.lastTs + 1; // الطوابع يجب أن تتزايد تمامًا
        this.lastTs = ts;
        const crops = this._plan();
        if (this.backend === 'worker') {
          this._inflight = { ts, crops, at: ts };
          const bitmap = await createImageBitmap(v);
          if (!this.running || !this.worker) {
            bitmap.close();
            this._inflight = null;
          } else this.worker.postMessage({ type: 'frame', bitmap, ts, crops }, [bitmap]);
        } else {
          const t0 = performance.now();
          const results = this.core.run(v, crops, ts);
          this.inferMs = performance.now() - t0;
          this._onResults(ts, crops, results);
        }
        this._errors = 0;
      } else if (this._inflight && performance.now() - this._inflight.at > 4000) {
        // الـWorker لم يردّ أربع ثوانٍ: شيء تعطّل، نرجع إلى الخيط الرئيسي
        console.warn('[board-kit] worker لا يستجيب');
        await this._workerFailed();
      }
    } catch (err) {
      console.error('[board-kit] detect', err);
      // معالج الرسوم قد يُنشئ النموذج ثم يفشل أثناء العمل على بعض الأجهزة: ننتقل للمعالج المركزي
      if (++this._errors >= 5) {
        this._errors = 0;
        if (this.backend === 'worker') await this._workerFailed();
        else if (this.delegate === 'GPU') {
          await this._fallbackToCpu();
          return this._schedule();
        }
      }
    }
    this._schedule();
  }

  _onWorkerMessage(m) {
    if (m.type === 'result') {
      const inflight = this._inflight;
      this._inflight = null;
      if (!this.running || !inflight || inflight.ts !== m.ts) return;
      this.inferMs = m.ms;
      if (m.delegate) this.delegate = m.delegate;
      this._onResults(m.ts, inflight.crops, m.results);
      this._errors = 0;
    } else if (m.type === 'error') {
      console.error('[board-kit] worker', m.message);
      this._inflight = null;
      if (++this._errors >= 3) {
        this._errors = 0;
        this._workerFailed();
      }
    }
  }

  /** يحوّل نتائج النوافذ إلى أيدٍ بإحداثيات الكاميرا، ويحدّث نوافذ التركيز، ثم يُخرج المؤشرات. */
  _onResults(ts, crops, results) {
    const v = this.video;
    const aspect = v.videoWidth / Math.max(1, v.videoHeight);
    const raw = [];
    for (const r of results) {
      const tile = crops[r.i];
      if (!tile) continue;
      r.landmarks.forEach((lmT, j) => {
        const lm = lmT.map((p) => ({ x: tile.x + p.x * tile.w, y: tile.y + p.y * tile.h }));
        const c = this.handCamPoint(lm);
        const hd = r.handedness[j];
        const tx = (c.x - tile.x) / tile.w;
        const ty = (c.y - tile.y) / tile.h;
        raw.push({
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
    const merged = crops.length > 1 ? mergeDetections(raw, aspect) : raw;
    this.lastCrops = crops;
    this.lastHands = merged.map((d) => d.lm);
    if (this.smart) this._updateFocus(merged, ts, aspect);
    this.latencyMs = performance.now() - ts;
    this._countFps(ts);
    this._emit(merged, ts);
  }

  /** نوافذ التركيز اللاصقة: كل يد مكتشفة تحتفظ بخانتها ونافذتها، والمفقودة تبقى لحظة. */
  _updateFocus(merged, ts, aspect) {
    const maxSlots = Math.max(1, this.focusSlots || MAX_FOCUS_SLOTS);
    const next = [];
    const taken = new Set();
    const usedSlots = new Set();
    for (const d of merged) {
      if (next.length >= maxSlots) break;
      let prev = null;
      let best = Infinity;
      for (const f of this.focus) {
        if (taken.has(f)) continue;
        const dt = Math.min(200, ts - f.seen) / 1000;
        const dist = Math.hypot(f.cx + f.vx * dt - d.cx, (f.cy + f.vy * dt - d.cy) / aspect);
        if (dist < 3 * Math.max(f.size, d.size) && dist < best) {
          best = dist;
          prev = f;
        }
      }
      const dt = prev ? Math.max(1, ts - prev.seen) / 1000 : 0;
      const vx = prev ? 0.5 * prev.vx + 0.5 * ((d.cx - prev.cx) / dt) : 0;
      const vy = prev ? 0.5 * prev.vy + 0.5 * ((d.cy - prev.cy) / dt) : 0;
      // النافذة تُثبَّت حيث نتوقّع اليد في الإطار القادم
      const ahead = { cx: d.cx + vx * 0.05, cy: d.cy + vy * 0.05, size: d.size };
      const f = { cx: d.cx, cy: d.cy, size: d.size, seen: ts, vx, vy, win: stickyFocus(prev?.win ?? null, ahead, aspect), slot: prev?.slot };
      if (prev) taken.add(prev);
      next.push(f);
    }
    // المفقودة حديثًا تبقى بنافذتها (حجب قصير)
    for (const f of this.focus) {
      if (taken.has(f) || next.length >= maxSlots) continue;
      if (ts - f.seen <= FOCUS_KEEP_MS) next.push({ ...f, vx: 0, vy: 0 });
    }
    // الخانات: كل يد تبقى في خانتها (كاشف الفيديو يحتفظ بتتبّعها)، والجديدة تأخذ خانة حرّة
    for (const f of next) {
      if (f.slot !== undefined && f.slot < maxSlots && !usedSlots.has(f.slot)) usedSlots.add(f.slot);
      else f.slot = undefined;
    }
    for (const f of next) {
      if (f.slot !== undefined) continue;
      for (let i = 0; i < maxSlots; i++) {
        if (!usedSlots.has(i)) {
          usedSlots.add(i);
          f.slot = i;
          break;
        }
      }
    }
    this.focus = next.filter((f) => f.slot !== undefined);
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
    // الاستباق بقدر التأخير المقاس (الكاميرا + الاستدلال) ونصف فاصل الإطار
    const lead = Math.min(MAX_LEAD_MS, 0.9 * this.latencyMs + 12);
    this.onHands(this.matcher.update(pts, t, { lead }), t);
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
      if (warm && this.fps > 0 && this.fps < 12 && this.effQuality !== 'normal') {
        if (++this._slowSecs >= 3) {
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

  /** وصف الخلفية للوحة المعلم: «GPU • Worker». */
  get backendLabel() {
    return [this.delegate, this.backend === 'worker' ? 'Worker' : this.backend === 'main' ? 'الخيط الرئيسي' : ''].filter(Boolean).join(' • ');
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
      g.lineWidth = 1.5;
      for (const t of this.lastCrops.length ? this.lastCrops : this.tiles) {
        g.strokeStyle = t.kind === 'focus' ? 'rgba(255, 211, 77, 0.9)' : 'rgba(34, 211, 238, 0.7)';
        g.strokeRect(t.x * w, t.y * h, t.w * w, t.h * h);
      }
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
