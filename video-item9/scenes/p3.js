import { W, H, paper, vo, icon, rr, browser } from './_lib.js';
MOTION.scene({ id: 'p3',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L4 = i => ctx.wordTime('l4', i), L5 = i => ctx.wordTime('l5', i), s5 = ctx.lineSpan('l5');
    const k = ctx.at(lt, .1, .8, 'expoOut'); const off = ctx.at(t, L5(0).s - .1, L5(0).s + .5, 'expoOut');
    // نافذة متصفّح يسار
    X.save(); X.globalAlpha = k; X.translate(0, (1 - k) * 40);
    const c = browser(ctx, X, { x: 120, y: 170, w: 900, h: 720 }, { url: '…' });
    // شريط بحث يكتب كلمة كلمة
    const q = 'وَسيلَة رَقَمِيَّة لِلصَّفِّ الثّالِث'; const tk = ctx.at(t, L4(1).s, L4(5).e, 'linear');
    X.fillStyle = '#fff'; X.strokeStyle = P.sand; X.lineWidth = 3; rr(X, c.x + 60, c.y + 40, c.w - 120, 74, 37); X.fill(); X.stroke();
    icon(X, 'lens', c.x + c.w - 100, c.y + 77, 34, P.mut, 4);
    ctx.text(X, ctx.text.typeSub(q, tk), c.x + c.w - 140, c.y + 92, { family: 'body', weight: 500, size: 32, color: P.ink, align: 'right' });
    // نتائج رمادية تتوالى، وكل نتيجة تحمل ختمًا أحمر
    const stamps = [['بِلُغَةٍ أُخرى', L4(8).s], ['لِصَفٍّ آخَر', L4(11).s], ['بِلُغَةٍ أُخرى', L4(8).s + .35], ['لِصَفٍّ آخَر', L4(11).s + .35]];
    for (let i = 0; i < 4; i++) { const s = L4(6).s + i * .22, kk = ctx.at(t, s, s + .4, 'expoOut'); if (kk <= 0) continue; const y = c.y + 150 + i * 128;
      X.save(); X.globalAlpha = kk; X.translate((1 - kk) * -60, 0); X.fillStyle = '#fbf6ee'; rr(X, c.x + 60, y, c.w - 120, 104, 16); X.fill();
      X.fillStyle = P.sand; rr(X, c.x + c.w - 100 - 460, y + 24, 460, 20, 10); X.fill(); rr(X, c.x + c.w - 100 - 300, y + 60, 300, 16, 8); X.fill();
      X.fillStyle = '#e6d9c3'; rr(X, c.x + 80, y + 18, 70, 70, 12); X.fill(); X.restore();
      const [txt, ss] = stamps[i], sk = ctx.at(t, ss, ss + .25, 'expoOut'); if (sk > 0) { X.save(); X.globalAlpha = sk; X.translate(c.x + 330, y + 52); X.rotate(-.12); X.scale(1.25 - .25 * sk, 1.25 - .25 * sk);
        X.strokeStyle = P.acc; X.lineWidth = 4; rr(X, -120, -26, 240, 52, 10); X.stroke(); ctx.text(X, txt, 0, 11, { family: 'display', weight: 700, size: 30, color: P.acc }); X.restore(); } }
    X.restore();
    // عند «لا يتوفّر»: الشاشة تخفت ويظهر واي فاي مقطوع
    if (off > 0) { X.save(); X.globalAlpha = off * .82; X.fillStyle = P.bg; rr(X, 120, 224, 900, 666, 0); X.fill(); X.restore();
      X.save(); X.globalAlpha = off; X.translate(570, 560); X.scale(.9 + .1 * off, .9 + .1 * off); icon(X, 'wifi-off', 0, 0, 260, P.acc, 20); X.restore(); }
    // الساعة تدور عند «ساعاتٍ»
    const ck = ctx.at(t, L4(2).s - .05, L4(2).s + .4, 'expoOut'); if (ck > 0) { X.save(); X.globalAlpha = ck * (1 - off); X.translate(1500, 300); const r = 95;
      X.fillStyle = '#fff'; X.beginPath(); X.arc(0, 0, r, 0, 6.283); X.fill(); X.strokeStyle = P.acc; X.lineWidth = 8; X.stroke();
      const a = (t - L4(2).s) * 5; X.strokeStyle = P.ink; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(a) * r * .62, -Math.cos(a) * r * .62); X.stroke();
      X.strokeStyle = P.hi; X.lineWidth = 6; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(a / 12) * r * .42, -Math.cos(a / 12) * r * .42); X.stroke(); X.restore(); }
    // النص يمين
    vo(ctx, X, t, 'l4', 'وَالمُعَلِّمُ يَبحَثُ ساعاتٍ', 1800, 470, { size: 74, align: 'right', maxWidth: 700, fadeAt: L5(0).s - .7 });
    vo(ctx, X, t, 'l4', 'عَن وَسيلَةٍ رَقَمِيَّةٍ، فَيَجِدُ مُحتَوًى', 1800, 580, { size: 46, align: 'right', family: 'body', weight: 500, maxWidth: 1000, map: [3, 4, 5, 6, 7], fadeAt: L5(0).s - .7 });
    vo(ctx, X, t, 'l4', 'بِلُغَةٍ أُخرى، أَو لِصَفٍّ آخَر.', 1800, 680, { size: 60, align: 'right', color: P.acc, maxWidth: 1000, map: [8, 9, 10, 11, 12], fadeAt: L5(0).s - .7 });
    vo(ctx, X, t, 'l5', 'وَالإِنتَرنِت', 1800, 480, { size: 96, align: 'right', color: P.acc, maxWidth: 700 });
    vo(ctx, X, t, 'l5', 'لا يَتَوَفَّرُ في كُلِّ حِصَّة.', 1800, 610, { size: 64, align: 'right', maxWidth: 1000, map: [1, 2, 3, 4, 5] });
  } });
