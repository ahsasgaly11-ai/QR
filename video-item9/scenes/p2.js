import { W, H, paper, vo, icon, rr } from './_lib.js';
MOTION.scene({ id: 'p2',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const k = ctx.at(lt, .1, .9, 'expoOut'), w5 = ctx.wordTime('l3', 5), w7 = ctx.wordTime('l3', 7);
    // الكتاب المدرسي: صفحة مفتوحة يسار، مفاهيمها تطير وتتبخّر
    const bx = 330, by = 540, bw = 520, bh = 640; X.save(); X.globalAlpha = k; X.translate(0, (1 - k) * 40);
    X.shadowColor = 'rgba(35,26,23,.22)'; X.shadowBlur = 50; X.shadowOffsetY = 20; X.fillStyle = '#fffdf8'; rr(X, bx - bw / 2, by - bh / 2, bw, bh, 22); X.fill(); X.shadowColor = 'transparent';
    X.fillStyle = P.acc; rr(X, bx - bw / 2, by - bh / 2, bw, 74, 22); X.fill(); X.fillRect(bx - bw / 2, by - bh / 2 + 40, bw, 34);
    ctx.text(X, 'العُلومُ · الصَّفُّ الثّالِثُ', bx, by - bh / 2 + 50, { family: 'display', weight: 700, size: 30, color: '#fbf6ee' });
    for (let i = 0; i < 9; i++) { X.fillStyle = i % 3 === 0 ? P.sand : '#eee4d2'; rr(X, bx - bw / 2 + 40 + (i % 3 === 0 ? 0 : 60), by - bh / 2 + 120 + i * 54, bw - 80 - (i % 3 === 0 ? 0 : 60), 22, 11); X.fill(); }
    X.restore();
    // ثلاث كلمات تطلع من الكتاب وتتلاشى (مجرّدة)
    const ghosts = ['الجَراثيم', 'العَضَلات', 'المَوادّ']; ghosts.forEach((g, i) => { const s = w5.s - .6 + i * .35, kk = ctx.at(t, s, s + 2.2, 'quadOut'); if (kk <= 0 || kk >= 1) return;
      X.save(); X.globalAlpha = Math.sin(kk * Math.PI) * .8; X.filter = `blur(${kk * 10}px)`; ctx.text(X, g, bx + (i - 1) * 150, by - 380 - kk * 260, { family: 'display', weight: 700, size: 46 + kk * 30, color: P.acc }); X.restore(); });
    vo(ctx, X, t, 'l3', 'مَفاهيمُ العُلومِ في الصَّفِّ الثّالِثِ', 1680, 430, { size: 66, align: 'right', maxWidth: 1300 });
    vo(ctx, X, t, 'l3', 'مُجَرَّدَةٌ', 1680, 600, { size: 150, align: 'right', color: P.acc, map: [5] });
    vo(ctx, X, t, 'l3', 'عَلى طِفلٍ في الثّامِنَة.', 1680, 740, { size: 66, align: 'right', map: [6, 7, 8, 9], family: 'body', weight: 500, maxWidth: 1300 });
    // خطّ ذهبي يتمدّد تحت «مجرّدة»
    const u = ctx.at(t, w5.s + .1, w5.s + .7, 'expoOut'); if (u > 0) { X.fillStyle = P.hi; rr(X, 1680 - 520 * u, 625, 520 * u, 10, 5); X.fill(); }
  } });
