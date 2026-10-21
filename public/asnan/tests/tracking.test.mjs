// اختبارات التتبّع: التكبير على السبورة، البلاطات، الدمج، وهوية الأيدي عبر الإطارات.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boardRoi, makeTiles, mergeDetections, HandMatcher, QUALITY } from '../js/tracking.js';
import { applyH, invert3 } from '../js/geometry.js';

// كاميرا على طاولة: السبورة تشغل وسط الصورة بمنظور مائل
const screenToCam = [0.5, 0.06, 0.24, -0.03, 0.42, 0.28, 0.1, -0.06, 1];
const H = invert3(screenToCam); // الكاميرا ← الشاشة

test('board ROI covers the whole projected screen (plus margin) and nothing far beyond', () => {
  const roi = boardRoi(H, 0.1);
  for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [-0.03, 1.03]]) {
    const c = applyH(screenToCam, x, y);
    assert.ok(c.x >= roi.x && c.x <= roi.x + roi.w && c.y >= roi.y && c.y <= roi.y + roi.h, `screen ${x},${y} inside ROI`);
  }
  assert.ok(roi.w < 0.85 && roi.h < 0.85, `ROI is a real crop: ${JSON.stringify(roi)}`);
  assert.deepEqual(boardRoi(null), { x: 0, y: 0, w: 1, h: 1 });
});

for (const [name, q] of Object.entries(QUALITY)) {
  test(`tiles (${name}) cover the ROI and overlap by at least a child's hand`, () => {
    const roi = { x: 0.2, y: 0.15, w: 0.6, h: 0.5 };
    const tiles = makeTiles(roi, q.cols, q.rows, 0.22);
    assert.equal(tiles.length, q.cols * q.rows);
    const hand = 0.03; // يد طفل بنسبة عرض الإطار
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const x = roi.x + (roi.w * i) / 40;
        const y = roi.y + (roi.h * j) / 40;
        // كل يد (مربع بحجمها حول مركزها) تقع كاملة في بلاطة واحدة على الأقل، إلا عند حافة المنطقة نفسها
        const inner = (v, a, b) => Math.min(Math.max(v, a + hand / 2), b - hand / 2);
        const cx = inner(x, roi.x, roi.x + roi.w);
        const cy = inner(y, roi.y, roi.y + roi.h);
        const ok = tiles.some((t) => cx - hand / 2 >= t.x - 1e-9 && cx + hand / 2 <= t.x + t.w + 1e-9 && cy - hand / 2 >= t.y - 1e-9 && cy + hand / 2 <= t.y + t.h + 1e-9);
        assert.ok(ok, `hand at ${cx.toFixed(3)},${cy.toFixed(3)} fully inside a tile`);
      }
    }
    const last = tiles[tiles.length - 1];
    assert.ok(Math.abs(last.x + last.w - (roi.x + roi.w)) < 1e-9 && Math.abs(last.y + last.h - (roi.y + roi.h)) < 1e-9, 'tiles end at ROI edge');
  });
}

test('tiling enlarges the hand for the palm detector', () => {
  // الكاشف يصغّر الصورة إلى مربع بطول ضلعها الأطول: التكبير = الضلع الأطول للمنطقة كلها ÷ ضلع البلاطة
  const aspect = 16 / 9;
  const roi = boardRoi(H, 0.1);
  const longest = (t) => Math.max(t.w * aspect, t.h);
  const full = Math.max(aspect, 1);
  const gain = (q) => full / longest(makeTiles(roi, QUALITY[q].cols, QUALITY[q].rows, 0.22)[0]);
  assert.ok(gain('normal') > 1.3, `crop alone ×${gain('normal').toFixed(2)}`);
  assert.ok(gain('high') > gain('normal') * 1.3, `high ×${gain('high').toFixed(2)}`);
  assert.ok(gain('max') > gain('high') * 1.3, `max ×${gain('max').toFixed(2)}`);
});

test('a hand seen by two overlapping tiles is kept once; two real hands stay two', () => {
  const a = { cx: 0.5, cy: 0.5, size: 0.03, score: 0.9, edge: 0.05 };
  const aDup = { cx: 0.503, cy: 0.498, size: 0.031, score: 0.85, edge: 0.3 };
  const b = { cx: 0.56, cy: 0.5, size: 0.03, score: 0.8, edge: 0.3 };
  const out = mergeDetections([a, aDup, b], 16 / 9);
  assert.equal(out.length, 2);
  assert.ok(out.includes(aDup), 'keeps the copy far from its tile edge');
});

test('two children crossing hands keep their identities (handedness + motion)', () => {
  const m = new HandMatcher({ aspect: 1.6 });
  let t = 0;
  // طفل أيمن يحرّك يمناه يسارًا، وطفل أيسر يحرّك يسراه يمينًا؛ تتقاطعان في المنتصف
  let ids = null;
  for (let i = 0; i <= 30; i++, t += 33) {
    const k = i / 30;
    const hands = [
      { x: 0.7 - 0.4 * k, y: 0.6, handed: 'Right', size: 0.05 },
      { x: 0.3 + 0.4 * k, y: 0.62, handed: 'Left', size: 0.04 },
    ];
    const out = m.update(hands, t);
    const byHand = Object.fromEntries(out.map((o) => [o.handed, o.id]));
    if (!ids) ids = byHand;
    assert.deepEqual(byHand, ids, `frame ${i}`);
  }
});

test('a hand hidden behind a body for 2 s is re-identified nearby; a far hand is a new one', () => {
  const m = new HandMatcher({ aspect: 1.6 });
  let t = 0;
  let id;
  for (let i = 0; i < 10; i++, t += 33) [{ id }] = m.update([{ x: 0.3 + i * 0.01, y: 0.5, handed: 'Right', size: 0.05 }], t);
  t += 2000; // محجوبة ثانيتين، وتحرّكت قليلًا
  const [back] = m.update([{ x: 0.52, y: 0.47, handed: 'Right', size: 0.05 }], t);
  assert.equal(back.id, id, 'same hand after occlusion');
  t += 2000;
  const [far] = m.update([{ x: 0.95, y: 0.1, handed: 'Right', size: 0.05 }], t);
  assert.notEqual(far.id, id, 'a hand across the board is not the same hand');
});

test('filter restarts after a long gap (no slow crawl to the new position)', () => {
  const m = new HandMatcher({ aspect: 1.6 });
  m.update([{ x: 0.2, y: 0.5 }], 0);
  m.update([{ x: 0.2, y: 0.5 }], 33);
  const [o] = m.update([{ x: 0.35, y: 0.5 }], 1500);
  assert.ok(Math.abs(o.x - 0.35) < 1e-9, `cursor at ${o.x}`);
});

test('focus crop keeps a small hand at about a third of the window, inside the frame', async () => {
  const { focusCrop } = await import('../js/tracking.js');
  const aspect = 16 / 9;
  const c = focusCrop({ cx: 0.5, cy: 0.5, size: 0.02 }, aspect);
  const handSpan = 2.2 * 0.02; // اليد كلها بنسبة العرض
  assert.ok(handSpan / c.w > 0.25 && handSpan / c.w < 0.5, `hand fills ${(handSpan / c.w).toFixed(2)} of the window`);
  assert.ok(Math.abs(c.w * 1 - (c.h / aspect)) < 1e-9, 'square in pixels');
  const edge = focusCrop({ cx: 0.99, cy: 0.02, size: 0.03 }, aspect);
  assert.ok(edge.x >= 0 && edge.x + edge.w <= 1 + 1e-9 && edge.y >= 0 && edge.y + edge.h <= 1 + 1e-9, 'clamped inside the frame');
});
