// مشهد الواقع المعزز: كاميرا Three.js توضع من وضعية الكاميرا الحقيقية، فتُرسم المؤثرات أجسامًا فوق سطح القرص.
import * as THREE from 'three';
import { rings, ANG0, zoneColor, tierOf, TIERS } from '../vision/geometry.js';

const MAXP = 4000;
const FONT = '"Tajawal","SF Arabic","Geeza Pro","Noto Kufi Arabic",sans-serif';

class Particles {
  constructor(scene, shadow) {
    this.n = 0; this.items = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXP * 3); this.col = new Float32Array(MAXP * 3); this.sa = new Float32Array(MAXP * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('sa', new THREE.BufferAttribute(this.sa, 2).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uShadow: { value: shadow ? 1 : 0 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `attribute vec2 sa; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; vC = color; vA = sa.y;
        gl_PointSize = max(2.0, sa.x * 1.6 * uScale / -mv.z); }`,
      fragmentShader: `varying vec3 vC; varying float vA; uniform float uShadow;
        void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; if (d > 1.0) discard;
        float edge = smoothstep(1.0, 0.75, d); vec3 c = mix(vC * 0.35, vC, smoothstep(1.0, 0.6, d));
        if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, vA * 0.28 * edge); } else { gl_FragColor = vec4(c, vA * edge); } }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = shadow ? 5 : 9;
    scene.add(this.points);
  }
  setScale(s) { this.mat.uniforms.uScale.value = s; }
  upload(list, shadow) {
    let k = 0;
    for (const p of list) { if (k >= MAXP || p.t < 0) continue; const a = 1 - p.t / p.max; this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = shadow ? 0.002 : p.z;
      this.col[k * 3] = p.c[0]; this.col[k * 3 + 1] = p.c[1]; this.col[k * 3 + 2] = p.c[2]; this.sa[k * 2] = p.size * (0.5 + a * 0.5); this.sa[k * 2 + 1] = a; k++; }
    const g = this.points.geometry; g.setDrawRange(0, k);
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.sa.needsUpdate = true;
  }
}

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

export class ARScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
    this.camera.matrixAutoUpdate = false;
    this.root = new THREE.Group(); this.root.scale.z = -1; this.scene.add(this.root); // z>0 في المؤثرات = نحو الكاميرا
    this.particles = []; this.rings3 = []; this.texts = []; this.bolts = []; this.glows = [];
    this.pSys = new Particles(this.root, false); this.pShadow = new Particles(this.root, true);
    this.ringPool = []; this.textPool = []; this.boltPool = []; this.ballMarks = [];
    this.grid = null; this.gridRings = null; this.gridStrong = false; this.visible = false;
    this.slow = 0; this.light = 1;
    this.zoneGeo = new Map();
    this.#buildGrid();
  }
  resize(w, h, dpr) { this.renderer.setPixelRatio(Math.min(2, dpr)); this.renderer.setSize(w, h, false); this.w = w; this.h = h; }

  // وضعية الكاميرا من عامل الرؤية (R=[r1 r2 r3], t، بإحداثيات الرؤية الحاسوبية: X يمين، Y أسفل، Z أمام)
  setPose(p, videoW, videoH) {
    if (!p) { this.visible = false; return; }
    this.visible = true;
    const R = [p.r1, p.r2, p.r3], t = p.t;
    // تحويل إلى اصطلاح Three (Y أعلى، Z خلف): F = diag(1,-1,-1)
    const E = new THREE.Matrix4().set(
      R[0][0], R[1][0], R[2][0], t[0],
      -R[0][1], -R[1][1], -R[2][1], -t[1],
      -R[0][2], -R[1][2], -R[2][2], -t[2],
      0, 0, 0, 1);
    const M = E.clone().invert();
    this.camera.matrixWorld.copy(M); this.camera.matrixWorldInverse.copy(E);
    this.camera.fov = (2 * Math.atan(videoH / (2 * p.f)) * 180) / Math.PI; this.camera.aspect = videoW / videoH; this.camera.updateProjectionMatrix();
    const scale = (this.h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.pSys.setScale(scale); this.pShadow.setScale(scale);
  }
  setLight(b) { this.light = 0.75 + 0.5 * Math.min(1, Math.max(0, b)); }

  #buildGrid() {
    if (this.grid) { this.root.remove(this.grid); this.grid.geometry.dispose(); }
    const pts = [];
    const circle = (r) => { for (let i = 0; i < 72; i++) { const a0 = (i / 72) * 6.2832, a1 = ((i + 1) / 72) * 6.2832; pts.push(r * Math.sin(a0), -r * Math.cos(a0), 0, r * Math.sin(a1), -r * Math.cos(a1), 0); } };
    circle(1); circle(rings.inner); circle(rings.bull);
    for (let i = 0; i < 12; i++) { const a = ((i * 30 + ANG0) * Math.PI) / 180; pts.push(rings.bull * Math.sin(a), -rings.bull * Math.cos(a), 0, Math.sin(a), -Math.cos(a), 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x78ffbe, transparent: true, opacity: 0.25, depthTest: false }));
    this.grid.position.z = 0.003; this.grid.renderOrder = 2; this.root.add(this.grid);
    this.gridRings = [rings.bull, rings.inner];
    if (!this.sweep) { const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -1, 0], 3));
      this.sweep = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xf6cf1c, transparent: true, opacity: 0.9, depthTest: false })); this.sweep.position.z = 0.004; this.root.add(this.sweep); }
  }
  setGrid(mode) { this.gridMode = mode; } // 'off' | 'soft' | 'strong'

  zoneGeometry(z) {
    if (this.zoneGeo.has(z.id)) return this.zoneGeo.get(z.id);
    const sh = new THREE.Shape();
    if (z.ring === 'b') sh.absarc(0, 0, rings.bull, 0, 6.2832, false);
    else { const a0 = ((z.idx * 30 + ANG0 - 90) * Math.PI) / 180, a1 = a0 + Math.PI / 6, r0 = z.ring === 'i' ? rings.bull : rings.inner, r1 = z.ring === 'i' ? rings.inner : 0.985;
      sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); }
    const g = new THREE.ShapeGeometry(sh, 24); this.zoneGeo.set(z.id, g); return g;
  }
  // ---------- المؤثرات ----------
  burst(x, y, n, cols, sp, up, size, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = sp * (0.3 + Math.random()), vz = up * (0.4 + Math.random()); this.particles.push({ x, y, z: 0.02, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz, size: size * (0.5 + Math.random()), c: cols[i % cols.length], t: 0, max: life * (0.6 + Math.random() * 0.6) }); } }
  fountain(x, y, n, cols, size, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 0.15 * Math.random(); this.particles.push({ x, y, z: 0.02, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.2 + Math.random() * 1.4, size: size * (0.5 + Math.random()), c: cols[i % cols.length], t: (-i / n) * life * 0.5, max: life }); } }
  trail(u, v) { if (this.particles.length < MAXP - 10) for (let i = 0; i < 3; i++) this.particles.push({ x: u + (Math.random() - 0.5) * 0.05, y: v + (Math.random() - 0.5) * 0.05, z: 0.05, vx: 0, vy: 0, vz: 0.1, size: 0.025, c: hex('#fff3a8'), t: 0, max: 0.4 }); }
  ring(x, y, vr, life, c, w, delay, vz) { this.rings3.push({ x, y, z: 0, r: 0.02, vr, life, t: -(delay || 0), c, w, vz: vz || 0 }); }
  tower(x, y, n, c, life) { for (let i = 0; i < n; i++) this.rings3.push({ x, y, z: 0, r: 0.02, vr: 0.9, vz: 0.5 + i * 0.12, life, t: -i * 0.1, c, w: 0.02 }); }
  text(x, y, z, txt, c, size, life) { this.texts.push({ x, y, z, txt, c, size, life, t: 0 }); }
  bolt(x0, y0, x1, y1, c) { const pts = [[x0, y0]], n = 9; for (let i = 1; i < n; i++) { const k = i / n, j = (1 - Math.abs(k - 0.5) * 2) * 0.12 + 0.03; pts.push([x0 + (x1 - x0) * k + (Math.random() - 0.5) * j, y0 + (y1 - y0) * k + (Math.random() - 0.5) * j]); } pts.push([x1, y1]); this.bolts.push({ pts, t: 0, life: 0.35, c }); }
  glow(z, c, life) { this.glows.push({ z, c, t: 0, life }); }

  hit(z, u, v, onCine) {
    const t = tierOf(z.pts), zc = hex(zoneColor(z)), tc = hex(TIERS[t].c), W = hex('#fff'), gold = hex('#ffd23d');
    this.glow(z, zc, 1.1 + t * 0.5);
    if (t === 0) { this.burst(u, v, 60, [zc, W], 0.9, 1.2, 0.03, 0.8); this.ring(u, v, 1.2, 0.5, zc, 0.03); }
    else if (t === 1) { this.burst(u, v, 130, [zc, tc, W], 1.3, 2, 0.035, 1); this.tower(u, v, 3, tc, 0.9); this.ring(u, v, 1.6, 0.6, tc, 0.04); }
    else if (t === 2) { this.burst(u, v, 220, [hex('#ff7a3d'), gold, hex('#ff3d3d'), W], 1.8, 2.8, 0.04, 1.3); this.fountain(u, v, 90, [gold, W], 0.03, 1.6); this.tower(u, v, 5, hex('#ff7a3d'), 1.1);
      this.ring(u, v, 2.4, 0.7, hex('#ff7a3d'), 0.05); this.ring(u, v, 1.8, 0.8, gold, 0.03, 0.12);
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283; this.bolt(u, v, Math.sin(a), -Math.cos(a), hex('#ffe9a8')); } }
    else { this.slow = 1.6; if (onCine) onCine();
      this.burst(u, v, 340, [gold, hex('#ff3d6e'), W, hex('#3fb6ff'), hex('#7be36a')], 2.4, 3.6, 0.045, 2.2); this.fountain(u, v, 180, [gold, W, hex('#ff3d6e')], 0.035, 2.4); this.tower(u, v, 8, gold, 1.6);
      for (let i = 0; i < 5; i++) this.ring(u, v, 2.8 - i * 0.35, 1.1, i % 2 ? W : gold, 0.06 - i * 0.008, i * 0.14);
      for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; this.bolt(u, v, Math.sin(a), -Math.cos(a), W); }
      for (let k = 0; k < 10; k++) setTimeout(() => { const a = Math.random() * 6.283; this.burst(Math.sin(a) * 0.95, -Math.cos(a) * 0.95, 80, [gold, hex('#ff3d6e'), hex('#3fb6ff'), hex('#7be36a'), W], 1, 2.4, 0.03, 1.3); if (this.onFirework) this.onFirework(); }, 500 + k * 240); }
    this.text(u, v, 0.32, '+' + z.pts, '#ffffff', 0.22 + t * 0.07, 1.5 + t * 0.3);
    this.text(u, v + 0.16, 0.02, ['ضربة موفّقة', 'ضربة قوية!', 'ضربة نارية!', 'ضربة أسطورية!'][t], TIERS[t].c, 0.11 + t * 0.02, 1.5 + t * 0.3);
  }
  celebrate() { const gold = hex('#ffd23d'), W = hex('#fff'); this.burst(0, 0, 160, [gold, W, hex('#7be36a')], 1.6, 2.6, 0.035, 1.4); }

  step(dt, t) {
    const k = this.slow > 0 ? 0.35 : 1; this.slow = Math.max(0, this.slow - dt); dt *= k;
    this.particles = this.particles.filter((p) => { p.t += dt; if (p.t < 0) return true; p.vz -= 4.5 * dt; p.vx *= 1 - 0.8 * dt; p.vy *= 1 - 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; } return p.t < p.max; });
    this.rings3 = this.rings3.filter((r) => { r.t += dt; if (r.t > 0) { r.r += r.vr * dt * (1 - (r.t / r.life) * 0.6); r.z += r.vz * dt; } return r.t < r.life; });
    this.texts = this.texts.filter((x) => { x.t += dt; x.z += 0.25 * dt; return x.t < x.life; });
    this.bolts = this.bolts.filter((b) => { b.t += dt; return b.t < b.life; });
    this.glows = this.glows.filter((g) => { g.t += dt; return g.t < g.life; });
    if (this.gridRings && (this.gridRings[0] !== rings.bull || this.gridRings[1] !== rings.inner)) this.#buildGrid();
  }

  render(t, balls) {
    if (!this.visible) { this.renderer.clear(); return; }
    // الشبكة
    const gm = this.gridMode || 'soft';
    this.grid.visible = gm !== 'off'; this.grid.material.opacity = gm === 'strong' ? 0.55 + 0.35 * Math.sin(t / 260) : 0.18;
    this.sweep.visible = gm === 'strong'; if (this.sweep.visible) this.sweep.rotation.z = -((t / 900) % 6.283);
    // الجسيمات وظلالها
    this.pSys.upload(this.particles, false); this.pShadow.upload(this.particles, true);
    // الحلقات
    let ri = 0;
    for (const r of this.rings3) { if (r.t <= 0) continue; const m = this.#ring(ri++); m.visible = true; m.position.set(r.x, r.y, r.z + 0.004); const s = Math.max(0.01, r.r); m.scale.set(s, s, 1);
      m.material.color.setRGB(r.c[0], r.c[1], r.c[2]); m.material.opacity = 1 - r.t / r.life; }
    for (let i = ri; i < this.ringPool.length; i++) this.ringPool[i].visible = false;
    // توهج الخانة
    let gi = 0;
    for (const g of this.glows) { const m = this.#glowMesh(gi++); m.visible = true; m.geometry = this.zoneGeometry(g.z); m.material.color.setRGB(g.c[0], g.c[1], g.c[2]); m.material.opacity = Math.max(0, (1 - g.t / g.life) * (0.45 + 0.3 * Math.sin(g.t * 18))); }
    for (let i = gi; i < this.glowPool?.length; i++) this.glowPool[i].visible = false;
    // البرق
    let bi = 0;
    for (const b of this.bolts) { const l = this.#bolt(bi++); l.visible = true; const arr = l.geometry.attributes.position.array; b.pts.forEach((p, i) => { arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = 0.01; }); l.geometry.attributes.position.needsUpdate = true; l.material.color.setRGB(b.c[0], b.c[1], b.c[2]); l.material.opacity = 1 - b.t / b.life; }
    for (let i = bi; i < this.boltPool.length; i++) this.boltPool[i].visible = false;
    // النصوص
    let ti = 0;
    for (const x of this.texts) { const s = this.#text(ti++); s.visible = true; this.#paintText(s, x.txt, x.c); const a = Math.min(1, (x.life - x.t) * 2.5), k = x.t < 0.18 ? 0.5 + (x.t / 0.18) * 0.6 : 1.1 - Math.min(0.1, x.t - 0.18);
      s.material.opacity = a; s.position.set(x.x, x.y, x.z); s.scale.set(x.size * k * s.userData.ratio, x.size * k, 1); }
    for (let i = ti; i < this.textPool.length; i++) this.textPool[i].visible = false;
    // علامات الكرات المسجّلة
    balls = balls || [];
    for (let i = 0; i < balls.length; i++) { const m = this.#ballMark(i); m.visible = true; m.position.set(balls[i][0], balls[i][1], 0.005); }
    for (let i = balls.length; i < this.ballMarks.length; i++) this.ballMarks[i].visible = false;
    this.renderer.render(this.scene, this.camera);
  }
  #ring(i) { if (!this.ringPool[i]) { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 6; this.root.add(m); this.ringPool[i] = m; } return this.ringPool[i]; }
  #glowMesh(i) { this.glowPool = this.glowPool || []; if (!this.glowPool[i]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); m.position.z = 0.002; m.renderOrder = 3; this.root.add(m); this.glowPool[i] = m; } return this.glowPool[i]; }
  #bolt(i) { if (!this.boltPool[i]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); l.renderOrder = 7; this.root.add(l); this.boltPool[i] = l; } return this.boltPool[i]; }
  #text(i) { if (!this.textPool[i]) { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); s.renderOrder = 10; s.userData = { cv, tex, key: '', ratio: 4 }; this.root.add(s); this.textPool[i] = s; } return this.textPool[i]; }
  #paintText(s, txt, color) { const key = txt + '|' + color; if (s.userData.key === key) return; s.userData.key = key; const cv = s.userData.cv, c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    c.font = '800 150px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(txt, 512, 136); c.fillStyle = color; c.fillText(txt, 512, 136); s.userData.tex.needsUpdate = true; }
  #ballMark(i) { if (!this.ballMarks[i]) { const m = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.125, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false })); m.renderOrder = 4; this.root.add(m); this.ballMarks[i] = m; } return this.ballMarks[i]; }
}
