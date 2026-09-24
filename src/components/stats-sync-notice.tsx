'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getSyncProblem, onSyncChange, type SyncProblem } from '@/lib/stats-sync';

/**
 * تنبيه يظهر فقط عندما لا تصل الإحصاءات إلى Firestore — فتبقى محصورة في
 * متصفّح من لعب/حمّل ولا يراها المشرف ولا بقيّة المستخدمين.
 */
export function StatsSyncNotice() {
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setProblem(getSyncProblem());
    sync();
    return onSyncChange(sync);
  }, []);

  if (!mounted) return null;

  let title: string;
  let body: string;
  if (!isFirebaseConfigured) {
    title = 'الإحصاءات تعمل في وضع العرض المحلي';
    body =
      'متغيّرات Firebase غير مضبوطة في هذا النشر، لذا تُحتسب المشاهدات والتنزيلات والخريطة الحرارية في هذا المتصفّح فقط. أضِف متغيّرات NEXT_PUBLIC_FIREBASE_* في إعدادات الاستضافة ثم أعد النشر.';
  } else if (problem?.code === 'permission-denied') {
    title = 'قواعد Firestore ترفض حفظ الإحصاءات';
    body =
      'لا تُحفظ مرّات اللعب والتنزيلات في قاعدة البيانات المشتركة، فلا يراها المشرف ولا بقيّة المستخدمين. انشر ملف firestore.rules على مشروع Firebase (firebase deploy --only firestore:rules) أو انسخ محتواه إلى Firebase Console ← Firestore Database ← Rules ثم Publish.';
  } else if (problem) {
    title = 'تعذّر الاتصال بقاعدة بيانات الإحصاءات';
    body = `لم تُحفظ آخر عملية في Firestore (${problem.code}). ستُعاد المحاولة تلقائيًا؛ تحقّق من اتصال الشبكة أو من حجب الشبكة لخدمات Google.`;
  } else {
    return null;
  }

  return (
    <div
      role="alert"
      className="mb-6 flex gap-3 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1 text-sm leading-relaxed">
        <p className="font-bold">{title}</p>
        <p>{body}</p>
      </div>
    </div>
  );
}
