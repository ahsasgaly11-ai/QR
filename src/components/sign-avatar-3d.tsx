'use client';

import { useEffect, useRef, useState } from 'react';
import type * as T from 'three';
import {
  FACE_INDEX,
  HAND_BONES,
  RIG,
  mixState,
  prepareMotion,
  restState,
  solveArm,
  add,
  sub,
  mul,
  norm,
  cross,
  len,
  type AvatarState,
  type Motion,
  type PoseFileAny,
  type V3,
} from '@/lib/sign-motion';

// ---------------------------------------------------------------------------
// المترجم ثلاثي الأبعاد: شخصية قطرية (ثوب وغترة وعقال) يحرّكها بنك الحركات
// المستخلص من مقاطع القاموس الموثّقة (sign-motion.ts يعيد استهدافها).
//
// - تبقى الشخصية مُركَّبة طوال التشغيل وتنتقل بين الإشارات انتقالًا سلسًا
//   (لا وميض ولا إعادة تهيئة WebGL لكل كلمة).
// - تعابير الوجه (الحاجبان، العينان، الفم، الخدّان) من بيانات المؤدّي —
//   وهي جزء من قواعد لغة الإشارة لا زينة.
// - في السكون: تنفّس ورمش وحركة رأس خفيفة.
// - three.js يُحمَّل عند الحاجة فقط (لا يُثقل الصفحات الأخرى).
// ---------------------------------------------------------------------------

const motionCache = new Map<string, Promise<Motion | null>>();
function loadMotion(src: string): Promise<Motion | null> {
  if (!motionCache.has(src)) {
    motionCache.set(
      src,
      fetch(src, { cache: 'force-cache' })
        .then((r) => (r.ok ? (r.json() as Promise<PoseFileAny>) : null))
        .then((j) => (j ? prepareMotion(j) : null))
        .catch(() => null)
    );
  }
  return motionCache.get(src)!;
}

/** هل يدعم المتصفّح WebGL؟ */
export function canUseWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const COLORS = {
  skin: 0xc98f6b,
  skinShade: 0xb57a58,
  thobe: 0xf7f6f2,
  ghutra: 0xffffff,
  egal: 0x141414,
  hair: 0x22170f,
  lips: 0x8e4a40,
  mouth: 0x3a1010,
  teeth: 0xf2efe8,
  iris: 0x3b2516,
  eyeWhite: 0xf8f6f2,
};

const HEAD_SCALE = 1.18;
const TRANSITION = 0.2; // ثانية: انتقال بين إشارتين
const SETTLE_DELAY = 0.7; // بعد آخر إشارة قبل العودة للراحة
const SETTLE = 0.55;

interface Engine {
  play: (m: Motion, onEnd: () => void) => void;
  setPaused: (p: boolean) => void;
  dispose: () => void;
}

async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 10);
  camera.position.set(0, 1.47, 2.35);
  camera.lookAt(0, 1.39, 0);

  // إضاءة استوديو: رئيسية دافئة، تعبئة، وحافّة ذهبية بهوية المنصّة
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4d0a20, 0.55));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
  key.position.set(0.9, 2.4, 2.2);
  key.target.position.set(0, 1.3, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -0.6;
  key.shadow.camera.right = 0.6;
  key.shadow.camera.top = 0.6;
  key.shadow.camera.bottom = -0.6;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.6);
  fill.position.set(-1.6, 1.6, 1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe2b85a, 1.6);
  rim.position.set(-0.6, 2.2, -1.8);
  scene.add(rim);

  // ---- المواد ----
  const mat = (color: number, rough = 0.8, extra: Partial<T.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const skin = mat(COLORS.skin, 0.55);
  const thobe = mat(COLORS.thobe, 0.92);
  const ghutra = mat(COLORS.ghutra, 0.88, { side: THREE.DoubleSide });
  const egal = mat(COLORS.egal, 0.45);
  const hair = mat(COLORS.hair, 0.9);
  const lips = mat(COLORS.lips, 0.6, { side: THREE.DoubleSide });
  const mouthIn = mat(COLORS.mouth, 0.9, { side: THREE.DoubleSide });
  const eyeWhite = mat(COLORS.eyeWhite, 0.25);
  const iris = mat(COLORS.iris, 0.2);

  const disposables: { dispose: () => void }[] = [envTex, pmrem];
  const track = <G extends { dispose: () => void }>(g: G) => (disposables.push(g), g);
  const mesh = (g: T.BufferGeometry, m: T.Material, shadow = true) => {
    const x = new THREE.Mesh(track(g), m);
    x.castShadow = shadow;
    x.receiveShadow = true;
    return x;
  };

  const root = new THREE.Group();
  scene.add(root);

  // ---- الجذع (ثوب) ----
  const torso = new THREE.Group(); // محوره عند الورك
  torso.position.set(0, RIG.hipY, 0);
  root.add(torso);
  const ty = (y: number) => y - RIG.hipY;
  const prof = [
    [0.0, 1.575],
    [0.058, 1.572],
    [0.075, 1.548],
    [0.165, 1.515],
    [0.222, 1.478],
    [0.243, 1.43],
    [0.236, 1.3],
    [0.214, 1.15],
    [0.214, 0.95],
    [0.226, 0.6],
  ].map(([r, y]) => new THREE.Vector2(r, ty(y)));
  const body = mesh(new THREE.LatheGeometry(prof.reverse(), 48), thobe);
  body.scale.z = RIG.torsoR[1] / 0.243;
  torso.add(body);
  // الياقة والزرّ والطربوشة (الشرّابة القطرية)
  const collar = mesh(new THREE.TorusGeometry(0.06, 0.008, 10, 32), thobe);
  collar.rotation.x = Math.PI / 2 - 0.25;
  collar.position.set(0, ty(1.566), 0.012);
  collar.scale.set(1, 0.95, 1);
  torso.add(collar);
  const placket = mesh(new THREE.BoxGeometry(0.018, 0.16, 0.004), mat(0xecebe6, 0.9));
  placket.position.set(0, ty(1.48), 0.136);
  placket.rotation.x = -0.18;
  torso.add(placket);
  const cord = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.15, 6), thobe);
  cord.position.set(0.012, ty(1.47), 0.142);
  cord.rotation.x = -0.12;
  torso.add(cord);
  const tassel = mesh(new THREE.ConeGeometry(0.009, 0.035, 10), thobe);
  tassel.position.set(0.012, ty(1.385), 0.152);
  torso.add(tassel);

  // الرقبة
  const neck = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 20), skin);
  neck.position.set(0, ty(1.57), 0);
  torso.add(neck);

  // ---- الرأس ----
  const headPivot = new THREE.Group(); // محور الرأس عند أعلى الرقبة
  headPivot.position.set(0, ty(1.56), 0);
  torso.add(headPivot);
  const head = new THREE.Group();
  head.position.set(0, RIG.headCenter[1] - 1.56, RIG.headCenter[2]);
  // رأس أكبر قليلًا من الواقع: وضوح الوجه والفم للقارئ الأصمّ
  head.scale.setScalar(HEAD_SCALE);
  headPivot.add(head);
  const [hx, hy, hz] = RIG.headR.map((v) => v / HEAD_SCALE);
  const skull = mesh(new THREE.SphereGeometry(1, 48, 36), skin);
  skull.scale.set(hx, hy, hz);
  head.add(skull);
  // الفكّ: يضيّق أسفل الوجه
  const jaw = mesh(new THREE.SphereGeometry(1, 32, 24), skin);
  jaw.scale.set(hx * 0.8, hy * 0.55, hz * 0.75);
  jaw.position.set(0, -0.052, 0.012);
  head.add(jaw);
  // الأنف
  const nose = mesh(new THREE.SphereGeometry(1, 20, 16), skin);
  nose.scale.set(0.014, 0.024, 0.016);
  nose.position.set(0, -0.005, hz - 0.003);
  nose.rotation.x = 0.2;
  head.add(nose);
  // الأذنان (تظهران قليلًا تحت الغترة)
  // الخدّان (للنفخ)
  const cheeks = [-1, 1].map((s) => {
    const c = mesh(new THREE.SphereGeometry(1, 20, 16), skin, false);
    c.scale.set(0.024, 0.022, 0.02);
    c.position.set(s * 0.05, -0.03, hz * 0.55);
    head.add(c);
    return c;
  });

  // العينان: بياض + قزحية + جفن علوي (يتحرّك للرمش)
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.034, 0.016, hz * 0.875);
    head.add(g);
    const white = mesh(new THREE.SphereGeometry(0.0135, 24, 16), eyeWhite, false);
    white.scale.z = 0.6;
    g.add(white);
    const ir = mesh(new THREE.SphereGeometry(0.0074, 20, 14), iris, false);
    ir.position.z = 0.0068;
    ir.scale.z = 0.4;
    g.add(ir);
    const lid = mesh(new THREE.SphereGeometry(0.0146, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, false);
    lid.scale.z = 0.66;
    g.add(lid);
    // الرموش على حافّة الجفن فتتبعه
    const lash = mesh(new THREE.TorusGeometry(0.0146, 0.0013, 6, 20, Math.PI), hair, false);
    lash.rotation.x = Math.PI / 2;
    lid.add(lash);
    return { g, lid, lash, ir };
  });
  // الحاجبان
  const brows = [-1, 1].map((s) => {
    const b = mesh(new THREE.CapsuleGeometry(0.0042, 0.026, 4, 8), hair, false);
    b.rotation.z = Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(s * 0.035, 0.044, hz * 0.88);
    g.add(b);
    head.add(g);
    return g;
  });
  // اللحية المشذّبة والشارب
  // اللحية: قشرة على الفكّ والذقن أسفل الشفة السفلى، وعارضان على الجانبين
  const beard = mesh(
    new THREE.SphereGeometry(1, 40, 24, Math.PI * 0.04, Math.PI * 0.92, Math.PI * 0.67, Math.PI * 0.27),
    hair,
    false
  );
  beard.scale.set(hx * 1.035, hy * 1.02, hz * 1.035);
  head.add(beard);
  for (const s of [-1, 1]) {
    const side = mesh(
      new THREE.SphereGeometry(1, 16, 16, s > 0 ? Math.PI * 0.04 : Math.PI * 0.78, Math.PI * 0.18, Math.PI * 0.5, Math.PI * 0.2),
      hair,
      false
    );
    side.scale.set(hx * 1.03, hy * 1.02, hz * 1.03);
    head.add(side);
  }
  const moustache = mesh(new THREE.CapsuleGeometry(0.0045, 0.036, 4, 8), hair, false);
  moustache.rotation.z = Math.PI / 2;
  moustache.position.set(0, -0.034, hz * 0.975);
  moustache.rotation.x = -0.15;
  head.add(moustache);

  // الفم: هندسة ثابتة البنية تُحدَّث رؤوسها كل إطار (فتح، ابتسام، زمّ)
  const MN = 14; // نقاط كل شفة
  const mouthGeo = new THREE.BufferGeometry();
  const mouthPos = new Float32Array((MN * 2 + 1) * 3);
  mouthGeo.setAttribute('position', new THREE.BufferAttribute(mouthPos, 3));
  const mIdx: number[] = [];
  for (let i = 0; i < MN * 2; i++) mIdx.push(MN * 2, i, (i + 1) % (MN * 2));
  mouthGeo.setIndex(mIdx);
  const mouthMesh = new THREE.Mesh(track(mouthGeo), mouthIn);
  const lipGeo = new THREE.BufferGeometry();
  const lipPos = new Float32Array(MN * 2 * 2 * 3);
  lipGeo.setAttribute('position', new THREE.BufferAttribute(lipPos, 3));
  const lIdx: number[] = [];
  for (let i = 0; i < MN * 2; i++) {
    const a = i,
      b = (i + 1) % (MN * 2);
    const A = MN * 2 + a,
      B = MN * 2 + b;
    lIdx.push(a, b, A, b, B, A);
  }
  lipGeo.setIndex(lIdx);
  const lipMesh = new THREE.Mesh(track(lipGeo), lips);
  const mouthG = new THREE.Group();
  mouthG.position.set(0, -0.05, hz * 0.925);
  mouthG.add(mouthMesh, lipMesh);
  head.add(mouthG);

  // ---- الغترة والعقال ----
  const gTop = mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.36), ghutra);
  gTop.scale.set(hx * 1.13, hy * 1.08, hz * 1.12);
  gTop.position.set(0, 0.006, -0.004);
  head.add(gTop);
  // الجانبان والخلف مع فتحة الوجه
  const open = 0.95;
  const gSide = mesh(
    new THREE.SphereGeometry(1, 48, 20, Math.PI / 2 + open, Math.PI * 2 - open * 2, Math.PI * 0.3, Math.PI * 0.42),
    ghutra
  );
  gSide.scale.copy(gTop.scale);
  gSide.position.copy(gTop.position);
  head.add(gSide);
  // الطيّات المنسدلة على الكتفين
  const drape = mesh(
    new THREE.CylinderGeometry(hx * 1.12, 0.165, 0.17, 48, 6, true, open * 0.95, Math.PI * 2 - open * 1.9),
    ghutra
  );
  drape.position.set(0, -0.11, -0.008);
  drape.scale.z = 0.8;
  head.add(drape);
  // العقال: حلقتان سوداوان وذيلان خلفيّان
  for (let i = 0; i < 2; i++) {
    const r = mesh(new THREE.TorusGeometry(hx * 1.04, 0.0085, 10, 48), egal);
    r.rotation.x = Math.PI / 2 - 0.22;
    r.scale.set(1, (hz * 1.1) / hx, 1);
    r.position.set(0, 0.085 + i * 0.016, -0.004);
    head.add(r);
  }
  for (const s of [-1, 1]) {
    const tail = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), egal);
    tail.position.set(s * 0.02, -0.02, -hz * 1.16);
    tail.rotation.x = 0.12;
    head.add(tail);
    const t2 = mesh(new THREE.SphereGeometry(0.008, 10, 8), egal);
    t2.position.set(s * 0.02, -0.12, -hz * 1.17 - 0.01);
    t2.scale.y = 1.6;
    head.add(t2);
  }

  // ---- الذراعان: كمّان من الثوب ----
  const up = new THREE.Vector3(0, 1, 0);
  const tmpV = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const place = (m: T.Object3D, a: V3, b: V3) => {
    tmpA.set(a[0], a[1], a[2]);
    tmpB.set(b[0], b[1], b[2]);
    tmpV.subVectors(tmpB, tmpA);
    const l = tmpV.length() || 1e-6;
    m.position.copy(tmpA).addScaledVector(tmpV, 0.5);
    m.quaternion.setFromUnitVectors(up, tmpV.divideScalar(l));
    m.scale.set(1, l, 1);
  };
  const arms = [1, -1].map(() => {
    const upper = mesh(new THREE.CylinderGeometry(0.047, 0.055, 1, 20, 1, true), thobe);
    const fore = mesh(new THREE.CylinderGeometry(0.039, 0.047, 1, 20, 1, true), thobe);
    const shoulder = mesh(new THREE.SphereGeometry(0.047, 20, 16), thobe);
    const elbow = mesh(new THREE.SphereGeometry(0.047, 16, 12), thobe);
    const cuff = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 20), thobe);
    const wrist = mesh(new THREE.SphereGeometry(0.024, 14, 10), skin);
    root.add(upper, fore, shoulder, elbow, cuff, wrist);
    return { upper, fore, shoulder, elbow, cuff, wrist };
  });

  // ---- اليدان: كفّ بيضاوي وأصابع (instanced) ----
  const SEG = HAND_BONES.length;
  const fingerGeo = track(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true));
  const jointGeo = track(new THREE.SphereGeometry(1, 12, 10));
  const fingers = new THREE.InstancedMesh(fingerGeo, skin, SEG * 2);
  const joints = new THREE.InstancedMesh(jointGeo, skin, 21 * 2);
  fingers.castShadow = joints.castShadow = true;
  fingers.receiveShadow = joints.receiveShadow = true;
  fingers.frustumCulled = joints.frustumCulled = false;
  root.add(fingers, joints);
  const palms = [0, 1].map(() => {
    const p = mesh(new THREE.SphereGeometry(1, 24, 16), skin);
    root.add(p);
    return p;
  });
  // نصف قطر كل عظمة/مفصل (الإبهام أعرض، الخنصر أنحف)
  const boneR = (bi: number) => {
    const finger = Math.floor(bi / 4),
      seg = bi % 4;
    if (seg === 0) return finger === 0 ? 0.0155 : 0; // عظام المشط داخل الكفّ
    const base = [0.0122, 0.011, 0.0112, 0.0105, 0.0094][finger];
    return base * (1 - (seg - 1) * 0.08);
  };
  const jointR = (j: number) => {
    if (j === 0) return 0.0;
    const finger = Math.floor((j - 1) / 4),
      seg = (j - 1) % 4;
    const base = [0.0122, 0.011, 0.0112, 0.0105, 0.0094][finger];
    return base * (1 - Math.max(0, seg - 1) * 0.08);
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const drawHand = (hi: number, wrist: V3, rel: V3[]) => {
    const abs = rel.map((p) => add(wrist, p));
    HAND_BONES.forEach(([a, b], bi) => {
      const r = boneR(bi);
      if (!r) {
        fingers.setMatrixAt(hi * SEG + bi, zero);
        return;
      }
      tmpA.set(...abs[a]);
      tmpB.set(...abs[b]);
      tmpV.subVectors(tmpB, tmpA);
      const l = tmpV.length() || 1e-6;
      pos.copy(tmpA).addScaledVector(tmpV, 0.5);
      q.setFromUnitVectors(up, tmpV.divideScalar(l));
      sc.set(r, l, r);
      m4.compose(pos, q, sc);
      fingers.setMatrixAt(hi * SEG + bi, m4);
    });
    for (let j = 0; j < 21; j++) {
      const r = jointR(j);
      if (!r || (j % 4 === 1 && j !== 1)) {
        // مفاصل المشط داخل الكفّ
        joints.setMatrixAt(hi * 21 + j, zero);
        continue;
      }
      pos.set(...abs[j]);
      sc.set(r, r, r);
      m4.compose(pos, q.identity(), sc);
      joints.setMatrixAt(hi * 21 + j, m4);
    }
    // الكفّ: إهليلج يمتدّ من المعصم إلى مفاصل الأصابع
    const across = sub(abs[5], abs[17]);
    const along = sub(lerpV(abs[9], abs[13], 0.3), abs[0]);
    const n = norm(cross(along, across));
    const y = norm(along);
    const x = norm(cross(y, n));
    const c = add(abs[0], mul(add(along, mul(sub(lerpV(abs[5], abs[17], 0.5), lerpV(abs[9], abs[13], 0.3)), 0.4)), 0.52));
    const palm = palms[hi];
    palm.position.set(...c);
    m4.makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...n));
    palm.quaternion.setFromRotationMatrix(m4);
    palm.scale.set(Math.max(0.035, len(across) * 0.64), len(along) * 0.6, 0.021);
  };
  const lerpV = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---- تطبيق الحالة ----
  const F = FACE_INDEX;
  const applyFace = (f: number[], blink: number) => {
    const g = (k: keyof typeof F) => f[F[k]] ?? 0;
    // الحاجبان: رفع داخلي/خارجي وخفض
    [1, -1].forEach((s, i) => {
      const L = s > 0;
      const inner = g('browInnerUp');
      const outer = g(L ? 'browOuterUpLeft' : 'browOuterUpRight');
      const down = g(L ? 'browDownLeft' : 'browDownRight');
      const b = brows[i === 0 ? 1 : 0];
      b.position.y = 0.044 + (inner * 0.55 + outer * 0.45) * 0.011 - down * 0.008;
      b.rotation.z = s * (-inner * 0.28 + outer * 0.12 + down * 0.22);
    });
    // العينان
    eyes.forEach((e, i) => {
      const L = i === 1;
      const bl = Math.max(blink, g(L ? 'eyeBlinkLeft' : 'eyeBlinkRight'));
      const wide = g(L ? 'eyeWideLeft' : 'eyeWideRight');
      const sq = g(L ? 'eyeSquintLeft' : 'eyeSquintRight');
      const close = Math.min(1, Math.max(0, bl * 1.05 + sq * 0.3 - wide * 0.25 + 0.06));
      // الجفن: نصف كرة محوره للأعلى-الخلف (مفتوح) ويدور للأمام حتى يغطّي العين
      e.lid.rotation.x = -0.75 + close * (Math.PI / 2 + 0.75);
    });
    // الخدّان
    const puff = g('cheekPuff');
    cheeks.forEach((c) => c.scale.set(0.024 + puff * 0.012, 0.022 + puff * 0.006, 0.02 + puff * 0.016));
    // الفم
    const jawO = g('jawOpen');
    const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2;
    const frown = (g('mouthFrownLeft') + g('mouthFrownRight')) / 2;
    const stretch = (g('mouthStretchLeft') + g('mouthStretchRight')) / 2;
    const pucker = g('mouthPucker');
    const funnel = g('mouthFunnel');
    const press = (g('mouthPressLeft') + g('mouthPressRight')) / 2;
    const w = 0.0185 * (1 + smile * 0.22 + stretch * 0.22 - pucker * 0.38 - funnel * 0.25);
    const open = Math.max(0, jawO * 0.028 + funnel * 0.008 - press * 0.002);
    const cornerY = (smile - frown) * 0.006;
    const upH = open * 0.22 + funnel * 0.003;
    const loH = open * 0.78 + funnel * 0.003;
    const lipT = 0.0046 * (1 + pucker * 0.6 + funnel * 0.4) * (1 - press * 0.4);
    const inner: V3[] = [];
    for (let i = 0; i < MN; i++) {
      const t = i / (MN - 1);
      const x = -w + 2 * w * t;
      const e = 1 - Math.pow(Math.abs(2 * t - 1), 2);
      const bow = Math.sin(Math.PI * t);
      inner.push([x, cornerY * (1 - e) + upH * bow + 0.0006, 0.002 * e]);
    }
    for (let i = MN - 1; i >= 0; i--) {
      const t = i / (MN - 1);
      const x = -w + 2 * w * t;
      const e = 1 - Math.pow(Math.abs(2 * t - 1), 2);
      const bow = Math.sin(Math.PI * t);
      inner.push([x, cornerY * (1 - e) - loH * bow - 0.0006, 0.002 * e]);
    }
    let cy = 0;
    inner.forEach((p, i) => {
      mouthPos.set(p, i * 3);
      lipPos.set(p, i * 3);
      cy += p[1];
    });
    cy /= inner.length;
    mouthPos.set([0, cy, -0.001], MN * 2 * 3);
    inner.forEach((p, i) => {
      const dx = p[0],
        dy = p[1] - cy;
      const d = Math.hypot(dx / 2.2, dy) || 1;
      const k = lipT / d;
      lipPos.set([p[0] + (dx / 2.2) * k * 0.6, p[1] + dy * k, p[2] + 0.0015], (MN * 2 + i) * 3);
    });
    mouthGeo.attributes.position.needsUpdate = true;
    lipGeo.attributes.position.needsUpdate = true;
    mouthGeo.computeVertexNormals();
    lipGeo.computeVertexNormals();
    mouthMesh.visible = open > 0.0015;
  };

  const headQ = new THREE.Quaternion();
  const torsoE = new THREE.Euler(0, 0, 0, 'YXZ');
  const shoulderL = new THREE.Vector3();
  const shoulderR = new THREE.Vector3();

  const apply = (s: AvatarState, t: number, blink: number) => {
    // تنفّس خفيف
    const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
    torsoE.set(0.0, s.torso[1], s.torso[0] + Math.sin(t * 0.7) * 0.004);
    torso.rotation.copy(torsoE);
    torso.scale.set(1 + breath * 0.004, 1 + breath * 0.003, 1 + breath * 0.006);
    headQ.set(...s.head);
    const sway = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.sin(t * 0.9) * 0.012, Math.sin(t * 0.55) * 0.02, Math.sin(t * 0.75) * 0.008)
    );
    headPivot.quaternion.copy(headQ).multiply(sway);
    torso.updateMatrixWorld(true);
    // الكتفان يتبعان الجذع
    shoulderL.set(RIG.shoulderX, RIG.shoulderY - RIG.hipY, 0).applyMatrix4(torso.matrix);
    shoulderR.set(-RIG.shoulderX, RIG.shoulderY - RIG.hipY, 0).applyMatrix4(torso.matrix);
    const sides: [T.Vector3, V3, V3, V3[], number][] = [
      [shoulderL, s.lw, s.lp, s.lh, 0],
      [shoulderR, s.rw, s.rp, s.rh, 1],
    ];
    for (const [sv, w, p, h, i] of sides) {
      const S: V3 = [sv.x, sv.y, sv.z];
      const { elbow, wrist } = solveArm(S, w, p);
      const a = arms[i];
      const sIn: V3 = add(S, [i === 0 ? -0.015 : 0.015, -0.012, 0]);
      place(a.upper, sIn, elbow);
      place(a.fore, elbow, wrist);
      a.shoulder.position.set(...add(S, [i === 0 ? -0.012 : 0.012, -0.016, 0]));
      a.elbow.position.set(...elbow);
      const dir = norm(sub(wrist, elbow));
      a.cuff.position.set(...sub(wrist, mul(dir, 0.012)));
      a.cuff.quaternion.setFromUnitVectors(up, new THREE.Vector3(...dir));
      a.wrist.position.set(...wrist);
      drawHand(i, wrist, h);
    }
    fingers.instanceMatrix.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;
    applyFace(s.face, blink);
  };

  // ---- الحلقة الزمنية ----
  const rest = restState();
  let current: AvatarState = rest;
  let from: AvatarState = rest;
  let motion: Motion | null = null;
  let onEnd: (() => void) | null = null;
  let phase: 'idle' | 'enter' | 'play' | 'hold' | 'settle' = 'idle';
  let phaseT = 0;
  let paused = false;
  let clock = 0;
  let nextBlink = 2 + Math.random() * 3;
  let blinkT = -1;
  let last = performance.now();
  let raf = 0;
  let disposed = false;

  const ease = (x: number) => x * x * (3 - 2 * x);
  const sample = (m: Motion, tSec: number): { s: AvatarState; done: boolean } => {
    const f = m.start + tSec * m.fps;
    if (f >= m.end) return { s: m.frames[m.end], done: true };
    const i = Math.floor(f);
    return { s: mixState(m.frames[i], m.frames[Math.min(m.end, i + 1)], f - i), done: false };
  };

  const resize = () => {
    const w = canvas.clientWidth || 300,
      h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const step = (dt: number) => {
    clock += dt;
    if (!paused) phaseT += dt;
    // رمش طبيعي في كل الأحوال (يُدمج مع رمش البيانات)
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) {
      blinkT = 0;
      nextBlink = 2.5 + Math.random() * 3.5;
    }
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      blink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI);
      if (blinkT > 0.16) blinkT = -1;
    }

    if (phase === 'enter' && motion) {
      const k = Math.min(1, phaseT / TRANSITION);
      current = mixState(from, motion.frames[motion.start], ease(k));
      if (k >= 1) {
        phase = 'play';
        phaseT = 0;
      }
    } else if (phase === 'play' && motion) {
      const { s, done } = sample(motion, phaseT);
      current = s;
      if (done) {
        phase = 'hold';
        phaseT = 0;
        const cb = onEnd;
        onEnd = null;
        cb?.();
      }
    } else if (phase === 'hold') {
      if (phaseT > SETTLE_DELAY) {
        phase = 'settle';
        phaseT = 0;
        from = current;
      }
    } else if (phase === 'settle') {
      const k = Math.min(1, phaseT / SETTLE);
      current = mixState(from, rest, ease(k));
      if (k >= 1) phase = 'idle';
    }
    apply(current, clock, blink);
    renderer.render(scene, camera);
  };
  let manual = false;
  const frame = (now: number) => {
    if (disposed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!manual) step(dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // أداة تطوير: تقديم الزمن يدويًّا لالتقاط لقطات حتمية (لا تُستخدم في الإنتاج)
  if (process.env.NODE_ENV !== 'production') {
    (canvas as HTMLCanvasElement & { __avatarStep?: (ms: number) => void }).__avatarStep = (ms: number) => {
      manual = true;
      for (let x = 0; x < ms; x += 1000 / 30) step(1 / 30);
    };
  }

  return {
    play(m, cb) {
      from = current;
      motion = m;
      onEnd = cb;
      phase = 'enter';
      phaseT = 0;
    },
    setPaused(p) {
      paused = p;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      [skin, thobe, ghutra, egal, hair, lips, mouthIn, eyeWhite, iris].forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}

/**
 * المترجم ثلاثي الأبعاد. يبقى مُركَّبًا؛ تغيير `src` يشغّل الإشارة التالية
 * بانتقال سلس من الوضع الحالي. `src = null` يُبقيه في السكون.
 */
export function SignAvatar3D({
  src,
  cue = 0,
  playing = true,
  onEnded,
  onUnavailable,
  onFailed,
  className,
}: {
  src: string | null;
  /** يتغيّر مع كل خطوة: يعيد التشغيل حتى لو تكرّرت الإشارة نفسها متتاليةً */
  cue?: number;
  playing?: boolean;
  onEnded: () => void;
  /** ملف الحركة لهذه الإشارة غير متاح (يتراجع المشغّل للفيديو). */
  onUnavailable: (src: string) => void;
  /** تعذّرت تهيئة WebGL كلّيًّا. */
  onFailed?: () => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const unavailRef = useRef(onUnavailable);
  unavailRef.current = onUnavailable;
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let engine: Engine | null = null;
    createEngine(canvas)
      .then((e) => {
        if (!alive) return e.dispose();
        engine = e;
        engineRef.current = e;
        setReady(true);
      })
      .catch(() => failedRef.current?.());
    return () => {
      alive = false;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(!playing);
  }, [playing, ready]);

  useEffect(() => {
    if (!ready || !src) return;
    let alive = true;
    loadMotion(src).then((m) => {
      if (!alive) return;
      if (!m) {
        unavailRef.current(src);
        return;
      }
      // الإشارة الجديدة تُؤدّى كاملة حتى في الإيقاف المؤقت (التنقّل اليدوي بين
      // الإشارات)، لكن التقدّم التلقائي للتالية لا يحدث إلا أثناء التشغيل.
      engineRef.current?.setPaused(false);
      engineRef.current?.play(m, () => {
        if (alive && playingRef.current) endedRef.current();
      });
    });
    return () => {
      alive = false;
    };
  }, [src, cue, ready]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="المترجم ثلاثي الأبعاد يؤدّي الإشارة"
      className={className ?? 'h-full w-full'}
    />
  );
}
