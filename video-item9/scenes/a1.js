import { W, H, maroon, vo, rr, textIn, icon } from './_lib.js';
MOTION.scene({ id: 'a1',
  draw(t, lt, ctx) {
    const { X, P } = ctx; maroon(ctx, X, { sadu: true });
    const L = i => ctx.wordTime('l15', i);
    const k = ctx.at(lt, .1, .9, 'expoOut');
    // عنوان الفصل
    textIn(ctx, X, t, 'التَّطبيقُ في الصَّفّ', 960, 250, ctx.scene.start + .1, { family: 'display', weight: 800, size: 118, color: '#fbf6ee' });
    const u = ctx.at(lt, .5, 1.1, 'expoOut'); X.fillStyle = P.hi; rr(X, 960 - 260 * u, 290, 520 * u, 10, 5); X.fill();
    vo(ctx, X, t, 'l15', 'فَكَيفَ تَسيرُ الحِصَّة؟', 960, 420, { size: 60, family: 'body', weight: 500, color: P.hi, maxWidth: 1400 });
    // بطاقة الدرس الحقيقية (العنوان كما في الكتاب)
    const ck = ctx.at(t, L(3).s - .05, L(3).s + .5, 'expoOut'); if (ck > 0) { X.save(); X.globalAlpha = ck; X.translate(0, (1 - ck) * 40);
      X.shadowColor = 'rgba(0,0,0,.3)'; X.shadowBlur = 50; X.shadowOffsetY = 20; X.fillStyle = '#fbf6ee'; rr(X, 310, 500, 1300, 230, 30); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = P.hi; rr(X, 1480, 500, 130, 230, 30); X.fill(); X.fillRect(1480, 500, 40, 230); icon(X, 'book', 1545, 615, 60, P.clay, 6);
      ctx.text(X, 'الدَّرس 2.1', 1420, 570, { family: 'body', weight: 600, size: 30, color: P.mut, align: 'right' });
      vo(ctx, X, t, 'l15', 'كَيفَ يُمكِنُني أَن أُصَنِّفَ المَوادّ؟', 1420, 672, { size: 70, align: 'right', color: P.acc, maxWidth: 1080, map: [5, 6, 7, 8, 9] }); X.restore(); }
    // خطّ الحصّة: قبل · أثناء · بعد
    const pk = ctx.at(t, L(9).s, L(9).s + 1, 'expoOut'); if (pk > 0) { const y = 880; X.save(); X.globalAlpha = pk;
      ctx.drawPath(X, [[1500, y], [420, y]], pk, { width: 8, color: 'rgba(251,246,238,.5)' });
      [['قَبل', 1500], ['أَثناء', 960], ['بَعد', 420]].forEach(([n, x], i) => { const kk = ctx.at(t, L(9).s + .2 + i * .25, L(9).s + .6 + i * .25, 'expoOut'); if (kk <= 0) return; X.globalAlpha = pk * kk;
        X.fillStyle = P.hi; X.beginPath(); X.arc(x, y, 18, 0, 6.283); X.fill(); X.fillStyle = P.clay; X.beginPath(); X.arc(x, y, 8, 0, 6.283); X.fill();
        ctx.text(X, n, x, y + 75, { family: 'display', weight: 700, size: 44, color: '#fbf6ee' }); }); X.restore(); }
  } });
