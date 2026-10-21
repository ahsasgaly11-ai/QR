// ---------------------------------------------------------------------------
// مجسّمات «صيّادو الجراثيم» بمعيار الملف 10 (تقنية «دانة الصف»): مواد فيزيائية حقيقية
// (MeshPhysicalMaterial) تعكس بيئة الاستوديو، بلا ملفات GLB ولا أنسجة خارجية.
//
//   • الخشونة حقيقية: رؤوس الشكل تُزاح بضجيج على المعالج المركزي مرة واحدة (ضجيج كسري
//     أو خلايا «ورلي» للثقوب)، وتُغمَّق التجاويف بألوان الرؤوس. لذلك تجلس الجراثيم على
//     السطح الحقيقي، ويرى الطلاب الفرق بين الخشن والناعم بأعينهم.
//   • الناعم لامع: طبقة لمعة (clearcoat) أو معدن يعكس الاستوديو، أو زجاج.
//   • الوضع البنفسجي (setUV): يُعتم المجسّم ويكتسب حافة بنفسجية من «اللمعة الناعمة» (sheen)
//     كأنه في غرفة مظلمة تحت مصباح الأشعة فوق البنفسجية. لا يُعاد تجميع أي مظلِّل.
// كل مجسّم بمقياس الوحدة (يتسع في كرة نصف قطرها ≈ ١)، ويكبّره المشهد حسب الحجرة.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// ------------------------------------------------------------------ ضجيج ثلاثي الأبعاد (CPU)
const PERM = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const hash3 = (x, y, z) => PERM[PERM[PERM[x & 255] + (y & 255)] + (z & 255)] / 255;
/** ضجيج قيمي ناعم بين 0 و1 */
function vnoise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
  return lerp(
    lerp(lerp(hash3(X, Y, Z), hash3(X + 1, Y, Z), u), lerp(hash3(X, Y + 1, Z), hash3(X + 1, Y + 1, Z), u), v),
    lerp(lerp(hash3(X, Y, Z + 1), hash3(X + 1, Y, Z + 1), u), lerp(hash3(X, Y + 1, Z + 1), hash3(X + 1, Y + 1, Z + 1), u), v),
    w,
  );
}
function fbm(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
/** ضجيج الخلايا (ورلي): المسافة إلى أقرب نقطة عشوائية — للثقوب */
function worley(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  let d = 9;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const cx = X + i, cy = Y + j, cz = Z + k;
        const px = cx + hash3(cx, cy, cz), py = cy + hash3(cy + 17, cz + 3, cx + 9), pz = cz + hash3(cz + 31, cx + 7, cy + 13);
        d = Math.min(d, Math.hypot(px - x, py - y, pz - z));
      }
  return d;
}

/**
 * يزيح رؤوس الشكل على طول أعمدتها (خشونة حقيقية) ويكتب ألوان الرؤوس (تجاويف أغمق).
 * @param {THREE.BufferGeometry} geo
 * @param {{rough?:number, freq?:number|number[], worley?:boolean, tint?:(p:THREE.Vector3)=>number}} o
 */
function sculpt(geo, o = {}) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const f = Array.isArray(o.freq) ? o.freq : [o.freq || 8, o.freq || 8, o.freq || 8];
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let shade = 1;
    if (o.rough) {
      let n, d;
      if (o.worley) {
        const w = worley(p.x * f[0], p.y * f[1], p.z * f[2]);
        n = THREE.MathUtils.smoothstep(w, 0.05, 0.5);
        d = (n - 1) * o.rough;
      } else {
        n = fbm(p.x * f[0] + 11.3, p.y * f[1] + 4.1, p.z * f[2] + 7.7);
        d = (n - 0.5) * o.rough * 2;
      }
      pos.setXYZ(i, p.x + nor.getX(i) * d, p.y + nor.getY(i) * d, p.z + nor.getZ(i) * d);
      shade = lerp(0.6, 1.16, n);
    }
    if (o.tint) shade *= o.tint(p);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (o.rough) geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ المواد
const VIOLET = new THREE.Color('#a77bff');
const UV_BODY = new THREE.Color('#2a1052');
const tmpC = new THREE.Color();

/**
 * مادة فيزيائية جاهزة للوضع البنفسجي. sheen ≥ 0.05 دائمًا حتى لا يُعاد تجميع المظلِّل.
 * @param {string|number} color
 * @param {object} o خصائص MeshPhysicalMaterial إضافية
 */
export function pmat(color, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, metalness: 0, vertexColors: true, sheen: 0.05, sheenColor: '#000000', sheenRoughness: 0.35, ...o,
  });
  if (m.sheen < 0.05) m.sheen = 0.05;
  m.userData.base = {
    color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity,
    env: m.envMapIntensity, sheen: m.sheen, sheenColor: m.sheenColor.clone(), opacity: m.opacity,
  };
  return m;
}
const skin = () => pmat('#e3a383', { roughness: 0.62, sheen: 0.45, sheenColor: '#ffd6c2', sheenRoughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.6 });
const gloss = (c, o = {}) => pmat(c, { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, ...o });
const metal = (c, r = 0.18, o = {}) => pmat(c, { metalness: 1, roughness: r, vertexColors: false, envMapIntensity: 1.3, ...o });
const matte = (c, o = {}) => pmat(c, { roughness: 0.92, ...o });
const fabric = (c, o = {}) => pmat(c, { roughness: 0.85, sheen: 0.9, sheenColor: '#ffffff', sheenRoughness: 0.55, ...o });

/**
 * الوضع البنفسجي لكل مواد المجسّم (k من 0 إلى 1): يُعتم، وحافة بنفسجية، وانعكاس أضعف.
 * لا يُغيّر إلا القيم، فلا يُعاد تجميع أي مظلِّل.
 */
export function setUV(root, k) {
  root.traverse((o) => {
    const m = o.material;
    const b = m?.userData?.base;
    if (!b) return;
    m.color.copy(b.color).multiplyScalar(lerp(1, 0.38, k)).lerp(UV_BODY, k * 0.3);
    m.emissive.copy(b.emissive).lerp(tmpC.set('#3a1677'), k * 0.5);
    m.emissiveIntensity = lerp(b.ei, Math.max(b.ei, 0.35), k);
    m.envMapIntensity = lerp(b.env, b.env * 0.25, k);
    m.sheen = lerp(b.sheen, 1, k);
    m.sheenColor.copy(b.sheenColor).lerp(VIOLET, k);
  });
}

// ------------------------------------------------------------------ أدوات
function mesh(geo, mat, { sample = true, lift = 0.012 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.userData.sample = sample;
  m.userData.lift = lift;
  return m;
}
const at = (obj, x, y, z, rx = 0, ry = 0, rz = 0, s = null) => {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? obj.scale.set(...s) : obj.scale.setScalar(s);
  return obj;
};
/** نسيج لوحي صغير مرسوم بالكود (حلقات الخشب، الحبيبات…) */
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ الجولة ١: خشن
function hand(mirror = false) {
  const g = new THREE.Group();
  const o = { rough: 0.012, freq: 24 };
  const palm = mesh(sculpt(new THREE.SphereGeometry(0.5, 48, 32), o), skin(), { lift: 0.02 });
  at(palm, 0, -0.18, 0, 0, 0, 0, [1.0, 1.18, 0.42]);
  g.add(palm);
  const fingers = [
    [-0.33, 0.52, 0.1, 0.42, -0.12],
    [-0.11, 0.62, 0.115, 0.5, -0.03],
    [0.12, 0.6, 0.115, 0.48, 0.04],
    [0.33, 0.48, 0.1, 0.38, 0.14],
  ];
  for (const [x, y, r, len, rz] of fingers) {
    const f = mesh(sculpt(new THREE.CapsuleGeometry(r, len, 8, 16, 6), o), skin(), { lift: 0.02 });
    at(f, x, y, 0, 0, 0, rz);
    // ظفر لامع صغير
    const nail = mesh(new THREE.SphereGeometry(r * 0.72, 16, 10), gloss('#f2c3ad', { vertexColors: false }), { sample: false });
    at(nail, 0, len / 2 + r * 0.35, r * 0.62, -0.5, 0, 0, [1, 0.8, 0.35]);
    f.add(nail);
    g.add(f);
  }
  const thumb = mesh(sculpt(new THREE.CapsuleGeometry(0.115, 0.36, 8, 16, 6), o), skin(), { lift: 0.02 });
  at(thumb, 0.55, -0.2, 0.06, 0, 0, -0.95);
  g.add(thumb);
  if (mirror) g.scale.x = -1;
  return g;
}

function sponge() {
  const g = new THREE.Group();
  const body = mesh(sculpt(new THREE.BoxGeometry(1.5, 0.78, 0.7, 48, 26, 24), { rough: 0.14, freq: 5.5, worley: true }), pmat('#f4c443', { roughness: 0.95 }), { lift: 0.03 });
  const scrub = mesh(sculpt(new THREE.BoxGeometry(1.5, 0.22, 0.7, 40, 8, 18), { rough: 0.05, freq: 14 }), fabric('#2f9e55', { sheenColor: '#9fe8b8' }), { lift: 0.03 });
  at(scrub, 0, 0.5, 0);
  g.add(body, scrub);
  g.rotation.set(0.35, -0.45, 0.1);
  return g;
}

function wool() {
  // خيوط ملفوفة: خطوط متقاطعة في ألوان الرؤوس + نتوءات + لمعة قماش
  const tint = (p) => {
    const s1 = Math.sin((p.x * 0.8 + p.y * 0.6) * 34) * 0.5 + 0.5;
    const s2 = Math.sin((p.y * 0.9 - p.z * 0.5) * 30) * 0.5 + 0.5;
    return lerp(0.72, 1.1, Math.max(s1, s2 * 0.85));
  };
  const body = mesh(sculpt(new THREE.SphereGeometry(0.85, 96, 72), { rough: 0.05, freq: 11, tint }), fabric('#e0536b', { sheenColor: '#ffc2cf' }), { lift: 0.03 });
  const g = new THREE.Group();
  g.add(body);
  const tail = mesh(sculpt(new THREE.CapsuleGeometry(0.06, 0.7, 4, 12, 8), { rough: 0.02, freq: 20 }), fabric('#e0536b', { sheenColor: '#ffc2cf' }));
  at(tail, 0.7, -0.75, 0.15, 0, 0, 0.9);
  g.add(tail);
  return g;
}

function rock() {
  const g = new THREE.Group();
  const geo = sculpt(new THREE.IcosahedronGeometry(0.85, 7), { rough: 0.16, freq: 2.6 });
  // حبيبات معدنية صغيرة: تفاوت إضافي في اللون
  const c = geo.attributes.color;
  const p = new THREE.Vector3();
  for (let i = 0; i < c.count; i++) {
    p.fromBufferAttribute(geo.attributes.position, i);
    const speck = vnoise(p.x * 40, p.y * 40, p.z * 40) > 0.82 ? 1.25 : 1;
    c.setXYZ(i, c.getX(i) * speck, c.getY(i) * speck, c.getZ(i) * speck);
  }
  const m = mesh(geo, matte('#958b7e', { roughness: 0.96 }), { lift: 0.03 });
  g.add(m);
  g.scale.set(1.2, 0.82, 0.95);
  g.rotation.set(0.3, 0.6, 0.15);
  return g;
}

let RINGS = null;
function log() {
  const g = new THREE.Group();
  const bark = mesh(sculpt(new THREE.CylinderGeometry(0.46, 0.5, 1.75, 72, 36, true), { rough: 0.09, freq: [11, 1.4, 11] }), matte('#7a4e33'), { lift: 0.03 });
  RINGS ||= canvasTex(256, (x, s) => {
    for (let r = s / 2; r > 0; r -= 5) {
      x.fillStyle = (r / 5) % 2 ? '#d7a66a' : '#bd8a4e';
      x.beginPath();
      x.arc(s / 2 + Math.sin(r) * 2, s / 2, r, 0, Math.PI * 2);
      x.fill();
    }
  });
  const capMat = pmat('#ffffff', { map: RINGS, roughness: 0.75, vertexColors: false });
  const capA = mesh(new THREE.CircleGeometry(0.455, 48), capMat);
  const capB = mesh(new THREE.CircleGeometry(0.495, 48), capMat.clone());
  capB.material.userData.base = { ...capMat.userData.base, color: capMat.userData.base.color.clone(), emissive: capMat.userData.base.emissive.clone(), sheenColor: capMat.userData.base.sheenColor.clone() };
  at(capA, 0, 0.875, 0, -Math.PI / 2, 0, 0);
  at(capB, 0, -0.875, 0, Math.PI / 2, 0, 0);
  g.add(bark, capA, capB);
  g.rotation.set(0.25, 0.4, Math.PI / 2 - 0.15);
  return g;
}

function ball() {
  const g = new THREE.Group();
  const body = mesh(sculpt(new THREE.SphereGeometry(0.85, 96, 72), { rough: 0.016, freq: 34 }), pmat('#e8742a', { roughness: 0.7, sheen: 0.3, sheenColor: '#ffb27a' }), { lift: 0.02 });
  g.add(body);
  // درزات حقيقية (حلقات داكنة على السطح)
  const seam = pmat('#2a1a14', { roughness: 0.6, vertexColors: false });
  const ring = (rx, ry, r = 0.853) => {
    const t = mesh(new THREE.TorusGeometry(r, 0.016, 8, 120), seam, { sample: false });
    t.rotation.set(rx, ry, 0);
    g.add(t);
  };
  ring(Math.PI / 2, 0);
  ring(0, 0);
  ring(0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    const t = mesh(new THREE.TorusGeometry(0.62, 0.016, 8, 100), seam, { sample: false });
    t.position.x = sx * 0.58;
    t.rotation.y = Math.PI / 2;
    g.add(t);
  }
  g.rotation.set(0.35, 0.5, 0.2);
  return g;
}

// ------------------------------------------------------------------ الجولة ١: ناعم
function windowPane(tier) {
  const g = new THREE.Group();
  const frame = gloss('#f4f1ea', { vertexColors: false, roughness: 0.3 });
  for (const [x, y, w, h] of [[0, 0.62, 1.5, 0.12], [0, -0.62, 1.5, 0.12], [-0.69, 0, 0.12, 1.36], [0.69, 0, 0.12, 1.36], [0, 0, 0.07, 1.2], [0, 0, 1.3, 0.07]]) {
    const b = mesh(new THREE.BoxGeometry(w, h, 0.12), frame);
    at(b, x, y, 0);
    g.add(b);
  }
  const glassMat = tier === 'A'
    ? pmat('#d8f1ff', { vertexColors: false, roughness: 0.02, transmission: 1, thickness: 0.05, ior: 1.5, envMapIntensity: 1.4 })
    : pmat('#bfe5ff', { vertexColors: false, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.4, depthWrite: false, envMapIntensity: 1.6 });
  const glass = mesh(new THREE.BoxGeometry(1.3, 1.2, 0.02), glassMat);
  g.add(glass);
  g.rotation.set(0.12, -0.35, 0);
  return g;
}

function mirror() {
  const g = new THREE.Group();
  const face = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 96), metal('#eef3f8', 0.03, { envMapIntensity: 1.6 }));
  face.rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.76, 0.08, 24, 96), metal('#d2a838', 0.22));
  const handle = mesh(new THREE.CapsuleGeometry(0.09, 0.55, 6, 16), metal('#d2a838', 0.22));
  at(handle, 0, -1.08, 0);
  g.add(face, rim, handle);
  g.rotation.set(0.1, -0.3, 0.15);
  g.scale.setScalar(0.85);
  return g;
}

function plate() {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = t * 0.95;
    const y = t < 0.62 ? 0 : Math.pow((t - 0.62) / 0.38, 1.6) * 0.22;
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  const g = new THREE.Group();
  const dish = mesh(new THREE.LatheGeometry(pts, 96), gloss('#fbfaf6', { vertexColors: false, side: THREE.DoubleSide, roughness: 0.15 }));
  const band = mesh(new THREE.TorusGeometry(0.8, 0.018, 8, 96), gloss('#2f6fd1', { vertexColors: false }), { sample: false });
  at(band, 0, 0.1, 0, Math.PI / 2, 0, 0);
  g.add(dish, band);
  g.rotation.set(1.05, 0, 0.1);
  return g;
}

function spoon() {
  const g = new THREE.Group();
  const steel = metal('#dfe6ee', 0.12);
  const bowl = mesh(new THREE.SphereGeometry(0.42, 48, 32), steel);
  at(bowl, 0, 0.42, 0, 0, 0, 0, [0.72, 1, 0.22]);
  const handle = mesh(new THREE.CapsuleGeometry(0.075, 1.0, 8, 16), steel);
  at(handle, 0, -0.5, 0.03);
  g.add(bowl, handle);
  g.rotation.set(0.3, -0.4, -0.55);
  return g;
}

function apple() {
  const g = new THREE.Group();
  // قشرة لامعة بخطوط لونية ناعمة
  const tint = (p) => lerp(0.85, 1.08, Math.sin(Math.atan2(p.z, p.x) * 9 + p.y * 3) * 0.5 + 0.5) * lerp(1.05, 0.9, p.y * 0.5 + 0.5);
  const body = mesh(sculpt(new THREE.SphereGeometry(0.75, 72, 52), { tint }), gloss('#c8202f', { roughness: 0.28, clearcoatRoughness: 0.08 }));
  body.scale.set(1.05, 0.92, 1.05);
  const stem = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), matte('#6b4423', { vertexColors: false }), { sample: false });
  at(stem, 0.02, 0.78, 0, 0, 0, -0.2);
  const leaf = mesh(new THREE.SphereGeometry(0.2, 24, 12), gloss('#3fa34d', { vertexColors: false, roughness: 0.4 }), { sample: false });
  at(leaf, 0.22, 0.82, 0, 0, 0, -0.6, [1, 0.45, 0.25]);
  g.add(body, stem, leaf);
  g.rotation.set(0.15, 0.3, 0);
  return g;
}

function balloon() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.62, 72, 52), gloss('#2f74f0', { vertexColors: false, roughness: 0.18, sheen: 0.4, sheenColor: '#9cc2ff' }));
  body.scale.set(1, 1.2, 1);
  body.position.y = 0.2;
  const knot = mesh(new THREE.ConeGeometry(0.08, 0.14, 16), gloss('#2563eb', { vertexColors: false }), { sample: false });
  at(knot, 0, -0.56, 0, Math.PI, 0, 0);
  const str = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), matte('#475569', { vertexColors: false }), { sample: false });
  at(str, 0.04, -0.88, 0, 0, 0, 0.12);
  g.add(body, knot, str);
  g.rotation.z = 0.12;
  return g;
}

/** كل دالة تأخذ الطبقة (A/B) لأن الزجاج الحقيقي للطبقة A فقط */
export const ITEM_MODELS = { hand, sponge, wool, rock, log, ball, window: windowPane, mirror, plate, spoon, apple, balloon };

// ------------------------------------------------------------------ الجولة ٢: قطع المشاهد القصيرة
/** وجه طفل ينظر إلى اليمين؛ userData.mouth = نقطة خروج الرذاذ */
export function head() {
  const g = new THREE.Group();
  const face = mesh(new THREE.SphereGeometry(0.55, 56, 40), skin());
  const hair = mesh(sculpt(new THREE.SphereGeometry(0.58, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.42), { rough: 0.025, freq: 18 }), fabric('#3a2618', { sheenColor: '#a07850' }));
  at(hair, -0.04, 0.05, 0, 0, 0, 0.25);
  const ink = pmat('#231815', { vertexColors: false });
  // عينان مغمضتان (لحظة العطاس)
  const e1 = mesh(new THREE.CapsuleGeometry(0.028, 0.12, 4, 8), ink, { sample: false });
  const e2 = mesh(new THREE.CapsuleGeometry(0.028, 0.12, 4, 8), ink, { sample: false });
  at(e1, 0.2, 0.1, 0.49, 0, 0, Math.PI / 2 - 0.2);
  at(e2, 0.42, 0.1, 0.31, 0, 0.6, Math.PI / 2 - 0.2);
  const nose = mesh(new THREE.SphereGeometry(0.075, 16, 12), skin(), { sample: false });
  at(nose, 0.47, -0.02, 0.32);
  const cheek = mesh(new THREE.SphereGeometry(0.07, 12, 8), pmat('#f08a8a', { vertexColors: false, transparent: true, opacity: 0.7 }), { sample: false });
  at(cheek, 0.28, -0.12, 0.47, 0, 0, 0, [1.2, 0.7, 0.4]);
  const mouth = new THREE.Object3D();
  mouth.position.set(0.56, -0.2, 0.18);
  g.add(face, hair, e1, e2, nose, cheek, mouth);
  g.userData.mouth = mouth;
  return g;
}

export function tissueSheet() {
  const geo = sculpt(new THREE.PlaneGeometry(0.7, 0.8, 16, 16), { rough: 0.035, freq: 4 });
  return mesh(geo, fabric('#ffffff', { side: THREE.DoubleSide, sheenColor: '#ffffff' }));
}
export function tissueBall() {
  return mesh(sculpt(new THREE.IcosahedronGeometry(0.26, 4), { rough: 0.1, freq: 5 }), fabric('#f8f8f6'), { lift: 0.03 });
}
/** ذراع مثنية على شكل «<»: المرفق عند الأصل، يوضع أمام الفم */
export function elbowArm() {
  const g = new THREE.Group();
  const sleeve = () => fabric('#2563eb', { sheenColor: '#9ec0ff' });
  const o = { rough: 0.015, freq: 14 };
  const upper = mesh(sculpt(new THREE.CapsuleGeometry(0.15, 0.62, 8, 16, 6), o), sleeve());
  at(upper, -0.2, -0.36, 0, 0, 0, -0.52);
  const fore = mesh(sculpt(new THREE.CapsuleGeometry(0.14, 0.6, 8, 16, 6), o), sleeve());
  at(fore, -0.24, 0.3, 0.05, 0, 0, 0.7);
  const cuff = mesh(new THREE.SphereGeometry(0.13, 16, 12), skin(), { sample: false });
  at(cuff, -0.5, 0.6, 0.05);
  g.add(upper, fore, cuff);
  return g;
}
let GRAIN = null;
export function table() {
  const g = new THREE.Group();
  GRAIN ||= canvasTex(256, (x, s) => {
    x.fillStyle = '#d9a46a';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(120,70,30,${0.05 + Math.random() * 0.12})`;
      x.lineWidth = 1 + Math.random() * 2;
      x.beginPath();
      const y = Math.random() * s;
      x.moveTo(0, y);
      x.bezierCurveTo(s * 0.3, y + Math.random() * 8 - 4, s * 0.6, y + Math.random() * 8 - 4, s, y);
      x.stroke();
    }
  });
  const top = mesh(new THREE.BoxGeometry(2.6, 0.12, 1.0, 20, 2, 8), gloss('#ffffff', { vertexColors: false, map: GRAIN, roughness: 0.35, clearcoat: 0.6 }));
  const legMat = matte('#a86f3c', { vertexColors: false });
  const legA = mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), legMat, { sample: false });
  const legB = mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), legMat, { sample: false });
  at(legA, -1.1, -0.41, 0.3);
  at(legB, 1.1, -0.41, 0.3);
  g.add(top, legA, legB);
  g.userData.top = top;
  g.rotation.x = 0.35;
  return g;
}
export function sandwich() {
  const g = new THREE.Group();
  const bread = () => mesh(sculpt(new THREE.BoxGeometry(0.9, 0.16, 0.7, 16, 4, 12), { rough: 0.025, freq: 9 }), pmat('#e3b765', { roughness: 0.85 }));
  const b1 = bread();
  const b2 = bread();
  const leaf = mesh(sculpt(new THREE.BoxGeometry(0.98, 0.05, 0.78, 14, 1, 10), { rough: 0.02, freq: 6 }), gloss('#4caf50', { roughness: 0.4 }), { sample: false });
  const cheese = mesh(new THREE.BoxGeometry(0.92, 0.05, 0.72), pmat('#ffc94a', { vertexColors: false, roughness: 0.5 }), { sample: false });
  at(b1, 0, -0.14, 0);
  at(leaf, 0, -0.04, 0);
  at(cheese, 0, 0.02, 0);
  at(b2, 0, 0.13, 0);
  g.add(b1, leaf, cheese, b2);
  g.rotation.set(0.45, -0.5, 0);
  return g;
}
export function bin() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.8, 48, 1, true), metal('#8a97a8', 0.35, { side: THREE.DoubleSide }), { sample: false });
  const lid = mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 48), metal('#5d6b7d', 0.3), { sample: false });
  at(lid, 0, 0.45, 0);
  g.add(body, lid);
  g.userData.lid = lid;
  return g;
}
export function bottle() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.65, 32), gloss('#22c55e', { vertexColors: false, roughness: 0.15 }), { sample: false });
  const white = gloss('#f8fafc', { vertexColors: false });
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 18), white, { sample: false });
  at(neck, 0, 0.4, 0);
  const headB = mesh(new THREE.BoxGeometry(0.32, 0.14, 0.14), white, { sample: false });
  at(headB, 0.08, 0.53, 0);
  g.add(body, neck, headB);
  return g;
}
/** فقاعة صابون: كرة متقزّحة شفافة (كلؤلؤ «دانة الصف») */
export function bubble() {
  const m = pmat('#ffffff', {
    vertexColors: false, roughness: 0.05, metalness: 0, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 620],
    transparent: true, opacity: 0.35, depthWrite: false, envMapIntensity: 2,
  });
  const b = mesh(new THREE.SphereGeometry(0.16, 32, 20), m, { sample: false });
  b.castShadow = false;
  return b;
}

// ------------------------------------------------------------------ الاستوديو المشترك للانعكاسات
/**
 * «استوديو» الانعكاسات: قبة بتدرّج دافئ وألواح ضوء ناعمة، قيمها كلها أقل من عتبة التوهّج.
 * (RoomEnvironment الجاهز ألواحه أقوى بعشرات المرات، فتتوهّج كل لمعة على النحاس وتغطي العدسة بهالة.)
 */
export function studioEnvScene() {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vD;
        void main(){
          float y = vD.y;
          vec3 c = mix(vec3(0.28, 0.24, 0.30), vec3(0.78, 0.74, 0.80), smoothstep(-0.6, 0.15, y));
          c = mix(c, vec3(1.0, 0.96, 0.9), smoothstep(0.3, 1.0, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  s.add(dome);
  const panel = (w, h, x, y, z, v) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v * 0.97, v * 0.93), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(6, 3, 2, 6, 5, 1.35); // ضوء رئيسي أعلى الأمام
  panel(3, 5, -7, 2, 2, 0.9); // ضوء جانبي
  panel(4, 2, 5, 1, -6, 0.7); // ضوء خلفي
  return s;
}

