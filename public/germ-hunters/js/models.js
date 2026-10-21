// ---------------------------------------------------------------------------
// مجسّمات «صيّادو الجراثيم» إجرائية بالكامل (بلا ملفات GLB ولا أنسجة): أشكال three.js
// بسيطة بمواد TSL على طريقة «واضح على جهاز العرض» (الملف 09، ٤.١):
//   • تظليل كرتوني (MeshToonNodeMaterial) بثلاث درجات مشبعة.
//   • حدود داكنة سميكة بطريقة «الهيكل المقلوب» (نسخة بـ BackSide)، تتوهّج بنفسجيًا تحت الضوء.
//   • ضوء حافة (fresnel) يفصل المجسّم عن الخلفية.
//   • الخشونة حقيقية: إزاحة الرؤوس بضجيج (fractal/worley) مع تظليل التجاويف،
//     والنعومة لمعة حادّة بيضاء — فيرى الطلاب الفرق بين الخشن والناعم بأعينهم.
//   • الوضع البنفسجي (uUV من 0 إلى 1): يُعتم المجسّم ويتلوّن بنفسجيًا كأنه في غرفة مظلمة.
// كل مجسّم بمقياس الوحدة (يتسع في كرة نصف قطرها ≈ ١)، ويكبّره المشهد حسب الحجرة.
// يعمل الكود نفسه على WebGPU (الطبقة A) وعلى WebGL2 (الطبقة B): TSL يُترجَم تلقائيًا.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  abs, color, dot, float, mix, mx_fractal_noise_float, mx_worley_noise_float, normalLocal, normalView,
  oneMinus, positionLocal, positionViewDirection, saturate, sin, smoothstep, uniform, vec3, normalize, length, uv,
} from 'three/tsl';

/** تدرّج الظل الكرتوني: ثلاث درجات واضحة (تبقى مقروءة على جهاز العرض) */
let GRADIENT = null;
function gradient() {
  if (GRADIENT) return GRADIENT;
  GRADIENT = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  GRADIENT.minFilter = GRADIENT.magFilter = THREE.NearestFilter;
  GRADIENT.generateMipmaps = false;
  GRADIENT.needsUpdate = true;
  return GRADIENT;
}

const INK = color(0x2b1d3a); // لون الحدود
const UV_EDGE = color(0xc39bff); // الحدود تحت الضوء البنفسجي
const UV_TINT = vec3(0.14, 0.05, 0.3);

/**
 * ضجيج السطح (إن كان خشنًا): يُعيد { n, disp } حيث n بين 0 و1 تقريبًا، وdisp إزاحة على طول العمود.
 * @param {{rough?:number, freq?:number|number[], worley?:boolean}} o
 */
function surfaceNoise(o) {
  if (!o.rough) return null;
  const f = Array.isArray(o.freq) ? vec3(...o.freq) : float(o.freq || 8);
  const p = positionLocal.mul(f);
  if (o.worley) {
    // ثقوب: الإزاحة سالبة قرب مراكز الخلايا (كالإسفنجة)
    const w = mx_worley_noise_float(p);
    const n = smoothstep(0.05, 0.5, w);
    return { n, disp: n.sub(1).mul(o.rough) };
  }
  const n = mx_fractal_noise_float(p, 3, 2.0, 0.5).mul(0.5).add(0.5);
  return { n, disp: n.sub(0.5).mul(o.rough * 2) };
}

/**
 * مادة سطح كرتونية مع إزاحة الخشونة واللمعة والوضع البنفسجي.
 * @param {number} hex
 * @param {{rough?:number, freq?:number|number[], worley?:boolean, gloss?:boolean, uUV:any, colorNode?:any, opacity?:number}} o
 */
export function surfaceMat(hex, o) {
  const m = new THREE.MeshToonNodeMaterial({ gradientMap: gradient() });
  const sn = surfaceNoise(o);
  let base = o.colorNode || color(hex);
  if (sn) {
    m.positionNode = positionLocal.add(normalLocal.mul(sn.disp));
    // تجاويف أغمق ونتوءات أفتح: الخشونة تُرى حتى من بعيد
    base = base.mul(mix(float(0.62), float(1.18), sn.n));
  }
  m.colorNode = mix(base, base.mul(0.16).add(UV_TINT), o.uUV);
  const facing = abs(dot(normalView, positionViewDirection));
  const fres = oneMinus(facing).pow(2.2);
  let em = mix(vec3(1, 0.97, 0.9).mul(fres.mul(0.22)), vec3(0.62, 0.38, 1.0).mul(fres.mul(1.15)), o.uUV);
  if (o.gloss) {
    // لمعة حادة (سطح أملس): بقعة بيضاء صغيرة ثابتة باتجاه الضوء
    const spec = smoothstep(0.93, 0.975, dot(normalView, normalize(vec3(-0.35, 0.55, 0.76))));
    em = em.add(vec3(1, 1, 1).mul(spec.mul(oneMinus(o.uUV.mul(0.6)))));
  }
  m.emissiveNode = em;
  if (o.opacity !== undefined && o.opacity < 1) {
    m.transparent = true;
    m.opacity = o.opacity;
    m.depthWrite = false;
  }
  m.userData.noise = o; // لإعادة الإزاحة نفسها في الحدود
  return m;
}

/** مادة الحدود (الهيكل المقلوب) بالإزاحة نفسها + سُمك ثابت */
function outlineMat(o, thick) {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
  const sn = surfaceNoise(o);
  const disp = sn ? sn.disp.add(thick) : float(thick);
  m.positionNode = positionLocal.add(normalLocal.mul(disp));
  m.colorNode = mix(INK, UV_EDGE, o.uUV);
  return m;
}

/** يبني مجسّمًا مع حدوده. thick بوحدة المجسّم المحلية. */
function part(geo, hex, o, { thick = 0.035, outline = true } = {}) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, surfaceMat(hex, o));
  mesh.userData.sample = o.sample !== false;
  mesh.userData.lift = (o.rough || 0) + 0.02;
  g.add(mesh);
  if (outline) {
    const line = new THREE.Mesh(geo, outlineMat(o, thick));
    line.userData.outline = true;
    g.add(line);
  }
  g.userData.mesh = mesh;
  return g;
}
const at = (obj, x, y, z, rx = 0, ry = 0, rz = 0, s = null) => {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? obj.scale.set(...s) : obj.scale.setScalar(s);
  return obj;
};

// ------------------------------------------------------------------ الجولة ١
const SKIN = 0xe7ad86;

function hand(u, mirror = false) {
  const g = new THREE.Group();
  const o = { rough: 0.014, freq: 26, uUV: u };
  const palm = part(new THREE.SphereGeometry(0.5, 40, 28), SKIN, o, { thick: 0.04 });
  at(palm, 0, -0.18, 0, 0, 0, 0, [1.0, 1.18, 0.42]);
  g.add(palm);
  const fingers = [
    [-0.33, 0.52, 0.1, 0.42, -0.12],
    [-0.11, 0.62, 0.115, 0.5, -0.03],
    [0.12, 0.6, 0.115, 0.48, 0.04],
    [0.33, 0.48, 0.1, 0.38, 0.14],
  ];
  for (const [x, y, r, len, rz] of fingers) {
    const f = part(new THREE.CapsuleGeometry(r, len, 6, 14, 4), SKIN, o, { thick: 0.035 });
    at(f, x, y, 0, 0, 0, rz);
    g.add(f);
  }
  const thumb = part(new THREE.CapsuleGeometry(0.115, 0.36, 6, 14, 4), SKIN, o, { thick: 0.035 });
  at(thumb, 0.55, -0.2, 0.06, 0, 0, -0.95);
  g.add(thumb);
  if (mirror) g.scale.x = -1;
  return g;
}

function sponge(u) {
  const g = new THREE.Group();
  const body = part(new THREE.BoxGeometry(1.5, 0.78, 0.7, 36, 20, 18), 0xf6c443, { rough: 0.16, freq: 5.5, worley: true, uUV: u }, { thick: 0.03 });
  const scrub = part(new THREE.BoxGeometry(1.5, 0.22, 0.7, 30, 6, 14), 0x2f9e55, { rough: 0.05, freq: 14, uUV: u }, { thick: 0.03 });
  at(scrub, 0, 0.5, 0);
  g.add(body, scrub);
  g.rotation.set(0.35, -0.45, 0.1);
  return g;
}

function wool(u) {
  // خيوط ملفوفة: خطوط متقاطعة في اللون + نتوءات
  const p = positionLocal;
  const s1 = sin(p.x.mul(0.8).add(p.y.mul(0.6)).mul(34)).mul(0.5).add(0.5);
  const s2 = sin(p.y.mul(0.9).sub(p.z.mul(0.5)).mul(30)).mul(0.5).add(0.5);
  const stripes = mix(float(0.72), float(1.12), s1.max(s2.mul(0.85)));
  const g = part(new THREE.SphereGeometry(0.85, 64, 48), 0, { rough: 0.05, freq: 11, uUV: u, colorNode: color(0xe0536b).mul(stripes) }, { thick: 0.035 });
  const tail = part(new THREE.CapsuleGeometry(0.06, 0.7, 4, 10, 6), 0xe0536b, { rough: 0.02, freq: 20, uUV: u }, { thick: 0.03 });
  at(tail, 0.7, -0.75, 0.15, 0, 0, 0.9);
  g.add(tail);
  return g;
}

function rock(u) {
  const g = part(new THREE.IcosahedronGeometry(0.85, 6), 0x948d82, { rough: 0.17, freq: 2.6, uUV: u }, { thick: 0.04 });
  g.scale.set(1.2, 0.82, 0.95);
  g.rotation.set(0.3, 0.6, 0.15);
  return g;
}

function log(u) {
  const g = new THREE.Group();
  const bark = part(new THREE.CylinderGeometry(0.46, 0.5, 1.75, 56, 26, true), 0x7f5236, { rough: 0.09, freq: [11, 1.4, 11], uUV: u }, { thick: 0.035 });
  const p = positionLocal;
  const rings = sin(length(p.xz).mul(46)).mul(0.5).add(0.5);
  const capO = { uUV: u, colorNode: mix(color(0xd9a96c), color(0xb98247), rings) };
  const capA = part(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 48), 0, capO, { thick: 0.03 });
  const capB = part(new THREE.CylinderGeometry(0.49, 0.49, 0.04, 48), 0, { ...capO }, { thick: 0.03 });
  at(capA, 0, 0.87, 0);
  at(capB, 0, -0.87, 0);
  g.add(bark, capA, capB);
  g.rotation.set(0.25, 0.4, Math.PI / 2 - 0.15);
  return g;
}

function ball(u) {
  const p = positionLocal;
  const seam = smoothstep(0.035, 0.015, abs(p.y)).max(smoothstep(0.035, 0.015, abs(p.x)))
    .max(smoothstep(0.035, 0.015, abs(length(p.xy.sub(vec3(0.95, 0, 0).xy)).sub(0.62))))
    .max(smoothstep(0.035, 0.015, abs(length(p.xy.add(vec3(0.95, 0, 0).xy)).sub(0.62))));
  const col = mix(color(0xe8762b), color(0x2b1d1a), seam);
  const g = part(new THREE.SphereGeometry(0.85, 64, 48), 0, { rough: 0.022, freq: 30, uUV: u, colorNode: col }, { thick: 0.035 });
  g.rotation.set(0.35, 0.5, 0.2);
  return g;
}

function windowPane(u) {
  const g = new THREE.Group();
  const frame = 0xf2efe8;
  const o = { uUV: u, gloss: true };
  for (const [x, y, w, h] of [[0, 0.62, 1.5, 0.12], [0, -0.62, 1.5, 0.12], [-0.69, 0, 0.12, 1.36], [0.69, 0, 0.12, 1.36], [0, 0, 0.07, 1.2], [0, 0, 1.3, 0.07]]) {
    const b = part(new THREE.BoxGeometry(w, h, 0.12), frame, o, { thick: 0.025 });
    at(b, x, y, 0);
    g.add(b);
  }
  const glass = part(new THREE.PlaneGeometry(1.32, 1.2, 8, 8), 0xbfe5ff, { uUV: u, gloss: true, opacity: 0.55 }, { outline: false });
  // لمعة قطرية على الزجاج
  glass.userData.mesh.material.emissiveNode = glass.userData.mesh.material.emissiveNode.add(
    vec3(1, 1, 1).mul(smoothstep(0.08, 0.0, abs(uv().x.add(uv().y).sub(0.75))).mul(0.55).mul(oneMinus(u))),
  );
  g.add(glass);
  g.rotation.set(0.12, -0.35, 0);
  return g;
}

function mirror(u) {
  const g = new THREE.Group();
  const face = part(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 64), 0xdde7f0, { uUV: u, gloss: true }, { thick: 0.02 });
  face.rotation.x = Math.PI / 2;
  const glint = face.userData.mesh.material;
  glint.emissiveNode = glint.emissiveNode.add(vec3(1, 1, 1).mul(smoothstep(0.07, 0.0, abs(positionLocal.x.add(positionLocal.z).sub(0.25))).mul(0.6).mul(oneMinus(u))));
  const rim = part(new THREE.TorusGeometry(0.76, 0.08, 18, 72), 0xc9a227, { uUV: u, gloss: true }, { thick: 0.03 });
  const handle = part(new THREE.CapsuleGeometry(0.09, 0.55, 4, 12), 0xc9a227, { uUV: u, gloss: true }, { thick: 0.03 });
  at(handle, 0, -1.08, 0);
  g.add(face, rim, handle);
  g.rotation.set(0.1, -0.3, 0.15);
  g.scale.setScalar(0.85);
  return g;
}

function plate(u) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = t * 0.95;
    const y = t < 0.62 ? 0 : Math.pow((t - 0.62) / 0.38, 1.6) * 0.22;
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  const g = new THREE.Group();
  const dish = part(new THREE.LatheGeometry(pts, 72), 0xfbfaf5, { uUV: u, gloss: true }, { thick: 0.025 });
  dish.userData.mesh.material.side = THREE.DoubleSide;
  const band = part(new THREE.TorusGeometry(0.8, 0.02, 8, 72), 0x3b82f6, { uUV: u, gloss: true }, { outline: false });
  at(band, 0, 0.1, 0, Math.PI / 2, 0, 0);
  g.add(dish, band);
  g.rotation.set(1.05, 0, 0.1);
  return g;
}

function spoon(u) {
  const g = new THREE.Group();
  const o = { uUV: u, gloss: true };
  const bowl = part(new THREE.SphereGeometry(0.42, 40, 24), 0xcfd8e3, o, { thick: 0.03 });
  at(bowl, 0, 0.42, 0, 0, 0, 0, [0.72, 1, 0.22]);
  const handle = part(new THREE.CapsuleGeometry(0.075, 1.0, 6, 12), 0xcfd8e3, o, { thick: 0.03 });
  at(handle, 0, -0.5, 0.03);
  g.add(bowl, handle);
  g.rotation.set(0.3, -0.4, -0.55);
  return g;
}

function apple(u) {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.75, 56, 40), 0xd7263d, { uUV: u, gloss: true }, { thick: 0.035 });
  body.scale.set(1.05, 0.92, 1.05);
  const stem = part(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), 0x6b4423, { uUV: u }, { thick: 0.025 });
  at(stem, 0.02, 0.78, 0, 0, 0, -0.2);
  const leaf = part(new THREE.SphereGeometry(0.2, 24, 12), 0x3fa34d, { uUV: u, gloss: true }, { thick: 0.025 });
  at(leaf, 0.22, 0.82, 0, 0, 0, -0.6, [1, 0.45, 0.25]);
  g.add(body, stem, leaf);
  g.rotation.set(0.15, 0.3, 0);
  return g;
}

function balloon(u) {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.62, 56, 40), 0x3b82f6, { uUV: u, gloss: true }, { thick: 0.035 });
  body.scale.set(1, 1.2, 1);
  body.position.y = 0.2;
  const knot = part(new THREE.ConeGeometry(0.08, 0.14, 12), 0x2563eb, { uUV: u }, { thick: 0.02 });
  at(knot, 0, -0.56, 0, Math.PI, 0, 0);
  const str = part(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), 0x475569, { uUV: u, sample: false }, { outline: false });
  at(str, 0.04, -0.88, 0, 0, 0, 0.12);
  g.add(body, knot, str);
  g.rotation.z = 0.12;
  return g;
}

export const ITEM_MODELS = { hand, sponge, wool, rock, log, ball, window: windowPane, mirror, plate, spoon, apple, balloon };

// ------------------------------------------------------------------ الجولة ٢: قطع المشاهد القصيرة
/** وجه طفل كرتوني ينظر إلى اليمين؛ userData.mouth = نقطة خروج الرذاذ */
export function head(u) {
  const g = new THREE.Group();
  const face = part(new THREE.SphereGeometry(0.55, 48, 32), SKIN, { uUV: u }, { thick: 0.04 });
  const hair = part(new THREE.SphereGeometry(0.58, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), 0x3a2618, { uUV: u, rough: 0.03, freq: 18 }, { thick: 0.035 });
  at(hair, -0.04, 0.05, 0, 0, 0, 0.25);
  const eyeO = { uUV: u, sample: false };
  // عينان مغمضتان (لحظة العطاس): خطّان قصيران
  const e1 = part(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), 0x231815, eyeO, { outline: false });
  const e2 = part(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), 0x231815, eyeO, { outline: false });
  at(e1, 0.2, 0.1, 0.48, 0, 0, Math.PI / 2 - 0.2);
  at(e2, 0.42, 0.1, 0.3, 0, 0.6, Math.PI / 2 - 0.2);
  const nose = part(new THREE.SphereGeometry(0.075, 16, 12), 0xd99673, eyeO, { thick: 0.02 });
  at(nose, 0.47, -0.02, 0.32);
  const cheek = part(new THREE.SphereGeometry(0.07, 12, 8), 0xf08a8a, eyeO, { outline: false });
  at(cheek, 0.28, -0.12, 0.47, 0, 0, 0, [1.2, 0.7, 0.4]);
  const mouth = new THREE.Object3D();
  mouth.position.set(0.56, -0.2, 0.18);
  g.add(face, hair, e1, e2, nose, cheek, mouth);
  g.userData.mouth = mouth;
  return g;
}

export function tissueSheet(u) {
  const g = part(new THREE.PlaneGeometry(0.7, 0.8, 10, 10), 0xffffff, { uUV: u, rough: 0.04, freq: 4 }, { thick: 0.02 });
  g.userData.mesh.material.side = THREE.DoubleSide;
  return g;
}
export function tissueBall(u) {
  return part(new THREE.IcosahedronGeometry(0.26, 3), 0xf8f8f6, { uUV: u, rough: 0.12, freq: 5 }, { thick: 0.03 });
}
/** ذراع مثنية على شكل «<»: رأس الزاوية (المرفق) عند الأصل، يوضع أمام الفم */
export function elbowArm(u) {
  const g = new THREE.Group();
  const sleeve = 0x2563eb;
  const o = { uUV: u, rough: 0.02, freq: 14 };
  // العضد: من الكتف (أسفل الخلف) إلى المرفق
  const upper = part(new THREE.CapsuleGeometry(0.15, 0.62, 6, 14), sleeve, o, { thick: 0.035 });
  at(upper, -0.2, -0.36, 0, 0, 0, -0.52);
  // الساعد: من المرفق راجعًا فوق الوجه
  const fore = part(new THREE.CapsuleGeometry(0.14, 0.6, 6, 14), sleeve, { ...o }, { thick: 0.035 });
  at(fore, -0.24, 0.3, 0.05, 0, 0, 0.7);
  const cuff = part(new THREE.SphereGeometry(0.13, 16, 12), SKIN, { uUV: u, sample: false }, { thick: 0.03 });
  at(cuff, -0.5, 0.6, 0.05);
  g.add(upper, fore, cuff);
  return g;
}
export function table(u) {
  const g = new THREE.Group();
  const top = part(new THREE.BoxGeometry(2.6, 0.12, 1.0, 20, 2, 8), 0xd9a46a, { uUV: u, gloss: true }, { thick: 0.03 });
  const legA = part(new THREE.BoxGeometry(0.12, 0.7, 0.12), 0xa86f3c, { uUV: u, sample: false }, { thick: 0.025 });
  const legB = part(new THREE.BoxGeometry(0.12, 0.7, 0.12), 0xa86f3c, { uUV: u, sample: false }, { thick: 0.025 });
  at(legA, -1.1, -0.41, 0.3);
  at(legB, 1.1, -0.41, 0.3);
  g.add(top, legA, legB);
  g.userData.top = top;
  g.rotation.x = 0.35;
  return g;
}
export function sandwich(u) {
  const g = new THREE.Group();
  const bread = { uUV: u, rough: 0.03, freq: 9 };
  const b1 = part(new THREE.BoxGeometry(0.9, 0.16, 0.7, 12, 3, 10), 0xe7bf73, bread, { thick: 0.03 });
  const b2 = part(new THREE.BoxGeometry(0.9, 0.16, 0.7, 12, 3, 10), 0xe7bf73, { ...bread }, { thick: 0.03 });
  const leaf = part(new THREE.BoxGeometry(0.96, 0.05, 0.76), 0x4caf50, { uUV: u, sample: false }, { thick: 0.02 });
  const cheese = part(new THREE.BoxGeometry(0.92, 0.05, 0.72), 0xffc94a, { uUV: u, sample: false }, { thick: 0.02 });
  at(b1, 0, -0.14, 0);
  at(leaf, 0, -0.04, 0);
  at(cheese, 0, 0.02, 0);
  at(b2, 0, 0.13, 0);
  g.add(b1, leaf, cheese, b2);
  g.rotation.set(0.45, -0.5, 0);
  return g;
}
export function bin(u) {
  const g = new THREE.Group();
  const body = part(new THREE.CylinderGeometry(0.42, 0.34, 0.8, 40, 1, true), 0x64748b, { uUV: u, sample: false }, { thick: 0.03 });
  body.userData.mesh.material.side = THREE.DoubleSide;
  const lid = part(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 40), 0x475569, { uUV: u, sample: false }, { thick: 0.025 });
  at(lid, 0, 0.45, 0);
  g.add(body, lid);
  g.userData.lid = lid;
  return g;
}
export function bottle(u) {
  const g = new THREE.Group();
  const body = part(new THREE.CylinderGeometry(0.2, 0.22, 0.65, 28), 0x22c55e, { uUV: u, gloss: true, sample: false }, { thick: 0.03 });
  const neck = part(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 18), 0xf8fafc, { uUV: u, sample: false }, { thick: 0.02 });
  at(neck, 0, 0.4, 0);
  const headB = part(new THREE.BoxGeometry(0.32, 0.14, 0.14), 0xf8fafc, { uUV: u, sample: false }, { thick: 0.02 });
  at(headB, 0.08, 0.53, 0);
  g.add(body, neck, headB);
  return g;
}
/** فقاعة صابون: كرة شفافة بحافة مضيئة */
export function bubble(u) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const fres = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.0);
  m.colorNode = mix(vec3(0.75, 0.95, 1.0), vec3(0.9, 0.75, 1.0), u);
  m.opacityNode = saturate(fres.mul(0.9).add(0.08));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), m);
  return mesh;
}
/** مخروط ضوء المصباح البنفسجي (إضافي، بلا عمق) */
export function lampCone(u) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.colorNode = vec3(0.55, 0.3, 1.0);
  m.opacityNode = uv().y.pow(1.6).mul(0.32).mul(u);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1, 1, 48, 1, true), m);
  mesh.renderOrder = 5;
  return mesh;
}

export { uniform };
