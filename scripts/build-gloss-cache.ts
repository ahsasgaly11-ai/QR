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
import { join } from 'node:path';
import { GLOSS_VERSION, glossCacheKey, type Gloss } from '../src/lib/sign-gloss';
import { GlossError, generateGloss, glossModelName, glossProvider } from '../src/lib/sign-gloss-server';
import { PEDAGOGY_PACK } from '../src/data/pedagogy-pack';

// يُشغَّل من جذر المستودع عبر npm run sign:gloss (tsx).
const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'sign', 'gloss-cache.json');
const force = process.argv.includes('--force');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function texts(): string[] {
  // نصوص اللوحة = «العنوان. الوصف» لكل نشاط (كما يبنيها SignLanguagePanel)، والعنوان وحده.
  const out = new Set<string>();
  for (const e of Object.values(PEDAGOGY_PACK)) {
    const joined = [e.title, e.description].filter(Boolean).join('. ');
    if (joined) out.add(joined);
    if (e.title) out.add(e.title);
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
    words?: Record<string, { video?: string; pose?: number }>;
  };
  // المترجم ثلاثي الأبعاد يؤدّي ما له مقطع محلي (حركة مستخلصة) فقط؛ فالمفردات المتاحة
  // للنموذج هي هذه، ليختار أقرب إشارة متاحة بدل مفتاح لا يُؤدّى فيُهجّى.
  const keys = Object.entries(manifest.words ?? {})
    .filter(([, e]) => !!e.video && !!e.pose)
    .map(([k]) => k)
    .sort();
  const vocab = new Set(keys);

  let cache: { version: number; items: Record<string, Gloss & { text: string; model?: string }> } = {
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
        if (e instanceof GlossError && e.daily) {
          writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8');
          console.error(`\n⏸ ${e.message}. ما حُسب محفوظ (${done} جديد)؛ أعد التشغيل بعد التجديد لإكمال الباقي.`);
          process.exit(3);
        }
        if ((status === 429 || status === 503) && attempt < 3) {
          const wait = status === 503 ? 45000 : 30000;
          console.log(`  ⏳ ${status === 503 ? 'النموذج مشغول' : 'حدّ الطلبات'} — انتظار ${wait / 1000} ثانية (محاولة ${attempt})`);
          await sleep(wait);
          continue;
        }
        console.error('❌', text.slice(0, 60), e instanceof Error ? e.message : e);
        // خطأ إعداد (مفتاح غير صالح، صلاحية، طلب مرفوض): لا فائدة من إكمال بقية النصوص.
        if (status === 400 || status === 401 || status === 403 || status === 404) {
          console.error('\n⛔ توقّف: الخطأ يخصّ الإعداد لا النصّ. أصلحه ثم أعد التشغيل (ما حُسب محفوظ).');
          process.exit(2);
        }
        break;
      }
    }
    if (!gloss) {
      failed++;
      continue;
    }
    cache.items[key] = { ...gloss, text, model: glossModelName() };
    done++;
    const signed = gloss.items.filter((i) => i.key).length;
    console.log(`${done + reused}/${all.length} ${text.slice(0, 50)}… → ${signed} إشارة، ${gloss.items.length - signed} تهجئة`);
    writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8'); // حفظ تدريجي
    await sleep(pauseMs);
  }
  writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8');
  console.log(`\nالنموذج المستخدَم: ${glossModelName()}`);
  console.log(`✅ الغلوس: ${done} جديد، ${reused} معاد استخدامه، ${failed} فشل → ${OUT}`);
  if (failed > 0 && done === 0 && reused === 0) {
    console.error('⛔ لم ينجح أي نصّ — الخطأ على الأرجح في الإعداد لا في النصوص.');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
