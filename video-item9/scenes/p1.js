import { W, H, maroon, vo, icon, sadu } from './_lib.js';
MOTION.scene({ id: 'p1',
  setup(ctx) { this.dots = ctx.particles2D({ count: 70, seed: 11, spawn: (i, r) => { const a = r() * 6.283, d = r.range(20, 150); return { x: 1520 + Math.cos(a) * d, y: 540 + Math.sin(a) * d * .9, vx: r.gauss() * 6, vy: r.gauss() * 6, r: r.range(2, 5), color: ctx.P.hi, delay: r.range(0, .6), life: 1.6 }; } }); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; maroon(ctx, X);
    const w1 = ctx.wordTime('l1', 0), w2 = ctx.wordTime('l1', 2), s2 = ctx.lineSpan('l2');
    // العدسة: تتحرّك بحثًا، ثم تثبت، والنقاط تتلاشى عند «لا تُرى»
    const kIn = ctx.at(lt, .05, .9, 'expoOut'), seek = 1 - ctx.at(t, w2.s, w2.s + .6);
    const lx = 1520 + ctx.noise1(t * .35, 3) * 80 * seek, ly = 540 + ctx.noise1(t * .4, 7) * 60 * seek;
    X.save(); X.globalAlpha = kIn; X.translate(lx, ly); X.scale(.9 + .1 * kIn, .9 + .1 * kIn); X.translate(-lx, -ly);
    X.fillStyle = 'rgba(255,255,255,.07)'; X.beginPath(); X.arc(lx - 30, ly - 30, 150, 0, 6.283); X.fill();
    icon(X, 'lens', lx, ly, 440, P.hi, 22); X.restore();
    const fade = 1 - ctx.at(t, w2.s + .25, w2.s + 1.1); if (fade > 0) { X.save(); X.globalAlpha = fade * .9; this.dots.draw(X, Math.max(0, t - w1.s)); X.restore(); }
    // الجملة الأولى كبيرة يمين
    vo(ctx, X, t, 'l1', 'الجَراثيمُ لا تُرى.', 1080, 520, { size: 140, color: '#fbf6ee', align: 'right', emph: [2], emphColor: P.hi, maxWidth: 1100 });
    // الجملة الثانية: سطران + أيقونتان عند كلمتيهما
    vo(ctx, X, t, 'l2', 'وَالعَضَلاتُ تَعمَلُ داخِلَ الجِسمِ،', 1080, 690, { size: 60, color: '#fbf6ee', align: 'right', family: 'body', weight: 500, maxWidth: 1100 });
    vo(ctx, X, t, 'l2', 'وَخَصائِصُ المَوادِّ تَحتاجُ اختِبارًا بِاليَدِ.', 1080, 800, { size: 60, color: '#fbf6ee', align: 'right', family: 'body', weight: 500, maxWidth: 1100, map: [4, 5, 6, 7, 8] });
    const m = ctx.at(t, ctx.wordTime('l2', 0).s, ctx.wordTime('l2', 0).s + .5, 'expoOut'), d = ctx.at(t, ctx.wordTime('l2', 5).s, ctx.wordTime('l2', 5).s + .5, 'expoOut');
    if (m > 0) { X.save(); X.globalAlpha = m; icon(X, 'muscle', 1180 + (1 - m) * 40, 665, 90, P.hi, 9); X.restore(); }
    if (d > 0) { X.save(); X.globalAlpha = d; icon(X, 'drop', 1180 + (1 - d) * 40, 775, 80, P.hi, 9); X.restore(); }
    sadu(ctx, X, 0, kIn, true); sadu(ctx, X, H - 22, kIn, true);
  } });
