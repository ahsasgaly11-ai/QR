// ---------------------------------------------------------------------------
// الطبقة ثلاثية الأبعاد لـ«صيّادو الجراثيم» (three.js r186 بمحرّك WebGPU، مستضاف محليًا).
//
// طبقات الجودة (الملف 09، القسم ٢):
//   A — WebGPU: مواد TSL كاملة + جراثيم تُحسب على معالج الرسوم (compute) ≈ ٦٠٠٠ لكل فريق.
//   B — WebGL2 (WebGPURenderer يرجع إليه تلقائيًا، أو ?tier=B): الكود نفسه، جراثيم ≤ ٩٠٠ لكل فريق.
//   C — بلا WebGL: لا يُنشأ هذا الملف أصلًا؛ تعرض اللعبة رموزًا وجراثيم ثنائية الأبعاد (flat.js).
// الأهداف كلها عناصر HTML في game.js، فمواضعها واحدة في الطبقات الثلاث؛ المشهد زينة وحركة فقط.
//
// الكاميرا محاذاة على وحدات المسرح: نقطة العالم (x, −y, 0) تظهر عند (x, y) بوحدة u.
// الرسم ٣٠ إطارًا/ث على الأكثر عبر setAnimationLoop، ولا يُرسم إطار بلا تغيير، ويتوقف عند إخفاء الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { ITEM_MODELS, head, tissueSheet, tissueBall, elbowArm, table, sandwich, bin, bottle, bubble, lampCone } from './models.js';
import { Germs, sampleSurface } from './germs.js';

const FPS_MS = 1000 / 30;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const W = (x, y, z = 0) => new THREE.Vector3(x, -y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * ينشئ المشهد بالطبقة المناسبة، أو يعيد null (الطبقة C).
 * @param {HTMLCanvasElement} canvas
 * @param {{forced?:string|null}} o
 */
export async function createScene3D(canvas, { forced = null } = {}) {
  try {
    const renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true, forceWebGL: forced === 'B' });
    await renderer.init(); // إلزامي قبل أول إطار
    renderer.setClearColor(0x000000, 0);
    const tier = renderer.backend.isWebGPUBackend ? 'A' : 'B';
    return new Scene3D(renderer, tier);
  } catch (e) {
    console.warn('3D غير متاح ← الطبقة C', e);
    return null;
  }
}

class Scene3D {
  constructor(renderer, tier) {
    this.renderer = renderer;
    this.tier = tier;
    this.reduced = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1.6, 10, 8000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cfe8, 1.6));
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.scene.add(this.sun, this.sun.target);
    this.teams = {};
    this.VW = 1600;
    this.VH = 1000;
    this.dirty = true;
    this.onSound = () => {};
    this._last = 0;
    this._raw = performance.now();
    this._lastT = performance.now();
    this._measure = null;
    this._timers = new Set();
    this.germCount = tier === 'A' ? 6000 : 900;
    // حارس: خطأ في معالج الرسوم أو فقدان الجهاز ← تنزل اللعبة طبقة (game.js) ولا تتوقف
    this.onFail = null;
    const fail = (why) => {
      if (this._failed) return;
      this._failed = true;
      console.warn(`المشهد ثلاثي الأبعاد (الطبقة ${tier}) تعطّل: ${why}`);
      this.onFail?.(why);
    };
    renderer.onDeviceLost = (info) => fail(info?.message || 'device lost');
    renderer.backend.device?.addEventListener?.('uncapturederror', (e) => fail(e.error?.message || 'gpu error'));
    this.loop = (t) => this._loop(t);
    renderer.setAnimationLoop(this.loop);
    this._vis = () => renderer.setAnimationLoop(document.hidden ? null : this.loop);
    document.addEventListener('visibilitychange', this._vis);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this._vis);
    this._clearTimers();
    for (const T of Object.values(this.teams)) T.germs.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ التخطيط
  layout(wPx, hPx, VW, VH) {
    this.VW = VW;
    this.VH = VH;
    this.renderer.setPixelRatio(Math.min(this.tier === 'A' ? 1.5 : 1, devicePixelRatio || 1));
    this.renderer.setSize(wPx, hPx, false);
    const cam = this.camera;
    const dist = VH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.aspect = VW / VH;
    cam.position.set(VW / 2, -VH / 2, dist);
    cam.lookAt(VW / 2, -VH / 2, 0);
    cam.near = dist * 0.2;
    cam.far = dist * 3;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.sun.position.set(VW * 0.25, VH * 0.2, dist);
    this.sun.target.position.set(VW / 2, -VH / 2, 0);
    this.dirty = true;
  }

  /**
   * فرق اللعب وحجراتها: { id: { booth:{x,y,w,h}, zone:{x0,x1,top,bottom} } } بوحدة u.
   */
  setTeams(spec) {
    for (const id of Object.keys(this.teams)) {
      if (!spec[id]) {
        const T = this.teams[id];
        this.scene.remove(T.holder, T.germs.object, T.cone, T.mid);
        T.germs.dispose();
        delete this.teams[id];
      }
    }
    for (const [id, s] of Object.entries(spec)) {
      let T = this.teams[id];
      if (!T) {
        const uUV = uniform(0);
        const germs = new Germs({ count: this.germCount, gpu: this.tier === 'A' });
        germs.uSize.value = this.tier === 'A' ? 10 : 14;
        const holder = new THREE.Group();
        const cone = lampCone(uUV);
        const mid = new THREE.Group();
        this.scene.add(holder, cone, mid, germs.object);
        T = this.teams[id] = { id, uUV, uv: 0, uvTo: 0, germs, holder, cone, mid, model: null, modelId: null, spin: true, props: [], tw: [], shake0: 0 };
      }
      T.booth = s.booth;
      T.zone = s.zone;
      const b = s.booth;
      T.S = Math.min(b.w * 0.75, b.h) * 0.4;
      T.halfW = b.w / 2 / T.S;
      T.halfH = b.h / 2 / T.S;
      T.holder.position.copy(W(b.x + b.w / 2, b.y + b.h * 0.56, 0));
      T.holder.scale.setScalar(T.S);
      // مخروط الضوء من المصباح في أعلى الحجرة
      T.cone.position.copy(W(b.x + b.w / 2, b.y + b.h * 0.5, -60));
      T.cone.scale.set(b.w * 0.42, b.h * 0.92, b.w * 0.2);
    }
    this.dirty = true;
  }

  team(id) {
    return this.teams[id];
  }

  // ------------------------------------------------------------------ أدوات صغيرة
  /** مؤقّت مرتبط بفريق (T) أو بالمشهد كله: يُلغى مع reset أو حين يبدأ للفريق حدث جديد */
  later(fn, ms, T = null) {
    const set = T ? (T.timers ||= new Set()) : this._timers;
    const t = setTimeout(() => {
      set.delete(t);
      fn();
    }, this.reduced ? ms * 0.4 : ms);
    set.add(t);
  }
  _clearTimers(T = null) {
    if (T) {
      for (const t of T.timers || []) clearTimeout(t);
      T.timers?.clear();
      return;
    }
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    for (const X of Object.values(this.teams)) this._clearTimers(X);
  }
  /** حركة ناعمة لخصائص مجسّم: pos/scale/rot (قيم Vector3 أو أرقام للمقياس) */
  tween(T, obj, { pos, scale, rot, dur = 400, ease = easeIO, arc = 0, onDone } = {}) {
    T.tw = T.tw.filter((w) => w.obj !== obj);
    T.tw.push({
      obj, t0: performance.now(), dur: this.reduced ? 1 : dur, ease, arc, onDone,
      p0: obj.position.clone(), p1: pos ? pos.clone() : null,
      s0: obj.scale.clone(), s1: scale === undefined ? null : typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale.clone(),
      r0: obj.rotation.clone(), r1: rot || null,
    });
    this.dirty = true;
  }
  /** نقطة محلية في الحجرة (وحدة المجسّم) إلى إحداثيات العالم */
  local(T, x, y, z = 0) {
    T.holder.updateMatrixWorld(true);
    return T.holder.localToWorld(new THREE.Vector3(x, y, z));
  }
  _addProp(T, obj, x, y, z = 0, s = 1) {
    obj.position.set(x, y, z);
    obj.userData.s = s;
    obj.scale.setScalar(0.001);
    T.holder.add(obj);
    T.props.push(obj);
    this.tween(T, obj, { scale: s, dur: 320, ease: easeOutBack });
    return obj;
  }
  /** يحرّر هندسات مجسّم أُزيل (المواد تُترك ليبقى تجميع المظلّلات محفوظًا) */
  _free(obj) {
    obj?.traverse?.((o) => o.geometry?.dispose());
  }
  _clearProps(T) {
    const props = new Set(T.props);
    for (const p of props) {
      T.holder.remove(p);
      this._free(p);
    }
    T.props = [];
    T.tw = T.tw.filter((w) => !props.has(w.obj));
  }
  /** أبعاد المشهد القصير داخل الحجرة: يصغر إن ضاقت الحجرة */
  _fit(T) {
    return Math.min(1, T.halfW / 2.35, T.halfH / 1.35);
  }

  // ------------------------------------------------------------------ المعاينة (الجولة ١)
  /** يعرض مجسّم البطاقة المحمولة في الحجرة ويدوّره ببطء (أو يخفيه إن كان id = null) */
  preview(id, item) {
    const T = this.teams[id];
    if (!T) return;
    const key = item?.model || null;
    if (key === T.modelId) return;
    if (T.model) {
      const old = T.model;
      this.tween(T, old, {
        scale: 0.001, dur: 220,
        onDone: () => {
          T.holder.remove(old);
          this._free(old);
        },
      });
    }
    T.model = null;
    T.modelId = key;
    if (!key || !ITEM_MODELS[key]) return;
    const m = ITEM_MODELS[key](T.uUV);
    // تأطير موحّد: كل مجسّم يملأ الحجرة بالقدر نفسه، ومركزه في وسطها
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const fit = 1.75 / Math.max(size.x * 0.9, size.y, 0.001);
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    m.position.sub(c);
    wrap.add(m);
    wrap.scale.setScalar(fit);
    const g = new THREE.Group();
    g.add(wrap);
    g.scale.setScalar(0.001);
    g.rotation.set(0, -0.6, 0);
    T.holder.add(g);
    T.model = g;
    T.spin = true;
    this.tween(T, g, { scale: 1, dur: 420, ease: easeOutBack });
  }

  lampOn(id) {
    const T = this.teams[id];
    if (!T) return;
    T.uvTo = 1;
    T.germs.glow(1);
    this.dirty = true;
  }
  lampOff(id) {
    const T = this.teams[id];
    if (!T) return;
    T.uvTo = 0;
    T.germs.glow(0);
    this.dirty = true;
  }

  /** الجراثيم تظهر عالقة على سطح المجسّم المعروض (يتوقف الدوران أولًا) */
  cling(id) {
    const T = this.teams[id];
    if (!T?.model) return;
    this._clearTimers(T);
    T.spin = false;
    const y = T.model.rotation.y;
    const target = Math.round((y + 0.35) / (Math.PI * 2)) * Math.PI * 2 - 0.35;
    this.tween(T, T.model, { rot: new THREE.Euler(0, target, 0), dur: 300 });
    this.later(() => {
      if (!T.model) return;
      T.model.rotation.set(0, target, 0);
      const n = this.tier === 'A' ? 1500 : 380;
      const pts = sampleSurface(T.model, n, T.S);
      T.germs.event({
        count: pts.length,
        from: (i) => {
          const p = pts[i];
          if (!p) return [0, 0, 0, 0];
          return [p.p.x + p.n.x * 70, p.p.y + p.n.y * 70, p.p.z + p.n.z * 70, 0];
        },
        to: (i) => {
          const p = pts[i];
          return p ? [p.p.x, p.p.y, p.p.z, 1] : null;
        },
        dur: 0.8,
        snap: true,
      });
    }, 320, T);
  }

  /** نفخ الهواء: جراثيم السطح الأملس تطير وتختفي، وجراثيم الخشن تبقى عالقة. grip = نسبة ما يبقى */
  blow(id, grip) {
    const T = this.teams[id];
    if (!T) return;
    const dir = T.id === 'b' ? -1 : 1;
    T.germs.event({
      to: (i, r) => {
        if (r[3] < 0.05) return [r[0], r[1], r[2], 0];
        if (Math.random() < grip) return [r[0] + dir * rnd(2, 6), r[1], r[2], 1];
        return [r[0] + dir * rnd(380, 900), r[1] + rnd(60, 380), r[2] + rnd(-80, 160), 0];
      },
      dur: 1.25,
      arc: [dir * 40, 90, 60],
    });
    // المجسّم يميل قليلًا مع الهواء
    if (T.model) {
      const r = T.model.rotation.clone();
      this.tween(T, T.model, { rot: new THREE.Euler(r.x, r.y, r.z - dir * 0.08), dur: 250, onDone: () => this.tween(T, T.model, { rot: r, dur: 600 }) });
    }
  }

  /** نهاية الاختبار: ينطفئ المصباح ويخرج المجسّم */
  endTest(id) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.lampOff(id);
    this.preview(id, null);
    this._clearProps(T);
    this.later(() => T.germs.clear(), 450, T);
  }

  /** اهتزاز الطبقة المرئية فقط (الأهداف لا تتحرك) */
  shake(id) {
    const T = this.teams[id];
    if (!T || this.reduced) return;
    T.shake0 = performance.now();
  }

  // ------------------------------------------------------------------ مشاهد الجولة ٢
  /** مشهد قصير (≈ ٢٫٨ ث) يكشف ما يفعله السلوك بالجراثيم */
  vignette(id, item) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.preview(id, null);
    this._clearProps(T);
    T.germs.clear();
    const k = this._fit(T);
    const u = T.uUV;
    const G = T.germs;
    const nA = this.tier === 'A' ? 1200 : 360;
    const snd = (n) => this.onSound(id, n);
    const surf = (obj, n) => {
      obj.updateMatrixWorld(true);
      return sampleSurface(obj, n, T.S * k);
    };
    const toPts = (pts, a = 1) => (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, a] : null);
    const at3 = (v, a = 1, j = 0) => [v.x + rnd(-j, j), v.y + rnd(-j, j), v.z + rnd(-j, j), a];
    const mouthW = (h) => {
      h.updateMatrixWorld(true);
      return h.userData.mouth.getWorldPosition(new THREE.Vector3());
    };
    const sc = item.scene;

    if (sc === 'spray' || sc === 'tissue' || sc === 'elbow') {
      const h = this._addProp(T, head(u), -1.45 * k, 0.15 * k, 0, 0.95 * k);
      const tb = this._addProp(T, table(u), 0.75 * k, -0.95 * k, -0.3, 0.62 * k);
      let shield = null;
      if (sc === 'tissue') this.later(() => (shield = this._addProp(T, tissueSheet(u), -0.72 * k, 0.0, 0.25, 0.85 * k)), 350, T);
      if (sc === 'elbow') this.later(() => (shield = this._addProp(T, elbowArm(u), -0.75 * k, -0.05 * k, 0.3, 0.9 * k)), 350, T);
      this.later(() => snd('achoo'), 300, T);
      this.later(() => {
        // ارتداد الرأس مع العطسة
        this.tween(T, h, { rot: new THREE.Euler(0, 0, -0.28), dur: 150, onDone: () => this.tween(T, h, { rot: new THREE.Euler(0, 0, 0), dur: 450 }) });
        const m = mouthW(h);
        if (sc === 'spray') {
          const onTable = surf(tb.userData.top, nA);
          G.event({
            count: nA,
            from: () => at3(m, 1, 6),
            to: (i) => (i % 3 === 0
              ? at3(this.local(T, rnd(-0.6, 2.2) * k, rnd(-0.6, 0.7) * k, rnd(-0.2, 0.5)), 1, 0)
              : onTable[i] ? [onTable[i].p.x, onTable[i].p.y, onTable[i].p.z, 1] : null),
            dur: 1.15,
            arc: [0, 70, 30],
            snap: true,
          });
        } else {
          const stop = shield ? surf(shield, nA) : [];
          G.event({ count: nA, from: () => at3(m, 1, 4), to: toPts(stop), dur: 0.45, arc: [0, 10, 10], snap: true });
          this.later(() => snd('thud'), 250);
        }
      }, 820, T);
      if (sc === 'tissue') {
        // المنديل يُطوى ثم يُرمى (يأخذ الجراثيم معه)
        this.later(() => {
          if (!shield) return;
          const tb2 = this._addProp(T, tissueBall(u), shield.position.x, shield.position.y, 0.3, 0.001);
          this.tween(T, shield, { scale: 0.001, dur: 300 });
          this.tween(T, tb2, { scale: 0.9 * k, dur: 300, ease: easeOutBack });
          const c = this.local(T, shield.position.x / 1, shield.position.y, 0.3);
          G.event({ to: (i, r) => (r[3] > 0.05 ? at3(c, 1, 0.22 * T.S * k) : null), dur: 0.35 });
        }, 1700, T);
      }
      return;
    }

    if (sc === 'shake' || sc === 'food') {
      const A = this._addProp(T, ITEM_MODELS.hand(u), -1.35 * k, 0.05 * k, 0, 0.85 * k);
      A.rotation.set(0, 0, sc === 'shake' ? -1.3 : -0.9);
      const B = sc === 'shake' ? ITEM_MODELS.hand(u, true) : sandwich(u);
      if (sc === 'shake') B.rotation.set(0, 0, 1.3);
      this._addProp(T, B, 1.35 * k, sc === 'shake' ? 0.05 * k : -0.25 * k, 0, (sc === 'shake' ? 0.85 : 1.0) * k);
      this.later(() => {
        const pts = surf(A, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z + 40, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.5, snap: true });
      }, 350, T);
      this.later(() => {
        this.tween(T, A, { pos: new THREE.Vector3(-0.52 * k, A.position.y, 0), dur: 420 });
        if (sc === 'shake') this.tween(T, B, { pos: new THREE.Vector3(0.52 * k, B.position.y, 0), dur: 420 });
      }, 950, T);
      this.later(() => {
        const dst = surf(B, nA);
        snd('whoosh');
        G.event({ to: (i, r) => (i % 2 === 0 && dst[i] && r[3] > 0.05 ? [dst[i].p.x, dst[i].p.y, dst[i].p.z, 1] : null), dur: 0.7 });
      }, 1420, T);
      this.later(() => {
        this.tween(T, A, { pos: new THREE.Vector3(-1.2 * k, A.position.y, 0), dur: 450 });
        if (sc === 'shake') this.tween(T, B, { pos: new THREE.Vector3(1.2 * k, B.position.y, 0), dur: 450 });
        // الجراثيم تتبع المجسّمات
        const dx = 0.68 * k * T.S;
        G.event({ to: (i, r) => (r[3] > 0.05 ? [r[0] + (i % 2 === 0 ? (sc === 'shake' ? dx : 0) : -dx), r[1], r[2], 1] : null), dur: 0.45 });
      }, 2300, T);
      return;
    }

    if (sc === 'leave' || sc === 'clean') {
      const tb = this._addProp(T, table(u), 0, -0.55 * k, 0, 0.9 * k);
      const ball = sc === 'leave' ? this._addProp(T, tissueBall(u), -0.15 * k, -0.25 * k, 0.25, 0.9 * k) : null;
      this.later(() => {
        if (sc === 'leave') {
          const pts = surf(ball, Math.round(nA * 0.6));
          G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 50, pts[i].p.z, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.5, snap: true });
        } else {
          const pts = surf(tb.userData.top, nA);
          G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 50, pts[i].p.z, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.6, snap: true });
        }
      }, 300, T);
      if (sc === 'leave') {
        this.later(() => {
          // تنتشر من المنديل إلى سطح الطاولة
          const top = surf(tb.userData.top, nA);
          G.event({ count: nA, to: (i, r) => (top[i] ? [top[i].p.x, top[i].p.y, top[i].p.z, 1] : r[3] > 0 ? r : null), dur: 1.2, arc: [0, 30, 0] });
        }, 1100, T);
      } else {
        const bt = this._addProp(T, bottle(u), -1.55 * k, -0.05 * k, 0.2, 0.75 * k);
        bt.rotation.z = -0.3;
        const wipe = this._addProp(T, ITEM_MODELS.sponge(u), -1.25 * k, -0.3 * k, 0.45, 0.32 * k);
        this.later(() => {
          snd('swish');
          this.tween(T, wipe, { pos: new THREE.Vector3(1.3 * k, -0.3 * k, 0.45), dur: 1100 });
        }, 900, T);
        // تختفي الجراثيم بالترتيب خلف الإسفنجة
        for (let s = 0; s < 4; s++) {
          this.later(() => {
            const xCut = this.local(T, (-1.25 + (s + 1) * 0.64) * k, 0, 0).x;
            G.event({ to: (i, r) => (r[3] > 0.05 && r[0] < xCut ? [r[0], r[1] + 30, r[2], 0] : null), dur: 0.35 });
          }, 1000 + s * 260, T);
        }
      }
      return;
    }

    if (sc === 'wash') {
      const h = this._addProp(T, ITEM_MODELS.hand(u), 0, 0.1 * k, 0, 0.95 * k);
      h.rotation.set(0.2, 0, 0);
      this.later(() => {
        const pts = surf(h, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z + 40, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.5, snap: true });
      }, 250, T);
      this.later(() => {
        snd('bubbles');
        for (let i = 0; i < 10; i++) {
          const b = this._addProp(T, bubble(u), rnd(-1.0, 1.0) * k, rnd(-0.8, 0.6) * k, rnd(0.2, 0.6), rnd(0.7, 1.5) * k);
          this.later(() => this.tween(T, b, { pos: new THREE.Vector3(b.position.x + rnd(-0.2, 0.2), b.position.y + 1.6 * k, b.position.z), scale: 0.001, dur: 1300 }), 300 + i * 60);
        }
      }, 800, T);
      this.later(() => {
        G.event({ to: (i, r) => (r[3] > 0.05 ? [r[0] + rnd(-60, 60), r[1] - rnd(420, 900), r[2], 0] : null), dur: 1.2, arc: [0, 20, 0] });
      }, 1150, T);
      return;
    }

    if (sc === 'bin') {
      const bn = this._addProp(T, bin(u), 1.1 * k, -0.55 * k, 0, 0.95 * k);
      const tb = this._addProp(T, tissueBall(u), -1.4 * k, 0.45 * k, 0.2, 0.9 * k);
      this.later(() => {
        const pts = surf(tb, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.45, snap: true });
      }, 250, T);
      this.later(() => {
        snd('bin');
        const dst = new THREE.Vector3(1.1 * k, -0.05 * k, 0);
        this.tween(T, tb, { pos: dst, dur: 600, arc: 0.9 * k });
        const c = this.local(T, dst.x, dst.y, 0);
        G.event({ to: (i, r) => (r[3] > 0.05 ? at3(c, 1, 0.2 * T.S * k) : null), dur: 0.62, arc: [0, 0.9 * k * T.S, 0] });
      }, 900, T);
      this.later(() => {
        const c = this.local(T, 1.1 * k, -0.6 * k, 0);
        this.tween(T, tb, { pos: new THREE.Vector3(1.1 * k, -0.55 * k, 0), scale: 0.001, dur: 300 });
        G.event({ to: (i, r) => (r[3] > 0.05 ? at3(c, 0, 10) : null), dur: 0.35 });
        const lid = bn.userData.lid;
        this.tween(T, lid, { rot: new THREE.Euler(0, 0, 0), dur: 200 });
      }, 1550, T);
      // الغطاء مفتوح أولًا
      bn.userData.lid.rotation.z = 0.9;
      bn.userData.lid.position.x = 0.22;
    }
  }

  // ------------------------------------------------------------------ منتصف اللعبة: «أطفئوا الأنوار!»
  /** يدان كبيرتان «نظيفتان» في منطقة الفريق، تتوهّج عليهما الجراثيم تحت الضوء البنفسجي */
  midHands(id, on) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.preview(id, null);
    this._clearProps(T);
    this._free(T.mid);
    T.mid.clear();
    if (!on) {
      this.lampOff(id);
      this.later(() => T.germs.clear(), 400, T);
      return;
    }
    T.germs.clear();
    const z = T.zone;
    const s = Math.min((z.x1 - z.x0) * 0.2, (z.bottom - z.top) * 0.28);
    const cx = (z.x0 + z.x1) / 2;
    const cy = z.top + (z.bottom - z.top) * 0.47;
    const L = ITEM_MODELS.hand(T.uUV);
    const R = ITEM_MODELS.hand(T.uUV, true);
    L.position.set(-1.0, 0, 0);
    R.position.set(1.0, 0, 0);
    L.rotation.z = 0.12;
    R.rotation.z = -0.12;
    T.mid.add(L, R);
    T.mid.position.copy(W(cx, cy, 0));
    T.mid.scale.setScalar(0.001);
    this.tween(T, T.mid, { scale: s, dur: 600, ease: easeOutBack });
    this.lampOn(id);
    this.later(() => {
      T.mid.updateMatrixWorld(true);
      const n = this.tier === 'A' ? 5200 : 850;
      const pts = sampleSurface(T.mid, n, s);
      T.germs.event({
        count: pts.length,
        from: (i) => (pts[i] ? [pts[i].p.x + rnd(-300, 300), pts[i].p.y + rnd(-200, 300), pts[i].p.z + 200, 0] : [0, 0, 0, 0]),
        to: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, 1] : null),
        dur: 1.4,
        snap: true,
      });
    }, 900, T);
  }

  // ------------------------------------------------------------------ الافتتاح والختام
  /** الافتتاح: المصباح يمسح الحجرات فتظهر جراثيم تتجمّع ثم تختفي. هنا يُقاس الأداء أيضًا. */
  intro() {
    for (const T of Object.values(this.teams)) {
      const b = T.booth;
      this.lampOn(T.id);
      const n = this.tier === 'A' ? 3000 : 600;
      T.germs.event({
        count: n,
        from: () => [rnd(T.zone.x0, T.zone.x1), -rnd(T.zone.top, T.zone.bottom), rnd(-100, 300), 0],
        to: () => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * Math.min(b.w, b.h) * 0.36;
          return [b.x + b.w / 2 + Math.cos(a) * r * 1.4, -(b.y + b.h * 0.56 + Math.sin(a) * r), rnd(-40, 80), 1];
        },
        dur: 1.3,
        arc: [0, 60, 120],
        snap: true,
      });
      this.later(() => this.lampOff(T.id), 1700, T);
      this.later(() => T.germs.clear(), 2300, T);
    }
  }
  /** يبدأ قياس الأداء بعد skip م.ث (يتجاوز توقّف تجميع المظلّلات في أول الافتتاح) */
  startMeasure(skip = 700) {
    this._measure = { d: [], t0: performance.now(), skip };
  }
  /** الوسيط للزمن بين إطارات الحلقة (م.ث): لا تؤثر فيه وقفات قليلة طويلة */
  stopMeasure() {
    const m = this._measure;
    this._measure = null;
    if (!m || m.d.length < 6) return 0;
    const d = [...m.d].sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)];
  }

  reset() {
    this._clearTimers();
    for (const T of Object.values(this.teams)) {
      this._clearProps(T);
      this._free(T.mid);
      T.mid.clear();
      if (T.model) {
        T.holder.remove(T.model);
        this._free(T.model);
      }
      T.model = null;
      T.modelId = null;
      T.tw = [];
      T.uvTo = 0;
      T.germs.glow(0);
      T.germs.clear();
    }
    this.dirty = true;
  }

  /** يجمّع كل مواد المجسّمات مسبقًا (أثناء الافتتاح) فلا يتوقف الرسم عند أول ظهور لمجسّم */
  async warmUp() {
    const T = Object.values(this.teams)[0];
    if (!T || !this.renderer.compileAsync) return;
    const g = new THREE.Group();
    const all = [...Object.values(ITEM_MODELS).map((f) => f(T.uUV)), head(T.uUV), tissueSheet(T.uUV), tissueBall(T.uUV), elbowArm(T.uUV), table(T.uUV), sandwich(T.uUV), bin(T.uUV), bottle(T.uUV), bubble(T.uUV), ITEM_MODELS.hand(T.uUV, true)];
    all.forEach((m, i) => {
      m.position.set((i % 6) * 3, Math.floor(i / 6) * 3, 0);
      g.add(m);
    });
    g.position.copy(T.holder.position);
    g.scale.setScalar(T.S * 0.2);
    try {
      await this.renderer.compileAsync(g, this.camera, this.scene);
    } catch {
      /* التجميع المسبق تحسين فقط */
    }
  }

  // ------------------------------------------------------------------ الحلقة
  _loop(now) {
    const raw = now - this._raw;
    this._raw = now;
    if (this._measure && raw < 1000 && now - this._measure.t0 > this._measure.skip) this._measure.d.push(raw);
    if (now - this._last < FPS_MS) return;
    const dt = Math.min(0.1, (now - this._lastT) / 1000);
    this._lastT = now;
    this._last = now;
    let moving = this.dirty;
    for (const T of Object.values(this.teams)) {
      // الوضع البنفسجي يتدرّج
      if (Math.abs(T.uv - T.uvTo) > 0.002) {
        T.uv += (T.uvTo - T.uv) * Math.min(1, dt * (this.reduced ? 30 : 6));
        T.uUV.value = T.uv;
        moving = true;
      }
      T.cone.visible = T.uv > 0.02;
      // الحركات
      if (T.tw.length) {
        moving = true;
        for (const w of [...T.tw]) {
          const k = Math.min(1, (now - w.t0) / Math.max(1, w.dur));
          const e = w.ease(k);
          if (w.p1) {
            w.obj.position.lerpVectors(w.p0, w.p1, e);
            if (w.arc) w.obj.position.y += Math.sin(k * Math.PI) * w.arc;
          }
          if (w.s1) w.obj.scale.lerpVectors(w.s0, w.s1, Math.max(0, e));
          if (w.r1) w.obj.rotation.set(w.r0.x + (w.r1.x - w.r0.x) * e, w.r0.y + (w.r1.y - w.r0.y) * e, w.r0.z + (w.r1.z - w.r0.z) * e);
          if (k >= 1) {
            T.tw.splice(T.tw.indexOf(w), 1);
            w.onDone?.();
          }
        }
      }
      if (T.model && T.spin && !this.reduced) {
        T.model.rotation.y += dt * 0.7;
        moving = true;
      }
      if (T.shake0) {
        const e = (now - T.shake0) / 400;
        const b = T.booth;
        const base = W(b.x + b.w / 2, b.y + b.h * 0.56, 0);
        if (e >= 1) {
          T.shake0 = 0;
          T.holder.position.copy(base);
        } else T.holder.position.set(base.x + Math.sin(e * 40) * 12 * (1 - e), base.y, base.z);
        moving = true;
      }
      if (T.germs.frame(this.renderer, now, dt, this.reduced)) moving = true;
    }
    if (!moving || this._failed) return;
    this.dirty = false;
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      this._failed = true;
      console.warn('تعذّر الرسم ثلاثي الأبعاد', e);
      this.onFail?.(e.message);
    }
  }
}
