// ---------------------------------------------------------------------------
// «النماذج الحيّة» فوق البطاقات (الطبقتان A وB): كل بطاقة تحمل نموذجًا ثلاثي الأبعاد حقيقيًا
// (المجسّم نفسه الذي يظهر في العدسة) يتمايل ويلمع، لا صورة. والنموذج يرتفع حين تقف اليد على
// البطاقة، ويتبع اليد حين تُلتقط (يميل مع حركتها)، ويطير إلى العدسة في قوس حين يوضع في سلّته.
//
// طبقة WebGL شفافة مستقلة فوق البطاقات (#hud) وتحت مؤشرات الأيدي: النص العربي يبقى في HTML،
// وأهداف اليد تبقى عناصر HTML ثابتة؛ هذه الطبقة زينة فقط (pointer-events: none).
// كاميرا متعامدة بالبكسل: يوضع النموذج فوق «نافذة» البطاقة (.gh-slot) حيث كانت الصورة.
// الرسم ٣٠ إطارًا/ث حين يتحرك شيء، و١٥ حين تتمايل النماذج فقط، ويتوقف عند إخفاء الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ITEM_MODELS, pmat, studioEnvScene, head, tissueSheet, tissueBall, elbowArm, sandwich, bin, bottle, bubble } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** قطعة صابون وردية وفقاعات (للبطاقة «غسل اليدين») */
function soap() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.9, 0.38, 0.55, 8, 4, 6);
  // حواف مدوّرة: نقرّب الرؤوس نحو شكل بيضاوي
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 - 0.18 * Math.pow(Math.abs(v.y) / 0.19, 2);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  const bar = new THREE.Mesh(geo, pmat('#f6a7c1', { vertexColors: false, roughness: 0.35, clearcoat: 0.8, sheen: 0.6, sheenColor: '#ffe1ec' }));
  g.add(bar);
  for (const [x, y, z, s] of [[-0.25, 0.32, 0.1, 0.55], [0.18, 0.42, -0.05, 0.75], [0.36, 0.28, 0.18, 0.4]]) {
    const b = bubble();
    b.position.set(x, y, z);
    b.scale.setScalar(s);
    g.add(b);
  }
  return g;
}
/** يدان متصافحتان */
function shakeHands() {
  const g = new THREE.Group();
  const a = ITEM_MODELS.hand();
  const b = ITEM_MODELS.hand(true);
  a.rotation.set(0, 0, -1.25);
  b.rotation.set(0, 0, 1.25);
  a.position.set(-0.32, 0, 0.05);
  b.position.set(0.32, 0, -0.05);
  g.add(a, b);
  return g;
}
/** طعام في يد غير مغسولة */
function food() {
  const g = new THREE.Group();
  const s = sandwich();
  const h = ITEM_MODELS.hand();
  h.rotation.set(0, 0, -0.9);
  h.position.set(-0.55, 0.15, -0.1);
  h.scale.setScalar(0.8);
  g.add(s, h);
  return g;
}
/** منديل مستعمل على حافة طاولة */
function leftTissue() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), pmat('#d9a46a', { vertexColors: false, roughness: 0.5, clearcoat: 0.5 }));
  top.position.y = -0.25;
  const t = tissueBall();
  t.scale.setScalar(1.6);
  t.position.set(0.05, 0.12, 0);
  g.add(top, t);
  return g;
}

/** نماذج بطاقات الجولة ٢ (بالمشهد) */
const SCENE_MODELS = {
  spray: () => head(),
  tissue: () => {
    const g = new THREE.Group();
    const h = head();
    const t = tissueSheet();
    t.position.set(0.32, -0.02, 0.45);
    t.rotation.y = -0.5;
    t.scale.setScalar(0.9);
    g.add(h, t);
    return g;
  },
  elbow: () => elbowArm(),
  shake: shakeHands,
  food,
  leave: leftTissue,
  wash: soap,
  bin: () => bin(),
  clean: () => {
    const g = new THREE.Group();
    const b = bottle();
    const s = ITEM_MODELS.sponge();
    s.scale.setScalar(0.45);
    s.position.set(0.45, -0.18, 0.15);
    g.add(b, s);
    return g;
  },
};

/** مفتاح نموذج البطاقة لعنصر من المحتوى */
export const cardKey = (it) => (it.model ? it.model : it.scene ? `s:${it.scene}` : null);

/** يبني النموذج ويوسّطه ويطبّعه: أكبر بُعد ظاهر = 1 (يستعمله scene3d.js للعدسة أيضًا) */
export function buildCardModel(key, tier) {
  let m = null;
  if (key.startsWith('s:')) m = SCENE_MODELS[key.slice(2)]?.();
  else m = ITEM_MODELS[key]?.(tier);
  if (!m) return null;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m, true);
  const size = box.getSize(new THREE.Vector3());
  m.position.sub(box.getCenter(new THREE.Vector3()));
  const wrap = new THREE.Group();
  wrap.add(m);
  wrap.scale.setScalar(1 / Math.max(size.x, size.y, 0.001));
  const g = new THREE.Group();
  g.add(wrap);
  m.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return g;
}

export class Cards3D {
  /**
   * @param {HTMLCanvasElement} canvas طبقة شفافة فوق البطاقات
   * @param {'A'|'B'} tier
   */
  constructor(canvas, tier) {
    this.canvas = canvas;
    this.tier = tier;
    this.reduced = false;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 0);
    const scene = (this.scene = new THREE.Scene());
    const pmrem = new THREE.PMREMGenerator(r);
    const env = studioEnvScene();
    this.envRT = pmrem.fromScene(env, 0.02);
    env.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    pmrem.dispose();
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 1.0;
    scene.add(new THREE.HemisphereLight('#ffffff', '#c9bde0', 0.9));
    const key = new THREE.DirectionalLight('#fff3e3', 2.3);
    key.position.set(300, 500, 700);
    const rim = new THREE.DirectionalLight('#d9e4ff', 1.1);
    rim.position.set(-500, 200, -400);
    scene.add(key, rim);
    // كاميرا متعامدة بالبكسل (تُضبط في layout): نقطة (x, −y) = البكسل (x, y) من أعلى يسار المسرح
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
    this.camera.position.set(0, 0, 1000);
    this.slots = new Map(); // معرّف البطاقة ← { el, key, obj, lift, hide }
    this.held = new Map(); // معرّف اليد ← { key, obj, x, y, vx, vy }
    this.flights = [];
    this.cache = new Map(); // نماذج جاهزة مخفية لإعادة الاستعمال (بلا إعادة بناء)
    this.w = 1;
    this.h = 1;
    this.scale = 1;
    this._last = 0;
    this._lost = (e) => {
      e.preventDefault();
      this.failed = true;
    };
    canvas.addEventListener('webglcontextlost', this._lost);
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this._lost);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) m.dispose?.();
    });
    this.envRT.dispose();
    this.renderer.dispose();
  }

  /** أبعاد الطبقة بالبكسل، وعدد البكسلات في وحدة u */
  layout(wPx, hPx, scaleU) {
    this.w = wPx;
    this.h = hPx;
    this.scale = scaleU;
    const dpr = Math.min(devicePixelRatio || 1, this.tier === 'A' ? 1.5 : 1.1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(wPx, hPx, false);
    Object.assign(this.camera, { left: 0, right: wPx, top: 0, bottom: -hPx });
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** نموذج من المخزن أو جديد */
  _take(key) {
    const list = this.cache.get(key);
    if (list?.length) {
      const o = list.pop();
      o.visible = true;
      return o;
    }
    const o = buildCardModel(key, this.tier);
    if (o) this.scene.add(o);
    return o;
  }
  _give(key, o) {
    if (!o) return;
    o.visible = false;
    if (!this.cache.has(key)) this.cache.set(key, []);
    this.cache.get(key).push(o);
  }

  /**
   * البطاقات الظاهرة الآن: [{ id, key, el }] حيث el عنصر «النافذة» داخل البطاقة.
   * تُستدعى بعد كل إعادة رسم للبطاقات.
   */
  setSlots(list) {
    const keep = new Set(list.map((s) => s.id));
    for (const [id, s] of this.slots) {
      if (!keep.has(id)) {
        this._give(s.key, s.obj);
        this.slots.delete(id);
      }
    }
    for (const s of list) {
      const old = this.slots.get(s.id);
      if (old && old.key === s.key) {
        old.el = s.el;
        old.card = s.card;
        continue;
      }
      if (old) this._give(old.key, old.obj);
      const obj = this._take(s.key);
      this.slots.set(s.id, { ...s, obj, lift: 0, hide: 0, phase: Math.random() * 6.28, born: performance.now() });
    }
    this.dirty = true;
  }

  /** الأيدي التي تحمل بطاقات: [{ cid, key, x, y }] بوحدة u */
  setHeld(list) {
    const keep = new Set(list.map((h) => h.cid));
    for (const [cid, h] of this.held) {
      if (!keep.has(cid)) {
        this._give(h.key, h.obj);
        this.held.delete(cid);
      }
    }
    for (const h of list) {
      let cur = this.held.get(h.cid);
      if (cur && cur.key !== h.key) {
        this._give(cur.key, cur.obj);
        cur = null;
      }
      if (!cur) {
        cur = { key: h.key, obj: this._take(h.key), x: h.x, y: h.y, vx: 0, vy: 0, born: performance.now() };
        this.held.set(h.cid, cur);
      }
      cur.tx = h.x;
      cur.ty = h.y;
    }
  }

  /**
   * النموذج يطير من نقطة إلى أخرى في قوس ويصغر (من السلة إلى العدسة). بوحدة u.
   * @returns {void}
   */
  fly(key, from, to, dur = 900) {
    const obj = this._take(key);
    if (!obj) return;
    this.flights.push({ key, obj, from, to, t0: performance.now(), dur: this.reduced ? 250 : dur });
  }

  /** مواضع ما يطير الآن (لذيل اللهب في fx.js) بوحدة u */
  get flying() {
    return this.flights.map((f) => f.pos).filter(Boolean);
  }
  /** مواضع النماذج في الأيدي وسرعتها (لذيل اللهب) بوحدة u */
  get carried() {
    return [...this.held.values()].map((h) => ({ x: h.x, y: h.y, v: Math.hypot(h.vx, h.vy) }));
  }

  /** @param {number} now @param {number} dt @param {DOMRect} stageRect */
  frame(now, dt, stageRect) {
    if (this.failed) return;
    let moving = this.dirty || this.held.size > 0 || this.flights.length > 0;
    const u = this.scale;
    const sway = this.reduced ? 0 : 1;
    // النماذج فوق البطاقات: تقف فوق «النافذة»، تتمايل، وترتفع تحت اليد، وتختفي إن التُقطت البطاقة
    for (const s of this.slots.values()) {
      if (!s.obj || !s.el?.isConnected) continue;
      const r = s.el.getBoundingClientRect();
      const cx = r.left - stageRect.left + r.width / 2;
      const cy = r.top - stageRect.top + r.height / 2;
      const size = Math.min(r.width, r.height) * 0.92;
      const hover = s.card?.classList.contains('hover');
      const taken = s.card?.classList.contains('taken');
      s.lift = lerp(s.lift, hover ? 1 : 0, Math.min(1, dt * 10));
      s.hide = lerp(s.hide, taken ? 1 : 0, Math.min(1, dt * 12));
      const born = clamp((now - s.born) / 450, 0, 1);
      const pop = born < 1 ? 1 + 2.2 * Math.pow(born - 1, 3) + 1.2 * Math.pow(born - 1, 2) : 1;
      const k = (1 + s.lift * 0.18) * (1 - s.hide) * pop;
      s.obj.visible = k > 0.02;
      s.obj.position.set(cx, -(cy - s.lift * 10 * u), 200 + s.lift * 300);
      s.obj.scale.setScalar(Math.max(0.001, size * k));
      const t = now / 1000 + s.phase;
      s.obj.rotation.set(0.22 + Math.sin(t * 0.9) * 0.06 * sway, -0.55 + Math.sin(t * 0.7) * 0.35 * sway + s.lift * Math.sin(t * 3) * 0.3, Math.sin(t * 1.1) * 0.05 * sway);
    }
    // النماذج في الأيدي: تتبع اليد بنعومة وتميل مع اتجاه الحركة كأنها تُسحب في الهواء
    for (const h of this.held.values()) {
      if (!h.obj) continue;
      const nx = lerp(h.x, h.tx, Math.min(1, dt * 18));
      const ny = lerp(h.y, h.ty, Math.min(1, dt * 18));
      h.vx = lerp(h.vx, (nx - h.x) / Math.max(dt, 1e-3), 0.25);
      h.vy = lerp(h.vy, (ny - h.y) / Math.max(dt, 1e-3), 0.25);
      h.x = nx;
      h.y = ny;
      const born = clamp((now - h.born) / 300, 0, 1);
      const size = 130 * u * (0.6 + 0.4 * born);
      h.obj.position.set(h.x * u, -(h.y - 20) * u, 900);
      h.obj.scale.setScalar(size);
      const t = now / 1000;
      h.obj.rotation.set(0.25 + clamp(h.vy / 1800, -0.5, 0.5), -0.5 + t * 0.9 * sway, clamp(-h.vx / 1500, -0.6, 0.6));
    }
    // الطيران إلى العدسة: قوس عالٍ، دوران، وتصغير في النهاية
    for (const f of [...this.flights]) {
      const k = clamp((now - f.t0) / f.dur, 0, 1);
      const e = easeIO(k);
      const x = lerp(f.from.x, f.to.x, e);
      const y = lerp(f.from.y, f.to.y, e) - Math.sin(k * Math.PI) * 160;
      f.pos = { x, y };
      const s = 140 * u * (k < 0.75 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1.0 * (1 - (k - 0.75) / 0.25));
      f.obj.position.set(x * u, -y * u, 1200);
      f.obj.scale.setScalar(Math.max(0.001, s));
      f.obj.rotation.set(0.3, -0.5 + k * Math.PI * 2.2, Math.sin(k * Math.PI) * 0.4);
      if (k >= 1) {
        this._give(f.key, f.obj);
        this.flights.splice(this.flights.indexOf(f), 1);
      }
    }
    const idle = !moving;
    if (idle && now - this._last < 66) return;
    if (!idle && now - this._last < 33) return;
    this._last = now;
    this.dirty = false;
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.warn('تعذّر رسم نماذج البطاقات', e);
      this.failed = true;
    }
  }
}
