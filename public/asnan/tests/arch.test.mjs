// اختبارات قوس الأسنان: node --test public/asnan/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { archCurve, placeOnArch } from '../../board-kit/js/geometry.js';
import { jawTeeth, TYPES } from '../js/teeth.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

for (const jaw of ['upper', 'lower']) {
  test(`${jaw} arch: 16 teeth in anatomical order, spaced, crowns pointing inward`, () => {
    const teeth = jawTeeth(jaw);
    assert.equal(teeth.length, 16);
    const counts = {};
    for (const t of teeth) counts[t.type] = (counts[t.type] || 0) + 1;
    for (const k in TYPES) assert.equal(counts[k], TYPES[k].perJaw, k);
    // من المنتصف إلى الخلف: قاطعان، ناب، ضاحكان، ثلاثة طواحن
    assert.deepEqual(teeth.slice(8).map((t) => t.code), ['I1', 'I2', 'C', 'P1', 'P2', 'M1', 'M2', 'M3']);
    assert.deepEqual(teeth.slice(0, 8).map((t) => t.code), ['M3', 'M2', 'M1', 'P2', 'P1', 'C', 'I2', 'I1']);
    const curve = archCurve({ cx: 500, top: 100, w: 600, h: 480, jaw });
    const { slots } = placeOnArch(teeth, curve, 0.1);
    for (let i = 1; i < slots.length; i++) {
      const d = Math.hypot(slots[i].x - slots[i - 1].x, slots[i].y - slots[i - 1].y);
      assert.ok(d > (slots[i].width + slots[i - 1].width) / 2 * 0.95, `teeth ${i - 1},${i} spaced`);
    }
    for (const s of slots) {
      const toC = { x: curve.center.x - s.x, y: curve.center.y - s.y };
      assert.ok(s.nx * toC.x + s.ny * toC.y > 0, 'crown points inside the arch');
      // زاوية الرسم تدير المحور المحلي +y إلى العمودي الداخلي
      const a = (s.angle * Math.PI) / 180;
      near(-Math.sin(a), s.nx, 1e-6, 'rot x');
      near(Math.cos(a), s.ny, 1e-6, 'rot y');
    }
    // القواطع في المنتصف عند قمة القوس
    const front = jaw === 'upper' ? Math.min(...slots.map((s) => s.y)) : Math.max(...slots.map((s) => s.y));
    near(slots[7].y, front, 6, 'central incisor at the front');
    // التماثل
    near(slots[0].x + slots[15].x, 1000, 1e-6, 'symmetric');
  });
}
