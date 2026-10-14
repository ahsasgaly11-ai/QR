// ---------------------------------------------------------------------------
// نموذج الغلوس — طبقة المزوّد (خادم فقط)
//
// يختار المزوّد تلقائيًّا بحسب المفاتيح المتاحة:
//   • ANTHROPIC_API_KEY  → Claude (مخرج منظّم عبر zod)
//   • GEMINI_API_KEY     → Gemini (الطبقة المجانية من Google AI Studio، مخرج JSON بمخطّط)
// الموجّه والمخطّط والتحقّق واحدة في الحالين (sign-gloss.ts)، فالنتيجة بالشكل نفسه.
// تُستخدم من مسار /api/sign/gloss ومن سكربت الحساب المسبق.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  GLOSS_SYSTEM_PROMPT,
  GlossSchema,
  buildGlossUserMessage,
  sanitizeGloss,
  type Gloss,
} from './sign-gloss';
import { currentGeminiModel, demoteGeminiModel, forgetGeminiModel, resolveGeminiModel } from './gemini-model';

export type GlossProvider = 'anthropic' | 'gemini';

export const CLAUDE_MODEL = 'claude-opus-5-5';

export function glossProvider(): GlossProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function glossModelName(): string {
  const p = glossProvider();
  if (p === 'anthropic') return CLAUDE_MODEL;
  if (p === 'gemini') return currentGeminiModel();
  return '';
}

const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;

export class GlossError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** مخطّط JSON لـ Gemini (مجموعة OpenAPI الجزئية التي يدعمها responseSchema). */
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          word: { type: 'STRING' },
          from: { type: 'INTEGER' },
          to: { type: 'INTEGER' },
          spell: { type: 'STRING' },
        },
        required: ['key', 'word', 'from', 'to'],
      },
    },
    note: { type: 'STRING' },
  },
  required: ['items'],
} as const;

async function viaAnthropic(text: string, keys: string[], words: string[]): Promise<Gloss> {
  const client = new Anthropic();
  try {
    const res = await client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: zodOutputFormat(GlossSchema) },
      system: [{ type: 'text', text: GLOSS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildGlossUserMessage(text, keys, words) }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      throw new GlossError('تعذّر توليد الغلوس', 502);
    }
    return res.parsed_output;
  } catch (e) {
    if (e instanceof GlossError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new GlossError('النموذج مشغول، حاول لاحقًا', 429);
    if (e instanceof Anthropic.APIError) throw new GlossError(`خطأ من النموذج (${e.status})`, 502);
    throw new GlossError('خطأ غير متوقّع', 500);
  }
}

async function viaGemini(text: string, keys: string[], words: string[], retried = false, hops = 0): Promise<Gloss> {
  const key = process.env.GEMINI_API_KEY!;
  // يُختار تلقائيًّا أحدث نموذج Flash متاح للمفتاح (Google تُوقف القديمة للمفاتيح الجديدة)
  const model = await resolveGeminiModel(key);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GLOSS_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildGlossUserMessage(text, keys, words) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    }
  );
  if (res.status === 404 && !retried && !process.env.GEMINI_MODEL?.trim()) {
    // النموذج المختار لم يعد متاحًا: أعد الاكتشاف مرّة واحدة
    forgetGeminiModel();
    return viaGemini(text, keys, words, true, hops);
  }
  if (res.status === 503) {
    // «ضغط عالٍ» على النموذج: انتقل إلى أفضل نموذج Flash بديل (حتى بديلين)
    if (hops < 2 && demoteGeminiModel(model)) return viaGemini(text, keys, words, retried, hops + 1);
    throw new GlossError(`نموذج Gemini (${model}) مشغول حاليًّا، حاول بعد قليل`, 503);
  }
  if (res.status === 429) throw new GlossError('بلغ مفتاح Gemini حدّ الطبقة المجانية مؤقّتًا، حاول بعد دقيقة', 429);
  if (!res.ok) {
    // رسالة Gemini نفسها (لا تحوي المفتاح) تفيد في التشخيص: مفتاح غير صالح، نموذج غير متاح…
    let detail = '';
    try {
      const err = (await res.json()) as { error?: { message?: string; status?: string } };
      detail = [err.error?.status, err.error?.message].filter(Boolean).join(': ').slice(0, 200);
    } catch {
      /* لا جسم JSON */
    }
    throw new GlossError(
      `خطأ من Gemini (${res.status}، النموذج ${model})${detail ? ` — ${detail}` : ''}`,
      res.status === 400 || res.status === 403 || res.status === 404 ? res.status : 502
    );
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GlossError('مخرج Gemini ليس JSON صالحًا', 502);
  }
  const g = GlossSchema.safeParse(parsed);
  if (!g.success) throw new GlossError('مخرج Gemini لا يطابق المخطّط', 502);
  return g.data;
}

/**
 * يولّد الغلوس للنصّ بالمزوّد المتاح، ويتحقّق من كل مفتاح ضدّ القاموس.
 * يرمي GlossError بحالة HTTP مناسبة (503 بلا مفتاح، 429 عند الحدّ، 502 عند فشل النموذج).
 */
export async function generateGloss(text: string, vocabKeys: string[], vocab: Set<string>): Promise<Gloss> {
  const provider = glossProvider();
  if (!provider) throw new GlossError('نموذج الغلوس غير مفعّل على الخادم', 503);
  const words = text.match(WORD_RE) ?? [];
  const raw = provider === 'anthropic' ? await viaAnthropic(text, vocabKeys, words) : await viaGemini(text, vocabKeys, words);
  return sanitizeGloss(raw, vocab, words.length);
}
