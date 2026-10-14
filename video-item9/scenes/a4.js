import { W, H, paper, vo, pic, rr, chip, icon } from './_lib.js'; import { strip } from './_strip.js';
MOTION.scene({ id: 'a4',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l19', i);
    let im = ctx.img('ticket'); if (t >= L(6).s) im = ctx.img('ticketChosen'); if (t >= L(8).s) im = ctx.img('ticketDone');
    const crop = { x: 58, y: 245, w: 2764, h: 1000 }, dw = 1180, dh = dw * crop.h / crop.w, dx = 100, dy = 190;
    const kIn = ctx.at(lt, 0, 1, 'expoOut'); X.save(); X.globalAlpha = kIn; X.translate(0, (1 - kIn) * 50);
    X.shadowColor = 'rgba(35,26,23,.22)'; X.shadowBlur = 60; X.shadowOffsetY = 24; X.fillStyle = '#fff'; rr(X, dx, dy, dw, dh, 26); X.fill(); X.shadowColor = 'transparent'; pic(X, im, { x: dx, y: dy, w: dw, h: dh }, { crop, r: 26 }); X.restore();
    // وميض خفيف عند تبدّل الحالة
    [L(6).s, L(8).s].forEach(s => { const f = 1 - ctx.at(t, s, s + .35); if (t >= s && f > 0) { X.save(); X.globalAlpha = f * .5; X.fillStyle = '#fff'; rr(X, dx, dy, dw, dh, 26); X.fill(); X.restore(); } });
    chip(ctx, X, t, { s: ctx.scene.start + .1, x: 1600, y: 170, w: 460, h: 96, text: '3 · بَعدَ النَّشاط', icon: 'check', size: 40, family: 'display', fill: P.acc, color: '#fbf6ee', iconBg: 'rgba(255,255,255,.18)', iconColor: P.hi });
    vo(ctx, X, t, 'l19', 'تَذكِرَةُ خُروجٍ مِن سُؤالَين،', 1840, 320, { size: 54, align: 'right', maxWidth: 560, map: [2, 3, 4, 5] });
    vo(ctx, X, t, 'l19', 'يُجيبُ الطّالِبُ', 1840, 440, { size: 54, align: 'right', maxWidth: 560, map: [6, 7] });
    vo(ctx, X, t, 'l19', 'وَيَرى الصَّوابَ فَورًا،', 1840, 560, { size: 54, align: 'right', color: P.teal, maxWidth: 560, map: [8, 9, 10] });
    chip(ctx, X, t, { s: L(11).s - .05, x: 1600, y: 700, w: 480, h: 100, text: 'بِلا اسمٍ وَلا حِساب', icon: 'users', size: 40, family: 'display', fill: '#fff', stroke: P.hi });
    strip(ctx, X, t, 2, ctx.scene.start + .3);
  } });
