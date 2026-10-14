// ---------------------------------------------------------------------------
// يحسب الغلوس الإشاري مسبقًا لكل نصوص الأنشطة المعروفة (العنوان + الوصف من
// الحزمة التربوية) ويكتبها في public/sign/gloss-cache.json، فيعمل «الترتيب
// الإشاري الذكي» في المنصّة بلا أي استدعاء وقت التشغيل.
//
//   # بمفتاح Gemini المجاني (Google AI Studio):
//   GEMINI_API_KEY=... npm run sign:gloss
//   # أو بمفتاح Claude:
//   ANTHROPIC_API_KEY=... npm run sign:gloss
//
// يعيد استخدام ما حُسب سابقًا (مفتاح = تجزئة النصّ المُطبَّع + إصدار الغلوس)،
// فلا يُستدعى النموذج إلا للنصوص الجديدة أو المتغيّرة. مع Gemini المجاني يراعي
// حدّ الطلبات في الدقيقة (مهلة بين الاستدعاءات وإعادة محاولة عند 429).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOSS_VERSION, glossCacheKey, type Gloss } from '../src/lib/sign-gloss.ts';
import { GlossError, generateGloss, glossModelName, glossProvider } from '../src/lib/sign-gloss-server.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'sign', 'gloss-cache.json');
const force = process.argv.includes('--force');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function texts(): string[] {
  // نصوص اللوحة = العنوان + الوصف لكل نشاط (كما يبنيها SignLanguagePanel)
  const src = readFileSync(join(ROOT, 'src', 'data', 'pedagogy-pack.ts'), 'utf8');
  const blocks = src.split(/\n\s*\{\s*\n/).slice(1);
  const out = new Set<string>();
  for (const b of blocks) {
    const t = b.match(/title:\s*'([^']+)'/)?.[1];
    const d = b.match(/description:\s*'([^']+)'/)?.[1];
    const joined = [t, d].filter(Boolean).join('. ');
    if (joined) out.add(joined);
    if (t) out.add(t);
  }
  return [...out];
}

async function main() {
  const provider = glossProvider();
  if (!provider) {
    console.error('يلزم GEMINI_API_KEY (مجاني من aistudio.google.com) أو ANTHROPIC_API_KEY لحساب الغلوس.');
    process.exit(1);
  }
  console.log(`المزوّد: ${provider} — النموذج: ${glossModelName()}`);
  // الطبقة المجانية من Gemini محدودة بعدد طلبات في الدقيقة؛ نترك مهلة بين الاستدعاءات.
  const pauseMs = provider === 'gemini' ? 7000 : 500;

  const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'sign', 'manifest.json'), 'utf8')) as {
    words?: Record<string, unknown>;
  };
  const keys = Object.keys(manifest.words ?? {}).sort();
  const vocab = new Set(keys);

  let cache: { version: number; items: Record<string, Gloss & { text: string }> } = {
    version: GLOSS_VERSION,
    items: {},
  };
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'));
    if (prev.version === GLOSS_VERSION && !force) cache = prev;
  } catch {
    /* لا ملف سابق */
  }

  const all = texts();
  let done = 0,
    reused = 0,
    failed = 0;
  for (const text of all) {
    const key = glossCacheKey(text);
    if (cache.items[key]) {
      reused++;
      continue;
    }
    let gloss: Gloss | null = null;
    for (let attempt = 1; attempt <= 3 && !gloss; attempt++) {
      try {
        gloss = await generateGloss(text, keys, vocab);
      } catch (e) {
        const status = e instanceof GlossError ? e.status : 500;
        if (status === 429 && attempt < 3) {
          console.log(`  ⏳ حدّ الطلبات — انتظار 30 ثانية (محاولة ${attempt})`);
          await sleep(30000);
          continue;
        }
        console.error('❌', text.slice(0, 60), e instanceof Error ? e.message : e);
        break;
      }
    }
    if (!gloss) {
      failed++;
      continue;
    }
    cache.items[key] = { ...gloss, text };
    done++;
    const signed = gloss.items.filter((i) => i.key).length;
    console.log(`${done + reused}/${all.length} ${text.slice(0, 50)}… → ${signed} إشارة، ${gloss.items.length - signed} تهجئة`);
    writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8'); // حفظ تدريجي
    await sleep(pauseMs);
  }
  writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8');
  console.log(`\n✅ الغلوس: ${done} جديد، ${reused} معاد استخدامه، ${failed} فشل → ${OUT}`);
}

main();
