// اختبارات المحتوى: node --test public/under-the-lens/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT } from '../js/content.js';

const artSrc = readFileSync(new URL('../js/art.js', import.meta.url), 'utf8');
const byId = Object.fromEntries(CONTENT.items.map((i) => [i.id, i]));

test('كل عيّنة لها رسم مكبّر في art.js ومعرّف فريد', () => {
  const ids = CONTENT.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(artSrc, new RegExp(`\\n  ${id}\\(ctx, R\\)`), `لا رسم للعيّنة ${id}`);
});

test('كل مستوى فيه عيّنات تكفي الجولة ومشتّتَين على الأقل', () => {
  for (const lv of [1, 2]) {
    const n = CONTENT.items.filter((i) => i.level === lv).length;
    assert.ok(n >= CONTENT.perLevel[lv], `المستوى ${lv}: ${n} < ${CONTENT.perLevel[lv]}`);
    assert.ok(n >= 3, `المستوى ${lv} يحتاج ثلاث بطاقات على الأقل`);
  }
});

test('المشتّتات موجودة وفي المستوى نفسه ولا تساوي العيّنة', () => {
  for (const it of CONTENT.items) {
    assert.ok(it.confuse.length >= 1, it.id);
    for (const c of it.confuse) {
      assert.ok(byId[c], `${it.id}: مشتّت غير موجود ${c}`);
      assert.equal(byId[c].level, it.level, `${it.id}: ${c} من مستوى آخر`);
      assert.notEqual(c, it.id);
    }
  }
});

test('النصوص قصيرة ومناسبة للسبورة', () => {
  for (const it of CONTENT.items) {
    assert.ok(it.name.length <= 20, `اسم طويل: ${it.name}`);
    assert.ok(it.fact.length <= 90, `معلومة طويلة: ${it.id} (${it.fact.length})`);
    assert.match(it.color, /^#[0-9a-f]{6}$/i);
  }
});
