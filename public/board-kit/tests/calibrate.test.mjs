// اختبارات المعايرة التلقائية بإطارات اصطناعية تحاكي كاميرا ترى السبورة بزاوية.
import test from 'node:test';
import assert from 'node:assert/strict';
import { locateSpot, buildCalibration, errorPct, MARKERS } from '../js/calibrate.js';
import { applyH, invert3 } from '../js/geometry.js';

const W = 320;
const H = 180;
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** إطار «الصف»: إضاءة متدرجة + وهج ثابت + ضجيج حساس الكاميرا. */
function room() {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const glare = 120 * Math.exp(-((x - 230) ** 2 + (y - 40) ** 2) / 600);
      g[y * W + x] = 60 + 0.25 * x + glare + (rand() - 0.5) * 8;
    }
  }
  return g;
}

/** يضيف دائرة مضيئة (بقعة جهاز العرض) حول مركز مطبّع، مع ضجيج جديد. */
function withSpot(base, cx, cy, r = 7, gain = 90) {
  const g = new Float32Array(base.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - cx * W, y + 0.5 - cy * H);
      const disc = Math.min(1, Math.max(0, r + 0.5 - d)); // حافة ناعمة (تقريب البكسل)
      g[y * W + x] = base[y * W + x] + gain * disc + (rand() - 0.5) * 8;
    }
  }
  return g;
}

const frame = (gray) => ({ gray, w: W, h: H });

test('locateSpot finds a projected spot with sub-pixel accuracy despite glare and noise', () => {
  const A = room();
  for (const [cx, cy] of [[0.2, 0.3], [0.71, 0.18], [0.55, 0.8]]) {
    const p = locateSpot(frame(A), frame(withSpot(A, cx, cy)));
    assert.ok(Math.abs(p.x - cx) * W < 0.6 && Math.abs(p.y - cy) * H < 0.6, `${p.x},${p.y} vs ${cx},${cy}`);
  }
});

test('locateSpot refuses a frame where nothing lit up', () => {
  const A = room();
  assert.throws(() => locateSpot(frame(A), frame(withSpot(A, 0.5, 0.5, 7, 0))), /لم تظهر/);
});

test('locateSpot refuses when someone moves in front of the camera', () => {
  const A = room();
  const B = withSpot(A, 0.3, 0.3);
  for (let y = 60; y < 170; y++) for (let x = 150; x < 300; x++) B[y * W + x] += 70; // جسم كبير تحرّك
  assert.throws(() => locateSpot(frame(A), frame(B)), /تحرّك/);
});

test('full auto-calibration chain is accurate under perspective', () => {
  // كاميرا في زاوية: الشاشة (مطبّعة) ← الكاميرا (مطبّعة) بمنظور مائل
  const screenToCam = [0.62, 0.1, 0.12, -0.06, 0.58, 0.22, 0.18, -0.1, 1];
  const A = room();
  const found = [...MARKERS, { x: 0.5, y: 0.5 }].map((s) => {
    const c = applyH(screenToCam, s.x, s.y);
    return locateSpot(frame(A), frame(withSpot(A, c.x, c.y)));
  });
  const cal = buildCalibration(found.slice(0, 4));
  const pred = applyH(cal.H, found[4].x, found[4].y);
  const e = errorPct(pred, { x: 0.5, y: 0.5 }, 1180 / 820);
  assert.ok(e < 0.5, `center error ${e.toFixed(3)}%`);
  // نقاط لم تُستعمل في المعايرة
  const camToScreen = invert3(screenToCam);
  for (const s of [{ x: 0.3, y: 0.7 }, { x: 0.85, y: 0.4 }]) {
    const c = applyH(screenToCam, s.x, s.y);
    const q = applyH(cal.H, c.x, c.y);
    assert.ok(errorPct(q, s, 1180 / 820) < 0.6, 'off-marker accuracy');
    assert.ok(camToScreen);
  }
});

test('buildCalibration rejects a tiny or crossed quad', () => {
  assert.throws(() => buildCalibration([{ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, { x: 0.52, y: 0.52 }, { x: 0.5, y: 0.52 }]), /صغيرة/);
  assert.throws(() => buildCalibration([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }]), /ترتيب/);
});

// ---------------------------------------------------------------------------
// انعكاس الشاشة بتأخيرات مختلفة: كاميرا وهمية ترى ما عُرض قبل `latency` م.ث فقط.
// ---------------------------------------------------------------------------
import { runAutoCalibration, MAX_WAIT_MS } from '../js/calibrate.js';

function fakeRig({ latency, screenToCam }) {
  let clock = 0;
  const shown = []; // [{at, target|null}]
  const base = room();
  const targets = [...MARKERS, { x: 0.5, y: 0.5 }];
  return {
    targets,
    io: {
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      show: (i) => shown.push({ at: clock, t: targets[i] }),
      hide: () => shown.push({ at: clock, t: null }),
      grab: () => {
        clock += 33; // زمن التقاط إطار
        // ما يظهر على السبورة الآن هو ما عُرض قبل `latency`
        const visible = [...shown].reverse().find((s) => s.at <= clock - latency);
        if (!visible?.t) return frame(withSpot(base, 0, 0, 0, 0));
        const c = applyH(screenToCam, visible.t.x, visible.t.y);
        return frame(withSpot(base, c.x, c.y));
      },
      aspect: 1180 / 820,
      targets,
    },
  };
}

for (const [name, latency] of [['HDMI cable', 30], ['Apple TV', 180], ['Miracast', 450], ['iProjection (slow)', 1600]]) {
  test(`auto-calibration works with ${name} mirroring delay (${latency} ms) and measures it`, async () => {
    const screenToCam = [0.62, 0.1, 0.12, -0.06, 0.58, 0.22, 0.18, -0.1, 1];
    const { io } = fakeRig({ latency, screenToCam });
    const cal = await runAutoCalibration(io);
    assert.ok(cal.error < 0.6, `center error ${cal.error.toFixed(2)}%`);
    assert.ok(Math.abs(cal.latencyMs - latency) < 300, `measured ${cal.latencyMs} ms vs ${latency}`);
  });
}

test('auto-calibration reports clearly when the projected marker never appears', async () => {
  const { io } = fakeRig({ latency: MAX_WAIT_MS + 5000, screenToCam: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  await assert.rejects(runAutoCalibration(io), /انعكاس الشاشة/);
});
