import { W, H, paper, vo, Device, blob, chip } from './_lib.js';
MOTION.scene({ id: 's4',
  setup(ctx) { this.dev = new Device(ctx, 'laptop'); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l12', i);
    const sw = t >= L(7).s; this.dev.setScreen(sw ? ctx.img('game3d') : ctx.img('playGame'), { fill: '#1b2330' });
    const kIn = ctx.at(lt, 0, 1.2, 'expoOut'), z = ctx.at(t, L(3).s - .2, L(3).s + .9, 'expoInOut') * (1 - ctx.at(t, L(7).s - .4, L(7).s + .5, 'expoInOut'));
    this.dev.pose({ ry: 18 - 14 * kIn - 6 * z, rx: 8 - 2 * z, s: .76 + .04 * kIn + .38 * z, fx: .4, fy: .58, px: 0, py: .02 + .02 * z });
    blob(X, 960, 940, 1200, 200, .22 * kIn); this.dev.draw(X);
    vo(ctx, X, t, 'l12', 'مُختَبَراتٌ ثُلاثِيَّةُ الأَبعاد', 960, 112, { size: 68, color: P.acc, maxWidth: 1600 });
    X.save(); X.globalAlpha = .9; X.fillStyle = P.bg; X.fillRect(0, 960, W, 120); X.restore();
    vo(ctx, X, t, 'l12', 'يُجَرِّبُ فيها الطّالِبُ بِيَدِهِ، وَيَرى النَّتيجَةَ كَما في المُختَبَرِ الحَقيقِيّ.', 960, 1032, { size: 42, family: 'body', weight: 500, maxWidth: 1700, map: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
  } });
