import { W, H, paper, vo, Device, chip, icon, blob } from './_lib.js'; import { strip } from './_strip.js';
MOTION.scene({ id: 'a2',
  setup(ctx) { this.dev = new Device(ctx, 'laptop'); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l16', i);
    let im = ctx.img('subjectFull'), sy = 1750; if (t >= L(5).s) { im = ctx.img('playObj'); sy = 0; } this.dev.setScreen(im, { sy });
    const kIn = ctx.at(lt, 0, 1.2, 'expoOut'), z = ctx.at(t, L(5).s - .2, L(5).s + .8, 'expoInOut');
    this.dev.pose({ ry: -30 + 20 * kIn, rx: 9 - 3 * z, s: .62 + .04 * kIn + .14 * z, fx: .55, fy: .42, px: -.56, py: -.04 });
    blob(X, 660, 905, 1000, 180, .2 * kIn); this.dev.draw(X);
    chip(ctx, X, t, { s: ctx.scene.start + .1, x: 1560, y: 170, w: 460, h: 96, text: '1 · قَبلَ الحِصَّة', icon: 'clock', size: 40, family: 'display', fill: P.acc, color: '#fbf6ee', iconBg: 'rgba(255,255,255,.18)', iconColor: P.hi });
    vo(ctx, X, t, 'l16', 'يَفتَحُ المُعَلِّمُ الدَّرسَ،', 1800, 340, { size: 60, align: 'right', maxWidth: 800, map: [2, 3, 4] });
    vo(ctx, X, t, 'l16', 'يَقرَأُ الهَدَفَ،', 1800, 450, { size: 60, align: 'right', color: P.acc, maxWidth: 800, map: [5, 6] });
    vo(ctx, X, t, 'l16', 'وَيُحَمِّلُ النَّشاطَ إِن كانَتِ الشَّبَكَةُ غَيرَ مَضمونَة.', 1800, 560, { size: 44, align: 'right', family: 'body', weight: 500, maxWidth: 820, map: [7, 8, 9, 10, 11, 12, 13] });
    const dk = ctx.at(t, L(7).s - .05, L(7).s + .5, 'expoOut'); if (dk > 0) { X.save(); X.globalAlpha = dk; X.translate(1620, 820); X.scale(.9 + .1 * dk, .9 + .1 * dk); X.fillStyle = '#fff'; X.shadowColor = 'rgba(35,26,23,.18)'; X.shadowBlur = 30; X.shadowOffsetY = 12; X.beginPath(); X.arc(0, 0, 80, 0, 6.283); X.fill(); X.shadowColor = 'transparent'; icon(X, 'download', 0, 0, 90, P.teal, 9); X.restore();
      const wk = ctx.at(t, L(11).s - .05, L(11).s + .4, 'expoOut'); if (wk > 0) { X.save(); X.globalAlpha = wk; X.fillStyle = '#fff'; X.beginPath(); X.arc(1420, 820, 60, 0, 6.283); X.fill(); icon(X, 'wifi-off', 1420, 820, 64, P.acc, 7); X.restore(); } }
    strip(ctx, X, t, 0, ctx.scene.start + .3);
  } });
