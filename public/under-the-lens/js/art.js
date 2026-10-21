// ---------------------------------------------------------------------------
// رسوم العيّنات المكبّرة: كلها إجرائية على <canvas> (بلا صور ولا حقوق).
// كل دالة ترسم مربعًا S×S يُقصّ دائريًا في اللعبة. البذرة ثابتة لكل عيّنة،
// فالرسم واحد في كل مرة وعلى كل جهاز.
// getArt(id) يعيد لوحة 512px مخزّنة، وdrawView() يرسم «ما تراه» بأي تكبير وأي وضوح.
// ---------------------------------------------------------------------------
const S = 512;
const cache = new Map();

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function bg(ctx, c0, c1) {
  const g = ctx.createRadialGradient(S * 0.45, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}
/** شكل مضلّع مستدير غير منتظم (حبّة) */
function blobPath(ctx, x, y, r, R, n = 9, wob = 0.3) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - wob / 2 + R() * wob);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85]);
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    const nq = pts[(i + 1) % n];
    const nn = pts[(i + 2) % n];
    ctx.quadraticCurveTo(nq[0], nq[1], (nq[0] + nn[0]) / 2, (nq[1] + nn[1]) / 2);
  }
  ctx.closePath();
}
function shade(ctx, x, y, r, col, hi = 'rgba(255,255,255,.75)') {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.1);
  g.addColorStop(0, hi);
  g.addColorStop(0.25, col);
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  return g;
}

// ------------------------------------------------------------------ المستوى ١
const ART = {
  sand(ctx, R) {
    bg(ctx, '#f3dfb8', '#b98a4c');
    const cols = ['#f1e2c4', '#e6b980', '#d79a5b', '#c7c0b4', '#f4d9cf', '#a8774a', '#efe9dd', '#9a8f86'];
    const grains = [];
    for (let i = 0; i < 46; i++) grains.push([R() * S, R() * S, 26 + R() * 46, cols[(R() * cols.length) | 0], R()]);
    grains.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r, c, k] of grains) {
      ctx.save();
      ctx.shadowColor = 'rgba(60,35,10,.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;
      blobPath(ctx, x, y, r, R, 8 + ((R() * 4) | 0), 0.45);
      ctx.fillStyle = shade(ctx, x, y, r, c);
      ctx.fill();
      ctx.restore();
      if (k > 0.72) {
        // قطعة صدفة: خطوط مقوّسة
        ctx.strokeStyle = 'rgba(120,80,40,.45)';
        ctx.lineWidth = 2.5;
        for (let j = 1; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(x + r * 0.5, y + r * 0.6, r * (0.35 + j * 0.25), Math.PI * 1.05, Math.PI * 1.55);
          ctx.stroke();
        }
      } else if (k < 0.2) {
        // حبّة شفّافة (كوارتز)
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        blobPath(ctx, x - r * 0.15, y - r * 0.2, r * 0.45, R, 7, 0.3);
        ctx.fill();
      }
    }
  },

  salt(ctx, R) {
    bg(ctx, '#e3edf6', '#7d97b0');
    const cubes = [];
    for (let i = 0; i < 26; i++) cubes.push([R() * S, R() * S, 30 + R() * 46, R() * 0.9 - 0.45]);
    cubes.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, rot] of cubes) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.shadowColor = 'rgba(30,50,80,.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 7;
      const d = s * 0.42;
      // الوجه الأمامي
      ctx.fillStyle = 'rgba(250,252,255,.94)';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowColor = 'transparent';
      // الوجه العلوي
      ctx.fillStyle = 'rgba(255,255,255,.98)';
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s / 2);
      ctx.lineTo(-s / 2 + d, -s / 2 - d);
      ctx.lineTo(s / 2 + d, -s / 2 - d);
      ctx.lineTo(s / 2, -s / 2);
      ctx.closePath();
      ctx.fill();
      // الوجه الجانبي
      ctx.fillStyle = 'rgba(190,210,230,.95)';
      ctx.beginPath();
      ctx.moveTo(s / 2, -s / 2);
      ctx.lineTo(s / 2 + d, -s / 2 - d);
      ctx.lineTo(s / 2 + d, s / 2 - d);
      ctx.lineTo(s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,150,.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      // تدرّجات داخل البلّورة
      ctx.strokeStyle = 'rgba(150,180,210,.5)';
      ctx.strokeRect(-s / 2 + s * 0.18, -s / 2 + s * 0.18, s * 0.64, s * 0.64);
      ctx.restore();
    }
    // لمعات
    for (let i = 0; i < 14; i++) {
      const x = R() * S;
      const y = R() * S;
      const r = 6 + R() * 10;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
    }
  },

  ant(ctx, R) {
    bg(ctx, '#e9f2d6', '#9fbf74');
    // خلفية: عروق ورقة باهتة تحت النملة
    ctx.strokeStyle = 'rgba(80,120,40,.25)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 100 + 20);
      ctx.quadraticCurveTo(S / 2, i * 100 - 40, S, i * 100 + 30);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(S * 0.5, S * 0.55);
    ctx.rotate(-0.25);
    const body = '#3a1f10';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // الأرجل الست: كل رجل ثلاث قطع
    ctx.strokeStyle = '#2b160a';
    ctx.lineWidth = 9;
    const legs = [
      [-20, 10, -70, 70, -120, 95], [-20, 10, -95, 10, -150, 40], [-20, 10, -60, -60, -110, -95],
      [20, 10, 60, 75, 30, 140], [20, 10, 90, 20, 120, 90], [20, 10, 80, -55, 140, -80],
    ];
    for (const [ax, ay, bx, by, cx, cy] of legs) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    const part = (x, y, rx, ry) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      const g = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.5, 2, x, y, Math.max(rx, ry));
      g.addColorStop(0, '#a46a3c');
      g.addColorStop(0.35, body);
      g.addColorStop(1, '#140802');
      ctx.fillStyle = g;
      ctx.fill();
    };
    part(-150, 30, 95, 70); // البطن
    part(-40, 10, 55, 34); // الصدر
    part(70, -10, 72, 62); // الرأس
    // العين المركّبة (نقاط)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(95, -28, 22, 18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.arc(85 + (i % 6) * 4.5, -38 + Math.floor(i / 6) * 8, 1.6, 0, TAU);
      ctx.fill();
    }
    // قرنا الاستشعار (مكسوران كالمرفق)
    ctx.strokeStyle = '#2b160a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(110, -55);
    ctx.lineTo(150, -150);
    ctx.lineTo(225, -170);
    ctx.moveTo(95, -62);
    ctx.lineTo(110, -165);
    ctx.lineTo(170, -215);
    ctx.stroke();
    // الفكّان
    ctx.fillStyle = '#5a2e12';
    ctx.beginPath();
    ctx.moveTo(130, 20);
    ctx.quadraticCurveTo(175, 25, 168, 55);
    ctx.quadraticCurveTo(150, 40, 128, 40);
    ctx.fill();
    // شعيرات
    ctx.strokeStyle = 'rgba(200,160,120,.55)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) {
      const a = R() * TAU;
      const x = -150 + Math.cos(a) * 92;
      const y = 30 + Math.sin(a) * 68;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.stroke();
    }
    ctx.restore();
  },

  leaf(ctx, R) {
    bg(ctx, '#9fd86f', '#2f7a2a');
    // شبكة صغيرة من الخلايا (عروق دقيقة)
    ctx.strokeStyle = 'rgba(220,255,190,.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 260; i++) {
      const x = R() * S;
      const y = R() * S;
      const a = R() * TAU;
      const l = 18 + R() * 26;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // عروق متفرّعة
    const vein = (x, y, a, len, w, depth) => {
      if (depth <= 0 || w < 1.2) return;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      ctx.strokeStyle = `rgba(235,255,210,${0.5 + w / 40})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * 20, (y + y2) / 2 + (R() - 0.5) * 20, x2, y2);
      ctx.stroke();
      const n = depth > 2 ? 4 : 2;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const bx = lerp(x, x2, t);
        const by = lerp(y, y2, t);
        const side = i % 2 ? 1 : -1;
        vein(bx, by, a + side * (0.7 + R() * 0.3), len * 0.55, w * 0.5, depth - 1);
      }
    };
    ctx.lineCap = 'round';
    vein(S * 0.5, S * 1.05, -Math.PI / 2 - 0.08, S * 1.1, 26, 4);
    // ثغور صغيرة
    ctx.fillStyle = 'rgba(20,70,20,.35)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(R() * S, R() * S, 5, 3, R() * 3, 0, TAU);
      ctx.fill();
    }
  },

  finger(ctx, R) {
    bg(ctx, '#f6d2bc', '#c98d6d');
    ctx.lineCap = 'round';
    const cx = S * 0.5 + (R() - 0.5) * 20;
    const cy = S * 0.55;
    // خطوط ملتفّة (دوّامة) بانقطاعات صغيرة
    for (let k = 0; k < 26; k++) {
      const r = 14 + k * 15;
      ctx.strokeStyle = 'rgba(150,80,55,.8)';
      ctx.lineWidth = 7;
      let a = R() * TAU;
      const end = a + TAU;
      while (a < end) {
        const seg = 0.6 + R() * 1.8;
        const b = Math.min(end, a + seg);
        ctx.beginPath();
        for (let t = a; t <= b; t += 0.04) {
          const wob = 1 + 0.07 * Math.sin(t * 3 + k * 0.5);
          const x = cx + Math.cos(t) * r * 1.0 * wob;
          const y = cy + Math.sin(t) * r * 1.25 * wob - (k > 12 ? (k - 12) * 4 : 0);
          if (t === a) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        a = b + 0.08 + R() * 0.12;
      }
    }
    // مسامّ العرق
    ctx.fillStyle = 'rgba(255,240,230,.7)';
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      ctx.arc(R() * S, R() * S, 2.2, 0, TAU);
      ctx.fill();
    }
  },

  feather(ctx, R) {
    bg(ctx, '#e8f0f8', '#8fa7c2');
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-0.6);
    // الساق
    const shaftW = 22;
    ctx.fillStyle = '#f6f2ea';
    ctx.strokeStyle = 'rgba(80,90,110,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-S, -shaftW / 2, S * 2, shaftW);
    ctx.fill();
    ctx.stroke();
    // الشعيرات على الجانبين، ولكل شعيرة شعيرات أصغر
    for (const side of [-1, 1]) {
      for (let x = -S; x < S; x += 16) {
        const len = 260;
        const ang = side * 0.75;
        const x2 = x + Math.cos(ang) * len * 0.35 + len * 0.55;
        const y2 = side * (shaftW / 2 + Math.abs(Math.sin(ang)) * len);
        const col = side < 0 ? '#5f7896' : '#6d86a4';
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, side * shaftW / 2);
        ctx.quadraticCurveTo(x + 40, y2 * 0.5, x2, y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(190,210,235,.75)';
        ctx.lineWidth = 1.6;
        for (let t = 0.12; t < 1; t += 0.09) {
          const px = lerp(x, x2, t);
          const py = lerp(side * shaftW / 2, y2, t);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + 14, py + side * 4);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  },

  fabric(ctx, R) {
    bg(ctx, '#f0e4d8', '#7a2a2a');
    const n = 9;
    const cell = S / n;
    const w = cell * 0.78;
    // الخيوط الأفقية والعمودية متناوبة فوق وتحت
    const thread = (x, y, horiz, col) => {
      ctx.save();
      const g = horiz ? ctx.createLinearGradient(0, y - w / 2, 0, y + w / 2) : ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, 'rgba(0,0,0,.35)');
      g.addColorStop(0.35, col);
      g.addColorStop(0.55, col);
      g.addColorStop(1, 'rgba(0,0,0,.4)');
      ctx.fillStyle = g;
      ctx.beginPath();
      if (horiz) ctx.roundRect(x - cell * 0.6, y - w / 2, cell * 1.2, w, w / 2);
      else ctx.roundRect(x - w / 2, y - cell * 0.6, w, cell * 1.2, w / 2);
      ctx.fill();
      // ألياف الخيط
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        if (horiz) {
          const yy = y - w / 2 + (i + 1) * (w / 7);
          ctx.moveTo(x - cell * 0.5, yy + 4);
          ctx.lineTo(x + cell * 0.5, yy - 4);
        } else {
          const xx = x - w / 2 + (i + 1) * (w / 7);
          ctx.moveTo(xx + 4, y - cell * 0.5);
          ctx.lineTo(xx - 4, y + cell * 0.5);
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n + 1; i++) {
        for (let j = 0; j < n + 1; j++) {
          const x = i * cell;
          const y = j * cell;
          const horizOnTop = (i + j) % 2 === 0;
          if (pass === 0) thread(x, y, !horizOnTop, horizOnTop ? '#e8d6b6' : '#b3313b');
          else thread(x, y, horizOnTop, horizOnTop ? '#b3313b' : '#e8d6b6');
        }
      }
    }
    // زغب
    ctx.strokeStyle = 'rgba(255,240,230,.45)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 50; i++) {
      const x = R() * S;
      const y = R() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 10, y - 14, x + 20, y + 8, x + 30 * R(), y - 20 * R());
      ctx.stroke();
    }
  },

  // ---------------------------------------------------------------- المستوى ٢
  onion(ctx, R) {
    bg(ctx, '#fbeff8', '#d7b4d6');
    const rows = 7;
    const h = S / rows;
    for (let r = -1; r <= rows; r++) {
      const off = (r % 2) * 55;
      let x = -off;
      while (x < S + 60) {
        const w = 110 + R() * 70;
        const y = r * h;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 14);
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, 'rgba(236,200,236,.95)');
        g.addColorStop(1, 'rgba(205,160,210,.95)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#8b4f9e';
        ctx.lineWidth = 5;
        ctx.stroke();
        // النواة
        const nx = x + w * (0.3 + R() * 0.4);
        const ny = y + h * (0.35 + R() * 0.3);
        ctx.beginPath();
        ctx.arc(nx, ny, 11, 0, TAU);
        ctx.fillStyle = '#5d2a6e';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nx - 3, ny - 3, 3.5, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fill();
        ctx.restore();
        x += w;
      }
    }
  },

  pond(ctx, R) {
    bg(ctx, '#e3f6ef', '#8ccab8');
    ctx.lineCap = 'round';
    // نقاط صغيرة
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(40,110,90,${0.15 + R() * 0.25})`;
      ctx.beginPath();
      ctx.arc(R() * S, R() * S, 2 + R() * 4, 0, TAU);
      ctx.fill();
    }
    // كائن شبيه بالنعل بأهداب
    const slipper = (x, y, a, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(30,110,90,.6)';
      ctx.lineWidth = 2;
      for (let t = 0; t < TAU; t += 0.16) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(t) * 92, Math.sin(t) * 40);
        ctx.lineTo(Math.cos(t) * 104, Math.sin(t) * 50);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, 92, 40, 0, 0, TAU);
      ctx.fillStyle = 'rgba(170,225,205,.9)';
      ctx.fill();
      ctx.strokeStyle = '#1f8a7a';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,100,.55)';
      ctx.beginPath();
      ctx.ellipse(-10, 4, 24, 14, 0.3, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(60,150,90,.6)';
        ctx.beginPath();
        ctx.arc(-60 + i * 22, -14 + (i % 2) * 22, 6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };
    slipper(S * 0.32, S * 0.35, 0.4, 1);
    slipper(S * 0.72, S * 0.75, -0.6, 0.7);
    // سلسلة طحالب خضراء
    for (let i = 0; i < 8; i++) {
      const x = S * 0.12 + i * 34;
      const y = S * 0.78 - i * 22;
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, TAU);
      ctx.fillStyle = '#57b04a';
      ctx.fill();
      ctx.strokeStyle = '#2d7a2a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.arc(x - 5, y - 5, 5, 0, TAU);
      ctx.fill();
    }
    // كائن متغيّر الشكل
    ctx.save();
    blobPath(ctx, S * 0.75, S * 0.28, 70, R, 11, 0.7);
    ctx.fillStyle = 'rgba(200,230,170,.85)';
    ctx.fill();
    ctx.strokeStyle = '#4c8a3a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S * 0.76, S * 0.29, 14, 0, TAU);
    ctx.fillStyle = 'rgba(70,120,50,.7)';
    ctx.fill();
    ctx.restore();
    // قارب صغير مخطّط (دياتوم)
    ctx.save();
    ctx.translate(S * 0.6, S * 0.52);
    ctx.rotate(0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 18, 0, 0, TAU);
    ctx.fillStyle = 'rgba(214,190,120,.9)';
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    for (let i = -50; i <= 50; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, -14);
      ctx.lineTo(i, 14);
      ctx.stroke();
    }
    ctx.restore();
  },

  pollen(ctx, R) {
    bg(ctx, '#fff6d6', '#e9c766');
    const balls = [[0.36, 0.4, 105], [0.74, 0.3, 70], [0.68, 0.74, 88], [0.22, 0.8, 52], [0.88, 0.58, 40]];
    for (const [fx, fy, r] of balls) {
      const x = fx * S;
      const y = fy * S;
      // أشواك
      ctx.fillStyle = '#c78a0c';
      const n = Math.round(r / 4.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + R() * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - 0.06) * r * 0.95, y + Math.sin(a - 0.06) * r * 0.95);
        ctx.lineTo(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22);
        ctx.lineTo(x + Math.cos(a + 0.06) * r * 0.95, y + Math.sin(a + 0.06) * r * 0.95);
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = 'rgba(120,80,0,.4)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = shade(ctx, x, y, r, '#f2b51b', 'rgba(255,250,220,.95)');
      ctx.fill();
      ctx.restore();
      // أشواك ظاهرة على السطح
      ctx.fillStyle = 'rgba(170,110,0,.55)';
      for (let i = 0; i < r / 3; i++) {
        const a = R() * TAU;
        const d = R() * r * 0.8;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2, 0, TAU);
        ctx.fill();
      }
    }
  },

  hair(ctx, R) {
    bg(ctx, '#f7f1e8', '#cdbda6');
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-0.5);
    const w = 190;
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    g.addColorStop(0, '#3e2614');
    g.addColorStop(0.3, '#8a5a32');
    g.addColorStop(0.55, '#a46e40');
    g.addColorStop(1, '#2e1a0c');
    ctx.fillStyle = g;
    ctx.fillRect(-S, -w / 2, S * 2, w);
    // قشور متراكبة كالقرميد
    ctx.strokeStyle = 'rgba(240,210,170,.7)';
    ctx.lineWidth = 3;
    for (let x = -S; x < S; x += 34 + R() * 10) {
      ctx.beginPath();
      ctx.moveTo(x, -w / 2);
      for (let y = -w / 2; y <= w / 2; y += 10) ctx.lineTo(x + Math.sin((y / w) * Math.PI) * 22 + (R() - 0.5) * 4, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-S, -w / 2, S * 2, w);
    ctx.restore();
  },
};

/** لوحة 512px للعيّنة المكبّرة (مخزّنة) */
export function getArt(id) {
  if (cache.has(id)) return cache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const fn = ART[id];
  if (fn) fn(ctx, rng(seedOf(id)));
  cache.set(id, c);
  return c;
}

const tmp = document.createElement('canvas');
const tctx = tmp.getContext('2d');

/**
 * يرسم «ما يُرى» داخل الدائرة.
 * @param {CanvasRenderingContext2D} ctx لوحة الطبق (مربعة، قطرها D بكسل)
 * @param {string} id العيّنة
 * @param {number} zoom 0 = نقطة صغيرة لا تُعرف (بالعين)، 1 = مكبّرة تملأ الدائرة
 * @param {number} focus 0 = ضبابية تمامًا، 1 = واضحة (يُصنع الضباب بخفض الدقة ثم التكبير)
 */
export function drawView(ctx, id, zoom, focus) {
  const D = ctx.canvas.width;
  ctx.clearRect(0, 0, D, D);
  // سطح الشريحة الزجاجية
  const g = ctx.createRadialGradient(D * 0.4, D * 0.35, D * 0.05, D / 2, D / 2, D * 0.6);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e7f1ef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, D, D);
  const art = getArt(id);
  const z = Math.max(0, Math.min(1, zoom));
  const size = lerp(D * 0.07, D * 1.02, z * z * (3 - 2 * z));
  const res = Math.max(6, Math.round(lerp(10, S, Math.pow(Math.max(0, Math.min(1, focus)), 2.2))));
  tmp.width = tmp.height = res;
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(art, 0, 0, res, res);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.beginPath();
  ctx.arc(D / 2, D / 2, size / 2, 0, TAU);
  ctx.clip();
  ctx.drawImage(tmp, (D - size) / 2, (D - size) / 2, size, size);
  ctx.restore();
  // وهج زجاج العدسة
  const hl = ctx.createLinearGradient(0, 0, D, D);
  hl.addColorStop(0, 'rgba(255,255,255,.28)');
  hl.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, D, D);
}

export const ART_IDS = Object.keys(ART);
