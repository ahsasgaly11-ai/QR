import { W, H, paper, vo, pic, spot, chip, rr } from './_lib.js';
MOTION.scene({ id: 's5',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l13', i), im = ctx.img('playObj');
    // بطاقة الهدف التعليمي الحقيقية من صفحة النشاط (قصّ من اللقطة) — تدخل من تحت
    const crop = { x: 58, y: 250, w: 2764, h: 910 }, dw = 1640, dh = dw * crop.h / crop.w, dx = (W - dw) / 2, dy = 300 - dh / 2 + 290;
    const kIn = ctx.at(lt, 0, 1, 'expoOut'); X.save(); X.globalAlpha = kIn; X.translate(0, (1 - kIn) * 60);
    X.shadowColor = 'rgba(35,26,23,.22)'; X.shadowBlur = 60; X.shadowOffsetY = 24; X.fillStyle = '#fff'; rr(X, dx, dy, dw, dh, 28); X.fill(); X.shadowColor = 'transparent';
    pic(X, im, { x: dx, y: dy, w: dw, h: dh }, { crop, r: 28 }); X.restore();
    const S = dw / crop.w, box = (x, y, w, h) => ({ x: dx + (x - crop.x) * S, y: dy + (y - crop.y) * S, w: w * S, h: h * S });
    // التظليل يتنقّل مع الكلام: الهدف ← النواتج ← الموضع ← المدّة
    const marks = [[3, box(90, 430, 2700, 140), 'الهَدَفُ التَّعليمِيّ', 1500, 1000], [5, box(1770, 590, 1020, 290), 'نَواتِجُ التَّعَلُّم', 1500, 1000], [7, box(316, 272, 250, 95), 'مَوضِعُهُ في الدَّرس', 420, 1000], [10, box(92, 272, 215, 95), 'مُدَّتُه', 420, 1000]];
    let cur = -1; marks.forEach((m, i) => { if (t >= L(m[0]).s - .05) cur = i; });
    if (cur >= 0) { const m = marks[cur]; spot(ctx, X, t, m[1], L(m[0]).s - .05, { dimA: .3 }); chip(ctx, X, t, { s: L(m[0]).s, x: m[3], y: m[4], w: 360, h: 80, text: m[2], size: 34, family: 'display', fill: P.acc, color: '#fbf6ee' }); }
    vo(ctx, X, t, 'l13', 'وَكُلُّ نَشاطٍ يَحمِلُ هَدَفَهُ التَّعليمِيَّ، وَنَواتِجَ تَعَلُّمِهِ، وَمَوضِعَهُ في الدَّرسِ، وَمُدَّتَه.', 960, 120, { size: 50, maxWidth: 1760, emph: [3, 4, 5, 6, 7, 8, 9, 10] });
  } });
