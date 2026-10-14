// ---------------------------------------------------------------------------
// يدمج إشارات قواميس معهد الكويت للأبحاث العلمية (KISR) في خطة القاموس.
//
// القواميس (الموحّد العربي، الكويتي، الأطفال، الكشفي) تنشر مقطع كل إشارة على
// قناة المعهد الرسمية في يوتيوب، فتُضمَّن بمشغّل يوتيوب بلا تنزيل ولا إعادة نشر.
// مصدر الحقيقة: public/sign/kisr-map.csv (مفتاح، تسمية، معرّف يوتيوب، أسماء
// مستعارة، القاموس، الفئة) — يُبنى من فهارس المعهد العامّة ويُراجَع يدويًّا.
//
//   الاستخدام:  node scripts/import-kisr.mjs   ثم   npm run sign:manifest
//
// قاعدة الأولوية: لا يستبدل عنصرًا له مقطع محلي أو من مصدر آخر؛ يملأ فقط
// الكلمات التي لا إشارة لها بعد.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIGN_DIR = join(ROOT, 'public', 'sign');
const PLAN = join(SIGN_DIR, 'dictionary-plan.json');
const MAP = join(SIGN_DIR, 'kisr-map.csv');

const TITLES = {
  unified: 'القاموس الإشاري العربي الموحّد (يوتيوب)',
  kuwaiti: 'القاموس الإشاري الكويتي (يوتيوب)',
  preschool: 'قاموس الأطفال الإشاري (يوتيوب)',
  scout: 'القاموس الإشاري الكشفي (يوتيوب)',
};

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const split = (l) => {
    const out = [];
    let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

function main() {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const rows = parseCsv(readFileSync(MAP, 'utf8'));
  const cats = new Map(plan.categories.map((c) => [c.id, c]));
  const owned = new Set(); // مفاتيح لها إشارة فعلية من مصدر آخر
  for (const c of plan.categories)
    for (const w of c.words) {
      const has = w.yt || existsSync(join(SIGN_DIR, w.file || ''));
      if (has) {
        owned.add(w.key);
        for (const a of w.aliases ?? []) owned.add(a);
      }
    }
  // أزل إدخالات KISR السابقة ثم أعد بناءها من الخريطة (إعادة تشغيل آمنة)
  for (const c of plan.categories) c.words = c.words.filter((w) => !(w.source || '').startsWith('kisr-'));

  let added = 0, aliases = 0, skipped = 0;
  for (const r of rows) {
    if (!r.key || !r.yt) continue;
    const keys = [r.key, ...(r.aliases ? r.aliases.split('|') : [])].filter((k) => k && !owned.has(k));
    if (!keys.length) { skipped++; continue; }
    const catId = `kisr-${r.dict}`;
    if (!cats.has(catId)) {
      const c = { id: catId, title: TITLES[r.dict] || catId, words: [] };
      plan.categories.push(c);
      cats.set(catId, c);
    }
    const item = { key: keys[0], gloss: r.gloss || keys[0], yt: r.yt, source: catId };
    if (keys.length > 1) item.aliases = keys.slice(1);
    cats.get(catId).words.push(item);
    keys.forEach((k) => owned.add(k));
    added++;
    aliases += keys.length - 1;
  }
  plan.categories = plan.categories.filter((c) => c.words.length || !c.id.startsWith('kisr-'));
  writeFileSync(PLAN, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  console.log(`✅ KISR: ${added} إشارة (+${aliases} اسمًا مستعارًا)، ${skipped} متخطّاة لأن لها إشارة من مصدر آخر.`);
  console.log('   التالي: npm run sign:manifest');
}

main();
