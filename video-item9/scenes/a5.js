import { W, H, paper, vo, Device, chip, blob } from './_lib.js';
MOTION.scene({ id: 'a5',
  setup(ctx) { this.dev = new Device(ctx, 'laptop'); },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l20', i); this.dev.setScreen(ctx.img('dash'));
    const kIn = ctx.at(lt, 0, 1.2, 'expoOut'), z = ctx.at(t, L(6).s - .3, L(6).s + .8, 'expoInOut'), z2 = ctx.at(t, L(10).s - .2, L(10).s + .6, 'expoInOut');
    this.dev.pose({ ry: 28 - 20 * kIn - 4 * z, rx: 9 - 3 * z, s: .64 + .05 * kIn + .28 * z, fx: ctx.lerp(.86, .45, z2), fy: ctx.lerp(.36, .42, z2), px: .52, py: -.04 });
    blob(X, 1240, 905, 1000, 180, .2 * kIn); this.dev.draw(X);
    vo(ctx, X, t, 'l20', 'وَتَظهَرُ النَّتيجَةُ لِلمُعَلِّم', 120, 300, { size: 58, align: 'left', maxWidth: 760, map: [0, 1, 2] });
    vo(ctx, X, t, 'l20', 'في لَوحَةِ الإِحصاءات:', 120, 410, { size: 58, align: 'left', color: P.acc, maxWidth: 760, map: [3, 4, 5] });
    vo(ctx, X, t, 'l20', 'نِسبَةُ الإِتقان', 120, 560, { size: 92, align: 'left', color: P.teal, maxWidth: 760, map: [6, 7] });
    chip(ctx, X, t, { s: L(8).s - .05, x: 330, y: 690, w: 400, h: 92, text: 'لِكُلِّ نَشاط', icon: 'flask', size: 40, family: 'display' });
    chip(ctx, X, t, { s: L(10).s - .05, x: 330, y: 810, w: 400, h: 92, text: 'وَلِكُلِّ دَرس', icon: 'book', size: 40, family: 'display' });
  } });
