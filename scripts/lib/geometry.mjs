// بناء أشكال هندسية بسيطة (أنابيب، كرات، صناديق) تُستخدم لتكوين المجسمات التشريحية.
// كل دالة تُعيد { positions, indices } بإحداثيات مثلثات جاهزة لكتابتها في ملف glTF.

const EPS = 1e-9;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a) => Math.sqrt(dot(a, a));

function normalize(a) {
  const len = length(a);
  return len < EPS ? [0, 0, 0] : scale(a, 1 / len);
}

// دوران متجه حول محور بزاوية محددة (صيغة رودريغز).
function rotateAround(vector, axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(
    add(scale(vector, c), scale(cross(axis, vector), s)),
    scale(axis, dot(axis, vector) * (1 - c)),
  );
}

// إطارات منقولة بالتوازي على طول المسار: تمنع التواء المقطع العرضي عند المنحنيات.
function transportFrames(path) {
  const count = path.length;
  const tangents = path.map((point, i) => {
    const previous = path[Math.max(0, i - 1)];
    const next = path[Math.min(count - 1, i + 1)];
    const direction = sub(next, previous);
    return length(direction) < EPS ? [0, 1, 0] : normalize(direction);
  });

  // متجه بدئي عمودي على أول مماس.
  const seed = Math.abs(tangents[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const normals = [normalize(cross(tangents[0], seed))];

  for (let i = 1; i < count; i++) {
    const axis = cross(tangents[i - 1], tangents[i]);
    if (length(axis) < EPS) {
      normals.push(normals[i - 1]);
      continue;
    }
    const angle = Math.atan2(length(axis), dot(tangents[i - 1], tangents[i]));
    normals.push(normalize(rotateAround(normals[i - 1], normalize(axis), angle)));
  }

  return tangents.map((tangent, i) => ({
    normal: normals[i],
    binormal: normalize(cross(tangent, normals[i])),
  }));
}

const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

// توزيع قيم نصف القطر على نقاط المسار باستيفاء منحنٍ يمنع الانكسارات في حدود الشكل.
export function resampleRadii(radii, count) {
  if (radii.length === count) return radii.slice();
  if (radii.length < 2) return new Array(count).fill(radii[0] ?? 0);

  const at = (i) => radii[Math.max(0, Math.min(radii.length - 1, i))];
  const ceiling = Math.max(...radii) * 1.12;
  const out = [];

  for (let i = 0; i < count; i++) {
    const position = (i / (count - 1)) * (radii.length - 1);
    const low = Math.min(radii.length - 2, Math.floor(position));
    const value = catmullRom(at(low - 1), at(low), at(low + 1), at(low + 2), position - low);
    out.push(Math.min(ceiling, Math.max(0.002, value)));
  }
  return out;
}

// تنعيم مسار متعدد النقاط بمنحنى كاتمول-روم لتفادي الزوايا الحادة.
export function smoothPath(points, subdivisions = 6) {
  if (points.length < 3 || subdivisions < 2) return points.map((p) => p.slice());
  const extended = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < extended.length - 2; i++) {
    const [p0, p1, p2, p3] = [extended[i - 1], extended[i], extended[i + 1], extended[i + 2]];
    const steps = i === extended.length - 3 ? subdivisions : subdivisions - 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((axis) => 0.5 * (
        2 * p1[axis] +
        (-p0[axis] + p2[axis]) * t +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
      )));
    }
  }
  return out;
}

// أنبوب ذو نصف قطر متغير على طول مسار: يصلح للعضلات (بطن منتفخ وأوتار رفيعة) وللعظام.
export function tube({ path, radii, segments = 20, capStart = true, capEnd = true }) {
  const frames = transportFrames(path);
  const ringRadii = resampleRadii(radii, path.length);
  const positions = [];
  const indices = [];

  for (let i = 0; i < path.length; i++) {
    const { normal, binormal } = frames[i];
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const offset = add(scale(normal, Math.cos(theta)), scale(binormal, Math.sin(theta)));
      positions.push(...add(path[i], scale(offset, ringRadii[i])));
    }
  }

  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + next;
      const c = (i + 1) * segments + j;
      const d = (i + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  if (capStart) {
    const center = positions.length / 3;
    positions.push(...path[0]);
    for (let j = 0; j < segments; j++) indices.push(center, (j + 1) % segments, j);
  }
  if (capEnd) {
    const center = positions.length / 3;
    const base = (path.length - 1) * segments;
    positions.push(...path[path.length - 1]);
    for (let j = 0; j < segments; j++) indices.push(center, base + j, base + ((j + 1) % segments));
  }

  return { positions, indices };
}

export function sphere({ center = [0, 0, 0], radius = 1, segments = 24, rings = 16, scaleXYZ = [1, 1, 1] }) {
  const positions = [];
  const indices = [];

  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      positions.push(
        center[0] + radius * scaleXYZ[0] * Math.sin(phi) * Math.cos(theta),
        center[1] + radius * scaleXYZ[1] * Math.cos(phi),
        center[2] + radius * scaleXYZ[2] * Math.sin(phi) * Math.sin(theta),
      );
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return { positions, indices };
}

export function box({ center = [0, 0, 0], size = [1, 1, 1] }) {
  const [hx, hy, hz] = size.map((value) => value / 2);
  const corners = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ].map((corner) => add(corner, center));

  const faces = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
    [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3],
  ];

  const positions = [];
  const indices = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face) positions.push(...corners[corner]);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, indices };
}

// تحويل هندسي للقطعة: تحجيم ثم دوران (XYZ بالدرجات) ثم إزاحة.
export function transform({ positions }, { translate = [0, 0, 0], rotate = [0, 0, 0], scale: s = [1, 1, 1] }) {
  const [rx, ry, rz] = rotate.map((deg) => (deg * Math.PI) / 180);
  const out = new Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    let point = [positions[i] * s[0], positions[i + 1] * s[1], positions[i + 2] * s[2]];
    if (rx) point = rotateAround(point, [1, 0, 0], rx);
    if (ry) point = rotateAround(point, [0, 1, 0], ry);
    if (rz) point = rotateAround(point, [0, 0, 1], rz);
    out[i] = point[0] + translate[0];
    out[i + 1] = point[1] + translate[1];
    out[i + 2] = point[2] + translate[2];
  }
  return out;
}

// فصل المثلثات لإعطاء كل وجه اتجاهاً مستقلاً (حواف حادة مثل الصندوق).
export function unweld({ positions, indices }) {
  const outPositions = [];
  const outIndices = [];
  for (const index of indices) {
    outIndices.push(outPositions.length / 3);
    outPositions.push(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
  }
  return { positions: outPositions, indices: outIndices };
}

// اتجاهات الرؤوس بجمع اتجاهات الوجوه المجاورة (موزونة بمساحة المثلث).
export function computeNormals(positions, indices) {
  const normals = new Array(positions.length).fill(0);

  for (let i = 0; i < indices.length; i += 3) {
    const [ia, ib, ic] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const a = positions.slice(ia, ia + 3);
    const b = positions.slice(ib, ib + 3);
    const c = positions.slice(ic, ic + 3);
    const faceNormal = cross(sub(b, a), sub(c, a));
    for (const offset of [ia, ib, ic]) {
      normals[offset] += faceNormal[0];
      normals[offset + 1] += faceNormal[1];
      normals[offset + 2] += faceNormal[2];
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const unit = normalize([normals[i], normals[i + 1], normals[i + 2]]);
    const safe = length(unit) < EPS ? [0, 1, 0] : unit;
    normals[i] = safe[0];
    normals[i + 1] = safe[1];
    normals[i + 2] = safe[2];
  }
  return normals;
}
