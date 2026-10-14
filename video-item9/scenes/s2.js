import { W, H, paper, vo, Device, chip, icon, blob, textIn } from './_lib.js';
MOTION.scene({ id: 's2',
  setup(ctx) { this.dev = new Device(ctx, 'laptop'); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L9 = i => ctx.wordTime('l9', i), s9 = ctx.lineSpan('l9'), s8 = ctx.lineSpan('l8');
    // الشاشة تتبدّل مع سلّم الكتاب: المادّة ← المستوى ← الوحدة ← الدرس
    let im = ctx.img('home'), sy = 0;
    if (t >= L9(0).s) im = ctx.img('browse'); if (t >= L9(2).s) im = ctx.img('subject'); if (t >= L9(4).s) { im = ctx.img('subjectFull'); sy = 1750; } if (t >= L9(6).s) { im = ctx.img('playTop'); sy = 0; }
    this.dev.setScreen(im, { sy });
    const kIn = ctx.at(lt, 0, 1.3, 'expoOut'), push = ctx.at(t, L9(0).s - .3, L9(0).s + .6, 'expoInOut');
    this.dev.pose({ ry: -34 + 26 * kIn - 6 * push, rx: 10 - 4 * kIn, s: .78 + .1 * kIn + .12 * push, px: -.42, py: .04 + .02 * Math.sin(lt * .8) });
    blob(X, 640, 905, 980, 180, .2 * kIn); this.dev.draw(X);
    // الجملة الثامنة يمين (تتلاشى مع التاسعة)
    vo(ctx, X, t, 'l8', 'مَوقِعٌ يَجمَعُ لِكُلِّ دَرسٍ', 1840, 330, { size: 70, align: 'right', maxWidth: 820, fadeAt: s9.s - 1.0 });
    vo(ctx, X, t, 'l8', 'في الكِتابِ المَدرَسِيِّ القَطَرِيِّ', 1840, 440, { size: 54, align: 'right', family: 'body', weight: 500, maxWidth: 820, map: [4, 5, 6, 7], fadeAt: s9.s - 1.0 });
    vo(ctx, X, t, 'l8', 'أَنشِطَتَهُ التَّفاعُلِيَّة.', 1840, 560, { size: 78, align: 'right', color: P.acc, maxWidth: 820, map: [8, 9], fadeAt: s9.s - 1.0 });
    // سلّم أربع درجات، كل درجة تنزل عند كلمتها
    const steps = [['المادَّة', 0, 'book'], ['المُستَوى', 2, 'chart'], ['الوَحدَة', 4, 'file'], ['الدَّرس', 6, 'target']];
    steps.forEach(([txt, wi, ic], i) => { const s = L9(wi).s - .05; chip(ctx, X, t, { s, x: 1560 - i * 70, y: 260 + i * 150, w: 420, h: 104, text: txt, icon: ic, size: 44, family: 'display', weight: 700, fill: i === 3 ? P.acc : '#fff', color: i === 3 ? '#fbf6ee' : P.ink, iconBg: i === 3 ? 'rgba(255,255,255,.18)' : P.sand, iconColor: i === 3 ? P.hi : P.acc });
      if (i < 3) { const k = ctx.at(t, L9(wi + 1).s - .05, L9(wi + 1).s + .3, 'expoOut'); if (k > 0) { X.save(); X.globalAlpha = k; icon(X, 'arrow-l', 1560 - i * 70 - 250, 335 + i * 150, 40, P.hi, 5); X.restore(); } } });
    vo(ctx, X, t, 'l9', 'بِتَرتيبِ الكِتابِ نَفسِه.', 1800, 900, { size: 56, align: 'right', family: 'body', weight: 600, color: P.mut, maxWidth: 900, map: [7, 8, 9] });
  } });
