// ---------------------------------------------------------------------------
// مجسّمات البطاقات ثلاثية الأبعاد (بدل الرموز): عشرون مجسّمًا إجرائيًا بمواد PBR
// (لمعان وخشونة وانعكاس من البيئة) وحواف مستديرة، بلا ملفات خارجية.
// كل مجسّم يتسع في كرة نصف قطرها ≈ ١ حول مركزه، والوجه الأمامي نحو +z (الكاميرا).
// يُستعمل في البطاقات (ui.js)، وتُصيَّر منه صور الطبقة C (tools/prerender.py).
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { color, mix, mx_noise_float, positionLocal, uv, sin, float, smoothstep } from 'three/tsl';

// ------------------------------------------------------------------ المواد المشتركة
const M = {};
function mats() {
  if (M.skin) return M;
  const phys = (o) => new THREE.MeshPhysicalNodeMaterial(o);
  M.skin = phys({ color: 0xe8b98f, roughness: 0.48, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffc9a8), clearcoat: 0.25, clearcoatRoughness: 0.4 });
  M.hair = phys({ color: 0x2b1d14, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  M.sleeve = phys({ color: 0x2f74c0, roughness: 0.72, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x9cc8ff) });
  M.sleeve.colorNode = color(0x2f74c0).mul(float(0.92).add(mx_noise_float(positionLocal.mul(60)).mul(0.08))); // نسيج القماش
  M.cuff = phys({ color: 0xf3efe6, roughness: 0.7, sheen: 0.6 });
  M.white = phys({ color: 0xffffff, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  M.tissue = phys({ color: 0xffffff, roughness: 0.85, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
  M.tissue.colorNode = color(0xffffff).mul(float(0.94).add(mx_noise_float(positionLocal.mul(45)).mul(0.06)));
  M.chrome = phys({ color: 0xe6ebf0, metalness: 1, roughness: 0.14 });
  M.gold = phys({ color: 0xe2b25c, metalness: 1, roughness: 0.24 });
  M.maroon = phys({ color: 0x8a1538, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.teal = phys({ color: 0x2a9d96, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
  M.sky = phys({ color: 0x7fc7e6, roughness: 0.35, clearcoat: 0.9 });
  M.pink = phys({ color: 0xf59bb5, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4 });
  M.yellow = phys({ color: 0xffd23f, roughness: 0.95 });
  M.wood = phys({ roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  {
    const p = positionLocal;
    const ring = sin(p.x.mul(30).add(mx_noise_float(p.mul(3)).mul(4))).mul(0.5).add(0.5);
    M.wood.colorNode = mix(color(0xa86f3e), color(0xd9a56c), ring.mul(0.7).add(mx_noise_float(p.mul(40)).mul(0.15).add(0.15)));
  }
  M.water = phys({ color: 0x5fb8ea, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false });
  M.drop = phys({ color: 0x6fc0ee, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, metalness: 0, emissive: new THREE.Color(0x1d6fa8), emissiveIntensity: 0.25 });
  M.bubble = phys({ color: 0xdff3ff, roughness: 0.02, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 800], transparent: true, opacity: 0.38, depthWrite: false, clearcoat: 1, metalness: 0.2 });
  M.germ = phys({ color: 0x5cbf2a, roughness: 0.35, clearcoat: 0.6, emissive: new THREE.Color(0x3d8c12), emissiveIntensity: 0.35 });
  M.germDark = phys({ color: 0x2f6e12, roughness: 0.5 });
  M.bread = phys({ color: 0xe0a95e, roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0xffe0a8) });
  M.bread.colorNode = color(0xe0a95e).mul(float(0.85).add(mx_noise_float(positionLocal.mul(50)).mul(0.15)));
  M.crumb = phys({ color: 0xf6e6c4, roughness: 0.9 });
  M.lettuce = phys({ color: 0x67b83a, roughness: 0.5, clearcoat: 0.4, side: THREE.DoubleSide });
  M.tomato = phys({ color: 0xd83a2a, roughness: 0.25, clearcoat: 1 });
  M.cheese = phys({ color: 0xf6c443, roughness: 0.45 });
  M.roof = phys({ color: 0xb4513a, roughness: 0.55, clearcoat: 0.4 });
  M.wall = phys({ color: 0xf2e3c6, roughness: 0.8 });
  
  M.shoe = phys({ color: 0xe8665a, roughness: 0.45, clearcoat: 0.6 });
  M.sole = phys({ color: 0xffffff, roughness: 0.6 });
  M.shirt = phys({ color: 0x3d8fe0, roughness: 0.8, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xbfe0ff) });
  M.shirt.colorNode = color(0x3d8fe0).mul(float(0.9).add(mx_noise_float(positionLocal.mul(70)).mul(0.1)));
  M.milk = phys({ color: 0xfbf8f0, roughness: 0.25, clearcoat: 0.5 });
  M.ink = phys({ color: 0x1a1210, roughness: 0.2, clearcoat: 1 });
  M.eraser = phys({ color: 0xf08aa0, roughness: 0.7 });
  M.pencilY = phys({ color: 0xf2b51b, roughness: 0.35, clearcoat: 0.8 });
  M.graphite = phys({ color: 0x3a3a3a, metalness: 0.4, roughness: 0.4 });
  M.chair = phys({ color: 0x2f8f8a, roughness: 0.34, clearcoat: 0.9 });
  M.wind = phys({ color: 0xcfeaff, roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false });
  M.dollBody = phys({ color: 0xe3a12f, roughness: 0.34, clearcoat: 0.9 });
  M.dollBody2 = phys({ color: 0x3d8fe0, roughness: 0.34, clearcoat: 0.9 });
  M.desk = phys({ roughness: 0.5, clearcoat: 0.45 });
  M.desk.colorNode = M.wood.colorNode;
  M.plate = phys({ color: 0xffffff, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.label = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.4 });
  // شريط لاصق على القنينة الخاصة: خطوط كأنها «اسمي»
  M.label.colorNode = mix(color(0xffffff), color(0x2a9d96), smoothstep(0.46, 0.5, sin(uv().x.mul(40)).mul(0.5).add(0.5)).mul(smoothstep(0.35, 0.4, uv().y)).mul(smoothstep(0.65, 0.6, uv().y)));
  return M;
}

const mesh = (g, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};
const group = (...kids) => {
  const g = new THREE.Group();
  if (kids.length) g.add(...kids);
  return g;
};

// ------------------------------------------------------------------ أجزاء
/** كبسولة من النقطة a إلى b (ذراع، كمّ…) */
function limb(a, b, r, m) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L), 8, 20), m);
  o.position.copy(A).add(B).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return o;
}
/** كفّ مفتوحة: راحة مستديرة وأصابع بمفاصل وإبهام */
function hand({ curl = 0, mat } = {}) {
  const m = mat || mats().skin;
  const g = new THREE.Group();
  const palm = mesh(new RoundedBoxGeometry(0.62, 0.66, 0.24, 4, 0.11), m);
  g.add(palm);
  const fingerLen = [0.36, 0.42, 0.4, 0.32];
  fingerLen.forEach((L, i) => {
    const f = new THREE.Group();
    f.position.set(-0.22 + i * 0.148, 0.31, 0);
    f.rotation.z = (i - 1.5) * -0.06;
    const a = mesh(new THREE.CapsuleGeometry(0.066, L * 0.5, 6, 14), m, 0, L * 0.28, 0);
    const knuckle = new THREE.Group();
    knuckle.position.y = L * 0.55;
    knuckle.rotation.x = curl * 1.3;
    const b = mesh(new THREE.CapsuleGeometry(0.062, L * 0.4, 6, 14), m, 0, L * 0.22, 0);
    const nail = mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshPhysicalNodeMaterial({ color: 0xf7d6c8, roughness: 0.2, clearcoat: 1 }), 0, L * 0.4, 0.04);
    nail.scale.set(1, 1.2, 0.35);
    knuckle.add(b, nail);
    f.add(a, knuckle);
    f.rotation.x = curl * 0.5;
    g.add(f);
  });
  const th = new THREE.Group();
  th.position.set(0.3, -0.08, 0.04);
  th.rotation.z = -0.95;
  th.rotation.y = -0.4;
  th.add(mesh(new THREE.CapsuleGeometry(0.075, 0.26, 6, 14), m, 0, 0.18, 0));
  g.add(th);
  return g;
}

/** رأس دمية خشبية لامعة بعينين وشعر */
function head(skin = 0xe8b98f, sneeze = false) {
  const A = mats();
  const s = new THREE.MeshPhysicalNodeMaterial({ color: skin, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 0.4 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.5, 48, 32), s));
  const hair = mesh(new THREE.SphereGeometry(0.52, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), A.hair, 0, 0.04, -0.03);
  hair.rotation.x = -0.35;
  g.add(hair);
  for (const x of [-0.17, 0.17]) {
    if (sneeze) {
      // عينان مغمضتان (قوسان) لحظة العطسة
      const lid = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16, Math.PI), A.ink, x, 0.06, 0.47);
      g.add(lid);
    } else g.add(mesh(new THREE.SphereGeometry(0.065, 16, 12), A.ink, x, 0.06, 0.46));
    const ch = mesh(new THREE.CircleGeometry(0.08, 20), new THREE.MeshBasicNodeMaterial({ color: 0xf08a8a, transparent: true, opacity: 0.55 }), x * 1.6, -0.08, 0.43);
    ch.rotation.y = x * 2;
    g.add(ch);
  }
  g.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), s, 0, -0.04, 0.5));
  return g;
}

/** جرثومة: كرة خضراء بنتوءات (تُرى بوضوح على البطاقة البيضاء) */
let GERM = null;
export function germ(r = 0.1) {
  const A = mats();
  if (!GERM) {
    GERM = group();
    GERM.add(mesh(new THREE.IcosahedronGeometry(1, 2), A.germ));
    const sp = new THREE.ConeGeometry(0.16, 0.5, 8);
    sp.translate(0, 1.1, 0);
    const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
    for (let i = 0; i < ico.count; i += 3) {
      const v = new THREE.Vector3(ico.getX(i), ico.getY(i), ico.getZ(i)).normalize();
      const s = mesh(sp, A.germDark);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      GERM.add(s);
    }
  }
  const g = GERM.clone();
  g.scale.setScalar(r);
  g.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  return g;
}
function drop(r, x, y, z) {
  const d = mesh(new THREE.SphereGeometry(1, 20, 14), mats().drop, x, y, z);
  d.scale.set(r, r * 1.15, r);
  return d;
}
function tissueBall(r = 0.4) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + (Math.sin(v.x * 9) * Math.cos(v.y * 7) + Math.sin(v.z * 8 + v.x * 3)) * 0.1 + Math.sin(v.y * 23) * 0.03;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const o = mesh(geo, mats().tissue);
  o.scale.setScalar(r);
  return o;
}
function bottle(bodyMat, capMat, withLabel = false) {
  const A = mats();
  const prof = [[0, -0.85], [0.33, -0.85], [0.37, -0.78], [0.37, 0.25], [0.3, 0.45], [0.2, 0.58], [0.17, 0.66], [0, 0.66]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = group(mesh(new THREE.LatheGeometry(prof, 48), bodyMat));
  const water = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.85, 40), A.water, 0, -0.39, 0);
  g.add(water);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 32), capMat, 0, 0.75, 0));
  for (let i = 0; i < 12; i++) {
    const rib = mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), capMat, Math.cos((i / 12) * Math.PI * 2) * 0.2, 0.75, Math.sin((i / 12) * Math.PI * 2) * 0.2);
    g.add(rib);
  }
  if (withLabel) g.add(mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.42, 40, 1, true), A.label, 0, -0.2, 0));
  return g;
}
function deskSlab() {
  const A = mats();
  const g = group(mesh(new RoundedBoxGeometry(1.9, 0.14, 1.1, 3, 0.04), A.desk, 0, 0, 0));
  g.rotation.x = 0.55;
  return g;
}

// ------------------------------------------------------------------ البطاقات
const BUILD = {
  /** التغطية بالمرفق: رأس يعطس في كمّ مثني أمام الفم */
  elbow() {
    const A = mats();
    const g = group();
    const h = head(0xe8b98f, true);
    h.position.set(-0.32, 0.12, 0);
    h.rotation.y = 1.05; // الوجه نحو اليمين
    g.add(h);
    const shoulder = [0.72, -0.8, -0.05];
    const elbowP = [0.14, -0.02, 0.4]; // ثنية المرفق على الفم والأنف
    const wrist = [0.62, 0.58, 0.12];
    g.add(limb(shoulder, elbowP, 0.17, A.sleeve), limb(elbowP, wrist, 0.155, A.sleeve));
    g.add(mesh(new THREE.SphereGeometry(0.175, 24, 16), A.sleeve, ...elbowP));
    const cuff = mesh(new THREE.TorusGeometry(0.155, 0.045, 10, 28), A.cuff, 0.58, 0.53, 0.14);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.48, 0.6, -0.28).normalize());
    g.add(cuff);
    g.add(mesh(new THREE.SphereGeometry(0.15, 24, 16), A.skin, 0.66, 0.66, 0.1));
    // رذاذ محجوز عند ثنية المرفق
    [[0.05, 0.12, 0.56], [0.2, 0.16, 0.55], [-0.02, -0.06, 0.58], [0.24, -0.14, 0.56]].forEach(([x, y, z], i) => g.add(drop(0.035 + (i % 2) * 0.012, x, y, z)));
    g.rotation.y = -0.25;
    return g;
  },
    /** التغطية بمنديل: علبة مناديل ومنديل بارز */
  tissue() {
    const A = mats();
    const g = group();
    const box = mesh(new RoundedBoxGeometry(1.4, 0.6, 0.8, 4, 0.08), A.sky, 0, -0.35, 0);
    g.add(box);
    // نقوش على العلبة
    for (let i = 0; i < 5; i++) {
      const d = mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff, roughness: 0.4 }), -0.5 + i * 0.25, -0.35 + (i % 2) * 0.12, 0.405);
      g.add(d);
    }
    const slot = mesh(new RoundedBoxGeometry(0.7, 0.06, 0.25, 2, 0.03), A.ink, 0, -0.03, 0);
    g.add(slot);
    // المنديل البارز: سطح ملتف
    const geo = new THREE.PlaneGeometry(0.75, 0.85, 14, 16);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i) + 0.42;
      p.setXYZ(i, x * (1 - y * 0.35) + Math.sin(y * 6) * 0.04, y, Math.sin(x * 5 + y * 3) * 0.12 * y + Math.cos(y * 4) * 0.05);
    }
    geo.computeVertexNormals();
    const t = mesh(geo, A.tissue, 0, 0.0, 0);
    t.rotation.z = 0.12;
    g.add(t);
    g.rotation.x = 0.28;
    return g;
  },
  /** الرمي في السلة: سلة بدواسة ومنديل مكوّر يسقط فيها */
  bin() {
    const A = mats();
    const g = group();
    const body = mesh(new THREE.CylinderGeometry(0.52, 0.42, 1.2, 48, 1, true), new THREE.MeshPhysicalNodeMaterial({ color: 0x8a1538, roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide }), 0, -0.3, 0);
    g.add(body);
    g.add(mesh(new THREE.CircleGeometry(0.42, 40), A.maroon, 0, -0.9, 0).rotateX(-Math.PI / 2));
    const rim = mesh(new THREE.TorusGeometry(0.52, 0.035, 12, 48), A.chrome, 0, 0.3, 0);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const lid = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 48), A.chrome);
    lid.position.set(0, 0.58, -0.38);
    lid.rotation.x = -1.05;
    g.add(lid);
    g.add(mesh(new RoundedBoxGeometry(0.32, 0.07, 0.22, 2, 0.02), A.chrome, 0, -0.86, 0.5));
    const ball = tissueBall(0.26);
    ball.position.set(0.05, 0.62, 0.15);
    g.add(ball);
    g.rotation.x = 0.3;
    return g;
  },
  /** غسل اليدين بالصابون: قالب صابون وفقاعات متقزّحة وقطرة ماء */
  wash() {
    const A = mats();
    const g = group();
    const soap = mesh(new RoundedBoxGeometry(1.1, 0.42, 0.7, 5, 0.18), A.pink, 0, -0.35, 0);
    g.add(soap);
    // نقش على الصابون
    const emb = mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 32), A.pink, 0, -0.13, 0);
    emb.rotation.x = Math.PI / 2;
    g.add(emb);
    // رغوة
    for (let i = 0; i < 14; i++) {
      const s = mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.08, 16, 12), A.white, -0.4 + Math.random() * 0.8, -0.1 + Math.random() * 0.05, -0.2 + Math.random() * 0.4);
      s.scale.y = 0.6;
      g.add(s);
    }
    [[0.45, 0.45, 0.2, 0.22], [-0.35, 0.55, 0.1, 0.18], [0.05, 0.85, -0.1, 0.13], [0.55, 0.9, -0.05, 0.09], [-0.2, 0.25, 0.3, 0.1]].forEach(([x, y, z, r]) => {
      g.add(mesh(new THREE.SphereGeometry(r, 28, 20), A.bubble, x, y, z));
    });
    g.rotation.x = 0.35;
    return g;
  },
  /** مسح الطاولة: إسفنجة بوجهين ورغوة */
  wipe() {
    const A = mats();
    const g = group();
    const sp = new RoundedBoxGeometry(1.2, 0.45, 0.75, 4, 0.1);
    const pp = sp.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const n = Math.sin(pp.getX(i) * 31) * Math.cos(pp.getZ(i) * 27) * 0.012;
      pp.setY(i, pp.getY(i) + n);
    }
    sp.computeVertexNormals();
    const sponge = mesh(sp, A.yellow, 0, -0.1, 0);
    // مسام الإسفنج: تفاوت لوني بالضجيج
    sponge.material = A.yellow.clone();
    sponge.material.colorNode = color(0xffd23f).mul(float(0.75).add(mx_noise_float(positionLocal.mul(28)).mul(0.25).add(0.12)));
    const scrub = mesh(new RoundedBoxGeometry(1.2, 0.18, 0.75, 3, 0.05), new THREE.MeshPhysicalNodeMaterial({ color: 0x2f9a55, roughness: 0.9 }), 0, 0.22, 0);
    g.add(sponge, scrub);
    for (let i = 0; i < 9; i++) g.add(mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 14, 10), A.bubble, -0.5 + Math.random(), -0.4, 0.3 + Math.random() * 0.15));
    g.rotation.set(0.45, -0.35, 0);
    return g;
  },
  /** الشرب من قنينة خاصة: قنينة زرقاء عليها شريط الاسم */
  ownBottle() {
    const A = mats();
    const g = bottle(new THREE.MeshPhysicalNodeMaterial({ color: 0x8fd2f5, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false, emissive: new THREE.Color(0x2a7fb8), emissiveIntensity: 0.15 }), A.teal, true);
    g.rotation.z = -0.18;
    return g;
  },
  /** الراحة في البيت: بيت بسقف وباب ونافذة مضيئة ومخدّة */
  rest() {
    const A = mats();
    const g = group();
    g.add(mesh(new RoundedBoxGeometry(1.2, 0.85, 0.9, 3, 0.05), A.wall, 0, -0.35, 0));
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.75, 0);
    roofShape.lineTo(0, 0.6);
    roofShape.lineTo(0.75, 0);
    roofShape.lineTo(-0.75, 0);
    const roof = mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 1.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }), A.roof, 0, 0.08, -0.52);
    g.add(roof);
    g.add(mesh(new RoundedBoxGeometry(0.3, 0.5, 0.06, 2, 0.03), A.wood, -0.25, -0.53, 0.46));
    g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), A.gold, -0.15, -0.53, 0.5));
    const win = mesh(new RoundedBoxGeometry(0.32, 0.28, 0.04, 2, 0.02), new THREE.MeshPhysicalNodeMaterial({ color: 0xffe19a, emissive: new THREE.Color(0xffc24a), emissiveIntensity: 0.9, roughness: 0.2 }), 0.27, -0.25, 0.46);
    g.add(win);
    const fr = mesh(new THREE.BoxGeometry(0.36, 0.03, 0.05), A.wood, 0.27, -0.25, 0.48);
    const fr2 = mesh(new THREE.BoxGeometry(0.03, 0.32, 0.05), A.wood, 0.27, -0.25, 0.48);
    g.add(fr, fr2);
    g.add(mesh(new RoundedBoxGeometry(0.16, 0.35, 0.16, 2, 0.03), A.roof, 0.42, 0.35, -0.1));
    // قلب صغير: «صحّتك أولًا»
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.1);
    hs.bezierCurveTo(-0.22, 0.05, -0.12, 0.22, 0, 0.1);
    hs.bezierCurveTo(0.12, 0.22, 0.22, 0.05, 0, -0.1);
    const heart = mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }), new THREE.MeshPhysicalNodeMaterial({ color: 0xe8455a, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color(0x9a1028), emissiveIntensity: 0.3 }), 0.0, 0.85, 0.1);
    heart.scale.setScalar(1.2);
    g.add(heart);
    g.rotation.set(0.18, -0.45, 0);
    return g;
  },
  /** الابتعاد قليلًا: حذاءان يخطوان مبتعدين وأثر خطوات */
  distance() {
    const A = mats();
    const g = group();
    const shoe = () => {
      const sh = group();
      sh.add(mesh(new RoundedBoxGeometry(0.44, 0.13, 1.02, 3, 0.06), A.sole, 0, -0.06, 0));
      const heel = mesh(new RoundedBoxGeometry(0.42, 0.36, 0.55, 4, 0.14), A.shoe, 0, 0.17, -0.2);
      const toe = mesh(new THREE.SphereGeometry(0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), A.shoe, 0, 0.0, 0.16);
      toe.scale.set(0.42, 0.42, 0.75);
      const cap = mesh(new THREE.SphereGeometry(0.5, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), A.sole, 0, 0.0, 0.3);
      cap.scale.set(0.43, 0.2, 0.45);
      const collar = mesh(new THREE.TorusGeometry(0.16, 0.045, 10, 28), A.white, 0, 0.36, -0.28);
      collar.rotation.x = Math.PI / 2;
      sh.add(heel, toe, cap, collar);
      for (let i = 0; i < 3; i++) sh.add(mesh(new RoundedBoxGeometry(0.26, 0.03, 0.05, 2, 0.012), A.white, 0, 0.3 - i * 0.05, -0.04 + i * 0.11).rotateX(-0.5));
      const swoosh = mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24, Math.PI * 0.9), A.white, 0.215, 0.13, -0.05);
      swoosh.rotation.set(0, Math.PI / 2, 2.6);
      sh.add(swoosh);
      return sh;
    };
    const s1 = shoe();
    s1.position.set(-0.35, -0.3, 0.1);
    s1.rotation.set(0.25, 1.15, 0);
    const s2 = shoe();
    s2.position.set(0.3, 0.05, -0.2);
    s2.rotation.set(0.25, 1.15, 0);
    g.add(s1, s2);
    // سهم ذهبي للابتعاد
    const arrow = group();
    const shaft = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 12), A.gold, 0, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    const tip = mesh(new THREE.ConeGeometry(0.1, 0.22, 16), A.gold, 0.45, 0, 0);
    tip.rotation.z = -Math.PI / 2;
    arrow.add(shaft, tip);
    arrow.position.set(0.1, 0.72, 0);
    arrow.rotation.z = 0.25;
    g.add(arrow);
    g.rotation.x = 0.4;
    return g;
  },
  /** التغطية باليد: كفّ مفتوحة عليها قطرات وجراثيم */
  hand() {
    const g = group();
    const h = hand();
    h.rotation.set(0.1, 0.2, -0.15);
    g.add(h);
    [[-0.12, -0.05], [0.1, 0.1], [0.05, -0.2], [-0.2, 0.18]].forEach(([x, y], i) => {
      const d = drop(0.05, x, y, 0.16);
      g.add(d);
      if (i % 2 === 0) {
        const gm = germ(0.06);
        gm.position.set(x + 0.08, y + 0.05, 0.18);
        g.add(gm);
      }
    });
    g.scale.setScalar(1.25);
    return g;
  },
  /** بلا تغطية: رأس يعطس ورذاذ كثير يندفع */
  noCover() {
    const g = group();
    const h = head(0xd6a77c, true);
    h.position.set(-0.45, 0, 0);
    h.rotation.y = 0.9;
    h.scale.setScalar(0.95);
    g.add(h);
    for (let i = 0; i < 46; i++) {
      const t = Math.random();
      const a = (Math.random() - 0.5) * 1.1 * (0.3 + t);
      const x = -0.05 + t * 1.05;
      const y = -0.06 + Math.sin(a) * (0.15 + t * 0.6);
      const z = 0.2 + Math.cos(a * 2) * 0.1 + (Math.random() - 0.5) * 0.3 * t;
      g.add(drop(0.04 + Math.random() * 0.05 * (1 - t * 0.5), x, y, z));
      if (i % 7 === 0) {
        const gm = germ(0.05);
        gm.position.set(x, y, z + 0.05);
        g.add(gm);
      }
    }
    return g;
  },
  /** مسح الأنف باليد: يد عليها جراثيم كثيرة */
  handWipe() {
    const g = group();
    const h = hand({ curl: 0.35 });
    h.rotation.set(0.25, -0.3, 0.35);
    g.add(h);
    for (let i = 0; i < 9; i++) {
      const gm = germ(0.06 + Math.random() * 0.03);
      gm.position.set(-0.3 + Math.random() * 0.6, -0.3 + Math.random() * 0.75, 0.2);
      g.add(gm);
    }
    g.scale.setScalar(1.25);
    return g;
  },
  /** تركه على الطاولة: منديل مستعمل على سطح خشبي وعليه جراثيم */
  leave() {
    const g = group();
    const d = deskSlab();
    d.position.y = -0.45;
    g.add(d);
    const b = tissueBall(0.36);
    b.position.set(0, -0.08, 0.1);
    g.add(b);
    for (let i = 0; i < 6; i++) {
      const gm = germ(0.06);
      gm.position.set(-0.6 + Math.random() * 1.2, -0.25 + Math.random() * 0.15, 0.25 + Math.random() * 0.25);
      g.add(gm);
    }
    return g;
  },
  /** إعطاؤه للزميل: يد تقدّم منديلًا مستعملًا */
  give() {
    const g = group();
    const h = hand({ curl: 0.2 });
    h.rotation.set(-1.25, 0, 0.2);
    h.position.set(0, -0.35, 0);
    g.add(h);
    const b = tissueBall(0.3);
    b.position.set(0, 0.0, 0.1);
    g.add(b);
    const gm = germ(0.07);
    gm.position.set(0.25, 0.2, 0.25);
    g.add(gm);
    g.scale.setScalar(1.2);
    return g;
  },
  /** المصافحة فورًا: يدان متشابكتان (والجراثيم تنتقل) */
  shake() {
    const A = mats();
    const g = group();
    const L = hand({ curl: 0.75 });
    L.rotation.set(0, 0, -Math.PI / 2 + 0.1);
    L.position.set(-0.2, 0, 0);
    const R = hand({ curl: 0.75, mat: new THREE.MeshPhysicalNodeMaterial({ color: 0xc99872, roughness: 0.48, sheen: 0.5, clearcoat: 0.25 }) });
    R.rotation.set(Math.PI, 0, -Math.PI / 2 - 0.1);
    R.position.set(0.2, 0.0, 0.05);
    const s1 = mesh(new THREE.CapsuleGeometry(0.22, 0.5, 8, 18), A.sleeve, -0.85, -0.05, 0);
    s1.rotation.z = Math.PI / 2;
    const s2 = mesh(new THREE.CapsuleGeometry(0.22, 0.5, 8, 18), new THREE.MeshPhysicalNodeMaterial({ color: 0xe3a12f, roughness: 0.7, sheen: 1 }), 0.85, -0.05, 0);
    s2.rotation.z = Math.PI / 2;
    g.add(L, R, s1, s2);
    [[0, 0.32, 0.2], [0.15, -0.3, 0.25], [-0.2, 0.25, 0.22]].forEach(([x, y, z]) => {
      const gm = germ(0.07);
      gm.position.set(x, y, z);
      g.add(gm);
    });
    g.scale.setScalar(0.92);
    g.rotation.x = 0.25;
    return g;
  },
  /** مسح اليد بالملابس: قميص قماشي بياقة */
  clothes() {
    const A = mats();
    const s = new THREE.Shape();
    s.moveTo(-0.35, -0.8);
    s.lineTo(0.35, -0.8);
    s.lineTo(0.35, 0.25);
    s.lineTo(0.62, 0.05);
    s.lineTo(0.85, 0.35);
    s.lineTo(0.38, 0.72);
    s.quadraticCurveTo(0, 0.55, -0.38, 0.72);
    s.lineTo(-0.85, 0.35);
    s.lineTo(-0.62, 0.05);
    s.lineTo(-0.35, 0.25);
    s.lineTo(-0.35, -0.8);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4, curveSegments: 12 });
    geo.translate(0, 0, -0.06);
    const shirt = mesh(geo, A.shirt);
    const collar = mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 28, Math.PI), A.cuff, 0, 0.66, 0.12);
    collar.rotation.z = Math.PI;
    const g = group(shirt, collar);
    // بقع يد عليها جراثيم
    for (let i = 0; i < 4; i++) {
      const gm = germ(0.06);
      gm.position.set(-0.2 + i * 0.13, -0.35 + (i % 2) * 0.12, 0.22);
      g.add(gm);
    }
    g.rotation.set(0.15, -0.25, 0.05);
    return g;
  },
  /** وضع الطعام عليها: شطيرة على طاولة عليها جراثيم */
  food() {
    const A = mats();
    const g = group();
    const d = deskSlab();
    d.position.y = -0.55;
    g.add(d);
    const sw = group();
    const tri = new THREE.Shape();
    tri.moveTo(-0.55, -0.35);
    tri.lineTo(0.55, -0.35);
    tri.lineTo(-0.55, 0.45);
    tri.lineTo(-0.55, -0.35);
    const slab = (dpt, m, y) => {
      const geo = new THREE.ExtrudeGeometry(tri, { depth: dpt, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3 });
      const o = mesh(geo, m, 0, y, 0);
      o.rotation.x = -Math.PI / 2;
      return o;
    };
    sw.add(slab(0.1, A.bread, -0.15), slab(0.03, A.cheese, -0.01), slab(0.03, A.lettuce, 0.04), slab(0.1, A.bread, 0.1));
    sw.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 24), A.tomato, -0.2, 0.08, -0.05));
    sw.position.set(0, -0.08, 0.2);
    sw.rotation.set(0.5, 0.3, 0);
    g.add(sw);
    for (let i = 0; i < 5; i++) {
      const gm = germ(0.065);
      gm.position.set(-0.7 + i * 0.35, -0.35 + (i % 2) * 0.05, 0.45);
      g.add(gm);
    }
    return g;
  },
  /** الشرب من قنينة الزميل: قنينة وردية عليها جراثيم */
  shareBottle() {
    const A = mats();
    const g = group();
    const b = bottle(new THREE.MeshPhysicalNodeMaterial({ color: 0xf59bb5, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.62, depthWrite: false, emissive: new THREE.Color(0xa3294f), emissiveIntensity: 0.15 }), A.maroon);
    b.rotation.z = 0.2;
    g.add(b);
    for (let i = 0; i < 5; i++) {
      const gm = germ(0.06);
      const a = (i / 5) * Math.PI * 2;
      gm.position.set(-0.13 + Math.cos(a) * 0.25, 0.75 + Math.sin(a) * 0.1, 0.22);
      g.add(gm);
    }
    return g;
  },
  /** الجلوس قرب الزملاء: كرسيان ملتصقان */
  sitClose() {
    const A = mats();
    const chair = (m) => {
      const c = group();
      c.add(mesh(new RoundedBoxGeometry(0.62, 0.09, 0.58, 3, 0.03), m, 0, 0, 0));
      const back = mesh(new RoundedBoxGeometry(0.62, 0.5, 0.07, 3, 0.03), m, 0, 0.34, -0.27);
      back.rotation.x = -0.1;
      c.add(back);
      for (const [x, z] of [[-0.25, -0.23], [0.25, -0.23], [-0.25, 0.23], [0.25, 0.23]]) c.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 10), A.chrome, x, -0.32, z));
      return c;
    };
    const a = chair(A.chair);
    a.position.set(-0.34, -0.1, 0);
    a.rotation.y = 0.35;
    const b = chair(new THREE.MeshPhysicalNodeMaterial({ color: 0xe3a12f, roughness: 0.34, clearcoat: 0.9 }));
    b.position.set(0.34, -0.1, 0);
    b.rotation.y = -0.35;
    const g = group(a, b);
    g.rotation.x = 0.35;
    g.scale.setScalar(1.25);
    return g;
  },
  /** إعارة الأقلام: قلمان متقاطعان */
  pens() {
    const A = mats();
    const pencil = (m) => {
      const p = group();
      p.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 6), m));
      const wood = mesh(new THREE.ConeGeometry(0.11, 0.28, 6), new THREE.MeshPhysicalNodeMaterial({ color: 0xe9c79a, roughness: 0.7 }), 0, 0.79, 0);
      const lead = mesh(new THREE.ConeGeometry(0.035, 0.09, 12), A.graphite, 0, 0.9, 0);
      const ferrule = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.14, 16), A.chrome, 0, -0.72, 0);
      const er = mesh(new THREE.CapsuleGeometry(0.105, 0.08, 6, 14), A.eraser, 0, -0.84, 0);
      p.add(wood, lead, ferrule, er);
      return p;
    };
    const a = pencil(A.pencilY);
    a.rotation.z = 0.75;
    const b = pencil(A.teal);
    b.rotation.z = -0.75;
    b.position.z = 0.15;
    const g = group(a, b);
    const gm = germ(0.08);
    gm.position.set(0, 0.05, 0.3);
    g.add(gm);
    return g;
  },
  /** الاقتراب أكثر: دميتان متلاصقتان */
  closer() {
    const A = mats();
    const doll = (m, skin, x, ry) => {
      const d = group();
      const body = mesh(new THREE.CapsuleGeometry(0.28, 0.35, 8, 20), m, 0, -0.45, 0);
      const h = head(skin);
      h.scale.setScalar(0.6);
      h.position.y = 0.15;
      d.add(body, h);
      d.position.x = x;
      d.rotation.y = ry;
      return d;
    };
    const g = group(doll(A.dollBody, 0xe8b98f, -0.3, 0.5), doll(A.dollBody2, 0xc99872, 0.3, -0.5));
    for (let i = 0; i < 6; i++) g.add(drop(0.03, -0.05 + Math.random() * 0.1, 0.1 + Math.random() * 0.15, 0.35));
    return g;
  },
};

/** يبني مجسّم بطاقة (Group) بمقياس الوحدة، والظل والبيئة من المشهد. */
export function buildCardModel(id) {
  mats();
  const make = BUILD[id];
  const g = make ? make() : group(mesh(new THREE.SphereGeometry(0.6, 32, 20), mats().white));
  // ضبط الحجم: كرة الإحاطة نصف قطرها ١ ومركزها الأصل
  const box = new THREE.Box3().setFromObject(g);
  const s = box.getBoundingSphere(new THREE.Sphere());
  const wrap = new THREE.Group();
  g.position.sub(s.center);
  wrap.add(g);
  wrap.scale.setScalar(1 / Math.max(0.01, s.radius));
  wrap.userData.id = id;
  return wrap;
}

export const CARD_MODEL_IDS = Object.keys(BUILD);
