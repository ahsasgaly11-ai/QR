// ---------------------------------------------------------------------------
// المشهد ثلاثي الأبعاد لـ«ركّب الأسنان» — three.js r186 الكلاسيكي (WebGLRenderer)، بمعيار الملف 10.
//
// الفكّان مجسّمان حقيقيان: لثة مجسّمة تلتفّ على القوس بمادة فيزيائية لها لمعان رطب،
// وأسنان من مينا بطبقة لامعة شفافة (clearcoat) وانعكاس بيئي، لكل نوع شكل تاجه ونتوءاته
// (الشكل نفسه الذي تعلّمه الطلاب في البطاقات)، وحلقة بلون النوع عند عنق السن. الخانة
// الفارغة «سنّ شبح» زجاجية فوق تجويف في اللثة، تتوهّج ذهبيًا تحت اليد وأحمر عند الخطأ.
// العالم: استوديو عيادة مضيء (خلفية بمظلِّل ودرج لامع يستقبل ظلًّا ناعمًا) وغبار ضوء يسبح.
//
// الأهداف كلها في game.js (SVG وHTML) فمواضعها واحدة في كل الطبقات:
//   A — ظل حيّ ناعم، ودقة بكسل ≤ 1.5، وغبار ضوء.
//   B — بلا ظل، ودقة ≤ 1.15، بلا جسيمات.
//   C — لا يُنشأ هذا الملف: رسوم SVG الأصلية.
// الكاميرا منظورية محاذاة على وحدات المسرح: نقطة العالم (x, −y, 0) تظهر عند (x, y) بوحدة u.
// الرسم ٣٠ إطارًا/ث على الأكثر وعند الحاجة فقط، ويتوقف عند إخفاء الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROWN_CMDS, ROOT_CMDS, SLOT_CMDS, CUSPS, CROWN_LEN, TYPES, TYPE_ORDER } from './teeth.js';

const FPS_MS = 1000 / 30;
const TIER = {
  A: { dpr: 1.5, maxPx: 2.6e6, shadows: true, motes: 60, shadowMap: 2048 },
  B: { dpr: 1.15, maxPx: 1.4e6, shadows: false, motes: 0, shadowMap: 0 },
};
const GOLD = new THREE.Color('#ffc53d');
const BAD = new THREE.Color('#e23e57');
const easeBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = (deg) => (deg * Math.PI) / 180;

/** الطبقة: ?tier=A|B|C للتجربة، وتقليل الحركة ← C، وبلا WebGL2 ← C. */
export function pickTier() {
  const q = new URLSearchParams(location.search).get('tier');
  if (q && /^[abc]$/i.test(q)) return { tier: q.toUpperCase(), forced: true };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { tier: 'C', forced: false };
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return { tier: 'C', forced: false };
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency || 8) <= 4;
  return { tier: weak ? 'B' : 'A', forced: false };
}

/** شكل ثنائي الأبعاد من أوامر المسار (M/L/Q/C/Z) في teeth.js. */
function shapeFrom(cmds) {
  const sh = new THREE.Shape();
  for (const [c, ...a] of cmds) {
    if (c === 'M') sh.moveTo(a[0], a[1]);
    else if (c === 'L') sh.lineTo(a[0], a[1]);
    else if (c === 'Q') sh.quadraticCurveTo(a[0], a[1], a[2], a[3]);
    else if (c === 'C') sh.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
    else if (c === 'Z') sh.closePath();
  }
  return sh;
}

/**
 * ينشئ المشهد بالطبقة المناسبة، أو يعيد null (الطبقة C).
 * @param {HTMLCanvasElement} canvas
 * @param {{tier:'A'|'B', forced:boolean}} o
 */
export async function createScene3D(canvas, { tier, forced }) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 غير متاح');
    return new Scene3D(renderer, tier, forced);
  } catch (e) {
    console.warn('3D غير متاح ← الطبقة C', e);
    return null;
  }
}

export class Scene3D {
  constructor(renderer, tier, forced) {
    this.renderer = renderer;
    this.tier = tier;
    this.forced = forced;
    this.onTier = null; // (tier) ← حين ينزل المنظّم طبقة ('B' أو 'C')
    this.canvas = renderer.domElement;
    this.scene = new THREE.Scene();
    this.VW = 1600;
    this.VH = 1000;
    this.dirty = true;
    this._last = 0;
    this._frames = [];
    this._govDone = forced;
    this.anims = new Set();
    this.hover = new Set();
    this.target = new Set();
    this.hints = new Map();
    this.teeth = new Map();
    this.jawGroups = [];
    this.lost = false;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = TIER[tier].shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCFSoftShadowMap أُزيل؛ النعومة من shadow.radius
    renderer.setClearColor(0x000000, 0);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.dirty = true;
    });

    // إضاءة بيئية منعكسة (أهم مكوّن في الملف 10) + ثلاثة أضواء
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.hemi = new THREE.HemisphereLight(0xfff8ee, 0xf1dccb, 0.85);
    this.sun = new THREE.DirectionalLight(0xfff3e2, 2.3);
    this.sun.castShadow = TIER[tier].shadows;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(TIER[tier].shadowMap, TIER[tier].shadowMap);
      this.sun.shadow.radius = 7;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.8;
      this.sun.shadow.intensity = 0.8;
    }
    this.fill = new THREE.DirectionalLight(0xe9f0ff, 0.7);
    this.glow = new THREE.PointLight(0xffd27a, 0, 900, 1.6); // يرتفع لحظة الكشف
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target, this.glow);

    this.camera = new THREE.PerspectiveCamera(26, 1.6, 10, 6000);
    this._materials();
    this._geometries();
    this._world();
    this.thumbs = this._makeThumbs();
  }

  // ------------------------------------------------------------------ المواد
  _materials() {
    const tint = (hex, k) => new THREE.Color(0xfbf7f0).lerp(new THREE.Color(hex), k);
    const enamel = (color) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.2,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        sheen: 0.35,
        sheenColor: new THREE.Color(0xfff2dc),
        sheenRoughness: 0.5,
        envMapIntensity: 1.15,
      });
    this.m = {
      enamel: enamel(new THREE.Color(0xfbf7f0)),
      // في القائمة والنتيجة: المينا مصبوغة قليلًا بلون النوع لتعليم الأنواع
      tinted: Object.fromEntries(TYPE_ORDER.map((t) => [t, enamel(tint(TYPES[t].color, 0.66))])),
      band: Object.fromEntries(
        TYPE_ORDER.map((t) => [t, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(TYPES[t].color), roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: new THREE.Color(TYPES[t].color), emissiveIntensity: 0.08 })])
      ),
      ghost: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.12,
        transmission: 0,
        transparent: true,
        opacity: 0.14,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0,
        depthWrite: false,
      }),
      socket: new THREE.MeshStandardMaterial({ color: 0x9e2f4b, roughness: 0.8 }),
      socketRim: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.55, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.1 }),
      gum: new THREE.MeshPhysicalMaterial({
        color: 0xf2869a,
        roughness: 0.48,
        sheen: 0.9,
        sheenColor: new THREE.Color(0xffc4cf),
        sheenRoughness: 0.45,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.7,
      }),
      gumDark: new THREE.MeshPhysicalMaterial({ color: 0xd9647c, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xffb0bf) }),
      root: new THREE.MeshStandardMaterial({ color: 0xead8b4, roughness: 0.72 }),
      tray: new THREE.MeshPhysicalMaterial({ color: 0xf6eedf, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.5 }),
    };
  }

  // ------------------------------------------------------------------ الأشكال (إطار محلي: العرض ١، العنق عند y=0)
  _geometries() {
    this.g = {};
    for (const t of TYPE_ORDER) {
      const crown = new THREE.ExtrudeGeometry(shapeFrom(CROWN_CMDS[t]), {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.16,
        bevelSize: 0.1,
        bevelSegments: 5,
        curveSegments: 14,
      });
      // النتوءات: كرات صغيرة مدمجة على سطح التاج (الطواحن والضواحك والناب)
      const parts = [crown];
      for (const [x, y, r] of CUSPS[t]) {
        const s = new THREE.SphereGeometry(r, 20, 14);
        s.translate(x, y, 0.46);
        s.scale(1, 1, 0.75);
        parts.push(s);
      }
      const merged = parts.length > 1 ? mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p), false) : crown;
      merged.computeVertexNormals();
      merged.translate(0, 0, 0.14); // التاج يبرز فوق سطح اللثة
      // العنق: حلقة بلون النوع تحيط بقاعدة التاج (أوسع منه قليلًا فتظهر حوله)
      const band = new THREE.ExtrudeGeometry(shapeFrom(CROWN_CMDS[t]), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2, curveSegments: 12 });
      band.scale(1.17, 1.1, 1);
      band.translate(0, -0.02, 0.02);
      // الجذور للبطاقات (منظر جانبي)
      const root = new THREE.ExtrudeGeometry(shapeFrom(ROOT_CMDS[t]), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 10 });
      this.g[t] = { crown: merged, band, root };
    }
    // الخانة الفارغة بشكل عام لا يكشف النوع (كما في SVG): تجويف داكن في اللثة، وسنّ شبح زجاجية، وإطار مضيء
    const slotShape = shapeFrom(SLOT_CMDS);
    const socket = new THREE.ExtrudeGeometry(slotShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 2, curveSegments: 12 });
    socket.scale(1.08, 1.05, 1);
    socket.translate(0, 0, 0.08);
    const ghost = new THREE.ExtrudeGeometry(slotShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.09, bevelSegments: 4, curveSegments: 12 });
    ghost.translate(0, 0, 0.12);
    const rim = new THREE.ExtrudeGeometry(slotShape, { depth: 0.06, bevelEnabled: false, curveSegments: 12 });
    rim.scale(1.16, 1.1, 1);
    rim.translate(0, -0.02, 0.1);
    this.g.slot = { socket, ghost, rim };
  }

  // ------------------------------------------------------------------ العالم
  _world() {
    // خلفية بمظلِّل: تدرّج دافئ كريمي من المركز، وضجيج ناعم، وتظليل أطراف
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uAspect: { value: 1.6 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec2 vUv; uniform float uT; uniform float uAspect;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
          void main(){
            vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
            float r = length(c);
            vec3 center = vec3(0.992, 0.968, 0.925);
            vec3 edge = vec3(0.905, 0.845, 0.745);
            vec3 col = mix(center, edge, smoothstep(0.15, 0.95, r));
            float n = noise(vUv * 42.0 + uT * 0.02) * 0.5 + noise(vUv * 9.0 - uT * 0.01) * 0.5;
            col += (n - 0.5) * 0.028;
            // بقعة ضوء دافئة أعلى اليسار (نافذة العيادة)
            col += vec3(0.07, 0.05, 0.02) * exp(-dot(c - vec2(-0.55, 0.35), c - vec2(-0.55, 0.35)) * 3.5);
            col *= 1.0 - 0.22 * smoothstep(0.55, 1.1, r);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      })
    );
    this.backdrop.renderOrder = -2;
    this.scene.add(this.backdrop);
    // الدرج اللامع الذي تستقر عليه الفكوك ويستقبل ظلّها
    this.tray = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.m.tray);
    this.tray.receiveShadow = true;
    this.tray.renderOrder = -1;
    this.scene.add(this.tray);
    // غبار ضوء يسبح (الطبقة A)
    const n = TIER[this.tier].motes;
    if (n) {
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = Math.random();
        pos[i * 3 + 1] = Math.random();
        pos[i * 3 + 2] = 40 + Math.random() * 160;
        seed[i] = Math.random() * 100;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      this.motes = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uVW: { value: 1600 }, uVH: { value: 1000 } },
          vertexShader: `attribute float seed; uniform float uT, uPx, uVW, uVH; varying float vA;
            void main(){
              float t = uT * 0.06 + seed;
              vec3 p = vec3((fract(position.x + sin(t*0.37)*0.03 + t*0.004)) * uVW, -(fract(position.y + cos(t*0.29)*0.03 - t*0.003)) * uVH, position.z);
              vA = 0.35 + 0.35 * sin(t * 1.7);
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = (6.0 + 9.0 * fract(seed * 0.37)) * uPx * (1200.0 / -mv.z);
              gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(1.0, 0.93, 0.78, a * 0.55); }`,
        })
      );
      this.scene.add(this.motes);
    }
  }

  /** يضبط الكاميرا والحجم على وحدات المسرح: (x, −y, 0) ↔ (x, y) بوحدة u. */
  resize(VW, VH, scale) {
    this.VW = VW;
    this.VH = VH;
    const w = Math.max(1, Math.round(VW * scale));
    const h = Math.max(1, Math.round(VH * scale));
    const cfg = TIER[this.tier];
    let dpr = Math.min(devicePixelRatio || 1, cfg.dpr * (this.pr || 1));
    dpr = Math.min(dpr, Math.sqrt(cfg.maxPx / (w * h)));
    this.renderer.setPixelRatio(Math.max(0.6, dpr));
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = VW / VH;
    const d = VH / 2 / Math.tan(rad(cam.fov) / 2);
    cam.position.set(VW / 2, -VH / 2, d);
    cam.lookAt(VW / 2, -VH / 2, 0);
    cam.near = d * 0.3;
    cam.far = d * 2.5;
    cam.updateProjectionMatrix();
    // الخلفية والدرج يملآن مجال الرؤية (أبعد من المستوى الصفري فأكبر قليلًا)
    const k = (z) => (d - z) / d;
    this.backdrop.position.set(VW / 2, -VH / 2, -220);
    this.backdrop.scale.set(VW * k(-220) * 1.02, VH * k(-220) * 1.02, 1);
    this.backdrop.material.uniforms.uAspect.value = VW / VH;
    this.tray.position.set(VW / 2, -VH / 2, -10);
    this.tray.scale.set(VW * k(-10) * 1.02, VH * k(-10) * 1.02, 1);
    // الشمس من أعلى اليسار (ظل نحو أسفل اليمين) تغطّي المسرح كله
    this.sun.position.set(VW * 0.18, -VH * 0.05, 720);
    this.sun.target.position.set(VW / 2, -VH / 2, 0);
    if (this.sun.castShadow) {
      const sc = this.sun.shadow.camera;
      sc.left = -VW * 0.7;
      sc.right = VW * 0.7;
      sc.top = VH * 0.7;
      sc.bottom = -VH * 0.7;
      sc.near = 100;
      sc.far = 1800;
      sc.updateProjectionMatrix();
    }
    this.fill.position.set(VW * 0.9, -VH * 0.95, 900);
    this.fill.target.position.set(VW / 2, -VH / 2, 0);
    this.glow.position.set(VW / 2, -VH / 2, 320);
    if (this.motes) {
      this.motes.material.uniforms.uPx.value = this.renderer.getPixelRatio();
      this.motes.material.uniforms.uVW.value = VW;
      this.motes.material.uniforms.uVH.value = VH;
    }
    this.dirty = true;
  }

  // ------------------------------------------------------------------ الفكوك
  /**
   * يبني الفكوك والأسنان من تخطيط game.js.
   * @param {{jaw:string, pts:{x:number,y:number}[], outer:{x:number,y:number}[], meanW:number,
   *          slots:{id:string,type:string,x:number,y:number,angle:number,width:number,filled:boolean}[]}[]} jaws
   * @param {{reveal?:boolean}} o reveal: كل الأسنان ظاهرة مصبوغة بلون نوعها (القائمة والنتيجة)
   */
  setJaws(jaws, { reveal = false } = {}) {
    for (const g of this.jawGroups) this.scene.remove(g);
    this.jawGroups = [];
    this.teeth.clear();
    this.anims.clear();
    this.hover.clear();
    this.target.clear();
    this.hints.clear();
    for (const j of jaws) {
      const group = new THREE.Group();
      // اللثة: أنبوب على امتداد القوس (الخط الخارجي كما في SVG) نصف قطره نصف عرض سن
      // حافة اللثة: أنبوب مركزه عند خط الأعناق مزاحًا قليلًا إلى الخارج (الأسنان تبرز من منتصفه تقريبًا)
      const ridge = j.outer.map((o, k) => {
        const p = j.pts[Math.min(j.pts.length - 1, k * 6)];
        // تفليطة z (0.46) تُطبَّق على المجسّم كله، فمركز المسار يُقسم عليها ليستقر حيث نريد
        return new THREE.Vector3(p.x + (o.x - p.x) * 0.3, -(p.y + (o.y - p.y) * 0.3), (-j.meanW * 0.31) / 0.46);
      });
      const path = new THREE.CatmullRomCurve3(ridge, false, 'catmullrom', 0.4);
      const gum = new THREE.Mesh(new THREE.TubeGeometry(path, 110, j.meanW * 0.66, 22, false), this.m.gum);
      gum.scale.z = 0.46; // مفلطحة كاللثة الحقيقية؛ قمّتها (≈0) تحت قاعدة الأسنان (0.08w)
      gum.castShadow = gum.receiveShadow = TIER[this.tier].shadows;
      group.add(gum);
      // القاع تحت الأسنان (لثة داكنة بين الأنبوب والتيجان)
      // القاع: خط بين خط العنق والخط الخارجي مزاحٌ إلى الداخل قليلًا، تحت الأسنان
      const mid = j.outer.map((o, k) => {
        const p = j.pts[Math.min(j.pts.length - 1, k * 6)];
        return new THREE.Vector3(p.x + (p.x - o.x) * 0.7, -(p.y + (p.y - o.y) * 0.7), (-j.meanW * 0.4) / 0.5);
      });
      const inner = new THREE.CatmullRomCurve3(mid, false, 'catmullrom', 0.4);
      const bed = new THREE.Mesh(new THREE.TubeGeometry(inner, 90, j.meanW * 0.6, 16, false), this.m.gumDark);
      bed.scale.z = 0.5;
      bed.receiveShadow = TIER[this.tier].shadows;
      group.add(bed);
      for (const s of j.slots) group.add(this._tooth(s, reveal));
      this.scene.add(group);
      this.jawGroups.push(group);
    }
    this.dirty = true;
  }

  _tooth(s, reveal) {
    const g = this.g[s.type];
    const root = new THREE.Group();
    root.position.set(s.x, -s.y, 0);
    root.rotation.z = -rad(s.angle);
    const w = s.width * 0.92;
    root.scale.set(w, s.width, s.width);
    const shadows = TIER[this.tier].shadows;
    const crown = new THREE.Mesh(g.crown, reveal ? this.m.tinted[s.type] : this.m.enamel);
    crown.castShadow = shadows;
    const band = new THREE.Mesh(g.band, this.m.band[s.type]);
    const socket = new THREE.Mesh(this.g.slot.socket, this.m.socket);
    socket.receiveShadow = shadows;
    const ghost = new THREE.Mesh(this.g.slot.ghost, this.m.ghost.clone());
    const rim = new THREE.Mesh(this.g.slot.rim, this.m.socketRim.clone());
    const solid = new THREE.Group();
    solid.add(crown, band);
    const empty = new THREE.Group();
    empty.add(socket, ghost, rim);
    root.add(solid, empty);
    const rec = { id: s.id, type: s.type, root, solid, empty, crown, ghost, rim, filled: !!s.filled, base: { x: s.x, y: -s.y } };
    this.teeth.set(s.id, rec);
    this._apply(rec);
    return root;
  }

  _apply(rec) {
    rec.solid.visible = rec.filled;
    rec.empty.visible = !rec.filled;
  }

  /** السن وُضع في مكانه (أو أُزيل): بزّة ظهور كما في SVG. */
  setFilled(id, filled, animate = false) {
    const rec = this.teeth.get(id);
    if (!rec) return;
    rec.filled = filled;
    this._apply(rec);
    this.hover.delete(id);
    if (filled && animate) {
      rec.pop = performance.now();
      this.anims.add(rec);
      this.glow.intensity = 2.6;
      this.glow.position.set(rec.base.x, rec.base.y, 260);
      this.glowAt = performance.now();
    }
    this.dirty = true;
  }

  setHover(ids) {
    const next = new Set([...ids].filter((id) => this.teeth.has(id)));
    if (next.size === this.hover.size && [...next].every((id) => this.hover.has(id))) return;
    this.hover = next;
    this.dirty = true;
  }

  setTarget(ids) {
    this.target = new Set([...ids].filter((id) => this.teeth.has(id)));
    this.dirty = true;
  }

  hint(ids, ms = 2600) {
    const until = performance.now() + ms;
    for (const id of ids) if (this.teeth.has(id)) this.hints.set(id, until);
    this.dirty = true;
  }

  wrong(id) {
    const rec = this.teeth.get(id);
    if (!rec) return;
    rec.wrongAt = performance.now();
    this.anims.add(rec);
    this.dirty = true;
  }

  // ------------------------------------------------------------------ كل إطار
  frame(now) {
    if (this.lost || document.hidden) return;
    const animating = this.anims.size > 0 || this.hover.size > 0 || this.target.size > 0 || this.hints.size > 0 || !!this.motes || this.glow.intensity > 0;
    if (!this.dirty && !animating) return;
    if (now - this._last < FPS_MS) return;
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0.016;
    this._last = now;
    const t = now / 1000;
    if (this.motes) this.motes.material.uniforms.uT.value = t;
    this.backdrop.material.uniforms.uT.value = t;
    if (this.glow.intensity > 0) this.glow.intensity = Math.max(0, this.glow.intensity - dt * 5);

    for (const [id, until] of this.hints) if (now > until) this.hints.delete(id);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5.2);
    for (const rec of this.teeth.values()) {
      const hov = this.hover.has(rec.id);
      const tgt = this.target.has(rec.id);
      const hint = this.hints.has(rec.id);
      const gm = rec.ghost.material;
      const rm = rec.rim.material;
      if (tgt) {
        gm.emissive.copy(GOLD);
        gm.emissiveIntensity = 0.45 + 0.5 * pulse;
        gm.opacity = 0.75;
        rm.color.copy(GOLD);
        rm.emissive.copy(GOLD);
        rm.emissiveIntensity = 0.5 + 0.5 * pulse;
        rm.opacity = 0.95;
      } else if (hint) {
        gm.emissive.copy(GOLD);
        gm.emissiveIntensity = 0.3 + 0.35 * pulse;
        gm.opacity = 0.6;
        rm.color.copy(GOLD);
        rm.emissive.copy(GOLD);
        rm.emissiveIntensity = 0.4;
        rm.opacity = 0.9;
      } else if (hov) {
        gm.emissive.copy(GOLD);
        gm.emissiveIntensity = 0.65;
        gm.opacity = 0.7;
        rm.color.copy(GOLD);
        rm.emissive.copy(GOLD);
        rm.emissiveIntensity = 0.7;
        rm.opacity = 1;
      } else {
        gm.emissive.setRGB(1, 1, 1);
        gm.emissiveIntensity = 0;
        gm.opacity = 0.14;
        rm.color.setRGB(1, 1, 1);
        rm.emissive.setRGB(1, 1, 1);
        rm.emissiveIntensity = 0.25;
        rm.opacity = 0.85;
      }
    }
    for (const rec of this.anims) {
      let alive = false;
      if (rec.pop) {
        const k = clamp((now - rec.pop) / 520, 0, 1);
        const e = easeBack(k);
        rec.solid.scale.setScalar(0.25 + 0.75 * e);
        rec.solid.position.z = (1 - easeOut(k)) * 1.6;
        if (k < 1) alive = true;
        else {
          rec.solid.scale.setScalar(1);
          rec.solid.position.z = 0;
          rec.pop = 0;
        }
      }
      if (rec.wrongAt) {
        const k = clamp((now - rec.wrongAt) / 520, 0, 1);
        rec.root.position.x = rec.base.x + Math.sin(k * Math.PI * 6) * (1 - k) * 0.09 * this.VH * 0.1;
        const gm = rec.ghost.material;
        gm.emissive.copy(BAD);
        gm.emissiveIntensity = (1 - k) * 0.9;
        gm.opacity = 0.75;
        rec.rim.material.color.copy(BAD);
        rec.rim.material.emissive.copy(BAD);
        rec.rim.material.emissiveIntensity = (1 - k) * 0.9;
        rec.rim.material.opacity = 1;
        if (k < 1) alive = true;
        else {
          rec.root.position.x = rec.base.x;
          rec.wrongAt = 0;
        }
      }
      if (!alive) this.anims.delete(rec);
    }
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    this._govern(now);
  }

  /** منظّم الجودة: أول ٩٠ إطارًا في الطبقة A؛ إن ثقل الإطار نزلنا إلى B ثم C. */
  _govern(now) {
    if (this._govDone) return;
    if (this._govT) this._frames.push(now - this._govT);
    this._govT = now;
    if (this._frames.length < 90) return;
    const avg = this._frames.slice(30).reduce((a, b) => a + b, 0) / (this._frames.length - 30);
    this._frames = [];
    if (avg > 72 && this.tier === 'A') {
      console.info(`منظّم الجودة: ${avg.toFixed(0)} م.ث/إطار ← الطبقة B`);
      this.setTier('B');
    } else if (avg > 110) {
      console.info(`منظّم الجودة: ${avg.toFixed(0)} م.ث/إطار ← الطبقة C`);
      this._govDone = true;
      this.onTier?.('C');
    } else this._govDone = true;
  }

  setTier(t) {
    if (this.tier === t) return;
    this.tier = t;
    const cfg = TIER[t];
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.sun.castShadow = cfg.shadows;
    if (this.motes && !cfg.motes) {
      this.scene.remove(this.motes);
      this.motes = null;
    }
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.castShadow && cfg.shadows;
        o.receiveShadow = o.receiveShadow && cfg.shadows;
        if (o.material?.needsUpdate !== undefined) o.material.needsUpdate = true;
      }
    });
    this.canvas.dataset.tier = t;
    this.onTier?.(t);
    this.resize(this.VW, this.VH, (this.renderer.domElement.clientHeight || this.VH) / this.VH);
  }

  // ------------------------------------------------------------------ صور البطاقات
  /** يصيّر كل نوع (تاج وجذر، منظر جانبي) مرة واحدة إلى صورة PNG شفافة للبطاقات والسن المحمول. */
  _makeThumbs() {
    const out = {};
    let r = null;
    try {
      const canvas = document.createElement('canvas');
      r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      r.setPixelRatio(1);
      r.setSize(256, 340, false);
      r.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.environment = this.scene.environment;
      scene.environmentIntensity = 0.6;
      scene.add(new THREE.HemisphereLight(0xfff8ee, 0xe9d6c6, 0.9));
      const sun = new THREE.DirectionalLight(0xfff3e2, 2.2);
      sun.position.set(-1.2, 2.2, 3);
      scene.add(sun);
      const cam = new THREE.PerspectiveCamera(24, 256 / 340, 0.5, 30);
      for (const t of TYPE_ORDER) {
        const g = this.g[t];
        const total = CROWN_LEN[t] + { incisor: 1.3, canine: 1.62, premolar: 1.18, molar: 0.95 }[t];
        const group = new THREE.Group();
        const crown = new THREE.Mesh(g.crown, this.m.enamel);
        const band = new THREE.Mesh(g.band, this.m.band[t]);
        const root = new THREE.Mesh(g.root, this.m.root);
        root.position.z = 0.06;
        group.add(crown, band, root);
        // التاج للأعلى، ودوران خفيف ليظهر العمق
        group.rotation.set(0.28, -0.42, 0);
        group.position.y = -(CROWN_LEN[t] - total / 2) * 0.55;
        scene.add(group);
        cam.position.set(0, 0, total * 3.1 + 1.2);
        cam.lookAt(0, 0, 0);
        r.render(scene, cam);
        out[t] = canvas.toDataURL('image/png');
        scene.remove(group);
      }
    } catch (e) {
      console.warn('تعذّر تصيير صور الأسنان', e);
    } finally {
      try {
        r?.dispose();
        r?.forceContextLoss?.();
      } catch {
        /* لا شيء */
      }
    }
    return out;
  }

  dispose() {
    for (const g of this.jawGroups) this.scene.remove(g);
    this.renderer.dispose();
  }
}
