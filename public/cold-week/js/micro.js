// ---------------------------------------------------------------------------
// «داخل قطرة رذاذ»: عالم مجهري تدخله الكاميرا في منتصف الأسبوع.
// كرة ماء نحن في داخلها: جدار مائي بتموّجات ضوئية (caustics) تتحرك، وأشعة ضوء، وفقاعات متقزّحة،
// وجراثيم ثلاثية الأبعاد (models.js) تسبح وتدور وتنبض بضوء أخضر. الكاميرا تتقدّم ببطء بينها.
// يُرسم بدل الصف في مرور ذلك الصف فقط (scene3d.js)، فلا يتأثر نصف المنافس في السباق.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  abs, color, dot, float, mix, mx_fractal_noise_float, mx_worley_noise_float, normalView, positionViewDirection,
  positionWorld, sin, smoothstep, time, uv, vec3,
} from 'three/tsl';
import { germ } from './models.js';

/** فيروس الزكام (للتنويع): كرة بنفسجية بنتوءات قصيرة كثيرة */
function virus(r) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshPhysicalNodeMaterial({ color: 0x8b5cf6, roughness: 0.35, clearcoat: 0.8, emissive: new THREE.Color(0x5b21b6), emissiveIntensity: 0.6 }));
  g.add(body);
  const knob = new THREE.SphereGeometry(0.16, 10, 8);
  const km = new THREE.MeshPhysicalNodeMaterial({ color: 0xf0abfc, roughness: 0.3, emissive: new THREE.Color(0xc026d3), emissiveIntensity: 0.8 });
  const ico = new THREE.IcosahedronGeometry(1.05, 1).attributes.position;
  const seen = new Set();
  for (let i = 0; i < ico.count; i++) {
    const v = new THREE.Vector3(ico.getX(i), ico.getY(i), ico.getZ(i));
    const k = v.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(k)) continue;
    seen.add(k);
    const k2 = new THREE.Mesh(knob, km);
    k2.position.copy(v);
    g.add(k2);
  }
  g.scale.setScalar(r);
  return g;
}

export class MicroWorld {
  constructor(tier) {
    this.scene = new THREE.Scene();
    this.tier = tier;
    // الجدار المائي من الداخل: أزرق مخضرّ عميق، وتموّجات ضوئية خلوية تتحرك، وحافة أفتح
    const wall = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
    const p = positionWorld.mul(0.55);
    const c1 = mx_worley_noise_float(p.add(vec3(time.mul(0.12), time.mul(0.08), 0)));
    const c2 = mx_worley_noise_float(p.mul(1.7).sub(vec3(0, time.mul(0.1), time.mul(0.07))));
    const caust = smoothstep(0.06, 0.0, c1).add(smoothstep(0.05, 0.0, c2).mul(0.6));
    const dir = positionWorld.normalize();
    const deep = mix(color(0x0b3d52), color(0x1f8fa8), smoothstep(-0.6, 0.8, dir.y));
    const haze = mx_fractal_noise_float(p.mul(0.6).add(vec3(0, 0, time.mul(0.05))), 3, 2, 0.5).mul(0.08);
    wall.colorNode = deep.add(vec3(0.55, 0.95, 1.0).mul(caust.mul(0.85))).add(haze);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(14, 64, 40), wall);
    this.scene.add(sphere);

    // أشعة ضوء تخترق القطرة من الأعلى
    const rayMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const f = abs(dot(normalView, positionViewDirection)).pow(1.5);
    rayMat.colorNode = vec3(0.7, 0.95, 1.0);
    rayMat.opacityNode = f.mul(smoothstep(0.0, 0.5, uv().y)).mul(0.12).mul(sin(time.mul(0.6).add(positionWorld.x)).mul(0.25).add(0.75));
    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.1, 16, 24, 1, true), rayMat);
      ray.position.set(-4 + i * 2.1, 3, -5 - i * 1.3);
      ray.rotation.set(0.25, 0, -0.3 + i * 0.12);
      this.scene.add(ray);
    }

    // الجراثيم: خضراء شائكة وبنفسجية (فيروسات)، تتوهّج قليلًا فتتفتّح في التوهّج
    this.germs = [];
    const n = tier === 'A' ? 18 : 10;
    for (let i = 0; i < n; i++) {
      const g = i % 3 === 2 ? virus(0.28 + Math.random() * 0.18) : germ(0.32 + Math.random() * 0.25);
      g.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3.2, -1.5 - Math.random() * 11);
      g.userData = { spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.4), bob: Math.random() * 6, base: g.position.clone(), s: g.scale.x };
      this.scene.add(g);
      this.germs.push(g);
    }
    // فقاعات صغيرة متقزّحة
    const bub = new THREE.MeshPhysicalNodeMaterial({ color: 0xe6fbff, roughness: 0.02, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [200, 700], transparent: true, opacity: 0.35, depthWrite: false, clearcoat: 1 });
    const nb = tier === 'A' ? 70 : 30;
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), bub, nb);
    this.bubbleData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) {
      const d = { p: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5, -Math.random() * 13), r: 0.03 + Math.random() * 0.12, v: 0.15 + Math.random() * 0.35 };
      this.bubbleData.push(d);
      m.makeScale(d.r, d.r, d.r).setPosition(d.p);
      this.bubbles.setMatrixAt(i, m);
    }
    this.scene.add(this.bubbles);
    // عوالق مضيئة دقيقة
    const motesMat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    motesMat.colorNode = vec3(0.7, 1.0, 0.95);
    motesMat.sizeNode = float(2.5);
    const mp = new Float32Array(600 * 3).map((_, i) => (i % 3 === 2 ? -Math.random() * 13 : (Math.random() - 0.5) * (i % 3 === 0 ? 10 : 6)));
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.scene.add(new THREE.Points(mg, motesMat));

    // إضاءة: ضوء علوي بارد، وضوء أخضر خافت يلوّن الجراثيم من الأسفل
    this.scene.add(new THREE.HemisphereLight(0xbff4ff, 0x0b3d52, 1.4));
    const key = new THREE.DirectionalLight(0xe8fbff, 2.2);
    key.position.set(-1, 3, 2);
    this.scene.add(key);
    const glow = new THREE.PointLight(0x7cff7a, 2.5, 12, 1.5);
    glow.position.set(0, -2, -5);
    this.scene.add(glow);
    this.scene.fog = new THREE.FogExp2(0x0e4a60, 0.085);
    this.t = 0;
    this._m = new THREE.Matrix4();
  }

  /** الكاميرا تتقدّم ببطء داخل القطرة وتتمايل قليلًا */
  update(dt, cam) {
    this.t += dt;
    const t = this.t;
    for (const g of this.germs) {
      const u = g.userData;
      g.rotation.x += u.spin.x * dt;
      g.rotation.y += u.spin.y * dt;
      g.rotation.z += u.spin.z * dt;
      g.position.set(u.base.x + Math.sin(t * 0.7 + u.bob) * 0.18, u.base.y + Math.sin(t * 0.9 + u.bob * 2) * 0.14, u.base.z);
      g.scale.setScalar(u.s * (1 + Math.sin(t * 3 + u.bob) * 0.05));
    }
    this.bubbleData.forEach((d, i) => {
      d.p.y += d.v * dt;
      if (d.p.y > 3) d.p.y = -3;
      this._m.makeScale(d.r, d.r, d.r).setPosition(d.p.x + Math.sin(t + i) * 0.05, d.p.y, d.p.z);
      this.bubbles.setMatrixAt(i, this._m);
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (cam) {
      cam.position.set(Math.sin(t * 0.5) * 0.25, Math.sin(t * 0.37) * 0.15, 1.2 - t * 1.25);
      cam.lookAt(Math.sin(t * 0.3) * 0.4, 0, cam.position.z - 4);
      cam.updateMatrixWorld();
    }
  }

  reset() {
    this.t = 0;
  }
}

