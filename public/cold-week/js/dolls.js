// ---------------------------------------------------------------------------
// الزملاء: دُمى خشبية لامعة بلا ملامح شخصية (رأس خشبي، وجسم مينا ملوّن، وذراعان)
// جالسة على كراسي مدرسية. لا تمثّل أطفالًا حقيقيين.
//
// كل دمية لها:
//   uSick  من 0 (سليمة) إلى 1 (مريضة): يتحوّل لون الجسم إلى أخضر باهت، ويشحب الرأس، ويحمرّ الأنف،
//          ويميل الرأس للأمام، ويظهر ميزان حرارة فوقها — فلا يعتمد المعنى على اللون وحده.
//   uHi    إبراز صاحبة الموقف: ضوء حافة ذهبي ينبض (fresnel) وحلقة ذهبية تحت الكرسي.
// الأوضاع (pose) تُحرَّك بنعومة من scene3d.js: يد على المكتب، تغطية بالمرفق، منديل، يد مرفوعة، شرب، هتاف.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { abs, color, dot, mix, normalView, oneMinus, positionViewDirection, sin, time, uniform, vec3 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { enamel, chrome } from './materials.js';

const SKIN = [0xf1cfa6, 0xe2b48a, 0xc99872, 0xeac29a, 0xd6a77c, 0xb98b66];
const HAIR = [0x3b2a20, 0x24170f, 0x4a3324, 0x2e2018, 0x3b2a20, 0x1f1611];
const GOLD = vec3(1.0, 0.72, 0.25);

/** ضوء الحافة الذهبي للإبراز */
function rim(uHi) {
  const f = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.4);
  const pulse = sin(time.mul(3.2)).mul(0.25).add(0.75);
  return GOLD.mul(f.mul(uHi).mul(pulse).mul(2.4));
}

const GEO = {};
function geos() {
  if (GEO.body) return GEO;
  // جسم الدمية: منحنى دوراني (قاعدة عريضة، خصر، كتفان مستديران)
  const prof = [[0.0, 0.47], [0.13, 0.475], [0.185, 0.52], [0.19, 0.6], [0.17, 0.72], [0.145, 0.8], [0.11, 0.86], [0.06, 0.895], [0.0, 0.905]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  GEO.body = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(40), 48);
  GEO.head = new THREE.SphereGeometry(0.165, 48, 32);
  GEO.hair = new THREE.SphereGeometry(0.172, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
  GEO.eye = new THREE.SphereGeometry(0.022, 16, 12);
  GEO.cheek = new THREE.CircleGeometry(0.03, 24);
  GEO.nose = new THREE.SphereGeometry(0.02, 16, 12);
  GEO.mouth = new THREE.TorusGeometry(0.026, 0.0055, 8, 24, Math.PI);
  GEO.arm = new THREE.CapsuleGeometry(0.048, 0.24, 6, 16);
  GEO.hand = new THREE.SphereGeometry(0.058, 24, 16);
  GEO.collar = new THREE.TorusGeometry(0.075, 0.018, 12, 32);
  GEO.seat = new RoundedBoxGeometry(0.44, 0.06, 0.4, 3, 0.025);
  GEO.back = new RoundedBoxGeometry(0.44, 0.34, 0.05, 3, 0.02);
  GEO.leg = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 12);
  GEO.ring = new THREE.TorusGeometry(0.34, 0.018, 12, 64);
  for (const g of Object.values(GEO)) g.userData.shared = true; // مشتركة بين كل البناءات: لا تُحرَّر
  return GEO;
}

/**
 * @param {{name:string,color:string}} spec
 * @param {number} idx  رقم المقعد (لاختيار لون البشرة والشعر)
 * @param {number} chairHex لون الكرسي
 */
export function makeDoll(spec, idx, chairHex, shared) {
  const G = geos();
  const uSick = uniform(0);
  const uHi = uniform(0);
  const root = new THREE.Group(); // على الأرض تحت منتصف المقعد، الوجه نحو +z
  root.name = `doll-${idx}`;

  // الكرسي
  const chairMat = shared.chairMats[chairHex] ||= enamel(chairHex);
  const seat = new THREE.Mesh(G.seat, chairMat);
  seat.position.set(0, 0.45, 0);
  const back = new THREE.Mesh(G.back, chairMat);
  back.position.set(0, 0.68, -0.2);
  back.rotation.x = -0.08;
  root.add(seat, back);
  for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]]) {
    const l = new THREE.Mesh(G.leg, shared.chrome);
    l.position.set(x, 0.22, z);
    root.add(l);
  }

  // الجسم (المينا تتحوّل إلى أخضر باهت مع المرض)
  const doll = new THREE.Group(); // كل ما يتحرك مع الدمية (ينزلق، يقفز…)
  root.add(doll);
  const bodyMat = enamel(new THREE.Color(spec.color).getHex());
  const base = color(new THREE.Color(spec.color));
  const sickTone = vec3(0.62, 0.72, 0.5);
  bodyMat.colorNode = mix(base, base.mul(0.35).add(sickTone.mul(0.6)), uSick);
  bodyMat.emissiveNode = rim(uHi);
  const body = new THREE.Mesh(G.body, bodyMat);
  const collar = new THREE.Mesh(G.collar, shared.white);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.885;

  // الرأس (خشب لامع)
  const head = new THREE.Group();
  head.position.set(0, 1.055, 0);
  const skinMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 0.4, sheenRoughness: 0.6 });
  const skin = color(new THREE.Color(SKIN[idx % SKIN.length]));
  skinMat.colorNode = mix(skin, skin.mul(vec3(0.92, 0.98, 0.84)).mul(0.92), uSick.mul(0.7));
  skinMat.emissiveNode = rim(uHi);
  const skull = new THREE.Mesh(G.head, skinMat);
  const hairMat = shared.hairMats[idx % HAIR.length] ||= new THREE.MeshPhysicalNodeMaterial({ color: HAIR[idx % HAIR.length], roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const hair = new THREE.Mesh(G.hair, hairMat);
  hair.rotation.x = -0.35;
  hair.position.set(0, 0.012, -0.012);
  const eyeL = new THREE.Mesh(G.eye, shared.eye);
  const eyeR = new THREE.Mesh(G.eye, shared.eye);
  eyeL.position.set(-0.056, 0.02, 0.152);
  eyeR.position.set(0.056, 0.02, 0.152);
  const cheekL = new THREE.Mesh(G.cheek, shared.cheek);
  const cheekR = new THREE.Mesh(G.cheek, shared.cheek);
  cheekL.position.set(-0.092, -0.028, 0.136);
  cheekR.position.set(0.092, -0.028, 0.136);
  cheekL.rotation.y = -0.6;
  cheekR.rotation.y = 0.6;
  const noseMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.35, clearcoat: 0.6 });
  noseMat.colorNode = mix(skin.mul(0.95), color(0xe0574e), uSick);
  const nose = new THREE.Mesh(G.nose, noseMat);
  nose.position.set(0, -0.012, 0.165);
  const mouth = new THREE.Mesh(G.mouth, shared.mouth);
  mouth.position.set(0, -0.055, 0.157);
  mouth.rotation.z = Math.PI; // ابتسامة
  head.add(skull, hair, eyeL, eyeR, cheekL, cheekR, nose, mouth);

  // الذراعان: مفصل عند الكتف، والذراع تتدلّى للأسفل في وضعها المحلي
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.165, 0.83, 0.0);
    const a = new THREE.Mesh(G.arm, bodyMat);
    a.position.y = -0.17;
    const h = new THREE.Mesh(G.hand, skinMat);
    h.position.y = -0.33;
    pivot.add(a, h);
    pivot.userData.hand = h;
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);
  doll.add(body, collar, head, armL, armR);

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
  icon.position.set(0, 1.42, 0);
  icon.scale.setScalar(0.001);
  icon.renderOrder = 30;
  doll.add(icon);

  const D = {
    spec, idx, root, doll, head, armL, armR, mouth, eyeL, eyeR, icon, iconMat, uSick, uHi,
    sick: 0, // القيمة المستهدفة (يحرّكها المشهد بنعومة)
    hi: 0,
    poseName: 'rest',
    /** موضع الفم في العالم (لبداية الرذاذ) */
    mouthWorld() {
      return mouth.getWorldPosition(new THREE.Vector3());
    },
    headWorld() {
      return skull.getWorldPosition(new THREE.Vector3());
    },
    handWorld(side = 1) {
      return (side > 0 ? armR : armL).userData.hand.getWorldPosition(new THREE.Vector3());
    },
    /** منتصف الذراع اليمنى (موضع «المرفق» الذي يحجز الرذاذ) */
    elbowWorld() {
      const p = new THREE.Vector3(0, -0.12, 0);
      armR.updateMatrixWorld(true);
      return armR.localToWorld(p);
    },
  };
  return D;
}

/** المواد المشتركة بين الدمى */
export function dollShared() {
  return {
    chairMats: {},
    hairMats: {},
    chrome: chrome(),
    white: enamel(0xffffff),
    eye: new THREE.MeshPhysicalNodeMaterial({ color: 0x1a1210, roughness: 0.15, clearcoat: 1 }),
    cheek: new THREE.MeshBasicNodeMaterial({ color: 0xf08a8a, transparent: true, opacity: 0.55, depthWrite: false }),
    mouth: new THREE.MeshPhysicalNodeMaterial({ color: 0x4a1a14, roughness: 0.4 }),
  };
}

/**
 * زوايا الأوضاع: [كتف أيسر (x,y,z), كتف أيمن (x,y,z), رأس (x,y,z)] بالراديان.
 * الذراع في وضعها المحلي تتدلّى للأسفل؛ x السالبة ترفعها للأمام.
 */
export const POSES = {
  rest: { L: [-1.21, 0, -0.05], R: [-1.21, 0, 0.05], H: [0, 0, 0] }, // اليدان على المكتب
  elbow: { L: [-1.21, 0, -0.05], R: [-2.3, 0, -0.76], H: [0.1, -0.2, 0] }, // الذراع اليمنى أمام الفم
  tissue: { L: [-2.39, 0, 0.52], R: [-2.39, 0, -0.52], H: [0.08, 0, 0] }, // اليدان بالمنديل أمام الأنف
  handUp: { L: [-1.21, 0, -0.05], R: [-2.99, 0, 0.1], H: [0, 0.15, 0] }, // يد مرفوعة (عليها جراثيم)
  handMouth: { L: [-1.21, 0, -0.05], R: [-2.39, 0, -0.52], H: [0.05, 0, 0] }, // يد أمام الفم (عطس في اليد)
  drink: { L: [-1.21, 0, -0.05], R: [-2.3, 0, -0.45], H: [-0.22, 0, 0] },
  wash: { L: [-1.25, 0, 0.3], R: [-1.25, 0, -0.3], H: [0.32, 0, 0] },
  cheer: { L: [-3.03, 0, -0.41], R: [-3.03, 0, 0.41], H: [-0.15, 0, 0] },
  sick: { L: [-0.95, 0, -0.15], R: [-0.95, 0, 0.15], H: [0.38, 0, 0.12] },
  ha: { L: [-1.21, 0, -0.05], R: [-1.21, 0, 0.05], H: [-0.32, 0, 0] }, // شهيق ما قبل العطسة
};
