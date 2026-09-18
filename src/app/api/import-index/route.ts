import { NextResponse } from 'next/server';

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

const PROMPT = `هذه صورة فهرس (جدول محتويات) من كتاب مدرسي عربي.
استخرج أسطر الفهرس فقط كنص عادي، سطرًا لكل عنصر، بالترتيب نفسه.
- اكتب النص العربي كما هو تمامًا بما في ذلك التشكيل إن وُجد.
- أبقِ ترقيم الوحدات والدروس (مثل: الوحدة 1، الدرس 2.3).
- احذف نقاط الفهرس المتتابعة وأرقام الصفحات.
- لا تضف أي شرح أو تعليق أو ترقيم من عندك.
أخرج النص فقط.`;

async function verifyOwner(idToken: string): Promise<boolean> {
  const adminUid = process.env.ADMIN_UID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!adminUid || !apiKey || !idToken) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: { localId?: string }[] };
    return data.users?.[0]?.localId === adminUid;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'لم يُضبط GEMINI_API_KEY على الخادم. استخدم خيار لصق النص بدلًا من ذلك.' },
      { status: 501 }
    );
  }

  let body: { image?: string; mimeType?: string; idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
  }

  if (!(await verifyOwner(body.idToken ?? ''))) {
    return NextResponse.json(
      { error: 'غير مصرّح — هذه الخاصية متاحة لمالك المنصّة فقط.' },
      { status: 403 }
    );
  }

  const base64 = (body.image ?? '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) {
    return NextResponse.json({ error: 'لم تُرفق صورة.' }, { status: 400 });
  }
  // حدّ أقصى ~8 ميجابايت للصورة
  if (base64.length > 8 * 1024 * 1024 * 1.37) {
    return NextResponse.json({ error: 'الصورة كبيرة جدًا (الحد 8 ميجابايت).' }, { status: 413 });
  }

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
                { text: PROMPT },
                {
                  inline_data: {
                    mime_type: body.mimeType || 'image/jpeg',
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
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

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: 'خطأ أثناء الاتصال بخدمة التحليل.' }, { status: 502 });
  }
}
