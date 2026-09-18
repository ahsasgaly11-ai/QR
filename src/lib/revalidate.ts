import { getIdToken } from '@/lib/auth';

/**
 * يطلب من الخادم إعادة توليد صفحات المحتوى فورًا بعد رفع نشاط أو تعديل
 * البنية، فيراه جميع الزوّار في اللحظة نفسها بدل انتظار المهلة الدورية.
 *
 * لا يرمي خطأً أبدًا: فشل التحديث الفوري لا يجوز أن يُفشِل رفعًا نجح —
 * غايته تسريع الظهور لا أكثر، والصفحات ستلتقط الجديد لاحقًا على أي حال.
 */
export async function revalidateContent(opts: {
  subjectId?: string;
  activityId?: string;
}): Promise<boolean> {
  try {
    const token = await getIdToken();
    if (!token) return false;
    const res = await fetch('/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(opts),
    });
    return res.ok;
  } catch {
    return false;
  }
}
