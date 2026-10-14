// ---------------------------------------------------------------------------
// يحسب الغلوس الإشاري مسبقًا لكل نصوص الأنشطة المعروفة (العنوان + الوصف من
// الحزمة التربوية) عبر Claude، ويكتبها في public/sign/gloss-cache.json فيعمل
// «الترتيب الإشاري الذكي» في المنصّة بلا أي استدعاء وقت التشغيل.
//
//   ANTHROPIC_API_KEY=... node --experimental-strip-types scripts/build-gloss-cache.mts [--force]
//
// يعيد استخدام ما حُسب سابقًا (مفتاح = تجزئة النصّ المُطبَّع + إصدار الغلوس)،
// فلا يُستدعى النموذج إلا للنصوص الجديدة أو المتغيّرة. التكلفة التقريبية:
// ~4 آلاف رمز إدخال (المفردات، مخزّنة مؤقّتًا) + النصّ لكل نشاط.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  GLOSS_SYSTEM_PROMPT,
  GLOSS_VERSION,
  GlossSchema,
  buildGlossUserMessage,
  glossCacheKey,
  sanitizeGloss,
  type Gloss,
} from '../src/lib/sign-gloss.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'sign', 'gloss-cache.json');
const MODEL = 'claude-opus-5-5';
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;
const force = process.argv.includes('--force');

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('يلزم ANTHROPIC_API_KEY لحساب الغلوس.');
    process.exit(1);
  }
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

  const client = new Anthropic();
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
    const words = text.match(WORD_RE) ?? [];
    try {
      const res = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: 'medium', format: zodOutputFormat(GlossSchema) },
        system: [{ type: 'text', text: GLOSS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildGlossUserMessage(text, keys, words) }],
      });
      if (res.stop_reason === 'refusal' || !res.parsed_output) {
        failed++;
        console.error('⚠️ لم يُنتَج غلوس:', text.slice(0, 60));
        continue;
      }
      const gloss = sanitizeGloss(res.parsed_output, vocab, words.length);
      cache.items[key] = { ...gloss, text };
      done++;
      const signed = gloss.items.filter((i) => i.key).length;
      console.log(`${done + reused}/${all.length} ${text.slice(0, 50)}… → ${signed} إشارة، ${gloss.items.length - signed} تهجئة`);
      writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8'); // حفظ تدريجي
    } catch (e) {
      failed++;
      console.error('❌', text.slice(0, 60), e instanceof Error ? e.message : e);
    }
  }
  writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n', 'utf8');
  console.log(`\n✅ الغلوس: ${done} جديد، ${reused} معاد استخدامه، ${failed} فشل → ${OUT}`);
}

main();
