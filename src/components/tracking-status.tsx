'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, Loader2, WifiOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { firebaseProjectId, isFirebaseConfigured } from '@/lib/firebase';
import {
  getFeedState,
  onFeedState,
  subscribeSiteStats,
  type FeedState,
} from '@/lib/stats';

/**
 * حالة التتبّع في لوحة الإحصاءات: من أين تأتي الأرقام، وهل وصل ردّ مؤكَّد
 * من الخادم، ومتى. وجودها يمنع الالتباس الشائع: أصفار على الشاشة لا تعني
 * بالضرورة أن التتبّع معطّل — فقد تكون الشبكة محجوبة أو القواعد غير منشورة.
 */
export function TrackingStatus() {
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [totals, setTotals] = useState<number | null>(null);

  useEffect(() => {
    setFeed(getFeedState());
    const offFeed = onFeedState(setFeed);
    const offStats = subscribeSiteStats((s) =>
      setTotals(s.visitors + s.views + s.downloads)
    );
    return () => {
      offFeed();
      offStats();
    };
  }, []);

  if (!feed) return null;

  const source = isFirebaseConfigured
    ? `Firestore — مشروع ${firebaseProjectId}`
    : 'هذا المتصفّح فقط (وضع العرض)';

  let Icon = Loader2;
  let tone = 'var(--muted)';
  let label = 'يجري الاتصال بقاعدة البيانات…';
  let detail: string | null = null;
  let spin = false;

  switch (feed.status) {
    case 'local':
      Icon = Database;
      label = 'العدّادات محلية';
      detail = 'لا توجد إحصاءات مشتركة بين الزوّار في هذا النشر.';
      break;
    case 'connecting':
      spin = true;
      break;
    case 'live': {
      Icon = CheckCircle2;
      tone = 'var(--teal, #2b6b62)';
      const at = feed.lastServerAt
        ? new Date(feed.lastServerAt).toLocaleTimeString('ar-QA', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      label = `متّصل — آخر تحديث مؤكَّد من الخادم ${at}`;
      if (totals === 0) {
        detail =
          'الخادم يردّ لكن لم تُسجَّل أي زيارة أو مشاهدة بعد. إن كان الموقع مستخدمًا فعليًا فالأرجح أن قواعد firestore.rules لم تُنشر على المشروع فتُرفض الزيادات؛ افتح /api/stats/health للتأكّد.';
      }
      break;
    }
    case 'timeout':
      Icon = WifiOff;
      tone = 'var(--gold)';
      label = 'لم يصل ردّ من الخادم خلال المهلة';
      detail =
        'الأرقام المعروضة آخر نسخة معروفة في هذا الجهاز وقد لا تكون محدّثة. غالبًا الشبكة تحجب خدمات Google أو بطيئة جدًّا؛ جرّب شبكة أخرى أو افتح /api/stats/health للقراءة من الخادم.';
      break;
    case 'error':
      Icon = AlertTriangle;
      tone = 'var(--maroon)';
      label = `تعذّرت قراءة الإحصاءات (${feed.code ?? 'unknown'})`;
      detail =
        feed.code === 'permission-denied'
          ? 'قواعد Firestore المنشورة ترفض القراءة. انشر ملف firestore.rules على المشروع.'
          : 'ستُعاد المحاولة تلقائيًا. افتح /api/stats/health لفحص الاتصال من الخادم.';
      break;
  }

  return (
    <div
      className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-2 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface)] px-4 py-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 font-bold text-foreground">
        <Activity className="h-4 w-4 text-[color:var(--gold)]" aria-hidden />
        مصدر الإحصاءات:
        <span className="font-semibold text-muted-foreground" dir="ltr">
          {source}
        </span>
      </span>
      <span className="flex items-center gap-2 font-semibold" style={{ color: tone }}>
        <Icon className={'h-4 w-4 ' + (spin ? 'animate-spin' : '')} aria-hidden />
        {label}
      </span>
      {detail && (
        <p className="basis-full text-xs leading-relaxed text-muted-foreground">
          {detail}{' '}
          {isFirebaseConfigured && (
            <a
              href="/api/stats/health"
              target="_blank"
              rel="noopener"
              className="font-bold text-[color:var(--maroon)] underline underline-offset-2"
            >
              فحص الخادم
            </a>
          )}
        </p>
      )}
    </div>
  );
}
