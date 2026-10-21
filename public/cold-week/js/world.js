// ---------------------------------------------------------------------------
// عالم «أسبوع الزكام»: مدرسة صغيرة مقطوعة من الأمام كبيت الدمى، فوق ساحة حجرية
// تحت سماء الضحى. صف واحد (طالب واحد) أو صفّان متجاوران بينهما جدار (سباق طالبين).
//
// في كل صف: نافذتان بمشربية خشبية يدخل منهما الضوء فيرسم نقش النجوم على الأرض،
// وست طاولات خشبية على كل منها دمية، وساعة حائط، ولوحة رسوم، وباب، وحوض غسل، وسلة.
// على أعلى الجدار الخلفي شُرفات بطراز البيوت القطرية القديمة، ونخلتان في الساحة.
// كل الأشكال بالكود (بلا ملفات GLB)، بحواف مستديرة ومواد PBR (materials.js).
// الوحدات بالمتر؛ الأرضية y = 0، والصف مفتوح نحو +z (الكاميرا).
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  plaster, terrazzo, wood, enamel, gold, chrome, glass, mashrabiya, windowSky, lightPatch, beam, skyDome, courtyard,
} from './materials.js';
import { mashrabiyaTile, clockFace, drawing, blobShadow } from './textures.js';
import { makeDoll, dollShared } from './dolls.js';
import { DOLLS } from './content.js';

export const DIM = { D: 4.2, H: 2.95, T: 0.24, DIV: 0.32 };
const WIN = { w: 1.15, h: 1.35, y0: 1.05 };
const DOOR = { z0: -1.35, z1: -0.35, h: 2.05 };
const DESK = { w: 1.0, d: 0.6, h: 0.72 };

/** تخطيط الصفوف حسب عدد الفرق: الفريق الأول يمين الشاشة (x موجب) */
export function roomLayout(teamIds) {
  if (teamIds.length === 1) return [{ id: teamIds[0], cx: 0, w: 9.2, side: 1 }];
  const w = 6.2;
  const off = w / 2 + DIM.DIV / 2;
  return [
    { id: 'a', cx: off, w, side: 1 },
    { id: 'b', cx: -off, w, side: -1 },
  ];
}

function mesh(geo, mat, { cast = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** جدار مستطيل بفتحات (نوافذ/باب) في المستوى المحلي x-y، يُبثق بالسُّمك */
function wallWithHoles(width, height, thick, holes) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(width / 2, height);
  s.lineTo(-width / 2, height);
  s.lineTo(-width / 2, 0);
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x - h.w / 2, h.y);
    p.lineTo(h.x - h.w / 2, h.y + h.h);
    p.lineTo(h.x + h.w / 2, h.y + h.h);
    p.lineTo(h.x + h.w / 2, h.y);
    p.lineTo(h.x - h.w / 2, h.y);
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 1 });
  g.computeVertexNormals();
  return g;
}

/** شعاع ضوء من فتحة النافذة إلى بقعته على الأرض (أربعة أوجه، uv.y = 1 عند النافذة) */
function beamGeometry(xh, wy0, wy1, wz, fz0, fz1) {
  const A = [[-xh, wy1, wz], [xh, wy1, wz], [xh, wy0, wz], [-xh, wy0, wz]]; // النافذة: أعلى يسار، أعلى يمين، أسفل يمين، أسفل يسار
  const fx = xh * 1.08;
  const B = [[-fx, 0.01, fz1], [fx, 0.01, fz1], [fx, 0.01, fz0], [-fx, 0.01, fz0]]; // الأرض: البعيد ثم القريب من النافذة
  const pos = [];
  const uvs = [];
  const quad = (a, b, c, d) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uvs.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
  };
  quad(A[0], A[1], B[1], B[0]); // الأعلى
  quad(A[3], A[2], B[2], B[3]); // الأسفل
  quad(A[0], A[3], B[3], B[0]); // يسار
  quad(A[1], A[2], B[2], B[1]); // يمين
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** سعفة نخلة: شريط منحني يتدلّى */
function frondGeometry() {
  const g = new THREE.PlaneGeometry(0.42, 1.9, 2, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.95; // 0..1.9
    const t = y / 1.9;
    const x = p.getX(i) * (1 - t * 0.85) * (0.6 + Math.sin(t * Math.PI) * 0.6);
    p.setXYZ(i, x, y, -t * t * 0.9 + Math.abs(p.getX(i)) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * يبني المدرسة كلها.
 * @param {'A'|'B'} tier
 * @param {{id,cx,w,side}[]} layout
 */
export function buildWorld(tier, layout) {
  const world = new THREE.Group();
  const shadows = tier === 'A';
  const { D, H, T, DIV } = DIM;
  const xMin = Math.min(...layout.map((r) => r.cx - r.w / 2));
  const xMax = Math.max(...layout.map((r) => r.cx + r.w / 2));
  const Wt = xMax - xMin;

  // ---------------- السماء والساحة
  const sky = {
    top: uniform(new THREE.Color(0x1763b6)),
    mid: uniform(new THREE.Color(0x56a8e2)),
    horizon: uniform(new THREE.Color(0xd2efff)),
    sun: uniform(new THREE.Color(0xfffbe8)),
    sunDir: uniform(new THREE.Vector3(-0.35, 0.55, -0.75)),
    octaves: tier === 'A' ? 4 : 3,
  };
  const dome = mesh(new THREE.SphereGeometry(70, 48, 24), skyDome(sky));
  dome.renderOrder = -10;
  world.add(dome);
  const ground = mesh(new THREE.CircleGeometry(60, 64), courtyard(), { receive: shadows });
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  world.add(ground);

  // ---------------- مواد مشتركة
  const M = {
    wall: plaster(0xf0e2c6),
    outer: plaster(0xe8d2ab),
    floor: terrazzo(),
    dado: enamel(0x2f8f8a, { roughness: 0.4 }),
    gold: gold(),
    chrome: chrome(),
    deskTop: wood(0xcf9a62),
    deskFrame: enamel(0xf3efe7),
    darkWood: wood(0x8a5a33, { roughness: 0.55 }),
    cork: new THREE.MeshStandardNodeMaterial({ color: 0xc89b67, roughness: 1 }),
    glass: glass('B'), // زجاج النوافذ رخيص دائمًا: خلف المشربية لا يُرى الفرق، ويوفّر تمريرة transmission
    tile: mashrabiyaTile(),
    leaf: new THREE.MeshPhysicalNodeMaterial({ color: 0x4f8f3a, roughness: 0.55, side: THREE.DoubleSide, sheen: 0.4 }),
    trunk: wood(0x9b7652, { roughness: 0.9, clearcoat: 0 }),
    blob: new THREE.MeshBasicNodeMaterial({ map: blobShadow(), transparent: true, depthWrite: false }),
  };
  M.lattice = mashrabiya(M.tile);

  // ---------------- الأرضية والجدران
  const floor = mesh(new RoundedBoxGeometry(Wt + 2 * T + 0.3, 0.2, D + T + 0.35, 2, 0.04), M.floor, { receive: true });
  floor.position.set((xMin + xMax) / 2, -0.1, -T / 2 + 0.17);
  world.add(floor);
  const lip = mesh(new THREE.BoxGeometry(Wt + 2 * T + 0.32, 0.035, 0.035), M.gold);
  lip.position.set((xMin + xMax) / 2, 0.0, D / 2 + 0.36);
  world.add(lip);

  // الجدار الخلفي بنوافذ كل الصفوف
  const holes = [];
  for (const r of layout) for (const s of [-1, 1]) holes.push({ x: r.cx + s * r.w * 0.24, y: WIN.y0, w: WIN.w, h: WIN.h });
  const backW = Wt + 2 * T;
  const back = mesh(wallWithHoles(backW, H, T, holes.map((h) => ({ ...h, x: h.x - (xMin + xMax) / 2 }))), M.wall, { receive: shadows });
  back.position.set((xMin + xMax) / 2, 0, -D / 2 - T);
  world.add(back);
  // واجهة خارجية للجدار الخلفي ترى من النوافذ؟ لا: خلف النوافذ إطار سماء.
  // الشرفات (طراز البيوت القطرية) فوق الجدار الخلفي والجانبيين
  const merlonGeo = new RoundedBoxGeometry(0.2, 0.26, T * 0.9, 2, 0.03);
  const nM = Math.floor(backW / 0.42);
  const merlons = new THREE.InstancedMesh(merlonGeo, M.outer, nM + 24);
  let k = 0;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < nM; i++) {
    mtx.makeTranslation(xMin - T + 0.21 + i * 0.42, H + 0.13, -D / 2 - T / 2);
    merlons.setMatrixAt(k++, mtx);
  }
  const capGeo = new RoundedBoxGeometry(backW + 0.06, 0.09, T + 0.08, 2, 0.03);
  const cap = mesh(capGeo, M.gold);
  cap.position.set((xMin + xMax) / 2, H + 0.0, -D / 2 - T / 2);
  world.add(cap);

  // الجداران الجانبيان: في الجدار الخارجي لكل صف باب (الأيمن دائمًا، والأيسر في السباق)
  const sideWall = (xInner, withDoor, outward) => {
    const depth = D + T; // من z = −D/2 − T إلى z = D/2
    const zc = -T / 2;
    const zd = (DOOR.z0 + DOOR.z1) / 2;
    // بعد الدوران حول y بـ 90°: المحور المحلي x يصبح −z، والمحلي z (السُّمك) يصبح +x
    const holesZ = withDoor ? [{ x: zc - zd, y: 0, w: DOOR.z1 - DOOR.z0, h: DOOR.h }] : [];
    const w = mesh(wallWithHoles(depth, H, T, holesZ), M.wall, { receive: shadows });
    w.rotation.y = Math.PI / 2;
    w.position.set(outward > 0 ? xInner : xInner - T, 0, zc);
    world.add(w);
    const xm = xInner + outward * T / 2;
    const c2 = mesh(new RoundedBoxGeometry(T + 0.06, 0.09, depth + 0.06, 2, 0.03), M.gold);
    c2.position.set(xm, H, zc);
    world.add(c2);
    for (let i = 0; i < Math.floor(depth / 0.42); i++) {
      mtx.makeTranslation(xm, H + 0.13, -D / 2 - T + 0.21 + i * 0.42);
      if (k < merlons.count) merlons.setMatrixAt(k++, mtx);
    }
  };
  sideWall(xMin, layout.length === 2, -1);
  sideWall(xMax, true, 1);
  merlons.count = k;
  world.add(merlons);

  // الجدار الفاصل بين الصفين (سباق طالبين)
  if (layout.length === 2) {
    const div = mesh(new RoundedBoxGeometry(DIV, H, D + T, 2, 0.04), M.wall, { receive: shadows });
    div.position.set(0, H / 2, -T / 2);
    world.add(div);
    const dc = mesh(new RoundedBoxGeometry(DIV + 0.08, 0.1, D + T + 0.06, 2, 0.03), M.gold);
    dc.position.set(0, H, -T / 2);
    world.add(dc);
    for (const s of [-1, 1]) {
      const dd = mesh(new THREE.BoxGeometry(0.02, 0.95, D), M.dado);
      dd.position.set(s * (DIV / 2 + 0.01), 0.475, 0);
      world.add(dd);
    }
  }

  // ---------------- النخيل في الساحة
  const palm = (x, z, s) => {
    const g = new THREE.Group();
    let y = 0;
    for (let i = 0; i < 9; i++) {
      const seg = mesh(new THREE.CylinderGeometry(0.11 - i * 0.006, 0.13 - i * 0.006, 0.42, 14), M.trunk, { cast: shadows });
      seg.position.set(Math.sin(i * 0.25) * 0.08 * i * 0.3, y + 0.21, 0);
      seg.rotation.z = 0.04 * i * 0.3;
      g.add(seg);
      y += 0.4;
    }
    const fg = frondGeometry();
    for (let i = 0; i < 10; i++) {
      const f = mesh(fg, M.leaf, { cast: shadows });
      f.position.set(0.25, y, 0);
      f.rotation.set(-0.9 - (i % 2) * 0.3, (i / 10) * Math.PI * 2, 0, 'YXZ');
      g.add(f);
    }
    g.position.set(x, -0.2, z);
    g.scale.setScalar(s);
    world.add(g);
  };
  palm(xMax + T + 1.9, -1.6, 1.15);
  palm(xMin - T - 1.9, -2.2, 1.0);
  palm(xMax + T + 3.6, -4.5, 1.25);
  palm(xMin - T - 3.4, -4.0, 1.2);

  // ---------------- الصفوف
  const shared = dollShared();
  const rooms = {};
  for (const r of layout) rooms[r.id] = buildRoom(world, r, { M, shared, tier, shadows });
  return { world, rooms, sky, bounds: { x0: xMin - T, x1: xMax + T, z0: -D / 2 - T, z1: D / 2 + 0.36, y1: H + 0.3 }, M };
}

/** صف واحد: نوافذ، ضوء، طاولات، دمى، ساعة، لوحة، باب، حوض، سلة */
function buildRoom(world, r, { M, shared, tier, shadows }) {
  const { D, H, T } = DIM;
  const g = new THREE.Group();
  world.add(g);
  const out = r.side; // جهة الجدار الخارجي
  const xOut = r.cx + out * r.w / 2;
  const R = { id: r.id, cx: r.cx, w: r.w, side: out, group: g, dolls: [], desks: [], deskTops: [] };

  // ألوان السماء خلف نوافذ هذا الصف (تتغيّر مع وقت اليوم)
  R.win = { top: uniform(new THREE.Color(0x4f9be0)), horizon: uniform(new THREE.Color(0xfff0d2)), sun: uniform(new THREE.Color(0xfff1c8)) };
  R.uPatch = uniform(0.55);
  R.uBeam = uniform(0.16);
  const skyMat = windowSky(R.win.top, R.win.horizon, R.win.sun);
  const patchTex = M.tile;

  for (const s of [-1, 1]) {
    const wx = r.cx + s * r.w * 0.24;
    // المشربية داخل الفتحة
    const lat = mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), M.lattice);
    lat.position.set(wx, WIN.y0 + WIN.h / 2, -D / 2 - T * 0.45);
    g.add(lat);
    // زجاج خلفها، وسماء أبعد
    const gl = mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), M.glass);
    gl.position.set(wx, WIN.y0 + WIN.h / 2, -D / 2 - T * 0.8);
    g.add(gl);
    const sk = mesh(new THREE.PlaneGeometry(WIN.w + 0.8, WIN.h + 0.8), skyMat);
    sk.position.set(wx, WIN.y0 + WIN.h / 2, -D / 2 - T - 0.35);
    g.add(sk);
    // إطار ذهبي حول النافذة + عتبة خشبية
    const fr = (w, h, x, y) => {
      const b = mesh(new RoundedBoxGeometry(w, h, 0.06, 2, 0.015), M.gold);
      b.position.set(x, y, -D / 2 + 0.02);
      g.add(b);
    };
    fr(WIN.w + 0.12, 0.06, wx, WIN.y0 + WIN.h + 0.03);
    fr(0.06, WIN.h + 0.12, wx - WIN.w / 2 - 0.03, WIN.y0 + WIN.h / 2);
    fr(0.06, WIN.h + 0.12, wx + WIN.w / 2 + 0.03, WIN.y0 + WIN.h / 2);
    const sill = mesh(new RoundedBoxGeometry(WIN.w + 0.3, 0.06, 0.2, 2, 0.02), M.darkWood, { receive: shadows });
    sill.position.set(wx, WIN.y0 - 0.03, -D / 2 + 0.06);
    g.add(sill);
    // بقعة نقش المشربية على الأرض، وشعاع الضوء
    const patch = mesh(new THREE.PlaneGeometry(WIN.w * 1.15, 1.7), lightPatch(patchTex, R.uPatch));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(wx + 0.12, 0.012, -D / 2 + 1.25);
    patch.renderOrder = 5;
    g.add(patch);
    const bm = mesh(beamGeometry(WIN.w / 2, WIN.y0, WIN.y0 + WIN.h, -D / 2, -D / 2 + 0.4, -D / 2 + 2.1), beam(0xffe2a8, R.uBeam));
    bm.position.x = wx + 0.06;
    bm.renderOrder = 6;
    g.add(bm);
  }

  // الإزار الملوّن أسفل الجدران (مينا فيروزية) + خط ذهبي
  const dado = (w, x, z, ry = 0) => {
    const b = mesh(new THREE.BoxGeometry(w, 0.95, 0.02), M.dado, { receive: shadows });
    b.position.set(x, 0.475, z);
    b.rotation.y = ry;
    g.add(b);
    const t = mesh(new THREE.BoxGeometry(w, 0.035, 0.035), M.gold);
    t.position.set(x, 0.96, z);
    t.rotation.y = ry;
    g.add(t);
  };
  dado(r.w, r.cx, -D / 2 + 0.011);
  // الجدار الخارجي: قبل الباب وبعده
  const zA = -D / 2;
  const zB = D / 2;
  const segs = [[zA, DOOR.z0], [DOOR.z1, zB]];
  for (const [a, b] of segs) dado(b - a, xOut - out * 0.011, (a + b) / 2, Math.PI / 2);

  // ---------------- الباب (يدور حول مفصله عند z0)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(xOut - out * 0.06, 0, DOOR.z0);
  const dW = DOOR.z1 - DOOR.z0;
  const leaf = mesh(new RoundedBoxGeometry(0.06, DOOR.h - 0.02, dW - 0.03, 2, 0.02), M.darkWood, { cast: shadows });
  leaf.position.set(0, DOOR.h / 2, dW / 2);
  const knob = mesh(new THREE.SphereGeometry(0.035, 16, 12), M.gold);
  knob.position.set(-out * 0.05, 1.0, dW - 0.12);
  // زخرفة الباب: معيّنان ذهبيان
  for (const y of [0.6, 1.45]) {
    const dm = mesh(new THREE.BoxGeometry(0.02, 0.22, 0.22), M.gold);
    dm.rotation.x = Math.PI / 4;
    dm.position.set(-out * 0.035, y, dW / 2);
    doorPivot.add(dm);
  }
  doorPivot.add(leaf, knob);
  g.add(doorPivot);
  // حلق ذهبي رفيع حول فتحة الباب
  for (const z of [DOOR.z0 - 0.035, DOOR.z1 + 0.035]) {
    const j = mesh(new THREE.BoxGeometry(0.05, DOOR.h, 0.05), M.gold);
    j.position.set(xOut - out * 0.02, DOOR.h / 2, z);
    g.add(j);
  }
  const lintel = mesh(new THREE.BoxGeometry(0.05, 0.05, dW + 0.12), M.gold);
  lintel.position.set(xOut - out * 0.02, DOOR.h + 0.02, (DOOR.z0 + DOOR.z1) / 2);
  g.add(lintel);
  // ضوء الخارج من فتحة الباب حين يُفتح (إضاءة دافئة)
  const doorGlow = mesh(new THREE.PlaneGeometry(dW, DOOR.h), new THREE.MeshBasicNodeMaterial({ color: 0xfff1d0 }));
  doorGlow.rotation.y = out > 0 ? -Math.PI / 2 : Math.PI / 2;
  doorGlow.position.set(xOut + out * (T - 0.02), DOOR.h / 2, (DOOR.z0 + DOOR.z1) / 2);
  g.add(doorGlow);
  R.door = { pivot: doorPivot, out, pos: new THREE.Vector3(xOut - out * 0.4, 0, (DOOR.z0 + DOOR.z1) / 2), outside: new THREE.Vector3(xOut + out * 0.9, 0, (DOOR.z0 + DOOR.z1) / 2) };

  // ---------------- الحوض والمرآة (على الجدار الخارجي قرب الأمام)
  const sink = new THREE.Group();
  const basin = mesh(new RoundedBoxGeometry(0.42, 0.18, 0.62, 3, 0.06), enamel(0xffffff), { cast: shadows, receive: shadows });
  basin.position.y = 0.86;
  const ped = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.78, 20), enamel(0xffffff), { cast: shadows });
  ped.position.y = 0.39;
  const tap = new THREE.Group();
  const tp1 = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 12), M.chrome);
  tp1.position.y = 1.06;
  const tp2 = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12), M.chrome);
  tp2.rotation.z = Math.PI / 2;
  tp2.position.set(-out * 0.08, 1.16, 0);
  tap.add(tp1, tp2);
  const mirror = mesh(new RoundedBoxGeometry(0.03, 0.55, 0.48, 2, 0.02), new THREE.MeshPhysicalNodeMaterial({ color: 0xe9f3ff, metalness: 1, roughness: 0.06 }));
  mirror.position.set(out * 0.0, 1.62, 0);
  const soap = mesh(new RoundedBoxGeometry(0.08, 0.05, 0.12, 2, 0.02), enamel(0xf59bb5), { cast: shadows });
  soap.position.set(-out * 0.02, 0.98, 0.2);
  sink.add(basin, ped, tap, mirror, soap);
  sink.position.set(xOut - out * 0.23, 0, 0.75);
  g.add(sink);
  // الماء: عمود شفاف يظهر عند الغسل
  const water = mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 12), new THREE.MeshPhysicalNodeMaterial({ color: 0xbfe6ff, transmission: tier === 'A' ? 1 : 0, transparent: tier !== 'A', opacity: 0.6, roughness: 0.05 }));
  water.position.set(xOut - out * 0.23 - out * 0.16, 1.03, 0.75);
  water.visible = false;
  g.add(water);
  R.sink = { group: sink, water, stand: new THREE.Vector3(xOut - out * 0.75, 0, 0.75), hands: new THREE.Vector3(xOut - out * 0.25, 0.98, 0.75) };

  // ---------------- السلة (مينا عنابية بغطاء كروم)
  const bin = new THREE.Group();
  const bb = mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 32, 1, true), enamel(0x8a1538, { side: THREE.DoubleSide }), { cast: shadows });
  bb.position.y = 0.21;
  const bbot = mesh(new THREE.CircleGeometry(0.14, 32), enamel(0x5f0d26));
  bbot.rotation.x = -Math.PI / 2;
  bbot.position.y = 0.01;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.43, -0.17);
  const lid = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 32), M.chrome, { cast: shadows });
  lid.position.set(0, 0, 0.17);
  const lidKnob = mesh(new THREE.SphereGeometry(0.03, 12, 8), M.chrome);
  lidKnob.position.set(0, 0.03, 0.17);
  lidPivot.add(lid, lidKnob);
  const pedal = mesh(new RoundedBoxGeometry(0.12, 0.03, 0.08, 2, 0.01), M.chrome);
  pedal.position.set(0, 0.03, 0.19);
  bin.add(bb, bbot, lidPivot, pedal);
  bin.position.set(xOut - out * 0.55, 0, 1.6);
  g.add(bin);
  R.bin = { group: bin, lid: lidPivot, mouth: new THREE.Vector3(xOut - out * 0.55, 0.46, 1.6) };

  // ---------------- النبتة في الركن الخلفي
  const plant = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 24), new THREE.MeshPhysicalNodeMaterial({ color: 0xc8643f, roughness: 0.75 }), { cast: shadows });
  pot.position.y = 0.18;
  plant.add(pot);
  const leafG = new THREE.SphereGeometry(0.12, 16, 12);
  leafG.scale(0.55, 1.6, 0.25);
  for (let i = 0; i < 9; i++) {
    const l = mesh(leafG, M.leaf, { cast: shadows });
    const a = (i / 9) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.08, 0.55 + (i % 3) * 0.05, Math.sin(a) * 0.08);
    l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    plant.add(l);
  }
  plant.position.set(xOut - out * 0.4, 0, -D / 2 + 0.45);
  g.add(plant);

  // ---------------- لوحة الرسوم والساعة بين النافذتين
  const board = mesh(new RoundedBoxGeometry(1.05, 0.72, 0.04, 2, 0.02), M.cork, { receive: shadows });
  board.position.set(r.cx, 1.5, -D / 2 + 0.03);
  g.add(board);
  const bframe = mesh(new RoundedBoxGeometry(1.13, 0.8, 0.03, 2, 0.015), M.darkWood);
  bframe.position.set(r.cx, 1.5, -D / 2 + 0.012);
  g.add(bframe);
  [[-0.27, 0.15, 0], [0.24, 0.16, 1], [-0.25, -0.17, 2], [0.26, -0.15, 3]].forEach(([x, y, kind]) => {
    const p = mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshStandardNodeMaterial({ map: drawing(kind), roughness: 0.9 }));
    p.position.set(r.cx + x, 1.5 + y, -D / 2 + 0.056);
    p.rotation.z = (kind - 1.5) * 0.05;
    g.add(p);
    const pin = mesh(new THREE.SphereGeometry(0.016, 10, 8), enamel([0xe8665a, 0x3d8fe0, 0xe3a12f, 0x2a9d96][kind]));
    pin.position.set(r.cx + x, 1.5 + y + 0.12, -D / 2 + 0.07);
    g.add(pin);
  });
  const clock = new THREE.Group();
  const face = mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshStandardNodeMaterial({ map: clockFace(), roughness: 0.4 }));
  face.position.z = 0.02;
  const rim = mesh(new THREE.TorusGeometry(0.21, 0.028, 16, 48), M.gold);
  const hHand = mesh(new THREE.BoxGeometry(0.022, 0.12, 0.01), new THREE.MeshStandardNodeMaterial({ color: 0x2a1f1a }));
  hHand.geometry.translate(0, 0.05, 0);
  const mHand = mesh(new THREE.BoxGeometry(0.014, 0.17, 0.01), new THREE.MeshStandardNodeMaterial({ color: 0x2a1f1a }));
  mHand.geometry.translate(0, 0.075, 0);
  hHand.position.z = 0.03;
  mHand.position.z = 0.035;
  const hub = mesh(new THREE.SphereGeometry(0.018, 12, 8), M.gold);
  hub.position.z = 0.04;
  clock.add(face, rim, hHand, mHand, hub);
  clock.position.set(r.cx, 2.25, -D / 2 + 0.03);
  g.add(clock);
  R.clock = { hour: hHand, minute: mHand };

  // ---------------- الطاولات والدمى: صفّان × ثلاث
  const cols = [-0.29, 0, 0.29].map((f) => r.cx + f * r.w);
  const rows = [-0.45, 0.8];
  const chairColors = [0x2f8f8a, 0xe3a12f, 0x8a1538];
  let idx = 0;
  const topGeo = new RoundedBoxGeometry(DESK.w, 0.05, DESK.d, 3, 0.02);
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, DESK.h - 0.05, 12);
  const panelGeo = new RoundedBoxGeometry(DESK.w - 0.08, 0.32, 0.03, 2, 0.012);
  const bookGeo = new RoundedBoxGeometry(0.26, 0.035, 0.2, 2, 0.008);
  const pencilGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8);
  for (const z of rows) {
    for (const x of cols) {
      const desk = new THREE.Group();
      const top = mesh(topGeo, M.deskTop, { cast: shadows, receive: true });
      top.position.y = DESK.h - 0.025;
      desk.add(top);
      for (const [lx, lz] of [[-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24]]) {
        const l = mesh(legGeo, M.chrome, { cast: shadows });
        l.position.set(lx, (DESK.h - 0.05) / 2, lz);
        desk.add(l);
      }
      const front = mesh(panelGeo, M.deskFrame, { cast: shadows, receive: shadows });
      front.position.set(0, DESK.h - 0.2, DESK.d / 2 - 0.03);
      desk.add(front);
      const book = mesh(bookGeo, enamel([0xe8665a, 0x3d8fe0, 0x8b6cd6, 0xe3a12f, 0x2a9d96, 0xa3294f][idx]), { cast: shadows });
      book.position.set(-0.22, DESK.h + 0.018, -0.02);
      book.rotation.y = 0.15 - (idx % 3) * 0.1;
      const pencil = mesh(pencilGeo, enamel(0xf2b51b));
      pencil.rotation.z = Math.PI / 2;
      pencil.rotation.y = 0.4;
      pencil.position.set(0.22, DESK.h + 0.01, 0.04);
      desk.add(book, pencil);
      desk.position.set(x, 0, z);
      g.add(desk);
      if (!shadows) {
        const b = mesh(new THREE.PlaneGeometry(1.3, 0.95), M.blob);
        b.rotation.x = -Math.PI / 2;
        b.position.set(x, 0.006, z - 0.2);
        g.add(b);
      }
      R.desks.push({ group: desk, x, z });
      R.deskTops.push({ x0: x - DESK.w / 2, x1: x + DESK.w / 2, z0: z - DESK.d / 2, z1: z + DESK.d / 2, y: DESK.h });

      // الدمية خلف الطاولة، وجهها نحو الكاميرا
      const D0 = makeDoll(DOLLS[idx], idx, chairColors[idx % 3], shared);
      D0.root.position.set(x, 0, z - 0.52);
      D0.home = D0.root.position.clone();
      D0.root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = shadows && !o.material.transparent;
          o.receiveShadow = shadows;
        }
      });
      g.add(D0.root);
      R.dolls.push(D0);
      idx++;
    }
  }
  R.deskH = DESK.h;
  return R;
}
