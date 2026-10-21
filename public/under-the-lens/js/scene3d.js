// ---------------------------------------------------------------------------
// الطبقة ثلاثية الأبعاد (three.js مستضاف محليًا في /board-kit/vendor/three/):
// عدسة مكبّرة نحاسية ومجهر (على هيئة مجهر الكتاب) لكل فريق، مبنيّان من أشكال
// بسيطة (≈ ١٠ آلاف مثلث للمشهد كله، بلا نماذج ولا أنسجة خارجية).
//
// الكاميرا محاذاة على وحدات المسرح (الملف 09): نقطة العالم (x, −y, 0) تظهر عند (x, y)
// بوحدة u، فتُوضع المجسّمات بالأرقام نفسها التي تُوضع بها عناصر HTML.
// المجسّمات زينة وحركة فقط؛ أهداف اليد كلها عناصر HTML ثابتة في اللعبة.
// الرسم ٣٠ إطارًا في الثانية على الأكثر، ودقة البكسل ≤ 1.5، ويتوقف إن خُفيت الصفحة.
// ---------------------------------------------------------------------------
import * as THREE from '/board-kit/vendor/three/three.module.min.js';

const FPS_MS = 1000 / 30;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const toWorld = (x, y, z = 0) => new THREE.Vector3(x, -y, z);

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, ...o });
}

// ------------------------------------------------------------------ النماذج
function buildLens(outward) {
  const g = new THREE.Group();
  const brass = mat(0xd4a02a, { metalness: 0.45, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 12, 56), brass);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.97, 48),
    new THREE.MeshStandardMaterial({ color: 0xc8ecff, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }),
  );
  const shine = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.76, 32, 1, 1.9, 1.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  shine.position.z = 0.02;
  const arm = new THREE.Group();
  arm.rotation.z = outward * (Math.PI / 4);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 16), mat(0xd9dde2, { metalness: 0.6, roughness: 0.25 }));
  ferrule.position.y = -1.22;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 1.2, 18), mat(0x1d1d22, { roughness: 0.2 }));
  handle.position.y = -1.98;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat(0x1d1d22, { roughness: 0.2 }));
  cap.position.y = -2.58;
  arm.add(ferrule, handle, cap);
  g.add(glass, rim, shine, arm);
  g.userData.arm = arm;
  return g;
}

function buildScope() {
  const g = new THREE.Group(); // الأصل: منتصف المجهر تقريبًا
  const body = mat(0xe3e6df);
  const black = mat(0x202124, { roughness: 0.35 });
  const silver = mat(0xcfd4da, { metalness: 0.6, roughness: 0.22 });
  const add = (geo, m, x, y, z = 0, rz = 0, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.rotation.x = rx;
    g.add(mesh);
    return mesh;
  };
  const Y = -0.48;
  add(new THREE.BoxGeometry(0.78, 0.08, 0.46), body, 0.02, Y + 0.04); // القاعدة
  add(new THREE.BoxGeometry(0.14, 0.26, 0.2), body, -0.2, Y + 0.2); // العمود
  const arc = add(new THREE.TorusGeometry(0.3, 0.075, 10, 26, Math.PI * 0.95), body, -0.08, Y + 0.58, 0, Math.PI * 0.55);
  arc.userData.keep = true;
  add(new THREE.BoxGeometry(0.46, 0.045, 0.34), black, 0.12, Y + 0.38); // المنصّة
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), silver, 0.14, Y + 0.31); // المكثّف
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 18), body, 0.06, Y + 0.84, 0, -0.45); // أنبوب الجسم
  add(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16), black, -0.06, Y + 1.09, 0, -0.45); // العدسة العينية
  const nose = add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18), black, 0.16, Y + 0.62, 0, -0.45);
  nose.userData.keep = true;
  add(new THREE.CylinderGeometry(0.03, 0.025, 0.13, 12), silver, 0.2, Y + 0.53, 0, -0.1); // العدسة الشيئية
  add(new THREE.CylinderGeometry(0.025, 0.02, 0.1, 12), silver, 0.27, Y + 0.57, 0, -0.6);
  const knob = add(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 18), black, -0.24, Y + 0.5, 0.12, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14), black, -0.24, Y + 0.36, 0.12, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), silver, 0.14, Y + 0.18, 0, 0.5); // المرآة
  g.userData.knob = knob;
  // طرف العدسة الشيئية (لنقطة بداية شعاع الضوء)
  const tip = new THREE.Object3D();
  tip.position.set(0.22, Y + 0.46, 0);
  g.add(tip);
  g.userData.tip = tip;
  // حفظ الألوان الأصلية لحالة القفل
  g.traverse((o) => {
    if (o.isMesh) o.userData.base = o.material.color.clone();
  });
  return g;
}

// ------------------------------------------------------------------ الأداة المتحرّكة
class Tool {
  constructor(obj, baseScale) {
    this.obj = obj;
    this.base = baseScale;
    this.home = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 2000, 0);
    this.scale = baseScale;
    this.rot = new THREE.Euler(0.45, 0.35, 0);
    this.mode = 'home'; // home | follow | plate | tween
    this.followAt = new THREE.Vector3();
    this.tw = null;
    this.phase = Math.random() * 6;
    obj.position.copy(this.pos);
  }
  tween({ to, scale, rot, dur, arc = 0, mode, onDone }) {
    this.tw = {
      from: this.obj.position.clone(), to: to.clone(), s0: this.obj.scale.x, s1: scale ?? this.obj.scale.x,
      r0: this.obj.rotation.clone(), r1: rot ?? this.obj.rotation.clone(), t0: performance.now(), dur, arc, mode, onDone,
    };
    this.mode = 'tween';
  }
  update(now, dt, reduced) {
    const o = this.obj;
    if (this.mode === 'tween' && this.tw) {
      const w = this.tw;
      const k = Math.min(1, (now - w.t0) / Math.max(1, w.dur));
      const e = ease(k);
      o.position.lerpVectors(w.from, w.to, e);
      o.position.z += Math.sin(k * Math.PI) * w.arc;
      o.position.y += Math.sin(k * Math.PI) * w.arc * 0.35;
      o.scale.setScalar(w.s0 + (w.s1 - w.s0) * e);
      o.rotation.set(w.r0.x + (w.r1.x - w.r0.x) * e, w.r0.y + (w.r1.y - w.r0.y) * e, w.r0.z + (w.r1.z - w.r0.z) * e);
      if (k >= 1) {
        this.mode = w.mode || 'idle';
        this.tw = null;
        w.onDone?.();
      }
      return true;
    }
    if (this.mode === 'follow') {
      const a = 1 - Math.pow(0.0005, dt); // اقتراب ناعم من اليد
      o.position.lerp(this.followAt, a);
      o.scale.setScalar(o.scale.x + (this.base * 0.9 - o.scale.x) * a);
      o.rotation.x += (0.15 - o.rotation.x) * a;
      o.rotation.y += (0 - o.rotation.y) * a;
      return true;
    }
    if (this.mode === 'home') {
      const t = now / 1000 + this.phase;
      const bob = reduced ? 0 : Math.sin(t * 1.6) * 8;
      const target = this.home.clone();
      target.y += bob;
      o.position.lerp(target, 0.12);
      o.scale.setScalar(o.scale.x + (this.base - o.scale.x) * 0.12);
      o.rotation.x += (0.45 - o.rotation.x) * 0.1;
      o.rotation.y += ((reduced ? 0.3 : 0.3 + Math.sin(t * 0.9) * 0.25) - o.rotation.y) * 0.1;
      o.rotation.z += (0 - o.rotation.z) * 0.1;
      return !reduced || o.position.distanceTo(target) > 0.5;
    }
    return false;
  }
}

// ------------------------------------------------------------------ المشهد
export class Scene3D {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1.6, 10, 8000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe9dcc6, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.teams = {};
    this.VW = 1600;
    this.VH = 1000;
    this.reduced = false;
    this._last = 0;
    this._lastT = performance.now();
    this.dirty = true;
  }

  layout(wPx, hPx, VW, VH) {
    this.VW = VW;
    this.VH = VH;
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
    this.renderer.setSize(wPx, hPx, false);
    const cam = this.camera;
    const dist = VH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.aspect = VW / VH;
    cam.position.set(VW / 2, -VH / 2, dist);
    cam.lookAt(VW / 2, -VH / 2, 0);
    cam.near = dist * 0.2;
    cam.far = dist * 3;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.sun.position.set(VW * 0.3, VH * 0.4, dist);
    this.sun.target.position.set(VW / 2, -VH / 2, 0);
    this.dirty = true;
  }

  /**
   * يضبط أدوات كل فريق ومواضعها.
   * @param {Record<string,{lensHome:{x,y}, scopeHome:{x,y}, plate:{x,y,r}, outward:number, size:number}>} spec
   */
  setTeams(spec) {
    for (const id of Object.keys(this.teams)) {
      if (!spec[id]) {
        const T = this.teams[id];
        this.scene.remove(T.lens.obj, T.scope.obj, T.ring, T.beam);
        delete this.teams[id];
      }
    }
    for (const [id, s] of Object.entries(spec)) {
      let T = this.teams[id];
      if (!T || T.outward !== s.outward) {
        if (T) this.scene.remove(T.lens.obj, T.scope.obj, T.ring, T.beam);
        const lens = new Tool(buildLens(s.outward), 1);
        const scope = new Tool(buildScope(), 1);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 10, 64), mat(0x2b2d31, { metalness: 0.5, roughness: 0.3 }));
        ring.visible = false;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 1, 1, 24, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
        );
        beam.visible = false;
        this.scene.add(lens.obj, scope.obj, ring, beam);
        T = this.teams[id] = { lens, scope, ring, beam, outward: s.outward, locked: null };
      }
      T.plate = s.plate;
      T.lens.base = s.size * 0.33;
      T.scope.base = s.size;
      T.lens.home.copy(toWorld(s.lensHome.x, s.lensHome.y, 30));
      T.scope.home.copy(toWorld(s.scopeHome.x, s.scopeHome.y, 0));
      if (T.lens.mode === 'plate') this._seat(T.lens, T);
      if (T.ring.visible) this._seatRing(T);
    }
    this.dirty = true;
  }

  /** دخول سينمائي: الأدوات تطير من خارج الشاشة إلى أماكنها */
  intro() {
    for (const T of Object.values(this.teams)) {
      for (const [tool, from] of [[T.lens, toWorld(T.lens.home.x + T.outward * 900, -T.lens.home.y - 500, 400)], [T.scope, toWorld(T.scope.home.x, -T.scope.home.y + 900, 200)]]) {
        tool.obj.position.copy(from);
        tool.obj.rotation.set(1.2, 3, 0.6);
        if (this.reduced) {
          tool.mode = 'home';
          continue;
        }
        tool.tween({ to: tool.home, scale: tool.base, rot: new THREE.Euler(0.45, 0.3, 0), dur: 1300, arc: 120, mode: 'home' });
      }
    }
  }

  /** يعيد كل شيء إلى البداية (قائمة جديدة/جولة جديدة) */
  reset() {
    for (const T of Object.values(this.teams)) {
      T.ring.visible = false;
      T.beam.visible = false;
      this.home(T, 'lens');
      this.home(T, 'scope');
      this.setLocked(T, true);
    }
  }

  team(id) {
    return this.teams[id];
  }

  setLocked(T, locked) {
    T.locked = locked;
    T.scope.obj.traverse((o) => {
      if (!o.isMesh) return;
      const base = o.userData.base;
      o.material = o.material.clone();
      o.material.color.copy(locked ? new THREE.Color(0xb9bbb8).lerp(base, 0.25) : base);
      o.material.transparent = locked;
      o.material.opacity = locked ? 0.55 : 1;
    });
    this.dirty = true;
  }

  /** فتح المجهر: قفزة ودوران */
  unlock(T) {
    this.setLocked(T, false);
    const s = T.scope;
    if (this.reduced) return;
    const r = s.obj.rotation.clone();
    s.tween({
      to: s.home.clone().add(new THREE.Vector3(0, 60, 120)), scale: s.base * 1.25, rot: new THREE.Euler(r.x, r.y + Math.PI * 2, 0), dur: 700, mode: 'idle',
      onDone: () => s.tween({ to: s.home, scale: s.base, rot: new THREE.Euler(0.45, 0.3, 0), dur: 500, mode: 'home' }),
    });
  }

  follow(T, tool, x, y) {
    const t = T[tool];
    if (t.mode === 'tween' || t.mode === 'plate') return;
    t.mode = 'follow';
    t.followAt.copy(toWorld(x, y, 120));
  }

  home(T, tool) {
    const t = T[tool];
    if (t.mode === 'home') return;
    if (tool === 'lens') T.ring.visible = false;
    if (tool === 'scope') T.beam.visible = false;
    if (this.reduced) {
      t.mode = 'home';
      return;
    }
    t.tween({ to: t.home, scale: t.base, rot: new THREE.Euler(0.45, 0.3, 0), dur: 650, arc: 60, mode: 'home' });
  }

  _seat(t, T) {
    const p = T.plate;
    t.obj.position.copy(toWorld(p.x, p.y, 0));
    t.obj.scale.setScalar(p.r + 4);
    t.obj.rotation.set(0, 0, 0);
  }
  _seatRing(T) {
    const p = T.plate;
    T.ring.position.copy(toWorld(p.x, p.y, 0));
    T.ring.scale.setScalar(p.r + 8);
    // شعاع من طرف العدسة الشيئية إلى أقرب نقطة على حافة الطبق
    const tip = new THREE.Vector3();
    T.scope.obj.updateMatrixWorld(true);
    T.scope.obj.userData.tip.getWorldPosition(tip);
    const c = toWorld(p.x, p.y, 0);
    const dir = c.clone().sub(tip);
    const edge = c.clone().sub(dir.clone().normalize().multiplyScalar(p.r * 0.92));
    const len = edge.distanceTo(tip);
    T.beam.position.copy(tip.clone().add(edge).multiplyScalar(0.5));
    T.beam.scale.set(p.r * 0.35, len, p.r * 0.35);
    T.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), edge.clone().sub(tip).normalize());
  }

  /** العدسة تطير في قوس وتستقر حول الطبق. يُرجع مدة الحركة (م.ث) */
  lensToPlate(T, onDone) {
    const p = T.plate;
    const t = T.lens;
    const dur = this.reduced ? 1 : 750;
    t.tween({ to: toWorld(p.x, p.y, 0), scale: p.r + 4, rot: new THREE.Euler(0, 0, 0), dur, arc: 180, mode: 'plate', onDone });
    return dur;
  }

  /** المجهر يقفز ويدير مقبض التركيز ويطلق شعاع الضوء نحو الطبق */
  scopeOnPlate(T) {
    const s = T.scope;
    // يثبت المجهر في مكانه (بلا تمايل) ليخرج الشعاع من طرف عدسته الشيئية
    s.tw = null;
    s.mode = 'idle';
    s.obj.position.copy(s.home);
    s.obj.scale.setScalar(s.base);
    s.obj.rotation.set(0.25, 0.35, 0);
    T.ring.visible = true;
    T.beam.visible = true;
    this._seatRing(T);
    T.ring.scale.setScalar(1);
    T._ringT0 = performance.now();
    T._knobT0 = performance.now();
    this.dirty = true;
  }
  clearPlate(T) {
    T.ring.visible = false;
    T.beam.visible = false;
    if (T.lens.mode === 'plate') this.home(T, 'lens');
    if (T.scope.mode === 'idle') this.home(T, 'scope');
    this.dirty = true;
  }

  /** اهتزاز لطيف للطبقة المرئية فقط (الأهداف لا تتحرك) */
  shake(T, tool) {
    const t = T[tool];
    if (this.reduced || t.mode === 'tween') return;
    t._shakeT0 = performance.now();
  }

  frame(now) {
    if (document.hidden) return;
    if (now - this._last < FPS_MS) return;
    const dt = Math.min(0.1, (now - this._lastT) / 1000);
    this._lastT = now;
    this._last = now;
    let moving = this.dirty;
    for (const T of Object.values(this.teams)) {
      for (const k of ['lens', 'scope']) {
        const t = T[k];
        if (t.update(now, dt, this.reduced)) moving = true;
        if (t._shakeT0) {
          const e = (now - t._shakeT0) / 400;
          if (e >= 1) t._shakeT0 = 0;
          else {
            t.obj.position.x += Math.sin(e * 40) * 10 * (1 - e);
            moving = true;
          }
        }
      }
      if (T.ring.visible && T._ringT0) {
        const e = Math.min(1, (now - T._ringT0) / (this.reduced ? 1 : 450));
        T.ring.scale.setScalar((T.plate.r + 8) * (this.reduced ? 1 : easeOutBack(e)));
        T.beam.material.opacity = 0.35 * e;
        if (e < 1) moving = true;
      }
      if (T._knobT0) {
        const e = (now - T._knobT0) / 1300;
        if (e >= 1) T._knobT0 = 0;
        else {
          T.scope.obj.userData.knob.rotation.y += 0.35;
          moving = true;
        }
      }
    }
    if (!moving) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  }
}

/** يحاول إنشاء المشهد؛ يعيد null إن لم يدعم الجهاز WebGL (تعمل اللعبة حينها بلا أبعاد ثلاثة). */
export function createScene(canvas) {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    return new Scene3D(canvas);
  } catch {
    return null;
  }
}
