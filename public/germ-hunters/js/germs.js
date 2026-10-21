// ---------------------------------------------------------------------------
// نظام «الجراثيم المضيئة» ثلاثي الأبعاد (الملف 09، ٤.٢).
// كل جرثومة نقطة مضيئة (Sprite) تنتقل بين موضعين: «من» و«إلى» (مع شفافية لكل منهما)
// بتأخير خاص بها، فيصنع المشهد كل الأحداث بالواجهة نفسها: تعلق على سطح، تطير مع الهواء،
// تتناثر مع العطاس، تتوقف عند المنديل، تنتقل من يد إلى يد، تسقط مع الماء والصابون.
//
//   الطبقة A (WebGPU): المواضع تُحسب على معالج الرسوم كل إطار (compute) بنابض ناعم نحو
//                      الهدف + ضجيج حيّ (الجراثيم «تتحرك» كأنها حيّة). حتى ~٨ آلاف لكل فريق.
//   الطبقة B (WebGL2): الهدف نفسه يُحسب في مظلّل الرؤوس مع تموّج بسيط، ≤ ٩٠٠ لكل فريق.
// الإحداثيات بوحدة المسرح u في فضاء العالم (انظر محاذاة الكاميرا في scene3d.js).
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  Fn, If, PI, cos, float, instanceIndex, instancedArray, instancedDynamicBufferAttribute, mix, mx_noise_vec3,
  oneMinus, saturate, sin, smoothstep, uniform, uv, vec3,
} from 'three/tsl';

const SPREAD = 0.35; // أقصى تأخير لجرثومة (من مدة الحدث)

/** تقدّم الجرثومة وموضعها الهدف وشفافيتها (نفس المعادلة في المعالجين) */
function targetOf(f, t, s, uP, uArc) {
  const k = saturate(uP.sub(s.x).div(1 - SPREAD));
  const e = k.mul(k).mul(float(3).sub(k.mul(2)));
  const pos = mix(f.xyz, t.xyz, e).add(uArc.mul(sin(k.mul(PI))).mul(s.w.mul(0.8).add(0.6)));
  const alpha = mix(f.w, t.w, e);
  return { pos, alpha };
}

export class Germs {
  /**
   * @param {{count:number, gpu:boolean}} o
   */
  constructor({ count, gpu }) {
    this.n = count;
    this.gpu = gpu;
    this.from = new Float32Array(count * 4);
    this.to = new Float32Array(count * 4);
    this.seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      this.seed[i * 4] = Math.random() * SPREAD;
      this.seed[i * 4 + 1] = 0.55 + Math.random() * 0.95;
      this.seed[i * 4 + 2] = Math.random();
      this.seed[i * 4 + 3] = Math.random();
    }
    this.uP = uniform(1);
    this.uArc = uniform(new THREE.Vector3());
    this.uGlow = uniform(0);
    this.uSize = uniform(12);
    this.uTime = uniform(0);
    this.glowTo = 0;
    this.dur = 1;
    this.active = 0;

    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    let f, t, s;
    if (gpu) {
      // الطبقة A: مخازن على معالج الرسوم، والمواضع تُكامل في compute
      this.fromN = instancedArray(this.from, 'vec4');
      this.toN = instancedArray(this.to, 'vec4');
      this.seedN = instancedArray(this.seed, 'vec4');
      this.posN = instancedArray(count, 'vec3');
      this.velN = instancedArray(count, 'vec3');
      this.uDt = uniform(0);
      this.uSnap = uniform(1);
      this.uWander = uniform(7);
      const { fromN, toN, seedN, posN, velN, uP, uArc, uDt, uSnap, uWander, uTime } = this;
      this.update = Fn(() => {
        const i = instanceIndex;
        const tg = targetOf(fromN.element(i), toN.element(i), seedN.element(i), uP, uArc);
        const pos = posN.element(i);
        const vel = velN.element(i);
        If(uSnap.greaterThan(0.5), () => {
          pos.assign(tg.pos);
          vel.assign(vec3(0, 0, 0));
        }).Else(() => {
          // نابض نحو الهدف + ضجيج حيّ: الجراثيم «تتلوّى» في أماكنها
          const w = seedN.element(i).w;
          const wander = mx_noise_vec3(pos.mul(0.02).add(vec3(w.mul(13), w.mul(7), uTime.mul(0.7)))).mul(uWander);
          const acc = tg.pos.add(wander).sub(pos).mul(110).sub(vel.mul(15));
          vel.addAssign(acc.mul(uDt));
          pos.addAssign(vel.mul(uDt));
        });
      })().compute(count);
      m.positionNode = posN.toAttribute();
      f = fromN.toAttribute();
      t = toN.toAttribute();
      s = seedN.toAttribute();
    } else {
      // الطبقة B: سمات مثيلات تُحدَّث من المعالج المركزي عند كل حدث فقط
      this.fromA = new THREE.InstancedBufferAttribute(this.from, 4);
      this.toA = new THREE.InstancedBufferAttribute(this.to, 4);
      this.seedA = new THREE.InstancedBufferAttribute(this.seed, 4);
      f = instancedDynamicBufferAttribute(this.fromA, 'vec4');
      t = instancedDynamicBufferAttribute(this.toA, 'vec4');
      s = instancedDynamicBufferAttribute(this.seedA, 'vec4');
      const tg = targetOf(f, t, s, this.uP, this.uArc);
      const wob = vec3(sin(this.uTime.mul(3).add(s.w.mul(40))), cos(this.uTime.mul(2.3).add(s.w.mul(17))), 0).mul(2.5);
      m.positionNode = tg.pos.add(wob);
    }
    const { alpha } = targetOf(f, t, s, this.uP, this.uArc);
    const d = uv().sub(0.5).length().mul(2);
    const soft = saturate(oneMinus(d));
    const core = oneMinus(smoothstep(0.0, 0.5, d));
    // ألوان التوهّج تحت الأشعة فوق البنفسجية: أصفر مخضرّ وسماوي (كصورة الكتاب)
    m.colorNode = mix(vec3(0.85, 1.0, 0.28), vec3(0.55, 0.98, 1.0), smoothstep(0.6, 0.64, s.z)).mul(core.mul(1.3).add(0.6));
    m.opacityNode = soft.pow(1.4).mul(alpha).mul(this.uGlow);
    m.scaleNode = this.uSize.mul(s.y).mul(alpha.mul(0.55).add(0.45));
    this.material = m;
    this.object = new THREE.Sprite(m);
    this.object.count = count;
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
  }

  _flush() {
    if (this.gpu) {
      this.fromN.value.needsUpdate = true;
      this.toN.value.needsUpdate = true;
    } else {
      this.fromA.needsUpdate = true;
      this.toA.needsUpdate = true;
    }
  }

  /** الموضع الحالي (المستقر) للجرثومة i */
  rest(i) {
    const k = i * 4;
    return [this.to[k], this.to[k + 1], this.to[k + 2], this.to[k + 3]];
  }

  /**
   * حدث جديد: لكل جرثومة i موضع البداية (افتراضيًا: حيث استقرت) والوصول.
   * @param {{to:(i:number, rest:number[])=>number[]|null, from?:(i:number, rest:number[])=>number[], dur?:number, arc?:number[], count?:number, snap?:boolean}} o
   */
  event({ to, from = null, dur = 0.8, arc = [0, 0, 0], count = this.active, snap = false }) {
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
    this.uArc.value.set(...arc);
    this.uP.value = 0;
    this.dur = Math.max(0.05, dur);
    if (snap && this.gpu) this.uSnap.value = 1;
    this._flush();
  }

  /** إخفاء فوري لكل الجراثيم */
  clear() {
    this.from.fill(0);
    this.to.fill(0);
    this.active = 0;
    this.uP.value = 1;
    if (this.gpu) this.uSnap.value = 1;
    this._flush();
  }

  glow(v) {
    this.glowTo = v;
  }

  frame(renderer, now, dt, reduced) {
    this.uTime.value = now / 1000;
    this.uP.value = Math.min(1, this.uP.value + dt / this.dur);
    this.uGlow.value += (this.glowTo - this.uGlow.value) * Math.min(1, dt * (reduced ? 30 : 7));
    const live = this.uP.value < 1 || this.uGlow.value > 0.01 || this.glowTo > 0;
    if (this.gpu && live) {
      this.uDt.value = Math.min(0.05, dt);
      this.uWander.value = reduced ? 0 : 7;
      renderer.compute(this.update);
      this.uSnap.value = 0;
    }
    return this.uP.value < 1 || this.uGlow.value > 0.01;
  }

  dispose() {
    this.material.dispose();
  }
}

// ------------------------------------------------------------------ أخذ عيّنات من سطح مجسّم
/**
 * نقاط عشوائية على سطوح المجسّم (حسب المساحة) بإحداثيات العالم، مع العمود.
 * تُستبعد الحدود والأجزاء المعلَّمة sample=false، وتُفضَّل الوجوه المقابلة للكاميرا.
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
  const nm = new THREE.Matrix3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline || o.userData.sample === false || !o.visible) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const lift = (o.userData.lift || 0.02) * scale;
    nm.getNormalMatrix(o.matrixWorld);
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
