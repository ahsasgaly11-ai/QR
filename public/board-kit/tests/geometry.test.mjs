// اختبارات الهندسة: node --test public/board-kit/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { homographyFrom4, applyH, invert3, isConvexQuad, OneEuro } from '../js/geometry.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test('homography maps the 4 correspondences exactly and interpolates perspective', () => {
  // «كاميرا» ترى الشاشة بمنظور مائل: نولّد H حقيقية ثم نستعيدها من 4 نقاط
  const truth = [0.9, 0.12, 0.05, -0.08, 1.1, 0.1, 0.25, -0.15, 1];
  const screen = [{ x: 0.1, y: 0.12 }, { x: 0.9, y: 0.12 }, { x: 0.9, y: 0.88 }, { x: 0.1, y: 0.88 }];
  const inv = invert3(truth);
  const cam = screen.map((p) => applyH(inv, p.x, p.y));
  const H = homographyFrom4(cam, screen);
  for (let i = 0; i < 4; i++) {
    const q = applyH(H, cam[i].x, cam[i].y);
    near(q.x, screen[i].x, 1e-9, 'x');
    near(q.y, screen[i].y, 1e-9, 'y');
  }
  for (const s of [{ x: 0.5, y: 0.5 }, { x: 0.02, y: 0.97 }, { x: 0.73, y: 0.31 }]) {
    const c = applyH(inv, s.x, s.y);
    const q = applyH(H, c.x, c.y);
    near(q.x, s.x, 1e-9, 'interp x');
    near(q.y, s.y, 1e-9, 'interp y');
  }
});

test('degenerate correspondences are rejected', () => {
  const col = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 0.2, y: 0 }];
  assert.equal(homographyFrom4(col, col), null);
});

test('convexity check catches crossed corner order', () => {
  assert.equal(isConvexQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), true);
  assert.equal(isConvexQuad([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), false);
});

test('One Euro filter removes jitter at rest and follows a step quickly', () => {
  const f = new OneEuro({ minCutoff: 1.1, beta: 6, dCutoff: 1 });
  let rnd = 1;
  const noise = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647 - 0.5) * 0.01; // ±0.5% ارتعاش
  let out = [];
  for (let i = 0; i < 60; i++) out.push(f.filter(0.5 + noise(), i * 33));
  const tail = out.slice(30);
  const spread = Math.max(...tail) - Math.min(...tail);
  assert.ok(spread < 0.004, `jitter after filter ${spread}`);
  for (let i = 60; i < 75; i++) out.push(f.filter(0.8, i * 33)); // قفزة إلى 0.8
  near(out[out.length - 1], 0.8, 0.01, 'settles within 0.5s');
});

