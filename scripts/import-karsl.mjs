// ---------------------------------------------------------------------------
// يستورد مقاطع قاعدة KArSL (جامعة الملك فهد للبترول والمعادن) إلى قاموس المنصّة.
//
// يقرأ public/sign/dictionary-plan.json، ولكل عنصر يحمل حقل `karsl` (رقم الإشارة
// في القاعدة) يأخذ **تكرارًا واحدًا** من مجلّد تلك الإشارة، يقصّ مربّعًا حول
// المؤدّي، يبطّئ الحركة (مقاطع القاعدة أقصر من ثانية)، ويخرج mp4 صغيرًا في
// المسار الذي تحدّده الخطة. ثم يكفي: npm run sign:manifest
//
//   الاستخدام:
//     node scripts/import-karsl.mjs --src <مجلّد يحوي 0001/ 0002/ …> [--src …]
//                                   [--force] [--only letters|words]
//
//   بنية مجلّد المصدر = كما تُستخرج من أرشيفات train/test لمؤدٍّ واحد:
//     0032/02_01_0032_(…)_c.mp4 …
//
// الاستشهاد: Sidig, Luqman, Mahmoud, Mohandes. "KArSL: Arabic Sign Language
// Database", ACM TALLIP 2021. المقاطع بلهجة إشارية سعودية — راجع README.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIGN_DIR = join(ROOT, 'public', 'sign');
const PLAN = join(SIGN_DIR, 'dictionary-plan.json');

// قصّ مربّع 960×960 حول المؤدّي من إطار 1920×1080 ثم تصغير إلى 400×400.
const CROP = 'crop=960:960:580:60';
const SIZE = 400;
// إبطاء الحركة: مقاطع القاعدة 0.6–1 ثانية؛ نضاعف المدّة ليُرى شكل اليد بوضوح.
const SLOW = 2.0;

function parseArgs(argv) {
  const out = { src: [], force: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') out.src.push(argv[++i]);
    else if (a === '--force') out.force = true;
    else if (a === '--only') out.only = argv[++i];
  }
  return out;
}

/** يجد مجلّد الإشارة (مثل 0148) في أحد مجلّدات المصدر. */
function findSignDir(srcDirs, id) {
  const name = String(id).padStart(4, '0');
  for (const d of srcDirs) {
    const p = join(d, name);
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  }
  return null;
}

/** يختار التكرار الأوسط (الأبعد عن بداية التسجيل ونهايته). */
function pickClip(dir) {
  const files = readdirSync(dir)
    .filter((f) => /\.(mp4|avi|mov)$/i.test(f))
    .sort();
  if (!files.length) return null;
  return join(dir, files[Math.floor(files.length / 2)]);
}

function convert(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  const vf = `${CROP},scale=${SIZE}:${SIZE},setpts=${SLOW}*PTS,format=yuv420p`;
  const r = spawnSync(
    'ffmpeg',
    [
      '-v', 'error', '-y', '-i', src, '-an', '-vf', vf, '-r', '30',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'main',
      '-movflags', '+faststart', dst,
    ],
    { stdio: 'inherit' }
  );
  return r.status === 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.src.length) {
    console.error('الاستخدام: node scripts/import-karsl.mjs --src <مجلّد KArSL> [--src …] [--force]');
    process.exit(1);
  }
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const items = [];
  if (args.only !== 'words') for (const l of plan.letters ?? []) if (l.karsl) items.push(l);
  if (args.only !== 'letters')
    for (const c of plan.categories ?? []) for (const w of c.words ?? []) if (w.karsl) items.push(w);

  let done = 0, skipped = 0, missing = 0, failed = 0;
  for (const it of items) {
    const dst = join(SIGN_DIR, it.file);
    if (existsSync(dst) && !args.force) { skipped++; continue; }
    const dir = findSignDir(args.src, it.karsl);
    const clip = dir && pickClip(dir);
    if (!clip) { missing++; continue; }
    process.stdout.write(`#${String(it.karsl).padStart(4, '0')} ${it.key} → ${it.file}\n`);
    if (convert(clip, dst)) done++;
    else failed++;
  }
  console.log(`\n✅ استيراد KArSL: ${done} جديد، ${skipped} موجود مسبقًا، ${missing} غير متوفّر في المصدر، ${failed} فشل.`);
  console.log('   التالي: npm run sign:manifest');
}

main();
