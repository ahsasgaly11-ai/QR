// ---------------------------------------------------------------------------
// مستورد عامّ لمقاطع الإشارة من أي مصدر (قاموس مؤسسي، مجموعة بحثية، تصوير محلي).
//
// يأخذ ملف خريطة CSV يربط كل كلمة بملف مقطع في مجلّد المصدر، فيحوّل المقطع إلى
// mp4 مربّع صغير، ويضيف العنصر إلى خطة القاموس (dictionary-plan.json) إن لم يكن
// فيها، بحقل source لنسب المصدر في المشغّل. ثم يكفي: npm run sign:manifest
//
//   الاستخدام:
//     node scripts/import-signs.mjs --map map.csv --src <مجلّد المقاطع> \
//          --source <معرّف المصدر> --category <معرّف الفئة> [--title <عنوان الفئة>] \
//          [--crop auto|none|W:H:X:Y] [--speed 1.0] [--size 400] [--fps 30|native] [--force]
//
//   --fps native: يُبقي معدّل إطارات المصدر (للصور المتحرّكة 4–6 إطارات/ث) بدل تكرار
//   الإطار نفسه حتى 30/ث، فيستخرج extract-poses الإطارات الحقيقية وحدها ويُنعّم المترجم
//   بينها بدل أن يتوقّف ثم يقفز.
//
//   صيغة map.csv (الرأس إلزامي، الفاصل فاصلة؛ الأعمدة الاختيارية تُترك فارغة):
//     key,gloss,file,aliases,category
//     ماء,ماء,water.mp4,مياه|للماء,science
//
//   • key: الكلمة المُطبَّعة (بلا تشكيل، أ/إ/آ ← ا، ة ← ه، ى ← ي) — يُطبَّع آليًّا.
//   • gloss: التسمية المعروضة بصورتها الصحيحة (افتراضيًّا = key).
//   • file: مسار المقطع نسبيًّا إلى --src.
//   • aliases: مرادفات/جموع مفصولة بـ | تشير إلى الإشارة نفسها.
//   • category: تتجاوز --category لهذا الصفّ.
//
// معرّف المصدر يجب أن يكون معرَّفًا في SIGN_SOURCES (src/lib/sign-interpreter.ts)
// ليُعرَض اسمه للطالب.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIGN_DIR = join(ROOT, 'public', 'sign');
const PLAN = join(SIGN_DIR, 'dictionary-plan.json');

const MARKS = /[ً-ْٰـ]/g;
const normalize = (s) =>
  s
    .trim()
    .replace(MARKS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');

function parseArgs(argv) {
  const o = { map: null, src: null, source: null, category: null, title: null, crop: 'auto', speed: 1, size: 400, fps: '30', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--map') o.map = v();
    else if (a === '--src') o.src = v();
    else if (a === '--source') o.source = v();
    else if (a === '--category') o.category = v();
    else if (a === '--title') o.title = v();
    else if (a === '--crop') o.crop = v();
    else if (a === '--speed') o.speed = Number(v());
    else if (a === '--size') o.size = Number(v());
    else if (a === '--fps') o.fps = v();
    else if (a === '--force') o.force = true;
  }
  return o;
}

/** CSV بسيط: فاصلة، مع دعم القيم بين علامتَي اقتباس. */
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
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row = {};
    head.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

/** اسم ملف آمن من المفتاح: يُبقي العربية كما هي (أنظمة الملفات الحديثة تدعمها). */
function fileNameFor(source, key) {
  return `${source}-${key.replace(/[^\p{L}\p{N}]+/gu, '_')}.mp4`;
}

function probe(src) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], { encoding: 'utf8' });
  const [w, h] = (r.stdout || '').trim().split(',').map(Number);
  return { w, h };
}

/** قصّ تلقائي: مربّع في منتصف الإطار بطول أصغر بُعد. */
function cropFilter(spec, src) {
  if (spec === 'none') return null; // بلا قصّ: يُحشى الإطار إلى مربّع في convert()
  if (spec && spec !== 'auto') return `crop=${spec}`;
  const { w, h } = probe(src);
  if (!w || !h || w === h) return null;
  const s = Math.min(w, h);
  return `crop=${s}:${s}:${Math.floor((w - s) / 2)}:${Math.floor((h - s) / 2)}`;
}

function convert(src, dst, o) {
  mkdirSync(dirname(dst), { recursive: true });
  const parts = [];
  const crop = cropFilter(o.crop, src);
  if (crop) parts.push(crop);
  if (o.crop === 'none') {
    // مصدر غير مربّع (مثل GIF 4:3): نحافظ على الإطار كاملًا ونحشو الباقي أسود.
    parts.push(
      `scale=${o.size}:${o.size}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${o.size}:${o.size}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  } else {
    parts.push(`scale=${o.size}:${o.size}`);
  }
  if (o.speed && o.speed !== 1) parts.push(`setpts=${(1 / o.speed).toFixed(4)}*PTS`);
  parts.push('format=yuv420p');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', parts.join(','), ...(o.fps === 'native' ? [] : ['-r', String(o.fps)]), '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'main', '-movflags', '+faststart', dst], { stdio: 'inherit' });
  return r.status === 0;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.map || !o.src || !o.source || !o.category) {
    console.error('المطلوب: --map map.csv --src <مجلّد> --source <معرّف> --category <فئة>');
    process.exit(1);
  }
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const rows = parseCsv(readFileSync(o.map, 'utf8'));
  const cats = new Map(plan.categories.map((c) => [c.id, c]));
  const byKey = new Map();
  for (const c of plan.categories) for (const w of c.words) byKey.set(w.key, { c, w });

  let done = 0, skipped = 0, missing = 0, failed = 0, added = 0;
  for (const r of rows) {
    if (!r.key || !r.file) continue;
    const key = normalize(r.key);
    const catId = r.category || o.category;
    // تُنشأ الفئة عند أوّل كلمة جديدة فيها فقط (لا فئات فارغة في الخطة).
    const catFor = (id) => {
      if (!cats.has(id)) {
        const c = { id, title: o.title || id, words: [] };
        plan.categories.push(c);
        cats.set(id, c);
      }
      return cats.get(id);
    };
    const srcFile = join(o.src, r.file);
    if (!existsSync(srcFile)) { missing++; continue; }

    let item = byKey.get(key)?.w;
    // عنصر لا يملك إلا تضمين يوتيوب (بلا مقطع محلي) لا يؤدّيه المترجم ثلاثي الأبعاد؛
    // نضيف له إشارة محلية من هذا المصدر (تتقدّم في القاموس لأن فئتها تأتي بعده).
    if (item && item.yt && !item.file) item = undefined;
    if (!item) {
      const cat = catFor(catId);
      item = { key, gloss: r.gloss || r.key, file: `words/${catId}/${fileNameFor(o.source, key)}`, source: o.source };
      cat.words.push(item);
      byKey.set(key, { c: cat, w: item });
      added++;
    } else if (!item.source && !item.karsl) {
      // عنصر مخطَّط للتصوير القطري ولم يُصوَّر بعد: نملأه من هذا المصدر مع نسبه.
      if (!existsSync(join(SIGN_DIR, item.file))) item.source = o.source;
    } else if (item.source !== o.source && !o.force) {
      // مصدر آخر يملك هذه الكلمة فعلًا — لا نستبدله إلا بـ --force.
      skipped++;
      continue;
    }
    const aliases = (r.aliases || '').split('|').map((a) => normalize(a)).filter(Boolean);
    if (aliases.length) item.aliases = [...new Set([...(item.aliases || []), ...aliases])];
    if (r.gloss) item.gloss = r.gloss;

    const dst = join(SIGN_DIR, item.file);
    if (existsSync(dst) && !o.force) { skipped++; continue; }
    process.stdout.write(`${key} ← ${r.file}\n`);
    if (convert(srcFile, dst, o)) { done++; if (item.source === o.source) item.source = o.source; }
    else failed++;
  }
  writeFileSync(PLAN, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  console.log(`\n✅ ${o.source}: ${done} مقطعًا محوَّلًا، ${added} عنصرًا جديدًا في الخطة، ${skipped} متخطًّى، ${missing} ملفًا مفقودًا، ${failed} فشل.`);
  console.log('   التالي: npm run sign:manifest');
}

main();
