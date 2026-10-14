import { W, H, paper, vo, icon, rr, pic, chip } from './_lib.js';
MOTION.scene({ id: 's6',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l14', i);
    // ملفّ واحد يحمل الشعار (كلمة «ملفّ»)، ثم سهم تحميل، ثم ثلاثة أجهزة، ثم واي فاي مقطوع
    const fk = ctx.at(t, L(2).s - .05, L(2).s + .5, 'expoOut'), dk = ctx.at(t, L(4).s - .05, L(4).s + .5, 'expoOut'), gk = ctx.at(t, L(9).s - .1, L(9).s + .7, 'expoOut'), wk = ctx.at(t, L(10).s, L(10).s + .5, 'expoOut');
    const fx = 1420 - gk * 0, fy = 560 - gk * 250, fs = 1 - gk * .55;
    if (fk > 0) { X.save(); X.globalAlpha = fk; X.translate(fx, fy); X.scale(fs * (.94 + .06 * fk), fs * (.94 + .06 * fk));
      X.shadowColor = 'rgba(35,26,23,.2)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.fillStyle = '#fff'; X.beginPath(); X.moveTo(-150, -200); X.lineTo(70, -200); X.lineTo(150, -120); X.lineTo(150, 200); X.lineTo(-150, 200); X.closePath(); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = P.sand; X.beginPath(); X.moveTo(70, -200); X.lineTo(70, -120); X.lineTo(150, -120); X.closePath(); X.fill();
      X.drawImage(ctx.img('logo'), -70, -90, 140, 140); ctx.text(X, '.html', 0, 130, { family: 'num', weight: 700, size: 40, color: P.acc, dir: 'ltr' }); X.restore(); }
    if (dk > 0) { X.save(); X.globalAlpha = dk * (1 - gk); X.translate(0, (1 - dk) * -20); icon(X, 'download', 1120, 560, 150, P.teal, 14); X.restore(); }
    // الأجهزة: كمبيوتر · جهاز لوحي · هاتف — بلقطات حقيقية
    if (gk > 0) { const devs = [[1400, 640, 560, 350, 'playTop', 'لابتوب'], [860, 640, 330, 420, 'mObj', 'جهاز لوحي'], [460, 660, 190, 400, 'mPlay', 'هاتف']];
      devs.forEach(([cx, cy, w, h, imn, lab], i) => { const k = ctx.at(t, L(9).s - .1 + i * .12, L(9).s + .5 + i * .12, 'expoOut'); if (k <= 0) return;
        X.save(); X.globalAlpha = k; X.translate(0, (1 - k) * 40); X.shadowColor = 'rgba(35,26,23,.22)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.fillStyle = '#17161a'; rr(X, cx - w / 2 - 14, cy - h / 2 - 14, w + 28, h + 28, i === 0 ? 18 : 34); X.fill(); X.shadowColor = 'transparent';
        pic(X, ctx.img(imn), { x: cx - w / 2, y: cy - h / 2, w, h }, { mode: 'top', r: i === 0 ? 8 : 22 });
        if (i === 0) { X.fillStyle = '#b9bbc0'; rr(X, cx - w / 2 - 90, cy + h / 2 + 14, w + 180, 18, 9); X.fill(); }
        X.restore(); }); }
    if (wk > 0) { X.save(); X.globalAlpha = wk; X.translate(1740, 300); X.scale(.9 + .1 * wk, .9 + .1 * wk); X.fillStyle = '#fff'; X.beginPath(); X.arc(0, 0, 90, 0, 6.283); X.fill(); icon(X, 'wifi-off', 0, 0, 110, P.acc, 10); X.restore(); }
    vo(ctx, X, t, 'l14', 'وَكُلُّ نَشاطٍ مِلَفٌّ واحِدٌ، يُحَمَّلُ مَرَّةً،', 960, 150, { size: 64, maxWidth: 1700, emph: [2, 3] });
    vo(ctx, X, t, 'l14', 'وَيَعمَلُ عَلى أَيِّ جِهازٍ دونَ إِنتَرنِت.', 960, 980, { size: 64, maxWidth: 1700, map: [6, 7, 8, 9, 10, 11], emph: [4, 5], emphColor: P.acc });
  } });
