import { NextResponse } from 'next/server';
import { verifyOwnerToken } from '@/lib/server-auth';

// ---------------------------------------------------------------------------
// قراءة صورة فهرس الكتاب وتحويلها إلى نص (OCR بصري عبر Gemini).
//
// الأمان: المسار محمي بحساب المالك وحده —
//   1) يتحقّق من صحة رمز الدخول (ID token) عبر Google Identity Toolkit.
//   2) يقارن المعرّف الناتج بـ ADMIN_UID (متغيّر بيئة على الخادم فقط).
// إن لم يُضبط ADMIN_UID يُرفض الطلب (fail-closed).
//
// المفتاح GEMINI_API_KEY متغيّر خادم (بلا NEXT_PUBLIC_) فلا يظهر للزوّار.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const PROMPT = `هذه صفحات فهرس (جدول محتويات) من كتاب مدرسي عربي.
قد تكون أكثر من صفحة — عالِجها بالترتيب المُعطى وأخرِج فهرسًا واحدًا متصلًا.
استخرج أسطر الفهرس فقط كنص عادي، سطرًا لكل عنصر، بالترتيب نفسه.
- اكتب النص العربي كما هو تمامًا بما في ذلك التشكيل إن وُجد.
- أبقِ ترقيم الوحدات والدروس (مثل: الوحدة 1، الدرس 2.3).
- احذف نقاط الفهرس المتتابعة وأرقام الصفحات.
- لا تضف أي شرح أو تعليق أو ترقيم من عندك.
أخرج النص فقط.`;

/** وضع «وحدة واحدة»: صورة صفحة افتتاح الوحدة أو جزء الفهرس الخاص بها. */
const UNIT_PROMPT = `هذه صورة (أو صور) لوحدة دراسية واحدة من كتاب مدرسي عربي —
قد تكون صفحة افتتاح الوحدة، أو جزء الفهرس الخاص بها، أو صفحة «محتويات الوحدة».
استخرج منها:
- title: عنوان الوحدة كما هو مكتوب، مع رقمها إن وُجد (مثل: الوحدة 3: الطاقة).
- summary: جملة أو جملتان تصفان الوحدة إن ظهر لها وصف أو مقدّمة في الصورة، وإلا فاتركه فارغًا. لا تخترع وصفًا.
- lessons: عناوين الدروس بالترتيب نفسه، كما هي تمامًا مع ترقيمها (مثل: 3.1 ما الطاقة؟). أدرِج دروس المراجعة مثل «ماذا أستطيع أن أفعل؟» إن وُجدت.
اكتب النص العربي كما هو بما في ذلك التشكيل، واحذف نقاط الفهرس وأرقام الصفحات.
لا تضف دروسًا غير موجودة في الصورة.`;

const UNIT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    lessons: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'lessons'],
};


export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'لم يُضبط GEMINI_API_KEY على الخادم. استخدم خيار لصق النص بدلًا من ذلك.' },
      { status: 501 }
    );
  }

  interface FilePart {
    data: string;
    mimeType?: string;
  }
  let body: {
    /** ملف واحد (توافق مع النسخة السابقة) */
    image?: string;
    mimeType?: string;
    /** عدّة ملفات: صور فهرس متعدّدة الصفحات أو ملف PDF */
    files?: FilePart[];
    idToken?: string;
    /** 'index' (الافتراضي): نص الفهرس كاملًا · 'unit': وحدة واحدة منظّمة */
    mode?: 'index' | 'unit';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
  }

  if (!(await verifyOwnerToken(body.idToken ?? ''))) {
    return NextResponse.json(
      { error: 'غير مصرّح — هذه الخاصية متاحة لمالك المنصّة فقط.' },
      { status: 403 }
    );
  }

  // وحّد المدخلات: ملف واحد أو عدّة ملفات
  const incoming: FilePart[] =
    body.files && body.files.length
      ? body.files
      : body.image
        ? [{ data: body.image, mimeType: body.mimeType }]
        : [];

  const MAX_FILES = 8;
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'لم تُرفق أي ملفات.' }, { status: 400 });
  }
  if (incoming.length > MAX_FILES) {
    return NextResponse.json(
      { error: `الحد الأقصى ${MAX_FILES} ملفات في المرة الواحدة.` },
      { status: 400 }
    );
  }

  const parts = incoming.map((f) => ({
    mimeType: f.mimeType || 'image/jpeg',
    data: (f.data ?? '').replace(/^data:[^;]+;base64,/, ''),
  }));

  if (parts.some((p) => !p.data)) {
    return NextResponse.json({ error: 'أحد الملفات فارغ.' }, { status: 400 });
  }

  const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
  const bad = parts.find((p) => !ALLOWED.test(p.mimeType));
  if (bad) {
    return NextResponse.json(
      { error: `نوع ملف غير مدعوم: ${bad.mimeType}` },
      { status: 415 }
    );
  }

  // حدّ أقصى ~15 ميجابايت إجمالًا
  const totalBytes = parts.reduce((n, p) => n + p.data.length / 1.37, 0);
  if (totalBytes > 15 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'حجم الملفات كبير جدًا (الحد 15 ميجابايت إجمالًا).' },
      { status: 413 }
    );
  }

  const unitMode = body.mode === 'unit';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: unitMode ? UNIT_PROMPT : PROMPT },
                ...parts.map((p) => ({
                  inline_data: { mime_type: p.mimeType, data: p.data },
                })),
              ],
            },
          ],
          generationConfig: unitMode
            ? {
                temperature: 0,
                responseMimeType: 'application/json',
                responseSchema: UNIT_SCHEMA,
              }
            : { temperature: 0 },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: 'تعذّر تحليل الصورة.', detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'لم يُستخرج نص من الصورة. جرّب صورة أوضح أو الصق النص يدويًا.' },
        { status: 422 }
      );
    }

    if (unitMode) {
      try {
        const parsed = JSON.parse(text) as {
          title?: unknown;
          summary?: unknown;
          lessons?: unknown;
        };
        const unit = {
          title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
          summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
          lessons: Array.isArray(parsed.lessons)
            ? parsed.lessons
                .filter((l): l is string => typeof l === 'string')
                .map((l) => l.trim())
                .filter(Boolean)
            : [],
        };
        if (!unit.title && unit.lessons.length === 0) {
          return NextResponse.json(
            { error: 'لم نتعرّف على وحدة أو دروس في الصورة. جرّب صورة أوضح.' },
            { status: 422 }
          );
        }
        return NextResponse.json({ unit });
      } catch {
        // لم يلتزم النموذج بالصيغة — أعِد النص الخام ليحلّله المتصفّح
        return NextResponse.json({ text });
      }
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: 'خطأ أثناء الاتصال بخدمة التحليل.' }, { status: 502 });
  }
}
