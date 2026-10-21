// ---------------------------------------------------------------------------
// جسيمات «أسبوع الزكام»: رذاذ العطسة، والجراثيم داخله، والرذاذ الناعم العالق في الهواء،
// وقصاصات الاحتفال وبريق الصواب — نظام واحد بمواد TSL (three.js r186، WebGPURenderer).
//
// الفكرة: مسار كل قطرة «تحليلي» (معادلة لا حالة): حركة بسرعة ابتدائية مع مقاومة الهواء
// والجاذبية، وتتوقف عند زمن tStop (اصطدمت بمرفق أو منديل أو طاولة أو رأس زميل).
//   p(t) = p0 + v0·(1 − e^(−kt))/k + g·(t/k − (1 − e^(−kt))/k²)
// يحسب المعالج المركزي زمن التوقف مرة واحدة عند إطلاق العطسة (بالمعادلة نفسها)،
// ويرسم معالج الرسوم المسار كل إطار بلا أي تحديث من JavaScript.
//
//   الطبقة A (WebGPU): فوق المسار التحليلي «اضطراب» يُحسب على معالج الرسوم (compute):
//                      الرذاذ الناعم يدور ويتماوج في الهواء كأنه حيّ. حتى ١٦ ألف جسيمة للصف.
//   الطبقة B (WebGL2): المسار نفسه بتموّج بسيط في مظلّل الرؤوس، ≤ ١٢٠٠ جسيمة للصف.
// الوحدات بالمتر في فضاء العالم.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  Fn, If, abs, atan, clamp, cos, exp, float, instanceIndex, instancedArray, instancedDynamicBufferAttribute,
  length, max, min, mix, mx_noise_vec3, oneMinus, sin, smoothstep, step, uniform, uv, vec2, vec3, vec4,
} from 'three/tsl';

export const KIND = { DROP: 0, GERM: 1, MIST: 2, CONFETTI: 3, SPARK: 4 };
const G = 9.8 * 0.55; // جاذبية «بطيئة» قليلًا حتى يرى الطلاب القوس

/** المعادلة نفسها على المعالج المركزي (لحساب زمن الاصطدام) */
function at(out, p0, v0, k, gs, t) {
  const e = (1 - Math.exp(-k * t)) / k;
  const gy = -G * gs * (t / k - e / k);
  out[0] = p0[0] + v0[0] * e;
  out[1] = p0[1] + v0[1] * e + gy;
  out[2] = p0[2] + v0[2] * e;
  return out;
}

export class Spray {
  /**
   * @param {{count:number, gpu:boolean, time:any, size?:number}} o  time: uniform زمن المحاكاة (ثوانٍ)
   */
  constructor({ count, gpu, time, size = 1 }) {
    this.n = count;
    this.gpu = gpu;
    this.uTime = time;
    this.uSize = uniform(size);
    this.P = new Float32Array(count * 4); // p0.xyz, t0
    this.V = new Float32Array(count * 4); // v0.xyz, k
    this.S = new Float32Array(count * 4); // tStop, tEnd, kind, rnd
    for (let i = 0; i < count; i++) {
      this.P[i * 4 + 3] = -1e4; // لم تنطلق بعد
      this.S[i * 4 + 1] = -1e4;
      this.S[i * 4 + 3] = Math.random();
    }
    this.batch = new Int32Array(count).fill(-1);
    this.head = 0;
    this.nextBatch = 1;

    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
    let P, V, S, off = null;
    if (gpu) {
      this.PN = instancedArray(this.P, 'vec4');
      this.VN = instancedArray(this.V, 'vec4');
      this.SN = instancedArray(this.S, 'vec4');
      this.ON = instancedArray(count, 'vec4'); // إزاحة الاضطراب xyz + زمن الانطلاق الذي تخصّه
      this.uDt = uniform(0);
      const { PN, SN, ON, uDt } = this;
      const uT = this.uTime;
      // compute: الرذاذ الناعم يسبح في حقل ضجيج متصل فيصنع دوّامات ناعمة
      this.update = Fn(() => {
        const i = instanceIndex;
        const p = PN.element(i);
        const s = SN.element(i);
        const o = ON.element(i);
        If(abs(o.w.sub(p.w)).greaterThan(0.0001), () => {
          o.assign(vec4(0, 0, 0, p.w)); // جسيمة جديدة: صفّر الإزاحة
        }).Else(() => {
          const age = uT.sub(p.w);
          const mist = step(1.5, s.z).mul(step(s.z, 2.5)); // الرذاذ الناعم فقط
          const live = step(0.0, age).mul(mist);
          const q = p.xyz.add(o.xyz).mul(2.2).add(vec3(s.w.mul(9), uT.mul(0.25), s.w.mul(4)));
          const flow = mx_noise_vec3(q).mul(vec3(0.22, 0.1, 0.22));
          const lift = vec3(0, 0.025, 0); // دفء الأنفاس يرفعه قليلًا
          const nxt = o.xyz.add(flow.add(lift).mul(uDt).mul(live));
          o.assign(vec4(nxt.mul(0.999), o.w));
        });
      })().compute(count);
      P = PN.toAttribute();
      V = this.VN.toAttribute();
      S = SN.toAttribute();
      off = ON.toAttribute();
    } else {
      this.PA = new THREE.InstancedBufferAttribute(this.P, 4);
      this.VA = new THREE.InstancedBufferAttribute(this.V, 4);
      this.SA = new THREE.InstancedBufferAttribute(this.S, 4);
      P = instancedDynamicBufferAttribute(this.PA, 'vec4');
      V = instancedDynamicBufferAttribute(this.VA, 'vec4');
      S = instancedDynamicBufferAttribute(this.SA, 'vec4');
    }

    const kind = S.z;
    const rnd = S.w;
    const isMist = step(1.5, kind).mul(step(kind, 2.5));
    const isConf = step(2.5, kind).mul(step(kind, 3.5));
    const isGerm = step(0.5, kind).mul(step(kind, 1.5));
    const isSpark = step(3.5, kind);
    const age = this.uTime.sub(P.w);
    const t = clamp(age, 0, S.x);
    const k = max(V.w, 0.05);
    const e = oneMinus(exp(k.negate().mul(t))).div(k);
    const gs = mix(float(1), float(0.04), isMist);
    let pos = P.xyz.add(V.xyz.mul(e)).add(vec3(0, float(-G).mul(gs).mul(t.div(k).sub(e.div(k))), 0));
    if (off) pos = pos.add(off.xyz);
    else {
      // B: تموّج بسيط للرذاذ الناعم
      const w = vec3(sin(this.uTime.mul(0.9).add(rnd.mul(40))), sin(this.uTime.mul(0.6).add(rnd.mul(23))).mul(0.4), cos(this.uTime.mul(0.7).add(rnd.mul(31))));
      pos = pos.add(w.mul(0.05).mul(isMist).mul(smoothstep(0, 1.5, age)));
    }
    // القصاصات تتمايل وهي تسقط
    pos = pos.add(vec3(sin(age.mul(5).add(rnd.mul(30))), 0, cos(age.mul(4).add(rnd.mul(17)))).mul(0.06).mul(isConf));
    m.positionNode = pos;

    // الظهور والاختفاء
    const born = step(0, age);
    const fadeIn = smoothstep(0, 0.04, age);
    const fadeOut = oneMinus(smoothstep(S.y.sub(P.w).sub(0.7), S.y.sub(P.w), age));
    const alive = born.mul(fadeIn).mul(fadeOut);

    // الحجم (متر): قطرات مختلفة الأحجام، والجرثومة أكبر لتُرى، والرذاذ الناعم صغير
    const sz = mix(float(0.022), float(0.05), rnd.mul(rnd))
      .mul(mix(float(1), float(1.7), isGerm))
      .mul(mix(float(1), float(0.45), isMist))
      .mul(mix(float(1), float(2.4), isConf))
      .mul(mix(float(1), float(1.6), isSpark));
    m.scaleNode = sz.mul(this.uSize).mul(alive.mul(0.6).add(0.4)).mul(born);
    m.rotationNode = age.mul(rnd.sub(0.5).mul(9)).mul(isConf);

    // الشكل واللون: قطرة لؤلؤية بنواة ولمعة، وجرثومة خضراء بحافة شوكية داكنة (تُرى على الخلفية الفاتحة)
    const c = uv().sub(0.5);
    const d = length(c).mul(2);
    const ang = atan(c.y, c.x);
    const spikes = sin(ang.mul(9)).mul(0.08);
    const dropA = oneMinus(smoothstep(0.55, 1.0, d));
    const glint = oneMinus(smoothstep(0.0, 0.32, length(c.sub(vec2(-0.12, 0.12))).mul(2)));
    const pearl = mix(vec3(0.62, 0.8, 0.95), vec3(1.0, 0.98, 0.95), oneMinus(d)).mul(1.25).add(glint.mul(1.6));
    const germBody = oneMinus(smoothstep(0.62, 0.7, d.sub(spikes)));
    const germCore = oneMinus(smoothstep(0.0, 0.62, d.sub(spikes)));
    const germ = mix(vec3(0.08, 0.32, 0.05), vec3(0.6, 1.3, 0.22), germCore).add(glint.mul(0.6));
    const confSq = step(abs(c.x), 0.42).mul(step(abs(c.y), 0.24));
    const confCol = vec3(
      sin(rnd.mul(37)).mul(0.5).add(0.5),
      sin(rnd.mul(37).add(2.1)).mul(0.5).add(0.5),
      sin(rnd.mul(37).add(4.2)).mul(0.5).add(0.5),
    ).mul(0.9).add(0.15);
    const spark = oneMinus(smoothstep(0, 1, d)).pow(2).mul(3).add(oneMinus(smoothstep(0, 0.06, min(abs(c.x), abs(c.y)))).mul(oneMinus(d)).mul(2));
    const sparkCol = vec3(1.6, 1.2, 0.55);
    let col = mix(pearl, germ, isGerm);
    col = mix(col, vec3(0.85, 0.93, 1.0).mul(1.1), isMist);
    col = mix(col, confCol, isConf);
    col = mix(col, sparkCol.mul(spark.add(0.4)), isSpark);
    m.colorNode = col;
    let a = mix(dropA.mul(0.92), germBody, isGerm);
    a = mix(a, oneMinus(smoothstep(0.0, 1.0, d)).pow(1.5).mul(0.28), isMist);
    a = mix(a, confSq, isConf);
    a = mix(a, saturate1(spark), isSpark);
    m.opacityNode = a.mul(alive);
    this.material = m;
    this.object = new THREE.Sprite(m);
    this.object.count = count;
    this.object.frustumCulled = false;
    this.object.renderOrder = 20;
    this.drawCount = count;
  }

  /** عدد الجسيمات المرسومة (يخفّضه منظّم الجودة) */
  setDrawCount(n) {
    this.drawCount = Math.max(1, Math.min(this.n, n | 0));
    this.object.count = this.drawCount;
  }

  _flush() {
    if (this.gpu) {
      this.PN.value.needsUpdate = true;
      this.VN.value.needsUpdate = true;
      this.SN.value.needsUpdate = true;
    } else {
      this.PA.needsUpdate = true;
      this.VA.needsUpdate = true;
      this.SA.needsUpdate = true;
    }
  }

  /** كل إطار: الاضطراب على معالج الرسوم (الطبقة A فقط) */
  step(renderer, dt) {
    if (!this.gpu || this.noCompute) return;
    this.uDt.value = Math.min(dt, 0.05);
    renderer.compute(this.update);
  }

  _slot() {
    // حلقة دائرية ضمن العدد المرسوم: الأقدم يُستبدل
    const i = this.head;
    this.head = (this.head + 1) % this.drawCount;
    return i;
  }

  _write(i, p0, v0, k, t0, tStop, tEnd, kind, batch) {
    const j = i * 4;
    this.P[j] = p0[0]; this.P[j + 1] = p0[1]; this.P[j + 2] = p0[2]; this.P[j + 3] = t0;
    this.V[j] = v0[0]; this.V[j + 1] = v0[1]; this.V[j + 2] = v0[2]; this.V[j + 3] = k;
    this.S[j] = tStop; this.S[j + 1] = tEnd; this.S[j + 2] = kind;
    this.batch[i] = batch;
  }

  /**
   * عطسة أو سعلة: رشّة من الفم في اتجاه dir.
   * @param {object} o
   * @param {number[]} o.origin  موضع الفم
   * @param {number[]} o.dir     اتجاه (يُطبَّع)
   * @param {number} o.count     عدد الجسيمات (يُقيَّد بنسبة من العدد المرسوم)
   * @param {number} o.t0        زمن البداية (زمن المحاكاة)
   * @param {number} [o.power=1] قوة العطسة (1 عطسة، 0.6 سعلة)
   * @param {number} [o.spread=0.42] زاوية الانتشار (راديان)
   * @param {{c:number[], r:number}|null} [o.shield]  مرفق أو منديل يحجز الرذاذ
   * @param {{x0,x1,z0,z1,y}[]} [o.desks]  أسطح الطاولات
   * @param {{c:number[], r:number}[]} [o.heads]  رؤوس الزملاء
   * @param {number} [o.mistFrac=0.55] نسبة الرذاذ الناعم
   * @param {number} [o.germFrac=0.12] نسبة القطرات التي تحمل جراثيم ظاهرة
   * @param {number} [o.life=7] عمر الرذاذ الناعم بالثواني
   * @returns {number} رقم الدفعة (لمسحها لاحقًا)
   */
  sneeze(o) {
    const n = Math.min(Math.round(o.count), Math.floor(this.drawCount * 0.8));
    const batch = this.nextBatch++;
    const dir = norm(o.dir);
    const [ux, uy] = basis(dir);
    const power = o.power ?? 1;
    const spread = o.spread ?? 0.42;
    const mistFrac = o.mistFrac ?? 0.55;
    const germFrac = o.germFrac ?? 0.12;
    const life = o.life ?? 9;
    const tmp = [0, 0, 0];
    const prev = [0, 0, 0];
    const hits = { shield: 0, desk: 0, head: 0 };
    for (let q = 0; q < n; q++) {
      const i = this._slot();
      const mist = Math.random() < mistFrac;
      const kind = mist ? KIND.MIST : Math.random() < germFrac ? KIND.GERM : KIND.DROP;
      // اتجاه داخل مخروط: أكثر القطرات قرب المحور
      const r = spread * Math.sqrt(Math.random()) * (mist ? 1.25 : 1);
      const a = Math.random() * Math.PI * 2;
      const sr = Math.sin(r);
      const d = norm([
        dir[0] * Math.cos(r) + (ux[0] * Math.cos(a) + uy[0] * Math.sin(a)) * sr,
        dir[1] * Math.cos(r) + (ux[1] * Math.cos(a) + uy[1] * Math.sin(a)) * sr,
        dir[2] * Math.cos(r) + (ux[2] * Math.cos(a) + uy[2] * Math.sin(a)) * sr,
      ]);
      // مُعايَر على القياسات المنشورة: القطرات الكبيرة تسقط خلال ١–٢٫٥ م (أقل من ثانية لقطرة ١ مم)،
      // والرذاذ الناعم تحمله سحابة العطسة حتى ٣–٨ م ويبقى معلّقًا (Bourouiba 2020؛ منحنى Wells).
      const speed = power * (mist ? 3 + Math.random() * 4 : 4 + Math.random() * 5);
      const k = mist ? 0.6 + Math.random() * 0.6 : 2.4 + Math.random() * 2.0;
      const v0 = [d[0] * speed, d[1] * speed, d[2] * speed];
      const t0 = o.t0 + Math.random() * 0.12 * (mist ? 2 : 1);
      const p0 = [o.origin[0] + (Math.random() - 0.5) * 0.03, o.origin[1] + (Math.random() - 0.5) * 0.02, o.origin[2] + (Math.random() - 0.5) * 0.03];
      const gs = mist ? 0.04 : 1;
      // أول اصطدام: خطوات صغيرة بالمعادلة نفسها (سريعة: تُحسب مرة لكل عطسة)
      let tStop = 30;
      let stuck = false;
      prev[0] = p0[0]; prev[1] = p0[1]; prev[2] = p0[2];
      const T = mist ? 6 : 2.2;
      const dt = mist ? 1 / 20 : 1 / 120;
      for (let tt = dt; tt <= T; tt += dt) {
        at(tmp, p0, v0, k, gs, tt);
        if (o.shield && dist2(tmp, o.shield.c) < o.shield.r * o.shield.r) {
          tStop = tt; stuck = true; hits.shield++; break;
        }
        if (!mist && o.heads) {
          let hit = false;
          for (const h of o.heads) if (dist2(tmp, h.c) < h.r * h.r) { hit = true; break; }
          if (hit) { tStop = tt; stuck = true; hits.head++; break; }
        }
        if (o.desks) {
          let hit = false;
          for (const D of o.desks) {
            if (prev[1] >= D.y && tmp[1] < D.y && tmp[0] > D.x0 && tmp[0] < D.x1 && tmp[2] > D.z0 && tmp[2] < D.z1) {
              const f = (prev[1] - D.y) / Math.max(1e-6, prev[1] - tmp[1]);
              tStop = tt - dt * (1 - f); hit = true; break;
            }
          }
          if (hit) { stuck = true; hits.desk++; break; }
        }
        if (tmp[1] < 0.01) {
          const f = prev[1] / Math.max(1e-6, prev[1] - tmp[1]);
          tStop = tt - dt * (1 - f); stuck = true; break;
        }
        prev[0] = tmp[0]; prev[1] = tmp[1]; prev[2] = tmp[2];
      }
      // القطرات العالقة على الأسطح تبقى حتى تُمسح؛ الرذاذ الناعم يتلاشى في الهواء
      const tEnd = mist ? t0 + life * (0.6 + Math.random() * 0.4) : stuck ? t0 + 600 : t0 + 3;
      this._write(i, p0, v0, k, t0, tStop, tEnd, kind, batch);
    }
    this._flush();
    this.lastHits = hits;
    return batch;
  }

  /** نقاط ثابتة (جراثيم على يد أو طاولة أو قنينة) */
  dots(points, { t0, kind = KIND.GERM, life = 600 } = {}) {
    const batch = this.nextBatch++;
    for (const p of points) {
      const i = this._slot();
      this._write(i, p, [0, 0, 0], 1, t0 + Math.random() * 0.25, 0, t0 + life, kind, batch);
    }
    this._flush();
    return batch;
  }

  /** انفجار صغير (بريق أو قصاصات) من نقطة */
  burst(origin, { t0, count = 60, kind = KIND.SPARK, speed = 2.2, up = 1.2, life = 1.6, spread = Math.PI } = {}) {
    const batch = this.nextBatch++;
    const n = Math.min(count, Math.floor(this.drawCount * 0.3));
    for (let q = 0; q < n; q++) {
      const i = this._slot();
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.2) * spread * 0.5;
      const s = speed * (0.4 + Math.random() * 0.8);
      const v = [Math.cos(a) * Math.cos(el) * s, Math.abs(Math.sin(el)) * s + up * (0.5 + Math.random()), Math.sin(a) * Math.cos(el) * s];
      const k = kind === KIND.CONFETTI ? 1.6 : 2.6;
      this._write(i, origin, v, k, t0 + Math.random() * 0.1, kind === KIND.CONFETTI ? 30 : life, t0 + life * (0.7 + Math.random() * 0.5), kind, batch);
    }
    this._flush();
    return batch;
  }

  /** مطر قصاصات فوق مستطيل أفقي */
  rain(box, { t0, count = 400, life = 4 } = {}) {
    const batch = this.nextBatch++;
    const n = Math.min(count, Math.floor(this.drawCount * 0.6));
    for (let q = 0; q < n; q++) {
      const i = this._slot();
      const p = [box.x0 + Math.random() * (box.x1 - box.x0), box.y + Math.random() * 0.6, box.z0 + Math.random() * (box.z1 - box.z0)];
      const v = [(Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6];
      // سقوط بطيء بمقاومة عالية (حدّ السرعة ≈ g/k)
      this._write(i, p, v, 3.2, t0 + Math.random() * 1.2, 30, t0 + life + Math.random(), KIND.CONFETTI, batch);
    }
    this._flush();
    return batch;
  }

  /**
   * يُخفي دفعة (أو كل شيء): fade في زمن tAt، أو «مسح» يمرّ على المحور x من xFrom إلى xTo خلال dur.
   */
  clear({ batch = null, tAt, sweep = null } = {}) {
    for (let i = 0; i < this.n; i++) {
      if (batch !== null && this.batch[i] !== batch) continue;
      const j = i * 4;
      if (this.S[j + 1] < tAt) continue; // انتهت أصلًا
      let te = tAt + 0.7;
      if (sweep) {
        // موضع الجسيمة الآن (المتوقفة) لمعرفة متى تمرّ الإسفنجة عليها
        const x = this.P[j] + this.V[j] * (1 - Math.exp(-this.V[j + 3] * this.S[j])) / this.V[j + 3];
        const f = Math.min(1, Math.max(0, (x - sweep.xFrom) / (sweep.xTo - sweep.xFrom)));
        te = tAt + f * sweep.dur + 0.35;
      }
      this.S[j + 1] = Math.min(this.S[j + 1], te);
    }
    this._flush();
  }

  dispose() {
    this.material.dispose();
  }
}

function saturate1(x) {
  return clamp(x, 0, 1);
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function basis(d) {
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(d, up));
  const y = cross(x, d);
  return [x, y];
}
function dist2(a, b) {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

/**
 * غبار ضوء يسبح ببطء في أشعة النوافذ (زينة دائمة: «المشهد لا يتجمّد أبدًا»).
 */
export function motes({ count, box, time }) {
  const P = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    P[i * 4] = box.x0 + Math.random() * (box.x1 - box.x0);
    P[i * 4 + 1] = box.y0 + Math.random() * (box.y1 - box.y0);
    P[i * 4 + 2] = box.z0 + Math.random() * (box.z1 - box.z0);
    P[i * 4 + 3] = Math.random();
  }
  const A = new THREE.InstancedBufferAttribute(P, 4);
  const p = instancedDynamicBufferAttribute(A, 'vec4');
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const r = p.w;
  m.positionNode = p.xyz.add(vec3(sin(time.mul(0.21).add(r.mul(50))), sin(time.mul(0.13).add(r.mul(31))).mul(0.6), cos(time.mul(0.17).add(r.mul(77)))).mul(0.18));
  m.scaleNode = mix(float(0.008), float(0.02), r);
  const d = length(uv().sub(0.5)).mul(2);
  const tw = sin(time.mul(1.3).add(r.mul(90))).mul(0.5).add(0.5);
  m.colorNode = vec3(1.0, 0.92, 0.72).mul(1.2);
  m.opacityNode = oneMinus(smoothstep(0.0, 1.0, d)).mul(tw.mul(0.5).add(0.25));
  const s = new THREE.Sprite(m);
  s.count = count;
  s.frustumCulled = false;
  s.renderOrder = 15;
  return s;
}
