// ---------------------------------------------------------------------------
// مواد «أسبوع الزكام» (PBR بعقد TSL — three.js r186، WebGPURenderer):
// كل سطح مهم له لمعان وخشونة وانعكاس من البيئة (PMREM)، وتفاصيل إجرائية بالضجيج
// بلا أنسجة خارجية: أرضية تيرازو مصقولة، وجص بتفاوت لون خفيف، وخشب بعروق، ومينا لامعة،
// وذهب وكروم، وزجاج حقيقي (transmission) في الطبقة A فقط.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import {
  abs, color, dot, float, fract, mix, mx_fractal_noise_float, mx_noise_float, normalView, oneMinus,
  positionLocal, positionViewDirection, positionWorld, sin, smoothstep, step, texture, time, uv, vec2, vec3, max,
} from 'three/tsl';

/** تفاوت لوني منخفض التردد (يكسر «بلاستيكية» السطوح الكبيرة) */
const mottle = (scale = 1.6, amt = 0.06) => float(1).add(mx_fractal_noise_float(positionWorld.mul(scale), 3, 2.0, 0.5).mul(amt));

export function plaster(hex = 0xf3ead8) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.88, metalness: 0 });
  m.colorNode = color(hex).mul(mottle(1.4, 0.07)).mul(float(1).add(mx_noise_float(positionWorld.mul(38)).mul(0.025)));
  return m;
}

/** أرضية تيرازو مصقولة: حبيبات ملوّنة صغيرة + فواصل بلاط خفيفة + طلاء لامع يعكس النوافذ */
export function terrazzo() {
  const m = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22 });
  const p = positionWorld.xz;
  const n1 = mx_noise_float(vec3(p.mul(26), 0.0));
  const n2 = mx_noise_float(vec3(p.mul(31).add(7.3), 1.7));
  const n3 = mx_noise_float(vec3(p.mul(18).add(3.1), 4.2));
  const base = color(0xe4d3b6).mul(mottle(0.9, 0.06));
  let c = mix(base, color(0xc9b28a), smoothstep(0.42, 0.47, n1));
  c = mix(c, color(0x9fb8b0), smoothstep(0.5, 0.55, n2));
  c = mix(c, color(0xd88f6a), smoothstep(0.55, 0.6, n3));
  // فواصل البلاط (٦٠ سم)
  const g = fract(p.div(0.6));
  const edge = max(smoothstep(0.985, 1.0, g.x).add(oneMinus(smoothstep(0.0, 0.015, g.x))), smoothstep(0.985, 1.0, g.y).add(oneMinus(smoothstep(0.0, 0.015, g.y))));
  m.colorNode = mix(c, c.mul(0.82), edge.clamp(0, 1));
  return m;
}

/** خشب بعروق (للطاولات والباب والإطارات) */
export function wood(hex = 0xc8915a, { roughness = 0.5, clearcoat = 0.45, grain = 1 } = {}) {
  const m = new THREE.MeshPhysicalNodeMaterial({ roughness, clearcoat, clearcoatRoughness: 0.25 });
  const p = positionLocal;
  const ring = sin(p.x.mul(46).add(mx_noise_float(p.mul(vec3(2, 9, 9))).mul(5))).mul(0.5).add(0.5);
  const fine = mx_noise_float(p.mul(vec3(4, 60, 60))).mul(0.5).add(0.5);
  const base = color(hex);
  const k = ring.mul(0.7).add(fine.mul(0.3)).mul(grain).add(1 - grain);
  m.colorNode = mix(base.mul(0.8), base.mul(1.08), k);
  return m;
}

/** مينا لامعة مشبعة (الكراسي، السلة، الحوض، أجسام الدمى) */
export function enamel(hex, o = {}) {
  return new THREE.MeshPhysicalNodeMaterial({ color: hex, roughness: 0.36, clearcoat: 0.9, clearcoatRoughness: 0.14, ...o });
}

export function gold() {
  return new THREE.MeshPhysicalNodeMaterial({ color: 0xe2b25c, metalness: 1, roughness: 0.26 });
}
export function chrome() {
  return new THREE.MeshPhysicalNodeMaterial({ color: 0xe1e6ec, metalness: 1, roughness: 0.18 });
}

/** زجاج: حقيقي في A (transmission)، ورخيص شفاف في B */
export function glass(tier, tint = 0xe8f6ff) {
  if (tier === 'A') return new THREE.MeshPhysicalNodeMaterial({ color: tint, transmission: 1, thickness: 0.02, ior: 1.5, roughness: 0.04, metalness: 0 });
  return new THREE.MeshPhysicalNodeMaterial({ color: tint, transparent: true, opacity: 0.32, roughness: 0.05, clearcoat: 1, depthWrite: false });
}

/** بلاستيك قنينة الماء (زجاجي ملوّن) */
export function bottlePlastic(tier, tint) {
  if (tier === 'A') return new THREE.MeshPhysicalNodeMaterial({ color: tint, transmission: 0.92, thickness: 0.06, ior: 1.46, roughness: 0.12 });
  return new THREE.MeshPhysicalNodeMaterial({ color: tint, transparent: true, opacity: 0.6, roughness: 0.15, clearcoat: 1 });
}

/** ورق المنديل: ناعم بلمعة قماشية (sheen) */
export function tissuePaper() {
  return new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff, roughness: 0.82, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
}

/** فقاعات صابون متقزّحة */
export function bubbleMat(tier) {
  return new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [180, 620],
    transparent: true, opacity: tier === 'A' ? 0.45 : 0.38, depthWrite: false, clearcoat: 1,
  });
}

/**
 * ضوء متوهّج إضافي (أشعة النوافذ، وعمود الإبراز فوق الدمية): يتلاشى نحو الأطراف والأسفل.
 * @param {any} uK شدة (uniform)
 */
export function beam(hex, uK, { softness = 1.6 } = {}) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const facing = abs(dot(normalView, positionViewDirection));
  const edge = facing.pow(softness);
  const along = smoothstep(0.0, 0.35, uv().y).mul(oneMinus(smoothstep(0.8, 1.0, uv().y)).mul(0.6).add(0.4));
  const flick = sin(time.mul(0.7).add(positionWorld.x.mul(3))).mul(0.06).add(0.94);
  m.colorNode = color(hex);
  m.opacityNode = edge.mul(along).mul(uK).mul(flick);
  return m;
}

/** بقعة ضوء المشربية على الأرض: نقش النجوم يسقط مضيئًا (إضافي، فلا يحتاج خريطة ظل) */
export function lightPatch(tex, uK, hex = 0xffe6b8) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const holes = oneMinus(texSample(tex));
  const fade = smoothstep(0.0, 0.25, uv().y).mul(oneMinus(smoothstep(0.75, 1.0, uv().y))).mul(smoothstep(0.0, 0.12, uv().x)).mul(oneMinus(smoothstep(0.88, 1.0, uv().x)));
  m.colorNode = color(hex);
  m.opacityNode = holes.mul(fade).mul(uK);
  return m;
}
function texSample(tex) {
  return texture(tex, uv().mul(vec2(3, 3.6))).a;
}

/** المشربية: خشب داكن مفرّغ بنقش النجوم (alphaTest) */
export function mashrabiya(tex) {
  const m = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.55, clearcoat: 0.35, side: THREE.DoubleSide, alphaTest: 0.5 });
  const a = texture(tex, uv().mul(vec2(3, 3.6))).a;
  m.colorNode = color(0x7b4a26).mul(mottle(6, 0.08));
  m.opacityNode = a;
  return m;
}

/** إطار سماء خلف النوافذ (لكل صف لونه: يتغيّر مع وقت اليوم) */
export function windowSky(uTop, uHorizon, uSun) {
  const m = new THREE.MeshBasicNodeMaterial();
  const y = uv().y;
  const c = mix(uHorizon, uTop, smoothstep(0.0, 1.0, y));
  const sunGlow = oneMinus(smoothstep(0.0, 0.55, uv().sub(vec2(0.3, 0.75)).length())).pow(2);
  m.colorNode = c.add(uSun.mul(sunGlow).mul(0.8));
  return m;
}

/**
 * قبة السماء: تدرّج ثلاثي + قرص شمس + سحب بضجيج متعدد الطبقات (FBM).
 * @param {{top:any, mid:any, horizon:any, sun:any, sunDir:any, octaves:number}} u
 */
export function skyDome(u) {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  const dir = positionWorld.sub(vec3(0, 0, 0)).normalize();
  const h = dir.y;
  const lo = mix(u.horizon, u.mid, smoothstep(0.0, 0.25, h));
  let c = mix(lo, u.top, smoothstep(0.2, 0.75, h));
  const sd = dot(dir, u.sunDir.normalize()).clamp(0, 1);
  const disc = smoothstep(0.9975, 0.9988, sd);
  const halo = sd.pow(80).mul(0.6).add(sd.pow(8).mul(0.18));
  c = c.add(u.sun.mul(disc.mul(4).add(halo)));
  // سحب ناعمة تنجرف ببطء
  const q = dir.xz.div(h.add(0.18)).mul(1.4).add(vec2(time.mul(0.006), 0));
  const cl = mx_fractal_noise_float(vec3(q, time.mul(0.01)), u.octaves, 2.0, 0.5).mul(0.5).add(0.5);
  const cloud = smoothstep(0.52, 0.78, cl).mul(smoothstep(0.02, 0.2, h)).mul(0.75);
  c = mix(c, mix(vec3(1, 1, 1), u.sun, 0.25).mul(1.05), cloud);
  m.colorNode = c;
  return m;
}

/** أرض الساحة خارج الصف: حجر رملي بتفاوت كبير */
export function courtyard() {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
  const n = mx_fractal_noise_float(vec3(positionWorld.xz.mul(0.7), 0), 3, 2, 0.5);
  const tiles = fract(positionWorld.xz.div(1.2));
  const grout = step(0.97, tiles.x).add(step(0.97, tiles.y)).clamp(0, 1);
  m.colorNode = mix(color(0xe7d3b0), color(0xd4b98d), n.mul(0.5).add(0.5)).mul(oneMinus(grout.mul(0.12)));
  return m;
}
