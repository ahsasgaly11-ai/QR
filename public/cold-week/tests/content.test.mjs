// سلامة محتوى «أسبوع الزكام»: node --test public/cold-week/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SITUATIONS, CARDS, DOLLS, DAYS, PERIODS, WRONG, TOPICS, OUTBREAK, CONTENT, validate } from '../js/content.js';

test('المحتوى سليم (الحلول جيدة والمشتّتات موجودة ومختلفة)', () => {
  assert.deepEqual(validate(), []);
});

test('عشرة مواقف: موقفان لكل يوم من الأحد إلى الخميس بالترتيب', () => {
  assert.equal(SITUATIONS.length, DAYS.length * PERIODS.length);
  SITUATIONS.forEach((s, i) => {
    assert.equal(s.day, Math.floor(i / 2), s.id);
    assert.equal(s.period, i % 2, s.id);
  });
});

test('كل مشتّت له رسالة خطأ لطيفة، وكل بطاقة لها رمز واسم قصير', () => {
  for (const s of SITUATIONS) for (const o of s.others) {
    const msg = s.wrong?.[o] || WRONG[o] || (CARDS[o].good ? 'ok' : '');
    assert.ok(msg, `${s.id}: لا رسالة للمشتّت ${o}`);
  }
  for (const [id, c] of Object.entries(CARDS)) {
    assert.ok(c.emoji && c.label, id);
    assert.ok(c.label.length <= 22, `${id}: الاسم طويل على البطاقة`);
  }
});

test('نصوص المواقف والمعلومات قصيرة (تُقرأ على السبورة)', () => {
  for (const s of SITUATIONS) {
    assert.ok(s.text.length <= 52, `${s.id}: الموقف طويل (${s.text.length})`);
    assert.ok(s.fact.length <= 56, `${s.id}: المعلومة طويلة (${s.fact.length})`);
  }
});

test('مشاهد الحل معروفة في الطبقتين (3D و C)', () => {
  const known = ['elbow', 'tissue', 'bin', 'wash', 'wipe', 'bottle', 'rest', 'distance'];
  for (const s of SITUATIONS) assert.ok(known.includes(s.anim), s.id);
  for (const s of SITUATIONS) assert.ok(TOPICS[s.topic], s.id);
});

test('الافتتاح: المريض الأول ثم الأقرب فالأقرب، ولا يتكرر أحد', () => {
  const all = OUTBREAK.byDay.flat();
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.every((i) => i >= 0 && i < DOLLS.length));
  assert.equal(all[0], OUTBREAK.first);
  assert.equal(CONTENT.intro.length, 4);
});

test('لكل بطاقة مجسّم ثلاثي الأبعاد مبني في models.js', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../js/models.js', import.meta.url), 'utf8'));
  for (const id of Object.keys(CARDS)) assert.match(src, new RegExp(`\\n  ${id}\\(\\) \\{`), `لا مجسّم للبطاقة ${id}`);
});
