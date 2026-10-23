// اختبارات «الفأرة اليدوية»: البقاء = نقرة، والحركة بعد الضغط = سحب وإفلات، والفقد = رفع آمن.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HandGestures, STILL_PX } from '../js/hand-gestures.js';

const types = (evs) => evs.map((e) => e.type);

function run(g, frames) {
  const all = [];
  for (const [t, hands] of frames) all.push(...g.update(hands, t));
  return all;
}

test('tap mode: staying still for the dwell time clicks once, then not again until the hand moves', () => {
  const g = new HandGestures({ dwellMs: () => 500, mode: () => 'tap' });
  const at = (x, y) => [{ id: 1, x, y, inside: true }];
  let evs = run(g, [[0, at(100, 100)], [200, at(103, 99)], [400, at(101, 102)]]);
  assert.ok(!types(evs).includes('click'), 'no click before dwell');
  evs = run(g, [[520, at(102, 101)]]);
  assert.deepEqual(types(evs), ['move', 'down', 'up', 'click']);
  evs = run(g, [[1200, at(102, 101)], [2000, at(100, 100)]]);
  assert.ok(!types(evs).includes('click'), 'staying put does not re-click');
  evs = run(g, [[2100, at(100 + STILL_PX * 3, 100)], [2700, at(100 + STILL_PX * 3, 100)]]);
  assert.equal(types(evs).filter((t) => t === 'click').length, 1, 'a new spot clicks again');
});

test('drag mode: press, move, settle = down / moves / up without click', () => {
  const g = new HandGestures({ dwellMs: () => 500, mode: () => 'drag' });
  const at = (x, y) => [{ id: 1, x, y, inside: true }];
  let evs = run(g, [[0, at(100, 100)], [550, at(100, 100)]]);
  assert.deepEqual(types(evs).slice(-2), ['move', 'down']);
  evs = run(g, [[600, at(140, 100)], [700, at(220, 120)], [800, at(300, 140)]]);
  assert.deepEqual([...new Set(types(evs))], ['move'], 'moving while pressed only moves');
  evs = run(g, [[850, at(302, 141)], [1250, at(301, 140)]]);
  assert.deepEqual(types(evs).slice(-1), ['up'], 'settling after a drag releases');
  assert.ok(!types(evs).includes('click'));
});

test('drag mode: no movement after press becomes a click', () => {
  const g = new HandGestures({ dwellMs: () => 500, mode: () => 'drag' });
  const at = (x, y) => [{ id: 1, x, y, inside: true }];
  const evs = run(g, [[0, at(50, 50)], [550, at(50, 50)], [900, at(52, 51)], [1400, at(51, 50)]]);
  assert.deepEqual(types(evs).filter((t) => t !== 'move'), ['down', 'up', 'click']);
});

test('a hand lost while pressed is released at its last position', () => {
  const g = new HandGestures({ dwellMs: () => 500, mode: () => 'drag', lostMs: 900 });
  const at = (x, y) => [{ id: 7, x, y, inside: true }];
  run(g, [[0, at(10, 10)], [550, at(10, 10)], [600, at(80, 80)]]);
  let evs = run(g, [[700, []], [1000, []]]);
  assert.deepEqual(types(evs), []);
  evs = run(g, [[1600, []]]);
  assert.deepEqual(types(evs), ['up', 'leave']);
  assert.deepEqual([evs[0].x, evs[0].y], [80, 80]);
});

test('two hands act independently', () => {
  const g = new HandGestures({ dwellMs: () => 400, mode: () => 'tap' });
  const evs = run(g, [
    [0, [{ id: 1, x: 10, y: 10, inside: true }, { id: 2, x: 500, y: 300, inside: true }]],
    [450, [{ id: 1, x: 10, y: 10, inside: true }, { id: 2, x: 600, y: 300, inside: true }]],
  ]);
  const clicks = evs.filter((e) => e.type === 'click');
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0].id, 1, 'only the still hand clicked');
});

test('outside the frame nothing dwells', () => {
  const g = new HandGestures({ dwellMs: () => 300, mode: () => 'tap' });
  const evs = run(g, [[0, [{ id: 1, x: -5, y: 10, inside: false }]], [600, [{ id: 1, x: -5, y: 10, inside: false }]]]);
  assert.deepEqual(types(evs), []);
});
