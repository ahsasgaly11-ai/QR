// اختبارات المحتوى: node --test public/germ-hunters/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT, pickRound } from '../js/content.js';

const modelsSrc = readFileSync(new URL('../js/models.js', import.meta.url), 'utf8');
const sceneSrc = readFileSync(new URL('../js/scene3d.js', import.meta.url), 'utf8');
const flatSrc = readFileSync(new URL('../js/flat.js', import.meta.url), 'utf8');

test('المعرّفات فريدة، وكل بطاقة في جولة موجودة وفئة من سلّتي جولتها', () => {
  const ids = CONTENT.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const it of CONTENT.items) {
    const round = CONTENT.rounds.find((r) => r.id === it.round);
    assert.ok(round, `${it.id}: جولة غير موجودة`);
    assert.ok(round.bins.some((b) => b.id === it.cat), `${it.id}: فئة ${it.cat} ليست من سلال ${round.id}`);
  }
});

test('كل بطاقة في الجولة ١ لها مجسّم، وكل بطاقة في الجولة ٢ لها مشهد في الطبقات الثلاث', () => {
  for (const it of CONTENT.items) {
    if (it.round === 'surface') {
      assert.ok(it.model, `${it.id}: بلا مجسّم`);
      assert.match(modelsSrc, new RegExp(`ITEM_MODELS = \\{[^}]*\\b${it.model}\\b`), `لا مجسّم ${it.model}`);
    } else {
      assert.ok(it.scene, `${it.id}: بلا مشهد`);
      assert.match(sceneSrc, new RegExp(`'${it.scene}'`), `scene3d.js لا يعرف المشهد ${it.scene}`);
      assert.match(flatSrc, new RegExp(`'${it.scene}'`), `flat.js لا يعرف المشهد ${it.scene}`);
    }
  }
});

test('كل فئة فيها بطاقات تكفي الجولة، واختيار الجولة يضمن minEach من كل فئة والبطاقات الدائمة', () => {
  for (const round of CONTENT.rounds) {
    const pool = CONTENT.items.filter((i) => i.round === round.id);
    assert.ok(pool.length >= CONTENT.perRound[round.id], round.id);
    for (const bin of round.bins) assert.ok(pool.filter((i) => i.cat === bin.id).length >= CONTENT.minEach + 1, `${round.id}/${bin.id}`);
    for (let k = 0; k < 200; k++) {
      const set = pickRound(CONTENT, round.id);
      assert.equal(set.length, CONTENT.perRound[round.id]);
      assert.equal(new Set(set).size, set.length);
      for (const bin of round.bins) {
        const n = set.filter((id) => pool.find((i) => i.id === id).cat === bin.id).length;
        assert.ok(n >= CONTENT.minEach, `${round.id}: ${bin.id} = ${n}`);
      }
      for (const a of CONTENT.always) if (pool.some((i) => i.id === a)) assert.ok(set.includes(a), `${a} غائبة`);
    }
  }
});

test('النصوص قصيرة ومناسبة للسبورة، وكل بطاقة لها تلميح خطأ ومعلومة', () => {
  for (const it of CONTENT.items) {
    assert.ok(it.name.length <= 32, `اسم طويل: ${it.name}`);
    assert.ok(it.fact && it.fact.length <= 80, `معلومة طويلة أو غائبة: ${it.id} (${it.fact?.length})`);
    assert.ok(it.wrong && it.wrong.length <= 60, `تلميح طويل أو غائب: ${it.id}`);
    assert.ok(it.emoji, it.id);
  }
});
