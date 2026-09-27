'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, MonitorPlay } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getSettings, saveSettings } from '@/lib/site-settings';
import { cn } from '@/lib/utils';

/**
 * تشغيل تنزيل الألعاب من الموقع أو إيقافه لكل الزوّار. عند الإيقاف تختفي
 * أزرار «تحميل» و«فتح في نافذة» من كل الصفحات، وتُستخدم الألعاب داخل الموقع
 * فقط. يُحفظ التغيير فور الضغط ويصل لكل الزوّار مباشرة (src/lib/site-settings.ts).
 */
export function DownloadsManager() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => setEnabled(s.downloadsEnabled))
      .catch(() => {
        setError('تعذّر قراءة الإعداد الحالي. تحقّق من اتصالك ثم أعد تحميل الصفحة.');
      });
  }, []);

  async function toggle() {
    if (enabled === null || busy) return;
    const next = !enabled;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      await saveSettings({ downloadsEnabled: next });
      setEnabled(next);
      setSaved(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === 'permission-denied'
          ? 'رُفض الحفظ: حسابك غير مسجَّل كمالك في مجموعة admins، أو قواعد Firestore غير منشورة.'
          : (e as Error)?.message || 'تعذّر الحفظ. تحقّق من اتصالك ثم أعد المحاولة.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null && !error) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل الإعداد…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card-premium rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white',
                enabled ? 'bg-[color:var(--maroon)]' : 'bg-[color:var(--gold)]'
              )}
            >
              {enabled ? <Download className="h-6 w-6" /> : <MonitorPlay className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="font-display text-lg font-black text-[color:var(--maroon)]">
                تنزيل الألعاب من الموقع
              </h3>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {enabled === null
                  ? '—'
                  : enabled
                    ? 'مُفعَّل: يستطيع الزوّار تنزيل الألعاب.'
                    : 'متوقّف: تُستخدم الألعاب داخل الموقع فقط.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={!!enabled}
            aria-label="السماح بتنزيل الألعاب"
            onClick={() => void toggle()}
            disabled={enabled === null || busy}
            className={cn(
              'relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50',
              enabled ? 'bg-[color:var(--maroon)]' : 'bg-[color:var(--hairline)]'
            )}
          >
            <span
              className={cn(
                'absolute top-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow transition-all',
                enabled ? 'right-8' : 'right-1'
              )}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--maroon)]" />}
            </span>
          </button>
        </div>

        <ul className="mt-5 space-y-1.5 border-t border-[color:var(--hairline)] pt-4 text-sm leading-7 text-muted-foreground">
          <li>
            <b className="text-foreground">عند التشغيل:</b> يظهر زرّ «تحميل» في بطاقات
            الأنشطة وصفحة اللعب، ويستطيع الزوّار تنزيل اللعبة كملف HTML.
          </li>
          <li>
            <b className="text-foreground">عند الإيقاف:</b> تختفي أزرار «تحميل» و«فتح في
            نافذة» من كل الصفحات، ويلعب الزوّار داخل الموقع فقط.
          </li>
          <li>يصل التغيير إلى جميع الزوّار فورًا، حتى من كانت الصفحة مفتوحة لديه.</li>
        </ul>
      </div>

      {saved && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {enabled ? 'تم تشغيل التنزيل للزوّار.' : 'تم إيقاف التنزيل — الألعاب داخل الموقع فقط.'}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}
      {!isFirebaseConfigured && (
        <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--gold)]">
          وضع العرض المحلي: Firebase غير مُعدّ، لذا يُحفظ الإعداد في هذا المتصفّح فقط.
        </p>
      )}
    </div>
  );
}
