import { W, H, paper, vo, counter, rr } from './_lib.js';
import { OUT, MUN } from './_qatar.js';          // حدود قطر وبلدياتها الثماني كما في الخريطة الحرارية للموقع (src/data/qatar-geo.ts)
const NAMES = { doha: 'الدوحة', rayyan: 'الريان', wakrah: 'الوكرة', daayen: 'الظعاين', ummslal: 'أم صلال', khor: 'الخور والذخيرة', shahaniya: 'الشيحانية', shamal: 'الشمال' };
const ORDER = ['doha', 'rayyan', 'wakrah', 'daayen', 'ummslal', 'khor', 'shahaniya', 'shamal'];
const K = 500, X0 = 270, Y0 = 120; const pj = (lng, lat) => [X0 + (lng - 50.72) * K, Y0 + (26.2 - lat) * K];
// مواضع الأسماء (إزاحة بالبكسل عن مركز البلدية كي لا تتزاحم)
const LAB = { doha: [26, 8, 'left'], rayyan: [0, 10, 'center'], wakrah: [0, 10, 'center'], daayen: [-26, 8, 'right'], ummslal: [0, 10, 'center'], khor: [0, 10, 'center'], shahaniya: [0, 10, 'center'], shamal: [0, 10, 'center'] };
const ring = (X, r) => { X.beginPath(); r.forEach((p, i) => { const [x, y] = pj(p[0], p[1]); i ? X.lineTo(x, y) : X.moveTo(x, y); }); X.closePath(); };
MOTION.scene({ id: 'e1',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l23', i), M = i => ctx.wordTime('l24', i), s24 = ctx.lineSpan('l24');
    const pts = OUT.map(p => pj(p[0], p[1])), mk = ctx.at(lt, .1, 1.7, 'quadInOut'), fill = ctx.at(lt, 1.5, 2.1);
    // الأرض
    if (fill > 0) { X.save(); X.globalAlpha = fill; X.fillStyle = P.sand; ring(X, OUT); X.fill(); X.restore(); }
    // البلديات: حدود رفيعة، وكل بلدية تضيء بالعنّابي الفاتح عند ذكر البلديات
    MUN.forEach((m, i) => { const idx = ORDER.indexOf(m.id), s = L(6).s - .1 + idx * .16, k = ctx.at(t, s, s + .45, 'expoOut');
      X.save(); X.globalAlpha = fill; ring(X, OUT); X.clip(); m.rings.forEach(r => { ring(X, r); X.fillStyle = k > 0 ? `rgba(138,21,56,${.08 + .22 * k})` : 'rgba(0,0,0,0)'; if (k > 0) X.fill(); X.strokeStyle = 'rgba(138,21,56,.35)'; X.lineWidth = 1.5; X.stroke(); }); X.restore(); });
    // الحدّ الخارجي يُرسم بخطّ
    ctx.drawPath(X, pts, mk, { width: 7, color: P.acc, tip: { r: 7 } });
    // نقاط البلديات وأسماؤها
    MUN.forEach(m => { const idx = ORDER.indexOf(m.id), s = L(6).s - .1 + idx * .16, k = ctx.at(t, s, s + .45, 'expoOut'); if (k <= 0) return; const [x, y] = pj(m.centroid[0], m.centroid[1]); const [dx, dy, al] = LAB[m.id];
      X.save(); X.globalAlpha = k; const g = X.createRadialGradient(x, y, 2, x, y, 50); g.addColorStop(0, 'rgba(138,21,56,.4)'); g.addColorStop(1, 'rgba(138,21,56,0)'); X.fillStyle = g; X.beginPath(); X.arc(x, y, 50, 0, 6.283); X.fill();
      X.fillStyle = P.acc; X.beginPath(); X.arc(x, y, 9 + 3 * k, 0, 6.283); X.fill(); X.strokeStyle = '#fff'; X.lineWidth = 3; X.stroke();
      ctx.text(X, NAMES[m.id], x + dx, y + dy + (al === 'center' ? 30 : 0), { family: 'body', weight: 700, size: 24, color: P.ink, align: al, stroke: { width: 6, color: 'rgba(246,239,227,.9)' } }); X.restore(); });
    // الأرقام
    const fade = 1 - ctx.at(t, s24.s - .3, s24.s + .1);
    X.save(); X.globalAlpha = fade;
    vo(ctx, X, t, 'l23', 'اليَومَ،', 1780, 260, { size: 56, align: 'right', family: 'body', weight: 500, color: P.mut, maxWidth: 900 });
    const ck = ctx.at(t, L(3).s - .05, L(3).s + .4, 'expoOut'); if (ck > 0) { X.globalAlpha = fade * ck; counter(ctx, X, t, { s: L(3).s - .05, to: 50, from: 0, suffix: '+', x: 1560, y: 470, size: 190, color: P.acc, keep: true }); ctx.text(X, 'مَدرَسَة تَستَخدِمُ المَنَصَّة', 1780, 560, { family: 'display', weight: 700, size: 48, color: P.ink, align: 'right' }); }
    const bk = ctx.at(t, L(8).s - .05, L(8).s + .4, 'expoOut'); if (bk > 0) { X.globalAlpha = fade * bk; counter(ctx, X, t, { s: L(8).s - .05, to: 8, from: 0, x: 1700, y: 760, size: 150, color: P.teal, keep: true }); ctx.text(X, 'بَلَدِيّات', 1560, 745, { family: 'display', weight: 700, size: 56, color: P.ink, align: 'right' }); ctx.text(X, 'مِن بَلَدِيّاتِ قَطَرَ الثَّماني', 1780, 850, { family: 'body', weight: 500, size: 34, color: P.mut, align: 'right' }); }
    X.restore();
    const zk = ctx.at(t, M(0).s - .05, M(0).s + .5, 'expoOut'); if (zk > 0) { X.save(); X.globalAlpha = zk; X.translate(0, (1 - zk) * 30);
      X.fillStyle = '#fff'; X.shadowColor = 'rgba(35,26,23,.16)'; X.shadowBlur = 40; X.shadowOffsetY = 14; rr(X, 1080, 230, 740, 560, 36); X.fill(); X.shadowColor = 'transparent';
      ctx.text(X, 'تَكلِفَةُ التَّشغيل', 1450, 330, { family: 'display', weight: 700, size: 54, color: P.mut });
      const nk = ctx.at(t, M(2).s - .05, M(2).s + .5, 'expoOut'); if (nk > 0) { X.globalAlpha = zk * nk; ctx.text(X, '0', 1450, 610, { family: 'num', weight: 900, size: 300, color: P.acc, dir: 'ltr' }); ctx.text(X, 'رِيال', 1450, 740, { family: 'display', weight: 800, size: 72, color: P.ink }); } X.restore(); }
  } });
