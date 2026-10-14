import { W, H, paper, vo, Device, chip, blob, icon } from './_lib.js';
MOTION.scene({ id: 'a7',
  setup(ctx) { this.dev = new Device(ctx, 'phone'); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l22', i), sp = ctx.lineSpan('l22');
    const sc = ctx.at(t, L(2).s, sp.e + .8, 'quadInOut'); this.dev.setScreen(ctx.img('mPlay'), { sy: Math.round(sc * 1300 / 40) * 40 });
    const kIn = ctx.at(lt, 0, 1.2, 'expoOut');
    this.dev.pose({ ry: -28 + 20 * kIn + Math.sin(lt * .7) * 3, rx: 6, rz: -4 + 4 * kIn, s: .92 + .08 * kIn, px: .38, py: -.06 });
    blob(X, 1330, 960, 700, 130, .2 * kIn); this.dev.draw(X);
    vo(ctx, X, t, 'l22', 'وَفي البَيتِ:', 160, 330, { size: 86, align: 'left', color: P.acc, maxWidth: 800 });
    vo(ctx, X, t, 'l22', 'النَّشاطُ نَفسُهُ عَلى هاتِفِ وَلِيِّ الأَمرِ،', 160, 470, { size: 50, align: 'left', family: 'body', weight: 500, maxWidth: 820, map: [2, 3, 4, 5, 6, 7] });
    vo(ctx, X, t, 'l22', 'دونَ اتِّصال.', 160, 610, { size: 80, align: 'left', maxWidth: 800, map: [8, 9] });
    const hk = ctx.at(t, L(1).s - .05, L(1).s + .5, 'expoOut'); if (hk > 0) { X.save(); X.globalAlpha = hk; X.fillStyle = '#fff'; X.beginPath(); X.arc(300, 800, 90, 0, 6.283); X.fill(); icon(X, 'home', 300, 800, 100, P.teal, 10); X.restore(); }
    const wk = ctx.at(t, L(8).s - .05, L(8).s + .5, 'expoOut'); if (wk > 0) { X.save(); X.globalAlpha = wk; X.fillStyle = '#fff'; X.beginPath(); X.arc(520, 800, 90, 0, 6.283); X.fill(); icon(X, 'wifi-off', 520, 800, 100, P.acc, 10); X.restore(); }
  } });
