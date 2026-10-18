'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Loader2, PencilLine, RotateCcw, X } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  SITE_TEXT_DEFAULTS,
  SITE_TEXT_GROUPS,
  SITE_TEXT_LIMITS,
  saveSiteTextKey,
  txt,
} from '@/lib/site-texts';
import { ADMIN_SEEN_KEY, DEMO_IDENTITY, type AdminIdentity } from '@/lib/roles';
import { revalidateContent } from '@/lib/revalidate';
import { useSiteTexts } from './use-site-texts';

// ---------------------------------------------------------------------------
// التحرير المباشر: للمالك ومحرّري النصوص فقط، زرّ عائم «تحرير النصوص» يحوّل
// الصفحة إلى وضع تحرير — كل نص قابل للتعديل (المعلَّم بـ data-tk) يُحاط بإطار،
// والضغط عليه يفتح نافذة صغيرة لتعديله ونشره فورًا.
//
// لا يُحمَّل شيء من Firebase Auth للزوّار: يعمل فقط في متصفّح دخل منه مشرف
// إلى لوحة الإدارة من قبل (ADMIN_SEEN_KEY)، ثم يتحقّق من صلاحيته فعلًا.
// ---------------------------------------------------------------------------

const FIELDS = new Map(
  SITE_TEXT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, { ...f, group: g.label }] as const))
);

export function InlineTextEditor() {
  const pathname = usePathname();
  const router = useRouter();
  const texts = useSiteTexts();
  const [me, setMe] = useState<AdminIdentity | null>(null);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // من المشرف؟ (فقط في متصفّح مشرف)
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(ADMIN_SEEN_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (!seen) return;
    if (!isFirebaseConfigured) {
      setMe(DEMO_IDENTITY);
      return;
    }
    let stop = () => {};
    let alive = true;
    import('@/lib/auth').then(({ watchAdmin }) => {
      if (!alive) return;
      stop = watchAdmin(async (u) => {
        if (!u) return setMe(null);
        const { resolveRole } = await import('@/lib/roles');
        const id = await resolveRole(u.uid);
        if (alive) setMe(id && id.role !== 'uploader' ? id : null);
      });
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  // وضع التحرير: إطار حول النصوص، والضغط يفتح المحرّر بدل فتح الرابط
  useEffect(() => {
    if (!editing) return;
    const root = document.documentElement;
    root.classList.add('tk-editing');
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tk]');
      if (!el || el.closest('.tk-dialog')) return;
      const k = el.getAttribute('data-tk');
      if (!k || !FIELDS.has(k)) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(k);
      setError('');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTarget((t) => {
          if (!t) setEditing(false);
          return null;
        });
      }
    };
    // على window لا document: يسبق مستمعي الانتقالات المسجّلين على document
    window.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('tk-editing');
      window.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editing]);

  useEffect(() => {
    if (target) setValue(txt(texts, target));
    // نقرأ القيمة عند فتح المحرّر فقط، لا مع كل تحديث للنصوص
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!me || pathname?.startsWith('/admin')) return null;

  const field = target ? FIELDS.get(target) : undefined;
  const max = field?.long ? SITE_TEXT_LIMITS.long : SITE_TEXT_LIMITS.short;

  async function save(next: string) {
    if (!target || !me) return;
    setBusy(true);
    setError('');
    try {
      await saveSiteTextKey(target, next, me.name);
      const shown = next.trim() || SITE_TEXT_DEFAULTS[target];
      // تحديث فوري لما في الصفحة، ثم إعادة توليدها من الخادم
      document.querySelectorAll(`[data-tk="${CSS.escape(target)}"]`).forEach((el) => {
        el.textContent = shown.replace(/\*/g, '');
      });
      setTarget(null);
      if (isFirebaseConfigured) await revalidateContent({});
      router.refresh();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === 'permission-denied'
          ? 'رُفض الحفظ: حسابك لا يملك صلاحية تحرير النصوص.'
          : (e as Error)?.message || 'تعذّر الحفظ.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEditing((v) => !v);
          setTarget(null);
        }}
        className="tk-toggle"
        aria-pressed={editing}
        title={editing ? 'إنهاء التحرير (Esc)' : 'تحرير نصوص هذه الصفحة'}
      >
        {editing ? <Check className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
        {editing ? 'إنهاء التحرير' : 'تحرير النصوص'}
      </button>

      {editing && !target && (
        <p className="tk-hint" role="status">
          اضغط على أي نص محاط بإطار لتعديله — Esc للخروج
        </p>
      )}

      {target && field && (
        <div className="tk-backdrop" onClick={() => !busy && setTarget(null)}>
          <form
            className="tk-dialog"
            role="dialog"
            aria-label={`تعديل: ${field.label}`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void save(value);
            }}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{field.group}</p>
                <p className="font-display font-semibold">{field.label}</p>
              </div>
              <button type="button" className="tk-icon" onClick={() => setTarget(null)} aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            {field.long ? (
              <textarea
                autoFocus
                className="tk-input min-h-[7rem] resize-y leading-relaxed"
                value={value}
                maxLength={max}
                placeholder={field.default}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <input
                autoFocus
                className="tk-input"
                value={value}
                maxLength={max}
                placeholder={field.default}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{field.hint}</span>
              <span className="tabular-nums">
                {value.length}/{max}
              </span>
            </div>
            {error && <p className="text-sm font-bold text-[color:var(--coral)]">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary btn-sm px-4 py-2 text-sm" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                حفظ ونشر
              </button>
              {value.trim() !== field.default && (
                <button
                  type="button"
                  className="btn-ghost btn-sm px-3 py-2 text-sm"
                  disabled={busy}
                  onClick={() => void save('')}
                >
                  <RotateCcw className="h-4 w-4" /> النص الأصلي
                </button>
              )}
              <span className="text-xs text-muted-foreground">يُسجَّل في سجل التعديلات باسم {me.name}</span>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
