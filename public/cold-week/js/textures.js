// ---------------------------------------------------------------------------
// أنسجة مرسومة بالكود على لوحة (Canvas) مرة واحدة: بلا ملفات ولا حقوق.
// المشربية (نقش نجمة ثمانية)، ووجه الساعة (علامات بلا أرقام)، ورسوم أطفال على
// لوحة الإعلانات، وأيقونات صغيرة فوق الدمى (علامة تنبيه، ميزان حرارة).
// لا نص عربي في المشهد ثلاثي الأبعاد: كل النصوص في HTML.
// ---------------------------------------------------------------------------
import * as THREE from 'three/webgpu';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** خلية مشربية تتكرر: الخشب معتم (alpha=1) والفتحات شفافة. */
export function mashrabiyaTile() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    // نجمة ثمانية = مربعان متراكبان، تُفرَّغ من الخشب
    g.save();
    g.translate(x, y);
    for (const rot of [0, Math.PI / 4]) {
      g.save();
      g.rotate(rot);
      g.beginPath();
      g.rect(-r, -r, 2 * r, 2 * r);
      g.fill();
      g.restore();
    }
    g.restore();
  };
  hole(S / 2, S / 2, S * 0.2);
  for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) hole(x, y, S * 0.2);
  // معيّنات صغيرة بين النجوم
  for (const [x, y] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S]]) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillRect(-S * 0.07, -S * 0.07, S * 0.14, S * 0.14);
    g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  // إطار داخلي رفيع حول كل نجمة (الخشب المنحوت)
  g.strokeStyle = '#fff';
  g.lineWidth = S * 0.025;
  const t = tex(c, { repeat: true, srgb: false });
  return t;
}

/** وجه الساعة: أبيض بعلامات ذهبية (بلا أرقام) */
export function clockFace() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#fbf7ee';
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    const r0 = S * (big ? 0.36 : 0.41);
    const r1 = S * 0.45;
    g.strokeStyle = big ? '#8a1538' : '#9b8f7d';
    g.lineWidth = big ? 9 : 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(S / 2 + Math.sin(a) * r0, S / 2 - Math.cos(a) * r0);
    g.lineTo(S / 2 + Math.sin(a) * r1, S / 2 - Math.cos(a) * r1);
    g.stroke();
  }
  return tex(c);
}

/** رسوم أطفال بالألوان الشمعية للوحة الإعلانات */
export function drawing(kind) {
  const W = 200;
  const H = 150;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#fffdf6';
  g.fillRect(0, 0, W, H);
  g.lineWidth = 7;
  g.lineCap = g.lineJoin = 'round';
  const crayon = (col) => {
    g.strokeStyle = col;
    g.fillStyle = col;
  };
  if (kind === 0) {
    // شمس فوق البحر
    crayon('#f2b51b');
    g.beginPath(); g.arc(100, 62, 30, 0, 7); g.fill();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath(); g.moveTo(100 + Math.cos(a) * 40, 62 + Math.sin(a) * 40); g.lineTo(100 + Math.cos(a) * 54, 62 + Math.sin(a) * 54); g.stroke();
    }
    crayon('#2a9d96');
    g.beginPath(); g.moveTo(10, 128); for (let x = 10; x <= 190; x += 20) g.quadraticCurveTo(x + 10, 116, x + 20, 128); g.stroke();
  } else if (kind === 1) {
    // بيت بشرفات
    crayon('#d9a066'); g.fillRect(52, 62, 96, 70);
    crayon('#8a1538'); g.fillRect(88, 92, 24, 40);
    crayon('#d9a066');
    for (let x = 52; x < 148; x += 16) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x + 8, 46); g.lineTo(x + 16, 62); g.fill(); }
    crayon('#3d8fe0'); g.fillRect(62, 76, 18, 16); g.fillRect(120, 76, 18, 16);
  } else if (kind === 2) {
    // زهرة
    crayon('#4caf50'); g.beginPath(); g.moveTo(100, 140); g.lineTo(100, 70); g.stroke();
    crayon('#e8665a');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(100 + Math.cos(a) * 22, 60 + Math.sin(a) * 22, 15, 0, 7); g.fill(); }
    crayon('#f2b51b'); g.beginPath(); g.arc(100, 60, 14, 0, 7); g.fill();
  } else {
    // قوس قزح وغيمة
    ['#e8665a', '#f2b51b', '#4caf50', '#3d8fe0', '#8b6cd6'].forEach((col, i) => {
      crayon(col); g.beginPath(); g.arc(100, 140, 92 - i * 12, Math.PI, 0); g.stroke();
    });
    crayon('#ffffff'); g.beginPath(); g.arc(46, 118, 18, 0, 7); g.arc(66, 112, 22, 0, 7); g.arc(86, 120, 16, 0, 7); g.fill();
  }
  return tex(c);
}

/** أيقونة فوق الدمية: «!» (تنبيه الموقف) أو ميزان حرارة (مريض). خلفية دائرية مضيئة. */
export function badge(kind) {
  const S = 128;
  const [c, g] = canvas(S);
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.46, 0, 7);
  g.fillStyle = kind === 'alert' ? '#ffd15c' : '#ffffff';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = kind === 'alert' ? '#8a5a00' : '#c0262d';
  g.stroke();
  if (kind === 'alert') {
    g.fillStyle = '#5b3a00';
    g.beginPath(); g.roundRect(S / 2 - 9, 26, 18, 52, 9); g.fill();
    g.beginPath(); g.arc(S / 2, 96, 10, 0, 7); g.fill();
  } else {
    // ميزان حرارة
    g.fillStyle = '#e3e7ec';
    g.beginPath(); g.roundRect(S / 2 - 10, 22, 20, 66, 10); g.fill();
    g.fillStyle = '#c0262d';
    g.beginPath(); g.arc(S / 2, 92, 16, 0, 7); g.fill();
    g.fillRect(S / 2 - 5, 44, 10, 48);
  }
  return tex(c);
}

/** قرص ظل ناعم (للطبقة B: ظل تحت كل جسم بدل خريطة الظل) */
export function blobShadow() {
  const S = 128;
  const [c, g] = canvas(S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(40,25,10,0.55)');
  gr.addColorStop(0.6, 'rgba(40,25,10,0.22)');
  gr.addColorStop(1, 'rgba(40,25,10,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return tex(c);
}
