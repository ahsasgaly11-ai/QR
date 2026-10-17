import { NextResponse } from 'next/server';
import { bearerToken, verifyOwnerToken } from '@/lib/server-auth';
import { MAX_DECK_TEXT } from '@/lib/deck-text';
import { toExtraction, type ExtractContext } from '@/lib/pedagogy-extract';
import { ExtractError, extractPedagogy } from '@/lib/pedagogy-extract-server';

// ---------------------------------------------------------------------------
// POST /api/extract-pedagogy  { text, kind?, title?, subject?, grade?, lesson? }
//   → { pedagogy, fromDeck }
//
// يستخرج الهدف التعليمي ونواتج التعلّم وأسئلة التقويم الختامي وطريقة التوظيف
// من نصّ ملف نشاط في أي قسم — عرض تقديمي، تجربة، لعبة تعزيز، مراجعة وحدة…
// (يُستخرج النصّ في متصفّح المشرف، فلا يُرسَل الملف).
// للمالك وحده: رمز الدخول في ترويسة Authorization ويُقارن بـ ADMIN_UID.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FIELD = 300;

export async function POST(req: Request) {
  if (!(await verifyOwnerToken(bearerToken(req)))) {
    return NextResponse.json({ error: 'غير مصرّح — هذه الخاصية متاحة لمالك المنصّة فقط.' }, { status: 403 });
  }

  let body: { text?: unknown } & Record<keyof ExtractContext, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 40) {
    return NextResponse.json({ error: 'لم يُعثر في الملف على نصّ كافٍ للتحليل.' }, { status: 422 });
  }
  if (text.length > MAX_DECK_TEXT + 1000) {
    return NextResponse.json({ error: 'نصّ الملف أطول من الحدّ المسموح.' }, { status: 413 });
  }
  const field = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : undefined);
  const ctx: ExtractContext = {
    kind: field(body.kind),
    title: field(body.title),
    subject: field(body.subject),
    grade: field(body.grade),
    lesson: field(body.lesson),
  };

  try {
    const extraction = toExtraction(await extractPedagogy(ctx, text));
    if (!extraction) {
      return NextResponse.json({ error: 'لم يُستخرج شيء صالح من هذا الملف.' }, { status: 422 });
    }
    return NextResponse.json(extraction);
  } catch (e) {
    if (e instanceof ExtractError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('extract-pedagogy', e);
    return NextResponse.json({ error: 'خطأ غير متوقّع أثناء التحليل.' }, { status: 500 });
  }
}
