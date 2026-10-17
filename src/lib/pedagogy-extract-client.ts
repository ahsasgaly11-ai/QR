// ---------------------------------------------------------------------------
// استخراج البيانات التربوية من ملف نشاط — جهة المتصفّح.
//
// يُستخرج نصّ الملف هنا (deck-text) ويُرسَل وحده إلى /api/extract-pedagogy،
// فلا يُرفع الملف نفسه مرّتين. يستخدمه نموذج الرفع ونموذج التعديل في كل
// الأقسام، وقسم «تدقيق المحتوى».
// ---------------------------------------------------------------------------

import { isFirebaseConfigured } from '@/lib/firebase';
import type { Activity } from '@/lib/types';
import type { ExtractContext, PedagogyExtraction } from '@/lib/pedagogy-extract';

/** يتطلّب حساب المالك (رمز الدخول)، أي Firebase مفعّلًا. */
export const canExtractPedagogy = isFirebaseConfigured;

/** اسم القسم كما يُعرَّف به النشاط للنموذج. */
export function activityKind(a: Pick<Activity, 'presentation' | 'unitReview' | 'smartReinforcement'>): string {
  if (a.presentation) return 'عرض تقديمي تفاعلي يشرح الدرس';
  if (a.unitReview) return 'لعبة مراجعة شاملة للوحدة';
  if (a.smartReinforcement) return 'لعبة تعزيز للمفاهيم والمهارات';
  return 'نشاط تفاعلي لدرس (تجربة أو محاكاة أو أسئلة أو لعبة)';
}

/** نصّ ملف نشاط مرفوع (من Firestore أو من هذا المتصفّح أو من public/games). */
export async function loadActivityHtml(a: Activity): Promise<string | null> {
  if (a.local) {
    const { getLocalRecord } = await import('@/lib/local-store');
    return (await getLocalRecord(a.id))?.html ?? null;
  }
  if (a.stored === 'firestore') {
    const { loadGameHtml } = await import('@/lib/game-store');
    return loadGameHtml(a.id);
  }
  const res = await fetch(a.external ? a.file : `/games/${a.file}`);
  return res.ok ? res.text() : null;
}

/** يرمي Error برسالة عربية تُعرض للمشرف كما هي. */
export async function requestPedagogyExtraction(html: string, ctx: ExtractContext): Promise<PedagogyExtraction> {
  const { getIdToken } = await import('@/lib/auth');
  const token = await getIdToken();
  if (!token) throw new Error('سجّل الدخول بحساب المالك أولًا (يتطلّب Firebase).');
  const { extractDeckText } = await import('@/lib/deck-text');
  const text = extractDeckText(html);
  const res = await fetch('/api/extract-pedagogy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, ...ctx }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<PedagogyExtraction> & { error?: string };
  if (!res.ok || !json.pedagogy) throw new Error(json.error || `تعذّر التحليل (${res.status}).`);
  return json as PedagogyExtraction;
}
