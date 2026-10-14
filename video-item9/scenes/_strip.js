// شريط «قبل · أثناء · بعد» أسفل مشاهد التطبيق — active: 0/1/2
import { rr } from './_lib.js';
export function strip(ctx, X, t, active, s) { const P = ctx.P, k = ctx.at(t, s, s + .5, 'expoOut'); if (k <= 0) return; const y = 972; X.save(); X.globalAlpha = k;
  X.fillStyle = 'rgba(255,255,255,.85)'; rr(X, 460, y - 44, 1000, 88, 44); X.fill();
  X.strokeStyle = P.sand; X.lineWidth = 6; X.beginPath(); X.moveTo(1300, y); X.lineTo(620, y); X.stroke();
  [['قَبلَ الحِصَّة', 1300], ['أَثناءَ الحِصَّة', 960], ['بَعدَ النَّشاط', 620]].forEach(([n, x], i) => { const on = i === active;
    X.fillStyle = on ? P.acc : P.sand; X.beginPath(); X.arc(x, y, on ? 16 : 11, 0, 6.283); X.fill();
    ctx.text(X, n, x, y + 54, { family: 'display', weight: 700, size: on ? 30 : 24, color: on ? P.acc : P.mut }); }); X.restore(); }
