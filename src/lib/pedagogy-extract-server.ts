// ---------------------------------------------------------------------------
// استخراج البيانات التربوية من العرض — طبقة المزوّد (خادم فقط)
//
// كمزوّد الغلوس: ANTHROPIC_API_KEY ← Claude، وإلا GEMINI_API_KEY ← Gemini
// (الطبقة المجانية، مع التنقّل بين نماذج Flash عند الضغط أو نفاد الحصّة).
// الموجّه والمخطّط واحدان في الحالين (pedagogy-extract.ts).
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  EXTRACT_GEMINI_SCHEMA,
  EXTRACT_SYSTEM_PROMPT,
  ExtractedPedagogySchema,
  buildExtractUserMessage,
  type ExtractContext,
  type ExtractedPedagogy,
} from './pedagogy-extract';
import { demoteGeminiModel, isGeminiModelDemoted, readQuota, resolveGeminiModel } from './gemini-model';
import { CLAUDE_MODEL, glossProvider } from './sign-gloss-server';

export class ExtractError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** المزوّد نفسه الذي يخدم الغلوس — المفاتيح واحدة. */
export const extractProvider = glossProvider;

async function viaAnthropic(ctx: ExtractContext, deckText: string): Promise<ExtractedPedagogy> {
  const client = new Anthropic();
  try {
    const res = await client.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      // إن رفضت مصنّفات الأمان الطلب خطأً، يُكمله نموذج بديل في الطلب نفسه
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractedPedagogySchema) },
      system: [{ type: 'text', text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildExtractUserMessage(ctx, deckText) }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      throw new ExtractError('تعذّر استخراج البيانات من هذا العرض', 502);
    }
    return res.parsed_output;
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new ExtractError('النموذج مشغول، حاول بعد قليل', 429);
    if (e instanceof Anthropic.APIError) throw new ExtractError(`خطأ من النموذج (${e.status})`, 502);
    throw new ExtractError('خطأ غير متوقّع أثناء التحليل', 500);
  }
}

/** أقصى عدد تنقّلات بين نماذج Gemini في الطلب الواحد. */
const MAX_HOPS = 8;

async function viaGemini(ctx: ExtractContext, deckText: string, hops = 0): Promise<ExtractedPedagogy> {
  const key = process.env.GEMINI_API_KEY!;
  const model = await resolveGeminiModel(key);
  if (hops > 0 && isGeminiModelDemoted(model)) {
    throw new ExtractError('نماذج Gemini مشغولة أو نفدت حصّتها اليوم، حاول لاحقًا', 429);
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: EXTRACT_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildExtractUserMessage(ctx, deckText) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: EXTRACT_GEMINI_SCHEMA,
      },
    }),
  });
  // نموذج غير متاح للمفتاح، أو «ضغط عالٍ»، أو نفاد حصّته اليومية: انتقل إلى البديل
  if (res.status === 404 && hops < MAX_HOPS && demoteGeminiModel(model, 24 * 3600 * 1000)) {
    return viaGemini(ctx, deckText, hops + 1);
  }
  if (res.status === 503) {
    if (hops < MAX_HOPS && demoteGeminiModel(model)) return viaGemini(ctx, deckText, hops + 1);
    throw new ExtractError('نموذج Gemini مشغول حاليًّا، حاول بعد قليل', 503);
  }
  if (res.status === 429) {
    const q = await readQuota(res);
    if (q.daily && hops < MAX_HOPS && demoteGeminiModel(model, q.retryMs || 24 * 3600 * 1000)) {
      return viaGemini(ctx, deckText, hops + 1);
    }
    throw new ExtractError(
      q.daily ? 'نفدت الحصّة اليومية المجانية لنماذج Gemini، تتجدّد غدًا' : 'بلغ مفتاح Gemini حدّه مؤقّتًا، حاول بعد دقيقة',
      429
    );
  }
  if (!res.ok) {
    console.error('extract-pedagogy: gemini', res.status, (await res.text()).slice(0, 300));
    throw new ExtractError(`خطأ من Gemini (${res.status})`, 502);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExtractError('مخرج Gemini ليس JSON صالحًا', 502);
  }
  const r = ExtractedPedagogySchema.safeParse(parsed);
  if (!r.success) throw new ExtractError('مخرج Gemini لا يطابق المخطّط', 502);
  return r.data;
}

/** يستخرج البيانات التربوية بالمزوّد المتاح. يرمي ExtractError بحالة HTTP مناسبة. */
export async function extractPedagogy(ctx: ExtractContext, deckText: string): Promise<ExtractedPedagogy> {
  const provider = extractProvider();
  if (!provider) {
    throw new ExtractError('لم يُضبط مفتاح نموذج على الخادم (ANTHROPIC_API_KEY أو GEMINI_API_KEY)', 501);
  }
  return provider === 'anthropic' ? viaAnthropic(ctx, deckText) : viaGemini(ctx, deckText);
}
