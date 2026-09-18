import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyOwnerToken, bearerToken } from '@/lib/server-auth';

// ---------------------------------------------------------------------------
// إعادة توليد فورية للصفحات بعد رفع نشاط أو تعديل بنية المناهج.
//
// بدونها تنتظر الصفحات مهلتها الدورية قبل أن تلتقط الجديد، فيبدو الرفع
// وكأنه لم ينجح. وبها يظهر المحتوى لكل الزوّار في اللحظة نفسها، دون أي
// قراءة إضافية من حصّة Firestore المجانية.
//
// الأمان: للمالك وحده — يُتحقّق من رمز الدخول ويُقارن بـ ADMIN_UID.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

/** المسارات التي تعرض المحتوى وتحتاج تحديثًا بعد أي تغيير. */
function pathsFor(subjectId?: string, activityId?: string): string[] {
  const paths = ['/', '/browse', '/search', '/dashboard'];
  if (subjectId) paths.push(`/subject/${subjectId}`);
  if (activityId) paths.push(`/play/${activityId}`);
  return paths;
}

export async function POST(req: Request) {
  if (!(await verifyOwnerToken(bearerToken(req)))) {
    return NextResponse.json({ error: 'غير مصرّح.' }, { status: 403 });
  }

  let body: { subjectId?: string; activityId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* جسم فارغ مقبول — تُحدَّث المسارات العامة */
  }

  const paths = pathsFor(body.subjectId, body.activityId);
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      /* مسار غير مولَّد بعد — تجاهل */
    }
  }

  return NextResponse.json({ ok: true, revalidated: paths });
}
