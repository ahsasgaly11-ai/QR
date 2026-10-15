'use client';

import { useEffect, useRef, useState } from 'react';
import type * as T from 'three';
import {
  DEFAULT_RIG,
  FACE,
  FACE_INDEX,
  mixState,
  prepareMotion,
  restState,
  solveArm,
  sub,
  norm,
  len,
  type AvatarState,
  type Motion,
  type PoseFileAny,
  type RigDims,
  type V3,
} from '@/lib/sign-motion';

// ---------------------------------------------------------------------------
// المترجم ثلاثي الأبعاد: شخصية قطرية مجسّمة (signer.glb — مبنية من بيانات
// MakeHuman برخصة CC0 عبر scripts/avatar/) يحرّكها بنك الحركات المستخلص من
// مقاطع القاموس الموثّقة (sign-motion.ts يعيد استهدافها).
//
// الحركة تُطبَّق على هيكل الشخصية (عظام): الذراعان بالحركية العكسية مع لفّ
// طبيعي للمرفق والساعد، الكفّ باتجاه راحة اليد المقاسة، كل سلامية إصبع
// نحو معلمها، الرأس والرقبة والجذع، وتعابير الوجه (مفاتيح شكل) من المؤدّي.
// تبقى الشخصية مُركَّبة طوال التشغيل وتنتقل بين الإشارات انتقالًا سلسًا،
// وفي السكون تتنفّس وترمش وتنظر إلى المشاهد.
// ---------------------------------------------------------------------------

const MODEL_URL = '/sign/avatar/signer.glb';
const META_URL = '/sign/avatar/signer.json';

interface SignerMeta {
  pose: Record<string, V3>;
  hands: { L: V3[]; R: V3[] };
  head: { center: V3; top: V3; neck: V3; mouth: V3; eyeL: V3; eyeR: V3; radius: number };
  torso: { halfWidth: number; halfDepth: number; hipZ: number };
  bones: {
    spine: string[];
    neck: string;
    head: string;
    eyes: string[];
    L: SideBones;
    R: SideBones;
  };
  boneRest: Record<string, { head: V3; tail: V3 }>;
  face: string[];
}
interface SideBones {
  clavicle: string;
  upper: string;
  fore: string;
  hand: string;
  fingers: string[][];
}

let metaPromise: Promise<SignerMeta | null> | null = null;
function loadMeta(): Promise<SignerMeta | null> {
  if (!metaPromise) {
    metaPromise = fetch(META_URL, { cache: 'force-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<SignerMeta>) : null))
      .catch(() => null);
  }
  return metaPromise;
}

/** أبعاد الشخصية المحمَّلة بصيغة محرّك الحركة. */
function rigFromMeta(m: SignerMeta): RigDims {
  const sL = m.pose['11'],
    sR = m.pose['12'],
    eL = m.pose['13'],
    wL = m.pose['15'];
  const hand = len(sub(m.hands.L[9], m.hands.L[0]));
  const r = m.head.radius;
  return {
    shoulderY: (sL[1] + sR[1]) / 2,
    shoulderX: Math.abs(sL[0] - sR[0]) / 2,
    upperArm: len(sub(eL, sL)),
    forearm: len(sub(wL, eL)),
    hand,
    headCenter: [0, m.head.center[1] + 0.015, m.head.center[2] + 0.01],
    headR: [r, r * 1.25, r * 1.05],
    torsoR: [m.torso.halfWidth, m.torso.halfDepth],
    hipY: m.torso.hipZ,
  };
}

const motionCache = new Map<string, Promise<Motion | null>>();
function loadMotion(src: string, rig: RigDims): Promise<Motion | null> {
  if (!motionCache.has(src)) {
    motionCache.set(
      src,
      fetch(src, { cache: 'force-cache' })
        .then((r) => (r.ok ? (r.json() as Promise<PoseFileAny>) : null))
        .then((j) => (j ? prepareMotion(j, rig) : null))
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

const TRANSITION = 0.22; // ثانية: انتقال بين إشارتين
const SETTLE_DELAY = 0.8; // بعد آخر إشارة قبل العودة للراحة
const SETTLE = 0.6;

interface Engine {
  play: (m: Motion, onEnd: () => void) => void;
  setPaused: (p: boolean) => void;
  setSpeed: (s: number) => void;
  dispose: () => void;
}

async function createEngine(canvas: HTMLCanvasElement, meta: SignerMeta, rig: RigDims, shadows = true): Promise<Engine> {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;

  // الكاميرا: من الوركين إلى أعلى الرأس (مجال الإشارة كاملًا)
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 10);
  const headY = meta.head.center[1];
  const lookY = headY - 0.36;
  camera.position.set(0, lookY + 0.08, 2.45);
  camera.lookAt(0, lookY, 0);

  // إضاءة استوديو: رئيسية دافئة ناعمة، تعبئة باردة، حافّة ذهبية بهوية المنصّة
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x3a0b1a, 0.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(0.9, 2.7, 2.3);
  key.target.position.set(0, headY - 0.3, 0);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -0.7;
  key.shadow.camera.right = 0.7;
  key.shadow.camera.top = 0.9;
  key.shadow.camera.bottom = -0.9;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 6;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  fill.position.set(-2.0, 1.9, 1.8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe8c27a, 1.3);
  rim.position.set(-0.7, 2.4, -2.0);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.6);
  rim2.position.set(1.2, 2.0, -1.6);
  scene.add(rim2);

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const root = gltf.scene;
  scene.add(root);
  root.updateMatrixWorld(true);

  // ---- العظام والشبكات ----
  const bones = new Map<string, T.Bone>();
  const order: T.Bone[] = [];
  const morphs: { mesh: T.Mesh; dict: Record<string, number> }[] = [];
  root.traverse((o) => {
    const b = o as T.Bone;
    if (b.isBone) {
      bones.set(b.name, b);
      order.push(b);
    }
    const m = o as T.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (m.morphTargetDictionary) morphs.push({ mesh: m, dict: m.morphTargetDictionary });
      const mat = m.material as T.MeshStandardMaterial;
      if (mat && mat.isMeshStandardMaterial) {
        mat.envMapIntensity = mat.name === 'skin' ? 0.55 : mat.name === 'eye' ? 1.4 : 0.35;
        if (mat.name === 'skin') {
          mat.roughness = 0.5;
        }
      }
    }
  });

  const restLocalQ = new Map<string, T.Quaternion>();
  const restLocalP = new Map<string, T.Vector3>();
  const restWorldQ = new Map<string, T.Quaternion>();
  const restWorldP = new Map<string, T.Vector3>();
  const staticParent = new Map<string, { q: T.Quaternion; p: T.Vector3 }>();
  for (const b of order) {
    restLocalQ.set(b.name, b.quaternion.clone());
    restLocalP.set(b.name, b.position.clone());
    const q = new THREE.Quaternion(),
      p = new THREE.Vector3(),
      s = new THREE.Vector3();
    b.matrixWorld.decompose(p, q, s);
    restWorldQ.set(b.name, q);
    restWorldP.set(b.name, p);
    const par = b.parent;
    if (par && !(par as T.Bone).isBone) {
      const pq = new THREE.Quaternion(),
        pp = new THREE.Vector3();
      par.matrixWorld.decompose(pp, pq, s);
      staticParent.set(b.name, { q: pq, p: pp });
    }
  }
  const curQ = new Map<string, T.Quaternion>();
  const curP = new Map<string, T.Vector3>();
  for (const b of order) {
    curQ.set(b.name, new THREE.Quaternion());
    curP.set(b.name, new THREE.Vector3());
  }
  const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
  const toV3 = (v: T.Vector3): V3 => [v.x, v.y, v.z];

  /** اتجاه العظمة في وضع الراحة (عالمي) من بيانات المرجع. */
  const restDir = new Map<string, T.Vector3>();
  for (const [name, r] of Object.entries(meta.boneRest)) {
    restDir.set(name, v3(sub(r.tail, r.head)).normalize());
  }

  /** يحدّث التحويل العالمي الحالي لعظمة من محليّها ووالدها (يجب أن يكون الوالد محدَّثًا). */
  const fkBone = (b: T.Bone) => {
    const par = b.parent as T.Bone | null;
    const name = b.name;
    const q = curQ.get(name)!,
      p = curP.get(name)!;
    if (par && par.isBone) {
      q.copy(curQ.get(par.name)!).multiply(b.quaternion);
      p.copy(b.position).applyQuaternion(curQ.get(par.name)!).add(curP.get(par.name)!);
    } else {
      const sp = staticParent.get(name)!;
      q.copy(sp.q).multiply(b.quaternion);
      p.copy(b.position).applyQuaternion(sp.q).add(sp.p);
    }
  };
  /** يضبط التوجيه العالمي المطلوب لعظمة (تُحوَّل إلى محلّي عبر الوالد الحالي). */
  const tmpQ = new THREE.Quaternion();
  const setWorld = (b: T.Bone, world: T.Quaternion) => {
    const par = b.parent as T.Bone | null;
    const pq = par && par.isBone ? curQ.get(par.name)! : staticParent.get(b.name)!.q;
    b.quaternion.copy(tmpQ.copy(pq).invert().multiply(world));
    fkBone(b);
  };
  /** توجيه عالمي = دوران إضافي × وضع الراحة. */
  const deltaWorld = (name: string, delta: T.Quaternion, out: T.Quaternion) =>
    out.copy(delta).multiply(restWorldQ.get(name)!);

  // عظام الأطراف
  const side = (s: 'L' | 'R') => meta.bones[s];
  const FRONT = new THREE.Vector3(0, 0, 1);
  // محور مفصل المرفق في الراحة: ثني الساعد يأخذه نحو الأمام
  const hingeLocal = new Map<string, T.Vector3>();
  for (const s of ['L', 'R'] as const) {
    const up = side(s).upper;
    const d0 = restDir.get(up)!;
    const h = new THREE.Vector3().crossVectors(d0, FRONT).normalize();
    hingeLocal.set(up, h.applyQuaternion(restWorldQ.get(up)!.clone().invert()));
  }
  /** إطار الكفّ من أربع معالم: الرسغ، قاعدة السبّابة والوسطى والخنصر. */
  const frameQ = (p0: V3, p5: V3, p9: V3, p17: V3, out: T.Quaternion) => {
    const e1 = v3(norm(sub(p9, p0)));
    const v = v3(sub(p5, p17));
    const e3 = new THREE.Vector3().crossVectors(e1, v).normalize();
    const e2 = new THREE.Vector3().crossVectors(e3, e1);
    const m = new THREE.Matrix4().makeBasis(e1, e2, e3);
    return out.setFromRotationMatrix(m);
  };
  const restHandQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
  for (const s of ['L', 'R'] as const) {
    const h = meta.hands[s];
    frameQ(h[0], h[5], h[9], h[17], restHandQ[s]);
  }
  /** جزء اللفّ حول محور من دوران (تفكيك swing-twist). */
  const twistAbout = (q: T.Quaternion, axis: T.Vector3, out: T.Quaternion) => {
    const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;
    out.set(axis.x * d, axis.y * d, axis.z * d, q.w);
    const l = Math.hypot(out.x, out.y, out.z, out.w) || 1;
    out.set(out.x / l, out.y / l, out.z / l, out.w / l);
    return out;
  };
  const IDENT = new THREE.Quaternion();

  // مؤقّتات
  const qA = new THREE.Quaternion(),
    qB = new THREE.Quaternion(),
    qC = new THREE.Quaternion(),
    qD = new THREE.Quaternion();
  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3();
  const eul = new THREE.Euler();

  const applyArm = (s: 'L' | 'R', wristT: V3, pole: V3, hand: V3[], shrug: number) => {
    const B = side(s);
    const clav = bones.get(B.clavicle)!;
    const upper = bones.get(B.upper)!;
    const fore = bones.get(B.fore)!;
    const handB = bones.get(B.hand)!;
    // الترقوة: ترتفع قليلًا مع ارتفاع اليد
    const sgn = s === 'L' ? 1 : -1;
    qA.setFromAxisAngle(FRONT, sgn * shrug * 0.2);
    setWorld(clav, deltaWorld(B.clavicle, qA, qB));
    fkBone(upper);
    const S = toV3(curP.get(B.upper)!);
    const ik = solveArm(S, wristT, pole, rig.upperArm, rig.forearm);
    const dUp = v3(norm(sub(ik.elbow, S)));
    const dFore = v3(norm(sub(ik.wrist, ik.elbow)));
    // العضد: توجيه ثم لفّ ليواجه مفصلُ المرفق مستوى الثني
    const d0 = restDir.get(B.upper)!;
    qA.setFromUnitVectors(d0, dUp);
    qB.copy(qA).multiply(restWorldQ.get(B.upper)!);
    const hingeNow = vA.copy(hingeLocal.get(B.upper)!).applyQuaternion(qB);
    const hingeWant = vB.copy(dUp).cross(vC.copy(v3(ik.perp)).negate()).normalize();
    // زاوية موقّعة حول محور العضد
    const cs = hingeNow.dot(hingeWant);
    const sn = vC.crossVectors(hingeNow, hingeWant).dot(dUp);
    qC.setFromAxisAngle(dUp, Math.atan2(sn, cs));
    qB.premultiply(qC);
    setWorld(upper, qB);
    // الساعد: توجيه نسبةً إلى العضد الحالي
    const upDelta = qC.copy(curQ.get(B.upper)!).multiply(qD.copy(restWorldQ.get(B.upper)!).invert());
    const foreNow = vA.copy(restDir.get(B.fore)!).applyQuaternion(upDelta);
    qA.setFromUnitVectors(foreNow, dFore);
    const qFore = qB.copy(qA).multiply(upDelta).multiply(restWorldQ.get(B.fore)!);
    // الكفّ من إطار معالمها
    const qHandWorld = frameQ(hand[0], hand[5], hand[9], hand[17], qD).multiply(restHandQ[s].clone().invert()).multiply(restWorldQ.get(B.hand)!);
    // الكبّ والبسط يقع في الساعد: ننقل معظم لفّ الكفّ حول محور الساعد إليه
    const relRest = restWorldQ.get(B.fore)!.clone().invert().multiply(restWorldQ.get(B.hand)!);
    const rel = qFore.clone().invert().multiply(qHandWorld);
    const extra = rel.multiply(relRest.invert());
    const axisLocal = vA.copy(restDir.get(B.fore)!).applyQuaternion(restWorldQ.get(B.fore)!.clone().invert());
    const tw = twistAbout(extra, axisLocal, qA);
    qC.copy(IDENT).slerp(tw, 0.85);
    qFore.multiply(qC);
    setWorld(fore, qFore);
    setWorld(handB, qHandWorld);
    // الأصابع: كل سلامية نحو معلمها التالي
    for (let f = 0; f < 5; f++) {
      for (let k = 0; k < 3; k++) {
        const name = B.fingers[f][k];
        const b = bones.get(name);
        if (!b) continue;
        const i0 = 4 * f + k + 1,
          i1 = i0 + 1;
        const target = v3(norm(sub(hand[i1], hand[i0])));
        const par = b.parent as T.Bone;
        const parDelta = qC.copy(curQ.get(par.name)!).multiply(qD.copy(restWorldQ.get(par.name)!).invert());
        const now = vA.copy(restDir.get(name)!).applyQuaternion(parDelta);
        qA.setFromUnitVectors(now, target);
        qB.copy(qA).multiply(parDelta).multiply(restWorldQ.get(name)!);
        setWorld(b, qB);
      }
    }
  };

  const F = FACE_INDEX;
  const cameraPos = camera.position.clone();
  const eyeTargetDir = new THREE.Vector3();

  const apply = (s: AvatarState, t: number, blink: number) => {
    // 0) الراحة لكل العظام
    for (const b of order) {
      b.quaternion.copy(restLocalQ.get(b.name)!);
      b.position.copy(restLocalP.get(b.name)!);
    }
    for (const b of order) fkBone(b);
    // 1) الجذع: ميل ودوران + تنفّس خفيف
    const breath = Math.sin(t * 1.5) * 0.006;
    const [roll, yaw] = s.torso;
    for (const name of meta.bones.spine) {
      const b = bones.get(name)!;
      if (name === meta.bones.spine[1]) {
        eul.set(breath - 0.004 + Math.sin(t * 0.6) * 0.003, yaw, roll, 'YXZ');
        qA.setFromEuler(eul);
        setWorld(b, deltaWorld(name, qA, qB));
      } else fkBone(b);
    }
    // 2) الرقبة والرأس
    const qHead = qD.set(s.head[0], s.head[1], s.head[2], s.head[3]);
    const sway = qC.setFromEuler(eul.set(Math.sin(t * 0.9) * 0.012, Math.sin(t * 0.55) * 0.02, Math.sin(t * 0.75) * 0.008));
    qHead.multiply(sway);
    qA.copy(IDENT).slerp(qHead, 0.35);
    setWorld(bones.get(meta.bones.neck)!, deltaWorld(meta.bones.neck, qA, qB));
    setWorld(bones.get(meta.bones.head)!, deltaWorld(meta.bones.head, qHead, qB));
    // 3) العينان نحو المشاهد (بحدود طبيعية)
    for (const name of meta.bones.eyes) {
      const b = bones.get(name);
      if (!b) continue;
      fkBone(b);
      eyeTargetDir.copy(cameraPos).sub(curP.get(name)!).normalize();
      const eyeDelta = qB.copy(curQ.get(name)!).multiply(qC.copy(restWorldQ.get(name)!).invert());
      const fwd = vA.copy(restDir.get(name)!).applyQuaternion(eyeDelta);
      qA.setFromUnitVectors(fwd, eyeTargetDir);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(qA.w)));
      if (ang > 0.2) qA.slerp(IDENT, 1 - 0.2 / ang);
      setWorld(b, qB.copy(qA).multiply(curQ.get(name)!));
    }
    // 4) الذراعان
    const shrugL = Math.max(0, Math.min(1, (s.lw[1] - rig.shoulderY + 0.1) / 0.45));
    const shrugR = Math.max(0, Math.min(1, (s.rw[1] - rig.shoulderY + 0.1) / 0.45));
    applyArm('L', s.lw, s.lp, s.lh, shrugL);
    applyArm('R', s.rw, s.rp, s.rh, shrugR);
    // 5) الوجه
    for (const { mesh, dict } of morphs) {
      const inf = mesh.morphTargetInfluences!;
      for (let i = 0; i < FACE.length; i++) {
        const idx = dict[FACE[i]];
        if (idx === undefined) continue;
        let v = s.face[i] ?? 0;
        if (i === F.eyeBlinkLeft || i === F.eyeBlinkRight) v = Math.max(v, blink);
        inf[idx] = Math.min(1, v);
      }
    }
  };

  // ---- الحلقة الزمنية ----
  const rest = restState(rig);
  let current: AvatarState = rest;
  let from: AvatarState = rest;
  let motion: Motion | null = null;
  let onEnd: (() => void) | null = null;
  let phase: 'idle' | 'enter' | 'play' | 'hold' | 'settle' = 'idle';
  let phaseT = 0;
  let paused = false;
  let speed = 1;
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
    if (!paused) phaseT += dt * speed;
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) {
      blinkT = 0;
      nextBlink = 2.5 + Math.random() * 3.5;
    }
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      blink = Math.sin(Math.min(1, blinkT / 0.18) * Math.PI);
      if (blinkT > 0.18) blinkT = -1;
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
    setSpeed(s) {
      speed = s;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      envTex.dispose();
      pmrem.dispose();
      root.traverse((o) => {
        const m = o as T.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as T.MeshStandardMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      renderer.dispose();
    },
  };
}

/**
 * المترجم ثلاثي الأبعاد. يبقى مُركَّبًا؛ تغيير `src` (أو `cue`) يشغّل الإشارة
 * التالية بانتقال سلس من الوضع الحالي. `src = null` يُبقيه في السكون.
 */
export function SignAvatar3D({
  src,
  cue = 0,
  playing = true,
  speed = 1,
  onEnded,
  onUnavailable,
  onFailed,
  onReady,
  className,
  shadows = true,
}: {
  src: string | null;
  /** يتغيّر مع كل خطوة: يعيد التشغيل حتى لو تكرّرت الإشارة نفسها متتاليةً */
  cue?: number;
  playing?: boolean;
  /** سرعة الأداء (1 = سرعة المؤدّي) */
  speed?: number;
  onEnded: () => void;
  /** ملف الحركة لهذه الإشارة غير متاح. */
  onUnavailable: (src: string) => void;
  /** تعذّرت تهيئة الشخصية (WebGL أو الملفّات). */
  onFailed?: () => void;
  onReady?: () => void;
  className?: string;
  /** ظلال (يُطفأ للتشخيص فقط) */
  shadows?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const rigRef = useRef<RigDims>(DEFAULT_RIG);
  const [ready, setReady] = useState(false);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const unavailRef = useRef(onUnavailable);
  unavailRef.current = onUnavailable;
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let engine: Engine | null = null;
    loadMeta()
      .then((meta) => {
        if (!meta) throw new Error('no signer meta');
        rigRef.current = rigFromMeta(meta);
        return createEngine(canvas, meta, rigRef.current, shadows);
      })
      .then((e) => {
        if (!alive) return e.dispose();
        engine = e;
        engineRef.current = e;
        setReady(true);
        readyRef.current?.();
      })
      .catch(() => failedRef.current?.());
    return () => {
      alive = false;
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(!playing);
  }, [playing, ready]);
  useEffect(() => {
    engineRef.current?.setSpeed(speed);
  }, [speed, ready]);

  useEffect(() => {
    if (!ready || !src) return;
    let alive = true;
    loadMotion(src, rigRef.current).then((m) => {
      if (!alive) return;
      if (!m) {
        unavailRef.current(src);
        return;
      }
      // الإشارة الجديدة تُؤدّى كاملة حتى في الإيقاف المؤقت (التنقّل اليدوي)،
      // لكن التقدّم التلقائي للتالية لا يحدث إلا أثناء التشغيل.
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
