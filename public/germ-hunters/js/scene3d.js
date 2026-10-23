// ---------------------------------------------------------------------------
// المشهد السينمائي لـ«صيّادو الجراثيم — العدسة العملاقة» (الملف 10: تقنية «دانة الصف» و«مختبر العدسة»).
//
// العالم: «مختبر الصيّاد الصغير». جدار مضيء تتسلّل إليه أشعة نافذة، وأضواء مختبر بعيدة ضبابية (bokeh)،
// وغبار يسبح في الضوء، ورفّ خشبي. لكل فريق **عدسة مكبّرة عملاقة** من النحاس على حامل بمقبض بلون الفريق،
// وبجانبها **مصباح أشعة فوق بنفسجية** بذراع مفصلية، وحامل أنابيب اختبار وطبق بتري.
//
// داخل العدسة عالم آخر يُرسم في نسيج (render target) كما في «مختبر العدسة المكبّرة»:
//   • الشيء على قاعدة رخامية يدور، وخلفه ضوء استوديو ناعم. تحت الضوء البنفسجي يظلم الداخل
//     وتتوهّج الجراثيم على سطحه (نقاط HDR تلتقطها مرحلة التوهّج).
//   • **اللحظة المدهشة — الغوص المجهري:** تقترب العدسة من السطح بتمويه تكبير شعاعي، فنرى السطح
//     بتكبير هائل: الخشن جبال ووديان تختبئ فيها الجراثيم (عصيّات وكُرَيّات مضيئة)، والناعم سهل لامع.
//     ثم يهبّ الهواء: على الخشن تبقى الجراثيم في الوديان، وعن الناعم تنزلق وتطير. هكذا **يرى** الطلاب
//     لماذا تعلق الجراثيم على السطح الخشن (ناتج التعلّم الثالث).
//   • مشاهد الجولة ٢ (العطاس، المنديل، المصافحة، الصابون…) تُعرض داخل العدسة أيضًا.
//   • زجاج العدسة مظلِّل: تشويه برميلي، وانحراف لوني عند الحافة، وعمق ميدان، ولمعة زجاج، وتمويه الغوص.
//
// المحرّك: three.js r186 الكلاسيكي (WebGLRenderer) + بيئة PMREM + EffectComposer:
//   RenderPass ← UnrealBloomPass (عتبة 1.6) ← OutputPass (ACES) ← تصحيح جهاز العرض (رفع الأسود وتظليل الأطراف)
//
// طبقات الجودة (الأهداف كلها HTML في game.js، فمواضعها واحدة في الطبقات الثلاث):
//   A: نسيج العدسة 640 بكسل مع MSAA، وظلال حيّة داخل العدسة، وزجاج أنابيب حقيقي، وجراثيم ≈ ٣٢٠٠ نقطة
//      و٣٠٠ جرثومة مجهرية، وتضاريس ١٤٠×١٤٠، ودقة بكسل ≤ 1.5.
//   B: نسيج 420 بلا MSAA، وأقراص ظل، وزجاج رخيص، وجراثيم ≈ ١١٠٠ و١٥٠، وتضاريس ٨٠×٨٠، ودقة ≤ 1.15.
//   C: لا يُنشأ هذا الملف (flat.js).
// الكاميرا محاذاة على وحدات المسرح: نقطة العالم (x, −y, 0) تظهر عند (x, y) بوحدة u.
// تتحرك الكاميرا الرئيسية في الافتتاح فقط (لا أهداف لليد)، ثم تعود إلى المحاذاة تمامًا.
// ٣٠ إطارًا/ث على الأكثر، و١٥ حين لا يتحرك إلا الغبار، ويتوقف الرسم عند إخفاء الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ITEM_MODELS, setUV, pmat, nmap, studioEnvScene, head, tissueSheet, tissueBall, elbowArm, table, sandwich, bin, bottle, bubble } from './models.js';
import { Germs, sampleSurface } from './germs.js';
import { buildCardModel } from './cards3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { labEnvironment } from './env.js';
import { cameraBudget } from '../../board-kit/js/budget.js';

const FPS_MS = 1000 / 30;
const IDLE_MS = 1000 / 15;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const W = (x, y, z = 0) => new THREE.Vector3(x, -y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TEAM_COLOR = { a: '#8a1538', b: '#0e7490', all: '#6d28d9', hero: '#6d28d9' };

/** إعدادات الطبقات */
const TIER = {
  // A السينمائية: إظلال محيطي GTAO بنصف الدقة، وظلال VSM ناعمة، وSMAA حين لا يتوفّر MSAA، وتدرّج لوني كامل
  A: { dpr: 1.5, maxPx: 2.6e6, msaa: 4, bloomRes: 0.5, shadows: true, vsm: true, ao: true, smaa: true, grade: 1, germs: 3200, dust: 220, lensPx: 640, lensMsaa: 4, micro: 340, seg: 140, glass: true },
  B: { dpr: 1.15, maxPx: 1.4e6, msaa: 0, bloomRes: 0.33, shadows: false, vsm: false, ao: false, smaa: false, grade: 0.6, germs: 1100, dust: 90, lensPx: 420, lensMsaa: 0, micro: 170, seg: 80, glass: false },
};

/** وحدات داخل العدسة: الحامل بمقياس S، ونصف قطر ما تراه العدسة R_IN (بوحدات الحامل) */
const S_IN = 100;
const R_IN = 2.3;

/** طبقة الجهاز: A إلا إن كان ضعيفًا معروفًا (المنظّم في game.js يتكفّل بالباقي) */
function autoTier() {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency || 8) <= 4;
  return weak ? 'B' : 'A';
}

/**
 * ينشئ المشهد بالطبقة المناسبة، أو يعيد null (الطبقة C).
 * @param {HTMLCanvasElement} canvas
 * @param {{forced?:string|null}} o
 */
export async function createScene3D(canvas, { forced = null } = {}) {
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return null;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    const tier = forced === 'A' || forced === 'B' ? forced : autoTier();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    const view = new Scene3D(renderer, tier);
    // البطاقات تعرض نماذج حيّة (cards3d.js)، فلا حاجة لصور مسبقة؛ makeThumbs تبقى متاحة عند الحاجة
    view.thumbs = {};
    return view;
  } catch (e) {
    console.warn('3D غير متاح ← الطبقة C', e);
    return null;
  }
}

// ------------------------------------------------------------------ ضجيج صغير (للتضاريس المجهرية)
const PERM = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const h2 = (x, y) => PERM[PERM[x & 255] + (y & 255)] / 255;
const fade = (t) => t * t * (3 - 2 * t);
function vnoise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), xf), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), xf), yf);
}
function fbm2(x, y, oct = 4) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise2(x, y);
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return v;
}
/** مسافة إلى أقرب نقطة خلية (لثقوب الإسفنجة) */
function cell2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i + h2(xi + i, yi + j);
      const cy = yi + j + h2(xi + i + 57, yi + j + 113);
      d = Math.min(d, Math.hypot(x - cx, y - cy));
    }
  }
  return d;
}

/** الفرق بين أقرب نقطتي خلية (صغير عند الحدود): لحدود خلايا الجلد */
function cellEdge(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i + h2(xi + i, yi + j);
      const cy = yi + j + h2(xi + i + 57, yi + j + 113);
      const d = Math.hypot(x - cx, y - cy);
      if (d < d1) (d2 = d1), (d1 = d);
      else if (d < d2) d2 = d;
    }
  }
  return d2 - d1;
}

/**
 * ارتفاع السطح المجهري (بوحدات العالم المجهري) حسب نوع الشيء.
 * الخشن: جبال ووديان (لكل شيء طابعه)، والناعم: سهل لامع بتموّج ضئيل.
 */
function microHeight(kind, x, z) {
  switch (kind) {
    case 'hand': {
      // كما يبدو الجلد تحت المجهر: خطوط البصمة، وخلايا متراصّة بحدود غائرة، ومسام
      const w = fbm2(x * 0.004, z * 0.004, 3) * 6;
      const ridge = Math.pow(Math.abs(Math.sin(x * 0.045 + z * 0.012 + w)), 0.6);
      const cells = Math.min(1, cellEdge(x * 0.022, z * 0.022) * 6);
      const pore = cell2(x * 0.009 + 3.1, z * 0.009 - 1.7) < 0.09 ? -26 : 0;
      return ridge * 42 + cells * 16 + fbm2(x * 0.02, z * 0.02, 4) * 34 + pore - 34;
    }
    case 'sponge': {
      const c = cell2(x * 0.011, z * 0.011);
      return Math.min(1, c * 1.6) * 120 + fbm2(x * 0.03, z * 0.03, 3) * 24 - 90;
    }
    case 'wool': {
      // ألياف متشابكة: موجات في اتجاهين ملتويين
      const w = fbm2(x * 0.006, z * 0.006, 3) * 5;
      const f1 = Math.pow(Math.abs(Math.sin(x * 0.03 + w)), 0.35);
      const f2 = Math.pow(Math.abs(Math.sin(z * 0.026 - w * 0.8 + x * 0.01)), 0.35);
      return Math.max(f1, f2) * 80 + fbm2(x * 0.05, z * 0.05, 2) * 20 - 60;
    }
    case 'ball': {
      // حبيبات منتظمة تقريبًا (نتوءات كرة السلة)
      const b = Math.sin(x * 0.06) * Math.sin(z * 0.06);
      return Math.max(0, b) * 55 + fbm2(x * 0.02, z * 0.02, 3) * 40 - 30;
    }
    case 'log':
      return Math.pow(Math.abs(Math.sin(x * 0.018 + fbm2(x * 0.005, z * 0.01, 3) * 6)), 0.5) * 90 + fbm2(x * 0.03, z * 0.03, 4) * 40 - 70;
    case 'rock':
    case 'rough':
      return fbm2(x * 0.008, z * 0.008, 5) * 210 - 105;
    default:
      // ناعم: تموّج ضئيل جدًا وخدوش دقيقة بالكاد تُرى
      return (fbm2(x * 0.004, z * 0.004, 2) - 0.5) * 6 + Math.pow(Math.abs(Math.sin(x * 0.11 + z * 0.37 + fbm2(x * 0.01, z * 0.01, 2) * 4)), 40) * 1.6;
  }
}

// ------------------------------------------------------------------ مظلِّلات

/** ظلال الطبقة A بنظام VSM: تمويه أوسع وانحياز أصغر (VSM لا يعاني «حبّ الظل» كـ PCF) */
function soften(sh, cfg, radius, bias) {
  if (cfg.vsm) {
    sh.radius = radius * 1.6;
    sh.blurSamples = 12;
    sh.bias = bias * 0.3;
  } else {
    sh.radius = radius;
    sh.bias = bias;
  }
}

/**
 * التدرّج اللوني السينمائي + تصحيح جهاز العرض، بعد OutputPass (قيم sRGB):
 *  - تشبّع أعلى قليلًا ومنحنى S لطيف (عمق بلا سواد مطبق)،
 *  - تلوين منفصل: الأضواء دافئة (نحاس/مصباح) والظلال باردة بنفسجية (هوية المختبر)،
 *  - تظليل أطراف خفيف ورفع الأسود (السبورة في صف مضاء).
 * لا حبيبات ولا تغيّر زمني: صورة ثابتة لا ترتعش على جهاز العرض.
 */
const ProjectorShader = {
  uniforms: { tDiffuse: { value: null }, uLift: { value: 0.045 }, uVig: { value: 0.2 }, uGrade: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uLift, uVig, uGrade; varying vec2 vUv;
    void main(){
      vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.0 + 0.1 * uGrade);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.16 * uGrade);
      float hi = smoothstep(0.5, 1.0, l);
      float lo = 1.0 - smoothstep(0.0, 0.4, l);
      c += uGrade * (vec3(0.014, 0.005, -0.012) * hi + vec3(-0.004, -0.002, 0.016) * lo);
      float v = 1.0 - smoothstep(0.45, 1.0, length((vUv - 0.5) * vec2(1.0, 0.9)) * 1.25);
      c = clamp(c, 0.0, 1.0) * mix(1.0, v, uVig);
      gl_FragColor = vec4(uLift + c * (1.0 - uLift), 1.0);
    }`,
};

/** جدار المختبر: تدرّج دافئ، وأشعة نافذة، وأضواء بعيدة ضبابية، ونقش سداسي خفيف، وإظلام لكل نصف (منتصف اللعبة) */
function wallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color('#f3eefa') },
      uBot: { value: new THREE.Color('#dcd3ea') },
      uLine: { value: new THREE.Color('#7c5cc4') },
      uSize: { value: new THREE.Vector2(1600, 1000) },
      uShelf: { value: 600 },
      uDarkL: { value: 0 },
      uDarkR: { value: 0 },
      uMid: { value: 800 },
      uSolo: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uBot, uLine; uniform vec2 uSize; uniform float uShelf, uDarkL, uDarkR, uMid, uSolo, uTime;
      varying vec3 vW;
      float hexEdge(vec2 p){
        const vec2 s = vec2(1.0, 1.7320508);
        vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
        vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
        vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
        q = abs(q);
        return 0.5 - max(dot(q, s * 0.5), q.x);
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 st = vec2(vW.x, -vW.y);                 // بوحدة المسرح تقريبًا (الجدار خلف المسرح)
        float y = clamp(st.y / uSize.y, 0.0, 1.0);
        vec3 c = mix(uTop, uBot, smoothstep(0.0, 1.0, y)) * 0.93;
        // نقش سداسي خفيف
        float e = hexEdge(vW.xy / 70.0);
        c = mix(c, uLine, (1.0 - smoothstep(0.0, 0.035, e)) * 0.055);
        // أشعة نافذة قطرية دافئة من أعلى اليمين
        float d = (st.x * 0.55 - st.y) / uSize.y;
        float shafts = 0.0;
        shafts += smoothstep(0.10, 0.0, abs(fract(d * 1.2 + 0.15) - 0.5) - 0.18) * 0.55;
        shafts += smoothstep(0.06, 0.0, abs(fract(d * 2.3 + 0.4) - 0.5) - 0.22) * 0.3;
        shafts *= smoothstep(1.0, 0.0, y) * smoothstep(-0.2, 0.6, st.x / uSize.x);
        c += vec3(1.0, 0.94, 0.82) * shafts * 0.10;
        // أضواء مختبر بعيدة ضبابية (bokeh)
        for (int i = 0; i < 9; i++) {
          vec2 o = vec2(hash(vec2(float(i), 3.0)), hash(vec2(float(i), 9.0)) * 0.55) * uSize;
          float r = 40.0 + hash(vec2(float(i), 17.0)) * 70.0;
          float b = smoothstep(r, r * 0.6, length(st - o));
          c += mix(vec3(1.0, 0.9, 0.7), vec3(0.75, 0.7, 1.0), hash(vec2(float(i), 23.0))) * b * 0.045;
        }
        // رفّ المختبر خلف العدسات: حافة خشبية وظلّ تحتها
        float sh = st.y - uShelf;
        c = mix(c, vec3(0.80, 0.66, 0.50), smoothstep(-14.0, -12.0, sh) * smoothstep(2.0, 0.0, sh) * 0.85);
        c *= 1.0 - smoothstep(0.0, 26.0, sh) * smoothstep(60.0, 26.0, sh) * 0.08;
        // إظلام منتصف اللعبة لكل نصف
        float right = uSolo > 0.5 ? 1.0 : smoothstep(uMid - 30.0, uMid + 30.0, vW.x);
        float dark = mix(uDarkL, uDarkR, right);
        vec3 night = vec3(0.035, 0.012, 0.085) * (1.0 + 0.7 * exp(-pow(length(vec2(vW.x - (uSolo > 0.5 ? uMid : (right > 0.5 ? uMid * 1.5 : uMid * 0.5)), vW.y + uSize.y * 0.45) / 560.0), 2.0)));
        c = mix(c, night, dark);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthWrite: false,
  });
}

/**
 * زجاج العدسة: يعرض العالم الداخلي (نسيج العدسة) بتشويه برميلي، وانحراف لوني عند الحافة،
 * وعمق ميدان، وتمويه تكبير شعاعي أثناء الغوص، وتظليل حافة، ولمعة زجاج قوسية.
 */
function lensMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { tLens: { value: tex }, uZoom: { value: 0 }, uFlash: { value: 0 }, uUV: { value: 0 }, uDof: { value: 1 }, uFocus: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tLens; uniform float uZoom, uFlash, uUV, uDof, uFocus; varying vec2 vUv;
      vec3 tap(vec2 uv){ return texture2D(tLens, clamp(uv, vec2(0.002), vec2(0.998))).rgb; }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        vec2 q = p * (1.0 - 0.075 * r * r);          // تشويه برميلي
        vec2 uv = q * 0.5 + 0.5;
        vec2 ca = p * 0.011 * r * r;                  // انحراف لوني عند الحافة
        vec3 c = vec3(tap(uv + ca).r, tap(uv).g, tap(uv - ca).b);
        // تمويه تكبير شعاعي (الغوص)
        if (uZoom > 0.002) {
          vec3 acc = c;
          for (int i = 1; i < 10; i++) {
            float s = 1.0 - uZoom * 0.34 * float(i) / 9.0;
            acc += tap(0.5 + (uv - 0.5) * s);
          }
          c = acc / 10.0;
        }
        // سحب التركيز بين محطات المجهر: الصورة كلها تتموّه ثم تتّضح (كضبط مقبض المجهر)
        float e = max(smoothstep(0.55, 1.0, r) * uDof, uFocus);
        if (e > 0.002) {
          vec3 b = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt((float(i) + 0.5) / 8.0);
            b += tap(uv + vec2(cos(a), sin(a)) * rr * 0.016 * e);
          }
          c = mix(c, b / 8.0, e * 0.85);
        }
        c *= 1.0 - 0.36 * pow(r, 3.5);                // تظليل الحافة
        // لمعة الزجاج: قوس قرب الحافة العليا اليسرى + سطوع عريض خفيف
        vec2 dir = p / max(r, 1e-4);
        float cres = smoothstep(0.035, 0.0, abs(r - 0.885)) * smoothstep(0.25, 0.95, dot(dir, normalize(vec2(-0.62, 0.78))));
        float broad = smoothstep(0.75, 0.0, length(p - vec2(-0.42, 0.48)));
        float k = 1.0 - uUV * 0.55;
        c += vec3(1.0, 0.99, 0.97) * (cres * 0.55 + broad * 0.05) * k;
        c = mix(c, c * vec3(0.86, 0.93, 1.0), smoothstep(0.86, 1.0, r) * 0.6);
        c += vec3(0.85, 0.75, 1.0) * uFlash;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** خلفية داخل العدسة: ضوء استوديو ناعم، ويصير ليلًا بنفسجيًا تحت المصباح */
function backdropMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uUV: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uUV, uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p * vec2(1.0, 1.15));
        vec3 day = mix(vec3(0.98, 0.96, 1.0), vec3(0.72, 0.66, 0.84), smoothstep(0.0, 0.55, r));
        // أضواء استوديو ضبابية
        for (int i = 0; i < 6; i++) {
          vec2 o = vec2(hash(vec2(float(i), 1.0)), hash(vec2(float(i), 7.0))) - 0.5;
          day += vec3(1.0, 0.95, 0.85) * smoothstep(0.09, 0.04, length(p - o * 0.8)) * 0.07;
        }
        // قيم خطية: بنفسجي عميق (يصير متوسط السطوع بعد التحويل إلى شاشة)
        vec3 uvc = mix(vec3(0.045, 0.012, 0.12), vec3(0.006, 0.002, 0.02), smoothstep(0.0, 0.6, r));
        uvc += vec3(0.08, 0.03, 0.2) * smoothstep(0.35, 0.0, r) * 0.3;
        gl_FragColor = vec4(mix(day, uvc, uUV), 1.0);
      }`,
    depthWrite: false,
  });
}

/** مخروط ضوء المصباح (إضافي، بلا عمق) */
function coneMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uUV: { value: 0 }, uCol: { value: new THREE.Color('#9b6bff') } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uUV; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float a = pow(vUv.y, 2.2) * 0.2 * uUV * edge;
        gl_FragColor = vec4(uCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, premultipliedAlpha: true,
  });
}

/**
 * قطرات العطاس: آلاف النقاط تُحسب حركتها كلها في مظلِّل الرؤوس (سرعة ابتدائية، ومقاومة هواء، وجاذبية):
 * الدقيقة تطير أبعد، والكبيرة تسقط على الطاولة. وإن وُجد حاجز (منديل/مرفق) تعلق القطرات عنده.
 * الإحداثيات بوحدات الحامل داخل العدسة.
 */
function droplets(n, origin, { floor = -10, stopX = 1e6, dir = 1 } = {}) {
  const vel = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const fine = Math.random() < 0.7; // ٧٠٪ قطرات دقيقة جدًا
    const sp = fine ? rnd(2.2, 5.2) : rnd(1.4, 3.0);
    const a = rnd(-0.42, 0.32);
    const b = rnd(-0.55, 0.55);
    vel.set([Math.cos(a) * Math.cos(b) * sp * dir, Math.sin(a) * sp, Math.sin(b) * sp * 0.8], i * 3);
    seed.set([rnd(0, 0.18), fine ? rnd(0.6, 1.1) : rnd(1.4, 2.4), fine ? rnd(0.9, 1.5) : rnd(1.9, 3.0), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aV', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uO: { value: origin.clone() }, uFloor: { value: floor }, uStopX: { value: stopX }, uPx: { value: 1000 }, uS: { value: 100 } },
    vertexShader: /* glsl */ `
      attribute vec3 aV; attribute vec4 aSeed;
      uniform float uT, uFloor, uStopX, uPx, uS; uniform vec3 uO;
      varying float vA;
      vec3 at(float t, float k){ return uO + aV * (1.0 - exp(-k * t)) / k + vec3(0.0, -0.9 * t * t, 0.0) * (aSeed.y * 0.6); }
      void main(){
        float k = aSeed.z;
        float t = max(0.0, uT - aSeed.x);
        // زمن الاصطدام بالحاجز (إن وُجد): تعلق القطرة عنده
        float q = (uStopX - uO.x) * k / aV.x;
        float stuck = 0.0;
        if (aV.x > 0.0 && q > 0.0 && q < 1.0) {
          float th = -log(1.0 - q) / k;
          stuck = step(th, t);
          t = min(t, th);
        }
        vec3 p = at(t, k);
        float landed = step(p.y, uFloor);
        p.y = max(p.y, uFloor);
        // القطرات التي استقرّت (على الطاولة أو عند الحاجز) أخفت: لا تتراكم خطًّا أبيض ساطعًا
        // القطرة التي علقت بالحاجز تذوب فيه تقريبًا (المنديل يمتصّها) فلا تتكدّس آلاف النقاط في بقعة واحدة
        vA = smoothstep(0.0, 0.05, uT - aSeed.x) * (0.55 + 0.45 * aSeed.w) * mix(1.0, 0.22, landed) * mix(1.0, 0.04, stuck);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSeed.y * 2.6 * uS * uPx / 100.0 / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 1.6) * vA; gl_FragColor = vec4(vec3(0.75, 0.95, 1.25) * a * 1.4, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 11;
  pts.userData.sample = false;
  pts.userData.drops = true;
  return pts;
}

/** غبار يسبح في ضوء المختبر */
function dustPoints(n) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set([Math.random(), Math.random(), rnd(-300, 220)], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: new THREE.Vector2(1600, 1000) }, uPx: { value: 1000 }, uA: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uPx; uniform vec2 uSize; varying float vA;
      void main(){
        vec3 p = position;
        float t = uTime * (0.012 + aSeed * 0.02);
        p.x = fract(p.x + t * 0.6 + sin(uTime * 0.2 + aSeed * 30.0) * 0.004) * uSize.x;
        p.y = -fract(p.y - t) * uSize.y;
        vA = 0.25 + 0.35 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0) * 0.5 + 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (3.0 + aSeed * 5.0) * uPx / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uA; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 2.0) * vA * uA * 0.55; gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 8;
  return pts;
}

/** نسيج متدرّج دائري (ظل ناعم، هالة) */
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VIOLET = new THREE.Color('#9b6bff');

class Scene3D {
  constructor(renderer, tier) {
    this.renderer = renderer;
    this.tier = tier;
    this.cfg = TIER[tier];
    this.reduced = false;
    this.onSound = () => {};
    this.onFail = null;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = this.cfg.shadows;
    // VSM في A: ظلال ناعمة الأطراف (تمويه حقيقي بـ radius وblurSamples)؛ PCF غير ذلك (r186: النعومة من shadow.radius)
    renderer.shadowMap.type = this.cfg.vsm ? THREE.VSMShadowMap : THREE.PCFShadowMap;
    renderer.setClearColor('#efe9f6', 1);

    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(30, 1.6, 10, 8000);

    // إضاءة بيئية منعكسة: «استوديو» يجعل النحاس والزجاج والمينا تلمع (مشتركة مع عوالم العدسات)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = studioEnvScene();
    this.envRT = pmrem.fromScene(envScene, 0.02);
    envScene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 1.0;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight('#ffffff', '#b9a8d6', 0.65);
    this.key = new THREE.DirectionalLight('#fff2e0', 1.9);
    this.fill = new THREE.DirectionalLight('#dfe8ff', 0.55);
    scene.add(this.hemi, this.key, this.key.target, this.fill, this.fill.target);

    // العالم
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial());
    this.wall.renderOrder = -10;
    scene.add(this.wall);
    this.dust = dustPoints(this.cfg.dust);
    scene.add(this.dust);
    this.shadowTex = radialTex([[0, 'rgba(30,14,60,0.5)'], [0.55, 'rgba(30,14,60,0.2)'], [1, 'rgba(30,14,60,0)']]);

    // مواد مشتركة لعُدد المختبر (لا تُحرَّر مع العدسات: keep)
    const keep = (m) => ((m.userData.keep = true), m);
    this.mat = {
      // النحاس بانعكاس معتدل: لمعاته تحت عتبة التوهّج فلا تنتشر هالة بيضاء داخل العدسة
      brass: keep(new THREE.MeshPhysicalMaterial({ color: '#d09a45', metalness: 1, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.1 })),
      bronze: keep(new THREE.MeshPhysicalMaterial({ color: '#6e4a22', metalness: 1, roughness: 0.4, envMapIntensity: 1 })),
      lampBody: keep(new THREE.MeshPhysicalMaterial({ color: '#3b3456', metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 })),
      steel: keep(new THREE.MeshPhysicalMaterial({ color: '#c9cfd8', metalness: 1, roughness: 0.25 })),
      oak: keep(new THREE.MeshPhysicalMaterial({ color: '#c79a6a', roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.4 })),
      tube: keep(this.cfg.glass
        ? new THREE.MeshPhysicalMaterial({ color: '#f2fbff', roughness: 0.04, transmission: 1, thickness: 6, ior: 1.5, envMapIntensity: 1.3 })
        : new THREE.MeshPhysicalMaterial({ color: '#e6f6ff', roughness: 0.05, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 })),
      agar: keep(new THREE.MeshPhysicalMaterial({ color: '#f3dd8c', roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.85 })),
    };

    // انعكاسات مختبر حقيقي (بانوراما مصوّرة) حين تتحمّل
    labEnvironment(renderer).then((rt) => {
      if (!rt || this._disposed) return rt?.dispose();
      const old = this.envRT;
      this.envRT = rt;
      this.scene.environment = rt.texture;
      for (const T of [...Object.values(this.teams), this._hero].filter(Boolean)) {
        T.ls.environment = rt.texture;
        T.lensDirty = true;
      }
      this.dirty = true;
      old.dispose();
    });

    this.teams = {};
    this.VW = 1600;
    this.VH = 1000;
    this.dirty = true;
    this._last = 0;
    this._raw = performance.now();
    this._lastT = performance.now();
    this._measure = null;
    this._timers = new Set();
    this._cam = null; // حركة الافتتاح
    this._post = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    this._buildPost();

    // حارس: فقدان سياق WebGL ← تنزل اللعبة طبقة (game.js) ولا تتوقف
    this._lost = (e) => {
      e.preventDefault();
      this._fail('context lost');
    };
    renderer.domElement.addEventListener('webglcontextlost', this._lost);
    this.loop = (t) => this._loop(t);
    renderer.setAnimationLoop(this.loop);
    this._vis = () => renderer.setAnimationLoop(document.hidden ? null : this.loop);
    document.addEventListener('visibilitychange', this._vis);
  }

  _fail(why) {
    if (this._failed) return;
    this._failed = true;
    console.warn(`المشهد ثلاثي الأبعاد (الطبقة ${this.tier}) تعطّل: ${why}`);
    this.onFail?.(why);
  }

  /** المعالجة اللاحقة (تحتاج WebGL2 مع نسيج عشري قابل للرسم) */
  _buildPost() {
    const r = this.renderer;
    this.composer = null;
    if (!this._post) return;
    try {
      const coarse = matchMedia('(pointer: coarse)').matches;
      const samples = this.cfg.msaa && !coarse ? this.cfg.msaa : 0;
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples });
      const c = (this.composer = new EffectComposer(r, rt));
      c.addPass(new RenderPass(this.scene, this.camera));
      // إظلال محيطي (GTAO) في A: ظلال التلامس بين العُدد والرف والحلقة النحاسية. بنصف الدقة مع إزالة ضجيج،
      // ويُطبَّق على الصورة الخطية قبل التوهّج. النقاط (الجراثيم والغبار) يستثنيها GTAOPass تلقائيًا.
      this.gtao = null;
      if (this.cfg.ao) {
        const ao = (this.gtao = new GTAOPass(this.scene, this.camera, 4, 4));
        ao.updateGtaoMaterial({ radius: 40, distanceExponent: 1.5, thickness: 22, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        ao.blendIntensity = 0.8;
        const half = GTAOPass.prototype.setSize;
        ao.setSize = (w, h) => half.call(ao, Math.max(4, Math.round(w / 2)), Math.max(4, Math.round(h / 2)));
        c.addPass(ao);
      }
      // العتبة 1.6 (قيمة خطية قبل التدرّج): لا يتوهّج إلا الجراثيم والمصابيح، لا الجدار الفاتح ولا النحاس.
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.3, 1.6);
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.proj = new ShaderPass(ProjectorShader);
      this.proj.uniforms.uGrade.value = this.cfg.grade;
      c.addPass(this.proj);
      // تنعيم الحواف SMAA على الصورة النهائية حين لا يتوفّر MSAA (الأجهزة اللمسية في A)
      if (this.cfg.smaa && !samples) c.addPass(new SMAAPass());
    } catch (e) {
      console.warn('المعالجة اللاحقة غير متاحة', e);
      this.composer = null;
    }
  }

  dispose() {
    this._disposed = true;
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this._vis);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._lost);
    this._clearTimers();
    for (const T of Object.values(this.teams)) this._dropLens(T);
    if (this._hero) this._dropLens(this._hero);
    this.composer?.dispose();
    this.envRT.dispose();
    for (const m of Object.values(this.mat)) m.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ التخطيط
  layout(wPx, hPx, VW, VH) {
    this.VW = VW;
    this.VH = VH;
    this.wPx = wPx;
    this.hPx = hPx;
    // مع الكاميرا تنخفض الدقة (budget.js) لتبقى ذاكرة معالج الرسوم كافية لتتبّع اليد
    const { dprCap, maxPx } = cameraBudget(this.cfg.dpr, this.cfg.maxPx);
    const dpr = Math.min(devicePixelRatio || 1, dprCap, Math.sqrt(maxPx / Math.max(1, wPx * hPx)));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(wPx, hPx, false);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(wPx, hPx);
      this.bloom.setSize(Math.round(wPx * dpr * this.cfg.bloomRes), Math.round(hPx * dpr * this.cfg.bloomRes));
    }
    const cam = this.camera;
    const dist = (this.dist = VH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    cam.aspect = VW / VH;
    cam.near = dist * 0.15;
    cam.far = dist * 3;
    this._alignCam(0);
    // الجدار خلف كل شيء ويغطي المشهد كاملًا (بوحدة المسرح عند المستوى z = zWall)
    const zWall = -620;
    const k = (dist - zWall) / dist;
    this.wall.position.set(VW / 2, -VH / 2, zWall);
    this.wall.scale.set(VW * k * 1.6, VH * k * 1.6, 1);
    const wu = this.wall.material.uniforms;
    wu.uSize.value.set(VW, VH);
    wu.uMid.value = VW / 2;
    // الضوء الرئيسي من أعلى اليمين والأمام، وضوء تعبئة بارد من اليسار
    this.key.position.set(VW * 0.85, VH * 0.25, dist * 0.8);
    this.key.target.position.set(VW / 2, -VH / 2, -200);
    this.fill.position.set(-VW * 0.2, -VH * 0.4, dist);
    this.fill.target.position.set(VW / 2, -VH / 2, 0);
    this.dust.material.uniforms.uSize.value.set(VW, VH);
    this.dirty = true;
  }

  /** الكاميرا محاذاة على المسرح، مع إزاحة سينمائية (0 = محاذاة تامة) */
  _alignCam(off) {
    const { VW, VH, dist } = this;
    if (!dist) return;
    const cam = this.camera;
    const o = this.reduced ? 0 : off;
    cam.position.set(VW / 2 - o * VW * 0.1, -VH / 2 + o * VH * 0.16, dist * (1 + o * 0.6));
    cam.lookAt(VW / 2, -VH / 2 - o * VH * 0.05, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this._pxScale = (this.renderer.getDrawingBufferSize(new THREE.Vector2()).y || 1000) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    this.dust.material.uniforms.uPx.value = this._pxScale;
  }

  /**
   * فرق اللعب وعدساتها: { id: { booth:{x,y,w,h}, zone:{x0,x1,top,bottom} } } بوحدة u.
   */
  setTeams(spec) {
    for (const id of Object.keys(this.teams)) {
      if (!spec[id]) {
        this._dropLens(this.teams[id]);
        delete this.teams[id];
      }
    }
    for (const [id, s] of Object.entries(spec)) {
      let T = this.teams[id];
      if (!T) T = this.teams[id] = this._newLens(id);
      T.booth = s.booth;
      T.zone = s.zone;
      const b = s.booth;
      const lkey = `${b.x}|${b.y}|${b.w}|${b.h}|${this.VW}`;
      if (lkey !== T.lkey) {
        T.lkey = lkey;
        this._placeLens(T);
      }
    }
    const ids = Object.keys(this.teams);
    const wu = this.wall.material.uniforms;
    wu.uSolo.value = ids.length === 1 ? 1 : 0;
    const any = Object.values(this.teams)[0];
    wu.uShelf.value = any ? any.booth.y + any.booth.h * 0.985 : this.VH * 0.6;
    this.dirty = true;
  }

  // ------------------------------------------------------------------ العدسة: عالمها الداخلي
  /** ينشئ «عدسة» كاملة: مشهدها الداخلي ونسيجها وجراثيمها، وقطعها في المشهد الرئيسي (تُوضع لاحقًا) */
  _newLens(id, { lamp = true, props = true } = {}) {
    const cfg = this.cfg;
    const ls = new THREE.Scene();
    ls.environment = this.envRT.texture;
    ls.environmentIntensity = 1.0;
    ls.background = new THREE.Color('#e9e2f4');
    const lcam = new THREE.PerspectiveCamera(30, 1, 20, 30000);
    const camDist = (R_IN * S_IN) / Math.tan(THREE.MathUtils.degToRad(15));
    lcam.position.set(0, S_IN * 0.18, camDist);
    lcam.lookAt(0, 0, 0);
    const rt = new THREE.WebGLRenderTarget(cfg.lensPx, cfg.lensPx, {
      type: this._post ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: this._post ? cfg.lensMsaa : 0,
    });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;

    // الإضاءة داخل العدسة: استوديو + ضوء بنفسجي يتبع المصباح
    const hemi = new THREE.HemisphereLight('#ffffff', '#bfb0dc', 0.75);
    const key = new THREE.DirectionalLight('#fff3e3', 2.0);
    key.position.set(260, 420, 520);
    key.castShadow = cfg.shadows;
    key.shadow.mapSize.set(1024, 1024);
    soften(key.shadow, cfg, 5, -0.0006);
    key.shadow.normalBias = 1.2;
    Object.assign(key.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 50, far: 2000 });
    const rim = new THREE.DirectionalLight('#cfd9ff', 0.8);
    rim.position.set(-400, 200, -300);
    const uvl = new THREE.PointLight('#a77bff', 0, 1400, 0);
    uvl.position.set(180, 260, 260);
    ls.add(hemi, key, key.target, rim, uvl);

    // خلفية الاستوديو
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), backdropMaterial());
    bd.position.set(0, 0, -900);
    bd.renderOrder = -10;
    ls.add(bd);

    // القاعدة الرخامية الدوّارة (تختفي في مشاهد الجولة ٢)
    const ped = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.12, 0.22, 72), pmat('#f4f0f8', { vertexColors: false, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    top.receiveShadow = true;
    top.userData.sample = false;
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.03, 12, 96), pmat('#d4a04a', { vertexColors: false, metalness: 1, roughness: 0.25 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1;
    band.userData.sample = false;
    ped.add(top, band);
    ped.position.set(0, -1.12, -0.2);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: cfg.shadows ? 0.35 : 0.85 }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.115;
    blob.scale.setScalar(0.8);
    ped.add(blob);

    const holder = new THREE.Group();
    holder.scale.setScalar(S_IN);
    holder.add(ped);
    ls.add(holder);

    const germs = new Germs({ count: cfg.germs, tier: this.tier });
    germs.uniforms.uSize.value = 11; // أكبر قليلًا داخل العدسة لتُرى على السبورة
    ls.add(germs.object);

    // جراثيم منتصف اللعبة في المشهد الرئيسي (على اليدين الكبيرتين)
    const mgerms = id === 'hero' ? null : new Germs({ count: Math.round(cfg.germs * 0.75), tier: this.tier });
    const mid = new THREE.Group();
    if (mgerms) this.scene.add(mgerms.object);
    this.scene.add(mid);

    const T = {
      id, ls, lcam, camDist, rt, hemi, key, uvl, bd, ped, pedBlob: blob, holder, germs, mgerms, mid,
      lamp, props, S: S_IN, halfW: R_IN, halfH: R_IN,
      uv: 0, uvTo: 0, dark: 0, darkTo: 0, model: null, modelId: null, spin: true, tw: [], shake0: 0,
      frame: null, key0: '', lensDirty: true, micro: null, dive: null, zoom: 0, flash: 0, timers: new Set(),
    };
    return T;
  }

  /** قطع العدسة في المشهد الرئيسي: إطار نحاسي، وزجاج، ومقبض بلون الفريق، والمصباح، وعُدد المختبر */
  _placeLens(T) {
    if (T.frame) {
      this.scene.remove(T.frame);
      this._free(T.frame);
    }
    const b = T.booth;
    const g = new THREE.Group();
    const teamColor = TEAM_COLOR[T.id] || '#6d28d9';
    // نصف القطر: أكبر ما تسمح به الحجرة مع مكان للمقبض والمصباح
    const R = T.fixedR || Math.max(60, Math.min(b.h * 0.47, b.w * 0.3));
    const cx = b.x + b.w / 2;
    const cy = T.fixedCY || b.y + R * 1.02;
    T.R = R;
    T.center = { x: cx, y: cy };
    const z0 = 30;

    // الحلقة النحاسية بحافة داخلية برونزية
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.075, 28, 128), this.mat.brass);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 0.955, R * 0.024, 14, 128), this.mat.bronze);
    bezel.position.z = 2;
    // الزجاج: العالم الداخلي
    T.lensMat = lensMaterial(T.rt.texture);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R * 0.955, 96), T.lensMat);
    glass.position.z = -1;
    const disc = new THREE.Group();
    disc.add(ring, bezel, glass);
    disc.position.copy(W(cx, cy, z0));
    g.add(disc);
    T.disc = disc;

    // المقبض: حلقة وصل نحاسية + مقبض مطليّ بلون الفريق + طرف نحاسي
    const hl = Math.max(30, b.y + b.h - (cy + R) + 6);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.085, R * 0.1, R * 0.16, 32), this.mat.brass);
    ferrule.position.copy(W(cx, cy + R * 1.07, z0));
    const grip = new THREE.Mesh(
      new THREE.CapsuleGeometry(R * 0.075, Math.max(10, hl - R * 0.2), 8, 24),
      new THREE.MeshPhysicalMaterial({ color: teamColor, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    );
    grip.position.copy(W(cx, cy + R * 1.1 + hl / 2, z0 - 4));
    g.add(ferrule, grip);

    // الرفّ تحت العدسة: حافة خشبية وظل ناعم
    const shelfY = b.y + b.h * 0.985;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(b.w * 1.04, 12, 140), this.mat.oak);
    shelf.position.copy(W(cx, shelfY + 6, -60));
    g.add(shelf);

    // المصباح البنفسجي بذراع مفصلية، في الجهة الخارجية (أو اليمنى للصف كله)
    const side = T.id === 'b' ? -1 : 1;
    const room = b.w / 2 - R * 1.1;
    T.lampMat = null;
    T.cone = null;
    if (T.lamp && room > R * 0.55) {
      const baseX = cx + side * (R * 1.1 + room * 0.55);
      const lampG = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.24, R * 0.07, 48), this.mat.lampBody);
      base.position.copy(W(baseX, shelfY - R * 0.035, -10));
      const j1 = W(baseX, shelfY - R * 0.07, -10);
      const j2 = W(baseX - side * R * 0.05, cy - R * 0.25, 10);
      const j3 = W(cx + side * R * 0.95, b.y + R * 0.08, 60);
      const arm = (p, q) => {
        const d = q.clone().sub(p);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.028, R * 0.028, d.length(), 16), this.mat.steel);
        m.position.copy(p.clone().add(q).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        return m;
      };
      const knuckle = (p) => {
        const k = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 20, 14), this.mat.lampBody);
        k.position.copy(p);
        return k;
      };
      lampG.add(base, arm(j1, j2), arm(j2, j3), knuckle(j2));
      // رأس المصباح يتجه نحو مركز العدسة
      const headG = new THREE.Group();
      headG.position.copy(j3);
      const aim = W(cx, cy, z0 + R * 0.4).sub(j3).normalize();
      headG.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.1, R * 0.24, R * 0.3, 40, 1, true), this.mat.lampBody);
      shade.material = this.mat.lampBody;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat.lampBody);
      cap.position.y = R * 0.15;
      const bulbMat = new THREE.MeshStandardMaterial({ color: '#f1ecfb', emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.3 });
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(R * 0.215, 40), bulbMat);
      bulb.rotation.x = Math.PI / 2;
      bulb.position.y = -R * 0.14;
      // مخروط قصير ينتهي قبل الزجاج: لا يغطي ما في العدسة
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.21, R * 0.42, R * 0.5, 40, 1, true), coneMaterial());
      cone.position.y = -R * 0.14 - R * 0.25;
      cone.renderOrder = 5;
      headG.add(shade, cap, bulb, cone);
      lampG.add(headG);
      g.add(lampG);
      T.lampMat = bulbMat;
      T.cone = cone;
    }

    // عُدد المختبر في الجهة الداخلية: حامل أنابيب اختبار وطبق بتري
    const pside = -side;
    const proom = T.id === 'all' ? room : b.w / 2 - R * 1.1;
    if (T.props && proom > R * 0.5) {
      const px = cx + pside * (R * 1.1 + proom * 0.5);
      const rackW = Math.min(proom * 0.8, R * 0.95);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(rackW, R * 0.06, R * 0.28), this.mat.oak);
      rack.position.copy(W(px, shelfY - R * 0.34, -20));
      const rackB = new THREE.Mesh(new THREE.BoxGeometry(rackW, R * 0.05, R * 0.28), this.mat.oak);
      rackB.position.copy(W(px, shelfY - R * 0.03, -20));
      g.add(rack, rackB);
      const liquids = ['#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899'];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const tx = px - rackW / 2 + (rackW / n) * (i + 0.5);
        const th = R * (0.55 + (i % 2) * 0.08);
        const tube = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.055, th, 6, 20), this.mat.tube);
        tube.position.copy(W(tx, shelfY - th / 2 - R * 0.07, -20));
        const lh = th * (0.35 + 0.12 * i);
        const liq = new THREE.Mesh(
          new THREE.CapsuleGeometry(R * 0.045, lh, 6, 16),
          new THREE.MeshPhysicalMaterial({ color: liquids[i], roughness: 0.15, clearcoat: 1, emissive: liquids[i], emissiveIntensity: 0.18 }),
        );
        liq.position.copy(W(tx, shelfY - R * 0.1 - lh / 2, -20));
        g.add(liq, tube);
      }
      // طبق بتري
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.26, R * 0.26, R * 0.05, 48, 1, true), this.mat.tube);
      dish.position.copy(W(px + pside * rackW * 0.05, shelfY - R * 0.025, 50));
      const agar = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.245, R * 0.245, R * 0.03, 48), this.mat.agar);
      agar.position.copy(W(px + pside * rackW * 0.05, shelfY - R * 0.02, 50));
      g.add(agar, dish);
    }

    // ظل ناعم على الرفّ تحت المقبض
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.6 }));
    sh.position.copy(W(cx, shelfY + 2, -40));
    sh.scale.set(R * 1.4, 26, 1);
    g.add(sh);

    this.scene.add(g);
    T.frame = g;
    // اليدان الكبيرتان (منتصف اللعبة) أمام كل شيء
    T.midZ = 160;
    T.lensDirty = true;
    this._applyUV(T);
  }

  _dropLens(T) {
    this._clearTimers(T);
    if (T.frame) {
      this.scene.remove(T.frame);
      this._free(T.frame);
    }
    if (T.mgerms) {
      this.scene.remove(T.mgerms.object);
      T.mgerms.dispose();
    }
    this.scene.remove(T.mid);
    this._free(T.mid);
    this._dropMicro(T);
    T.germs.dispose();
    this._free(T.ls);
    T.lensMat?.dispose();
    T.rt.dispose();
  }

  team(id) {
    return this.teams[id];
  }
  /** مركز عدسة الفريق بوحدة u (لطيران النموذج إليها) */
  lensCenter(id) {
    const T = this.teams[id];
    return T?.center ? { x: T.center.x, y: T.center.y, r: T.R } : null;
  }

  /**
   * لحظة القائمة: عدسة كبيرة تُظهر يدًا «نظيفة» تتأرجح تحت الضوء البنفسجي وعليها جراثيم مضيئة.
   * @param {{x:number,y:number,h:number}|null} r المركز والارتفاع بوحدة u، أو null للإخفاء
   */
  hero(r) {
    if (!r) {
      if (this._hero) {
        this._dropLens(this._hero);
        this._hero = null;
        this.dirty = true;
      }
      return;
    }
    const key = `${r.x}|${r.y}|${r.h}|${this.VW}`;
    if (this._hero && this._hero.key0 === key) return;
    this.hero(null);
    const H = this._newLens('hero', { lamp: false, props: false });
    H.key0 = key;
    // عدسة البطل بين صف الخطوات وأزرار القائمة، ومقبضها ينزل خلف الأزرار
    const R = r.h * 0.68;
    H.fixedR = R;
    H.fixedCY = r.y - r.h * 0.32;
    H.booth = { x: r.x - R * 1.2, y: H.fixedCY - R, w: R * 2.4, h: R * 2.7 };
    H.zone = { x0: r.x - R, x1: r.x + R, top: r.y - R, bottom: r.y + R };
    this._placeLens(H);
    // لا رفّ ولا ظل رفّ تحت عدسة البطل
    H.frame.children.forEach((c) => {
      if (c.material?.map === this.shadowTex) c.visible = false;
      if (c.geometry?.type === 'BoxGeometry') c.visible = false;
    });
    H.ped.visible = false;
    const hand = ITEM_MODELS.hand();
    const box = new THREE.Box3().setFromObject(hand, true);
    const sz = box.getSize(new THREE.Vector3());
    hand.position.sub(box.getCenter(new THREE.Vector3()));
    const spin = new THREE.Group();
    spin.add(hand);
    spin.scale.setScalar(2.9 / sz.y);
    H.holder.add(spin);
    H.model = spin;
    H.spin = false;
    H.uv = H.uvTo = 1;
    this._applyUV(H);
    H.germs.glow(1);
    this._hero = H;
    H.heroSpin = spin;
    // الجراثيم على سطح اليد (بإحداثيات مشهد العدسة)
    H.holder.updateMatrixWorld(true);
    const pts = sampleSurface(spin, Math.round(this.cfg.germs * 0.4), H.S);
    H.germs.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, 0] : [0, 0, 0, 0]), to: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, 1] : null), dur: 0.8 });
    this.dirty = true;
  }

  /**
   * صور البطاقات: كل مجسّم من الجولة ١ يُرسم مرة واحدة صورةً صغيرة (بالإضاءة والمواد نفسها)،
   * فتطابق البطاقةُ الشيءَ الذي يظهر في العدسة.
   */
  makeThumbs(size = 192) {
    // صور شفافة الخلفية (PNG بقناة ألفا) تُرسم في نسيج بضعف الدقة ثم تُصغَّر:
    // فيبرز المجسّم من البطاقة ثلاثية الأبعاد بظلّه الحقيقي، لا مربعًا أبيض.
    this.thumbs = {};
    const r = this.renderer;
    const big = size * 2;
    const rt = new THREE.WebGLRenderTarget(big, big, { type: THREE.UnsignedByteType });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    try {
      const sc = new THREE.Scene();
      sc.environment = this.scene.environment;
      sc.environmentIntensity = 0.85;
      sc.add(new THREE.HemisphereLight('#ffffff', '#c9bde0', 1.0));
      const k = new THREE.DirectionalLight('#fff4e6', 2.2);
      k.position.set(2, 3, 4);
      sc.add(k);
      const rim = new THREE.DirectionalLight('#d9e4ff', 1.0);
      rim.position.set(-3, 1, -2);
      sc.add(rim);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 0.35, 7);
      cam.lookAt(0, 0, 0);
      r.setClearColor(0x000000, 0);
      const px = new Uint8Array(big * big * 4);
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = big;
      const tctx = tmp.getContext('2d');
      const img = tctx.createImageData(big, big);
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      for (const key of Object.keys(ITEM_MODELS)) {
        const m = ITEM_MODELS[key](this.tier);
        m.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(m, true);
        const sz = box.getSize(new THREE.Vector3());
        const g = new THREE.Group();
        m.position.sub(box.getCenter(new THREE.Vector3()));
        g.add(m);
        g.scale.setScalar(3.0 / Math.max(sz.x, sz.y, 0.001));
        g.rotation.y = -0.5;
        sc.add(g);
        r.setRenderTarget(rt);
        r.clear();
        r.render(sc, cam);
        r.readRenderTargetPixels(rt, 0, 0, big, big, px);
        // الصفوف مقلوبة في النسيج: نعيدها
        for (let y = 0; y < big; y++) img.data.set(px.subarray((big - 1 - y) * big * 4, (big - y) * big * 4), y * big * 4);
        tctx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(tmp, 0, 0, size, size);
        this.thumbs[key] = out.toDataURL('image/png');
        sc.remove(g);
        this._free(g);
      }
    } catch (e) {
      console.warn('تعذّر رسم صور البطاقات، تبقى الرموز', e);
      this.thumbs = {};
    }
    r.setRenderTarget(null);
    rt.dispose();
    r.setClearColor('#efe9f6', 1);
  }


  // ------------------------------------------------------------------ أدوات صغيرة
  later(fn, ms, T = null) {
    const set = T ? T.timers : this._timers;
    const t = setTimeout(() => {
      set.delete(t);
      fn();
    }, this.reduced ? ms * 0.4 : ms);
    set.add(t);
  }
  _clearTimers(T = null) {
    if (T) {
      for (const t of T.timers) clearTimeout(t);
      T.timers.clear();
      return;
    }
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    for (const X of Object.values(this.teams)) this._clearTimers(X);
  }
  /** حركة ناعمة لخصائص مجسّم */
  tween(T, obj, { pos, scale, rot, dur = 400, ease = easeIO, arc = 0, onDone } = {}) {
    // حركة سابقة على المجسّم نفسه: ما لا تغيّره الحركة الجديدة يقفز إلى نهايته
    // (وإلا بقي مجسّم صغيرًا مخفيًّا على جهاز بطيء لم يكمل حركة الظهور)
    const prev = T.tw.filter((w) => w.obj === obj);
    T.tw = T.tw.filter((w) => w.obj !== obj); // تُزال أولًا: onDone قد يبدأ حركة جديدة
    for (const w of prev) {
      if (w.s1 && scale === undefined) obj.scale.copy(w.s1);
      if (w.p1 && !pos) obj.position.copy(w.p1);
      if (w.r1 && !rot) obj.rotation.set(w.r1.x, w.r1.y, w.r1.z);
      w.onDone?.();
    }
    T.tw = T.tw.filter((w) => w.obj !== obj);
    T.tw.push({
      obj, t0: performance.now(), dur: this.reduced ? 1 : dur, ease, arc, onDone,
      p0: obj.position.clone(), p1: pos ? pos.clone() : null,
      s0: obj.scale.clone(), s1: scale === undefined ? null : typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale.clone(),
      r0: obj.rotation.clone(), r1: rot || null,
    });
    this.dirty = true;
    T.lensDirty = true;
  }
  local(T, x, y, z = 0) {
    T.holder.updateMatrixWorld(true);
    return T.holder.localToWorld(new THREE.Vector3(x, y, z));
  }
  _addProp(T, obj, x, y, z = 0, s = 1) {
    obj.position.set(x, y, z);
    obj.userData.s = s;
    obj.scale.setScalar(0.001);
    T.holder.add(obj);
    T.propList = T.propList || [];
    T.propList.push(obj);
    obj.traverse((o) => {
      if (o.isMesh) o.castShadow = this.cfg.shadows;
    });
    setUV(obj, T.uv);
    this.tween(T, obj, { scale: s, dur: 320, ease: easeOutBack });
    return obj;
  }
  /** يحرّر هندسات مجسّم أُزيل وموادّه */
  _free(obj) {
    obj?.traverse?.((o) => {
      o.geometry?.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (!m.userData?.keep) m.dispose?.();
    });
  }
  _clearProps(T) {
    const props = new Set(T.propList || []);
    for (const p of props) {
      T.holder.remove(p);
      this._free(p);
    }
    T.propList = [];
    T.tw = T.tw.filter((w) => !props.has(w.obj));
    T.ped.visible = T.id !== 'hero';
    T.lensDirty = true;
  }
  _fit(T) {
    return Math.min(1, T.halfW / 2.35, T.halfH / 1.35);
  }
  _model(key) {
    const m = ITEM_MODELS[key](this.tier);
    m.traverse((o) => {
      if (o.isMesh) o.castShadow = this.cfg.shadows;
    });
    return m;
  }

  // ------------------------------------------------------------------ المعاينة (الجولة ١)
  preview(id, item) {
    const T = this.teams[id];
    if (!T) return;
    const key = item?.model || (item?.scene ? `s:${item.scene}` : null);
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
    if (T.multN) {
      T.multN = 0;
      T.germs.clear();
      if (!T.uvTo) T.germs.glow(0);
    }
    if (!key || (!ITEM_MODELS[key] && !key.startsWith('s:'))) return;
    T.ped.visible = true;
    // الجولة ٢: نموذج البطاقة نفسه (رأس، منديل، صابون…) يظهر في العدسة كما يظهر على البطاقة
    const m = key.startsWith('s:') ? buildCardModel(key, this.tier) : this._model(key);
    if (!m) return;
    m.traverse((o) => {
      if (o.isMesh) o.castShadow = this.cfg.shadows;
    });
    // تأطير موحّد: كل مجسّم يملأ العدسة بالقدر نفسه، ويقف فوق القاعدة
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    const size = box.getSize(new THREE.Vector3());
    const fit = 1.75 / Math.max(size.x * 0.9, size.y, 0.001);
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    m.position.sub(c);
    wrap.add(m);
    wrap.scale.setScalar(fit);
    const g = new THREE.Group();
    g.add(wrap);
    g.position.set(0, -0.08, 0);
    g.scale.setScalar(0.001);
    g.rotation.set(0, -0.6, 0);
    T.holder.add(g);
    setUV(g, T.uv);
    T.model = g;
    T.spin = true;
    this.tween(T, g, { scale: 1, dur: 460, ease: easeOutBack });
  }

  lampOn(id) {
    const T = this.teams[id];
    if (!T) return;
    T.uvTo = 1;
    T.germs.glow(1);
    T.mgerms?.glow(1);
    this.dirty = true;
  }
  lampOff(id) {
    const T = this.teams[id];
    if (!T) return;
    T.uvTo = 0;
    T.germs.glow(0);
    T.mgerms?.glow(0);
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
      T.tw = T.tw.filter((w) => w.obj !== T.model);
      T.model.scale.setScalar(1);
      T.model.rotation.set(0, target, 0);
      const n = Math.round(this.cfg.germs * 0.22);
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
      });
    }, 320, T);
  }

  // ------------------------------------------------------------------ الغوص المجهري (اللحظة المدهشة)
  /**
   * العدسة «تغوص» في سطح الشيء: تمويه تكبير شعاعي، ثم سطح مجهري حقيقي ثلاثي الأبعاد
   * (جبال ووديان للخشن، سهل لامع للناعم) وعليه جراثيم مضيئة.
   * @param {string} id
   * @param {{model:string, cat:string}} item
   */
  dive(id, item) {
    const T = this.teams[id];
    if (!T || T.micro) return;
    if (T.dive) T.dive = null;
    const rough = item.cat === 'rough';
    const kind = rough ? (['hand', 'sponge', 'wool', 'ball', 'log', 'rock'].includes(item.model) ? item.model : 'rough') : 'smooth';
    const color = this._modelColor(T.model) || (rough ? '#c9a27e' : '#dfe8f2');
    T.diveBuild = { kind, rough, color };
    // المحطة ١ (×١٠): العدسة تقترب من سطح الشيء نفسه، والجراثيم المضيئة عليه أوضح
    T.stage = 1;
    this._camTo(T, new THREE.Vector3(0, S_IN * 0.12, T.camDist * 0.42), new THREE.Vector3(0, 0, 0), 900);
    this.onSound(id, 'whoosh');
  }

  /**
   * محطات المجهر: 2 = ×١٠٠ (سطح الشيء المجهري وعليه الجراثيم)، 3 = ×١٠٠٠ (جرثومة عن قرب).
   * الانتقال إلى العالم المجهري بتمويه تكبير شعاعي، وبين المحطتين بسحب تركيز (تمويه ثم وضوح).
   */
  zoomTo(id, n) {
    const T = this.teams[id];
    if (!T || !T.diveBuild) return;
    if (n === 2 && !T.micro) {
      T.dive = { phase: 'in', t0: performance.now(), dur: this.reduced ? 120 : 600 };
      this.onSound(id, 'whoosh');
    } else if (n === 2 && T.micro) {
      this._stage2(T, 1100);
    } else if (n === 3 && T.micro) {
      const g = T.micro.focus;
      T.ls.fog.density = 0.0005;
      this._camTo(T, new THREE.Vector3(g.x + 70, g.y + 170, g.z + 235), new THREE.Vector3(g.x, g.y, g.z), 1500, true);
      this.onSound(id, 'whoosh');
    }
    T.stage = n;
  }
  _stage2(T, dur) {
    T.ls.fog.density = 0.00022;
    this._camTo(T, new THREE.Vector3(0, 1250, 1300), new THREE.Vector3(0, 0, -80), dur, true);
  }
  /** حركة كاميرا العدسة نحو موضع ونقطة نظر (مع سحب تركيز اختياري) */
  _camTo(T, pos, look, dur, focus = false) {
    const cur = T.camAnim;
    T.camAnim = {
      from: T.lcam.position.clone(), to: pos,
      lookFrom: cur ? cur.lookTo.clone() : new THREE.Vector3(0, 0, 0), lookTo: look,
      t0: performance.now(), dur: this.reduced ? 1 : dur, focus,
    };
    T.lensDirty = true;
  }

  /**
   * ما يُكتب تحت العدسة: درجة التكبير، وشريط مقياس محسوب من المشهد نفسه
   * (في العالم المجهري ١٤ وحدة = ١ ميكرومتر؛ العصيّة نحو ٢ ميكرومتر والكُرَيّة نحو ١).
   * @returns {null|{mag:string, label?:string, u?:number, cx:number, y:number}}
   */
  scaleInfo(id) {
    const T = this.teams[id];
    if (!T?.stage || !T.center) return null;
    const base = { cx: T.center.x, y: T.center.y + T.R * 0.62 };
    if (T.stage === 1) return { ...base, mag: '×١٠' };
    if (T.stage === 4) {
      if (!T.micro?.soap) return null;
      const d = T.lcam.position.length();
      const uPerWorld = (2 * T.R * 0.955) / (2 * d * Math.tan(THREE.MathUtils.degToRad(15)));
      return { ...base, mag: '×٢٠٠٠٠', label: '١ ميكرومتر', u: 100 * uPerWorld };
    }
    if (!T.micro) return { ...base, mag: '×١٠٠' };
    const look = T.camAnim ? T.camAnim.lookTo : new THREE.Vector3();
    const d = T.lcam.position.distanceTo(look);
    const uPerWorld = (2 * T.R * 0.955) / (2 * d * Math.tan(THREE.MathUtils.degToRad(15)));
    const um = T.stage === 3 ? 5 : 20;
    const label = T.stage === 3 ? '٥ ميكرومترات' : '٢٠ ميكرومترًا';
    return { ...base, mag: T.stage === 3 ? '×١٠٠٠' : '×١٠٠', label, u: um * 14 * uPerWorld };
  }

  /**
   * «الصابون يفكّك الجرثومة» (الجولة ٢، غسل اليدين): العدسة تغوص إلى جرثومة واحدة كبيرة، فتسبح نحوها
   * جزيئات الصابون (رأس يحب الماء وذيل يغرس في الغلاف)، فيتمزّق الغلاف وتتناثر قطعه، ويحملها الماء بعيدًا.
   */
  soap(id) {
    const T = this.teams[id];
    if (!T || T.micro) return;
    T.diveBuild = { soap: true };
    T.dive = { phase: 'in', t0: performance.now(), dur: this.reduced ? 120 : 600 };
    T.stage = 4;
    this.onSound(id, 'whoosh');
  }

  _buildSoap(T) {
    this._dropMicro(T, false);
    const A = this.tier === 'A';
    const g = new THREE.Group();
    // الجرثومة: عصيّة كبيرة (١ ميكرومتر = ١٠٠ وحدة هنا: طولها نحو ٢ ميكرومتر)
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(46, 120, 12, 32).rotateZ(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: '#5f8f16', emissive: '#b6ff2e', emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.6, sheenColor: '#efffbf', transparent: true, opacity: 0.92 }),
    );
    body.castShadow = this.cfg.shadows;
    g.add(body);
    // قطع الغلاف بعد التمزّق (مخفية حتى لحظتها)
    const shardGeo = new THREE.IcosahedronGeometry(1, 1);
    const shards = [];
    for (let i = 0; i < 26; i++) {
      const sh = new THREE.Mesh(shardGeo, body.material);
      const a = rnd(0, Math.PI * 2);
      const x = rnd(-95, 95);
      sh.position.set(x, Math.cos(a) * 40, Math.sin(a) * 40);
      sh.scale.set(rnd(14, 26), rnd(10, 20), rnd(12, 22));
      sh.visible = false;
      sh.userData.v = sh.position.clone().normalize().multiplyScalar(rnd(60, 140));
      sh.userData.spin = new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2));
      g.add(sh);
      shards.push(sh);
    }
    // جزيئات الصابون: رأس كروي أزرق وذيل أصفر رفيع
    const n = A ? 90 : 46;
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(8, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#38bdf8', emissive: '#7dd3fc', emissiveIntensity: 0.6, roughness: 0.25, clearcoat: 1 }), n);
    const tails = new THREE.InstancedMesh(new THREE.CapsuleGeometry(2.4, 26, 4, 8).translate(0, -19, 0), new THREE.MeshPhysicalMaterial({ color: '#facc15', emissive: '#fde68a', emissiveIntensity: 0.4, roughness: 0.4 }), n);
    heads.frustumCulled = tails.frustumCulled = false;
    g.add(heads, tails);
    const mols = [];
    for (let i = 0; i < n; i++) {
      // نقطة على سطح الكبسولة واتجاهها إلى الخارج
      const x = rnd(-60, 60) * (i % 5 === 0 ? 1.4 : 1);
      const a = rnd(0, Math.PI * 2);
      const nrm = new THREE.Vector3(Math.abs(x) > 60 ? Math.sign(x) * 0.6 : 0, Math.cos(a), Math.sin(a)).normalize();
      const p = new THREE.Vector3(x, 0, 0).addScaledVector(nrm, 46);
      const from = nrm.clone().multiplyScalar(rnd(380, 620)).add(new THREE.Vector3(rnd(-120, 120), rnd(-80, 80), 0));
      mols.push({ p, nrm, from, delay: rnd(0, 0.5), shard: i % shards.length, off: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(26, 40)) });
    }
    const sun = new THREE.DirectionalLight('#e2d6ff', 2.2);
    sun.position.set(-300, 420, 380);
    const spot = new THREE.PointLight('#9a6bff', 1.2, 2400, 0);
    spot.position.set(150, 300, 260);
    g.add(sun, spot);
    // فقاعات ماء في الخلفية
    for (let i = 0; i < (A ? 10 : 5); i++) {
      const b = bubble();
      b.scale.setScalar(rnd(30, 70));
      b.position.set(rnd(-320, 320), rnd(-200, 200), rnd(-300, -100));
      g.add(b);
    }
    T.ls.fog = new THREE.FogExp2('#1a0838', 0.0006);
    T.ls.add(g);
    T.micro = { g, soap: true, t: 0, body, shards, heads, tails, mols, burst: false };
    T.lcam.position.set(0, 150, 640);
    T.camAnim = { from: new THREE.Vector3(60, 180, 700), to: new THREE.Vector3(0, 130, 600), lookFrom: new THREE.Vector3(0, 0, 0), lookTo: new THREE.Vector3(0, 0, 0), t0: performance.now(), dur: 3800, focus: false };
  }

  /** حركة مشهد الصابون (٤ ث): اقتراب الجزيئات، غرس الذيول، تمزّق الغلاف، ثم يحمل الماء القطع */
  _soapUpdate(T, dt) {
    const M = T.micro;
    M.t += this.reduced ? dt * 2.5 : dt;
    const t = M.t;
    const o = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const wash = Math.max(0, t - 3.0); // بعد ٣ ث: الماء يحمل كل شيء إلى الأسفل
    // الغلاف يرتجف ثم يتمزّق
    if (!M.burst) {
      const w = t > 1.3 ? Math.min(1, (t - 1.3) / 0.7) : 0;
      M.body.scale.set(1 + Math.sin(t * 22) * 0.03 * w, 1 + Math.cos(t * 19) * 0.04 * w, 1 + Math.sin(t * 17) * 0.04 * w);
      if (t > 2.0) {
        M.burst = true;
        M.body.visible = false;
        for (const s of M.shards) s.visible = true;
        this.onSound(T.id, 'thud');
      }
    } else {
      for (const s of M.shards) {
        s.position.addScaledVector(s.userData.v, dt * 0.6);
        s.position.y -= wash * wash * 60 * dt;
        s.rotation.x += s.userData.spin.x * dt;
        s.rotation.y += s.userData.spin.y * dt;
        s.userData.v.multiplyScalar(1 - dt * 0.8);
      }
    }
    M.mols.forEach((m, i) => {
      const k = Math.min(1, Math.max(0, (t - m.delay) / 1.2));
      let pos;
      let dir = m.nrm;
      if (!M.burst) {
        // تسبح نحو الغلاف ثم تغرس ذيلها فيه
        const reach = m.p.clone().addScaledVector(m.nrm, 30 - Math.min(1, Math.max(0, (t - 1.2) / 0.6)) * 18);
        pos = m.from.clone().lerp(reach, easeIO(k));
      } else {
        // تلتف حول القطع (كالكُرَيّات الصغيرة التي يحملها الماء)
        const s = M.shards[m.shard];
        dir = m.off.clone().normalize();
        pos = s.position.clone().add(m.off);
      }
      o.position.copy(pos);
      o.quaternion.setFromUnitVectors(up, dir);
      const fade = wash > 0.6 ? Math.max(0, 1 - (wash - 0.6)) : 1;
      o.scale.setScalar(Math.max(0.001, fade));
      o.updateMatrix();
      M.heads.setMatrixAt(i, o.matrix);
      M.tails.setMatrixAt(i, o.matrix);
    });
    M.heads.instanceMatrix.needsUpdate = true;
    M.tails.instanceMatrix.needsUpdate = true;
  }

  /**
   * الجراثيم تتكاثر على الشيء المعروض حين تبقى البطاقة في اليد طويلًا: كل جرثومة تنقسم إلى اثنتين.
   * @param {number} n العدد الجديد (يتضاعف)
   */
  multiply(id, n) {
    const T = this.teams[id];
    if (!T?.model || T.dive || T.micro) return;
    const prev = T.multN || 0;
    const pts = sampleSurface(T.model, n, T.S);
    T.germs.glow(0.85);
    T.germs.event({
      count: pts.length,
      from: (i, r) => (i < prev ? r : pts[i - prev] ? [pts[i - prev].p.x, pts[i - prev].p.y, pts[i - prev].p.z, 0.6] : [0, 0, 0, 0]),
      to: (i, r) => (i < prev ? r : pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, 1] : null),
      dur: 0.6,
    });
    T.multN = n;
    T.lensDirty = true;
  }

  /** اللون الغالب لمواد المجسّم (لون السطح المجهري) */
  _modelColor(root) {
    if (!root) return null;
    let best = null;
    let area = 0;
    root.traverse((o) => {
      if (!o.isMesh || o.userData.sample === false) return;
      const b = o.material?.userData?.base;
      if (!b) return;
      o.geometry.computeBoundingSphere?.();
      const a = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius ** 2 : 1;
      if (a > area) {
        area = a;
        best = b.color;
      }
    });
    return best ? `#${best.getHexString()}` : null;
  }

  /** يبني العالم المجهري داخل العدسة */
  _buildMicro(T, { kind, rough, color }) {
    this._dropMicro(T, false);
    const cfg = this.cfg;
    const g = new THREE.Group();
    const size = 1800;
    const seg = rough ? cfg.seg : Math.round(cfg.seg * 0.4);
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    // تحت الضوء البنفسجي: لون الشيء معتم ومائل إلى البنفسجي، والوديان أغمق
    const base = new THREE.Color(color).multiplyScalar(0.5).lerp(new THREE.Color('#3a1a72'), 0.4);
    const deep = base.clone().multiplyScalar(0.28);
    const hs = new Float32Array(pos.count);
    let hmin = Infinity;
    let hmax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const h = microHeight(kind, pos.getX(i), pos.getZ(i));
      hs[i] = h;
      hmin = Math.min(hmin, h);
      hmax = Math.max(hmax, h);
      pos.setY(i, h);
    }
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      // الوديان أغمق (ظل محيطي مخبوز)
      const k = hmax > hmin ? (hs[i] - hmin) / (hmax - hmin) : 1;
      tmp.copy(deep).lerp(base, Math.pow(k, 0.8));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = rough
      ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, sheen: 1, sheenColor: '#7c4dff', sheenRoughness: 0.5, envMapIntensity: 0.3 })
      : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9, sheen: 0.3, sheenColor: '#7c4dff' });
    // تفاصيل السطح الحقيقية فوق التضاريس (مسام الجلد، ثقوب الإسفنج، ألياف الصوف…)
    const TEX = { hand: ['skin', 9, 0.9], sponge: ['sponge', 5, 1.2], wool: ['fabric', 7, 1.0], ball: ['pebble', 6, 1.0], log: ['bark', 3, 1.2], rock: ['rock', 3, 1.3], rough: ['rock', 3, 1.3], smooth: ['micro', 3, 0.12] };
    const [tn, tr, tk] = TEX[kind] || TEX.rough;
    mat.normalMap = nmap(tn, tr);
    mat.normalScale = new THREE.Vector2(tk, tk);
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = cfg.shadows;
    g.add(ground);

    // الجراثيم المجهرية: عصيّات (كبسولات) وكُرَيّات، مضيئة (HDR) فتتوهّج
    const n = Math.round(cfg.micro / 2); // لكل شكل (عصيّات وكُرَيّات)
    // عصيّة: كبسولة منحنية قليلًا بسطح محبّب، ولها سوط رفيع متموّج (كصور المجهر الإلكتروني)
    const rodGeo = new THREE.CapsuleGeometry(6, 20, 6, 14);
    {
      const p = rodGeo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const bend = Math.pow(v.y / 16, 2) * 2.2; // انحناء
        const bump = 1 + (fbm2(v.x * 0.6 + v.y * 0.3, v.z * 0.6 - v.y * 0.2, 2) - 0.5) * 0.12;
        p.setXYZ(i, v.x * bump + bend, v.y, v.z * bump);
      }
      rodGeo.computeVertexNormals();
    }
    const tail = (len, amp, ph) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 3 + ph) * amp * t, -16 - t * len, Math.cos(t * Math.PI * 3 + ph) * amp * 0.6 * t));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.9, 5, false);
    };
    const flag = mergeGeometries([tail(34, 5, 0), tail(26, 4, 2)]);
    const rodFull = mergeGeometries([rodGeo.toNonIndexed(), flag.toNonIndexed()]);
    rodFull.rotateZ(Math.PI / 2);
    // كُرَيّة: عنقود من خلايا كروية ملتصقة (كالمكوّرات العنقودية)
    const cl = [];
    for (const [x, y, z, r] of [[0, 0, 0, 7.5], [9, 3, 2, 7], [3, 8, -3, 6.5], [-6, 5, 4, 6.2], [5, -5, 6, 5.5]]) {
      const sg = new THREE.IcosahedronGeometry(r, 2);
      sg.translate(x, y, z);
      cl.push(sg);
    }
    const cocGeo = mergeGeometries(cl);
    // مواد فيزيائية: جسم شبه شفاف بلمعة غشاء، يتوهّج من الداخل تحت الضوء البنفسجي
    const rodMat = new THREE.MeshPhysicalMaterial({ color: '#6f9a18', emissive: '#c8ff3a', emissiveIntensity: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.45, sheenColor: '#f0ffc0', sheenRoughness: 0.35 });
    const cocMat = new THREE.MeshPhysicalMaterial({ color: '#17708a', emissive: '#5cf2ff', emissiveIntensity: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.45, sheenColor: '#d0fbff', sheenRoughness: 0.35 });
    const rods = new THREE.InstancedMesh(rodFull, rodMat, n);
    const cocs = new THREE.InstancedMesh(cocGeo, cocMat, n);
    rods.castShadow = cocs.castShadow = cfg.shadows;
    rods.frustumCulled = cocs.frustumCulled = false;
    g.add(rods, cocs);
    // ذرّات عائمة أمام العدسة وخلفها (عمق، كما في صور المجهر)
    {
      const nm = this.tier === 'A' ? 160 : 70;
      const mp = new Float32Array(nm * 3);
      for (let i = 0; i < nm; i++) mp.set([rnd(-600, 600), rnd(20, 520), rnd(-700, 500)], i * 3);
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: new THREE.Color(0.55, 0.45, 0.9), size: 7, sizeAttenuation: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      motes.frustumCulled = false;
      g.add(motes);
    }
    // المواضع: في الخشن نختار أخفض النقاط (الوديان والثقوب)، وفي الناعم مواضع عشوائية
    // ما تراه الكاميرا المجهرية تقريبًا: x في ±330، وz من −380 إلى 200
    const cand = [];
    const want = n * 2;
    for (let i = 0; i < want * (rough ? 4 : 1); i++) {
      // توزيع طبيعي (أكثف قرب المركز ويخفّ نحو الأطراف) على كل ما تراه محطة ×١٠٠
      const gx = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      const gz = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      const x = gx * 720;
      const z = -100 + gz * 560;
      cand.push({ x, z, h: microHeight(kind, x, z) });
    }
    if (rough) {
      // الوديان: نقارن كل نقطة بجيرانها القريبين، ونفضّل الأخفض
      for (const c of cand) {
        let s = 0;
        for (const [dx, dz] of [[24, 0], [-24, 0], [0, 24], [0, -24]]) s += microHeight(kind, c.x + dx, c.z + dz);
        c.score = c.h - s / 4 + (c.h - hmin) * 0.25;
      }
      cand.sort((a, b) => a.score - b.score);
    }
    const germs = [];
    for (let i = 0; i < want && i < cand.length; i++) {
      const c = cand[i];
      const isRod = i % 2 === 0;
      const lift = isRod ? 7 : 8;
      germs.push({
        rod: isRod, idx: Math.floor(i / 2), x: c.x, y: c.h + lift, z: c.z, y0: c.h + lift,
        ry: Math.random() * Math.PI * 2, rz: rnd(-0.25, 0.25), s: rnd(0.6, 1.0),
        ph: Math.random() * 6.28, state: 'rest', t: 0, vx: 0, vy: 0, vz: 0, spin: rnd(-6, 6), delay: 0,
      });
    }
    // رياح: خطوط ضوء رفيعة تعبر السطح (تظهر عند النفخ)
    const windGeo = new THREE.PlaneGeometry(120, 2.2);
    const windMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const wind = new THREE.InstancedMesh(windGeo, windMat, 46);
    wind.frustumCulled = false;
    const streaks = [];
    for (let i = 0; i < 46; i++) streaks.push({ x: rnd(-900, 900), y: rnd(10, 160), z: rnd(-500, 400), v: rnd(700, 1300) });
    g.add(wind);

    // ضباب بنفسجي للعمق، وضوء المصباح من فوق
    T.ls.fog = new THREE.FogExp2('#1a0838', 0.00045);
    const spot = new THREE.PointLight('#9a6bff', 1.1, 2400, 0);
    spot.position.set(-150, 520, 260);
    // ضوء مائل من المصباح يجسّم الجراثيم (لمعة الغشاء وظلّها على السطح) كصور المجهر الحقيقية
    const sun = new THREE.DirectionalLight('#d6c6ff', 2.4);
    sun.position.set(-420, 620, 380);
    sun.target.position.set(0, 0, -60);
    sun.castShadow = cfg.shadows;
    if (cfg.shadows) {
      sun.shadow.mapSize.set(1024, 1024);
      soften(sun.shadow, cfg, 3, -0.0008);
      Object.assign(sun.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 50, far: 2500 });
    }
    g.add(spot, sun, sun.target);
    T.ls.add(g);
    T.micro = { g, kind, rough, germs, rods, cocs, wind, streaks, windOn: 0, t: 0, ground, spot };
    this._microUpdate(T, 0, 0);
    // جرثومة قريبة من المركز لمحطة ×١٠٠٠
    let best = germs[0];
    for (const q of germs) if (Math.hypot(q.x, q.z + 60) < Math.hypot(best.x, best.z + 60)) best = q;
    T.micro.focus = { x: best.x, y: best.y0, z: best.z };
  }

  /** يزيل العالم المجهري؛ home = تعود الكاميرا أمام القاعدة وتنتهي محطات المجهر */
  _dropMicro(T, home = true) {
    if (T.micro) {
      T.ls.remove(T.micro.g);
      this._free(T.micro.g);
      T.ls.fog = null;
      T.micro = null;
    }
    if (!home) return;
    T.camAnim = null;
    T.stage = 0;
    T.diveBuild = null;
    T.focus = 0;
    T.lcam.position.set(0, S_IN * 0.18, T.camDist);
    T.lcam.lookAt(0, 0, 0);
    T.holder.visible = true;
    T.germs.object.visible = true;
    T.lensDirty = true;
  }


  /** حركة الجراثيم المجهرية (حياة دائمة، والنفخ) */
  _microUpdate(T, now, dt) {
    const M = T.micro;
    if (!M) return;
    M.t += dt;
    const o = new THREE.Object3D();
    const dir = T.id === 'b' ? -1 : 1;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const q of M.germs) {
      if (q.state === 'rest') {
        // تتلوّى في مكانها
        const w = this.reduced ? 0 : 1;
        o.position.set(q.x + Math.sin(M.t * 2 + q.ph) * 1.5 * w, q.y0 + Math.sin(M.t * 3 + q.ph * 2) * 1.2 * w, q.z);
        o.rotation.set(0, q.ry + Math.sin(M.t * 0.8 + q.ph) * 0.15 * w, q.rz);
      } else if (q.state === 'wobble') {
        // الريح تهزّها لكنها تبقى في الوادي
        const a = Math.max(0, 1 - q.t / 1.6);
        q.t += dt;
        o.position.set(q.x + Math.sin(q.t * 18 + q.ph) * 4 * a * dir, q.y0 + Math.abs(Math.sin(q.t * 14)) * 3 * a, q.z);
        o.rotation.set(0, q.ry, q.rz + Math.sin(q.t * 16) * 0.3 * a);
        if (q.t > 1.6) q.state = 'rest';
      } else if (q.state === 'fly') {
        q.t += dt;
        if (q.t < q.delay) {
          o.position.set(q.x, q.y0, q.z);
          o.rotation.set(0, q.ry, q.rz);
        } else {
          const tt = q.t - q.delay;
          // تنزلق أولًا على السطح ثم ترتفع مع الريح وتختفي بعيدًا
          q.vx += dir * (M.rough ? 900 : 1300) * dt;
          if (tt > (M.rough ? 0.05 : 0.35)) q.vy += (M.rough ? 520 : 380) * dt;
          q.x += q.vx * dt;
          q.z += q.vz * dt;
          const ground = microHeight(M.kind, q.x, q.z) + 7;
          q.y = Math.max(ground, q.y + q.vy * dt);
          q.ry += q.spin * dt * 0.6;
          q.rz += q.spin * dt;
          o.position.set(q.x, q.y, q.z);
          o.rotation.set(0, q.ry, q.rz);
          if (Math.abs(q.x) > 1400 || q.y > 900) q.state = 'gone';
        }
      }
      if (q.state === 'gone') {
        (q.rod ? M.rods : M.cocs).setMatrixAt(q.idx, hide);
        continue;
      }
      o.scale.setScalar(q.s);
      o.updateMatrix();
      (q.rod ? M.rods : M.cocs).setMatrixAt(q.idx, o.matrix);
    }
    M.rods.instanceMatrix.needsUpdate = true;
    M.cocs.instanceMatrix.needsUpdate = true;
    // الريح
    M.windOn = Math.max(0, M.windOn - dt * 0.55);
    M.wind.material.opacity = Math.min(1, M.windOn) * 0.55;
    if (M.windOn > 0) {
      for (let i = 0; i < M.streaks.length; i++) {
        const s = M.streaks[i];
        s.x += dir * s.v * dt;
        if (dir * s.x > 1000) s.x = -dir * 1000;
        o.position.set(s.x, s.y, s.z);
        o.rotation.set(-0.3, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        M.wind.setMatrixAt(i, o.matrix);
      }
      M.wind.instanceMatrix.needsUpdate = true;
    }
  }

  /** نفخ الهواء. في العالم المجهري: الخشن يمسك جراثيمه في الوديان، والناعم تنزلق عنه وتطير. */
  blow(id, grip) {
    const T = this.teams[id];
    if (!T) return;
    const dir = T.id === 'b' ? -1 : 1;
    if (T.micro) {
      const M = T.micro;
      M.windOn = 2.6;
      for (const q of M.germs) {
        if (Math.random() < grip) {
          q.state = 'wobble';
          q.t = Math.random() * 0.3;
        } else {
          q.state = 'fly';
          q.t = 0;
          q.delay = rnd(0, 0.7);
          q.vx = dir * rnd(40, 160);
          q.vy = rnd(0, 60);
          q.vz = rnd(-60, 60);
        }
      }
      // جراثيم النقاط (إن بقيت) تتبع الحكم نفسه
    }
    T.germs.event({
      to: (i, r) => {
        if (r[3] < 0.05) return [r[0], r[1], r[2], 0];
        if (Math.random() < grip) return [r[0] + dir * rnd(2, 6), r[1], r[2], 1];
        return [r[0] + dir * rnd(380, 900), r[1] + rnd(60, 380), r[2] + rnd(-80, 160), 0];
      },
      dur: 1.25,
      arc: [dir * 40, 90, 60],
    });
    T.lensDirty = true;
  }

  endTest(id) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.lampOff(id);
    if (T.micro) T.dive = { phase: 'back', t0: performance.now(), dur: this.reduced ? 120 : 500 };
    else {
      this._dropMicro(T); // توقّف عند ×١٠: الكاميرا تعود
      // انتهى العرض والغوص لم يكتمل (جهاز بطيء): يتلاشى التمويه بدل بناء عالم لم يعد مطلوبًا
      if (T.dive) T.dive = { phase: 'out', t0: performance.now(), dur: this.reduced ? 100 : 300 };
    }
    this.preview(id, null);
    this._clearProps(T);
    this.later(() => T.germs.clear(), 450, T);
  }

  /**
   * يقطع عرض العدسة الجاري فورًا (وضعوا بطاقة صحيحة جديدة قبل انتهائه): بلا انتظار ولا مؤقتات
   * متأخرة قد تمحو العرض الجديد. المصباح يبقى كما هو.
   */
  abortTest(id) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this._dropMicro(T);
    T.dive = null;
    T.zoom = 0;
    this.preview(id, null);
    this._clearProps(T);
    T.germs.clear();
    T.lensDirty = true;
  }

  /** اهتزاز الطبقة المرئية فقط (الأهداف لا تتحرك) */
  shake(id) {
    const T = this.teams[id];
    if (!T || this.reduced) return;
    T.shake0 = performance.now();
  }

  // ------------------------------------------------------------------ مشاهد الجولة ٢ (داخل العدسة)
  vignette(id, item) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.preview(id, null);
    this._clearProps(T);
    T.ped.visible = false;
    T.germs.clear();
    const k = this._fit(T);
    const G = T.germs;
    const nA = Math.round(this.cfg.germs * 0.22);
    const snd = (n) => this.onSound(id, n);
    const surf = (obj, n) => {
      const w = T.tw.find((x) => x.obj === obj && x.s1);
      if (w) obj.scale.copy(w.s1);
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
      const h = this._addProp(T, head(), -1.45 * k, 0.15 * k, 0, 0.95 * k);
      const tb = this._addProp(T, table(), 0.75 * k, -0.95 * k, -0.3, 0.62 * k);
      let shield = null;
      if (sc === 'tissue') this.later(() => (shield = this._addProp(T, tissueSheet(), -0.72 * k, 0.0, 0.25, 0.85 * k)), 350, T);
      if (sc === 'elbow') this.later(() => (shield = this._addProp(T, elbowArm(), -0.75 * k, -0.05 * k, 0.3, 0.9 * k)), 350, T);
      this.later(() => snd('achoo'), 300, T);
      this.later(() => {
        this.tween(T, h, { rot: new THREE.Euler(0, 0, -0.28), dur: 150, onDone: () => this.tween(T, h, { rot: new THREE.Euler(0, 0, 0), dur: 450 }) });
        const m = mouthW(h);
        // آلاف القطرات من الفم: إلى الطاولة وما بعدها، أو تعلق بالمنديل/المرفق
        {
          T.holder.updateMatrixWorld(true);
          const o = T.holder.worldToLocal(m.clone());
          let floor = -10;
          if (tb.userData.top) {
            const bb = new THREE.Box3().setFromObject(tb.userData.top);
            floor = T.holder.worldToLocal(new THREE.Vector3(0, bb.max.y, 0)).y + 0.01;
          }
          const stopX = shield ? shield.position.x - 0.04 : 1e6;
          const d = droplets(this.tier === 'A' ? 2400 : 900, o, { floor, stopX });
          d.material.uniforms.uS.value = T.S;
          T.holder.add(d);
          T.propList.push(d);
          T.drops = { obj: d, t0: performance.now() };
        }
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
          });
        } else {
          const stop = shield ? surf(shield, nA) : [];
          // الجراثيم المحتجزة على المنديل/المرفق أخفت: لا تتجمّع بقعةً بيضاء تبهر العين
          G.event({ count: Math.round(nA * 0.22), from: () => at3(m, 1, 4), to: toPts(stop, 0.5), dur: 0.45, arc: [0, 10, 10] });
          this.later(() => snd('thud'), 250);
        }
      }, 820, T);
      if (sc === 'tissue') {
        this.later(() => {
          if (!shield) return;
          const tb2 = this._addProp(T, tissueBall(), shield.position.x, shield.position.y, 0.3, 0.001);
          this.tween(T, shield, { scale: 0.001, dur: 300 });
          this.tween(T, tb2, { scale: 0.9 * k, dur: 300, ease: easeOutBack });
          const c = this.local(T, shield.position.x, shield.position.y, 0.3);
          G.event({ to: (i, r) => (r[3] > 0.05 ? at3(c, 1, 0.22 * T.S * k) : null), dur: 0.35 });
        }, 1700, T);
      }
      return;
    }

    if (sc === 'shake' || sc === 'food') {
      const A = this._addProp(T, ITEM_MODELS.hand(), -1.35 * k, 0.05 * k, 0, 0.85 * k);
      A.rotation.set(0, 0, sc === 'shake' ? -1.3 : -0.9);
      const B = sc === 'shake' ? ITEM_MODELS.hand(true) : sandwich();
      if (sc === 'shake') B.rotation.set(0, 0, 1.3);
      this._addProp(T, B, 1.35 * k, sc === 'shake' ? 0.05 * k : -0.25 * k, 0, (sc === 'shake' ? 0.85 : 1.0) * k);
      this.later(() => {
        const pts = surf(A, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z + 40, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.5 });
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
        const dx = 0.68 * k * T.S;
        G.event({ to: (i, r) => (r[3] > 0.05 ? [r[0] + (i % 2 === 0 ? (sc === 'shake' ? dx : 0) : -dx), r[1], r[2], 1] : null), dur: 0.45 });
      }, 2300, T);
      return;
    }

    if (sc === 'leave' || sc === 'clean') {
      const tb = this._addProp(T, table(), 0, -0.55 * k, 0, 0.9 * k);
      const ball = sc === 'leave' ? this._addProp(T, tissueBall(), -0.15 * k, -0.25 * k, 0.25, 0.9 * k) : null;
      this.later(() => {
        const pts = sc === 'leave' ? surf(ball, Math.round(nA * 0.6)) : surf(tb.userData.top, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 50, pts[i].p.z, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: sc === 'leave' ? 0.5 : 0.6 });
      }, 300, T);
      if (sc === 'leave') {
        this.later(() => {
          const top = surf(tb.userData.top, nA);
          G.event({ count: nA, to: (i, r) => (top[i] ? [top[i].p.x, top[i].p.y, top[i].p.z, 1] : r[3] > 0 ? r : null), dur: 1.2, arc: [0, 30, 0] });
        }, 1100, T);
      } else {
        const bt = this._addProp(T, bottle(), -1.55 * k, -0.05 * k, 0.2, 0.75 * k);
        bt.rotation.z = -0.3;
        const wipe = this._addProp(T, ITEM_MODELS.sponge(), -1.25 * k, -0.3 * k, 0.45, 0.32 * k);
        this.later(() => {
          snd('swish');
          this.tween(T, wipe, { pos: new THREE.Vector3(1.3 * k, -0.3 * k, 0.45), dur: 1100 });
        }, 900, T);
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
      const h = this._addProp(T, ITEM_MODELS.hand(), 0, 0.1 * k, 0, 0.95 * k);
      h.rotation.set(0.2, 0, 0);
      this.later(() => {
        const pts = surf(h, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z + 40, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.5 });
      }, 250, T);
      this.later(() => {
        snd('bubbles');
        for (let i = 0; i < 12; i++) {
          const bb = this._addProp(T, bubble(), rnd(-1.0, 1.0) * k, rnd(-0.8, 0.6) * k, rnd(0.2, 0.6), rnd(0.7, 1.6) * k);
          this.later(() => this.tween(T, bb, { pos: new THREE.Vector3(bb.position.x + rnd(-0.2, 0.2), bb.position.y + 1.6 * k, bb.position.z), scale: 0.001, dur: 1300 }), 300 + i * 60);
        }
      }, 800, T);
      this.later(() => {
        G.event({ to: (i, r) => (r[3] > 0.05 ? [r[0] + rnd(-60, 60), r[1] - rnd(420, 900), r[2], 0] : null), dur: 1.2, arc: [0, 20, 0] });
      }, 1150, T);
      return;
    }


    if (sc === 'bin') {
      const bn = this._addProp(T, bin(), 1.1 * k, -0.55 * k, 0, 0.95 * k);
      const tb = this._addProp(T, tissueBall(), -1.4 * k, 0.45 * k, 0.2, 0.9 * k);
      this.later(() => {
        const pts = surf(tb, nA);
        G.event({ count: pts.length, from: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y + 40, pts[i].p.z, 0] : [0, 0, 0, 0]), to: toPts(pts), dur: 0.45 });
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
        this.tween(T, bn.userData.lid, { rot: new THREE.Euler(0, 0, 0), dur: 200 });
      }, 1550, T);
      bn.userData.lid.rotation.z = 0.9;
      bn.userData.lid.position.x = 0.22;
    }
  }

  // ------------------------------------------------------------------ منتصف اللعبة: «أطفئوا الأنوار!»
  /** يُظلم نصف الفريق فعلًا، وتظهر يدان كبيرتان «نظيفتان» تتوهّج عليهما الجراثيم */
  midHands(id, on) {
    const T = this.teams[id];
    if (!T) return;
    this._clearTimers(T);
    this.preview(id, null);
    this._clearProps(T);
    this._free(T.mid);
    T.mid.clear();
    const MG = T.mgerms;
    if (!on) {
      T.darkTo = 0;
      this.lampOff(id);
      this.later(() => MG.clear(), 400, T);
      return;
    }
    MG.clear();
    T.darkTo = 1;
    const z = T.zone;
    const s = Math.min((z.x1 - z.x0) * 0.2, (z.bottom - z.top) * 0.28);
    const cx = (z.x0 + z.x1) / 2;
    const cy = z.top + (z.bottom - z.top) * 0.47;
    const L = ITEM_MODELS.hand();
    const R = ITEM_MODELS.hand(true);
    L.position.set(-1.0, 0, 0);
    R.position.set(1.0, 0, 0);
    L.rotation.z = 0.12;
    R.rotation.z = -0.12;
    T.mid.add(L, R);
    T.mid.position.copy(W(cx, cy, T.midZ));
    T.mid.scale.setScalar(0.001);
    setUV(T.mid, 1);
    this.tween(T, T.mid, { scale: s, dur: 600, ease: easeOutBack });
    this.lampOn(id);
    this.later(() => {
      T.tw = T.tw.filter((w) => w.obj !== T.mid);
      T.mid.scale.setScalar(s);
      T.mid.updateMatrixWorld(true);
      const pts = sampleSurface(T.mid, MG.n, s);
      MG.event({
        count: pts.length,
        from: (i) => (pts[i] ? [pts[i].p.x + rnd(-300, 300), pts[i].p.y + rnd(-200, 300), pts[i].p.z + 200, 0] : [0, 0, 0, 0]),
        to: (i) => (pts[i] ? [pts[i].p.x, pts[i].p.y, pts[i].p.z, 1] : null),
        dur: 1.4,
      });
    }, 900, T);
  }

  // ------------------------------------------------------------------ الافتتاح
  /** الافتتاح: الكاميرا تنزل وتقترب حتى تستقر على المحاذاة، والعدسات تضيء فتسبح فيها جراثيم ثم تختفي */
  intro() {
    if (!this.reduced) this._cam = { t0: performance.now(), dur: 2100 };
    for (const T of Object.values(this.teams)) {
      this.lampOn(T.id);
      T.flash = 0.6;
      T.ped.visible = true;
      const n = Math.round(this.cfg.germs * 0.5);
      const RR = R_IN * S_IN;
      T.germs.event({
        count: n,
        from: () => [rnd(-RR * 1.6, RR * 1.6), rnd(-RR * 1.6, RR * 1.6), rnd(-200, 300), 0],
        to: () => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * RR * 0.75;
          return [Math.cos(a) * r, Math.sin(a) * r * 0.8, rnd(-80, 120), 1];
        },
        dur: 1.3,
        arc: [0, 60, 120],
      });
      this.later(() => this.lampOff(T.id), 1700, T);
      this.later(() => T.germs.clear(), 2300, T);
    }
  }
  startMeasure(skip = 700) {
    this._measure = { d: [], t0: performance.now(), skip };
  }
  stopMeasure() {
    const m = this._measure;
    this._measure = null;
    if (!m || m.d.length < 6) return 0;
    const d = [...m.d].sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)];
  }

  reset() {
    this._clearTimers();
    this._cam = null;
    for (const T of Object.values(this.teams)) {
      this._clearProps(T);
      this._free(T.mid);
      T.mid.clear();
      this._dropMicro(T);
      T.dive = null;
      T.zoom = 0;
      if (T.model) {
        T.holder.remove(T.model);
        this._free(T.model);
      }
      T.model = null;
      T.modelId = null;
      T.tw = [];
      T.uvTo = 0;
      T.darkTo = 0;
      T.germs.glow(0);
      T.germs.clear();
      T.mgerms?.glow(0);
      T.mgerms?.clear();
      T.lensDirty = true;
    }
    this._alignCam(0);
    this.dirty = true;
  }

  /** يجمّع كل المظلِّلات مسبقًا (أثناء الافتتاح) فلا يتقطّع أول ظهور لمجسّم أو للعالم المجهري */
  async warmUp() {
    const T = Object.values(this.teams)[0];
    if (!T) return;
    const g = new THREE.Group();
    const all = [...Object.keys(ITEM_MODELS).map((k) => this._model(k)), head(), tissueSheet(), tissueBall(), elbowArm(), table(), sandwich(), bin(), bottle(), bubble()];
    all.forEach((m, i) => {
      m.position.set((i % 6) * 3, Math.floor(i / 6) * 3, 0);
      g.add(m);
    });
    g.scale.setScalar(0.2);
    T.holder.add(g);
    try {
      this._buildMicro(T, { kind: 'rock', rough: true, color: '#999999' });
      if (this.renderer.compileAsync) await this.renderer.compileAsync(T.ls, T.lcam);
      else this.renderer.compile(T.ls, T.lcam);
      this._buildMicro(T, { kind: 'smooth', rough: false, color: '#999999' });
      this.renderer.compile(T.ls, T.lcam);
      this._buildSoap(T);
      this.renderer.compile(T.ls, T.lcam);
    } catch {
      /* التجميع المسبق تحسين فقط */
    }
    this._dropMicro(T);
    T.holder.remove(g);
    this._free(g);
    T.lensDirty = true;
  }

  // ------------------------------------------------------------------ الحلقة
  _loop(now) {
    const raw = now - this._raw;
    this._raw = now;
    if (this._measure && raw < 1000 && now - this._measure.t0 > this._measure.skip) this._measure.d.push(raw);
    if (now - this._last < FPS_MS) return;
    const dt = Math.min(0.1, (now - this._lastT) / 1000);
    let moving = this.dirty;
    if (this._cam) {
      const k = Math.min(1, (now - this._cam.t0) / this._cam.dur);
      this._alignCam(1 - easeIO(k));
      if (k >= 1) this._cam = null;
      moving = true;
    }
    const wu = this.wall.material.uniforms;
    const lenses = Object.values(this.teams);
    if (this._hero) lenses.push(this._hero);
    for (const T of lenses) {
      let live = T.lensDirty;
      const sp = this.reduced ? 30 : 6;
      if (Math.abs(T.uv - T.uvTo) > 0.002) {
        T.uv += (T.uvTo - T.uv) * Math.min(1, dt * sp);
        if (Math.abs(T.uv - T.uvTo) <= 0.002) T.uv = T.uvTo;
        this._applyUV(T);
        live = true;
      }
      if (Math.abs(T.dark - T.darkTo) > 0.002) {
        T.dark += (T.darkTo - T.dark) * Math.min(1, dt * (this.reduced ? 30 : 3.5));
        if (Math.abs(T.dark - T.darkTo) <= 0.002) T.dark = T.darkTo;
        moving = true;
      }
      if (T.tw.length) {
        live = true;
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
        live = true;
      }
      if (T.heroSpin) {
        const a = this.reduced ? 0 : Math.sin(now / 1600) * 0.35;
        T.heroSpin.rotation.y = a;
        T.germs.object.rotation.y = a;
        live = true;
      }
      // الغوص: تمويه شعاعي ثم تبديل العالم
      if (T.dive) {
        const D = T.dive;
        const k = Math.min(1, (now - D.t0) / D.dur);
        live = true;
        if (D.phase === 'in') {
          T.zoom = easeIO(k);
          if (k >= 1 && T.diveBuild?.soap) {
            T.camAnim = null;
            this._buildSoap(T);
            T.holder.visible = false;
            T.germs.object.visible = false;
            T.flash = 0.3;
            T.dive = { phase: 'out', t0: now, dur: this.reduced ? 100 : 520 };
          } else if (k >= 1 && !T.diveBuild) {
            // أُلغي الغوص أثناءه: لا عالم يُبنى، يتلاشى التمويه فقط
            T.dive = { phase: 'out', t0: now, dur: this.reduced ? 100 : 300 };
          } else if (k >= 1) {
            T.camAnim = null;
            this._buildMicro(T, T.diveBuild);
            T.lcam.position.set(0, 1150, 1200);
            T.camAnim = { from: new THREE.Vector3(0, 1150, 1200), to: new THREE.Vector3(0, 1250, 1300), lookFrom: new THREE.Vector3(0, 0, -80), lookTo: new THREE.Vector3(0, 0, -80), t0: now, dur: 2500, focus: false };
            T.ls.fog.density = 0.00022;
            T.holder.visible = false;
            T.germs.object.visible = false;
            T.flash = 0.35;
            T.dive = { phase: 'out', t0: now, dur: this.reduced ? 100 : 520 };
          }
        } else if (D.phase === 'out') {
          T.zoom = 1 - easeIO(k);
          if (k >= 1) {
            T.zoom = 0;
            T.dive = null;
          }
        } else if (D.phase === 'back') {
          T.zoom = Math.sin(k * Math.PI);
          if (k >= 0.5 && T.micro) this._dropMicro(T);
          if (k >= 1) {
            T.zoom = 0;
            T.dive = null;
          }
        }
      }
      if (T.micro) {
        live = true;
        if (T.micro.soap) this._soapUpdate(T, dt);
        else this._microUpdate(T, now, dt);
      }
      // حركة كاميرا العدسة بين محطات المجهر، وسحب التركيز أثناءها
      if (T.camAnim) {
        const C = T.camAnim;
        const k = Math.min(1, (now - C.t0) / C.dur);
        const e = easeIO(k);
        T.lcam.position.lerpVectors(C.from, C.to, e);
        T.lcam.lookAt(new THREE.Vector3().lerpVectors(C.lookFrom, C.lookTo, e));
        T.focus = C.focus && !this.reduced ? Math.sin(k * Math.PI) * 0.9 : 0;
        live = true;
        if (k >= 1) {
          T.focus = 0;
          C.done = true;
        }
      } else T.focus = 0;
      if (T.drops) {
        const D = T.drops;
        if (!D.obj.parent) T.drops = null;
        else {
          const u = D.obj.material.uniforms;
          u.uT.value = this.reduced ? 3 : (now - D.t0) / 1000;
          u.uPx.value = T.rt.height / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
          live = true;
        }
      }
      if (T.flash > 0.001) {
        T.flash *= Math.pow(0.02, dt);
        live = true;
      } else T.flash = 0;
      if (T.shake0) {
        const e = (now - T.shake0) / 400;
        if (e >= 1) {
          T.shake0 = 0;
          T.frame.position.set(0, 0, 0);
        } else {
          T.frame.position.set(Math.sin(e * 40) * 10 * (1 - e), 0, 0);
        }
        moving = true;
      }
      if (T.germs.frame(now, dt, this.reduced, T.rt.height / (2 * Math.tan(THREE.MathUtils.degToRad(15))))) live = true;
      if (T.mgerms && T.mgerms.frame(now, dt, this.reduced, this._pxScale || 1000)) moving = true;
      if (T.lensMat) {
        const u = T.lensMat.uniforms;
        u.uZoom.value = T.zoom;
        u.uFocus.value = T.focus || 0;
        u.uFlash.value = T.flash;
        u.uUV.value = T.uv;
      }
      T.bd.material.uniforms.uTime.value = now / 1000;
      T.live = live;
      if (live) moving = true;
      if (T.id === 'b') wu.uDarkL.value = T.dark;
      else if (T.id !== 'hero') wu.uDarkR.value = T.dark;
    }
    this.dust.material.uniforms.uTime.value = this.reduced ? 0 : now / 1000;
    const anyDark = Object.values(this.teams).some((T) => T.dark > 0.01);
    this.dust.material.uniforms.uA.value = anyDark ? 0.4 : 1;
    if (!moving && now - this._last < IDLE_MS) return;
    if (!moving && this.reduced) return;
    this._last = now;
    this._lastT = now;
    if (this._failed) return;
    this.dirty = false;
    try {
      const r = this.renderer;
      // العوالم الداخلية للعدسات أولًا (فقط ما تغيّر)
      for (const T of lenses) {
        if (!T.live) continue;
        T.lensDirty = false;
        r.setRenderTarget(T.rt);
        r.render(T.ls, T.lcam);
      }
      r.setRenderTarget(null);
      if (this.composer) this.composer.render(dt);
      else r.render(this.scene, this.camera);
    } catch (e) {
      this._fail(e.message);
    }
  }

  /** الوضع البنفسجي لعدسة الفريق: الداخل يظلم، المصباح يتوهّج، المخروط والضوء البنفسجي، والمجسّمات */
  _applyUV(T) {
    const k = T.uv;
    T.bd.material.uniforms.uUV.value = k;
    T.ls.background.set('#e9e2f4').lerp(new THREE.Color('#0c0420'), k);
    T.hemi.intensity = lerp(0.75, 0.08, k);
    T.key.intensity = lerp(2.0, 0.25, k);
    T.uvl.intensity = 1.3 * k;
    T.ls.environmentIntensity = lerp(1.0, 0.25, k);
    if (T.lampMat) {
      T.lampMat.emissive.set('#ffffff').lerp(VIOLET, k);
      T.lampMat.emissiveIntensity = lerp(0.25, 2.1, k); // متوهّج قليلًا: توهّج أقوى ينتشر هالةً فوق العدسة المجاورة
    }
    if (T.cone) T.cone.material.uniforms.uUV.value = k;
    setUV(T.ped, k);
    if (T.model) setUV(T.model, k);
    for (const p of T.propList || []) setUV(p, k);
    T.lensDirty = true;
  }
}
