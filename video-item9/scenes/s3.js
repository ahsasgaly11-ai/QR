import { W, H, paper, vo, icon, rr, counter, textIn } from './_lib.js';
MOTION.scene({ id: 's3',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l10', i), M = i => ctx.wordTime('l11', i), s11 = ctx.lineSpan('l11');
    const cards = [['تَجرِبَةٌ عَمَلِيَّة', 'يُجَرِّبُ الطّالِبُ بِيَدِهِ وَيَرى النَّتيجَة', 0, 'flask', P.acc], ['مُحاكاةٌ تَفاعُلِيَّة', 'ظَواهِرُ يَصعُبُ رُؤيَتُها في الصَّفّ', 5, 'atom', P.teal], ['أَسئِلَةٌ وَتَقويم', 'أَسئِلَةٌ قَصيرَةٌ تُظهِرُ ما فُهِم', 10, 'check', P.gold2], ['لُعبَةٌ تَعليمِيَّة', 'تَحَدِّياتٌ وَمَراحِلُ تُعَزِّزُ الدَّرس', 13, 'game', P.clay]];
    const up = ctx.at(t, s11.s - .4, s11.s + .4, 'expoInOut');         // البطاقات تصعد وتصغر لتفسح للأرقام
    const cw = 400, ch = 440, gap = 40, total = 4 * cw + 3 * gap, x0 = (W + total) / 2;
    cards.forEach(([h1, h2, wi, ic, col], i) => { const k = ctx.at(t, L(wi).s - .08, L(wi).s + .45, 'expoOut'); if (k <= 0) return;
      const cx = x0 - i * (cw + gap) - cw / 2, cy = 560 - up * 300, sc = (0.94 + .06 * k) * (1 - up * .45);
      X.save(); X.globalAlpha = k; X.translate(cx, cy); X.scale(sc, sc); X.translate(-cx, -cy); X.translate(0, (1 - k) * 40);
      X.shadowColor = 'rgba(35,26,23,.16)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.fillStyle = '#fff'; rr(X, cx - cw / 2, cy - ch / 2, cw, ch, 28); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = col; rr(X, cx - cw / 2, cy - ch / 2, cw, 14, 7); X.fill();
      X.fillStyle = P.sand; X.beginPath(); X.arc(cx, cy - 90, 78, 0, 6.283); X.fill(); icon(X, ic, cx, cy - 90, 84, col, 8);
      ctx.text(X, h1, cx, cy + 50, { family: 'display', weight: 700, size: 42, color: P.ink, maxWidth: cw - 40 });
      ctx.text(X, h2, cx, cy + 110, { family: 'body', weight: 500, size: 24, color: P.mut, maxWidth: cw - 50 });
      X.restore(); });
    vo(ctx, X, t, 'l10', 'أَربَعُ طُرُقٍ لِتَعَلُّمِ الدَّرسِ نَفسِه', 960, 200, { size: 64, maxWidth: 1600, fadeAt: s11.s - .4, map: [0, 1, 2, 3, 4, 5] });
    // الأرقام: 47 · 24 · 3 بأرقام ثابتة العرض
    const nums = [[47, 'نَشاطًا مَنشورًا', 0], [24, 'دَرسًا', 5], [3, 'وَحَدات', 9]];
    nums.forEach(([n, lab, wi], i) => { const s = M(wi).s - .05, k = ctx.at(t, s, s + .4, 'expoOut'); if (k <= 0) return; const cx = 1440 - i * 480, cy = 640;
      X.save(); X.globalAlpha = k; X.translate(0, (1 - k) * 30);
      X.fillStyle = '#fff'; X.shadowColor = 'rgba(35,26,23,.14)'; X.shadowBlur = 40; X.shadowOffsetY = 14; rr(X, cx - 200, cy - 150, 400, 330, 30); X.fill(); X.shadowColor = 'transparent';
      counter(ctx, X, t, { s, to: n, x: cx, y: cy + 40, size: 170, color: P.acc, keep: true });
      ctx.text(X, lab, cx, cy + 135, { family: 'display', weight: 700, size: 40, color: P.ink }); X.restore(); });
  } });
