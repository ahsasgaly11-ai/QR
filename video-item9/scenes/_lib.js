// ═══ أدوات مشتركة لفيلم «منصة مناهج قطر التفاعلية» — كل الألوان من theme.json (لوحة المشروع) ═══
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const W = 1920, H = 1080;
export const rr = (X, x, y, w, h, r) => { X.beginPath(); X.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };

/* ── خلفيات ── */
export function paper(ctx, X, o = {}) {           // الكريمي الفاتح للموقع + نسيج ناعم
  const P = ctx.P; X.fillStyle = o.color || P.bg; X.fillRect(0, 0, W, H);
  const g = X.createRadialGradient(W * .72, H * .28, 80, W * .5, H * .5, W * .75); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  if (o.sadu !== false) { sadu(ctx, X, 0, o.saduK ?? 1); sadu(ctx, X, H - 22, o.saduK ?? 1); }
}
export function maroon(ctx, X, o = {}) {          // العنّابي الغامق للحظات القوية
  const P = ctx.P; const g = X.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.acc); g.addColorStop(1, P.clay);
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  const v = X.createRadialGradient(W * .5, H * .45, 200, W * .5, H * .5, W * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
  X.fillStyle = v; X.fillRect(0, 0, W, H);
  if (o.sadu) { sadu(ctx, X, 0, 1, true); sadu(ctx, X, H - 22, 1, true); }
}
/* شريط السدو (معيّنات) كما في الموقع — k: نسبة الظهور من اليمين */
export function sadu(ctx, X, y, k = 1, onDark = false) {
  const P = ctx.P, h = 22, n = 48, s = W / n; X.save();
  X.fillStyle = onDark ? 'rgba(0,0,0,.18)' : P.acc; X.fillRect(0, y, W, h);
  X.beginPath(); X.rect(W - W * ctx.clamp(k), y, W * ctx.clamp(k), h); X.clip();
  for (let i = 0; i < n; i++) { const cx = i * s + s / 2, cy = y + h / 2;
    X.fillStyle = onDark ? P.hi : P.sand; X.beginPath(); X.moveTo(cx, cy - 8); X.lineTo(cx + 8, cy); X.lineTo(cx, cy + 8); X.lineTo(cx - 8, cy); X.closePath(); X.fill();
    X.fillStyle = onDark ? P.acc : P.acc; X.beginPath(); X.moveTo(cx, cy - 3.5); X.lineTo(cx + 3.5, cy); X.lineTo(cx, cy + 3.5); X.lineTo(cx - 3.5, cy); X.closePath(); X.fill(); }
  X.restore();
}

/* ── نص متزامن مع الصوت: الكلمة تطلع من تحت خط الأساس لحظة نطقها ── */
const LC = new Map();
export function layoutOf(ctx, X, str, o) { const k = str + '|' + o.family + o.weight + o.size + (o.maxWidth || '') + (o.lineHeight || ''); if (!LC.has(k)) LC.set(k, ctx.text.layout(X, str, o)); return LC.get(k); }
export function vo(ctx, X, t, lineId, str, x, y, o = {}) {
  const L = layoutOf(ctx, X, str, { family: o.family || 'display', weight: o.weight || 700, size: o.size || 72, maxWidth: o.maxWidth || 1500, lineHeight: o.lineHeight || 1.45 });
  const lead = o.lead ?? .08, dur = o.dur ?? .32, map = o.map, hold = o.hold;       // map: فهرس الكلمة المرسومة → فهرس كلمة الصوت
  return ctx.text.drawLayout(X, L, x, y, { align: o.align || 'center', color: o.color, perWord: (i, w, box) => {
    const vi = map ? map[i] : i, wt = ctx.wordTime(lineId, Math.min(vi, ctx.wordsOf(lineId).length - 1));
    const k = ctx.at(t, wt.s - lead, wt.s - lead + dur, 'expoOut');
    let alpha = k > 0 ? 1 : 0; if (o.fadeAt != null) alpha *= 1 - ctx.at(t, o.fadeAt, o.fadeAt + .3);
    const sz = o.size || 72;
    const st = { clip: { x: box.x - 30, y: box.y - sz * .35, w: box.w + 60, h: sz * 1.62 }, dy: (1 - k) * sz * 1.25, alpha };
    if (o.emph && o.emph.includes(i)) st.color = o.emphColor || ctx.P.acc;
    return st; } });
}
/* نص ثابت يدخل كله (بلا مزامنة) من وقت s */
export function textIn(ctx, X, t, str, x, y, s, o = {}) {
  const k = ctx.at(t, s, s + (o.dur ?? .35), 'expoOut'); if (k <= 0) return;
  let a = k; if (o.e != null) a *= 1 - ctx.at(t, o.e, o.e + .25);
  X.save(); X.globalAlpha *= a; X.translate(0, (1 - k) * (o.rise ?? 26));
  ctx.text(X, str, x, y, { family: o.family || 'body', weight: o.weight || 500, size: o.size || 40, color: o.color || ctx.P.ink, align: o.align || 'center', maxWidth: o.maxWidth });
  X.restore();
}

/* ── صور: رسم صورة داخل صندوق (cover/contain) مع قص مدوّر؛ sy/sh: جزء من الصورة (للتمرير) ── */
export function pic(X, im, box, o = {}) {
  const { x, y, w, h } = box; X.save(); if (o.r) { rr(X, x, y, w, h, o.r); X.clip(); }
  const sw = im.naturalWidth || im.width, sh0 = im.naturalHeight || im.height;
  if (o.crop) { const c = o.crop; X.drawImage(im, c.x, c.y, c.w, c.h, x, y, w, h); }
  else if (o.mode === 'top') { const s = w / sw, vis = h / s; X.drawImage(im, 0, o.sy || 0, sw, vis, x, y, w, h); }       // عرض كامل، أعلى الصورة (أو من sy)
  else { const s = Math.max(w / sw, h / sh0), dw = sw * s, dh = sh0 * s; X.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  X.restore();
}
/* إطار متصفّح مرسوم (ثلاث نقاط + شريط عنوان) → يرجع صندوق المحتوى */
export function browser(ctx, X, box, o = {}) {
  const P = ctx.P, { x, y, w, h } = box, bar = o.bar ?? 54; X.save();
  X.shadowColor = 'rgba(35,26,23,.25)'; X.shadowBlur = 50; X.shadowOffsetY = 22; X.fillStyle = '#ffffff'; rr(X, x, y, w, h, 18); X.fill(); X.shadowColor = 'transparent';
  X.fillStyle = P.sand; rr(X, x, y, w, bar, 18); X.fill(); X.fillRect(x, y + bar - 18, w, 18);
  [P.acc, P.hi, P.teal].forEach((c, i) => { X.fillStyle = c; X.beginPath(); X.arc(x + w - 30 - i * 26, y + bar / 2, 7, 0, 6.283); X.fill(); });
  X.fillStyle = '#ffffff'; rr(X, x + 24, y + 12, w - 140, bar - 24, 10); X.fill();
  ctx.text(X, o.url || 'qr-xi-seven.vercel.app', x + 24 + (w - 140) / 2, y + bar / 2 + 7, { family: 'num', weight: 500, size: 19, color: P.mut, dir: 'ltr' });
  X.restore(); return { x: x, y: y + bar, w, h: h - bar };
}

/* ── جهاز ثلاثي الأبعاد حقيقي (ماك بوك / آيفون) بشاشة من لقطة الموقع ── */
export class Device {
  constructor(ctx, kind = 'laptop', o = {}) {
    this.ctx = ctx; this.kind = kind; const P = ctx.P;
    this.st = ctx.stage3D({ fov: kind === 'laptop' ? 26 : 30, camera: [0, 0, 9], env: 'room', tone: 'neutral', samples: o.samples ?? 2, fxaa: false });
    const { scene } = this.st;
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(3, 5, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(P.hi), 0.9); rim.position.set(-5, 2, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.rig = new THREE.Group(); scene.add(this.rig);
    this.scrC = document.createElement('canvas'); this.scrX = this.scrC.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.scrC); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const screenMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    if (kind === 'laptop') {
      const alu = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.metal || '#b9bbc0'), metalness: .85, roughness: .5, envMapIntensity: .6 });
      const BW = 3.04, BD = 2.12, BT = .06; this.base = new THREE.Mesh(new RoundedBoxGeometry(BW, BT, BD, 4, .03), alu); this.base.position.y = BT / 2; this.rig.add(this.base);
      const keyGeo = new RoundedBoxGeometry(.17, .012, .16, 2, .02), keyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: .55 });
      const keys = new THREE.InstancedMesh(keyGeo, keyMat, 14 * 5); let k = 0; const m4 = new THREE.Matrix4();
      for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) { m4.makeTranslation(-1.24 + c * .19, BT + .004, -.92 + r * .19); keys.setMatrixAt(k++, m4); } this.rig.add(keys);
      const pad = new THREE.Mesh(new RoundedBoxGeometry(1.2, .004, .72, 2, .002), new THREE.MeshPhysicalMaterial({ color: 0xbfc1c5, metalness: .6, roughness: .25 })); pad.position.set(0, BT + .001, .56); this.rig.add(pad);
      this.hinge = new THREE.Group(); this.hinge.position.set(0, BT, -BD / 2 + .01); this.rig.add(this.hinge);
      const LH = 1.96, LT = .04; const lid = new THREE.Mesh(new RoundedBoxGeometry(BW, LH, LT, 4, .02), alu); lid.position.set(0, LH / 2, 0); this.hinge.add(lid);
      const bezel = new THREE.Mesh(new THREE.PlaneGeometry(BW - .03, LH - .03), new THREE.MeshStandardMaterial({ color: 0x060607, roughness: .3 })); bezel.position.set(0, LH / 2, LT / 2 + .001); this.hinge.add(bezel);
      this.SW = BW - .16; this.SH = LH - .2; this.screen = new THREE.Mesh(new THREE.PlaneGeometry(this.SW, this.SH), screenMat); this.screen.position.set(0, LH / 2 - .02, LT / 2 + .002); this.hinge.add(this.screen);
      this.hinge.rotation.x = -.18; this.rig.position.y = -1.05; this.dist = 7.6;
    } else {
      const ti = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.metal || '#8f9196'), metalness: .85, roughness: .4, envMapIntensity: .7 });
      const PW = 1.0, PH = 2.05, PD = .09; const body = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PD, 6, .14), ti); this.rig.add(body);
      const bz = new THREE.Mesh(new THREE.PlaneGeometry(PW - .06, PH - .06), new THREE.MeshStandardMaterial({ color: 0x060607, roughness: .3 })); bz.position.z = PD / 2 + .001; this.rig.add(bz);
      this.SW = PW - .11; this.SH = PH - .11; this.screen = new THREE.Mesh(new THREE.PlaneGeometry(this.SW, this.SH), screenMat); this.screen.position.z = PD / 2 + .002; this.rig.add(this.screen);
      const isl = new THREE.Mesh(new THREE.CapsuleGeometry(.035, .14, 4, 8), new THREE.MeshBasicMaterial({ color: 0x050505 })); isl.rotation.z = Math.PI / 2; isl.position.set(0, PH / 2 - .13, PD / 2 + .004); this.rig.add(isl);
      this.dist = 5.2;
    }
    this._key = '';
  }
  /* يرسم اللقطة على الشاشة: contain بعرض الشاشة من أعلى الصورة + تمرير sy (بكسل الصورة) — أو crop */
  setScreen(im, o = {}) {
    const key = (im.src || '') + '|' + (o.sy || 0) + '|' + (o.crop ? JSON.stringify(o.crop) : '') + '|' + (o.fill || '');
    if (key === this._key) return; this._key = key;
    const cw = 1024, ch = Math.round(cw * this.SH / this.SW); if (this.scrC.width !== cw) { this.scrC.width = cw; this.scrC.height = ch; }
    const X = this.scrX; X.fillStyle = o.fill || '#f6efe3'; X.fillRect(0, 0, cw, ch);
    const sw = im.naturalWidth, sh = im.naturalHeight;
    if (o.crop) { const c = o.crop; X.drawImage(im, c.x, c.y, c.w, c.h, 0, 0, cw, ch); }
    else { const s = cw / sw, vis = ch / s; X.drawImage(im, 0, Math.min(o.sy || 0, Math.max(0, sh - vis)), sw, vis, 0, 0, cw, ch); }
    this.tex.needsUpdate = true;
  }
  /* وضعية: rx/ry بالدرجات على الجهاز، s = قرب الكاميرا (1 = كامل)، fx/fy = نقطة الاهتمام على الشاشة 0-1، px/py = إزاحة الجهاز بالشاشة (-1..1) */
  pose(o = {}) {
    const d2r = Math.PI / 180; this.rig.rotation.set((o.rx || 0) * d2r, (o.ry || 0) * d2r, (o.rz || 0) * d2r);
    const cam = this.st.camera, s = o.s || 1;
    const p = new THREE.Vector3(((o.fx ?? .5) - .5) * this.SW, (.5 - (o.fy ?? .5)) * this.SH, 0); this.screen.updateWorldMatrix(true, false); this.screen.localToWorld(p);
    const center = new THREE.Vector3(0, 0, 0); this.screen.localToWorld(center);
    const tgt = center.clone().lerp(p, ctxClamp((s - 1) / 1.2));
    const dist = this.dist / s; const dir = new THREE.Vector3(0, 0, 1);
    if (o.look === 'screen') { this.screen.getWorldDirection(dir); }
    cam.position.copy(tgt).addScaledVector(dir, dist); cam.position.x += (o.px || 0) * -2.2 / s; cam.position.y += (o.py || 0) * -1.4 / s;
    cam.lookAt(tgt.x + (o.px || 0) * -2.2 / s, tgt.y + (o.py || 0) * -1.4 / s, tgt.z);
  }
  draw(X, o) { this.st.draw(X, o); }
}
const ctxClamp = v => Math.max(0, Math.min(1, v));

/* ── أيقونات خطّية بسيطة (ترسم داخل مربع حجمه s حول (x,y)) ── */
export function icon(X, name, x, y, s, color, lw = s * .09) {
  X.save(); X.translate(x, y); X.strokeStyle = color; X.fillStyle = color; X.lineWidth = lw; X.lineCap = 'round'; X.lineJoin = 'round'; const u = s / 2;
  const P = () => X.beginPath();
  switch (name) {
    case 'flask': P(); X.moveTo(-u * .35, -u); X.lineTo(u * .35, -u); X.moveTo(-u * .22, -u); X.lineTo(-u * .22, -u * .25); X.lineTo(-u * .85, u * .75); X.quadraticCurveTo(-u * .95, u, -u * .7, u); X.lineTo(u * .7, u); X.quadraticCurveTo(u * .95, u, u * .85, u * .75); X.lineTo(u * .22, -u * .25); X.lineTo(u * .22, -u); X.stroke(); P(); X.moveTo(-u * .55, u * .35); X.lineTo(u * .55, u * .35); X.lineTo(u * .72, u * .78); X.lineTo(-u * .72, u * .78); X.closePath(); X.globalAlpha *= .35; X.fill(); break;
    case 'atom': for (let i = 0; i < 3; i++) { P(); X.ellipse(0, 0, u, u * .42, i * Math.PI / 3, 0, 6.283); X.stroke(); } P(); X.arc(0, 0, u * .14, 0, 6.283); X.fill(); break;
    case 'check': P(); X.roundRect(-u * .8, -u, u * 1.6, u * 2, u * .18); X.stroke(); for (let i = 0; i < 3; i++) { const yy = -u * .5 + i * u * .5; P(); X.moveTo(u * .45, yy); X.lineTo(u * .2, yy + u * .22); X.lineTo(u * .05, yy + u * .05); X.stroke(); P(); X.moveTo(-u * .15, yy + u * .1); X.lineTo(-u * .55, yy + u * .1); X.stroke(); } break;
    case 'game': P(); X.roundRect(-u, -u * .55, u * 2, u * 1.1, u * .45); X.stroke(); P(); X.moveTo(u * .55, -u * .22); X.lineTo(u * .55, u * .12); X.moveTo(u * .38, -u * .05); X.lineTo(u * .72, -u * .05); X.stroke(); P(); X.arc(-u * .45, -u * .12, u * .09, 0, 6.283); X.fill(); P(); X.arc(-u * .25, u * .1, u * .09, 0, 6.283); X.fill(); break;
    case 'wifi-off': for (let i = 1; i <= 3; i++) { P(); X.arc(0, u * .5, u * .42 * i, Math.PI * 1.22, Math.PI * 1.78); X.stroke(); } P(); X.arc(0, u * .55, u * .12, 0, 6.283); X.fill(); P(); X.moveTo(-u * .9, -u * .9); X.lineTo(u * .9, u * .9); X.stroke(); break;
    case 'wifi': for (let i = 1; i <= 3; i++) { P(); X.arc(0, u * .5, u * .42 * i, Math.PI * 1.22, Math.PI * 1.78); X.stroke(); } P(); X.arc(0, u * .55, u * .12, 0, 6.283); X.fill(); break;
    case 'download': P(); X.moveTo(0, -u); X.lineTo(0, u * .35); X.moveTo(-u * .5, -u * .1); X.lineTo(0, u * .4); X.lineTo(u * .5, -u * .1); X.moveTo(-u * .9, u * .5); X.lineTo(-u * .9, u * .95); X.lineTo(u * .9, u * .95); X.lineTo(u * .9, u * .5); X.stroke(); break;
    case 'file': P(); X.moveTo(-u * .7, -u); X.lineTo(u * .25, -u); X.lineTo(u * .7, -u * .55); X.lineTo(u * .7, u); X.lineTo(-u * .7, u); X.closePath(); X.stroke(); P(); X.moveTo(u * .25, -u); X.lineTo(u * .25, -u * .55); X.lineTo(u * .7, -u * .55); X.stroke(); break;
    case 'clock': P(); X.arc(0, 0, u, 0, 6.283); X.stroke(); P(); X.moveTo(0, -u * .55); X.lineTo(0, 0); X.lineTo(u * .4, u * .25); X.stroke(); break;
    case 'loop': P(); X.arc(0, 0, u * .8, Math.PI * .15, Math.PI * 1.75); X.stroke(); P(); X.moveTo(u * .55, -u * .95); X.lineTo(u * .8, -u * .5); X.lineTo(u * .3, -u * .4); X.closePath(); X.fill(); break;
    case 'star': P(); for (let i = 0; i < 10; i++) { const r = i % 2 ? u * .45 : u, a = -Math.PI / 2 + i * Math.PI / 5; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); X.stroke(); break;
    case 'hand': P(); X.moveTo(-u * .55, u); X.lineTo(-u * .75, u * .1); X.lineTo(-u * .5, -u * .05); X.lineTo(-u * .3, u * .25); X.lineTo(-u * .3, -u * .85); X.lineTo(-u * .05, -u * .95); X.lineTo(0, u * .1); X.lineTo(0, -u * .75); X.lineTo(u * .25, -u * .8); X.lineTo(u * .3, u * .1); X.lineTo(u * .3, -u * .5); X.lineTo(u * .55, -u * .5); X.lineTo(u * .6, u * .35); X.lineTo(u * .35, u); X.closePath(); X.stroke(); break;
    case 'home': P(); X.moveTo(-u, u * .05); X.lineTo(0, -u * .85); X.lineTo(u, u * .05); X.moveTo(-u * .7, -u * .2); X.lineTo(-u * .7, u * .9); X.lineTo(u * .7, u * .9); X.lineTo(u * .7, -u * .2); X.moveTo(-u * .18, u * .9); X.lineTo(-u * .18, u * .3); X.lineTo(u * .18, u * .3); X.lineTo(u * .18, u * .9); X.stroke(); break;
    case 'target': P(); X.arc(0, 0, u, 0, 6.283); X.stroke(); P(); X.arc(0, 0, u * .55, 0, 6.283); X.stroke(); P(); X.arc(0, 0, u * .15, 0, 6.283); X.fill(); break;
    case 'lens': P(); X.arc(-u * .15, -u * .15, u * .65, 0, 6.283); X.stroke(); P(); X.moveTo(u * .33, u * .33); X.lineTo(u * .9, u * .9); X.stroke(); break;
    case 'users': P(); X.arc(-u * .35, -u * .35, u * .3, 0, 6.283); X.stroke(); P(); X.arc(u * .4, -u * .25, u * .24, 0, 6.283); X.stroke(); P(); X.moveTo(-u * .95, u * .9); X.quadraticCurveTo(-u * .95, u * .1, -u * .35, u * .1); X.quadraticCurveTo(u * .25, u * .1, u * .25, u * .9); X.stroke(); P(); X.moveTo(u * .35, u * .9); X.quadraticCurveTo(u * .4, u * .25, u * .95, u * .35); X.stroke(); break;
    case 'book': P(); X.moveTo(0, -u * .7); X.quadraticCurveTo(-u * .5, -u * .95, -u, -u * .7); X.lineTo(-u, u * .7); X.quadraticCurveTo(-u * .5, u * .45, 0, u * .7); X.quadraticCurveTo(u * .5, u * .45, u, u * .7); X.lineTo(u, -u * .7); X.quadraticCurveTo(u * .5, -u * .95, 0, -u * .7); X.lineTo(0, u * .7); X.stroke(); break;
    case 'question': P(); X.arc(0, -u * .3, u * .5, Math.PI * 1.05, Math.PI * .45); X.quadraticCurveTo(0, u * .15, 0, u * .4); X.stroke(); P(); X.arc(0, u * .85, lw * .75, 0, 6.283); X.fill(); break;
    case 'drop': P(); X.moveTo(0, -u); X.quadraticCurveTo(u * .95, u * .25, u * .55, u * .7); X.quadraticCurveTo(0, u * 1.25, -u * .55, u * .7); X.quadraticCurveTo(-u * .95, u * .25, 0, -u); X.closePath(); X.stroke(); break;
    case 'muscle': P(); X.moveTo(-u, u * .3); X.quadraticCurveTo(-u * .9, -u * .6, -u * .2, -u * .5); X.quadraticCurveTo(u * .2, -u * .4, u * .3, -u * .9); X.quadraticCurveTo(u * .9, -u * .9, u, -u * .2); X.quadraticCurveTo(u, u * .7, u * .2, u * .8); X.quadraticCurveTo(-u * .6, u, -u, u * .3); X.stroke(); break;
    case 'chart': P(); X.moveTo(-u, u); X.lineTo(u, u); X.moveTo(-u, u); X.lineTo(-u, -u); X.stroke(); [[-.6, .3], [-.2, -.1], [.2, .5], [.6, -.55]].forEach(([dx, h0]) => { P(); X.roundRect(dx * u - u * .14, h0 * u, u * .28, u - h0 * u, u * .06); X.globalAlpha = .9; X.fill(); }); break;
    case 'arrow-l': P(); X.moveTo(u, 0); X.lineTo(-u, 0); X.moveTo(-u * .35, -u * .6); X.lineTo(-u, 0); X.lineTo(-u * .35, u * .6); X.stroke(); break;
    case 'check1': P(); X.moveTo(-u * .7, 0); X.lineTo(-u * .15, u * .55); X.lineTo(u * .8, -u * .55); X.stroke(); break;
  }
  X.restore();
}

/* ── بطاقة (chip) مع أيقونة ونص تدخل من وقت s ── */
export function chip(ctx, X, t, o) {
  const k = ctx.at(t, o.s, o.s + .38, 'expoOut'); if (k <= 0) return; const P = ctx.P;
  const w = o.w || 420, h = o.h || 96, x = o.x - w / 2, y = o.y - h / 2; X.save(); X.globalAlpha *= k * (o.e != null ? 1 - ctx.at(t, o.e, o.e + .25) : 1);
  X.translate(o.x, o.y); X.scale(.94 + .06 * k, .94 + .06 * k); X.translate(-o.x, -o.y);
  X.shadowColor = 'rgba(35,26,23,.18)'; X.shadowBlur = 30; X.shadowOffsetY = 12; X.fillStyle = o.fill || '#ffffff'; rr(X, x, y, w, h, h / 2); X.fill(); X.shadowColor = 'transparent';
  if (o.stroke) { X.strokeStyle = o.stroke; X.lineWidth = 3; rr(X, x, y, w, h, h / 2); X.stroke(); }
  const ix = x + w - h / 2; if (o.icon) { X.fillStyle = o.iconBg || P.sand; X.beginPath(); X.arc(ix, o.y, h * .36, 0, 6.283); X.fill(); icon(X, o.icon, ix, o.y, h * .4, o.iconColor || P.acc); }
  ctx.text(X, o.text, o.icon ? ix - h * .5 : x + w / 2, o.y + (o.size || 34) * .36, { family: o.family || 'body', weight: o.weight || 600, size: o.size || 34, color: o.color || P.ink, align: o.icon ? 'right' : 'center', maxWidth: w - (o.icon ? h * 1.3 : 40) });
  X.restore();
}

/* ── عدّاد بأرقام ثابتة العرض (كل رقم بخانة) ── */
export function counter(ctx, X, t, o) {
  const k = ctx.at(t, o.s, o.s + (o.dur || 1.1), 'expoOut'); if (k <= 0 && !o.keep) return;
  const v = Math.round((o.from || 0) + ((o.to) - (o.from || 0)) * k), str = String(v) + (o.suffix || ''), size = o.size || 150, cw = size * .62;
  X.save(); X.globalAlpha *= o.alpha ?? 1; const tot = str.length * cw; let x = o.x - tot / 2 + cw / 2;
  for (const ch of str) { ctx.text(X, ch, x, o.y, { family: 'num', weight: o.weight || 800, size, color: o.color || ctx.P.acc, dir: 'ltr' }); x += cw; }
  X.restore();
}
/* ظلّ ناعم تحت جهاز (قبل الرسم ثلاثي الأبعاد) */
export function blob(X, x, y, w, h, a = .22) { const g = X.createRadialGradient(x, y, 10, x, y, w / 2); g.addColorStop(0, `rgba(35,26,23,${a})`); g.addColorStop(1, 'rgba(35,26,23,0)'); X.save(); X.translate(x, y); X.scale(1, h / w); X.translate(-x, -y); X.fillStyle = g; X.fillRect(x - w / 2, y - w / 2, w, w); X.restore(); }
/* مؤشّر/حلقة تركيز تنبض حول نقطة */
export function ring(ctx, X, t, x, y, r, color, s) { const k = ctx.at(t, s, s + .5, 'expoOut'); if (k <= 0) return; X.save(); X.strokeStyle = color; X.lineWidth = 6; X.globalAlpha *= k; X.beginPath(); X.arc(x, y, r * (0.6 + .4 * k), 0, 6.283); X.stroke(); const p = ((t - s) % 1.2) / 1.2; X.globalAlpha *= (1 - p) * .6; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r * (1 + p * .7), 0, 6.283); X.stroke(); X.restore(); }
/* مستطيل تظليل (spotlight) على جزء من لقطة: يعتّم الباقي ويرسم إطارًا ذهبيًا */
export function spot(ctx, X, t, box, s, o = {}) { const k = ctx.at(t, s, s + .45, 'expoOut'); if (k <= 0) return; const { x, y, w, h } = box; X.save(); X.globalAlpha *= k;
  if (o.dim !== false) { X.fillStyle = `rgba(35,26,23,${o.dimA ?? .38})`; X.beginPath(); X.rect(0, 0, W, H); X.roundRect(x, y, w, h, 16); X.fill('evenodd'); }
  X.strokeStyle = o.color || ctx.P.hi; X.lineWidth = o.lw || 6; rr(X, x, y, w, h, 16); X.stroke(); X.restore(); }
