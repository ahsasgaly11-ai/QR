'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  DEFAULT_TICKER,
  TICKER_ICONS,
  TICKER_LIMITS,
  getTicker,
  saveTicker,
  type TickerIcon,
  type TickerMessage,
  type TickerSettings,
} from '@/lib/ticker';
import { TICKER_ICON_COMPONENTS } from '@/components/vision-ticker';
import { cn } from '@/lib/utils';

const inp =
  'w-full rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

function clone(s: TickerSettings): TickerSettings {
  return JSON.parse(JSON.stringify(s)) as TickerSettings;
}

/**
 * تحرير رسائل الشريط المتحرّك أسفل الصفحة: العنوان (الشارة الذهبية)
 * والنص والأيقونة وترتيب الرسائل، مع إظهار الشريط أو إخفائه. الحفظ ينشر
 * التعديل فورًا لكل زوّار الموقع (انظر src/lib/ticker.ts).
 */
export function TickerManager() {
  const [data, setData] = useState<TickerSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTicker()
      .then((s) => setData(clone(s)))
      .catch(() => {
        setLoadError('تعذّر تحميل الرسائل المنشورة؛ يُعرض النص الافتراضي.');
        setData(clone(DEFAULT_TICKER));
      });
  }, []);

  const update = (fn: (d: TickerSettings) => void) => {
    setSaved(false);
    setError('');
    setData((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      return next;
    });
  };

  const setMsg = (i: number, patch: Partial<TickerMessage>) =>
    update((d) => Object.assign(d.messages[i], patch));

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.messages.length) return;
      [d.messages[i], d.messages[j]] = [d.messages[j], d.messages[i]];
    });

  async function onPublish() {
    if (!data) return;
    const empty = data.messages.findIndex((m) => !m.text.trim());
    if (empty !== -1) {
      setError(`الرسالة رقم ${empty + 1} بلا نص — اكتب نصّها أو احذفها.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveTicker(data);
      setSaved(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === 'permission-denied'
          ? 'رُفض الحفظ: حسابك غير مسجَّل كمالك في مجموعة admins، أو قواعد Firestore غير منشورة.'
          : (e as Error)?.message || 'تعذّر النشر. تحقّق من اتصالك ثم أعد المحاولة.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل رسائل الشريط…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          عدّل رسائل الشريط المتحرّك أسفل الموقع وعناوينها (الشارة الذهبية). تتناوب
          الرسائل بالترتيب الظاهر هنا، وعند الضغط على «نشر» يصل التعديل فورًا إلى
          جميع زوّار الموقع.
        </p>
        <button
          onClick={() => update((d) => (d.enabled = !d.enabled))}
          className={cn(
            'btn-sm shrink-0 px-4 py-2 text-sm',
            data.enabled ? 'btn-ghost' : 'btn-primary'
          )}
        >
          {data.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {data.enabled ? 'إخفاء الشريط' : 'إظهار الشريط'}
        </button>
      </div>

      {!data.enabled && (
        <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--gold)]">
          الشريط مخفي حاليًا — لن يظهر لأي زائر بعد النشر.
        </p>
      )}
      {loadError && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {loadError}
        </p>
      )}

      <ol className="space-y-4">
        {data.messages.map((m, i) => {
          const Icon = TICKER_ICON_COMPONENTS[m.icon];
          return (
            <li
              key={i}
              className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--maroon)] text-xs font-black text-white">
                  {i + 1}
                </span>
                {/* معاينة الشارة كما تظهر في الشريط */}
                <span className="flex min-w-0 items-center gap-1.5 truncate rounded-md bg-gradient-to-b from-[#f0d77f] to-[#c9a227] px-2.5 py-1 text-xs font-black text-[#4d0a21]">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{m.badge || 'بلا عنوان'}</span>
                </span>
                <span className="flex-1" />
                <button
                  className={iconBtn + ' bg-[color:var(--surface)]'}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="تقديم"
                  aria-label="تقديم الرسالة"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  className={iconBtn + ' bg-[color:var(--surface)]'}
                  onClick={() => move(i, 1)}
                  disabled={i === data.messages.length - 1}
                  title="تأخير"
                  aria-label="تأخير الرسالة"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                  onClick={() => update((d) => d.messages.splice(i, 1))}
                  title="حذف الرسالة"
                  aria-label="حذف الرسالة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_14rem_12rem]">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">
                    العنوان (الشارة الذهبية)
                  </span>
                  <input
                    className={inp}
                    value={m.badge}
                    maxLength={TICKER_LIMITS.badge}
                    placeholder="مثال: رؤية الوزارة"
                    onChange={(e) => setMsg(i, { badge: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">
                    عنوان مختصر للجوال (اختياري)
                  </span>
                  <input
                    className={inp}
                    value={m.badgeShort}
                    maxLength={TICKER_LIMITS.badgeShort}
                    placeholder="يُستخدم العنوان الكامل إن تُرك فارغًا"
                    onChange={(e) => setMsg(i, { badgeShort: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">الأيقونة</span>
                  <select
                    className={inp}
                    value={m.icon}
                    onChange={(e) => setMsg(i, { icon: e.target.value as TickerIcon })}
                  >
                    {(Object.keys(TICKER_ICONS) as TickerIcon[]).map((k) => (
                      <option key={k} value={k}>
                        {TICKER_ICONS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 block space-y-1">
                <span className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>نص الرسالة المتحرّك</span>
                  <span className="tabular-nums">
                    {m.text.length}/{TICKER_LIMITS.text}
                  </span>
                </span>
                <textarea
                  className={inp + ' min-h-[4.5rem] resize-y leading-relaxed'}
                  value={m.text}
                  maxLength={TICKER_LIMITS.text}
                  placeholder="اكتب النص الذي سيتحرّك في الشريط"
                  onChange={(e) => setMsg(i, { text: e.target.value })}
                />
              </label>
            </li>
          );
        })}
      </ol>

      {data.messages.length === 0 && (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 py-6 text-center text-sm text-muted-foreground">
          لا توجد رسائل. أضِف رسالة واحدة على الأقل.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost btn-sm px-4 py-2.5 text-sm"
          disabled={data.messages.length >= TICKER_LIMITS.messages}
          onClick={() =>
            update((d) =>
              d.messages.push({ badge: '', badgeShort: '', icon: 'megaphone', text: '' })
            )
          }
        >
          <Plus className="h-4 w-4" /> إضافة رسالة
        </button>
        <button
          className="btn-ghost btn-sm px-4 py-2.5 text-sm"
          onClick={() => {
            if (confirm('استعادة الرسالتين الأصليتين (الرؤية وقول سمو الأمير)؟ لن تُنشر قبل الضغط على «نشر».'))
              update((d) => {
                d.enabled = true;
                d.messages = clone(DEFAULT_TICKER).messages;
              });
          }}
        >
          <RotateCcw className="h-4 w-4" /> استعادة النص الأصلي
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-5">
        <button
          onClick={onPublish}
          disabled={busy || data.messages.length === 0}
          className="btn-primary btn-sm px-6 py-3 text-sm"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {saved ? 'تم النشر لجميع الزوّار' : 'نشر لجميع الزوّار'}
        </button>
        {!isFirebaseConfigured && (
          <span className="text-xs text-muted-foreground">
            وضع العرض: يُحفظ التعديل في هذا المتصفّح فقط.
          </span>
        )}
      </div>
    </div>
  );
}
