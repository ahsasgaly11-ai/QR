// ---------------------------------------------------------------------------
// استخراج البيانات التربوية من نصّ العرض التقديمي — الموجّه والمخطّط.
//
// مشترك بين مزوّدَي النموذج (Claude / Gemini) وبين الخادم والمتصفّح، فتصل
// النتيجة بالشكل نفسه أيًّا كان المزوّد، ثم تُنظَّف بـ normalizePedagogy قبل
// أن تُعرض على المشرف أو تُحفظ.
// ---------------------------------------------------------------------------

import { z } from 'zod/v4';
import { normalizePedagogy, PEDAGOGY_LIMITS } from './pedagogy';
import type { Pedagogy } from './types';

export const ExtractedQuestionSchema = z.object({
  /** نصّ السؤال */
  q: z.string(),
  /** 2 إلى 4 خيارات */
  options: z.array(z.string()),
  /** فهرس الإجابة الصحيحة (يبدأ من 0) */
  answer: z.number().int(),
  /** السؤال وإجابته موجودان في العرض (لا مقترحان) */
  fromDeck: z.boolean(),
});

export const ExtractedPedagogySchema = z.object({
  objective: z.string(),
  /** الهدف مكتوب في العرض (شريحة الأهداف) لا مُستنتَج */
  objectiveFromDeck: z.boolean(),
  outcomes: z.array(z.string()),
  outcomesFromDeck: z.boolean(),
  phase: z.enum(['before', 'during', 'after']),
  /** المدة المقترحة بالدقائق */
  duration: z.number().int(),
  usage: z.string(),
  support: z.string(),
  exitTicket: z.array(ExtractedQuestionSchema),
});

export type ExtractedPedagogy = z.infer<typeof ExtractedPedagogySchema>;

/** ما يعود من مسار الاستخراج: البيانات منظّفة + من أين جاء كل جزء. */
export interface PedagogyExtraction {
  pedagogy: Pedagogy;
  fromDeck: { objective: boolean; outcomes: boolean; questions: boolean[] };
}

export const EXTRACT_SYSTEM_PROMPT = `أنت مساعد تربوي لمنصّة مناهج قطر. يصلك نصّ عرض تقديمي تفاعلي لدرس واحد (مستخرَج من الشرائح، سطرًا لكل نصّ)، وتستخرج منه البيانات التربوية للدرس باللغة العربية الفصحى.

النصّ يحوي أيضًا عبارات واجهة العرض نفسه (مثل: ابدأ العرض، الشريحة التالية، ملء الشاشة، اضغط لعرض الإجابة، تحرير الإجابات) — تجاهلها تمامًا.

الحقول:
- objective: الهدف التعليمي العام للدرس في جملة واحدة (حتى ${PEDAGOGY_LIMITS.objective} حرفًا). إن وُجدت في العرض شريحة «أهداف الدرس» أو «الهدف» فصُغه منها، واجعل objectiveFromDeck صحيحًا. وإلا فاستنتجه من محتوى الشرائح واجعله خطأ.
- outcomes: نواتج التعلّم (حتى ${PEDAGOGY_LIMITS.outcomes}، كل ناتج حتى ${PEDAGOGY_LIMITS.outcome} حرفًا) بصيغة «يصف…/يذكر…/يميّز…». انقل أهداف العرض كما كُتبت بلا تعديل إن وُجدت (outcomesFromDeck صحيح)، وإلا فاستنتجها من المحتوى (خطأ).
- exitTicket: من 1 إلى ${PEDAGOGY_LIMITS.questions} أسئلة تقويم ختامي اختيار من متعدّد تقيس النواتج. فضّل أسئلة العرض نفسه (اختيار من متعدّد، صواب وخطأ، أسئلة «فكّر» مع «الإجابة المتوقعة») مع إجاباتها كما في العرض، واجعل fromDeck صحيحًا. السؤال المفتوح في العرض حوّله إلى اختيار من متعدّد: الإجابة المتوقعة في العرض هي الخيار الصحيح، ومشتّتات معقولة من محتوى الدرس نفسه. السؤال حتى ${PEDAGOGY_LIMITS.question} حرفًا، والخيارات من 2 إلى ${PEDAGOGY_LIMITS.options} كلٌّ حتى ${PEDAGOGY_LIMITS.option} حرفًا، وanswer فهرس الخيار الصحيح بدءًا من 0. نوّع موضع الإجابة الصحيحة ولا تجعلها الأولى دائمًا. لا تخترع معلومة علمية غير موجودة في العرض.
- phase: موضع توظيف العرض في الدرس: before (تهيئة) أو during (بناء المفهوم) أو after (تثبيت وتقويم). العرض الذي يشرح الدرس كاملًا during.
- duration: المدة المقترحة بالدقائق لعرضه في الحصّة (بين 10 و${PEDAGOGY_LIMITS.durationMax}).
- usage: كيف يوظّف المعلّم العرض في الصف، في خطوات قصيرة مرقّمة (حتى ${PEDAGOGY_LIMITS.usage} حرفًا)، مستندًا إلى أنشطة العرض الفعلية (التجارب، المحاكاة، الألعاب، الأسئلة).
- support: مراعاة الفروق الفردية: دعم المتعثّرين وإثراء المتفوّقين بما يتيحه العرض (حتى ${PEDAGOGY_LIMITS.support} حرفًا).

اكتب النصّ العربي سليمًا بلا رموز تعبيرية.`;

/** رسالة المستخدم: سياق الدرس ثم نصّ العرض. */
export function buildExtractUserMessage(ctx: ExtractContext, deckText: string): string {
  const head = [
    ctx.title && `عنوان العرض: ${ctx.title}`,
    ctx.subject && `المادة: ${ctx.subject}`,
    ctx.grade && `المستوى: ${ctx.grade}`,
    ctx.lesson && `الدرس: ${ctx.lesson}`,
  ]
    .filter(Boolean)
    .join('\n');
  return `${head}\n\nنصّ العرض:\n<deck>\n${deckText}\n</deck>`;
}

export interface ExtractContext {
  title?: string;
  subject?: string;
  grade?: string;
  lesson?: string;
}

/** مخطّط JSON لـ Gemini (مجموعة OpenAPI الجزئية التي يدعمها responseSchema). */
export const EXTRACT_GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    objective: { type: 'STRING' },
    objectiveFromDeck: { type: 'BOOLEAN' },
    outcomes: { type: 'ARRAY', items: { type: 'STRING' } },
    outcomesFromDeck: { type: 'BOOLEAN' },
    phase: { type: 'STRING', enum: ['before', 'during', 'after'] },
    duration: { type: 'INTEGER' },
    usage: { type: 'STRING' },
    support: { type: 'STRING' },
    exitTicket: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          q: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answer: { type: 'INTEGER' },
          fromDeck: { type: 'BOOLEAN' },
        },
        required: ['q', 'options', 'answer', 'fromDeck'],
      },
    },
  },
  required: [
    'objective',
    'objectiveFromDeck',
    'outcomes',
    'outcomesFromDeck',
    'phase',
    'duration',
    'usage',
    'support',
    'exitTicket',
  ],
} as const;

/**
 * ينظّف مخرج النموذج إلى الشكل المحفوظ. الأسئلة غير الصالحة (خيار واحد،
 * فهرس إجابة خارج الخيارات) تُسقط مع علامتها، فتبقى العلامات مطابقة للأسئلة.
 */
export function toExtraction(raw: ExtractedPedagogy): PedagogyExtraction | null {
  const kept = raw.exitTicket.filter((q) => normalizePedagogy({ exitTicket: [q] })?.exitTicket?.length);
  const pedagogy = normalizePedagogy({ ...raw, exitTicket: kept });
  if (!pedagogy) return null;
  return {
    pedagogy,
    fromDeck: {
      objective: raw.objectiveFromDeck,
      outcomes: raw.outcomesFromDeck,
      questions: kept.slice(0, PEDAGOGY_LIMITS.questions).map((q) => q.fromDeck),
    },
  };
}
