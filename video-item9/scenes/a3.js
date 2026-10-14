import { W, H, paper, vo, pic, rr, chip, icon, ring } from './_lib.js'; import { strip } from './_strip.js';
MOTION.scene({ id: 'a3',
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l17', i), M = i => ctx.wordTime('l18', i), im = ctx.img('playGame');
    // سبّورة ذكية: إطار داكن + حامل، واللقطة الحقيقية داخلها؛ ثم زوم على الإسفنج ثم على المقياس
    const kIn = ctx.at(lt, 0, 1, 'expoOut'), bx = 120, by = 150, bw = 1240, bh = 1240 * im.naturalHeight / im.naturalWidth;
    const z1 = ctx.at(t, M(4).s - .3, M(4).s + .7, 'expoInOut'), z2 = ctx.at(t, M(8).s - .3, M(8).s + .7, 'expoInOut');
    const scale = 1 + 1.1 * z1, cx = ctx.lerp(ctx.lerp(.5, .42, z1), .12, z2), cy = ctx.lerp(ctx.lerp(.5, .5, z1), .28, z2);
    const cw = im.naturalWidth / scale, ch = im.naturalHeight / scale, crop = { x: ctx.clamp(cx * im.naturalWidth - cw / 2, 0, im.naturalWidth - cw), y: ctx.clamp(cy * im.naturalHeight - ch / 2, 0, im.naturalHeight - ch), w: cw, h: ch };
    X.save(); X.globalAlpha = kIn; X.translate(0, (1 - kIn) * 50);
    X.shadowColor = 'rgba(35,26,23,.3)'; X.shadowBlur = 60; X.shadowOffsetY = 26; X.fillStyle = '#2a2a2e'; rr(X, bx - 26, by - 26, bw + 52, bh + 52, 22); X.fill(); X.shadowColor = 'transparent';
    X.fillStyle = '#b9bbc0'; rr(X, bx + bw / 2 - 260, by + bh + 26, 520, 30, 8); X.fill(); X.fillStyle = '#8f9196'; rr(X, bx + bw / 2 - 30, by + bh + 56, 60, 100, 6); X.fill();
    pic(X, im, { x: bx, y: by, w: bw, h: bh }, { crop, r: 10 }); X.restore();
    // فقاعة التنبّؤ
    const pk = ctx.at(t, L(6).s - .05, L(6).s + .45, 'expoOut') * (1 - ctx.at(t, M(0).s, M(0).s + .3)); if (pk > 0) { X.save(); X.globalAlpha = pk; X.translate(0, (1 - pk) * 20);
      X.shadowColor = 'rgba(35,26,23,.2)'; X.shadowBlur = 30; X.shadowOffsetY = 12; X.fillStyle = '#fff'; rr(X, 1420, 330, 440, 150, 30); X.fill(); X.beginPath(); X.moveTo(1420, 420); X.lineTo(1380, 450); X.lineTo(1420, 455); X.fill(); X.shadowColor = 'transparent';
      ctx.text(X, 'أَيُّ المَوادِّ', 1640, 390, { family: 'display', weight: 700, size: 40, color: P.acc }); ctx.text(X, 'تَمتَصُّ الماء؟', 1640, 450, { family: 'display', weight: 700, size: 40, color: P.acc }); X.restore(); }
    chip(ctx, X, t, { s: ctx.scene.start + .1, x: 1640, y: 170, w: 460, h: 96, text: '2 · أَثناءَ الحِصَّة', icon: 'users', size: 40, family: 'display', fill: P.acc, color: '#fbf6ee', iconBg: 'rgba(255,255,255,.18)', iconColor: P.hi });
    vo(ctx, X, t, 'l17', 'المُختَبَرُ الافتِراضِيُّ عَلى السَّبّورَة،', 1870, 270, { size: 42, align: 'right', maxWidth: 480, map: [2, 3, 4, 5], fadeAt: M(0).s - .2 });
    chip(ctx, X, t, { s: M(3).s - .05, x: 1640, y: 560, w: 420, h: 96, text: 'في ثُنائِيّات', icon: 'users', size: 40, family: 'display' });
    vo(ctx, X, t, 'l18', 'يُنزِلونَ الإِسفَنجَ في الماءِ،', 1870, 700, { size: 42, align: 'right', maxWidth: 480, map: [4, 5, 6, 7] });
    vo(ctx, X, t, 'l18', 'وَيُسَجِّلونَ القِراءَة.', 1870, 820, { size: 54, align: 'right', color: P.acc, maxWidth: 520, map: [8, 9] });
    if (t > M(8).s) ring(ctx, X, t, bx + bw * .15, by + bh * .36, 120, P.hi, M(8).s + .3);
    strip(ctx, X, t, 1, ctx.scene.start + .3);
  } });
