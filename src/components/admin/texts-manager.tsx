'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  History,
  LayoutList,
  Link2,
  Loader2,
  Palette,
  RotateCcw,
  Search,
  Send,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import type { Subject } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  DEFAULT_SITE_TEXTS,
  SITE_TEXT_DEFAULTS,
  SITE_TEXT_GROUPS,
  SITE_TEXT_LIMITS,
  getSiteTextsAdmin,
  normalizeSiteTexts,
  saveSiteTexts,
  scheduleSiteTexts,
  type SiteTextField,
  type SiteTextsSchedule,
} from '@/lib/site-texts';
import { revalidateContent } from '@/lib/revalidate';
import { cn } from '@/lib/utils';
import { useAdminIdentity } from './auth-gate';
import { DoorsPanel, FooterPanel, OrderPanel } from './site-appearance-panels';
import { TextsHistory } from './texts-history';
import { fromDraft, iconBtn, inp, toDraft, type Draft } from './studio-draft';

const key = (d: Draft) => JSON.stringify(fromDraft(d));

const isModified = (d: Draft, k: string) =>
  d.values[k].trim() !== '' && d.values[k].trim() !== SITE_TEXT_DEFAULTS[k];

type Pane = 'texts' | 'order' | 'doors' | 'footer' | 'history';

const PANES: { id: Pane; label: string; icon: typeof Type }[] = [
  { id: 'texts', label: 'النصوص والعناوين', icon: Type },
  { id: 'order', label: 'ترتيب أقسام الرئيسية', icon: LayoutList },
  { id: 'doors', label: 'ألوان الأبواب ونقوشها', icon: Palette },
  { id: 'footer', label: 'روابط التذييل', icon: Link2 },
  { id: 'history', label: 'سجل التعديلات', icon: History },
];

const fmt = (ms: number) =>
  new Date(ms).toLocaleString('ar-QA', { dateStyle: 'full', timeStyle: 'short' });

/** قيمة حقل datetime-local بالتوقيت المحلي */
function localInput(ms: number) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

/**
 * استوديو الموقع: تحرير عناوين الأقسام ونصوصها، وإظهار أقسام الرئيسية
 * وترتيبها، وألوان الأبواب ونقوشها، وروابط التذييل — ثم النشر فورًا أو
 * جدولته، مع سجل لكل نشر يمكن الرجوع إليه (انظر src/lib/site-texts.ts).
 */
export function TextsManager({ subjects }: { subjects: Subject[] }) {
  const me = useAdminIdentity();
  const [published, setPublished] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scheduled, setScheduled] = useState<SiteTextsSchedule | null>(null);
  const [pane, setPane] = useState<Pane>('texts');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    getSiteTextsAdmin(me.name)
      .then(({ live, scheduled }) => {
        const d = toDraft(live);
        setPublished(d);
        setDraft(d);
        setScheduled(scheduled);
      })
      .catch(() => {
        setLoadError('تعذّر تحميل النصوص المنشورة؛ تُعرض النصوص الافتراضية.');
        const d = toDraft(DEFAULT_SITE_TEXTS);
        setPublished(d);
        setDraft(d);
      });
  }, [me.name]);

  const dirty = Boolean(published && draft && key(published) !== key(draft));

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
    setSaved('');
    setError('');
    setNotice('');
    setDraft((prev) => (prev ? fn(prev) : prev));
  };

  const fail = (e: unknown) => {
    const code = (e as { code?: string })?.code;
    setError(
      code === 'permission-denied'
        ? 'رُفض الحفظ: حسابك لا يملك صلاحية تحرير النصوص، أو قواعد Firestore غير منشورة.'
        : (e as Error)?.message || 'تعذّر الحفظ. تحقّق من اتصالك ثم أعد المحاولة.'
    );
  };

  async function onPublish() {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const clean = await saveSiteTexts(fromDraft(draft), me.name);
      const d = toDraft(clean);
      setPublished(d);
      setDraft(d);
      setSaved('تم النشر لجميع الزوّار');
      setHistoryKey((k) => k + 1);
      // إعادة توليد الصفحات فورًا؛ وإلا تلتقط التعديل خلال دقيقة على الأكثر
      if (isFirebaseConfigured && !(await revalidateContent({}))) {
        setNotice('نُشرت النصوص، وستظهر في الصفحات خلال دقيقة.');
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onSchedule() {
    if (!draft) return;
    const at = new Date(scheduleAt).getTime();
    if (!scheduleAt || Number.isNaN(at) || at <= Date.now() + 60_000) {
      setError('اختر موعدًا لاحقًا (بعد دقيقة على الأقل من الآن).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await scheduleSiteTexts(fromDraft(draft), at, me.name);
      setScheduled({ at, data: fromDraft(draft), by: me.name });
      // تعود المسوّدة إلى المنشور حاليًا؛ المجدولة محفوظة في الشريط أعلاه
      setDraft(published);
      setScheduleAt('');
      setSaved('');
      setNotice(`جُدولت التعديلات للنشر ${fmt(at)}.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onCancelSchedule() {
    if (!confirm('إلغاء النشر المجدول؟ ستُحذف تعديلاته ما لم تحمّلها للتحرير أولًا.')) return;
    setBusy(true);
    try {
      await scheduleSiteTexts(null, 0, me.name);
      setScheduled(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  if (!draft || !published) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل نصوص الموقع…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">
        تحكّم بواجهة الموقع كاملة من هنا: عناوين الأقسام ونصوصها، وترتيب أقسام الرئيسية
        وإخفاؤها، وألوان الأبواب ونقوشها، وروابط التذييل. ويمكنك أيضًا تعديل أي نص
        مباشرة من صفحات الموقع بزر «تحرير النصوص» العائم أسفل الشاشة. لا يصل أي تعديل
        هنا للزوّار قبل الضغط على «نشر» أو حلول موعد جدولته.
      </p>

      {loadError && <Alert tone="coral">{loadError}</Alert>}

      {scheduled && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-3 text-sm">
          <CalendarClock className="h-5 w-5 shrink-0 text-[color:var(--gold)]" />
          <span className="min-w-0 flex-1 font-bold">
            نشر مجدول {fmt(scheduled.at)}
            {scheduled.by && <span className="font-normal text-muted-foreground"> — جدوله {scheduled.by}</span>}
          </span>
          <button
            className="btn-ghost btn-sm px-3 py-1.5 text-xs"
            onClick={() => {
              update(() => toDraft(scheduled.data));
              setNotice('حُمّلت النسخة المجدولة للتحرير. عدّلها ثم أعد جدولتها أو انشرها الآن.');
            }}
          >
            تحميلها للتحرير
          </button>
          <button className="btn-ghost btn-sm px-3 py-1.5 text-xs" onClick={onCancelSchedule} disabled={busy}>
            <X className="h-4 w-4" /> إلغاء الجدولة
          </button>
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-[color:var(--surface-2)]/60 p-1" aria-label="أقسام الاستوديو">
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPane(p.id)}
            aria-current={pane === p.id ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition',
              pane === p.id
                ? 'bg-[color:var(--surface)] text-[color:var(--maroon)] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <p.icon className="h-4 w-4" />
            {p.label}
          </button>
        ))}
      </nav>

      {pane === 'texts' && (
        <TextsPane draft={draft} published={published} update={update} onError={setError} onNotice={setNotice} />
      )}
      {pane === 'order' && <OrderPanel draft={draft} update={update} />}
      {pane === 'doors' && <DoorsPanel draft={draft} update={update} subjects={subjects} />}
      {pane === 'footer' && <FooterPanel draft={draft} update={update} />}
      {pane === 'history' && (
        <TextsHistory
          key={historyKey}
          current={fromDraft(published)}
          onRestore={(s, when) => {
            update(() => toDraft(s));
            setPane('texts');
            setNotice(`حُمّلت نسخة ${when} للتحرير. راجعها ثم اضغط «نشر» لاعتمادها.`);
          }}
        />
      )}

      {error && <Alert tone="coral">{error}</Alert>}
      {notice && <Alert tone="gold">{notice}</Alert>}

      {/* شريط النشر ثابت أسفل الشاشة ما دامت هناك تعديلات */}
      <div
        className={cn(
          'space-y-3 border-t border-[color:var(--hairline)] bg-[color:var(--paper)] pt-5',
          dirty && 'sticky bottom-0 z-10 -mx-1 px-1 pb-4 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.25)]'
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onPublish} disabled={busy || !dirty} className="btn-primary btn-sm px-6 py-3 text-sm">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : saved && !dirty ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {saved && !dirty ? saved : 'نشر الآن لجميع الزوّار'}
          </button>
          {dirty && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="datetime-local"
                  className={inp + ' w-auto py-1.5'}
                  value={scheduleAt}
                  min={localInput(Date.now() + 120_000)}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  aria-label="موعد النشر المجدول"
                />
              </label>
              <button
                className="btn-ghost btn-sm px-4 py-2.5 text-sm"
                disabled={busy || !scheduleAt}
                onClick={onSchedule}
              >
                جدولة النشر
              </button>
              <button className="btn-ghost btn-sm px-4 py-2.5 text-sm" onClick={() => update(() => published)}>
                <Undo2 className="h-4 w-4" /> تراجع عن التعديلات
              </button>
            </>
          )}
          {!isFirebaseConfigured && (
            <span className="text-xs text-muted-foreground">وضع العرض: يُحفظ التعديل في هذا المتصفّح فقط.</span>
          )}
        </div>
        {dirty && scheduled && (
          <p className="text-xs text-muted-foreground">
            تنبيه: النشر المجدول ({fmt(scheduled.at)}) سيحلّ محلّ ما تنشره الآن عند حلول موعده.
          </p>
        )}
      </div>
    </div>
  );
}

function Alert({ tone, children }: { tone: 'coral' | 'gold'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-xl px-4 py-2.5 text-sm font-bold',
        tone === 'coral'
          ? 'bg-[color:var(--coral)]/15 text-[color:var(--coral)]'
          : 'bg-[color:var(--gold)]/15 text-[color:var(--gold)]'
      )}
    >
      {children}
    </p>
  );
}

/** النصوص والعناوين: مجموعات قابلة للطيّ مع بحث وتصفية واستعادة ونسخ احتياطي. */
function TextsPane({
  draft,
  published,
  update,
  onError,
  onNotice,
}: {
  draft: Draft;
  published: Draft;
  update: (fn: (d: Draft) => Draft) => void;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setValue = (k: string, value: string) =>
    update((d) => ({ ...d, values: { ...d.values, [k]: value } }));

  const resetKeys = (keys: string[]) =>
    update((d) => {
      const values = { ...d.values };
      for (const k of keys) values[k] = SITE_TEXT_DEFAULTS[k];
      return { ...d, values };
    });

  const toggleHidden = (id: string) =>
    update((d) => ({
      ...d,
      hidden: d.hidden.includes(id) ? d.hidden.filter((h) => h !== id) : [...d.hidden, id],
    }));

  const q = query.trim();
  const visibleGroups = useMemo(() => {
    const match = (f: SiteTextField) =>
      (!onlyModified || isModified(draft, f.key)) &&
      (!q || [f.label, f.default, draft.values[f.key]].some((v) => v.includes(q)));
    return SITE_TEXT_GROUPS.map((g) => ({
      group: g,
      fields: q && g.label.includes(q) && !onlyModified ? g.fields : g.fields.filter(match),
    })).filter((x) => x.fields.length > 0);
  }, [draft, q, onlyModified]);

  const modifiedCount = Object.keys(SITE_TEXT_DEFAULTS).filter((k) => isModified(draft, k)).length;

  function onExport() {
    const blob = new Blob([JSON.stringify(fromDraft(draft), null, 2)], { type: 'application/json' });
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
      onNotice(`استُوردت النسخة (${Object.keys(s.texts).length} نصًّا معدّلًا). راجعها ثم اضغط «نشر».`);
    } catch {
      onError('الملف ليس نسخة احتياطية صالحة للنصوص (JSON).');
    }
  }

  return (
    <div className="space-y-4">
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
        <button className="btn-ghost btn-sm px-3 py-2 text-sm" onClick={onExport} title="تنزيل نسخة احتياطية من كل الإعدادات">
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
        {modifiedCount > 0 && (
          <button
            className="btn-ghost btn-sm px-3 py-2 text-sm"
            onClick={() => {
              if (confirm('إعادة كل النصوص إلى أصلها؟ لن يُنشر ذلك قبل الضغط على «نشر».'))
                resetKeys(Object.keys(SITE_TEXT_DEFAULTS));
            }}
          >
            <RotateCcw className="h-4 w-4" /> استعادة كل النصوص الأصلية
          </button>
        )}
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
                  <a href={group.href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm px-3 py-1.5 text-xs">
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
    </div>
  );
}
