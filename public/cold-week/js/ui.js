// ---------------------------------------------------------------------------
// طبقة البطاقات ثلاثية الأبعاد (فوق الصف وتحت نصوص HTML): لوحات بطاقات من مينا لؤلؤية
// بحافة ذهبية، وعلى كل لوحة مجسّم الحل يدور ببطء (models.js)، وموضع الإفلات حلقة ذهبية
// بقرص زجاجي. عند وضع الحل الصحيح: المجسّم يطير من اليد في قوس تتبعه شرارات، ثم يشتعل
// لهب سينمائي (مظلّل TSL) مع موجة صدمة وجمرات وومضة ضوء، ويستقر المجسّم في الحلقة.
//
// الأهداف تبقى عناصر HTML (game.js): هذه الطبقة تقرأ مواضعها كل إطار وترسم تحتها،
// فإن تعطّل 3D بقيت اللعبة تعمل (الطبقة C تعرض صورًا مُصيَّرة مسبقًا من هذه المجسّمات).
// الإحداثيات بوحدة المسرح u: كاميرا متعامدة، النقطة (x, −y) تظهر عند (x, y).
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  abs, color, float, mix, mx_fractal_noise_float, mx_noise_float, oneMinus, sin, smoothstep, time, uniform, uv, vec3,
  instancedDynamicBufferAttribute, length,
} from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildCardModel, CARD_MODEL_IDS } from './models.js';

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

/** لهب: ضجيج متعدد الطبقات يصعد، يضيق نحو الأعلى، بتدرّج من الأحمر إلى الأبيض (ألوان HDR تتوهّج) */
function fireMaterial(uK, seed) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const p = uv();
  const y = p.y;
  const n1 = mx_fractal_noise_float(vec3(p.x.mul(3.0), y.mul(2.2).sub(time.mul(2.4)), seed), 3, 2.0, 0.5);
  const n2 = mx_noise_float(vec3(p.x.mul(7.0), y.mul(5.0).sub(time.mul(3.6)), seed + 3.1));
  const x = p.x.sub(0.5).add(n1.mul(0.2).mul(y.add(0.15)));
  const width = mix(float(0.42), float(0.02), y.pow(0.8)).mul(uK.mul(0.35).add(0.65));
  const body = smoothstep(width, width.mul(0.2), abs(x));
  const top = oneMinus(smoothstep(0.35, 0.95, y.add(n2.mul(0.22)).div(uK.mul(0.6).add(0.4))));
  const base = smoothstep(0.0, 0.07, y);
  const heat = body.mul(top).mul(base).mul(uK).clamp(0, 1);
  let c = mix(vec3(0.8, 0.08, 0.02), vec3(1.0, 0.42, 0.04), smoothstep(0.08, 0.42, heat));
  c = mix(c, vec3(1.0, 0.82, 0.3), smoothstep(0.42, 0.72, heat));
  c = mix(c, vec3(1.0, 0.98, 0.88), smoothstep(0.78, 0.97, heat));
  m.colorNode = c.mul(heat.mul(3.2).add(0.25));
  m.opacityNode = smoothstep(0.02, 0.2, heat);
  return m;
}

/** جمرات وشرارات: نقاط مضيئة بمسار تحليلي (لا تحديث على المعالج المركزي إلا عند الإطلاق) */
class Embers {
  constructor(n, uT) {
    this.n = n;
    this.A = new Float32Array(n * 4); // x0, y0, t0, seed
    this.B = new Float32Array(n * 4); // vx, vy, life, size
    // جمرات غير مُطلقة: عمر ١ وحجم ٠ (عمر صفري يجعل القسمة غير معرّفة فتغطي الشاشة)
    for (let i = 0; i < n; i++) {
      this.A[i * 4 + 2] = -1e4;
      this.B[i * 4 + 2] = 1;
    }
    this.aA = new THREE.InstancedBufferAttribute(this.A, 4);
    this.aB = new THREE.InstancedBufferAttribute(this.B, 4);
    const a = instancedDynamicBufferAttribute(this.aA, 'vec4');
    const b = instancedDynamicBufferAttribute(this.aB, 'vec4');
    const age = uT.sub(a.z);
    const alive = age.greaterThan(0).and(age.lessThan(b.z)).select(1, 0);
    const k = age.div(b.z.max(0.01)).clamp(0, 1);
    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const wob = sin(age.mul(9).add(a.w.mul(40))).mul(6);
    m.positionNode = vec3(a.x.add(b.x.mul(age)).add(wob), a.y.add(b.y.mul(age)).add(age.mul(age).mul(-60)), 40);
    m.scaleNode = b.w.mul(oneMinus(k).mul(0.7).add(0.3)).mul(alive);
    const d = length(uv().sub(0.5)).mul(2);
    const core = oneMinus(smoothstep(0.0, 1.0, d)).pow(2);
    m.colorNode = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.35, 0.05), k).mul(core.mul(4).add(0.3));
    m.opacityNode = core.mul(oneMinus(k)).mul(alive);
    this.object = new THREE.Sprite(m);
    this.object.count = n;
    this.object.frustumCulled = false;
    this.object.renderOrder = 30;
    this.head = 0;
  }
  emit(x, y, t, count, { speed = 260, up = 220, life = 1.1, size = 14, spread = Math.PI * 2, dir = -Math.PI / 2 } = {}) {
    for (let q = 0; q < count; q++) {
      const i = this.head;
      this.head = (this.head + 1) % this.n;
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.A.set([x + (Math.random() - 0.5) * 10, -y + (Math.random() - 0.5) * 10, t + Math.random() * 0.06, Math.random()], i * 4);
      this.B.set([Math.cos(a) * s, -Math.sin(a) * s + up * Math.random(), life * (0.5 + Math.random() * 0.7), size * (0.5 + Math.random())], i * 4);
    }
    this.aA.needsUpdate = true;
    this.aB.needsUpdate = true;
  }
}

export class UILayer {
  /**
   * @param {{tier:string, environment:THREE.Texture}} o
   */
  constructor({ tier, environment }) {
    this.tier = tier;
    this.scene = new THREE.Scene();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.55;
    // كاميرا متعامدة بمدى عمق موجب (المدى السالب يعطّل اختبار العمق في بعض المحرّكات)
    this.camera = new THREE.OrthographicCamera(0, 1600, 0, -1000, 1, 4000);
    this.camera.position.z = 2000;
    this.uT = uniform(0);
    this.t = 0;
    // إضاءة استوديو: مفتاح علوي أيسر، وملء بارد، وضوء خلفي للحافة
    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb8a27e, 0.65));
    const key = new THREE.DirectionalLight(0xfff3e0, 1.7);
    key.position.set(-0.45, 0.75, 1);
    const fill = new THREE.DirectionalLight(0xdcebff, 0.55);
    fill.position.set(0.7, -0.2, 0.8);
    const rimL = new THREE.DirectionalLight(0xffe2a8, 1.2);
    rimL.position.set(0.2, 0.9, -0.6);
    this.scene.add(key, fill, rimL);
    this.flash = new THREE.PointLight(0xffa040, 0, 700, 0); // بلا تضاؤل فيزيائي: الوحدات هنا u
    this.scene.add(this.flash);

    this.cards = new Map(); // key -> {plate, rim, model, modelId, uOp, uHint, ...}
    this.wells = new Map(); // team -> well
    this.models = new Map(); // `${key}:${id}` -> model
    this.flights = [];
    this.source = () => ({ cards: [], wells: [] });
    this.embers = new Embers(tier === 'A' ? 900 : 300, this.uT);
    this.scene.add(this.embers.object);
    this._plateGeo = new Map();
    this.M = {
      plate: () => {
        const m = new THREE.MeshPhysicalNodeMaterial({ color: 0xf1ebdf, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff1d6), transparent: true });
        return m;
      },
      gold: new THREE.MeshPhysicalNodeMaterial({ color: 0xe2b25c, metalness: 1, roughness: 0.22 }),
      shadow: (() => {
        const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        const d = length(uv().sub(0.5)).mul(2);
        m.colorNode = vec3(0.25, 0.16, 0.06);
        m.opacityNode = oneMinus(smoothstep(0.0, 1.0, d)).pow(1.6).mul(0.38);
        return m;
      })(),
    };
  }

  layout(VW, VH) {
    this.VW = VW;
    this.VH = VH;
    const c = this.camera;
    c.left = 0;
    c.right = VW;
    c.top = 0;
    c.bottom = -VH;
    c.updateProjectionMatrix();
  }

  _geoPlate(w, h) {
    const k = `${Math.round(w / 4)}x${Math.round(h / 4)}`;
    let g = this._plateGeo.get(k);
    if (!g) {
      g = new RoundedBoxGeometry(Math.round(w / 4) * 4, Math.round(h / 4) * 4, 22, 5, 24);
      this._plateGeo.set(k, g);
    }
    return g;
  }

  _model(key, id) {
    const k = `${key}:${id}`;
    let m = this.models.get(k);
    if (!m) {
      m = buildCardModel(id);
      this.models.set(k, m);
    }
    return m;
  }

  /** بطاقة 3D لكل بطاقة HTML: لوحة + شريط ذهبي + مجسّم */
  _card(key) {
    let C = this.cards.get(key);
    if (C) return C;
    const uOp = uniform(1);
    const uHint = uniform(0);
    const uTeam = uniform(new THREE.Color(0xe2b25c));
    const plateMat = this.M.plate();
    plateMat.opacityNode = uOp;
    plateMat.emissiveNode = vec3(1.0, 0.72, 0.2).mul(uHint.mul(sin(time.mul(7)).mul(0.5).add(0.5)).mul(0.55));
    const rimMat = new THREE.MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.25, transparent: true });
    rimMat.colorNode = uTeam;
    rimMat.opacityNode = uOp;
    rimMat.emissiveNode = vec3(1.0, 0.75, 0.25).mul(uHint.mul(sin(time.mul(7)).mul(0.5).add(0.5)));
    const g = new THREE.Group();
    const plate = new THREE.Mesh(this._geoPlate(100, 100), plateMat);
    const rim = new THREE.Mesh(this._geoPlate(100, 100), rimMat);
    const bar = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.3), rimMat);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.M.shadow);
    const holder = new THREE.Group();
    g.add(rim, plate, bar, shadow, holder);
    this.scene.add(g);
    C = { key, g, plate, rim, bar, shadow, holder, uOp, uHint, uTeam, op: 1, hint: 0, model: null, modelId: null, spin: Math.random() * 6, pop: 0, hover: 0 };
    this.cards.set(key, C);
    return C;
  }

  /** حلقة الإفلات: ذهب وزجاج، تتوهّج حين تقترب يد تحمل بطاقة */
  _well(team) {
    let W = this.wells.get(team);
    if (W) return W;
    const uGlow = uniform(0);
    const uFire = uniform(0);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 24, 96), this.M.gold);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.025, 12, 96), this.M.gold);
    const discMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.92 });
    const d = length(uv().sub(0.5)).mul(2);
    discMat.colorNode = mix(color(0x2a6f6a), color(0x0e3b3a), d);
    discMat.emissiveNode = vec3(1.0, 0.7, 0.25).mul(oneMinus(d).pow(1.5).mul(uGlow.mul(0.9).add(uFire.mul(1.6))));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.94, 64), discMat);
    disc.position.z = -6 / 100;
    // نقش متحرك داخل القرص: نجمة ثمانية رفيعة ذهبية
    const star = new THREE.Group();
    for (const r of [0, Math.PI / 4]) {
      const sq = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 4), this.M.gold);
      sq.rotation.z = r;
      star.add(sq);
    }
    star.position.z = 0.02;
    const glowMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const gd = length(uv().sub(0.5)).mul(2);
    glowMat.colorNode = vec3(1.0, 0.72, 0.28).mul(2);
    glowMat.opacityNode = smoothstep(1.0, 0.55, gd).mul(smoothstep(0.35, 0.62, gd)).mul(uGlow.mul(0.7).add(uFire.mul(0.9)));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowMat);
    glow.position.z = -0.1;
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fireMaterial(uFire, team === 'b' ? 7.3 : 1.7));
    fire.renderOrder = 25;
    const fire2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fireMaterial(uFire.mul(0.8), team === 'b' ? 4.1 : 9.2));
    fire2.renderOrder = 24;
    const shockMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const uShock = uniform(0);
    shockMat.colorNode = vec3(1.0, 0.8, 0.4).mul(2.5);
    shockMat.opacityNode = oneMinus(uShock).mul(uShock.greaterThan(0.001).select(1, 0)).mul(0.9);
    const shock = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 96), shockMat);
    const holder = new THREE.Group();
    holder.position.z = 0.6;
    const ringGroup = new THREE.Group();
    ringGroup.add(glow, disc, star, inner, ring, shock);
    g.add(ringGroup, holder, fire2, fire);
    this.scene.add(g);
    W = { team, g, ringGroup, ring, star, glow, fire, fire2, shock, holder, uGlow, uFire, uShock, glowV: 0, fireT: -1, model: null, modelId: null, r: 60, cx: 0, cy: 0 };
    this.wells.set(team, W);
    return W;
  }

  /** الحل الصحيح: المجسّم يطير من اليد إلى الحلقة، ثم اللهب */
  place(team, id, from) {
    const W = this._well(team);
    this.clearWell(team, true);
    const m = buildCardModel(id);
    this.scene.add(m);
    const s0 = W.r * 0.75;
    m.scale.setScalar(s0 * 0.75);
    m.position.set(from.x, -from.y, 120);
    this.flights.push({ W, m, id, t0: this.t, dur: 0.62, from: { x: from.x, y: from.y }, s0 });
    return 0.62;
  }

  clearWell(team, now = false) {
    const W = this.wells.get(team);
    if (!W) return;
    if (W.model) {
      const m = W.model;
      W.model = null;
      if (now) W.holder.remove(m);
      else W.leaving = { m, t0: this.t };
    }
    this.flights = this.flights.filter((f) => {
      if (f.W !== W) return true;
      this.scene.remove(f.m);
      return false;
    });
  }

  /** حرارة خفيفة على الحلقة عند الخطأ (تهتز ولا لهب) */
  nudge(team) {
    const W = this.wells.get(team);
    if (W) W.nudgeT = this.t;
  }

  _ignite(W) {
    W.fireT = this.t;
    W.uShock.value = 0.001;
    this.embers.emit(W.cx, W.cy, this.t, this.tier === 'A' ? 220 : 80, { speed: 380, up: 300, life: 1.4, size: 18 });
    this.onIgnite?.(W.team);
  }

  /** كل إطار: مزامنة المواضع مع HTML، والحركة، واللهب */
  update(dt) {
    this.t += dt;
    this.uT.value = this.t;
    const t = this.t;
    const src = this.source() || { cards: [], wells: [] };
    const seen = new Set();
    for (const c of src.cards) {
      seen.add(c.key);
      const C = this._card(c.key);
      const r = c.rect;
      C.g.visible = true;
      C.g.position.set(r.x + r.w / 2, -(r.y + r.h / 2) + C.hover * 4, 0);
      C.g.scale.setScalar(1 + C.hover * 0.03);
      const plateG = this._geoPlate(r.w - 8, r.h - 8);
      if (C.plate.geometry !== plateG) {
        C.plate.geometry = plateG;
        C.rim.geometry = this._geoPlate(r.w, r.h);
        C.rim.position.z = -6;
      }
      C.bar.scale.set(r.w - 70, 9, 10);
      C.bar.position.set(0, r.h / 2 - 15, 12);
      C.uTeam.value.set(c.teamColor || 0xe2b25c);
      const opT = c.taken ? 0.25 : c.wait ? 0.62 : 1;
      C.op += (opT - C.op) * (1 - Math.exp(-dt * 10));
      C.uOp.value = C.op;
      C.hint += ((c.hint ? 1 : 0) - C.hint) * (1 - Math.exp(-dt * 8));
      C.uHint.value = C.hint;
      C.hover += ((c.hover ? 1 : 0) - C.hover) * (1 - Math.exp(-dt * 10));
      // المجسّم على موضع الرمز في البطاقة
      if (C.modelId !== c.model) {
        if (C.model) C.holder.remove(C.model);
        C.model = c.model ? this._model(c.key, c.model) : null;
        C.modelId = c.model;
        if (C.model) {
          C.holder.add(C.model);
          C.pop = 0;
        }
      }
      if (C.model) {
        const ir = c.icon;
        const size = Math.min(ir.w, ir.h) * 0.62;
        C.pop = Math.min(1, C.pop + dt * 2.6);
        const k = easeBack(C.pop) * (1 + C.hover * 0.14);
        C.holder.position.set(ir.x + ir.w / 2 - (r.x + r.w / 2), -(ir.y + ir.h / 2 - (r.y + r.h / 2)) + Math.sin(t * 2 + C.spin) * 3, 70);
        C.holder.scale.setScalar(size * k);
        C.spin += dt * (0.35 + C.hover * 2.2);
        C.model.rotation.y = Math.sin(C.spin) * 0.55;
        C.model.visible = !c.taken;
        C.shadow.visible = !c.taken;
        C.shadow.position.set(C.holder.position.x, C.holder.position.y - size * 0.85, 14);
        C.shadow.scale.set(size * 1.7, size * 0.5, 1);
      } else C.shadow.visible = false;
    }
    for (const [k, C] of this.cards) if (!seen.has(k)) C.g.visible = false;

    // حلقات الإفلات
    const seenW = new Set();
    for (const w of src.wells) {
      seenW.add(w.team);
      const W = this._well(w.team);
      const r = w.rect;
      W.g.visible = true;
      W.cx = r.x + r.w / 2;
      W.cy = r.y + r.h / 2;
      W.r = Math.min(r.w, r.h) * 0.4;
      let shake = 0;
      if (W.nudgeT != null && t - W.nudgeT < 0.45) shake = Math.sin((t - W.nudgeT) * 50) * 8 * (1 - (t - W.nudgeT) / 0.45);
      W.g.position.set(W.cx + shake, -W.cy, 0);
      W.ringGroup.scale.setScalar(W.r);
      W.star.rotation.z = t * 0.25;
      W.glowV += ((w.hot ? 1 : 0.18) - W.glowV) * (1 - Math.exp(-dt * 6));
      W.uGlow.value = W.glowV * (0.85 + 0.15 * Math.sin(t * 4));
      W.ringGroup.position.z = 10;
      // اللهب: اشتعال سريع، ثم يخبو
      if (W.fireT >= 0) {
        const a = t - W.fireT;
        // اشتعال: انفجار سريع أكبر من الحلقة، ثم لهب ثابت يتراقص، ثم يخبو
        const env = a < 0.14 ? easeOut(a / 0.14) : a < 1.0 ? 1 : Math.max(0, 1 - (a - 1.0) / 1.0);
        const burst = a < 0.45 ? 1 + 0.55 * Math.sin((a / 0.45) * Math.PI) : 1;
        W.uFire.value = env;
        const fh = W.r * 5.6 * (0.5 + 0.5 * env) * burst;
        W.fire.scale.set(W.r * 3.4 * burst, fh, 1);
        W.fire.position.set(0, fh / 2 - W.r * 0.95, 80);
        W.fire2.scale.set(W.r * 4.4 * burst, fh * 0.78, 1);
        W.fire2.position.set(0, fh * 0.39 - W.r * 0.9, 78);
        W.fire.visible = W.fire2.visible = env > 0.002;
        if (a < 1.4 && Math.random() < 0.6) this.embers.emit(W.cx, W.cy - W.r * 0.3, t, this.tier === 'A' ? 4 : 2, { speed: 90, up: 300, life: 1.1, size: 11, spread: 1.2 });
        const sh = Math.min(1, a / 0.55);
        W.uShock.value = a < 0.55 ? Math.max(0.001, sh) : 0;
        W.shock.scale.setScalar(1 + easeOut(sh) * 1.4);
        this.flash.position.set(W.cx, -W.cy, 160);
        this.flash.intensity = Math.max(this.flash.intensity * 0.92, env * (a < 0.3 ? 5 : 2.5));
        if (env <= 0) W.fireT = -1;
      } else {
        W.uFire.value = 0;
        W.fire.visible = W.fire2.visible = false;
      }
      // المجسّم المستقر في الحلقة يدور وينبض
      if (W.model) {
        const k = Math.min(1, (t - W.modelT) / 0.5);
        W.holder.scale.setScalar(W.r * 0.78 * easeBack(k));
        W.model.rotation.y += dt * 1.1;
        W.holder.position.set(0, Math.sin(t * 2.3) * 3, 120);
      }
      if (W.leaving) {
        const k = Math.min(1, (t - W.leaving.t0) / 0.35);
        W.leaving.m.scale.setScalar(Math.max(0.001, 1 - easeIO(k)));
        if (k >= 1) {
          W.holder.remove(W.leaving.m);
          W.leaving = null;
        }
      }
    }
    for (const [k, W] of this.wells) if (!seenW.has(k)) W.g.visible = false;
    this.flash.intensity *= 0.9;

    // الطيران من اليد إلى الحلقة في قوس، مع شرارات
    this.flights = this.flights.filter((f) => {
      const p = Math.min(1, (t - f.t0) / f.dur);
      const e = easeIO(p);
      const tx = f.W.cx;
      const ty = f.W.cy;
      const x = f.from.x + (tx - f.from.x) * e;
      const y = f.from.y + (ty - f.from.y) * e - Math.sin(p * Math.PI) * 160;
      f.m.position.set(x, -y, 150);
      f.m.rotation.y = p * Math.PI * 3;
      f.m.rotation.z = Math.sin(p * Math.PI) * 0.5;
      f.m.scale.setScalar(f.s0 * (0.75 + 0.35 * Math.sin(p * Math.PI)));
      if (Math.random() < 0.9) this.embers.emit(x, y, t, this.tier === 'A' ? 5 : 2, { speed: 40, up: 60, life: 0.6, size: 12 });
      if (p >= 1) {
        this.scene.remove(f.m);
        f.m.scale.setScalar(1);
        f.m.position.set(0, 0, 0);
        f.m.rotation.set(0, 0, 0);
        f.W.holder.add(f.m);
        f.W.model = f.m;
        f.W.modelId = f.id;
        f.W.modelT = t;
        this._ignite(f.W);
        return false;
      }
      return true;
    });
  }

  /** وضع تصيير صور الطبقة C: كل المجسّمات في شبكة على خلفية بيضاء */
  gallery(cell = 200, cols = 10) {
    CARD_MODEL_IDS.forEach((id, i) => {
      const m = buildCardModel(id);
      m.position.set((i % cols) * cell + cell / 2, -(Math.floor(i / cols) * cell + cell / 2), 0);
      m.scale.setScalar(cell * 0.42);
      m.rotation.y = 0.3;
      this.scene.add(m);
    });
    this.source = () => ({ cards: [], wells: [] });
    this.galleryIds = CARD_MODEL_IDS;
    return CARD_MODEL_IDS;
  }
}

