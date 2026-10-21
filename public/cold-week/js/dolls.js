// ---------------------------------------------------------------------------
// الزملاء: شخصيات أطفال مُركّبة (لا تمثّل أطفالًا حقيقيين) بهيكل عظمي حقيقي (SkinnedMesh):
//   • جسم وذراعان قطعة واحدة «مكسوّة» على ١٣ عظمة، فتنثني المرافق والأكتاف بنعومة بلا فواصل.
//   • ذراعان بحلّ IK من عظمتين: نعطي مكان اليد (ومكان المرفق إن لزم) فيُحسب الكتف والمرفق.
//   • وجه معبّر: جفنان ينغلقان، وحاجبان، وفم ينفتح، وعينان بقزحية ولمعة.
//   • ساقان تجلسان وتقفان وتمشيان، وتنفّس خفيف دائم، وعطسة بالجسم كله (شهيق ثم اندفاع).
//
//   uSick  0..1: يشحب الوجه، ويحمرّ الأنف، ويخضرّ القميص قليلًا، وتتهدّل الجفون، وميزان حرارة فوق الرأس.
//   uHi    إبراز صاحب الدور: ضوء حافة ذهبي ينبض، وحلقة ذهبية تحت الكرسي.
// الوحدات بالمتر، والشخصية تنظر نحو +z، واليمين +x.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { abs, color, dot, mix, normalView, oneMinus, positionViewDirection, sin, time, uniform, vec3, vertexColor } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { enamel, chrome } from './materials.js';

const SKIN = [0xf0c9a0, 0xdcab80, 0xc4926a, 0xe8bd92, 0xd09f74, 0xb3825d];
const HAIR = [0x2b1a12, 0x1c120c, 0x3a2418, 0x241710, 0x2e1c12, 0x170f0a];
const GIRL = [true, false, true, false, true, false]; // سارة، خالد، ريم، يوسف، مريم، أحمد
const GOLD = vec3(1.0, 0.72, 0.25);
const PANTS = 0x2b3550;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** ضوء الحافة الذهبي للإبراز */
function rim(uHi) {
  const f = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.4);
  const pulse = sin(time.mul(3.2)).mul(0.25).add(0.75);
  return GOLD.mul(f.mul(uHi).mul(pulse).mul(2.4));
}

// ------------------------------------------------------------------ أبعاد الهيكل (وضع الربط: واقف الذراعان متدلّيتان)
const B = {
  hips: 0.5, spine: 0.62, chest: 0.76, neck: 0.935, head: 0.99,
  shoulderX: 0.172, shoulderY: 0.865, upper: 0.2, fore: 0.185,
};
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperL', 'foreL', 'handL', 'clavR', 'upperR', 'foreR', 'handR'];
const IX = Object.fromEntries(BONES.map((n, i) => [n, i]));

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * الجسم والذراعان: هندسة واحدة بأوزان كسوة لكل رأس (عظمتان على الأكثر)، ولون لكل رأس
 * (قميص، رقبة بلون البشرة، أساور بيضاء).
 */
function bodyGeometry(shirtHex, skinHex) {
  const pos = [];
  const nor = [];
  const col = [];
  const si = [];
  const sw = [];
  const idx = [];
  const cShirt = new THREE.Color(shirtHex);
  const cSkin = new THREE.Color(skinHex);
  const cCuff = new THREE.Color(0xf6f1e7);
  const pushV = (p, n, c, b0, b1, w) => {
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    col.push(c.r, c.g, c.b);
    si.push(b0, b1, 0, 0);
    sw.push(1 - w, w, 0, 0);
  };
  // الجذع: مقاطع إهليلجية من الورك إلى الرقبة
  const prof = [
    [0.44, 0.0, 0.0], [0.452, 0.11, 0.09], [0.48, 0.152, 0.12], [0.54, 0.162, 0.125], [0.62, 0.15, 0.115], [0.7, 0.148, 0.112],
    [0.78, 0.162, 0.118], [0.84, 0.168, 0.118], [0.88, 0.15, 0.105], [0.905, 0.1, 0.08], [0.925, 0.055, 0.052], [0.97, 0.048, 0.046], [1.02, 0.046, 0.044], [1.03, 0.0, 0.0],
  ];
  const SEG = 40;
  const ring0 = pos.length / 3;
  for (const [y, rx, rz] of prof) {
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const p = V3(Math.sin(a) * rx, y, Math.cos(a) * rz);
      const n = V3(Math.sin(a) / Math.max(rx, 1e-3), 0, Math.cos(a) / Math.max(rz, 1e-3)).normalize();
      // الأوزان على طول العمود الفقري
      let b0 = IX.hips;
      let b1 = IX.spine;
      let w = smooth(0.53, 0.64, y);
      if (y > 0.64) (b0 = IX.spine), (b1 = IX.chest), (w = smooth(0.66, 0.78, y));
      if (y > 0.8) (b0 = IX.chest), (b1 = IX.neck), (w = smooth(0.9, 0.95, y));
      if (y > 0.97) (b0 = IX.neck), (b1 = IX.head), (w = smooth(0.98, 1.02, y));
      pushV(p, n, y > 0.915 ? cSkin : cShirt, b0, b1, w);
    }
  }
  for (let r = 0; r < prof.length - 1; r++) {
    for (let k = 0; k < SEG; k++) {
      const a = ring0 + r * (SEG + 1) + k;
      const b = a + SEG + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // الذراعان: أنبوب من الكتف إلى الرسغ، متدلٍّ في وضع الربط
  for (const side of [-1, 1]) {
    const clav = side < 0 ? IX.clavL : IX.clavR;
    const up = side < 0 ? IX.upperL : IX.upperR;
    const fo = side < 0 ? IX.foreL : IX.foreR;
    const x0 = side * B.shoulderX;
    const y0 = B.shoulderY + 0.035;
    const L = B.upper + B.fore;
    const rings = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * (L + 0.035) - 0.035; // يبدأ قليلًا فوق الكتف ليلتحم بالجذع
      // نصف القطر: كتف ممتلئ، ثم عضد، ثم مرفق أنحف، ثم ساعد، ثم إسوار
      let r = 0.05 - 0.008 * smooth(0, B.upper, s) - 0.006 * smooth(B.upper, L, s);
      if (s < 0) r = 0.05 * Math.sqrt(Math.max(0.15, 1 - (s / 0.04) ** 2));
      const cuff = s > L - 0.03;
      if (cuff) r += 0.004;
      let b0 = clav;
      let b1 = up;
      let w = smooth(-0.03, 0.03, s);
      if (s > 0.06) (b0 = up), (b1 = fo), (w = smooth(B.upper - 0.035, B.upper + 0.035, s));
      rings.push({ y: y0 - 0.035 - s, r, b0, b1, w, c: cuff ? cCuff : cShirt });
    }
    const base = pos.length / 3;
    const RS = 20;
    for (const R of rings) {
      for (let k = 0; k <= RS; k++) {
        const a = (k / RS) * Math.PI * 2;
        const n = V3(Math.cos(a), 0, Math.sin(a));
        pushV(V3(x0 + n.x * R.r, R.y, n.z * R.r * 0.92), n, R.c, R.b0, R.b1, R.w);
      }
    }
    for (let r = 0; r < rings.length - 1; r++) {
      for (let k = 0; k < RS; k++) {
        const a = base + r * (RS + 1) + k;
        const b = a + RS + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ قطع صلبة مشتركة
const GEO = {};
function geos() {
  if (GEO.skull) return GEO;
  GEO.skull = new THREE.SphereGeometry(0.165, 48, 32);
  GEO.skull.scale(1, 1.05, 0.97);
  GEO.capShort = new THREE.SphereGeometry(0.174, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.56);
  GEO.capLong = new THREE.SphereGeometry(0.178, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.62);
  GEO.lock = new THREE.SphereGeometry(0.045, 16, 12);
  GEO.sideHair = new THREE.CapsuleGeometry(0.06, 0.16, 8, 16);
  GEO.tail = new THREE.CapsuleGeometry(0.045, 0.14, 8, 16);
  GEO.bun = new THREE.SphereGeometry(0.06, 20, 14);
  GEO.ear = new THREE.SphereGeometry(0.032, 16, 12);
  GEO.ear.scale(0.6, 1, 0.9);
  GEO.sclera = new THREE.SphereGeometry(0.027, 24, 16);
  GEO.iris = new THREE.CircleGeometry(0.0175, 24);
  GEO.pupil = new THREE.CircleGeometry(0.0085, 16);
  GEO.glint = new THREE.CircleGeometry(0.005, 10);
  GEO.lid = new THREE.SphereGeometry(0.0295, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  GEO.brow = new THREE.TorusGeometry(0.03, 0.0042, 6, 16, 1.4);
  GEO.brow.rotateZ(Math.PI / 2 - 0.7);
  GEO.nose = new THREE.SphereGeometry(0.019, 16, 12);
  GEO.mouthIn = new THREE.SphereGeometry(0.022, 20, 12);
  GEO.smile = new THREE.TorusGeometry(0.024, 0.005, 8, 24, Math.PI);
  GEO.cheek = new THREE.CircleGeometry(0.026, 24);
  GEO.palm = new RoundedBoxGeometry(0.058, 0.07, 0.03, 3, 0.012);
  GEO.finger = new THREE.CapsuleGeometry(0.0095, 0.035, 4, 8);
  GEO.thumb = new THREE.CapsuleGeometry(0.011, 0.028, 4, 8);
  GEO.collar = new THREE.TorusGeometry(0.058, 0.014, 10, 32);
  GEO.thigh = new THREE.CapsuleGeometry(0.062, 0.24, 6, 16);
  GEO.shin = new THREE.CapsuleGeometry(0.05, 0.25, 6, 16);
  GEO.shoe = new RoundedBoxGeometry(0.085, 0.06, 0.17, 3, 0.025);
  GEO.seat = new RoundedBoxGeometry(0.44, 0.06, 0.4, 3, 0.025);
  GEO.back = new RoundedBoxGeometry(0.44, 0.34, 0.05, 3, 0.02);
  GEO.leg = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 12);
  GEO.ring = new THREE.TorusGeometry(0.34, 0.018, 12, 64);
  for (const g of Object.values(GEO)) g.userData.shared = true; // مشتركة: لا تُحرَّر مع إعادة بناء الصف
  return GEO;
}

const mesh = (g, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};

/** يد: راحة وأربعة أصابع منثنية قليلًا وإبهام */
function hand(skinMat, side) {
  const G = geos();
  const h = new THREE.Group();
  h.add(mesh(G.palm, skinMat, 0, -0.04, 0.004));
  for (let i = 0; i < 4; i++) {
    const f = mesh(G.finger, skinMat, (i - 1.5) * 0.0145, -0.092 + Math.abs(i - 1.5) * 0.004, 0.006);
    f.rotation.x = 0.25;
    h.add(f);
  }
  const t = mesh(G.thumb, skinMat, -side * 0.033, -0.035, 0.016);
  t.rotation.set(0.4, 0, -side * 0.7);
  h.add(t);
  return h;
}

/** المواد المشتركة بين الشخصيات */
export function dollShared() {
  return {
    chairMats: {},
    hairMats: {},
    chrome: chrome(),
    white: enamel(0xffffff),
    sclera: new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    iris: new THREE.MeshPhysicalNodeMaterial({ color: 0x4a2c18, roughness: 0.3, clearcoat: 1 }),
    pupil: new THREE.MeshBasicNodeMaterial({ color: 0x0a0605 }),
    glint: new THREE.MeshBasicNodeMaterial({ color: 0xffffff }),
    brow: new THREE.MeshPhysicalNodeMaterial({ color: 0x2b1a12, roughness: 0.6 }),
    mouthIn: new THREE.MeshPhysicalNodeMaterial({ color: 0x6a1f1c, roughness: 0.5 }),
    lip: new THREE.MeshPhysicalNodeMaterial({ color: 0xb4544a, roughness: 0.35, clearcoat: 0.6 }),
    cheek: new THREE.MeshBasicNodeMaterial({ color: 0xf08a8a, transparent: true, opacity: 0.4, depthWrite: false }),
    pants: new THREE.MeshPhysicalNodeMaterial({ color: PANTS, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8090c0) }),
    shoe: new THREE.MeshPhysicalNodeMaterial({ color: 0x222222, roughness: 0.3, clearcoat: 0.9 }),
  };
}

/**
 * @param {{name:string,color:string}} spec
 * @param {number} idx  رقم المقعد (البشرة والشعر وأسلوب الشعر)
 * @param {number} chairHex لون الكرسي
 */
export function makeDoll(spec, idx, chairHex, shared) {
  const G = geos();
  const uSick = uniform(0);
  const uHi = uniform(0);
  const root = new THREE.Group(); // الكرسي والشخصية؛ على الأرض تحت منتصف المقعد، والوجه نحو +z
  root.name = `doll-${idx}`;

  // الكرسي (يبقى مكانه حين تقوم الشخصية)
  const chairMat = (shared.chairMats[chairHex] ||= enamel(chairHex));
  const chair = new THREE.Group();
  chair.add(mesh(G.seat, chairMat, 0, 0.45, 0));
  const back = mesh(G.back, chairMat, 0, 0.68, -0.2);
  back.rotation.x = -0.08;
  chair.add(back);
  for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]]) chair.add(mesh(G.leg, shared.chrome, x, 0.22, z));
  root.add(chair);

  // الشخصية (تتحرك وحدها: تقوم، وتمشي، وتعود)
  const doll = new THREE.Group();
  root.add(doll);
  const skinHex = SKIN[idx % SKIN.length];
  const skinC = color(new THREE.Color(skinHex));
  const skinMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffc4a0), clearcoat: 0.15, clearcoatRoughness: 0.5 });
  skinMat.colorNode = mix(skinC, skinC.mul(vec3(0.93, 0.97, 0.86)).mul(0.92), uSick.mul(0.7));
  skinMat.emissiveNode = rim(uHi);

  // القميص المكسو (الجسم والذراعان)
  const shirt = color(new THREE.Color(spec.color));
  const bodyMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.68, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color(spec.color).lerp(new THREE.Color(0xffffff), 0.4) });
  const vc = vertexColor();
  const sickTint = vec3(0.62, 0.72, 0.5);
  // اللون من الرأس (قميص/رقبة/إسوار) مع تحويل القميص إلى أخضر باهت عند المرض، وبشرة الرقبة تشحب
  bodyMat.colorNode = mix(vc, vc.mul(0.4).add(sickTint.mul(0.55)), uSick.mul(0.75));
  bodyMat.emissiveNode = rim(uHi);
  const geo = bodyGeometry(spec.color, skinHex);
  const body = new THREE.SkinnedMesh(geo, bodyMat);
  body.frustumCulled = false;

  // العظام في وضع الربط (المواضع محلية بالنسبة للأب)
  const bone = (name, x, y, z) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    return b;
  };
  const bn = {};
  bn.hips = bone('hips', 0, B.hips, 0);
  bn.spine = bone('spine', 0, B.spine - B.hips, 0);
  bn.chest = bone('chest', 0, B.chest - B.spine, 0);
  bn.neck = bone('neck', 0, B.neck - B.chest, 0);
  bn.head = bone('head', 0, B.head - B.neck, 0);
  bn.hips.add(bn.spine);
  bn.spine.add(bn.chest);
  bn.chest.add(bn.neck);
  bn.neck.add(bn.head);
  for (const [s, L] of [[-1, 'L'], [1, 'R']]) {
    bn['clav' + L] = bone('clav' + L, s * 0.045, B.shoulderY - B.chest, 0);
    bn['upper' + L] = bone('upper' + L, s * (B.shoulderX - 0.045), 0, 0);
    bn['fore' + L] = bone('fore' + L, 0, -B.upper, 0);
    bn['hand' + L] = bone('hand' + L, 0, -B.fore, 0);
    bn.chest.add(bn['clav' + L]);
    bn['clav' + L].add(bn['upper' + L]);
    bn['upper' + L].add(bn['fore' + L]);
    bn['fore' + L].add(bn['hand' + L]);
  }
  body.add(bn.hips);
  doll.add(body);
  doll.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(BONES.map((n) => bn[n])));

  // الياقة
  const collar = mesh(G.collar, shared.white, 0, B.neck - B.chest - 0.02, 0.008);
  collar.rotation.x = Math.PI / 2 + 0.12;
  collar.scale.set(1.05, 0.9, 1);
  bn.chest.add(collar);

  // اليدان (صلبتان على عظمتي اليد)
  const handL = hand(skinMat, -1);
  const handR = hand(skinMat, 1);
  bn.handL.add(handL);
  bn.handR.add(handR);

  // الرأس والوجه
  const head = new THREE.Group();
  head.position.y = 0.065; // مركز الجمجمة فوق عظمة الرأس
  bn.head.add(head);
  head.add(mesh(G.skull, skinMat));
  for (const s of [-1, 1]) head.add(mesh(G.ear, skinMat, s * 0.163, -0.005, -0.01));
  const hairMat = (shared.hairMats[idx % HAIR.length] ||= new THREE.MeshPhysicalNodeMaterial({ color: HAIR[idx % HAIR.length], roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x8a6040) }));
  const girl = GIRL[idx % GIRL.length];
  const cap = mesh(girl ? G.capLong : G.capShort, hairMat, 0, 0.012, -0.016);
  cap.rotation.x = girl ? -0.82 : -0.7; // خط الشعر فوق الجبين
  head.add(cap);
  // الغرّة: ثلاث كتل كبيرة ناعمة متداخلة تنساب جانبًا (تُقرأ كتلة شعر واحدة لا خرزات)
  const swoop = girl ? [[-0.07, 0.112, 0.118, 0.25], [0.035, 0.122, 0.122, -0.15], [0.115, 0.098, 0.1, -0.5]] : [[-0.08, 0.118, 0.112, 0.35], [0.02, 0.128, 0.118, 0.05], [0.1, 0.112, 0.1, -0.35]];
  for (const [x, y, z, rz] of swoop) {
    const l = mesh(G.lock, hairMat, x, y - 0.004, z - 0.012);
    l.scale.set(1.6, 0.48, 0.8);
    l.rotation.set(-0.5, 0, rz);
    head.add(l);
  }
  if (girl) {
    for (const s of [-1, 1]) {
      const sh = mesh(G.sideHair, hairMat, s * 0.15, -0.05, -0.06);
      sh.rotation.z = s * 0.12;
      head.add(sh);
    }
    if (idx % 4 === 0) {
      const t = mesh(G.tail, hairMat, 0, 0.0, -0.2);
      t.rotation.x = 0.6;
      head.add(t);
    } else head.add(mesh(G.bun, hairMat, 0, 0.12, -0.13));
  }
  // العينان والجفنان والحاجبان
  const lids = [];
  const brows = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.056, 0.012, 0.136);
    eye.add(mesh(G.sclera, shared.sclera));
    const iris = mesh(G.iris, shared.iris, 0, 0, 0.0274);
    const pupil = mesh(G.pupil, shared.pupil, 0, 0, 0.0279);
    const glint = mesh(G.glint, shared.glint, -0.006, 0.007, 0.0284);
    eye.add(iris, pupil, glint);
    const lid = mesh(G.lid, skinMat);
    lid.rotation.x = -0.3;
    eye.add(lid);
    lids.push(lid);
    head.add(eye);
    const brow = mesh(G.brow, shared.brow, s * 0.056, 0.032, 0.142);
    brow.rotation.y = s * 0.25;
    head.add(brow);
    brows.push(brow);
    const ch = mesh(G.cheek, shared.cheek, s * 0.095, -0.035, 0.132);
    ch.rotation.y = s * 0.62;
    head.add(ch);
  }
  const noseMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.45, sheen: 0.4, clearcoat: 0.2 });
  noseMat.colorNode = mix(skinC.mul(0.97), color(0xe0574e), uSick);
  const nose = mesh(G.nose, noseMat, 0, -0.018, 0.165);
  nose.scale.set(1, 0.9, 0.85);
  head.add(nose);
  // الفم: ابتسامة، وداخل فم يظهر حين ينفتح
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.066, 0.15);
  const smile = mesh(G.smile, shared.lip);
  smile.rotation.z = Math.PI;
  const inner = mesh(G.mouthIn, shared.mouthIn, 0, 0, -0.004);
  inner.scale.set(0.9, 0.001, 0.35);
  mouth.add(smile, inner);
  head.add(mouth);

  // الساقان (صلبتان على الورك): جلوس، ووقوف، ومشي
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.08, -0.02, 0.0);
    const thigh = mesh(G.thigh, shared.pants, 0, -0.15, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.3;
    const shin = mesh(G.shin, shared.pants, 0, -0.15, 0);
    const foot = mesh(G.shoe, shared.shoe, 0, -0.3, 0.04);
    knee.add(shin, foot);
    hip.add(thigh, knee);
    bn.hips.add(hip);
    legs.push({ hip, knee, side: s });
  }

  // حلقة الإبراز تحت الكرسي
  const ringMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  ringMat.colorNode = GOLD.mul(2.2);
  ringMat.opacityNode = uHi.mul(sin(time.mul(3.2)).mul(0.25).add(0.75));
  const ring = new THREE.Mesh(G.ring, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  root.add(ring);

  // أيقونة فوق الرأس (تنبيه / ميزان حرارة)
  const iconMat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
  const icon = new THREE.Sprite(iconMat);
  icon.position.set(0, 1.5, 0);
  icon.scale.setScalar(0.001);
  icon.renderOrder = 30;
  doll.add(icon);

  const D = {
    spec, idx, root, doll, chair, body, bones: bn, head, mouth, inner, lids, brows, legs, icon, iconMat, uSick, uHi,
    armL: bn.upperL, armR: bn.upperR, // للتوافق مع الكود القديم
    sick: 0,
    hi: 0,
    poseName: 'rest',
    stand: 0, // 0 جالس، 1 واقف
    walk: 0, // سرعة المشي (تحرّك الساقين)
    mouthWorld() {
      return mouth.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 0.02).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())));
    },
    headWorld() {
      return head.getWorldPosition(new THREE.Vector3());
    },
    handWorld(side = 1) {
      const h = side > 0 ? handR : handL;
      return h.localToWorld(new THREE.Vector3(0, -0.045, 0.01));
    },
    /** المرفق (يحجز الرذاذ) */
    elbowWorld() {
      return bn.foreR.getWorldPosition(new THREE.Vector3());
    },
  };
  D.cur = clonePose(POSES.rest);
  D.target = POSES.rest;
  return D;
}

// ------------------------------------------------------------------ الأوضاع
/**
 * كل وضع: مواضع اليدين hL/hR (وموضع المرفق eR/eL إن لزم) في فضاء الشخصية، وميل الظهر S،
 * ودوران الرأس H، وتقدّم الكتفين C، والوجه: lid (0 مفتوح، 1 مغمض)، mouth (0..1)، brow (−1 عابس .. 1 مرتفع).
 */
const P = (o) => ({
  hL: [-0.13, 0.755, 0.3], hR: [0.13, 0.755, 0.3], eL: null, eR: null, pL: [0, -1, 0], pR: [0, -1, 0], S: 0.08, H: [0, 0, 0], C: [0, 0],
  lid: 0.05, mouth: 0, brow: 0, ...o,
});
export const POSES = {
  rest: P({}), // اليدان على المكتب
  // المرفق أمام الفم والأنف، والرأس ينحني فيه
  elbow: P({ hR: [-0.1, 1.02, 0.17], eR: [0.035, 0.94, 0.27], pR: [-0.3, 0, -1], S: 0.22, H: [0.42, -0.12, 0.05], C: [0, 1], lid: 1, mouth: 0.25, brow: 0.6 }),
  // منديل بكلتا اليدين على الأنف والفم
  tissue: P({ hL: [-0.035, 1.0, 0.215], hR: [0.035, 1.0, 0.215], pL: [0.3, 0, -1], pR: [-0.3, 0, -1], S: 0.16, H: [0.22, 0, 0], C: [0.6, 0.6], lid: 0.95, mouth: 0.2, brow: 0.5 }),
  handUp: P({ hR: [0.24, 1.22, 0.2], pR: [0, 0, 1], H: [0, 0.18, 0], lid: 0.05 }),
  handMouth: P({ hR: [0.03, 1.0, 0.2], pR: [0, 0, -1], S: 0.12, H: [0.15, 0, 0], C: [0, 0.6], lid: 0.9, mouth: 0.2, brow: 0.4 }),
  drink: P({ hR: [0.06, 1.0, 0.18], pR: [-1, 0, 0], H: [-0.32, 0, 0], S: -0.05, lid: 0.55, mouth: 0.15 }),
  wash: P({ hL: [-0.03, 0.9, 0.28], hR: [0.03, 0.9, 0.28], pL: [1, 0, 0], pR: [-1, 0, 0], S: 0.18, H: [0.38, 0, 0], C: [0.3, 0.3] }),
  cheer: P({ hL: [-0.3, 1.38, 0.08], hR: [0.3, 1.38, 0.08], pL: [0, 0, 1], pR: [0, 0, 1], S: -0.06, H: [-0.15, 0, 0], lid: 0.25, mouth: 0.75, brow: 0.8 }),
  // مريض: كتفان متهدّلان، ورأس مائل، وجفون ثقيلة، وحاجبان حزينان
  sick: P({ hL: [-0.12, 0.745, 0.24], hR: [0.12, 0.745, 0.24], S: 0.2, H: [0.36, 0, 0.14], C: [-0.4, -0.4], lid: 0.2, mouth: 0, brow: -0.6 }),
  // شهيق ما قبل العطسة: الرأس للخلف، والفم مفتوح، والحاجبان مرتفعان
  ha: P({ S: -0.1, H: [-0.38, 0, 0], C: [-0.2, -0.2], lid: 0.6, mouth: 0.85, brow: 1 }),
  // لحظة العطسة نفسها (بلا تغطية): اندفاع للأمام، وعينان مغمضتان
  achoo: P({ S: 0.28, H: [0.38, 0, 0], C: [0.4, 0.4], lid: 1, mouth: 0.55, brow: 0.3 }),
  walk: P({ hL: [-0.2, 0.55, 0.05], hR: [0.2, 0.55, 0.05], pL: [1, 0, 0], pR: [-1, 0, 0], S: 0.02, lid: 0.05 }),
};

export function clonePose(p) {
  return {
    hL: new THREE.Vector3(...p.hL), hR: new THREE.Vector3(...p.hR),
    eL: p.eL ? new THREE.Vector3(...p.eL) : null, eR: p.eR ? new THREE.Vector3(...p.eR) : null,
    eLk: p.eL ? 1 : 0, eRk: p.eR ? 1 : 0,
    pL: new THREE.Vector3(...p.pL).normalize(), pR: new THREE.Vector3(...p.pR).normalize(),
    S: p.S, H: [...p.H], C: [...p.C], lid: p.lid, mouth: p.mouth, brow: p.brow,
  };
}

// ------------------------------------------------------------------ IK من عظمتين
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

/** يوجّه عظمة (اتجاهها الأصلي −y) نحو اتجاه عالمي dir */
function aim(bone, dir) {
  bone.parent.getWorldQuaternion(_q2);
  _q.setFromUnitVectors(DOWN, dir.clone().normalize());
  bone.quaternion.copy(_q2.invert().multiply(_q));
  bone.updateMatrixWorld(true);
}

/**
 * ذراع: الكتف S، والهدف H، ومرفق مطلوب E (اختياري، بوزن ek)، وقطب يحدّد جهة انثناء المرفق.
 * كل المتجهات عالمية.
 */
function solveArm(upper, fore, H, Eopt, ek, pole) {
  const S = upper.getWorldPosition(new THREE.Vector3());
  const a = B.upper;
  const b = B.fore;
  let E;
  const toH = H.clone().sub(S);
  const c = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, toH.length()));
  const d = toH.normalize();
  const ca = (a * a + c * c - b * b) / (2 * a * c);
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const n = pole.clone().sub(S);
  n.sub(d.clone().multiplyScalar(n.dot(d))).normalize();
  E = S.clone().addScaledVector(d, a * ca).addScaledVector(n, a * sa);
  if (Eopt && ek > 0) {
    // مرفق موجّه: العضد نحو المرفق المطلوب (بطول ثابت)، ثم الساعد نحو اليد
    const E2 = S.clone().add(Eopt.clone().sub(S).normalize().multiplyScalar(a));
    E.lerp(E2, ek);
  }
  aim(upper, E.clone().sub(S));
  const Ew = fore.getWorldPosition(new THREE.Vector3());
  aim(fore, H.clone().sub(Ew));
}

const _m = new THREE.Matrix4();
function orientHand(hb, fore, doll, palmLocal) {
  const f = new THREE.Vector3(0, -1, 0).applyQuaternion(fore.getWorldQuaternion(new THREE.Quaternion())); // اتجاه الأصابع
  // باطن الكف هو −z المحلي (الأصابع تنثني نحوه)، فظهر الكف +z عكس الاتجاه المطلوب
  const pn = palmLocal.clone().negate().transformDirection(doll.matrixWorld);
  pn.sub(f.clone().multiplyScalar(pn.dot(f)));
  if (pn.lengthSq() < 1e-4) return;
  pn.normalize();
  const y = f.clone().negate();
  const x = new THREE.Vector3().crossVectors(y, pn).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  _m.makeBasis(x, y, z);
  const qw = new THREE.Quaternion().setFromRotationMatrix(_m);
  // انحناء خفيف للرسغ نحو باطن الكف
  qw.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.12));
  hb.quaternion.copy(fore.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qw));
  hb.updateMatrixWorld(true);
}

/**
 * يطبّق الوضع على الشخصية كل إطار: تنعيم نحو الهدف، ثم العمود الفقري والرأس والوجه والساقان، ثم IK للذراعين.
 * @param {object} D الشخصية
 * @param {number} dt الثواني منذ الإطار السابق
 * @param {number} t الزمن
 */
export function applyPose(D, dt, t) {
  const T = D.target;
  const C = D.cur;
  const a = 1 - Math.exp(-dt * 9);
  const af = 1 - Math.exp(-dt * 14); // الوجه أسرع
  C.hL.lerp(_v.set(...T.hL), a);
  C.hR.lerp(_v.set(...T.hR), a);
  C.pL.lerp(_v.set(...T.pL).normalize(), a).normalize();
  C.pR.lerp(_v.set(...T.pR).normalize(), a).normalize();
  for (const k of ['L', 'R']) {
    const te = T['e' + k];
    if (te) {
      if (!C['e' + k]) C['e' + k] = new THREE.Vector3(...te);
      C['e' + k].lerp(_v.set(...te), a);
    }
    C['e' + k + 'k'] += ((te ? 1 : 0) - C['e' + k + 'k']) * a;
  }
  C.S += (T.S - C.S) * a;
  for (let i = 0; i < 3; i++) C.H[i] += (T.H[i] - C.H[i]) * a;
  for (let i = 0; i < 2; i++) C.C[i] += (T.C[i] - C.C[i]) * a;
  C.lid += (T.lid - C.lid) * af;
  C.mouth += (T.mouth - C.mouth) * af;
  C.brow += (T.brow - C.brow) * af;

  const bn = D.bones;
  // تنفّس دائم (أسرع وأعمق قبل العطسة)، ورمش كل بضع ثوانٍ
  const br = D.breath ? 0.5 + 0.5 * Math.sin(t * 4.2 + D.idx) : 0.5 + 0.5 * Math.sin(t * 1.6 + D.idx * 1.7);
  const breathAmp = D.breath ? 0.09 : 0.018;
  bn.spine.rotation.x = C.S * 0.45;
  bn.chest.rotation.x = C.S * 0.55 - br * breathAmp;
  bn.chest.scale.setScalar(1 + br * (D.breath ? 0.025 : 0.008));
  bn.neck.rotation.set(C.H[0] * 0.35, C.H[1] * 0.3, C.H[2] * 0.3);
  const sway = Math.sin(t * 0.7 + D.idx) * 0.05;
  bn.head.rotation.set(C.H[0] * 0.65 + Math.sin(t * 1.3 + D.idx * 2) * 0.02 - (D.breath ? br * 0.14 : 0), C.H[1] * 0.7 + sway, C.H[2] * 0.7);
  // تقدّم الكتفين (الترقوة) للأمام/الخلف
  bn.clavL.rotation.y = C.C[0] * 0.35;
  bn.clavR.rotation.y = -C.C[1] * 0.35;
  bn.clavL.rotation.z = -C.C[0] * 0.08;
  bn.clavR.rotation.z = C.C[1] * 0.08;

  // الوجه: الجفن (يدور فيغطي العين)، والرمش، والفم، والحاجبان
  const blink = (t + D.idx * 1.37) % 4.3 < 0.12 ? 1 : 0;
  const lid = Math.min(1, Math.max(C.lid + D.uSick.value * 0.12, blink * 0.95));
  // الجفن نصف كرة يدور حول محور العين: −0.3 مفتوح (يغطي حافة العين العليا فقط)، 1.55 مغمض
  for (const L of D.lids) L.rotation.x = -0.3 + lid * 1.85;
  const mo = C.mouth;
  D.inner.scale.set(0.9 + mo * 0.2, Math.max(0.001, mo * 1.1), 0.35);
  D.mouth.children[0].scale.set(1, 1 - mo * 0.6, 1);
  D.brows.forEach((b, i) => {
    const s = i === 0 ? -1 : 1;
    b.position.y = 0.032 + C.brow * 0.008;
    b.rotation.z = s * C.brow * 0.18;
  });

  // الساقان: جلوس ← وقوف، ومشي بتأرجح
  D.stand += ((D.standT ?? 0) - D.stand) * (1 - Math.exp(-dt * 6));
  const st = D.stand;
  bn.hips.position.y = B.hips + st * 0.12;
  const ph = t * 7.5;
  for (const L of D.legs) {
    const swing = D.walk * Math.sin(ph + (L.side > 0 ? 0 : Math.PI)) * 0.45;
    L.hip.rotation.x = -Math.PI / 2 * (1 - st) + swing * st;
    L.knee.rotation.x = Math.PI / 2 * (1 - st) + Math.max(0, -swing) * 0.8 * st;
  }

  // IK للذراعين (في فضاء العالم)
  D.doll.updateMatrixWorld(true);
  const w = (v) => D.doll.localToWorld(v.clone());
  for (const [k, s] of [['L', -1], ['R', 1]]) {
    let h = C['h' + k];
    if (D.walk > 0.01 && T === POSES.walk) {
      // تأرجح اليدين أثناء المشي
      h = h.clone().add(_v.set(0, 0, Math.sin(ph + (s > 0 ? Math.PI : 0)) * 0.08 * D.walk));
    }
    const pole = w(new THREE.Vector3(s * 0.45, 0.6, -0.35));
    solveArm(bn['upper' + k], bn['fore' + k], w(h), C['e' + k] ? w(C['e' + k]) : null, C['e' + k + 'k'], pole);
    // الكف: الأصابع تكمل اتجاه الساعد، وباطن الكف (+z المحلي) نحو الاتجاه المطلوب
    orientHand(bn['hand' + k], bn['fore' + k], D.doll, C['p' + k]);
  }
}
