// ---------------------------------------------------------------------------
// «الجراثيم المضيئة» ثلاثية الأبعاد: نقاط (Points) بمظلِّل GLSL خاص، لونها أقوى من الأبيض
// (قيم HDR) فتلتقطها مرحلة التوهّج (UnrealBloom) وتشعّ كما في الصورة تحت الضوء البنفسجي.
//
// كل جرثومة تنتقل بين موضعين: «من» و«إلى» (مع شفافية لكل منهما) بتأخير خاص بها، فيصنع المشهد
// كل الأحداث بالواجهة نفسها: تعلق على سطح، تطير مع الهواء، تتناثر مع العطاس، تتوقف عند المنديل،
// تنتقل من يد إلى يد، تسقط مع الماء والصابون. الحساب كله في مظلِّل الرؤوس، والمعالج المركزي
// لا يكتب إلا عند بداية كل حدث.
//   الطبقة A: ≈ ٤٠٠٠ لكل فريق، تتلوّى حيّة (ضجيج في مظلِّل الرؤوس).
//   الطبقة B: ≈ ١٢٠٠ لكل فريق، بتموّج أبسط.
// الإحداثيات بوحدة المسرح u في فضاء العالم (انظر محاذاة الكاميرا في scene3d.js).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const SPREAD = 0.35; // أقصى تأخير لجرثومة (من مدة الحدث)

const VERT = /* glsl */ `
  attribute vec4 aFrom;
  attribute vec4 aTo;
  attribute vec4 aSeed;
  uniform float uP, uTime, uSize, uPx, uWander;
  uniform vec3 uArc;
  varying float vA;
  varying float vHue;
  void main(){
    float k = clamp((uP - aSeed.x) / (1.0 - ${SPREAD.toFixed(2)}), 0.0, 1.0);
    float e = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(aFrom.xyz, aTo.xyz, e) + uArc * sin(k * 3.14159265) * (aSeed.w * 0.8 + 0.6);
    // حياة: كل جرثومة تتلوّى في مكانها
    float t = uTime * (0.8 + aSeed.w);
    p += vec3(sin(t * 2.1 + aSeed.w * 40.0), cos(t * 1.7 + aSeed.z * 23.0), sin(t * 1.3 + aSeed.y * 9.0)) * uWander;
    vA = mix(aFrom.w, aTo.w, e);
    vHue = aSeed.z;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSeed.y * (0.45 + 0.55 * vA) * uPx / -mv.z;
  }`;

const FRAG = /* glsl */ `
  uniform float uGlow;
  varying float vA;
  varying float vHue;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float soft = pow(1.0 - d, 2.2);
    float core = 1.0 - smoothstep(0.0, 0.45, d);
    // أصفر مخضرّ وسماوي (كصورة الكتاب)، أقوى من الأبيض فيتوهّج
    vec3 col = mix(vec3(0.82, 1.0, 0.22), vec3(0.45, 0.95, 1.0), step(0.62, vHue));
    col *= 0.55 + core * 2.2;
    float a = soft * vA * uGlow;
    gl_FragColor = vec4(col * a, a);
  }`;

export class Germs {
  /** @param {{count:number, tier:string}} o */
  constructor({ count, tier }) {
    this.n = count;
    this.tier = tier;
    this.from = new Float32Array(count * 4);
    this.to = new Float32Array(count * 4);
    this.seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      this.seed[i * 4] = Math.random() * SPREAD;
      this.seed[i * 4 + 1] = 0.55 + Math.random() * 0.95;
      this.seed[i * 4 + 2] = Math.random();
      this.seed[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    // موضع وهمي (كل الحساب من aFrom/aTo)؛ three يحتاج سمة position لعدد النقاط
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.fromA = new THREE.BufferAttribute(this.from, 4).setUsage(THREE.DynamicDrawUsage);
    this.toA = new THREE.BufferAttribute(this.to, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFrom', this.fromA);
    geo.setAttribute('aTo', this.toA);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 4));
    this.uniforms = {
      uP: { value: 1 },
      uTime: { value: 0 },
      uSize: { value: 8 },
      uPx: { value: 1000 },
      uWander: { value: tier === 'A' ? 3.2 : 1.8 },
      uArc: { value: new THREE.Vector3() },
      uGlow: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
    this.geo = geo;
    this.glowTo = 0;
    this.dur = 1;
    this.active = 0;
  }

  _flush() {
    this.fromA.needsUpdate = true;
    this.toA.needsUpdate = true;
  }

  /**
   * حدث جديد: لكل جرثومة i موضع البداية (افتراضيًا: حيث استقرت) والوصول.
   * @param {{to:(i:number, rest:number[])=>number[]|null, from?:(i:number, rest:number[])=>number[], dur?:number, arc?:number[], count?:number}} o
   */
  event({ to, from = null, dur = 0.8, arc = [0, 0, 0], count = this.active }) {
    const n = Math.min(this.n, count);
    for (let i = 0; i < this.n; i++) {
      const k = i * 4;
      const rest = [this.to[k], this.to[k + 1], this.to[k + 2], this.to[k + 3]];
      // الجراثيم خارج الحدث تبقى مخفية في مكانها
      const f = i >= n ? [rest[0], rest[1], rest[2], 0] : from ? from(i, rest) : rest;
      const t = i < n ? to(i, rest) || rest : [rest[0], rest[1], rest[2], 0];
      this.from.set(f, k);
      this.to.set(t, k);
    }
    this.active = Math.max(this.active, n);
    this.uniforms.uArc.value.set(...arc);
    this.uniforms.uP.value = 0;
    this.dur = Math.max(0.05, dur);
    this._flush();
  }

  /** إخفاء فوري لكل الجراثيم */
  clear() {
    this.from.fill(0);
    this.to.fill(0);
    this.active = 0;
    this.uniforms.uP.value = 1;
    this._flush();
  }

  glow(v) {
    this.glowTo = v;
  }

  /** @returns {boolean} هل تحتاج إطارًا جديدًا */
  frame(now, dt, reduced, pxScale) {
    const u = this.uniforms;
    u.uTime.value = now / 1000;
    u.uPx.value = pxScale;
    u.uWander.value = reduced ? 0 : this.tier === 'A' ? 3.2 : 1.8;
    u.uP.value = Math.min(1, u.uP.value + dt / this.dur);
    u.uGlow.value += (this.glowTo - u.uGlow.value) * Math.min(1, dt * (reduced ? 30 : 7));
    return u.uP.value < 1 || u.uGlow.value > 0.01;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}

// ------------------------------------------------------------------ أخذ عيّنات من سطح مجسّم
/**
 * نقاط عشوائية على سطوح المجسّم (حسب المساحة) بإحداثيات العالم، مع العمود.
 * تُستبعد الأجزاء المعلَّمة sample=false، وتُفضَّل الوجوه المقابلة للكاميرا.
 * @returns {{p:THREE.Vector3, n:THREE.Vector3}[]}
 */
export function sampleSurface(root, count, scale = 1) {
  root.updateMatrixWorld(true);
  const tris = [];
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.sample === false || !o.visible) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const lift = (o.userData.lift || 0.012) * scale;
    const tc = idx ? idx.count / 3 : pos.count / 3;
    const flip = o.matrixWorld.determinant() < 0 ? -1 : 1;
    for (let t = 0; t < tc; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      nrm.subVectors(b, a).cross(c.clone().sub(a));
      const area = nrm.length() / 2;
      if (area <= 1e-6) continue;
      nrm.normalize().multiplyScalar(flip);
      // الوجوه المقابلة للكاميرا (z موجب) أولًا؛ الخلفية بوزن صغير
      const w = area * (nrm.z > -0.05 ? 1 : 0.08);
      total += w;
      tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), n: nrm.clone(), w: total, lift });
    }
  });
  const out = [];
  if (!tris.length) return out;
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].w < r) lo = mid + 1;
      else hi = mid;
    }
    const T = tris[lo];
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) (u = 1 - u), (v = 1 - v);
    const p = T.a.clone().multiplyScalar(1 - u - v).addScaledVector(T.b, u).addScaledVector(T.c, v).addScaledVector(T.n, T.lift);
    out.push({ p, n: T.n });
  }
  return out;
}
