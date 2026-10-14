import { W, H, paper, vo, icon, rr } from './_lib.js';
MOTION.scene({ id: 'a6',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l21', i);
    vo(ctx, X, t, 'l21', 'وَالفُروقُ الفَردِيَّة؟', 960, 170, { size: 90, color: P.acc, maxWidth: 1600 });
    const cards = [['إِعادَةٌ بِلا حَدّ', 'لِمَن يَحتاجُ وَقتًا أَطوَل', 2, 'loop', P.teal], ['أَلعابُ تَعزيز', 'لِلمُتَفَوِّقينَ بَعدَ الإِتقان', 7, 'star', P.gold2], ['لُغَةُ الإِشارَةِ القَطَرِيَّة', 'رَفيقٌ لِلصُّمِّ في كُلِّ نَشاط', 10, 'hand', P.acc]];
    const cw = 500, ch = 520, gap = 60, x0 = (W + 3 * cw + 2 * gap) / 2;
    cards.forEach(([h1, h2, wi, ic, col], i) => { const k = ctx.at(t, L(wi).s - .08, L(wi).s + .5, 'expoOut'); if (k <= 0) return; const cx = x0 - i * (cw + gap) - cw / 2, cy = 600;
      X.save(); X.globalAlpha = k; X.translate(cx, cy); X.scale(.94 + .06 * k, .94 + .06 * k); X.translate(-cx, -cy); X.translate(0, (1 - k) * 40);
      X.shadowColor = 'rgba(35,26,23,.16)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.fillStyle = '#fff'; rr(X, cx - cw / 2, cy - ch / 2, cw, ch, 32); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = col; rr(X, cx - cw / 2, cy - ch / 2, cw, 16, 8); X.fill();
      X.fillStyle = P.sand; X.beginPath(); X.arc(cx, cy - 110, 100, 0, 6.283); X.fill(); icon(X, ic, cx, cy - 110, 110, col, 10);
      ctx.text(X, h1, cx, cy + 70, { family: 'display', weight: 700, size: 46, color: P.ink, maxWidth: cw - 40 });
      ctx.text(X, h2, cx, cy + 140, { family: 'body', weight: 500, size: 28, color: P.mut, maxWidth: cw - 50 }); X.restore(); });
  } });
