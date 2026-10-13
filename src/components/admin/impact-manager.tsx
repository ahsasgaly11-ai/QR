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
  Send,
  Trash2,
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  DEFAULT_IMPACT,
  IMPACT_LIMITS,
  IMPACT_ROLES,
  getImpact,
  saveImpact,
  type ImpactRole,
  type ImpactSettings,
  type Testimonial,
} from '@/lib/impact';
import { cn } from '@/lib/utils';

const inp =
  'w-full rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

function clone(s: ImpactSettings): ImpactSettings {
  return JSON.parse(JSON.stringify(s)) as ImpactSettings;
}

const EMPTY: Testimonial = { name: '', role: 'teacher', school: '', quote: '' };

/**
 * تحرير آراء المعلّمين والطلبة التي تظهر في قسم «أثر التعلّم» بالصفحة
 * الرئيسية: الاسم والصفة والمدرسة ونص الرأي، مع الترتيب والإخفاء. الحفظ ينشر
 * التعديل فورًا لكل زوّار الموقع (انظر src/lib/impact.ts).
 */
export function ImpactManager() {
  const [data, setData] = useState<ImpactSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getImpact()
      .then((s) => setData(clone(s)))
      .catch(() => {
        setLoadError('تعذّر تحميل الآراء المنشورة؛ تُعرض قائمة فارغة.');
        setData(clone(DEFAULT_IMPACT));
      });
  }, []);

  const update = (fn: (d: ImpactSettings) => void) => {
    setSaved(false);
    setError('');
    setData((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      return next;
    });
  };

  const setItem = (i: number, patch: Partial<Testimonial>) =>
    update((d) => Object.assign(d.items[i], patch));

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.items.length) return;
      [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    });

  async function onPublish() {
    if (!data) return;
    const empty = data.items.findIndex((m) => !m.quote.trim());
    if (empty !== -1) {
      setError(`الرأي رقم ${empty + 1} بلا نص — اكتب نصّه أو احذفه.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveImpact(data);
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
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل الآراء…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          آراء المعلّمين والطلبة وأولياء الأمور بعد تجربة المنصّة، كما تظهر في قسم
          «أثر التعلّم» بالصفحة الرئيسية تحت الأرقام الحقيقية. اكتب ما وصلك فعلًا
          (بالبريد أو واتساب أو في المدرسة) — لا يظهر القسم إلا بما تنشره هنا.
        </p>
        <button
          onClick={() => update((d) => (d.enabled = !d.enabled))}
          className={cn(
            'btn-sm shrink-0 px-4 py-2 text-sm',
            data.enabled ? 'btn-ghost' : 'btn-primary'
          )}
        >
          {data.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {data.enabled ? 'إخفاء الآراء' : 'إظهار الآراء'}
        </button>
      </div>

      {!data.enabled && (
        <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--gold)]">
          الآراء مخفية حاليًا — تبقى الأرقام ظاهرة في القسم ولا يظهر أي رأي بعد النشر.
        </p>
      )}
      {loadError && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {loadError}
        </p>
      )}

      <ol className="space-y-4">
        {data.items.map((m, i) => (
          <li
            key={i}
            className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--maroon)] text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="truncate text-sm font-bold text-foreground">
                {IMPACT_ROLES[m.role]}
                {m.name ? ` • ${m.name}` : ''}
              </span>
              <span className="flex-1" />
              <button
                className={iconBtn + ' bg-[color:var(--surface)]'}
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="تقديم"
                aria-label="تقديم الرأي"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                className={iconBtn + ' bg-[color:var(--surface)]'}
                onClick={() => move(i, 1)}
                disabled={i === data.items.length - 1}
                title="تأخير"
                aria-label="تأخير الرأي"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                className={iconBtn + ' bg-[color:var(--coral)]/15 text-[color:var(--coral)]'}
                onClick={() => update((d) => d.items.splice(i, 1))}
                title="حذف الرأي"
                aria-label="حذف الرأي"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_11rem_1fr]">
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">الاسم</span>
                <input
                  className={inp}
                  value={m.name}
                  maxLength={IMPACT_LIMITS.name}
                  placeholder="مثال: أ. فاطمة — أو «معلّمة علوم» إن فضّلت عدم ذكر الاسم"
                  onChange={(e) => setItem(i, { name: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">الصفة</span>
                <select
                  className={inp}
                  value={m.role}
                  onChange={(e) => setItem(i, { role: e.target.value as ImpactRole })}
                >
                  {(Object.keys(IMPACT_ROLES) as ImpactRole[]).map((k) => (
                    <option key={k} value={k}>
                      {IMPACT_ROLES[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">
                  المدرسة أو الصف (اختياري)
                </span>
                <input
                  className={inp}
                  value={m.school}
                  maxLength={IMPACT_LIMITS.school}
                  placeholder="مثال: مدرسة … الابتدائية — الصف الثالث"
                  onChange={(e) => setItem(i, { school: e.target.value })}
                />
              </label>
            </div>

            <label className="mt-3 block space-y-1">
              <span className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>الرأي أو النتيجة الملحوظة</span>
                <span className="tabular-nums">
                  {m.quote.length}/{IMPACT_LIMITS.quote}
                </span>
              </span>
              <textarea
                className={inp + ' min-h-[5rem] resize-y leading-relaxed'}
                value={m.quote}
                maxLength={IMPACT_LIMITS.quote}
                placeholder="ماذا تغيّر في الصف بعد استخدام النشاط؟ مثال: ارتفعت مشاركة الطلبة في درس … وفهموا … بسرعة أكبر."
                onChange={(e) => setItem(i, { quote: e.target.value })}
              />
            </label>
          </li>
        ))}
      </ol>

      {data.items.length === 0 && (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 py-6 text-center text-sm text-muted-foreground">
          لا توجد آراء منشورة بعد. أضِف أوّل رأي وصلك من معلّم أو طالب.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost btn-sm px-4 py-2.5 text-sm"
          disabled={data.items.length >= IMPACT_LIMITS.items}
          onClick={() => update((d) => d.items.push({ ...EMPTY }))}
        >
          <Plus className="h-4 w-4" /> إضافة رأي
        </button>
        <span className="self-center text-xs text-muted-foreground">
          حتى {IMPACT_LIMITS.items} آراء.
        </span>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] pt-5">
        <button onClick={onPublish} disabled={busy} className="btn-primary btn-sm px-6 py-3 text-sm">
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
