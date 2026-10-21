// ---------------------------------------------------------------------------
// المشهد ثلاثي الأبعاد لـ«أسبوع الزكام» — three.js r186، WebGPURenderer + TSL.
//
// طبقات الجودة (الأهداف كلها HTML في game.js، فمواضعها واحدة في الطبقات الثلاث):
//   A — محرّك WebGPU: ظل حيّ ناعم، وزجاج حقيقي، وتوهّج (bloom) وتدرّج لوني، وسماء بأربع طبقات ضجيج،
//       ورذاذ حتى ١٦ ألف جسيمة باضطراب يُحسب على معالج الرسوم (compute).
//   B — WebGL2 (رجوع تلقائي من WebGPURenderer، أو نزول من A): المشهد والمواد نفسها، بلا ظل حيّ
//       (أقراص ظل)، وبلا توهّج، وزجاج رخيص، ورذاذ ≤ ١٢٠٠ جسيمة.
//   C — بلا 3D: لا يُنشأ هذا الملف؛ flat.js يعرض صورًا مُصيَّرة مسبقًا من A.
//
// منظّم الجودة: يقيس زمن الإطار أثناء الافتتاح (لا أهداف لليد حينها): يخفّض دقة البكسل أولًا،
// ثم ينزل إلى B، ثم يطلب C من اللعبة. لا يغيّر الطبقة المفروضة بالرابط (?tier=).
// الرسم ٣٠ إطارًا/ث على الأكثر، ويتوقف عند إخفاء الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { float, mix, pass, renderOutput, screenUV, smoothstep, uniform, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWorld, roomLayout, DIM } from './world.js';
import { POSES } from './dolls.js';
import { Spray, KIND, motes } from './particles.js';
import { badge } from './textures.js';
import { OUTBREAK } from './content.js';
import { enamel, tissuePaper, bottlePlastic, bubbleMat, glass, gold, chrome, beam } from './materials.js';

const FPS_MS = 1000 / 30;
// للتجربة الآلية على جهاز بطيء جدًا (?test): لا نقيّد خطوة الزمن حتى تتزامن الجسيمات مع المهام
const DT_CAP = new URLSearchParams(location.search).has('test') ? 3 : 0.1;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const arr = (v) => [v.x, v.y, v.z];

/** ألوان السماء والإضاءة لكل سمة (من جدول «دانة الصف» في الملف 10). */
const THEMES = {
  morning: { top: 0x1763b6, mid: 0x56a8e2, horizon: 0xd2efff, sun: 0xfffbe8, exposure: 1.0, hemi: 0.62, sunI: 2.3, sunC: 0xfff0d6, fill: 0.6, beam: 1, bloom: 0.38, env: 0.42 },
  dawn: { top: 0x20447a, mid: 0x7fa6cf, horizon: 0xffdcae, sun: 0xffe9c4, exposure: 0.95, hemi: 0.42, sunI: 3.1, sunC: 0xffc98a, fill: 0.18, beam: 3.2, bloom: 0.62, env: 0.16 },
  sunset: { top: 0x16123a, mid: 0x8c3566, horizon: 0xffa860, sun: 0xffc88a, exposure: 1.0, hemi: 0.6, sunI: 2.6, sunC: 0xffb070, fill: 0.45, beam: 2.2, bloom: 0.55, env: 0.3 },
};
/** سماء نافذة الصف حسب الفترة */
const WINDOW = {
  am: { top: 0x4f9be0, horizon: 0xfff0d2, sun: 0xfff1c8, beam: 0.16, patch: 0.55 },
  pm: { top: 0x3f7fc6, horizon: 0xffd29a, sun: 0xffc77a, beam: 0.2, patch: 0.62 },
  night: { top: 0x0b1530, horizon: 0x2a3b6a, sun: 0x000000, beam: 0.0, patch: 0.0 },
};

function weakDevice() {
  return (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency || 8) <= 4;
}

/**
 * ينشئ المشهد بالطبقة المناسبة، أو يعيد null (الطبقة C).
 * @param {HTMLCanvasElement} canvas
 * @param {{forced?:string|null}} o
 */
export async function createScene3D(canvas, { forced = null } = {}) {
  const q = new URLSearchParams(location.search);
  // ١) WebGPU (أو رجوعه التلقائي إلى WebGL2)، ٢) إن تعثّر WebGPU في التهيئة: WebGL2 صراحةً، ٣) وإلا الطبقة C
  const attempts = forced === 'B' || q.has('webgl') ? [true] : [false, true];
  for (const forceWebGL of attempts) {
    let renderer = null;
    try {
      renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
      await renderer.init(); // إلزامي قبل أول إطار
      const gpu = !!renderer.backend.isWebGPUBackend;
      let tier = forced || (gpu ? 'A' : 'B');
      if (!forced && tier === 'A' && weakDevice()) tier = 'B';
      return new Scene3D(renderer, tier, { forced: !!forced, gpu });
    } catch (e) {
      console.warn(`3D (${forceWebGL ? 'WebGL2' : 'WebGPU'}) غير متاح`, e);
      try {
        renderer?.setAnimationLoop(null);
        renderer?.dispose();
      } catch {
        /* */
      }
    }
  }
  return null; // ← الطبقة C
}

class Scene3D {
  constructor(renderer, tier, { forced, gpu }) {
    this.renderer = renderer;
    this.tier = tier;
    this.forced = forced;
    this.gpu = gpu;
    this.reduced = false;
    this.onFail = null;
    this.onTier = null;
    this.onSound = () => {};
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1.6, 0.1, 200);
    this.uSim = uniform(0); // زمن المحاكاة (يتباطأ في اللقطة البطيئة)
    this.simT = 0;
    this.timeScale = 1;
    this.tasks = [];
    this.rooms = {};
    this.teamIds = [];
    this.pr = 1;
    this.view = { mode: 'play', shot: null };
    this._last = 0;
    this._lastT = performance.now();
    this._frames = [];

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = tier === 'A';
    renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCFSoftShadowMap أُزيل؛ النعومة من shadow.radius

    // إضاءة بيئية منعكسة (أهم مكوّن في الملف 10)
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    // ثلاثة أضواء: سماء/أرض، وشمس من خلف النوافذ (ظل حيّ)، وضوء أمامي ناعم للوجوه
    this.hemi = new THREE.HemisphereLight(0xdbeeff, 0xefdcc0, 1.0);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
    this.sun.castShadow = tier === 'A';
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.fill = new THREE.DirectionalLight(0xe8f1ff, 0.95);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);

    this._theme = { ...THEMES.morning };
    this._themeTo = null;
    this._buildPipeline();

    const fail = (why) => {
      if (this._failed) return;
      this._failed = true;
      console.warn(`المشهد ثلاثي الأبعاد (الطبقة ${this.tier}) تعطّل: ${why}`);
      this.onFail?.(why);
    };
    renderer.onDeviceLost = (info) => fail(info?.message || 'device lost');
    renderer.backend.device?.addEventListener?.('uncapturederror', (e) => fail(e.error?.message || 'gpu error'));
    this.loop = (t) => this._loop(t);
    renderer.setAnimationLoop(this.loop);
    this._vis = () => renderer.setAnimationLoop(document.hidden ? null : this.loop);
    document.addEventListener('visibilitychange', this._vis);
  }

  // ------------------------------------------------------------------ المعالجة اللاحقة
  _buildPipeline() {
    const r = this.renderer;
    this.uLift = uniform(0.07); // رفع الأسود لجهاز العرض (الملف 10، القسم ٥)
    this.uVig = uniform(0.22);
    this.uWarm = uniform(new THREE.Vector3(1.02, 1.0, 0.97));
    const scenePass = pass(this.scene, this.camera);
    const col = scenePass.getTextureNode('output');
    let hdr = col.rgb;
    this.bloomNode = null;
    if (this.tier === 'A') {
      this.bloomNode = bloom(col, 0.38, 0.4, 1.12);
      hdr = hdr.add(this.bloomNode.rgb);
    }
    // تدرّج سينمائي: تظليل أطراف ناعم + دفء خفيف (قبل التدرّج اللوني)
    const d = screenUV.sub(0.5).length();
    const vig = mix(float(1), float(1).sub(this.uVig), smoothstep(0.32, 0.9, d));
    hdr = hdr.mul(vig).mul(this.uWarm);
    const mapped = renderOutput(vec4(hdr, 1)); // ACES + sRGB حسب إعداد المحرّك
    const lifted = mapped.rgb.mul(float(1).sub(this.uLift)).add(this.uLift);
    this.pipeline = new THREE.RenderPipeline(r, vec4(lifted, 1));
    this.pipeline.outputColorTransform = false;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this._vis);
    this.tasks = [];
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ بناء المدرسة
  /** @param {string[]} teamIds ['all'] أو ['a','b'] */
  setTeams(teamIds) {
    const key = teamIds.join(',');
    if (key === this.teamIds.join(',')) return;
    this.teamIds = [...teamIds];
    if (this.W) {
      this.scene.remove(this.W.world);
      this.W.world.traverse((o) => {
        if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
      });
      for (const R of Object.values(this.rooms)) {
        this.scene.remove(R.spray.object, R.motes);
        R.spray.dispose();
      }
    }
    this.tasks = [];
    this.roomPlan = roomLayout(teamIds);
    this.W = buildWorld(this.tier === 'A' ? 'A' : 'B', this.roomPlan);
    this.scene.add(this.W.world);
    this.rooms = this.W.rooms;
    const per = this.tier === 'A' ? (teamIds.length === 1 ? 16000 : 12000) : 1200;
    for (const R of Object.values(this.rooms)) {
      R.spray = new Spray({ count: per, gpu: this.gpu && this.tier === 'A', time: this.uSim });
      this.scene.add(R.spray.object);
      R.motes = motes({ count: this.tier === 'A' ? 420 : 140, box: { x0: R.cx - R.w * 0.42, x1: R.cx + R.w * 0.42, y0: 0.2, y1: 2.6, z0: -DIM.D / 2 + 0.2, z1: 0.6 }, time: this.uSim });
      this.scene.add(R.motes);
      R.props = new THREE.Group();
      R.group.add(R.props);
      // عمود ضوء ذهبي فوق صاحبة الموقف (يُرى من آخر الصف)
      R.uPillar = uniform(0);
      R.uPillarK = R.uPillar.mul(0.42);
      R.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 2.6, 40, 1, true), beam(0xffb53a, R.uPillarK, { softness: 2.2 }));
      R.pillar.geometry.translate(0, 1.3, 0);
      R.pillar.renderOrder = 7;
      R.group.add(R.pillar);
      R.dayT = 0;
      R.clockTo = { h: 8, hNow: 8 };
      R.win.now = WINDOW.am;
      for (const D of R.dolls) {
        D.cur = clonePose(POSES.rest);
        D.target = POSES.rest;
        D.hop = 0;
      }
    }
    // الشمس من خلف النوافذ (أعلى يسار الخلف) فتسقط الظلال نحو الكاميرا
    const b = this.W.bounds;
    const cx = (b.x0 + b.x1) / 2;
    this.sun.position.set(cx - 4, 9, -9);
    this.sun.target.position.set(cx, 0, 0.5);
    const sc = this.sun.shadow.camera;
    const half = (b.x1 - b.x0) / 2 + 1.5;
    sc.left = -half;
    sc.right = half;
    sc.top = 5;
    sc.bottom = -5;
    sc.near = 1;
    sc.far = 30;
    sc.updateProjectionMatrix();
    this.fill.position.set(cx + 2, 4, 9);
    this.fill.target.position.set(cx, 0.8, 0);
    this.setTheme('morning', 0);
    this.reset();
  }

  // ------------------------------------------------------------------ التخطيط والكاميرا
  /**
   * @param {number} wPx @param {number} hPx  حجم اللوحة بالبكسل
   * @param {number} VW @param {number} VH     المسرح بوحدة u
   * @param {{x0:number,x1:number,top:number,bottom:number}} frame  المستطيل (بوحدة u) الذي يُعرض فيه الصف أثناء اللعب
   */
  layout(wPx, hPx, VW, VH, frame) {
    this.wPx = wPx;
    this.hPx = hPx;
    this.VW = VW;
    this.VH = VH;
    this.frame = frame;
    const cap = this.tier === 'A' ? 2.6e6 : 1.4e6;
    let pr = Math.min(devicePixelRatio || 1, this.tier === 'A' ? 1.5 : 1.15) * (this.prScale || 1);
    if (wPx * hPx * pr * pr > cap) pr = Math.sqrt(cap / (wPx * hPx));
    this.pr = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(wPx, hPx, false);
    this.camera.aspect = wPx / hPx;
    this.playShot = this._fitShot(frame);
    if (!this.view.anim) this._applyShot(this.view.mode === 'play' ? this.playShot : this.view.shot || this.playShot);
  }

  /** لقطة اللعب: الصف كاملًا داخل المستطيل frame (أعلى الجدار الخلفي إلى حافة الأرض الأمامية) */
  _fitShot(frame) {
    const b = this.W.bounds;
    const cam = this.camera;
    const target = V((b.x0 + b.x1) / 2, 1.0, 0.0);
    const dir = V(0, 0.44, 1).normalize();
    const pts = [V(b.x0 + 0.35, 2.6, b.z0 + 0.25), V(b.x1 - 0.35, 2.6, b.z0 + 0.25), V(b.x0 + 0.35, 0, 1.25), V(b.x1 - 0.35, 0, 1.25)];
    const fw = Math.max(200, frame.x1 - frame.x0);
    const fh = Math.max(150, frame.bottom - frame.top);
    let dist = 16;
    let box = null;
    cam.clearViewOffset();
    for (let it = 0; it < 6; it++) {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      box = this._projBox(pts);
      const k = Math.max((box.x1 - box.x0) / fw, (box.y1 - box.y0) / fh);
      dist *= k;
    }
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    box = this._projBox(pts);
    const offU = { x: (box.x0 + box.x1) / 2 - (frame.x0 + frame.x1) / 2, y: (box.y0 + box.y1) / 2 - (frame.top + frame.bottom) / 2 };
    return { pos: cam.position.clone(), target, off: offU };
  }

  _projBox(pts) {
    const out = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    for (const p of pts) {
      const q = p.clone().project(this.camera);
      const x = ((q.x + 1) / 2) * this.VW;
      const y = ((1 - q.y) / 2) * this.VH;
      out.x0 = Math.min(out.x0, x);
      out.x1 = Math.max(out.x1, x);
      out.y0 = Math.min(out.y0, y);
      out.y1 = Math.max(out.y1, y);
    }
    return out;
  }

  _applyShot(s) {
    const cam = this.camera;
    cam.position.copy(s.pos);
    cam.lookAt(s.target);
    const k = this.wPx / this.VW;
    const off = s.off || { x: 0, y: 0 };
    cam.setViewOffset(this.wPx, this.hPx, off.x * k, off.y * k, this.wPx, this.hPx);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** حركة كاميرا ناعمة بين لقطتين (فقط حين لا أهداف لليد على المشهد: الافتتاح والختام) */
  _shotTo(shot, dur) {
    const from = { pos: this.camera.position.clone(), target: (this._shotNow?.target || this.playShot.target).clone(), off: { ...(this._shotNow?.off || this.playShot.off) } };
    this.view.anim = true;
    if (this.reduced || dur <= 0) {
      this._shotNow = shot;
      this._applyShot(shot);
      this.view.anim = false;
      return;
    }
    this.task(dur, (p) => {
      const e = easeIO(p);
      const s = {
        pos: from.pos.clone().lerp(shot.pos, e),
        target: from.target.clone().lerp(shot.target, e),
        off: { x: from.off.x + (shot.off.x - from.off.x) * e, y: from.off.y + (shot.off.y - from.off.y) * e },
      };
      this._shotNow = s;
      this._applyShot(s);
    }, { onDone: () => (this.view.anim = false) });
  }

  /** لقطة قريبة على دمية (للحظة العطسة في الافتتاح) */
  _closeShot(D, side = 1) {
    const h = D.headWorld();
    return { pos: h.clone().add(V(side * 1.6, 0.35, 2.3)), target: h.clone().add(V(-side * 0.55, -0.15, 0.6)), off: { x: 0, y: 0 } };
  }
  _wideShot() {
    const p = this.playShot;
    return { pos: p.pos.clone().add(V(0, 3.2, 4)), target: p.target.clone().add(V(0, 0.4, -0.5)), off: { ...p.off } };
  }

  setReduced(on) {
    this.reduced = !!on;
  }

  // ------------------------------------------------------------------ السمات والوقت
  setTheme(name, dur = 1.2) {
    const T = THEMES[name];
    const from = { ...this._theme };
    const fromC = ['top', 'mid', 'horizon', 'sun', 'sunC'].map((k) => new THREE.Color(from[k]));
    const toC = ['top', 'mid', 'horizon', 'sun', 'sunC'].map((k) => new THREE.Color(T[k]));
    const apply = (e) => {
      const c = fromC.map((a, i) => a.clone().lerp(toC[i], e));
      const sky = this.W?.sky;
      if (sky) {
        sky.top.value.copy(c[0]);
        sky.mid.value.copy(c[1]);
        sky.horizon.value.copy(c[2]);
        sky.sun.value.copy(c[3]);
      }
      this.sun.color.copy(c[4]);
      const L = (k) => from[k] + (T[k] - from[k]) * e;
      this.renderer.toneMappingExposure = L('exposure');
      this.hemi.intensity = L('hemi');
      this.sun.intensity = L('sunI');
      this.fill.intensity = L('fill');
      this.scene.environmentIntensity = L('env');
      this.beamBoost = L('beam');
      if (this.bloomNode) this.bloomNode.strength.value = L('bloom');
      if (e >= 1) this._theme = { ...T };
    };
    if (!dur || this.reduced) return apply(1);
    this.task(dur, (p) => apply(easeIO(p)));
  }

  /** وقت الصف: ساعة الحائط وسماء النافذتين وشدة الضوء الداخل */
  _roomTime(R, w, hour, dur = 1.0, viaNight = false) {
    const from = R.win.now;
    const h0 = R.clockTo.hNow;
    let h1 = hour;
    while (h1 < h0) h1 += 12;
    if (viaNight) h1 += 12;
    R.clockTo.hNow = h1;
    const setW = (a, b, e) => {
      R.win.top.value.copy(new THREE.Color(a.top).lerp(new THREE.Color(b.top), e));
      R.win.horizon.value.copy(new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), e));
      R.win.sun.value.copy(new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), e));
      R.beamBase = a.beam + (b.beam - a.beam) * e;
      R.patchBase = a.patch + (b.patch - a.patch) * e;
    };
    if (!dur || this.reduced) {
      setW(w, w, 1);
      R.win.now = w;
      R.clockH = h1;
      return;
    }
    this.task(dur, (p) => {
      const e = easeIO(p);
      R.clockH = h0 + (h1 - h0) * e;
      if (viaNight) {
        // تحوّل هادئ عبر الليل (مرة واحدة، بلا وميض)
        if (p < 0.5) setW(from, WINDOW.night, easeIO(p * 2));
        else setW(WINDOW.night, w, easeIO((p - 0.5) * 2));
      } else setW(from, w, e);
    }, { room: R.id, onDone: () => (R.win.now = w) });
  }

  // ------------------------------------------------------------------ أدوات الحركة
  /** مهمة تُنفَّذ كل إطار حتى تكتمل (p من 0 إلى 1) */
  task(dur, fn, { delay = 0, room = null, onDone = null } = {}) {
    const t = { t0: performance.now() / 1000 + delay, dur: Math.max(0.001, dur), fn, room, onDone, cancelled: false };
    this.tasks.push(t);
    return t;
  }
  at(delay, fn, room = null) {
    return this.task(0.001, (p) => p >= 1 && fn(), { delay, room });
  }
  _clearTasks(roomId = null) {
    for (const t of this.tasks) if (!roomId || t.room === roomId) t.cancelled = true;
    this.tasks = this.tasks.filter((t) => !t.cancelled);
  }
  pose(D, name) {
    D.target = POSES[name] || POSES.rest;
    D.poseName = name;
  }
  /** انزلاق الدمية (مع قفزة صغيرة) إلى موضع، ودورانها */
  glide(R, D, to, { dur = 0.9, rotY = null, hop = 0.12, delay = 0 } = {}) {
    let from = null;
    let r0 = 0;
    this.task(dur, (p) => {
      if (!from) {
        from = D.root.position.clone();
        r0 = D.doll.rotation.y;
      }
      const e = easeIO(p);
      D.root.position.lerpVectors(from, to, e);
      D.doll.position.y = Math.sin(p * Math.PI) * hop;
      if (rotY !== null) D.doll.rotation.y = r0 + (rotY - r0) * e;
    }, { room: R.id, delay });
  }
  _icon(D, kind) {
    if (!kind) {
      D.iconKind = null;
      return;
    }
    if (D.iconKind !== kind) {
      D.iconMat.map = badge(kind);
      D.iconMat.needsUpdate = true;
      D.iconKind = kind;
      D.icon.scale.setScalar(0.001);
    }
  }

  // ------------------------------------------------------------------ أشياء صغيرة (تُبنى عند الحاجة)
  _prop(R, key, make) {
    R.propCache ||= {};
    let o = R.propCache[key];
    if (!o) {
      o = R.propCache[key] = make();
      o.traverse((m) => {
        if (m.isMesh) m.castShadow = this.tier === 'A';
      });
    }
    if (o.parent !== R.props) R.props.add(o);
    o.visible = true;
    return o;
  }
  _hideProps(R) {
    for (const o of Object.values(R.propCache || {})) o.visible = false;
    R.bubbles && (R.bubbles.visible = false);
  }
  _tissueBox(R) {
    return this._prop(R, 'tbox', () => {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.11, 0.13, 2, 0.015), enamel(0x7fc7e6));
      box.position.y = 0.055;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), tissuePaper());
      tuft.scale.set(1.2, 0.9, 0.6);
      tuft.position.y = 0.12;
      g.add(box, tuft);
      return g;
    });
  }
  _tissue(R) {
    return this._prop(R, 'tissue', () => {
      const geo = new THREE.PlaneGeometry(0.26, 0.24, 8, 8);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(p.getX(i) * 3.2, 2) * 0.05 + Math.sin(p.getY(i) * 30) * 0.004);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, tissuePaper());
    });
  }
  _tissueBall(R) {
    return this._prop(R, 'tball', () => {
      const geo = new THREE.IcosahedronGeometry(0.06, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = V(p.getX(i), p.getY(i), p.getZ(i));
        v.multiplyScalar(1 + (Math.sin(v.x * 90) * Math.cos(v.y * 70) + Math.sin(v.z * 80)) * 0.12);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, tissuePaper());
    });
  }
  _sponge(R) {
    return this._prop(R, 'sponge', () => {
      const g = new THREE.Group();
      const a = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.12, 3, 0.02), new THREE.MeshPhysicalNodeMaterial({ color: 0xffd23f, roughness: 1 }));
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.025, 0.12, 3, 0.01), enamel(0x2a9d96));
      b.position.y = 0.035;
      g.add(a, b);
      return g;
    });
  }
  _bottle(R, key, tint, capHex) {
    return this._prop(R, key, () => {
      const g = new THREE.Group();
      const prof = [[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.17], [0.03, 0.21], [0.022, 0.23], [0, 0.23]].map(([r, y]) => new THREE.Vector2(r, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), bottlePlastic(this.tier, tint));
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 24), new THREE.MeshPhysicalNodeMaterial({ color: 0x9fd8f5, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
      water.position.y = 0.07;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.035, 20), enamel(capHex));
      cap.position.y = 0.245;
      g.add(water, body, cap);
      return g;
    });
  }
  _sandwich(R) {
    return this._prop(R, 'sandwich', () => {
      const g = new THREE.Group();
      const bread = enamel(0xe9b872, { roughness: 0.7, clearcoat: 0.2 });
      const a = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.03, 0.14, 2, 0.012), bread);
      const b = a.clone();
      b.position.y = 0.05;
      const l = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.02, 0.15, 2, 0.008), enamel(0x6fbf4a));
      l.position.y = 0.025;
      g.add(a, l, b);
      return g;
    });
  }
  _magnifier(R) {
    return this._prop(R, 'lens', () => {
      const g = new THREE.Group();
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), glass(this.tier, 0xf4fbff));
      lens.scale.z = 0.35;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 16, 64), gold());
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.4, 16), chrome());
      handle.position.set(0.3, -0.35, 0);
      handle.rotation.z = 0.7;
      g.add(lens, rim, handle);
      return g;
    });
  }
  _bubbles(R) {
    if (!R.bubbles) {
      R.bubbles = new THREE.Group();
      const geo = new THREE.SphereGeometry(1, 24, 16);
      const m = bubbleMat(this.tier);
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(geo, m);
        b.userData = { a: Math.random() * Math.PI * 2, r: 0.08 + Math.random() * 0.14, s: 0.02 + Math.random() * 0.035, v: 0.6 + Math.random() };
        R.bubbles.add(b);
      }
      R.props.add(R.bubbles);
    }
    R.bubbles.visible = true;
    return R.bubbles;
  }

  // ------------------------------------------------------------------ أحداث الجسيمات
  _heads(R, except = -1) {
    return R.dolls.filter((D) => D.idx !== except && !D.away).map((D) => ({ c: arr(D.headWorld()), r: 0.19 }));
  }
  _scale(n) {
    return this.tier === 'A' ? n : Math.round(n * 0.1);
  }
  /** عطسة من دمية نحو نقطة (أو للأمام) */
  _sneeze(R, D, { toward = null, shield = null, power = 1, count = 9000, cough = false } = {}) {
    const m = D.mouthWorld();
    const dir = toward ? toward.clone().sub(m).normalize().add(V(0, 0.12, 0)).normalize() : V(0, 0.08, 1).normalize();
    this.onSound('achoo', R.id, cough);
    return R.spray.sneeze({
      origin: arr(m), dir: arr(dir), count: this._scale(count), t0: this.simT, power: cough ? power * 0.7 : power,
      shield, desks: R.deskTops, heads: this._heads(R, D.idx), spread: cough ? 0.35 : 0.42,
    });
  }
  _spark(R, p, n = 70) {
    R.spray.burst(arr(p), { t0: this.simT, count: this._scale(n * 4) || 12, kind: KIND.SPARK, speed: 1.6, up: 0.9 });
  }

  // ------------------------------------------------------------------ الحالة
  reset() {
    this._clearTasks();
    this.timeScale = 1;
    for (const R of Object.values(this.rooms)) this.resetRoom(R.id);
  }
  resetRoom(id) {
    const R = this.rooms[id];
    if (!R) return;
    this._clearTasks(id);
    R.spray.clear({ tAt: this.simT - 1 });
    this._hideProps(R);
    R.door.pivot.rotation.y = 0;
    R.sink.water.visible = false;
    R.bin.lid.rotation.x = 0;
    for (const D of R.dolls) {
      D.sick = 0;
      D.hi = 0;
      D.away = false;
      D.root.visible = true;
      D.root.position.copy(D.home);
      D.doll.rotation.y = 0;
      D.doll.position.y = 0;
      D.cheer = false;
      D.breath = false;
      this._icon(D, null);
      this.pose(D, 'rest');
    }
    R.celebrate = false;
    this._roomTime(R, WINDOW.am, 8, 0);
  }

  // ------------------------------------------------------------------ الافتتاح: «الأسبوع بلا حماية»
  /**
   * @returns {{dur:number, marks:number[]}} المدة (ث) وأزمنة العبارات الأربع
   */
  intro() {
    this.reset();
    const rooms = Object.values(this.rooms);
    const red = this.reduced;
    this.measureFrom = performance.now();
    this._frames = [];
    if (red) {
      this.setTheme('morning', 0);
      rooms.forEach((R) => {
        OUTBREAK.byDay.forEach((list, d) => list.forEach((i) => this.at(0.4 + d * 0.5, () => this._makeSick(R, R.dolls[i]))));
        this.at(2.6, () => R.dolls.forEach((D) => this._heal(R, D)));
      });
      return { dur: 3.4, marks: [0, 0.4, 1.0, 2.6] };
    }
    this.setTheme('dawn', 0);
    rooms.forEach((R) => this._roomTime(R, WINDOW.am, 7, 0));
    // ١) لقطة واسعة تقترب (هنا يقيس المنظّم الأداء)
    const first = rooms[0].dolls[OUTBREAK.first];
    this._shotNow = this._wideShot();
    this._applyShot(this._shotNow);
    this.view.mode = 'intro';
    this._shotTo(this._closeShot(first, rooms.length === 1 ? 1 : 1), 2.4);
    // ٢) ها… ها… عطسة بلا تغطية، بالتصوير البطيء
    rooms.forEach((R) => {
      const D = R.dolls[OUTBREAK.first];
      this.at(2.3, () => this.pose(D, 'ha'));
      this.at(2.75, () => this.pose(D, 'rest'));
      this.at(2.95, () => this.pose(D, 'ha'));
      this.at(3.35, () => {
        this.pose(D, 'rest');
        D.cur.H[0] = 0.32;
        this.timeScale = 0.22;
        this._sneeze(R, D, { power: 1.15, count: 14000, toward: R.dolls[4].headWorld().add(V(0, 0.1, 1.2)) });
      });
    });
    // ٣) الأيام: الكاميرا تعود، والساعة تدور، والزملاء القريبون يمرضون
    this.at(5.4, () => {
      this.task(0.8, (p) => (this.timeScale = 0.22 + 0.78 * easeIO(p)));
      this._shotTo(this.playShot, 1.6);
      this.setTheme('morning', 1.6);
    });
    rooms.forEach((R) => {
      OUTBREAK.byDay.forEach((list, d) => {
        const t = 5.6 + d * 0.95;
        this.at(t, () => {
          this._roomTime(R, WINDOW.am, 8, 0.85, d > 0);
          list.forEach((i, j) => this.at(0.35 + j * 0.15, () => this._makeSick(R, R.dolls[i])));
        });
      });
      // ٤) نُعيد الأسبوع: الرذاذ يختفي والجميع يُشفى
      this.at(9.0, () => {
        R.spray.clear({ tAt: this.simT });
        R.dolls.forEach((D, j) => this.at(j * 0.08, () => this._heal(R, D)));
        this._roomTime(R, WINDOW.am, 8, 0.6, true);
      });
    });
    this.at(10.4, () => (this.view.mode = 'play'));
    return { dur: 10.6, marks: [0, 3.35, 6.0, 9.0] };
  }

  _makeSick(R, D, v = 1) {
    D.sick = v;
    this.pose(D, 'sick');
    this._icon(D, 'fever');
    this.onSound('sniff', R.id);
  }
  _heal(R, D) {
    D.sick = 0;
    this.pose(D, 'rest');
    this._icon(D, null);
    this._spark(R, D.headWorld(), 10);
  }

  // ------------------------------------------------------------------ المواقف
  /** بداية الموقف: إبراز الدمية وتجهيز المكان */
  cue(id, s) {
    const R = this.rooms[id];
    if (!R) return;
    const D = R.dolls[s.doll];
    const N = R.dolls[s.near];
    for (const X of R.dolls) {
      X.hi = 0;
      X.breath = false;
      if (X.iconKind === 'alert') this._icon(X, null);
    }
    D.hi = 1;
    this._icon(D, 'alert');
    const deskTop = (X) => V(R.desks[X.idx].x, R.deskH, R.desks[X.idx].z);
    switch (s.anim) {
      case 'elbow':
        D.breath = true;
        break;
      case 'tissue': {
        D.breath = true;
        const b = this._tissueBox(R);
        b.position.copy(deskTop(D)).add(V(0.25, 0, 0.05));
        break;
      }
      case 'bin': {
        const ball = this._tissueBall(R);
        this.pose(D, 'handUp');
        R.holdBall = D;
        ball.position.copy(D.handWorld(1));
        break;
      }
      case 'wash': {
        if (s.id === 's10') {
          const sw = this._sandwich(R);
          sw.position.copy(deskTop(D)).add(V(0.1, 0, 0.08));
        } else this.pose(D, 'handUp');
        this.at(0.35, () => {
          const pts = [];
          for (const side of [1, -1]) {
            const h = D.handWorld(side);
            for (let i = 0; i < 9; i++) pts.push([h.x + (Math.random() - 0.5) * 0.12, h.y + (Math.random() - 0.5) * 0.12, h.z + (Math.random() - 0.5) * 0.12]);
          }
          R.handGerms = R.spray.dots(pts, { t0: this.simT });
        }, id);
        break;
      }
      case 'wipe': {
        const d = R.desks[D.idx];
        const pts = [];
        for (let i = 0; i < 40; i++) pts.push([d.x + (Math.random() - 0.5) * 0.9, R.deskH + 0.01, d.z + (Math.random() - 0.5) * 0.5]);
        R.deskGerms = R.spray.dots(pts, { t0: this.simT, kind: KIND.GERM });
        const pts2 = [];
        for (let i = 0; i < 120; i++) pts2.push([d.x + (Math.random() - 0.5) * 0.95, R.deskH + 0.008, d.z + (Math.random() - 0.5) * 0.55]);
        R.deskDrops = R.spray.dots(pts2, { t0: this.simT, kind: KIND.DROP });
        break;
      }
      case 'bottle': {
        N.sick = 0.65;
        this._icon(N, 'fever');
        const own = this._bottle(R, 'bottleOwn', 0x7fd0f0, 0x2a9d96);
        own.position.copy(deskTop(D)).add(V(0.32, 0, 0.1));
        own.rotation.set(0, 0, 0);
        const fr = this._bottle(R, 'bottleFriend', 0xf7a8c0, 0xa3294f);
        const from = deskTop(N).add(V(-0.32 * Math.sign(R.desks[N.idx].x - R.desks[D.idx].x || 1), 0, 0.1));
        fr.position.copy(from);
        fr.rotation.set(0, 0, 0);
        // الزميل المريض يقدّم قنينته (عليها جراثيم)
        const to = deskTop(D).add(V(0.0, 0, 0.18));
        this.task(0.9, (p) => fr.position.lerpVectors(from, to, easeIO(p)), { delay: 0.4, room: id });
        this.at(1.3, () => {
          const c = fr.position.clone().add(V(0, 0.25, 0));
          R.bottleGerms = R.spray.dots(Array.from({ length: 10 }, () => [c.x + (Math.random() - 0.5) * 0.05, c.y + Math.random() * 0.03, c.z + (Math.random() - 0.5) * 0.05]), { t0: this.simT });
        }, id);
        R.friendBottleFrom = from;
        break;
      }
      case 'rest':
        this._makeSick(R, D);
        break;
      case 'distance':
        N.breath = true;
        N.sick = 0.6;
        this._icon(N, 'fever');
        break;
      default:
    }
    this.onSound('cue', id);
  }

  /** مشهد الحل الصحيح. يعيد مدته بالثواني. */
  solve(id, s) {
    const R = this.rooms[id];
    if (!R) return 0;
    const D = R.dolls[s.doll];
    const N = R.dolls[s.near];
    D.breath = false;
    this._icon(D, null);
    const sparkAt = (p, t) => this.at(t, () => this._spark(R, typeof p === 'function' ? p() : p), id);
    switch (s.anim) {
      case 'elbow': {
        this.pose(D, 'elbow');
        this.at(0.5, () => {
          const e = D.elbowWorld();
          this._sneeze(R, D, { toward: N.headWorld(), shield: { c: arr(e.clone().add(V(0, 0.02, 0.03))), r: 0.2 }, power: 0.85, count: 4500, cough: s.id === 's9' });
          this.onSound('block', id);
        }, id);
        sparkAt(() => D.elbowWorld(), 0.75);
        this.at(1.7, () => this.pose(D, 'rest'), id);
        this.at(2.1, () => R.spray.clear({ tAt: this.simT }), id);
        return 2.3;
      }
      case 'tissue': {
        const T = this._tissue(R);
        T.visible = false;
        this.pose(D, 'tissue');
        this.at(0.3, () => {
          T.visible = true;
          T.position.copy(D.mouthWorld()).add(V(0, 0.02, 0.09));
          T.rotation.set(0, 0, 0);
          T.scale.setScalar(1);
        }, id);
        this.at(0.6, () => {
          this._sneeze(R, D, { toward: N.headWorld(), shield: { c: arr(T.position.clone().add(V(0, 0, -0.02))), r: 0.21 }, power: 0.85, count: 4500 });
          this.onSound('block', id);
        }, id);
        sparkAt(() => T.position, 0.85);
        // المنديل يتكوّر في اليد
        this.task(0.5, (p) => T.scale.setScalar(1 - 0.75 * easeIO(p)), { delay: 1.5, room: id });
        this.at(2.0, () => {
          T.visible = false;
          const b = this._tissueBall(R);
          b.position.copy(D.handWorld(1));
          this.pose(D, 'rest');
          R.spray.clear({ tAt: this.simT });
        }, id);
        return 2.3;
      }
      case 'bin': {
        const ball = this._tissueBall(R);
        const from = D.handWorld(1);
        const to = R.bin.mouth.clone().add(V(0, 0.05, 0));
        R.holdBall = null;
        this.task(0.3, (p) => (R.bin.lid.rotation.x = -1.2 * easeOut(p)), { room: id });
        this.task(0.9, (p) => {
          const e = easeIO(p);
          ball.position.lerpVectors(from, to, e);
          ball.position.y += Math.sin(p * Math.PI) * 0.9;
          ball.rotation.x += 0.2;
        }, { delay: 0.2, room: id });
        this.at(1.1, () => {
          ball.visible = false;
          this.onSound('bin', id);
        }, id);
        sparkAt(to, 1.1);
        this.task(0.3, (p) => (R.bin.lid.rotation.x = -1.2 * (1 - easeIO(p))), { delay: 1.3, room: id });
        this.at(0.3, () => this.pose(D, 'rest'), id);
        return 1.8;
      }
      case 'wash': {
        const stand = R.sink.stand.clone();
        const home = D.home.clone();
        const face = R.side > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.glide(R, D, stand, { dur: 1.0, rotY: face });
        this.at(1.0, () => {
          this.pose(D, 'wash');
          R.sink.water.visible = true;
          this.onSound('water', id);
          const B = this._bubbles(R);
          const c = D.handWorld(1).lerp(D.handWorld(-1), 0.5);
          B.position.copy(c);
          B.children.forEach((b) => b.scale.setScalar(0.001));
          this.task(1.4, (p) => {
            B.children.forEach((b, i) => {
              const u = b.userData;
              const a = u.a + p * 6 * u.v;
              b.position.set(Math.cos(a) * u.r, p * 0.25 * u.v + Math.sin(a * 2) * 0.03, Math.sin(a) * u.r);
              const life = Math.sin(Math.min(1, p * 1.3 + i * 0.02) * Math.PI);
              b.scale.setScalar(Math.max(0.001, u.s * life));
            });
          }, { room: id });
          this.onSound('bubbles', id);
          if (R.handGerms) R.spray.clear({ batch: R.handGerms, tAt: this.simT + 0.3 });
        }, id);
        sparkAt(() => D.handWorld(1), 2.0);
        this.at(2.4, () => {
          R.sink.water.visible = false;
          R.bubbles && (R.bubbles.visible = false);
          this.pose(D, 'rest');
          this.glide(R, D, home, { dur: 1.0, rotY: 0 });
        }, id);
        return 3.5;
      }
      case 'wipe': {
        const sp = this._sponge(R);
        const d = R.desks[D.idx];
        const y = R.deskH + 0.03;
        sp.position.set(d.x - 0.45, y + 0.3, d.z);
        this.task(0.3, (p) => (sp.position.y = y + 0.3 * (1 - easeOut(p))), { room: id });
        this.task(1.2, (p) => {
          sp.position.x = d.x - 0.42 + 0.84 * easeIO(p);
          sp.position.z = d.z + Math.sin(p * Math.PI * 6) * 0.17;
          sp.rotation.y = Math.sin(p * Math.PI * 6) * 0.25;
        }, { delay: 0.3, room: id });
        this.at(0.3, () => {
          this.onSound('wipe', id);
          const sweep = { xFrom: d.x - 0.45, xTo: d.x + 0.45, dur: 1.2 };
          if (R.deskGerms) R.spray.clear({ batch: R.deskGerms, tAt: this.simT, sweep });
          if (R.deskDrops) R.spray.clear({ batch: R.deskDrops, tAt: this.simT, sweep });
        }, id);
        sparkAt(V(d.x, y + 0.05, d.z), 1.4);
        this.task(0.3, (p) => (sp.position.y = y + 0.3 * easeIO(p)), { delay: 1.55, room: id, onDone: () => (sp.visible = false) });
        return 1.9;
      }
      case 'bottle': {
        const own = this._bottle(R, 'bottleOwn', 0x7fd0f0, 0x2a9d96);
        const fr = this._bottle(R, 'bottleFriend', 0xf7a8c0, 0xa3294f);
        const from = fr.position.clone();
        // قنينة الزميل تعود إليه، وقنينة يوسف ترتفع إلى فمه
        this.task(0.8, (p) => fr.position.lerpVectors(from, R.friendBottleFrom, easeIO(p)), { room: id });
        if (R.bottleGerms) R.spray.clear({ batch: R.bottleGerms, tAt: this.simT + 0.2 });
        const o0 = own.position.clone();
        this.pose(D, 'drink');
        this.task(0.7, (p) => {
          const m = D.mouthWorld().add(V(0.05, -0.08, 0.1));
          own.position.lerpVectors(o0, m, easeIO(p));
          own.rotation.x = -1.1 * easeIO(p);
        }, { delay: 0.5, room: id });
        this.at(1.25, () => this.onSound('gulp', id), id);
        sparkAt(() => own.position, 1.3);
        this.task(0.6, (p) => {
          const m = D.mouthWorld().add(V(0.05, -0.08, 0.1));
          own.position.lerpVectors(m, o0, easeIO(p));
          own.rotation.x = -1.1 * (1 - easeIO(p));
        }, { delay: 1.6, room: id });
        this.at(1.7, () => this.pose(D, 'rest'), id);
        return 2.3;
      }
      case 'rest': {
        const door = R.door;
        this.glide(R, D, door.pos.clone(), { dur: 1.0, rotY: R.side > 0 ? Math.PI / 2 : -Math.PI / 2, hop: 0.1 });
        this.task(0.5, (p) => (door.pivot.rotation.y = door.out * 1.7 * easeOut(p)), { delay: 0.7, room: id });
        this.at(0.7, () => this.onSound('door', id), id);
        this.glide(R, D, door.outside.clone(), { dur: 0.9, delay: 1.1, hop: 0.05 });
        this.at(2.0, () => {
          D.root.visible = false;
          D.away = true;
          D.root.position.copy(D.home);
          D.doll.rotation.y = 0;
        }, id);
        this.task(0.5, (p) => (door.pivot.rotation.y = door.out * 1.7 * (1 - easeIO(p))), { delay: 2.0, room: id });
        return 2.6;
      }
      case 'distance': {
        // يوسف/الزميل يعطس، وأحمد ابتعد قليلًا فلا يصله الرذاذ
        const away = D.home.clone().add(V((R.desks[D.idx].x - R.desks[N.idx].x > 0 ? 1 : -1) * 0.62, 0, 0.1));
        this.glide(R, D, away, { dur: 0.8, hop: 0.06 });
        N.breath = false;
        this.at(1.0, () => this._sneeze(R, N, { toward: D.home.clone().add(V(0, 1.0, 0.1)), power: 0.55, count: 3000 }), id);
        sparkAt(() => D.headWorld(), 1.6);
        this.at(2.2, () => R.spray.clear({ tAt: this.simT }), id);
        D.displaced = true;
        return 2.4;
      }
      default:
        return 0.8;
    }
  }

  /** خطأ: رذاذ قليل يتجه إلى الزميل الأقرب فيشحب لحظة (لا يبقى المرض). */
  wrong(id, s) {
    const R = this.rooms[id];
    if (!R) return;
    const D = R.dolls[s.doll];
    const N = R.dolls[s.near];
    const src = D.away ? R.dolls[s.near] : D;
    const tgt = D.away ? R.dolls[(s.near + 1) % 6] : N;
    this.task(0.4, (p) => (src.doll.rotation.z = Math.sin(p * Math.PI * 4) * 0.08 * (1 - p)), { room: id });
    R.spray.sneeze({ origin: arr(src.mouthWorld()), dir: arr(tgt.headWorld().sub(src.mouthWorld()).normalize()), count: this._scale(900) || 60, t0: this.simT, power: 0.5, mistFrac: 0.3, germFrac: 0.3, heads: this._heads(R, src.idx), desks: R.deskTops, life: 2.5 });
    const was = tgt.sick;
    this.at(0.45, () => {
      tgt.sick = Math.max(was, 0.5);
    }, id);
    this.at(1.6, () => (tgt.sick = was), id);
    this.at(2.0, () => R.spray.clear({ tAt: this.simT }), id);
  }

  /** الانتقال إلى الموقف التالي: الساعة تدور والنافذة تتحوّل (عبر الليل إن تغيّر اليوم). يعيد المدة. */
  advance(id, next, prev) {
    const R = this.rooms[id];
    if (!R) return 0;
    const newDay = !prev || next.day !== prev.day;
    const dur = newDay ? 1.5 : 1.0;
    for (const X of R.dolls) {
      X.hi = 0;
      if (X.iconKind === 'alert') this._icon(X, null);
    }
    this._roomTime(R, next.period ? WINDOW.pm : WINDOW.am, next.period ? 11 : 8, dur, newDay);
    this.onSound('tick', id);
    this.at(dur * 0.5, () => {
      this._hideProps(R);
      if (R.holdBall) {
        const b = this._tissueBall(R);
        b.position.copy(R.holdBall.handWorld(1));
      }
      if (newDay) {
        // يوم جديد: الجميع بخير، ومن ذهب إلى البيت يعود سليمًا، ومن ابتعد يرجع إلى مقعده
        for (const X of R.dolls) {
          if (X.away) {
            X.away = false;
            X.root.visible = true;
            this._spark(R, X.headWorld(), 14);
          }
          if (X.displaced) {
            X.displaced = false;
            X.root.position.copy(X.home);
          }
          if (X.sick) this._heal(R, X);
        }
      }
    }, id);
    return dur;
  }

  /** منتصف الأسبوع «سرّ العدوى»: عدسة زجاجية أمام وجه زميل يتنفّس الرذاذ. يعيد المدة. */
  midgame(id) {
    const R = this.rooms[id];
    if (!R) return 0;
    const D = R.dolls[3];
    const S = R.dolls[4];
    const lens = this._magnifier(R);
    const face = D.headWorld().add(V(0, -0.02, 0.32));
    lens.position.copy(face);
    lens.scale.setScalar(0.001);
    this.task(0.5, (p) => lens.scale.setScalar(Math.max(0.001, easeBack(p) * 0.9)), { room: id });
    this.at(0.4, () => this.pose(D, 'ha'), id);
    // رذاذ ناعم يُتنفَّس: ينطلق من الزميل ويصل إلى الأنف والفم
    this.at(0.5, () => R.spray.sneeze({
      origin: arr(S.mouthWorld()), dir: arr(D.mouthWorld().sub(S.mouthWorld()).normalize()), count: this._scale(2500) || 180,
      t0: this.simT, power: 0.45, spread: 0.18, mistFrac: 0.4, germFrac: 0.35, heads: [{ c: arr(D.headWorld()), r: 0.17 }], life: 3,
    }), id);
    this.at(1.9, () => this.pose(D, 'rest'), id);
    this.task(0.45, (p) => lens.scale.setScalar(Math.max(0.001, 0.9 * (1 - easeIO(p)))), { delay: 2.5, room: id, onDone: () => (lens.visible = false) });
    this.at(2.9, () => R.spray.clear({ tAt: this.simT }), id);
    this.onSound('mid', id);
    return 3.0;
  }

  /** الفريق أنهى أسبوعه: احتفال في صفّه */
  celebrate(id) {
    const R = this.rooms[id];
    if (!R) return;
    R.celebrate = true;
    for (const D of R.dolls) {
      D.hi = 0;
      this._icon(D, null);
      if (D.away) {
        D.away = false;
        D.root.visible = true;
      }
      D.root.position.copy(D.home);
      D.sick = 0;
      D.cheer = true;
      this.pose(D, 'cheer');
    }
    R.spray.rain({ x0: R.cx - R.w * 0.45, x1: R.cx + R.w * 0.45, z0: -DIM.D / 2 + 0.3, z1: DIM.D / 2 - 0.3, y: 2.6 }, { t0: this.simT, count: this._scale(1200) || 120, life: 4.5 });
    this._roomTime(R, WINDOW.pm, 13, 1.0);
  }

  /** الختام: الأسبوع كله بحماية (الساعة تدور عبر الأيام، والجميع سليم) ثم غروب ذهبي قصير. يعيد المدة. */
  outro() {
    const rooms = Object.values(this.rooms);
    if (this.reduced) {
      rooms.forEach((R) => this.celebrate(R.id));
      return 1.2;
    }
    this.view.mode = 'outro';
    this.setTheme('sunset', 1.2);
    rooms.forEach((R) => {
      if (!R.celebrate) this.celebrate(R.id);
      for (let d = 0; d < 3; d++) this.at(d * 0.7, () => this._roomTime(R, WINDOW.pm, 14, 0.65, true));
      this.at(1.2, () => R.spray.rain({ x0: R.cx - R.w * 0.45, x1: R.cx + R.w * 0.45, z0: -1.8, z1: 1.8, y: 2.8 }, { t0: this.simT, count: this._scale(1600) || 160, life: 4 }));
    });
    this.at(2.6, () => this.setTheme('morning', 1.0));
    this.at(3.0, () => (this.view.mode = 'play'));
    return 3.0;
  }

  /** للأداة tools/prerender.py: صندوق الصف المسقط ومواضع رؤوس الدمى بوحدة المسرح (u) */
  exportMeta() {
    const b = this.W.bounds;
    const box = this._projBox([V(b.x0 + 0.35, 2.6, b.z0 + 0.25), V(b.x1 - 0.35, 2.6, b.z0 + 0.25), V(b.x0 + 0.35, 0, 1.25), V(b.x1 - 0.35, 0, 1.25)]);
    const rooms = {};
    for (const R of Object.values(this.rooms)) {
      rooms[R.id] = R.dolls.map((D) => {
        const q = D.headWorld().project(this.camera);
        return [Math.round(((q.x + 1) / 2) * this.VW), Math.round(((1 - q.y) / 2) * this.VH)];
      });
    }
    return { w: this.VW, h: this.VH, box, rooms };
  }

  // ------------------------------------------------------------------ الحلقة
  _loop(now) {
    if (now - this._last < FPS_MS - 1) return;
    const dt = Math.min(DT_CAP, (now - this._lastT) / 1000);
    this._lastT = now;
    this._last = now;
    this._regulate(now);
    this.simT += dt * this.timeScale;
    this.uSim.value = this.simT;
    const t = now / 1000;
    // المهام (ما يُضاف أثناء التنفيذ يدخل القائمة الجديدة مباشرة)
    if (this.tasks.length) {
      const list = this.tasks;
      this.tasks = [];
      for (const k of list) {
        if (k.cancelled) continue;
        if (t < k.t0) {
          this.tasks.push(k);
          continue;
        }
        const p = Math.min(1, (t - k.t0) / k.dur);
        try {
          k.fn(p, dt);
        } catch (e) {
          console.warn(e);
        }
        if (k.cancelled) continue;
        if (p < 1) this.tasks.push(k);
        else k.onDone?.();
      }
    }
    // الدمى: أوضاع ناعمة، ومرض، وإبراز، وتنفّس ما قبل العطسة، وهتاف
    const a = 1 - Math.exp(-dt * 9);
    for (const R of Object.values(this.rooms)) {
      for (const D of R.dolls) {
        const P = D.target;
        for (const part of ['L', 'R', 'H']) for (let i = 0; i < 3; i++) D.cur[part][i] += (P[part][i] - D.cur[part][i]) * a;
        let hx = D.cur.H[0];
        if (D.breath) hx += -0.18 * (0.5 + 0.5 * Math.sin(t * 4.2 + D.idx)); // ها… ها…
        D.armL.rotation.set(D.cur.L[0], D.cur.L[1], D.cur.L[2]);
        D.armR.rotation.set(D.cur.R[0], D.cur.R[1], D.cur.R[2]);
        D.head.rotation.set(hx + Math.sin(t * 1.3 + D.idx * 2) * 0.03, D.cur.H[1] + Math.sin(t * 0.7 + D.idx) * 0.06, D.cur.H[2]);
        if (D.cheer) D.doll.position.y = Math.abs(Math.sin(t * 6 + D.idx)) * 0.12;
        D.uSick.value += (D.sick - D.uSick.value) * (1 - Math.exp(-dt * 4));
        D.uHi.value += (D.hi - D.uHi.value) * (1 - Math.exp(-dt * 6));
        const want = D.iconKind ? 0.34 : 0.001;
        const sc = D.icon.scale.x + (want - D.icon.scale.x) * (1 - Math.exp(-dt * 10));
        D.icon.scale.setScalar(sc);
        D.icon.position.y = 1.5 + Math.sin(t * 2.4 + D.idx) * 0.03;
      }
      const H = R.dolls.find((X) => X.hi > 0.5);
      if (H) R.pillar.position.set(H.root.position.x, 0, H.root.position.z);
      R.uPillar.value += ((H ? 1 : 0) - R.uPillar.value) * (1 - Math.exp(-dt * 5));
      R.pillar.visible = R.uPillar.value > 0.02;
      // الساعة
      const h = R.clockH ?? 8;
      R.clock.hour.rotation.z = -(h / 12) * Math.PI * 2;
      R.clock.minute.rotation.z = -(h % 1) * Math.PI * 2 - (t % 60) * 0.001;
      R.uBeam.value = (R.beamBase ?? 0.16) * (this.beamBoost ?? 1);
      R.uPatch.value = Math.min(1.2, (R.patchBase ?? 0.55) * Math.sqrt(this.beamBoost ?? 1));
      R.spray.step(this.renderer, dt * this.timeScale);
    }
    try {
      this.pipeline.render();
    } catch (e) {
      this.onFail?.(e.message);
      this.renderer.setAnimationLoop(null);
    }
  }

  // ------------------------------------------------------------------ منظّم الجودة
  _regulate(now) {
    if (this.forced || this.measureFrom == null) return;
    const el = now - this.measureFrom;
    if (el < 700) return; // تجاوز تجميع المظلّلات
    this._frames.push(now);
    const check = (from, to) => {
      const f = this._frames.filter((x) => x >= this.measureFrom + from && x < this.measureFrom + to);
      if (f.length < 8) return null;
      const d = [];
      for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
      d.sort((x, y) => x - y);
      return d[Math.floor(d.length / 2)];
    };
    const slow = (ms) => ms !== null && ms > 1000 / 26;
    if (!this._r1 && el > 2400) {
      this._r1 = true;
      if (slow(check(700, 2400))) {
        this.prScale = 0.75;
        this.layout(this.wPx, this.hPx, this.VW, this.VH, this.frame);
        this._slowOnce = true;
      }
    }
    if (!this._r2 && el > 4600) {
      this._r2 = true;
      if (this._slowOnce && slow(check(2500, 4600))) {
        if (this.tier === 'A') this._toB();
        else this._slowTwice = true;
      }
    }
    if (!this._r3 && el > 7400) {
      this._r3 = true;
      this.measureFrom = null;
      if ((this.tier === 'B' && this._slowTwice) || (this._wasA && slow(check(4800, 7400)))) this.onFail?.('slow');
    }
  }

  /** نزول من A إلى B في مكانه: بلا ظل حيّ ولا توهّج، وجسيمات أقل */
  _toB() {
    this._wasA = true;
    this.tier = 'B';
    this.sun.castShadow = false;
    this.renderer.shadowMap.enabled = false;
    this.bloomNode = null;
    this._buildPipeline();
    for (const R of Object.values(this.rooms)) {
      R.spray.setDrawCount(1200);
      R.spray.noCompute = true;
    }
    this.prScale = 1;
    this.layout(this.wPx, this.hPx, this.VW, this.VH, this.frame);
    this.onTier?.('B');
  }
}

function clonePose(p) {
  return { L: [...p.L], R: [...p.R], H: [...p.H] };
}
