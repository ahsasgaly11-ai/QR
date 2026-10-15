import { W, H, maroon, vo, icon, rr } from './_lib.js';
MOTION.scene({ id: 'p4',
  draw(t, lt, ctx) {
    const { X, P } = ctx; maroon(ctx, X, { sadu: true });
    const L = i => ctx.wordTime('l6', i);
    // علامة استفهام ترتسم بخط اليد لحظة «هَل»
    const qk = ctx.at(t, L(3).s - .1, L(4).e + .2, 'quadInOut');
    const path = [[560, 330], [600, 265], [690, 235], [780, 265], [810, 350], [770, 430], [690, 480], [670, 560]];
    X.save(); X.globalAlpha = .95; ctx.drawPath(X, path, qk, { width: 26, color: P.hi, tip: { r: 14, color: '#fbf6ee' } });
    const dk = ctx.at(t, L(4).e + .1, L(4).e + .35, 'expoOut'); if (dk > 0) { X.fillStyle = P.hi; X.beginPath(); X.arc(670, 650, 20 * dk, 0, 6.283); X.fill(); } X.restore();
    // النصّ يمين
    vo(ctx, X, t, 'l6', 'وَالأَهَمُّ:', 1800, 330, { size: 64, align: 'right', color: P.hi, family: 'body', weight: 600, maxWidth: 800 });
    vo(ctx, X, t, 'l6', 'بَعدَ النَّشاطِ،', 1800, 440, { size: 64, align: 'right', color: '#fbf6ee', family: 'body', weight: 500, maxWidth: 800, map: [1, 2] });
    vo(ctx, X, t, 'l6', 'هَل تَعَلَّمَ الطّالِبُ فِعلًا؟', 1800, 590, { size: 96, align: 'right', color: '#fbf6ee', maxWidth: 1000, map: [3, 4, 5, 6] });
    vo(ctx, X, t, 'l6', 'لا أَحَدَ يَعرِف.', 1800, 770, { size: 84, align: 'right', color: P.hi, maxWidth: 850, map: [7, 8, 9] });
    // لوحة إحصاءات فارغة: أعمدة متقطّعة بلا بيانات، تظهر عند «لا أحد يعرف»
    const ek = ctx.at(t, L(7).s, L(7).s + .6, 'expoOut'); if (ek > 0) { X.save(); X.globalAlpha = ek; X.translate(0, (1 - ek) * 30);
      X.fillStyle = 'rgba(255,255,255,.08)'; rr(X, 300, 720, 560, 230, 24); X.fill(); X.setLineDash([12, 12]); X.strokeStyle = 'rgba(251,246,238,.55)'; X.lineWidth = 4;
      [0, 1, 2, 3, 4].forEach(i => { const h = [90, 140, 60, 120, 80][i]; rr(X, 360 + i * 96, 900 - h, 56, h, 10); X.stroke(); });
      X.setLineDash([]); ctx.text(X, 'لا بَيانات', 580, 790, { family: 'body', weight: 500, size: 30, color: 'rgba(251,246,238,.7)' }); X.restore(); }
  } });
