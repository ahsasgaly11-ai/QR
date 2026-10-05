// مشهد الواقع المعزز: كاميرا Three.js توضع من وضعية الكاميرا الحقيقية، فتُرسم المؤثرات أجسامًا فوق سطح القرص.
// الإحداثيات: x,y = إحداثيات القرص (y نحو الأسفل على الجدار)، z>0 = خارج القرص نحو الكاميرا.
// النار ترتفع على الجدار (‎-y)، والشرر يسقط بالجاذبية (‎+y)، والدخان يتصاعد ويتمدد.
import * as THREE from 'three';
import { rings, ANG0, zoneColor, tierOf, TIERS } from '../vision/geometry.js';

const MAX_ADD = 7000, MAX_SMOKE = 1600, MAX_STREAK = 2600;
const FONT = '"Tajawal","SF Arabic","Geeza Pro","Noto Kufi Arabic",sans-serif';
const R = Math.random, TAU = 6.2832;
const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

const VERT = `attribute vec4 col; attribute vec3 misc; varying vec4 vC; varying vec2 vM; uniform float uScale;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; vC = col; vM = misc.yz;
  gl_PointSize = clamp(misc.x * uScale / -mv.z, 1.5, 300.0); }`;
// vM.x = بذرة عشوائية، vM.y = النوع: 0 لهب/دخان ناعم متموّج، 1 شرارة بقلب ساطع
const FRAG = `precision mediump float; varying vec4 vC; varying vec2 vM; uniform float uPremult;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; float a;
  if (vM.y > 0.5) { a = pow(max(0.0, 1.0 - d), 2.5); }
  else { float t = n(p * 5.0 + vM.x * 37.0) * 0.6 + n(p * 11.0 - vM.x * 19.0) * 0.4; a = smoothstep(1.0, 0.15, d + (t - 0.5) * 0.75); a *= a; }
  a *= vC.a; if (a < 0.004) discard;
  gl_FragColor = uPremult > 0.5 ? vec4(vC.rgb * a, a) : vec4(vC.rgb, a); }`;

class PointCloud {
  constructor(parent, max, additive, order) {
    this.max = max; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.misc = new Float32Array(max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('misc', new THREE.BufferAttribute(this.misc, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 }, uPremult: { value: additive ? 1 : 0 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = order; parent.add(this.obj); this.k = 0;
  }
  begin() { this.k = 0; }
  put(x, y, z, r, g, b, a, size, seed, kind) { const k = this.k; if (k >= this.max) return; this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.col[k * 4] = r; this.col[k * 4 + 1] = g; this.col[k * 4 + 2] = b; this.col[k * 4 + 3] = a; this.misc[k * 3] = size; this.misc[k * 3 + 1] = seed; this.misc[k * 3 + 2] = kind; this.k++; }
  end() { const g = this.obj.geometry; g.setDrawRange(0, this.k); g.attributes.position.needsUpdate = true; g.attributes.col.needsUpdate = true; g.attributes.misc.needsUpdate = true; }
}

// تدرّج حرارة اللهب: أبيض مصفرّ ← برتقالي ← أحمر ← فحمي
function heat(k, out) { if (k < 0.15) { const f = k / 0.15; out[0] = 1; out[1] = 0.9 - 0.1 * f; out[2] = 0.55 - 0.3 * f; }
  else if (k < 0.45) { const f = (k - 0.15) / 0.3; out[0] = 1; out[1] = 0.8 - 0.38 * f; out[2] = 0.25 - 0.2 * f; }
  else if (k < 0.8) { const f = (k - 0.45) / 0.35; out[0] = 1 - 0.3 * f; out[1] = 0.45 - 0.33 * f; out[2] = 0.06 - 0.04 * f; }
  else { const f = (k - 0.8) / 0.2; out[0] = 0.7 - 0.55 * f; out[1] = 0.12 - 0.09 * f; out[2] = 0.02; } }

function radialTexture(stops, rough) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); for (const [o, col] of stops) g.addColorStop(o, col); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  if (rough) { c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 70; i++) { const a = R() * TAU, r = 70 + R() * 58; c.beginPath(); c.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 6 + R() * 16, 0, 7); c.fillStyle = 'rgba(0,0,0,' + (0.25 + R() * 0.5) + ')'; c.fill(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }

export class ARScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100); this.camera.matrixAutoUpdate = false;
    this.root = new THREE.Group(); this.root.scale.z = -1; this.scene.add(this.root); // z>0 في المؤثرات = نحو الكاميرا
    this.fire = []; this.smoke = []; this.sparks = []; this.emitters = []; this.rings3 = []; this.texts = []; this.bolts = []; this.glows = []; this.decals = []; this.lights = [];
    this.smokeCloud = new PointCloud(this.root, MAX_SMOKE, false, 6); this.addCloud = new PointCloud(this.root, MAX_ADD, true, 8);
    // خطوط ذيول الشرر
    const sg = new THREE.BufferGeometry(); this.sPos = new Float32Array(MAX_STREAK * 6); this.sCol = new Float32Array(MAX_STREAK * 6);
    sg.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3).setUsage(THREE.DynamicDrawUsage)); sg.setAttribute('color', new THREE.BufferAttribute(this.sCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }))  // ضوء خالص: لا يحجب الكاميرا; this.streaks.frustumCulled = false; this.streaks.renderOrder = 9; this.root.add(this.streaks);
    this.texScorch = radialTexture([[0, 'rgba(8,5,3,.95)'], [0.45, 'rgba(15,9,5,.8)'], [0.8, 'rgba(25,14,6,.35)'], [1, 'rgba(30,16,8,0)']], true);
    this.texLight = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']], false);
    this.ringPool = []; this.textPool = []; this.boltPool = []; this.ballMarks = []; this.glowPool = []; this.decalPool = []; this.lightPool = [];
    this.grid = null; this.gridRings = null; this.visible = false; this.slow = 0; this.light = 1; this.zoneGeo = new Map(); this.tmp = [0, 0, 0];
    this.onBlast = null; this.onFirework = null;
    this.#buildGrid();
  }
  resize(w, h, dpr) { this.renderer.setPixelRatio(Math.min(2, dpr)); this.renderer.setSize(w, h, false); this.w = w; this.h = h; }

  // وضعية الكاميرا من عامل الرؤية (R=[r1 r2 r3], t، بإحداثيات الرؤية الحاسوبية: X يمين، Y أسفل، Z أمام)
  setPose(p, videoW, videoH) {
    if (!p) { this.visible = false; return; }
    this.visible = true; const Rm = [p.r1, p.r2, p.r3], t = p.t;
    const E = new THREE.Matrix4().set(Rm[0][0], Rm[1][0], Rm[2][0], t[0], -Rm[0][1], -Rm[1][1], -Rm[2][1], -t[1], -Rm[0][2], -Rm[1][2], -Rm[2][2], -t[2], 0, 0, 0, 1);
    this.camera.matrixWorld.copy(E.clone().invert()); this.camera.matrixWorldInverse.copy(E);
    this.camera.fov = (2 * Math.atan(videoH / (2 * p.f)) * 180) / Math.PI; this.camera.aspect = videoW / videoH; this.camera.updateProjectionMatrix();
    const scale = (this.h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.smokeCloud.mat.uniforms.uScale.value = scale; this.addCloud.mat.uniforms.uScale.value = scale;
  }
  setLight(b) { this.light = 0.75 + 0.5 * Math.min(1, Math.max(0, b)); }

  #buildGrid() {
    if (this.grid) { this.root.remove(this.grid); this.grid.geometry.dispose(); }
    const pts = []; const circle = (r) => { for (let i = 0; i < 72; i++) { const a0 = (i / 72) * TAU, a1 = ((i + 1) / 72) * TAU; pts.push(r * Math.sin(a0), -r * Math.cos(a0), 0, r * Math.sin(a1), -r * Math.cos(a1), 0); } };
    circle(1); circle(rings.inner); circle(rings.bull);
    for (let i = 0; i < 12; i++) { const a = ((i * 30 + ANG0) * Math.PI) / 180; pts.push(rings.bull * Math.sin(a), -rings.bull * Math.cos(a), 0, Math.sin(a), -Math.cos(a), 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x78ffbe, transparent: true, opacity: 0.25, depthTest: false })); this.grid.position.z = 0.003; this.grid.renderOrder = 2; this.root.add(this.grid);
    this.gridRings = [rings.bull, rings.inner]; this.zoneGeo.clear();
    if (!this.sweep) { const s2 = new THREE.BufferGeometry(); s2.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -1, 0], 3)); this.sweep = new THREE.Line(s2, new THREE.LineBasicMaterial({ color: 0xf6cf1c, transparent: true, opacity: 0.9, depthTest: false })); this.sweep.position.z = 0.004; this.root.add(this.sweep); }
  }
  setGrid(mode) { this.gridMode = mode; } // 'off' | 'soft' | 'strong'
  zoneGeometry(z) { if (this.zoneGeo.has(z.id)) return this.zoneGeo.get(z.id); const sh = new THREE.Shape();
    if (z.ring === 'b') sh.absarc(0, 0, rings.bull, 0, TAU, false);
    else { const a0 = ((z.idx * 30 + ANG0 - 90) * Math.PI) / 180, a1 = a0 + Math.PI / 6, r0 = z.ring === 'i' ? rings.bull : rings.inner, r1 = z.ring === 'i' ? rings.inner : 0.985; sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); }
    const g = new THREE.ShapeGeometry(sh, 24); this.zoneGeo.set(z.id, g); return g; }

  /* ---------- مولّدات الجسيمات ---------- */
  fireball(x, y, n, power, size, z0 = 0.03) { for (let i = 0; i < n && this.fire.length < 3200; i++) { const a = R() * TAU, vr = power * Math.pow(R(), 0.6), vz = power * (0.25 + R() * 1.0);
    this.fire.push({ x: x + (R() - 0.5) * size * 0.5, y: y + (R() - 0.5) * size * 0.5, z: z0 + R() * size * 0.3, vx: Math.cos(a) * vr, vy: Math.sin(a) * vr, vz, s: size * (0.55 + R() * 0.9), t: 0, max: (0.45 + R() * 0.55) * (1 + power * 0.12), seed: R(), hot: 0 }); } }
  flame(x, y, size, up = 1) { if (this.fire.length < 3200) this.fire.push({ x: x + (R() - 0.5) * size, y: y + (R() - 0.5) * size, z: 0.02 + R() * 0.04, vx: (R() - 0.5) * 0.15, vy: -up * (0.25 + R() * 0.5), vz: 0.1 + R() * 0.25, s: size * (0.7 + R() * 0.8), t: 0, max: 0.4 + R() * 0.45, seed: R(), hot: 0.1 }); }
  puff(x, y, n, size, spread, dark = 0.14) { for (let i = 0; i < n && this.smoke.length < MAX_SMOKE; i++) { const a = R() * TAU, vr = spread * R();
    this.smoke.push({ x: x + (R() - 0.5) * size, y: y + (R() - 0.5) * size, z: 0.05 + R() * 0.1, vx: Math.cos(a) * vr, vy: Math.sin(a) * vr - 0.15, vz: 0.15 + R() * 0.5 * spread, s: size * (0.7 + R() * 0.7), t: 0, max: 1.5 + R() * 1.4, seed: R(), g: dark + R() * 0.12 }); } }
  spray(x, y, n, power, cols, size = 0.022, life = 1, grav = 2.6) { for (let i = 0; i < n && this.sparks.length < MAX_STREAK; i++) { const a = R() * TAU, sp = power * (0.35 + R() * 1.1), el = R(); const c = cols ? cols[i % cols.length] : null;
    this.sparks.push({ x, y, z: 0.03, vx: Math.cos(a) * sp * (1 - el * 0.5), vy: Math.sin(a) * sp * (1 - el * 0.5), vz: sp * (0.2 + el * 1.1), s: size * (0.6 + R() * 0.9), t: 0, max: life * (0.5 + R() * 0.9), c, grav, seed: R() }); } }
  emit(delay, dur, rate, fn) { this.emitters.push({ t: -delay, dur, rate, acc: 0, fn }); }
  shock(x, y, speed, life, c, w, delay = 0, z = 0.004) { this.rings3.push({ x, y, z, r: 0.02, vr: speed, life, t: -delay, c, w, vz: 0 }); }
  scorch(x, y, r, life) { this.decals.push({ x, y, r, life, t: 0, rot: R() * TAU }); }
  lightFlash(x, y, r, life, c) { this.lights.push({ x, y, r, life, t: 0, c }); }
  text(x, y, z, txt, c, size, life, delay = 0) { this.texts.push({ x, y, z, txt, c, size, life, t: -delay }); }
  bolt(x0, y0, x1, y1, c) { const pts = [[x0, y0]], n = 9; for (let i = 1; i < n; i++) { const k = i / n, j = (1 - Math.abs(k - 0.5) * 2) * 0.12 + 0.03; pts.push([x0 + (x1 - x0) * k + (R() - 0.5) * j, y0 + (y1 - y0) * k + (R() - 0.5) * j]); } pts.push([x1, y1]); this.bolts.push({ pts, t: 0, life: 0.35, c }); }
  glow(z, c, life) { this.glows.push({ z, c, t: 0, life }); }
  trail(u, v) { for (let i = 0; i < 2; i++) this.flame(u, v, 0.045, 0.2); this.spray(u, v, 2, 0.4, null, 0.014, 0.4, 1.5); }
  celebrate() { const gold = hex('#ffd23d'); this.spray(0, 0, 220, 2.6, [gold, hex('#fff'), hex('#7be36a'), hex('#3fb6ff')], 0.03, 1.6, 2.2); this.lightFlash(0, 0, 1.1, 0.5, gold); }

  /* ---------- الانفجارات المتدرّجة بحسب الهدف ---------- */
  hit(z, u, v) {
    const t = tierOf(z.pts), zc = hex(zoneColor(z)), tc = hex(TIERS[t].c), W = hex('#fff'), OR = hex('#ff8a2a'), GOLD = hex('#ffd23d');
    this.glow(z, zc, 1.2 + t * 0.6);
    if (t === 0) { // ١٠ نقاط: طقّة شرر ونفثة لهب
      this.fireball(u, v, 16, 0.55, 0.09); this.spray(u, v, 34, 1.3, null, 0.02, 0.8); this.puff(u, v, 5, 0.09, 0.25); this.shock(u, v, 1.3, 0.4, OR, 0.03);
      this.lightFlash(u, v, 0.45, 0.25, OR); this.scorch(u, v, 0.1, 2.5); this.onBlast?.(0);
    } else if (t === 1) { // ٢٠–٧٠: كرة نار صغيرة وموجة صدمة
      this.fireball(u, v, 60, 1.0, 0.14); this.spray(u, v, 90, 2.0, null, 0.024, 1.1); this.puff(u, v, 14, 0.14, 0.45);
      this.emit(0.1, 0.5, 26, () => this.puff(u, v, 1, 0.13, 0.3)); this.emit(0, 0.45, 40, () => this.flame(u, v, 0.1));
      this.shock(u, v, 1.9, 0.5, OR, 0.045); this.shock(u, v, 1.2, 0.6, W, 0.02, 0.08);
      this.lightFlash(u, v, 0.8, 0.35, OR); this.scorch(u, v, 0.17, 3.5); this.onBlast?.(1);
    } else if (t === 2) { // ٨٠–١٩٠: انفجار ناري كبير وعمود دخان وبرق وانفجارات ثانوية
      this.fireball(u, v, 150, 1.7, 0.2); this.fireball(u, v, 50, 0.7, 0.26); this.spray(u, v, 200, 3.0, null, 0.026, 1.4); this.puff(u, v, 26, 0.2, 0.7);
      this.emit(0.05, 1.1, 48, () => this.puff(u, v, 1, 0.19, 0.4)); this.emit(0, 0.9, 70, () => this.flame(u, v, 0.15));
      this.shock(u, v, 2.8, 0.6, OR, 0.07); this.shock(u, v, 2.0, 0.7, GOLD, 0.04, 0.1); this.shock(u, v, 1.3, 0.85, W, 0.02, 0.2);
      for (let i = 0; i < 7; i++) { const a = R() * TAU; this.bolt(u, v, Math.sin(a), -Math.cos(a), hex('#ffe9a8')); }
      for (let k = 0; k < 4; k++) setTimeout(() => { const a = R() * TAU, d = 0.18 + R() * 0.25, x = u + Math.cos(a) * d, y = v + Math.sin(a) * d; this.fireball(x, y, 40, 0.9, 0.12); this.spray(x, y, 50, 1.8, null, 0.02, 0.9); this.lightFlash(x, y, 0.5, 0.25, OR); this.onFirework?.(); }, 220 + k * 170);
      this.lightFlash(u, v, 1.3, 0.45, OR); this.scorch(u, v, 0.27, 4.5); this.onBlast?.(2);
    } else { // ٢٠٠: شحن ثم انفجار عملاق، طوق نار حول القرص، ألعاب نارية ومطر ذهبي
      for (let i = 0; i < 90; i++) { const a = R() * TAU, d = 0.7 + R() * 0.5; this.sparks.push({ x: u + Math.cos(a) * d, y: v + Math.sin(a) * d, z: 0.05 + R() * 0.3, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * 2.6, vz: -0.2, s: 0.022, t: 0, max: 0.36, c: GOLD, grav: 0, seed: R() }); }
      this.lightFlash(u, v, 0.5, 0.4, GOLD); this.onBlast?.(3, 'charge');
      setTimeout(() => {
        this.slow = 1.5; this.fireball(u, v, 320, 2.5, 0.25); this.fireball(u, v, 110, 1.0, 0.34); this.spray(u, v, 420, 4.2, null, 0.028, 1.8); this.puff(u, v, 46, 0.26, 1.0);
        this.emit(0, 1.8, 65, () => this.puff(u, v, 1, 0.24, 0.5)); this.emit(0, 1.4, 110, () => this.flame(u, v, 0.2, 1.3));
        for (let i = 0; i < 5; i++) this.shock(u, v, 3.6 - i * 0.5, 0.75 + i * 0.08, i % 2 ? W : OR, 0.09 - i * 0.014, i * 0.09);
        for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; this.bolt(u, v, Math.sin(a), -Math.cos(a), W); }
        // طوق نار يشتعل حول حافة القرص
        this.emit(0.15, 2.6, 300, () => { const a = R() * TAU, r = 0.94 + R() * 0.08; this.flame(Math.sin(a) * r, -Math.cos(a) * r, 0.085, 1.2); });
        this.emit(0.15, 2.6, 60, () => { const a = R() * TAU; this.spray(Math.sin(a), -Math.cos(a), 1, 1.2, null, 0.018, 0.9); });
        this.lightFlash(u, v, 1.9, 0.6, hex('#ffb060')); this.scorch(u, v, 0.4, 6); this.onBlast?.(3, 'blast');
        // قذائف ألعاب نارية تنطلق ثم تتفتح بألوان
        const palette = [GOLD, hex('#ff3d6e'), hex('#3fb6ff'), hex('#7be36a'), W];
        for (let k = 0; k < 9; k++) setTimeout(() => { const a = R() * TAU, d = 0.45 + R() * 0.6, x = Math.cos(a) * d, y = Math.sin(a) * d, c = palette[k % palette.length];
          this.spray(x, y, 110, 2.0, [c, W], 0.026, 1.5, 1.6); this.lightFlash(x, y, 0.7, 0.3, c); this.fireball(x, y, 14, 0.5, 0.1); this.onFirework?.(); }, 650 + k * 250);
        this.emit(0.9, 2.2, 90, () => { const x = (R() - 0.5) * 2.2; this.sparks.push({ x, y: -1.25, z: 0.2 + R() * 0.6, vx: (R() - 0.5) * 0.2, vy: 0.5 + R() * 0.6, vz: 0, s: 0.024, t: 0, max: 1.6, c: GOLD, grav: 0.9, seed: R() }); });
      }, 360);
    }
    const d = t === 3 ? 0.4 : 0.05;
    this.text(u, v, 0.34, '+' + z.pts, '#ffffff', 0.24 + t * 0.08, 1.6 + t * 0.35, d);
    this.text(u, v + 0.17 + t * 0.02, 0.04, ['ضربة موفّقة', 'ضربة قوية!', 'ضربة نارية!', 'ضربة أسطورية!'][t], TIERS[t].c, 0.11 + t * 0.025, 1.6 + t * 0.35, d);
  }

  step(dt, t) {
    const k = this.slow > 0 ? 0.32 : 1; this.slow = Math.max(0, this.slow - dt); dt *= k;
    for (const e of this.emitters) { e.t += dt; if (e.t >= 0 && e.t <= e.dur) { e.acc += e.rate * dt; while (e.acc >= 1) { e.fn(); e.acc -= 1; } } }
    this.emitters = this.emitters.filter((e) => e.t <= e.dur);
    const dragF = Math.exp(-3.4 * dt), dragS = Math.exp(-1.5 * dt), dragP = Math.exp(-0.7 * dt);
    this.fire = this.fire.filter((p) => { p.t += dt; p.vx *= dragF; p.vy = p.vy * dragF - 0.95 * dt; p.vz *= dragF; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; return p.t < p.max; });
    this.smoke = this.smoke.filter((p) => { p.t += dt; p.vx = p.vx * dragS + Math.sin(p.seed * 40 + p.t * 3) * 0.12 * dt; p.vy = p.vy * dragS - 0.42 * dt; p.vz *= dragS; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; return p.t < p.max; });
    this.sparks = this.sparks.filter((p) => { p.t += dt; p.vx *= dragP; p.vy = p.vy * dragP + p.grav * dt; p.vz *= dragP; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0.005) { p.z = 0.005; p.vz = -p.vz * 0.3; } return p.t < p.max; });
    this.rings3 = this.rings3.filter((r) => { r.t += dt; if (r.t > 0) r.r += r.vr * dt * (1 - (r.t / r.life) * 0.65); return r.t < r.life; });
    this.texts = this.texts.filter((x) => { x.t += dt; if (x.t > 0) x.z += 0.22 * dt; return x.t < x.life; });
    for (const arr of [this.bolts, this.glows, this.decals, this.lights]) for (const o of arr) o.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < b.life); this.glows = this.glows.filter((g) => g.t < g.life); this.decals = this.decals.filter((d) => d.t < d.life); this.lights = this.lights.filter((l) => l.t < l.life);
    if (this.gridRings && (this.gridRings[0] !== rings.bull || this.gridRings[1] !== rings.inner)) this.#buildGrid();
  }

  render(t, balls) {
    if (!this.visible) { this.renderer.clear(); return; }
    const gm = this.gridMode || 'soft'; this.grid.visible = gm !== 'off'; this.grid.material.opacity = gm === 'strong' ? 0.55 + 0.35 * Math.sin(t / 260) : 0.18;
    this.sweep.visible = gm === 'strong'; if (this.sweep.visible) this.sweep.rotation.z = -((t / 900) % TAU);
    // الدخان (مزج عادي، خلف اللهب ليبرز على جدار فاتح)
    const sc = this.smokeCloud; sc.begin();
    for (const p of this.smoke) { const k = p.t / p.max, a = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.62, g = p.g + k * 0.16; sc.put(p.x, p.y, p.z, g, g * 0.96, g * 0.92, a, p.s * (1 + k * 2.6), p.seed, 0); }
    sc.end();
    // اللهب والشرر (مزج جمعي)
    const ac = this.addCloud, c = this.tmp; ac.begin();
    for (const p of this.fire) { const k = Math.min(1, p.t / p.max + p.hot); heat(k, c); const a = Math.pow(1 - p.t / p.max, 1.15) * 0.4; ac.put(p.x, p.y, p.z, c[0], c[1], c[2], a, p.s * (0.7 + k * 1.7), p.seed, 0); }
    let si = 0; const sp = this.sPos, sl = this.sCol;
    for (const p of this.sparks) { const k = p.t / p.max, a = 1 - k * k; let r, g, b; if (p.c) { r = p.c[0]; g = p.c[1]; b = p.c[2]; } else { r = 1; g = 0.9 - k * 0.55; b = 0.55 - k * 0.5; }
      ac.put(p.x, p.y, p.z, r, g, b, a, p.s * 2.2, p.seed, 1);
      if (si < MAX_STREAK) { const o = si * 6, L = 0.045; sp[o] = p.x; sp[o + 1] = p.y; sp[o + 2] = p.z; sp[o + 3] = p.x - p.vx * L; sp[o + 4] = p.y - p.vy * L; sp[o + 5] = p.z - p.vz * L; sl[o] = r * a; sl[o + 1] = g * a; sl[o + 2] = b * a; sl[o + 3] = 0; sl[o + 4] = 0; sl[o + 5] = 0; si++; } }
    ac.end(); const sg = this.streaks.geometry; sg.setDrawRange(0, si * 2); sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;
    // أثر الاحتراق على القرص
    let di = 0; for (const d of this.decals) { const m = this.#pool(this.decalPool, di++, () => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.texScorch, transparent: true, depthTest: false })), 3); m.position.set(d.x, d.y, 0.0015); m.rotation.z = d.rot; const k = d.t / d.life, grow = Math.min(1, d.t / 0.12); m.scale.set(d.r * grow, d.r * grow, 1); m.material.opacity = (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4) * 0.85; }
    this.#hide(this.decalPool, di);
    // ضوء الانفجار على سطح القرص
    let li = 0; for (const l of this.lights) { const m = this.#pool(this.lightPool, li++, () => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.texLight, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })), 4); const k = l.t / l.life; m.position.set(l.x, l.y, 0.002); m.scale.set(l.r * (0.6 + k * 0.6), l.r * (0.6 + k * 0.6), 1); m.material.color.setRGB(l.c[0], l.c[1], l.c[2]); m.material.opacity = (1 - k) * (1 - k) * 0.6; }
    this.#hide(this.lightPool, li);
    // موجات الصدمة
    let ri = 0; for (const r of this.rings3) { if (r.t <= 0) continue; const m = this.#pool(this.ringPool, ri++, () => new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })), 5);
      m.position.set(r.x, r.y, r.z); const s = Math.max(0.01, r.r); m.scale.set(s, s, 1); m.material.color.setRGB(r.c[0], r.c[1], r.c[2]); m.material.opacity = Math.pow(1 - r.t / r.life, 1.4); }
    this.#hide(this.ringPool, ri);
    // توهج الخانة
    let gi = 0; for (const g of this.glows) { const m = this.#pool(this.glowPool, gi++, () => new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })), 3); m.position.z = 0.002; m.geometry = this.zoneGeometry(g.z); m.material.color.setRGB(g.c[0], g.c[1], g.c[2]); m.material.opacity = Math.max(0, (1 - g.t / g.life) * (0.45 + 0.3 * Math.sin(g.t * 18))); }
    this.#hide(this.glowPool, gi);
    // البرق
    let bi = 0; for (const b of this.bolts) { const l = this.#pool(this.boltPool, bi++, () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); }, 7);
      const arr = l.geometry.attributes.position.array; b.pts.forEach((p, i) => { arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = 0.01; }); l.geometry.attributes.position.needsUpdate = true; l.material.color.setRGB(b.c[0], b.c[1], b.c[2]); l.material.opacity = 1 - b.t / b.life; }
    this.#hide(this.boltPool, bi);
    // النصوص
    let ti = 0; for (const x of this.texts) { if (x.t < 0) continue; const s = this.#text(ti++); s.visible = true; this.#paintText(s, x.txt, x.c); const a = Math.min(1, (x.life - x.t) * 2.5), kk = x.t < 0.18 ? 0.5 + (x.t / 0.18) * 0.6 : 1.1 - Math.min(0.1, x.t - 0.18); s.material.opacity = a; s.position.set(x.x, x.y, x.z); s.scale.set(x.size * kk * s.userData.ratio, x.size * kk, 1); }
    this.#hide(this.textPool, ti);
    // علامات الكرات المسجّلة
    balls = balls || []; for (let i = 0; i < balls.length; i++) { const m = this.#pool(this.ballMarks, i, () => new THREE.Mesh(new THREE.RingGeometry(0.11, 0.125, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false })), 4); m.position.set(balls[i][0], balls[i][1], 0.005); }
    this.#hide(this.ballMarks, balls.length);
    this.renderer.render(this.scene, this.camera);
  }
  #pool(pool, i, make, order) { if (!pool[i]) { const m = make(); m.renderOrder = order; m.frustumCulled = false; this.root.add(m); pool[i] = m; } pool[i].visible = true; return pool[i]; }
  #hide(pool, from) { for (let i = from; i < pool.length; i++) pool[i].visible = false; }
  #text(i) { if (!this.textPool[i]) { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); s.renderOrder = 10; s.userData = { cv, tex, key: '', ratio: 4 }; this.root.add(s); this.textPool[i] = s; } return this.textPool[i]; }
  #paintText(s, txt, color) { const key = txt + '|' + color; if (s.userData.key === key) return; s.userData.key = key; const cv = s.userData.cv, c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    c.font = '800 150px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 30; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(txt, 512, 136); c.fillStyle = color; c.fillText(txt, 512, 136); s.userData.tex.needsUpdate = true; }
}
