'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import {
  DEFAULT_SITE_TEXTS,
  diffSiteTexts,
  getSiteTextsHistory,
  type SiteTexts,
  type SiteTextsHistoryEntry,
} from '@/lib/site-texts';

const fmt = (ms: number) =>
  new Date(ms).toLocaleString('ar-QA', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * سجل آخر عمليات النشر: من نشر، ومتى، وما الذي تغيّر — مع استرجاع أي نسخة
 * سابقة إلى المسوّدة (لا تُنشر قبل الضغط على «نشر»).
 */
export function TextsHistory({
  current,
  onRestore,
}: {
  current: SiteTexts;
  onRestore: (s: SiteTexts, when: string) => void;
}) {
  const [items, setItems] = useState<SiteTextsHistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSiteTextsHistory()
      .then(setItems)
      .catch(() => {
        setError('تعذّر تحميل السجل.');
        setItems([]);
      });
  }, []);

  if (!items) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل السجل…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        آخر {items.length} عملية نشر (يُحتفظ بآخر ٣٠). «استرجاع» يحمّل النسخة إلى التحرير
        لتراجعها ثم تنشرها.
      </p>
      {error && <p className="text-sm font-bold text-[color:var(--coral)]">{error}</p>}
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 py-6 text-center text-sm text-muted-foreground">
          لا توجد عمليات نشر مسجّلة بعد — يبدأ السجل من أول نشر.
        </p>
      )}
      <ol className="relative space-y-3 border-r-2 border-[color:var(--hairline)] pr-5">
        {items.map((it, i) => {
          const before = items[i + 1]?.data ?? DEFAULT_SITE_TEXTS;
          const changes = diffSiteTexts(before, it.data);
          const isCurrent = i === 0 && JSON.stringify(it.data) === JSON.stringify(current);
          const when = fmt(it.at);
          return (
            <li key={`${it.at}-${i}`} className="relative">
              <span className="absolute -right-[1.72rem] top-3 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--maroon)] text-white">
                <History className="h-3 w-3" />
              </span>
              <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{it.note || 'نشر'}</span>
                  <span className="text-xs text-muted-foreground">
                    {when}
                    {it.by && ` — ${it.by}`}
                  </span>
                  {isCurrent && (
                    <span className="rounded-md bg-[color:var(--maroon)]/10 px-2 py-0.5 text-xs font-bold text-[color:var(--maroon)]">
                      المنشور حاليًا
                    </span>
                  )}
                  <span className="flex-1" />
                  {!isCurrent && (
                    <button className="btn-ghost btn-sm px-3 py-1.5 text-xs" onClick={() => onRestore(it.data, when)}>
                      <RotateCcw className="h-3.5 w-3.5" /> استرجاع
                    </button>
                  )}
                </div>
                {changes.length > 0 ? (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">{changes.length} تغيير</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pr-5">
                      {changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">بلا تغييرات في المحتوى.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
