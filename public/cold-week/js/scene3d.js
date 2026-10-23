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
import { float, mix, pass, renderOutput, screenUV, smoothstep, uniform, vec3, vec4, uv, time, oneMinus, sin, abs } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWorld, roomLayout, DIM } from './world.js';
import { POSES, applyPose, clonePose } from './dolls.js';
import { Spray, KIND, motes } from './particles.js';
import { badge } from './textures.js';
import { OUTBREAK } from './content.js';
import { UILayer } from './ui.js';
import { MicroWorld } from './micro.js';
import { enamel, tissuePaper, bottlePlastic, bubbleMat, glass, gold, chrome, beam } from './materials.js';
import { cameraBudget } from '../../board-kit/js/budget.js';

const FPS_MS = 1000 / 30;
// للتجربة الآلية على جهاز بطيء جدًا (?test): لا نقيّد خطوة الزمن حتى تتزامن الجسيمات مع المهام
const DT_CAP = new URLSearchParams(location.search).has('test') ? 3 : 0.1;
// للتجربة فقط (?slow=8): كل الزمن أبطأ ٨ مرات، لتصوير اللهب والكاميرا على جهاز بطيء جدًا
export const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get('slow')) || 1);
const clock = () => performance.now() / 1000 / SLOW;
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
    this.uSim = uniform(0); // زمن المحاكاة (يتباطأ في اللقطة البطيئة)
    this.simT = 0;
    this.tasks = [];
    this.rooms = {};
    this.teamIds = [];
    this.pr = 1;
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
    this._loadHDRI();

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
    this.pipeline = null; // يُبنى مع الصفوف (setTeams): كاميرا لكل صف
    renderer.setClearColor(0x000000, 0);
    this.cardsMode = new URLSearchParams(location.search).get('render') === 'cards';
    // طبقة البطاقات ثلاثية الأبعاد (ui.js): تُرسم فوق الصف في المسار نفسه فيتوهّج لهبها
    this.ui = new UILayer({ tier, environment: this.scene.environment });
    this.ui.onIgnite = (team) => this.onSound('flame', team);

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

  /**
   * إضاءة بيئية حقيقية: صورة HDRI مصوّرة (Poly Haven «Blouberg Sunrise 2»، CC0) لشاطئ رملي عند الشروق،
   * مصغّرة إلى 256×128 (١٣١ ك.ب). تنعكس على اللؤلؤ والذهب والمينا انعكاسًا طبيعيًا. حتى تُحمَّل: استوديو RoomEnvironment.
   */
  _loadHDRI() {
    new HDRLoader().load(new URL('../assets/env/blouberg_sunrise_2_256.hdr', import.meta.url).href, (tex) => {
      try {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const pm = new THREE.PMREMGenerator(this.renderer);
        const env = pm.fromEquirectangular(tex).texture;
        pm.dispose();
        tex.dispose();
        this.scene.environment = env;
        // الشمس في الصورة تُدار لتأتي من خلف النوافذ مثل الشمس في المشهد
        this.scene.environmentRotation = new THREE.Euler(0, 2.3, 0);
        if (this.ui) {
          this.ui.scene.environment = env;
          this.ui.scene.environmentRotation = new THREE.Euler(0, -0.6, 0);
        }
      } catch (e) {
        console.warn('HDRI', e);
      }
    }, undefined, (e) => console.warn('HDRI غير متاح، يبقى الاستوديو', e));
  }

  // ------------------------------------------------------------------ المعالجة اللاحقة
  _buildPipeline() {
    const r = this.renderer;
    this.uLift = uniform(0.07); // رفع الأسود لجهاز العرض (الملف 10، القسم ٥)
    this.uVig = uniform(0.22);
    this.uWarm = uniform(new THREE.Vector3(1.02, 1.0, 0.97));
    const rooms = Object.values(this.rooms);
    // كل صف بكاميرته: في السباق يُرسم كل نصف بكاميرته (قصّ scissor)، فتقترب كاميرا صف دون أن تهتز صورة الآخر
    this.passes = rooms.map((R) => {
      const p = pass(this.scene, R.cam);
      R.pass = p;
      return p;
    });
    // عمق الميدان: في اللقطات القريبة فقط (R.uDof من 0 إلى 1)، والطبقة A فقط.
    // يُبنى خطّان للمعالجة: بلا عمق ميدان (اللعب العادي) ومعه (اللقطة القريبة)، فلا تُدفع كلفة التمويه في اللقطة العامة.
    const colorOf = (R, withDof) => {
      const c = R.pass.getTextureNode('output');
      if (!withDof) return c.rgb;
      R.uFocus ||= uniform(1.5);
      R.uDof ||= uniform(0);
      // ما هو أقرب من الوجه يبقى حادًّا (بلا تمويه قريب يسيل على الذراع والوجه): نمرّر العمق مقصوصًا عند مسافة التركيز
      const viewZ = R.pass.getViewZNode().min(R.uFocus.negate());
      const blurred = dof(c, viewZ, R.uFocus, float(1.6), float(5));
      return mix(c.rgb, blurred.rgb, R.uDof);
    };
    // ومضة دخول القطرة وخروجها (لكل صف وحده)، بتوهّج دائري من مركز نصفه
    const flashed = (R, rgb) => {
      const cx = rooms.length === 2 ? (R.id === 'a' ? 0.75 : 0.25) : 0.5;
      const d = screenUV.sub(vec3(cx, 0.36, 0).xy).length();
      const k = R.uFlash.mul(smoothstep(0.9, 0.0, d.sub(R.uFlash.mul(0.5))).mul(0.6).add(0.4)).clamp(0, 1);
      return mix(rgb, vec3(0.86, 0.97, 1.0).mul(1.5), k);
    };
    r.setScissorTest(rooms.length === 2); // في السباق: قصّ مرور كل صف (قصّ اللوحة نفسها يبقى كاملًا)
    const worldOf = (withDof) =>
      rooms.length === 2
        ? screenUV.x.greaterThan(0.5).select(flashed(this.rooms.a, colorOf(this.rooms.a, withDof)), flashed(this.rooms.b, colorOf(this.rooms.b, withDof))) // الفريق الأول يمين الشاشة
        : flashed(rooms[0], colorOf(rooms[0], withDof));
    // طبقة البطاقات (مضروبة مسبقًا بالشفافية) فوق الصف
    const uiTex = pass(this.ui.scene, this.ui.camera).getTextureNode('output');
    this.pipelineDof = null;
    this.bloomNodes = [];
    if (this.cardsMode) {
      const m = renderOutput(vec4(uiTex.rgb, 1)).rgb;
      this.pipeline = new THREE.RenderPipeline(r, vec4(mix(vec3(1, 1, 1), m, uiTex.a), 1));
      this.pipeline.outputColorTransform = false;
      return;
    }
    const build = (withDof) => {
      const world = worldOf(withDof);
      let hdr = world.mul(float(1).sub(uiTex.a)).add(uiTex.rgb);
      if (this.tier === 'A') {
        // التوهّج من الصف ومن اللهب فقط: لوحات البطاقات البيضاء تبقى تحت العتبة فلا تغشى المجسّمات
        const glowIn = world.mul(float(1).sub(uiTex.a)).add(uiTex.rgb.mul(0.42));
        const b = bloom(vec4(glowIn, 1), this._theme?.bloom ?? 0.38, 0.4, 1.12);
        this.bloomNodes.push(b);
        hdr = hdr.add(b.rgb);
      }
      // تدرّج سينمائي: تظليل أطراف ناعم + دفء خفيف (قبل التدرّج اللوني)
      const d = screenUV.sub(0.5).length();
      const vig = mix(float(1), float(1).sub(this.uVig), smoothstep(0.32, 0.9, d));
      hdr = hdr.mul(vig).mul(this.uWarm);
      const mapped = renderOutput(vec4(hdr, 1)); // ACES + sRGB حسب إعداد المحرّك
      const lifted = mapped.rgb.mul(float(1).sub(this.uLift)).add(this.uLift);
      const P = new THREE.RenderPipeline(r, vec4(lifted, 1));
      P.outputColorTransform = false;
      return P;
    };
    this.pipeline = build(false);
    // عمق الميدان في الطبقة A لطالب واحد فقط (في السباق صورتان: كلفة مضاعفة لأثر صغير)
    if (this.tier === 'A' && rooms.length === 1) this.pipelineDof = build(true);
    this._warmDof = 3; // تُرسم إطارات أولى بخطّ عمق الميدان (وقيمته صفر فلا فرق في الصورة) ليُترجَم قبل أول لقطة قريبة
  }

  /** قصّ مرور كل صف على نصفه (بكسلات الرسم الفعلية) */
  _scissors() {
    const rooms = Object.values(this.rooms);
    if (rooms.length !== 2 || !this.wPx) {
      rooms.forEach((R) => R.pass?.setScissor(null));
      return;
    }
    const W = Math.floor(this.wPx * this.pr);
    const H = Math.floor(this.hPx * this.pr);
    const mid = Math.floor(W / 2);
    this.rooms.a.pass?.setScissor(mid, 0, W - mid, H);
    this.rooms.b.pass?.setScissor(0, 0, mid, H);
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
      R.cam = new THREE.PerspectiveCamera(32, 1.6, 0.1, 200);
      R.uSim = uniform(0); // زمن الرذاذ في هذا الصف (يتباطأ وحده في لقطة العطسة)
      R.uFlash = uniform(0); // ومضة الغوص في القطرة
      R.simT = 0;
      R.timeScale = 1;
      R.anim = false;
      R.spray = new Spray({ count: per, gpu: this.gpu && this.tier === 'A', time: R.uSim });
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
    this._buildPipeline();
    if (this.wPx) this.layout(this.wPx, this.hPx, this.VW, this.VH, this.frame);
    if (this.cardsMode && !this.ui.galleryIds) this.ui.gallery();
    this.reset();
  }

  get camera() {
    return Object.values(this.rooms)[0]?.cam || this._cam0 || (this._cam0 = new THREE.PerspectiveCamera(32, 1.6, 0.1, 200));
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
    // مع الكاميرا تنخفض الدقة (budget.js) لتبقى ذاكرة معالج الرسوم كافية لتتبّع اليد
    const { dprCap, maxPx: cap } = cameraBudget(this.tier === 'A' ? 1.5 : 1.15, this.tier === 'A' ? 2.6e6 : 1.4e6);
    let pr = Math.min(devicePixelRatio || 1, dprCap) * (this.prScale || 1);
    if (wPx * hPx * pr * pr > cap) pr = Math.sqrt(cap / (wPx * hPx));
    this.pr = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(wPx, hPx, false);
    // قصّ اللوحة النهائية = الشاشة كاملة (القيمة الأولى 300×150 من حجم اللوحة الافتراضي)
    this.renderer.setScissor(0, 0, wPx, hPx);
    this.ui.layout(VW, VH);
    const rooms = Object.values(this.rooms);
    const mid = VW / 2;
    for (const R of rooms) {
      R.cam.aspect = wPx / hPx;
      R.frame = rooms.length === 2 ? (R.id === 'a' ? { ...frame, x0: mid + 10 } : { ...frame, x1: mid - 10 }) : frame;
      R.playShot = this._fitShot(R, R.frame);
      if (!R.anim) this._applyShot(R, R.mode === 'close' && R.shotNow ? R.shotNow : R.playShot);
    }
    this._scissors();
  }

  /** لقطة اللعب: الصف كاملًا داخل المستطيل frame (أعلى الجدار الخلفي إلى ما أمام الطاولات الأمامية) */
  _fitShot(R, frame) {
    const T = DIM.T;
    const x0 = R.cx - R.w / 2 - T;
    const x1 = R.cx + R.w / 2 + T;
    const z0 = -DIM.D / 2 - T;
    const cam = R.cam;
    const target = V(R.cx, 1.0, 0.0);
    const dir = V(0, 0.44, 1).normalize();
    const pts = [V(x0 + 0.35, 2.6, z0 + 0.25), V(x1 - 0.35, 2.6, z0 + 0.25), V(x0 + 0.35, 0, 1.25), V(x1 - 0.35, 0, 1.25)];
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
      box = this._projBox(pts, cam);
      const k = Math.max((box.x1 - box.x0) / fw, (box.y1 - box.y0) / fh);
      dist *= k;
    }
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    box = this._projBox(pts, cam);
    const offU = { x: (box.x0 + box.x1) / 2 - (frame.x0 + frame.x1) / 2, y: (box.y0 + box.y1) / 2 - (frame.top + frame.bottom) / 2 };
    return { pos: cam.position.clone(), target, off: offU };
  }

  _projBox(pts, cam) {
    const out = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    for (const p of pts) {
      const q = p.clone().project(cam);
      const x = ((q.x + 1) / 2) * this.VW;
      const y = ((1 - q.y) / 2) * this.VH;
      out.x0 = Math.min(out.x0, x);
      out.x1 = Math.max(out.x1, x);
      out.y0 = Math.min(out.y0, y);
      out.y1 = Math.max(out.y1, y);
    }
    return out;
  }

  _applyShot(R, s) {
    const cam = R.cam;
    cam.position.copy(s.pos);
    cam.lookAt(s.target);
    const k = this.wPx / this.VW;
    const off = s.off || { x: 0, y: 0 };
    cam.setViewOffset(this.wPx, this.hPx, off.x * k, off.y * k, this.wPx, this.hPx);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    R.shotNow = s;
  }

  /** حركة كاميرا ناعمة بين لقطتين (الأهداف HTML ثابتة، فالحركة لا تحرّك شيئًا يلمسه الطلاب) */
  _shotTo(R, shot, dur, { delay = 0 } = {}) {
    if (this.reduced || dur <= 0) {
      this.at(delay, () => this._applyShot(R, shot), R.id);
      return;
    }
    let from = null;
    this.task(dur, (p) => {
      if (!from) {
        const n = R.shotNow || R.playShot;
        from = { pos: n.pos.clone(), target: n.target.clone(), off: { ...(n.off || { x: 0, y: 0 }) } };
        R.anim = true;
      }
      const e = easeIO(p);
      // قوس صاعد في منتصف الحركة: لا تمرّ الكاميرا عبر رؤوس الصف الأمامي
      const lift = Math.sin(Math.PI * e) * Math.min(1.1, from.pos.distanceTo(shot.pos) * 0.22);
      this._applyShot(R, {
        pos: from.pos.clone().lerp(shot.pos, e).add(V(0, lift, 0)),
        target: from.target.clone().lerp(shot.target, e),
        off: { x: from.off.x + (shot.off.x - from.off.x) * e, y: from.off.y + (shot.off.y - from.off.y) * e },
      });
    }, { delay, room: R.id, onDone: () => {
      R.anim = false;
      R.shotNow = shot;
    } });
  }

  /** إزاحة تجعل نقطة الهدف في منتصف مستطيل الصف (لا منتصف الشاشة) */
  _centerOff(R) {
    const f = R.frame || this.frame;
    return { x: this.VW / 2 - (f.x0 + f.x1) / 2, y: this.VH / 2 - (f.top + f.bottom) / 2 };
  }

  /**
   * لقطة قريبة سينمائية على نقطة (رأس دمية، طاولة، حوض…) من زاوية ثلاثة أرباع، من الجهة الداخلية للصف،
   * وأعلى من رؤوس الصف الأمامي فلا تحجبها دمية أخرى.
   */
  _focusShot(R, P, { dist = 1.5, side = null, up = 0.42 } = {}) {
    const s = side ?? (P.x > R.cx + 0.2 ? -1 : 1);
    const dir = V(s * 0.5, up, 0.86).normalize();
    return { pos: P.clone().addScaledVector(dir, dist), target: P.clone().add(V(-s * 0.08, -0.06, 0.1)), off: this._centerOff(R) };
  }
  _closeShot(R, D, o = {}) {
    return this._focusShot(R, D.headWorld().add(V(0, -0.1, 0.1)), { dist: 1.9, ...o });
  }
  _wideShot(R) {
    const p = R.playShot;
    return { pos: p.pos.clone().add(V(0, 3.2, 4)), target: p.target.clone().add(V(0, 0.4, -0.5)), off: { ...p.off } };
  }
  /** تصوير بطيء في صف واحد */
  _slowmo(R, { k = 0.28, hold = 0.9, delay = 0 } = {}) {
    if (this.reduced) return;
    this.at(delay, () => (R.timeScale = k), R.id);
    this.task(0.5, (p) => (R.timeScale = k + (1 - k) * easeIO(p)), { delay: delay + hold, room: R.id });
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
      for (const b of this.bloomNodes || []) b.strength.value = L('bloom');
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
    const t = { t0: clock() + delay + (this._base || 0), dur: Math.max(0.001, dur), fn, room, onDone, cancelled: false };
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
  /**
   * الشخصية تقوم من كرسيها وتمشي إلى موضع (عالمي)، وتستدير؛ إن كان الموضع مقعدها تجلس عند الوصول.
   * الكرسي يبقى مكانه.
   */
  glide(R, D, to, { dur = 0.9, rotY = null, delay = 0, pose = 'walk' } = {}) {
    let from = null;
    let r0 = 0;
    const local = to.clone().sub(D.root.position);
    const home = local.length() < 0.05;
    this.task(dur, (p) => {
      if (!from) {
        from = D.doll.position.clone();
        r0 = D.doll.rotation.y;
        D.standT = 1;
        if (pose) this.pose(D, pose);
      }
      const e = easeIO(p);
      D.doll.position.x = from.x + (local.x - from.x) * e;
      D.doll.position.z = from.z + (local.z - from.z) * e;
      D.walk = Math.sin(Math.PI * Math.min(1, p * 1.15)) > 0.05 ? 1 : 0;
      if (rotY !== null) D.doll.rotation.y = r0 + (rotY - r0) * Math.min(1, e * 1.6);
    }, { room: R.id, delay, onDone: () => {
      D.walk = 0;
      if (home) {
        D.standT = 0;
        this.pose(D, 'rest');
      }
    } });
  }
  /** الشخصية تعود فورًا إلى مقعدها جالسة */
  _seat(D) {
    D.doll.position.set(0, 0, 0);
    D.doll.rotation.y = 0;
    D.standT = 0;
    D.stand = 0;
    D.walk = 0;
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

  // ------------------------------------------------------------------ أقواس العدوى
  /**
   * قوس ضوئي أحمر برتقالي من المريض إلى من أصابه: ينمو من المصدر، ونبضات ضوء تجري عليه نحو الهدف،
   * ثم يخبو. يُظهر سلسلة العدوى أمام الطلاب.
   */
  _arc(R, from, to, { dur = 1.9, delay = 0, hue = 0xff5a2a } = {}) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 0.35 + from.distanceTo(to) * 0.18;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const geo = new THREE.TubeGeometry(curve, 48, 0.028, 10, false);
    const uP = uniform(0);
    const uF = uniform(1);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const x = uv().x;
    const pulse = sin(x.mul(40).sub(time.mul(14))).mul(0.5).add(0.5).pow(3);
    const head = smoothstep(uP.sub(0.12), uP, x).mul(oneMinus(smoothstep(uP, uP.add(0.01), x)));
    const c = new THREE.Color(hue);
    m.colorNode = vec3(c.r, c.g, c.b).mul(pulse.mul(2.5).add(0.8).add(head.mul(4)));
    m.opacityNode = smoothstep(uP.add(0.01), uP, x).mul(uF).mul(pulse.mul(0.25).add(0.75));
    const tube = new THREE.Mesh(geo, m);
    tube.renderOrder = 22;
    tube.frustumCulled = false;
    this.task(dur, (p) => {
      if (!tube.parent) R.group.add(tube);
      uP.value = Math.min(1.02, easeIO(Math.min(1, p / 0.45)) * 1.02);
      uF.value = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    }, { delay, room: R.id, onDone: () => {
      R.group.remove(tube);
      geo.dispose();
      m.dispose();
    } });
  }
  /** أقرب زميل مريض من قبل (مصدر العدوى المرجّح) */
  _source(R, D) {
    let best = null;
    let bd = 1e9;
    for (const X of R.dolls) {
      if (X === D || !X.sick) continue;
      const d = X.root.position.distanceTo(D.root.position);
      if (d < bd) (bd = d), (best = X);
    }
    return best;
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
    const prev = D.poseName;
    if (['rest', 'sick', 'ha', 'handMouth', 'handUp'].includes(prev)) {
      this.pose(D, 'achoo');
      this.at(0.8, () => D.poseName === 'achoo' && this.pose(D, prev === 'ha' ? 'rest' : prev), R.id);
      D.doll.updateMatrixWorld(true);
    }
    const m = D.mouthWorld();
    const dir = toward ? toward.clone().sub(m).normalize().add(V(0, 0.12, 0)).normalize() : V(0, 0.08, 1).normalize();
    this.onSound('achoo', R.id, cough);
    return R.spray.sneeze({
      origin: arr(m), dir: arr(dir), count: this._scale(count), t0: R.simT, power: cough ? power * 0.7 : power,
      shield, desks: R.deskTops, heads: this._heads(R, D.idx), spread: cough ? 0.35 : 0.42,
    });
  }
  _spark(R, p, n = 70) {
    R.spray.burst(arr(p), { t0: R.simT, count: this._scale(n * 4) || 12, kind: KIND.SPARK, speed: 1.6, up: 0.9 });
  }

  // ------------------------------------------------------------------ الحالة
  reset() {
    this._clearTasks();
    for (const R of Object.values(this.rooms)) this.resetRoom(R.id);
  }
  resetRoom(id) {
    const R = this.rooms[id];
    if (!R) return;
    this._clearTasks(id);
    R.timeScale = 1;
    R.anim = false;
    R.mode = 'play';
    if (R.diving) {
      R.diving = false;
      R.pass.scene = this.scene;
    }
    if (R.uFlash) R.uFlash.value = 0;
    if (R.playShot) this._applyShot(R, R.playShot);
    R.spray.clear({ tAt: R.simT - 1 });
    this._hideProps(R);
    R.door.pivot.rotation.y = 0;
    R.sink.water.visible = false;
    R.bin.lid.rotation.x = 0;
    for (const D of R.dolls) {
      D.sick = 0;
      D.hi = 0;
      D.away = false;
      D.root.visible = true;
      this._seat(D);
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
    // ١) لقطة واسعة تقترب من المريض الأول في كل صف (هنا يقيس المنظّم الأداء)
    rooms.forEach((R) => {
      const first = R.dolls[OUTBREAK.first];
      R.focus = first;
      this._applyShot(R, this._wideShot(R));
      R.mode = 'close';
      this._shotTo(R, this._closeShot(R, first, { side: 1, dist: 1.75 }), 2.4);
    });
    // ٢) ها… ها… عطسة بلا تغطية، بالتصوير البطيء
    rooms.forEach((R) => {
      const D = R.dolls[OUTBREAK.first];
      this.at(2.3, () => this.pose(D, 'ha'));
      this.at(2.75, () => this.pose(D, 'rest'));
      this.at(2.95, () => this.pose(D, 'ha'));
      this.at(3.35, () => {
        this.pose(D, 'achoo');
        this.at(1.2, () => this.pose(D, 'rest'));
        R.timeScale = 0.22;
        this._sneeze(R, D, { power: 1.15, count: 14000, toward: R.dolls[4].headWorld().add(V(0, 0.1, 1.2)) });
      });
    });
    // ٣) الأيام: الكاميرا تعود، والساعة تدور، والزملاء القريبون يمرضون
    this.at(5.4, () => {
      rooms.forEach((R) => {
        this.task(0.8, (p) => (R.timeScale = 0.22 + 0.78 * easeIO(p)), { room: R.id });
        R.mode = 'play';
        this._shotTo(R, R.playShot, 1.6);
        // تتلاشى سحابة العطسة فتظهر أقواس العدوى بين الزملاء
        this.at(1.3, () => R.spray.clear({ tAt: R.simT }), R.id);
      });
      this.setTheme('morning', 1.6);
    });
    rooms.forEach((R) => {
      OUTBREAK.byDay.forEach((list, d) => {
        const t = 5.6 + d * 0.95;
        this.at(t, () => {
          this._roomTime(R, WINDOW.am, 8, 0.85, d > 0);
          list.forEach((i, j) => this.at(0.35 + j * 0.15, () => {
            const X = R.dolls[i];
            const src = this._source(R, X);
            if (src) this._arc(R, src.headWorld(), X.headWorld(), { dur: 1.6 });
            this._makeSick(R, X);
          }));
        });
      });
      // ٤) نُعيد الأسبوع: الرذاذ يختفي والجميع يُشفى
      this.at(9.0, () => {
        R.spray.clear({ tAt: R.simT });
        R.dolls.forEach((D, j) => this.at(j * 0.08, () => this._heal(R, D)));
        this._roomTime(R, WINDOW.am, 8, 0.6, true);
      });
    });
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
          R.handGerms = R.spray.dots(pts, { t0: R.simT });
        }, id);
        break;
      }
      case 'wipe': {
        const d = R.desks[D.idx];
        const pts = [];
        for (let i = 0; i < 40; i++) pts.push([d.x + (Math.random() - 0.5) * 0.9, R.deskH + 0.01, d.z + (Math.random() - 0.5) * 0.5]);
        R.deskGerms = R.spray.dots(pts, { t0: R.simT, kind: KIND.GERM });
        const pts2 = [];
        for (let i = 0; i < 120; i++) pts2.push([d.x + (Math.random() - 0.5) * 0.95, R.deskH + 0.008, d.z + (Math.random() - 0.5) * 0.55]);
        R.deskDrops = R.spray.dots(pts2, { t0: R.simT, kind: KIND.DROP });
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
          R.bottleGerms = R.spray.dots(Array.from({ length: 10 }, () => [c.x + (Math.random() - 0.5) * 0.05, c.y + Math.random() * 0.03, c.z + (Math.random() - 0.5) * 0.05]), { t0: R.simT });
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
  /**
   * مشهد الحل الصحيح بلغة سينمائية: الكاميرا تقترب من صاحب الدور (أو من مكان الحدث)، ثم يحدث الحل
   * — والعطسة بالتصوير البطيء — ثم تعود الكاميرا إلى الصف كله. يعيد المدة الكلية بالثواني.
   */
  solve(id, s) {
    const R = this.rooms[id];
    if (!R) return 0;
    const lead = this.reduced ? 0 : 0.85;
    const back = this.reduced ? 0 : 0.9;
    for (const X of R.dolls) {
      X.hi = 0;
      if (X.iconKind === 'alert') this._icon(X, null);
    }
    R.mode = 'close';
    R.focus = R.dolls[s.anim === 'distance' ? s.near : s.doll];
    this._shotTo(R, this._solveShot(R, s), lead);
    this._base = lead; // كل مهام المشهد تبدأ بعد اقتراب الكاميرا
    let d = 0;
    try {
      d = this._solveScene(id, s);
    } finally {
      this._base = 0;
    }
    this.at(lead + d, () => (R.mode = 'play'), id);
    this._shotTo(R, R.playShot, back, { delay: lead + d });
    return lead + d + back;
  }

  /** أين تنظر الكاميرا في كل مشهد حل */
  _solveShot(R, s) {
    const D = R.dolls[s.doll];
    const N = R.dolls[s.near];
    switch (s.anim) {
      case 'bin':
        return this._focusShot(R, D.headWorld().lerp(R.bin.mouth.clone(), 0.5).add(V(0, 0.05, 0)), { dist: 2.9, up: 0.5 });
      case 'wash':
        return this._focusShot(R, R.sink.hands.clone().add(V(-R.side * 0.35, 0.25, 0)), { dist: 2.1, up: 0.35 });
      case 'wipe': {
        const d = R.desks[D.idx];
        return this._focusShot(R, V(d.x, R.deskH + 0.1, d.z), { dist: 1.7, up: 0.85 });
      }
      case 'rest':
        return this._focusShot(R, R.door.pos.clone().add(V(0, 1.0, 0.4)), { dist: 3.0, up: 0.4 });
      case 'distance':
        return this._focusShot(R, D.headWorld().lerp(N.headWorld(), 0.5), { dist: 2.4, up: 0.45 });
      default:
        return this._closeShot(R, D, { dist: 1.9 });
    }
  }

  _solveScene(id, s) {
    const R = this.rooms[id];
    const D = R.dolls[s.doll];
    const N = R.dolls[s.near];
    D.breath = false;
    this._icon(D, null);
    const sparkAt = (p, t) => this.at(t, () => this._spark(R, typeof p === 'function' ? p() : p), id);
    switch (s.anim) {
      case 'elbow': {
        this.pose(D, 'elbow');
        this._slowmo(R, { delay: 0.45, hold: 0.95 });
        this.at(0.5, () => {
          const e = D.elbowWorld();
          this._sneeze(R, D, { toward: N.headWorld(), shield: { c: arr(e.clone().add(V(0, 0.02, 0.03))), r: 0.2 }, power: 0.85, count: 4500, cough: s.id === 's9' });
          this.onSound('block', id);
        }, id);
        sparkAt(() => D.elbowWorld(), 0.75);
        this.at(1.7, () => this.pose(D, 'rest'), id);
        this.at(2.1, () => R.spray.clear({ tAt: R.simT }), id);
        return 2.3;
      }
      case 'tissue': {
        const T = this._tissue(R);
        T.visible = false;
        this.pose(D, 'tissue');
        this._slowmo(R, { delay: 0.55, hold: 0.95 });
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
          R.spray.clear({ tAt: R.simT });
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
          if (R.handGerms) R.spray.clear({ batch: R.handGerms, tAt: R.simT + 0.3 });
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
          if (R.deskGerms) R.spray.clear({ batch: R.deskGerms, tAt: R.simT, sweep });
          if (R.deskDrops) R.spray.clear({ batch: R.deskDrops, tAt: R.simT, sweep });
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
        if (R.bottleGerms) R.spray.clear({ batch: R.bottleGerms, tAt: R.simT + 0.2 });
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
        this.glide(R, D, door.pos.clone(), { dur: 1.1, rotY: R.side > 0 ? Math.PI / 2 : -Math.PI / 2 });
        this.task(0.5, (p) => (door.pivot.rotation.y = door.out * 1.7 * easeOut(p)), { delay: 0.7, room: id });
        this.at(0.7, () => this.onSound('door', id), id);
        this.glide(R, D, door.outside.clone(), { dur: 0.9, delay: 1.1 });
        this.at(2.0, () => {
          D.root.visible = false;
          D.away = true;
          this._seat(D);
        }, id);
        this.task(0.5, (p) => (door.pivot.rotation.y = door.out * 1.7 * (1 - easeIO(p))), { delay: 2.0, room: id });
        return 2.6;
      }
      case 'distance': {
        // يوسف/الزميل يعطس، وأحمد ابتعد قليلًا فلا يصله الرذاذ
        const away = D.home.clone().add(V((R.desks[D.idx].x - R.desks[N.idx].x > 0 ? 1 : -1) * 0.62, 0, 0.1));
        this.glide(R, D, away, { dur: 0.9 });
        this.at(0.95, () => this.pose(D, 'rest'), id);
        N.breath = false;
        this._slowmo(R, { delay: 0.95, hold: 0.8, k: 0.35 });
        this.at(1.0, () => this._sneeze(R, N, { toward: D.home.clone().add(V(0, 1.0, 0.1)), power: 0.55, count: 3000 }), id);
        sparkAt(() => D.headWorld(), 1.6);
        this.at(2.2, () => R.spray.clear({ tAt: R.simT }), id);
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
    R.spray.sneeze({ origin: arr(src.mouthWorld()), dir: arr(tgt.headWorld().sub(src.mouthWorld()).normalize()), count: this._scale(900) || 60, t0: R.simT, power: 0.5, mistFrac: 0.3, germFrac: 0.3, heads: this._heads(R, src.idx), desks: R.deskTops, life: 2.5 });
    const was = tgt.sick;
    this._arc(R, src.mouthWorld(), tgt.headWorld(), { dur: 1.7, delay: 0.15 });
    this.at(0.45, () => {
      tgt.sick = Math.max(was, 0.5);
    }, id);
    this.at(1.6, () => (tgt.sick = was), id);
    this.at(2.0, () => R.spray.clear({ tAt: R.simT }), id);
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
            this._seat(X);
          }
          if (X.sick) this._heal(R, X);
        }
      }
    }, id);
    return dur;
  }

  /**
   * منتصف الأسبوع «داخل قطرة رذاذ»: زميل يعطس نحو آخر، فتقترب الكاميرا من قطرة أمام أنفه،
   * وتغوص فيها بومضة: عالم مائي فيه جراثيم تسبح، ثم تخرج والزميل يتنفّس الرذاذ. يعيد المدة.
   */
  midgame(id) {
    const R = this.rooms[id];
    if (!R) return 0;
    const D = R.dolls[3];
    const S = R.dolls[4];
    if (this.reduced) {
      this.at(0.2, () => this._sneeze(R, S, { toward: D.headWorld(), power: 0.45, count: 1500 }), id);
      this.onSound('mid', id);
      return 1.6;
    }
    this.micro ||= new MicroWorld(this.tier);
    R.mode = 'close';
    R.focus = D;
    const face = this._closeShot(R, D, { dist: 1.25 });
    this._shotTo(R, face, 0.8);
    this.at(0.25, () => this.pose(D, 'ha'), id);
    // رذاذ ناعم من الزميل يصل إلى الأنف والفم، بالتصوير البطيء
    this.at(0.5, () => {
      R.spray.sneeze({
        origin: arr(S.mouthWorld()), dir: arr(D.mouthWorld().sub(S.mouthWorld()).normalize()), count: this._scale(2500) || 180,
        t0: R.simT, power: 0.45, spread: 0.18, mistFrac: 0.4, germFrac: 0.35, heads: [{ c: arr(D.headWorld()), r: 0.17 }], life: 4,
      });
      this.onSound('achoo', id);
    }, id);
    this._slowmo(R, { delay: 0.6, hold: 3.6, k: 0.18 });
    // اقتراب أشد من قطرة أمام الأنف، ثم ومضة الدخول
    this.at(0.95, () => {
      const nose = D.mouthWorld().add(V(0, 0.02, 0.12));
      this._shotTo(R, this._focusShot(R, nose, { dist: 0.35, up: 0.1 }), 0.45);
    }, id);
    this.task(0.3, (p) => (R.uFlash.value = easeIO(p)), { delay: 1.25, room: id });
    this.at(1.55, () => {
      R.saved = R.shotNow;
      R.pass.scene = this.micro.scene;
      this.micro.scene.environment = this.scene.environment;
      this.micro.reset();
      R.diving = true;
      R.cam.clearViewOffset();
      const k = this.wPx / this.VW;
      const off = this._centerOff(R);
      R.cam.setViewOffset(this.wPx, this.hPx, off.x * k, off.y * k, this.wPx, this.hPx);
      R.cam.updateProjectionMatrix();
      this.onSound('dive', id);
    }, id);
    this.task(0.45, (p) => (R.uFlash.value = 1 - easeIO(p)), { delay: 1.6, room: id });
    // ٢٫٨ ثانية داخل القطرة، ثم الخروج
    this.task(0.3, (p) => (R.uFlash.value = easeIO(p)), { delay: 4.25, room: id });
    this.at(4.55, () => {
      R.diving = false;
      R.pass.scene = this.scene;
      this._applyShot(R, face);
      this.pose(D, 'rest');
    }, id);
    this.task(0.4, (p) => (R.uFlash.value = 1 - easeIO(p)), { delay: 4.6, room: id });
    this.at(5.1, () => R.spray.clear({ tAt: R.simT }), id);
    this.at(5.1, () => (R.mode = 'play'), id);
    this._shotTo(R, R.playShot, 0.9, { delay: 5.1 });
    this.onSound('mid', id);
    return 6.1;
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
      this._seat(D);
      D.sick = 0;
      D.cheer = true;
      this.pose(D, 'cheer');
    }
    R.spray.rain({ x0: R.cx - R.w * 0.45, x1: R.cx + R.w * 0.45, z0: -DIM.D / 2 + 0.3, z1: DIM.D / 2 - 0.3, y: 2.6 }, { t0: R.simT, count: this._scale(1200) || 120, life: 4.5 });
    this._roomTime(R, WINDOW.pm, 13, 1.0);
  }

  /** الختام: الأسبوع كله بحماية (الساعة تدور عبر الأيام، والجميع سليم) ثم غروب ذهبي قصير. يعيد المدة. */
  /**
   * الختام. في وضع «طالب واحد»: الأسبوعان جنبًا إلى جنب — يُبنى صفّان: الأيسر «بلا حماية» (الجميع مرضى،
   * والرذاذ معلّق، وأقواس العدوى)، والأيمن «بحمايتكم» (يهتفون تحت القصاصات). في السباق: احتفال الصفّين.
   * يعيد { dur, split }.
   */
  outro() {
    const rooms = Object.values(this.rooms);
    if (this.reduced) {
      rooms.forEach((R) => this.celebrate(R.id));
      return { dur: 1.2, split: false };
    }
    if (rooms.length === 1 && !this.cardsMode) return this._splitOutro();
    this.setTheme('sunset', 1.2);
    rooms.forEach((R) => {
      if (!R.celebrate) this.celebrate(R.id);
      for (let d = 0; d < 3; d++) this.at(d * 0.7, () => this._roomTime(R, WINDOW.pm, 14, 0.65, true));
      this.at(1.2, () => R.spray.rain({ x0: R.cx - R.w * 0.45, x1: R.cx + R.w * 0.45, z0: -1.8, z1: 1.8, y: 2.8 }, { t0: R.simT, count: this._scale(1600) || 160, life: 4 }));
    });
    this.at(2.6, () => this.setTheme('morning', 1.0));
    return { dur: 3.0, split: false };
  }

  _splitOutro() {
    const R0 = Object.values(this.rooms)[0];
    // ومضة تخفي إعادة البناء
    this.task(0.35, (p) => (R0.uFlash.value = easeIO(p)));
    this.at(0.4, () => {
      this.setTeams(['a', 'b']);
      this.layout(this.wPx, this.hPx, this.VW, this.VH, this.frame);
      const A = this.rooms.a; // يمين: بحمايتكم
      const B = this.rooms.b; // يسار: بلا حماية
      A.uFlash.value = 1;
      B.uFlash.value = 1;
      this.task(0.5, (p) => (A.uFlash.value = B.uFlash.value = 1 - easeIO(p)));
      this.setTheme('morning', 0);
      // بلا حماية: الجميع مرضى، وأقواس العدوى من المريض الأول، ورذاذ معلّق في الهواء
      B.dolls.forEach((D, i) => this.at(0.15 + i * 0.12, () => {
        this._makeSick(B, D);
        if (i !== OUTBREAK.first) this._arc(B, B.dolls[OUTBREAK.first].headWorld(), D.headWorld(), { dur: 2.6 });
      }));
      this.at(0.1, () => this._sneeze(B, B.dolls[OUTBREAK.first], { power: 1, count: 8000, toward: B.dolls[4].headWorld().add(V(0, 0.1, 1.2)) }));
      this._roomTime(B, WINDOW.pm, 14, 0);
      // بحمايتكم: الجميع سالمون يهتفون
      this.celebrate('a');
      this._roomTime(A, WINDOW.pm, 14, 0);
    });
    this.onSound('cheer', 'a');
    return { dur: 4.2, split: true };
  }

  /** للأداة tools/prerender.py: صندوق الصف المسقط ومواضع رؤوس الدمى بوحدة المسرح (u) */
  exportMeta() {
    const b = this.W.bounds;
    const rs = Object.values(this.rooms);
    const pts = [V(b.x0 + 0.35, 2.6, b.z0 + 0.25), V(b.x1 - 0.35, 2.6, b.z0 + 0.25), V(b.x0 + 0.35, 0, 1.25), V(b.x1 - 0.35, 0, 1.25)];
    const bx = rs.map((R) => this._projBox(pts.filter((p) => (rs.length === 1 ? true : R.id === 'a' ? p.x > 0 : p.x < 0)).concat(rs.length === 2 ? [V(0, 2.6, b.z0 + 0.25), V(0, 0, 1.25)] : []), R.cam));
    const box = { x0: Math.min(...bx.map((q) => q.x0)), x1: Math.max(...bx.map((q) => q.x1)), y0: Math.min(...bx.map((q) => q.y0)), y1: Math.max(...bx.map((q) => q.y1)) };
    const rooms = {};
    for (const R of Object.values(this.rooms)) {
      rooms[R.id] = R.dolls.map((D) => {
        const q = D.headWorld().project(R.cam);
        return [Math.round(((q.x + 1) / 2) * this.VW), Math.round(((1 - q.y) / 2) * this.VH)];
      });
    }
    return { w: this.VW, h: this.VH, box, rooms };
  }

  // ------------------------------------------------------------------ الحلقة
  _loop(now) {
    if (now - this._last < FPS_MS - 1) return;
    const dt = Math.min(DT_CAP, (now - this._lastT) / 1000) / SLOW;
    this._lastT = now;
    this._last = now;
    this._regulate(now);
    this.simT += dt;
    this.uSim.value = this.simT;
    for (const R of Object.values(this.rooms)) {
      R.simT += dt * R.timeScale;
      R.uSim.value = R.simT;
    }
    this.ui.update(dt);
    const t = clock();
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
    // الشخصيات: الهيكل العظمي (dolls.js)، ومرض، وإبراز، وهتاف
    for (const R of Object.values(this.rooms)) {
      for (const D of R.dolls) {
        applyPose(D, dt, t);
        D.doll.position.y = D.cheer ? Math.abs(Math.sin(t * 6 + D.idx)) * 0.06 : 0;
        D.uSick.value += (D.sick - D.uSick.value) * (1 - Math.exp(-dt * 4));
        // في اللقطة القريبة يخفت الإبراز الذهبي فلا يغشى الوجه
        const hi = R.mode === 'close' ? D.hi * 0.12 : D.hi;
        D.uHi.value += (hi - D.uHi.value) * (1 - Math.exp(-dt * 6));
        const want = D.iconKind ? 0.34 : 0.001;
        const sc = D.icon.scale.x + (want - D.icon.scale.x) * (1 - Math.exp(-dt * 10));
        D.icon.scale.setScalar(sc);
        D.icon.position.y = 1.5 + Math.sin(t * 2.4 + D.idx) * 0.03;
      }
      // من يقترب من الكاميرا (أقل من ٠٫٩ م) يختفي مؤقتًا فلا يحجب اللقطة
      // يُخفى فقط من يقف بين الكاميرا وصاحب اللقطة (لا صاحب اللقطة نفسه)
      const cp = R.cam.position;
      const fd = R.focus && !R.focus.away ? R.focus.headWorld().distanceTo(cp) : 99;
      for (const X of R.dolls) {
        if (X.away) continue;
        let near = false;
        if ((R.mode === 'close' || R.anim) && X !== R.focus) {
          const d = X.headWorld().distanceTo(cp);
          // قرب العدسة يُخفى دائمًا؛ ومن يقف أمام صاحب اللقطة يُخفى في اللقطة القريبة فقط (لا في اللقطة العامة)
          near = d < 0.95 || (R.mode === 'close' && fd < 4 && d < fd - 0.25);
        }
        X.root.visible = !near;
      }
      const H = R.dolls.find((X) => X.hi > 0.5);
      if (H) R.pillar.position.set(H.root.position.x, 0, H.root.position.z);
      R.uPillar.value += ((H && R.mode !== 'close' ? 1 : 0) - R.uPillar.value) * (1 - Math.exp(-dt * 5));
      R.pillar.visible = R.uPillar.value > 0.02;
      // الساعة
      const h = R.clockH ?? 8;
      R.clock.hour.rotation.z = -(h / 12) * Math.PI * 2;
      R.clock.minute.rotation.z = -(h % 1) * Math.PI * 2 - (t % 60) * 0.001;
      // في اللقطة القريبة تدخل الكاميرا في حزم ضوء النافذة فتغشى الصورة: نخفّفها حتى تعود الكاميرا
      R.closeK = (R.closeK ?? 0) + ((R.mode === 'close' ? 1 : 0) - (R.closeK ?? 0)) * (1 - Math.exp(-dt * 5));
      R.uBeam.value = (R.beamBase ?? 0.16) * (this.beamBoost ?? 1) * (1 - 0.85 * R.closeK);
      R.uPatch.value = Math.min(1.2, (R.patchBase ?? 0.55) * Math.sqrt(this.beamBoost ?? 1));
      R.spray.step(this.renderer, dt * R.timeScale);
      if (R.uDof) {
        const want = R.mode === 'close' && !R.diving && R.focus ? 1 : 0;
        R.uDof.value += (want - R.uDof.value) * (1 - Math.exp(-dt * 4));
        if (R.focus) R.uFocus.value = R.focus.headWorld().distanceTo(R.cam.position);
      }
      if (R.diving && this.micro) this.micro.update(dt, R.cam);
    }
    if (!this.pipeline) return;
    try {
      const rs = Object.values(this.rooms);
      let P = this.pipelineDof && rs.some((R) => R.uDof && R.uDof.value > 0.01) ? this.pipelineDof : this.pipeline;
      if (this.pipelineDof && this._warmDof > 0) {
        this._warmDof--;
        P = this.pipelineDof;
      }
      P.render();
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

