// ---------------------------------------------------------------------------
// يبني public/sign/manifest.json من خطة القاموس (dictionary-plan.json)
// مع الاكتفاء بالعناصر التي صُوِّرت فعلًا (ملفّها موجود على القرص). فلا يظهر
// في المنصّة إلا ما تمتلكه من إشارات موثّقة — دون روابط مكسورة ولا تلفيق.
//
//   الاستخدام:  node scripts/build-sign-manifest.mjs   (أو: npm run sign:manifest)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIGN_DIR = join(ROOT, 'public', 'sign');
const PLAN = join(SIGN_DIR, 'dictionary-plan.json');
const OUT = join(SIGN_DIR, 'manifest.json');

const VIDEO_EXT = ['.mp4', '.webm'];
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
const ALT_EXT = [...VIDEO_EXT, ...IMG_EXT];

/** يجد الملفّ المُصوَّر فعلًا: المسار كما في الخطة، أو بامتداد بديل. */
function resolveFile(relPath) {
  const candidates = [relPath];
  const base = relPath.slice(0, relPath.length - extname(relPath).length);
  for (const ext of ALT_EXT) candidates.push(base + ext);
  for (const c of candidates) {
    if (existsSync(join(SIGN_DIR, c))) return c;
  }
  return null;
}

function mediaKey(file) {
  return VIDEO_EXT.includes(extname(file).toLowerCase()) ? 'video' : 'img';
}

function main() {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const manifest = { version: plan.version ?? 1, words: {}, letters: {} };

  let haveL = 0;
  const totalL = plan.letters?.length ?? 0;
  for (const l of plan.letters ?? []) {
    const file = resolveFile(l.file);
    if (!file) continue;
    manifest.letters[l.key] = { [mediaKey(file)]: file };
    haveL++;
  }

  let haveW = 0;
  let totalW = 0;
  for (const cat of plan.categories ?? []) {
    for (const w of cat.words ?? []) {
      totalW++;
      const file = resolveFile(w.file);
      if (!file) continue;
      manifest.words[w.key] = { [mediaKey(file)]: file, gloss: w.gloss || w.key };
      haveW++;
    }
  }

  writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('✅ تم بناء manifest.json');
  console.log(`   الحروف : ${haveL}/${totalL}`);
  console.log(`   الكلمات: ${haveW}/${totalW}`);
  if (haveL + haveW === 0) {
    console.log('   (لا توجد مقاطع بعد — صوّر العناصر وضعها في public/sign/ ثم أعد التشغيل.)');
  }
}

main();
