'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Loader2,
  RotateCcw,
  Search,
  Send,
  Undo2,
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  SITE_TEXT_DEFAULTS,
  SITE_TEXT_GROUPS,
  SITE_TEXT_LIMITS,
  getSiteTexts,
  normalizeSiteTexts,
  saveSiteTexts,
  txt,
  type SiteTextField,
  type SiteTexts,
} from '@/lib/site-texts';
import { revalidateContent } from '@/lib/revalidate';
import { cn } from '@/lib/utils';

const inp =
  'w-full rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

/** النص النافذ لكل مفتاح — ما يراه الزائر الآن أو بعد النشر. */
type Draft = { values: Record<string, string>; hidden: string[] };

function toDraft(s: SiteTexts): Draft {
  const values: Record<string, string> = {};
  for (const key of Object.keys(SITE_TEXT_DEFAULTS)) values[key] = txt(s, key);
  return { values, hidden: [...s.hidden].sort() };
}

function fromDraft(d: Draft): SiteTexts {
  return normalizeSiteTexts({ texts: d.values, hidden: d.hidden });
}

function sameDraft(a: Draft, b: Draft): boolean {
  if (a.hidden.join('|') !== b.hidden.join('|')) return false;
  return Object.keys(SITE_TEXT_DEFAULTS).every((k) => a.values[k].trim() === b.values[k].trim());
}

const isModified = (d: Draft, key: string) =>
  d.values[key].trim() !== '' && d.values[key].trim() !== SITE_TEXT_DEFAULTS[key];

/**
 * تحرير عناوين أقسام الموقع ونصوصها من مكان واحد: القائمة العلوية، وأقسام
 * الصفحة الرئيسية (مع إظهارها أو إخفائها)، ورؤوس الصفحات الداخلية.
 * الحفظ ينشر التعديل لكل الزوّار ويعيد توليد الصفحات فورًا
 * (انظر src/lib/site-texts.ts).
 */
export function TextsManager() {
  const [published, setPublished] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSiteTexts()
      .then((s) => {
        const d = toDraft(s);
        setPublished(d);
        setDraft(d);
      })
      .catch(() => {
        setLoadError('تعذّر تحميل النصوص المنشورة؛ تُعرض النصوص الافتراضية.');
        const d = toDraft({ texts: {}, hidden: [] });
        setPublished(d);
        setDraft(d);
      });
  }, []);

  const dirty = Boolean(published && draft && !sameDraft(published, draft));

  // تنبيه قبل مغادرة الصفحة بتعديلات غير منشورة
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const update = (fn: (d: Draft) => Draft) => {
    setSaved(false);
    setError('');
    setNotice('');
    setDraft((prev) => (prev ? fn(prev) : prev));
  };

  const setValue = (key: string, value: string) =>
    update((d) => ({ ...d, values: { ...d.values, [key]: value } }));

  const resetKeys = (keys: string[]) =>
    update((d) => {
      const values = { ...d.values };
      for (const k of keys) values[k] = SITE_TEXT_DEFAULTS[k];
      return { ...d, values };
    });

  const toggleHidden = (id: string) =>
    update((d) => ({
      ...d,
      hidden: d.hidden.includes(id)
        ? d.hidden.filter((h) => h !== id)
        : [...d.hidden, id].sort(),
    }));

  const q = query.trim();
  const visibleGroups = useMemo(() => {
    if (!draft) return [];
    const match = (f: SiteTextField) =>
      (!onlyModified || isModified(draft, f.key)) &&
      (!q || [f.label, f.default, draft.values[f.key]].some((v) => v.includes(q)));
    return SITE_TEXT_GROUPS.map((g) => ({
      group: g,
      fields: q && g.label.includes(q) && !onlyModified ? g.fields : g.fields.filter(match),
    })).filter((x) => x.fields.length > 0);
  }, [draft, q, onlyModified]);

  async function onPublish() {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const clean = await saveSiteTexts(fromDraft(draft));
      const d = toDraft(clean);
      setPublished(d);
      setDraft(d);
      setSaved(true);
      // إعادة توليد الصفحات فورًا؛ وإلا تلتقط التعديل خلال دقيقة على الأكثر
      if (isFirebaseConfigured) {
        const ok = await revalidateContent({});
        if (!ok) setNotice('نُشرت النصوص، وستظهر في الصفحات خلال دقيقة.');
      }
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

  function onExport() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(fromDraft(draft), null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `site-texts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport(file: File) {
    try {
      const s = normalizeSiteTexts(JSON.parse(await file.text()));
      update(() => toDraft(s));
      setNotice(
        `استُوردت النسخة (${Object.keys(s.texts).length} نصًّا معدّلًا). راجعها ثم اضغط «نشر».`
      );
    } catch {
      setError('الملف ليس نسخة احتياطية صالحة للنصوص (JSON).');
    }
  }

  if (!draft || !published) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل نصوص الموقع…
      </div>
    );
  }

  const modifiedCount = Object.keys(SITE_TEXT_DEFAULTS).filter((k) => isModified(draft, k)).length;
  const pendingCount =
    Object.keys(SITE_TEXT_DEFAULTS).filter(
      (k) => draft.values[k].trim() !== published.values[k].trim()
    ).length + (draft.hidden.join('|') !== published.hidden.join('|') ? 1 : 0);

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">
        عدّل عناوين أقسام الموقع ونصوصها: القائمة العلوية، وكل أقسام الصفحة الرئيسية
        (ويمكنك إخفاء أي قسم منها)، ورؤوس الصفحات الداخلية. اترك الحقل فارغًا أو اضغط
        <RotateCcw className="mx-1 inline h-3.5 w-3.5" />
        ليعود إلى نصّه الأصلي. لا يصل أي تعديل للزوّار قبل الضغط على «نشر».
      </p>

      {loadError && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {loadError}
        </p>
      )}

      {/* شريط الأدوات: بحث، تصفية، نسخ احتياطي */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={inp + ' pr-9'}
            value={query}
            placeholder="ابحث عن عنوان أو نص…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={cn('btn-sm px-3 py-2 text-sm', onlyModified ? 'btn-primary' : 'btn-ghost')}
          onClick={() => setOnlyModified(!onlyModified)}
        >
          المعدّلة فقط ({modifiedCount})
        </button>
        <button className="btn-ghost btn-sm px-3 py-2 text-sm" onClick={onExport} title="تنزيل نسخة احتياطية من النصوص">
          <FileDown className="h-4 w-4" /> نسخة احتياطية
        </button>
        <button
          className="btn-ghost btn-sm px-3 py-2 text-sm"
          onClick={() => fileRef.current?.click()}
          title="استيراد نسخة احتياطية سابقة"
        >
          <FileUp className="h-4 w-4" /> استيراد
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {visibleGroups.length === 0 && (
        <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 py-6 text-center text-sm text-muted-foreground">
          لا توجد نصوص مطابقة.
        </p>
      )}

      <div className="space-y-3">
        {visibleGroups.map(({ group, fields }) => {
          const hidden = draft.hidden.includes(group.id);
          const groupModified = group.fields.filter((f) => isModified(draft, f.key));
          return (
            <details
              key={group.id}
              open={Boolean(q) || onlyModified || undefined}
              className={cn(
                'group rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/50',
                hidden && 'opacity-70'
              )}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
                <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                <span className="min-w-0 flex-1 truncate font-display font-semibold text-foreground">
                  {group.label}
                </span>
                {hidden && (
                  <span className="rounded-md bg-[color:var(--gold)]/15 px-2 py-0.5 text-xs font-bold text-[color:var(--gold)]">
                    مخفي
                  </span>
                )}
                {groupModified.length > 0 && (
                  <span className="rounded-md bg-[color:var(--maroon)]/10 px-2 py-0.5 text-xs font-bold text-[color:var(--maroon)]">
                    {groupModified.length} معدّل
                  </span>
                )}
              </summary>

              <div className="space-y-4 border-t border-[color:var(--hairline)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {group.hideable && (
                    <button
                      className={cn('btn-sm px-3 py-1.5 text-xs', hidden ? 'btn-primary' : 'btn-ghost')}
                      onClick={() => toggleHidden(group.id)}
                    >
                      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {hidden ? 'إظهار القسم' : 'إخفاء القسم'}
                    </button>
                  )}
                  <a
                    href={group.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm px-3 py-1.5 text-xs"
                  >
                    <ExternalLink className="h-4 w-4" /> معاينة في الموقع
                  </a>
                  {groupModified.length > 0 && (
                    <button
                      className="btn-ghost btn-sm px-3 py-1.5 text-xs"
                      onClick={() => resetKeys(group.fields.map((f) => f.key))}
                    >
                      <RotateCcw className="h-4 w-4" /> استعادة نصوص القسم الأصلية
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((f) => {
                    const value = draft.values[f.key];
                    const max = f.long ? SITE_TEXT_LIMITS.long : SITE_TEXT_LIMITS.short;
                    const modified = isModified(draft, f.key);
                    const changed = value.trim() !== published.values[f.key].trim();
                    return (
                      <label key={f.key} className={cn('block space-y-1', f.long && 'sm:col-span-2')}>
                        <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <span className="flex-1">
                            {f.label}
                            {changed && (
                              <span className="mr-1.5 text-[color:var(--maroon)]" title="لم يُنشر بعد">
                                ●
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums">
                            {value.length}/{max}
                          </span>
                          <button
                            type="button"
                            className={iconBtn + ' h-6 w-6 bg-[color:var(--surface)]'}
                            disabled={!modified}
                            onClick={(e) => {
                              e.preventDefault();
                              resetKeys([f.key]);
                            }}
                            title="استعادة النص الأصلي"
                            aria-label={`استعادة النص الأصلي: ${f.label}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        {f.long ? (
                          <textarea
                            className={inp + ' min-h-[4.5rem] resize-y leading-relaxed'}
                            value={value}
                            maxLength={max}
                            placeholder={f.default}
                            onChange={(e) => setValue(f.key, e.target.value)}
                          />
                        ) : (
                          <input
                            className={inp}
                            value={value}
                            maxLength={max}
                            placeholder={f.default}
                            onChange={(e) => setValue(f.key, e.target.value)}
                          />
                        )}
                        {f.hint && <span className="block text-xs text-muted-foreground">{f.hint}</span>}
                        {modified && (
                          <span className="block truncate text-xs text-muted-foreground" title={f.default}>
                            الأصلي: {f.default}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--gold)]">
          {notice}
        </p>
      )}

      {/* شريط النشر ثابت أسفل الشاشة ما دامت هناك تعديلات */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 border-t border-[color:var(--hairline)] bg-[color:var(--paper)] pt-5',
          dirty && 'sticky bottom-0 z-10 -mx-1 px-1 pb-4 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.25)]'
        )}
      >
        <button
          onClick={onPublish}
          disabled={busy || !dirty}
          className="btn-primary btn-sm px-6 py-3 text-sm"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saved && !dirty ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {saved && !dirty ? 'تم النشر لجميع الزوّار' : 'نشر لجميع الزوّار'}
        </button>
        {dirty && (
          <>
            <span className="text-sm font-bold text-[color:var(--maroon)]">
              {pendingCount} تعديل لم يُنشر
            </span>
            <button
              className="btn-ghost btn-sm px-4 py-2.5 text-sm"
              onClick={() => update(() => published)}
            >
              <Undo2 className="h-4 w-4" /> تراجع عن التعديلات
            </button>
          </>
        )}
        {modifiedCount > 0 && (
          <button
            className="btn-ghost btn-sm px-4 py-2.5 text-sm"
            onClick={() => {
              if (confirm('إعادة كل نصوص الموقع إلى أصلها وإظهار كل الأقسام؟ لن يُنشر ذلك قبل الضغط على «نشر».'))
                update(() => toDraft({ texts: {}, hidden: [] }));
            }}
          >
            <RotateCcw className="h-4 w-4" /> استعادة كل النصوص الأصلية
          </button>
        )}
        {!isFirebaseConfigured && (
          <span className="text-xs text-muted-foreground">
            وضع العرض: يُحفظ التعديل في هذا المتصفّح فقط.
          </span>
        )}
      </div>
    </div>
  );
}
