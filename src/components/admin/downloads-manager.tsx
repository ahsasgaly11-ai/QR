'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  MonitorPlay,
  Layers3,
  Save,
} from 'lucide-react';
import type { Subject } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  downloadUnitKey,
  getSettings,
  saveSettings,
  type DownloadMode,
  type SiteSettings,
} from '@/lib/site-settings';
import { cn } from '@/lib/utils';

type UnitOption = {
  key: string;
  subjectTitle: string;
  gradeTitle: string;
  unitTitle: string;
};

/**
 * إدارة صلاحية تنزيل الألعاب:
 *  - جميع الألعاب
 *  - منع التنزيل بالكامل
 *  - السماح لوحدات مختارة فقط
 *
 * اختيار الوحدة يستخدم subject + grade + unit لضمان عدم تعارض المعرّفات
 * بين مواد أو مستويات مختلفة.
 */
export function DownloadsManager({ structure }: { structure: Subject[] }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const units = useMemo<UnitOption[]>(
    () =>
      structure.flatMap((subject) =>
        subject.grades.flatMap((grade) =>
          grade.units.map((unit) => ({
            key: downloadUnitKey({
              subjectId: subject.id,
              gradeId: grade.id,
              unitId: unit.id,
            }),
            subjectTitle: subject.title,
            gradeTitle: grade.title,
            unitTitle: unit.title,
          }))
        )
      ),
    [structure]
  );

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setDraft(s);
      })
      .catch(() => {
        setError('تعذّر قراءة إعدادات التنزيل. تحقّق من اتصالك ثم أعد تحميل الصفحة.');
      });
  }, []);

  const dirty = Boolean(
    settings &&
      draft &&
      (settings.downloadMode !== draft.downloadMode ||
        settings.downloadUnitKeys.join('|') !== draft.downloadUnitKeys.join('|'))
  );

  function setMode(mode: DownloadMode) {
    if (!draft) return;
    setSaved(false);
    setDraft({
      ...draft,
      downloadMode: mode,
      downloadsEnabled: mode === 'all',
    });
  }

  function toggleUnit(key: string) {
    if (!draft) return;
    const exists = draft.downloadUnitKeys.includes(key);
    const next = exists
      ? draft.downloadUnitKeys.filter((k) => k !== key)
      : [...draft.downloadUnitKeys, key];

    setSaved(false);
    setDraft({
      ...draft,
      downloadMode: 'selected-units',
      downloadsEnabled: false,
      downloadUnitKeys: next,
    });
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      await saveSettings(draft);
      setSettings(draft);
      setSaved(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === 'permission-denied'
          ? 'رُفض الحفظ: حسابك غير مسجّل كمالك في مجموعة admins، أو قواعد Firestore غير منشورة.'
          : (e as Error)?.message || 'تعذّر الحفظ. تحقّق من اتصالك ثم أعد المحاولة.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!draft && !error) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل إعدادات التنزيل…
      </div>
    );
  }

  const mode = draft?.downloadMode ?? 'none';
  const selectedCount = draft?.downloadUnitKeys.length ?? 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card-premium rounded-3xl p-6">
        <div className="mb-5">
          <h3 className="font-display text-xl font-black text-[color:var(--maroon)]">
            صلاحيات تنزيل الألعاب
          </h3>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            اختر هل تريد السماح بتنزيل كل الألعاب، منعها جميعًا، أو إتاحة التنزيل
            لوحدات محددة فقط من الكتاب.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ModeCard
            active={mode === 'all'}
            icon={Download}
            title="كل الألعاب"
            description="التنزيل متاح في جميع الوحدات."
            onClick={() => setMode('all')}
          />
          <ModeCard
            active={mode === 'none'}
            icon={MonitorPlay}
            title="منع التنزيل"
            description="اللعب داخل الموقع فقط."
            onClick={() => setMode('none')}
          />
          <ModeCard
            active={mode === 'selected-units'}
            icon={Layers3}
            title="وحدات محددة"
            description="التنزيل متاح للوحدات التي تختارها فقط."
            onClick={() => setMode('selected-units')}
          />
        </div>

        {mode === 'selected-units' && (
          <div className="mt-6 border-t border-[color:var(--hairline)] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-black text-foreground">اختر الوحدات المسموح تنزيل ألعابها</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  المحدد حاليًا: {selectedCount} من {units.length} وحدة.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((s) =>
                      s
                        ? {
                            ...s,
                            downloadMode: 'selected-units',
                            downloadsEnabled: false,
                            downloadUnitKeys: units.map((u) => u.key),
                          }
                        : s
                    )
                  }
                  className="btn-ghost btn-sm px-3 py-2 text-xs"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((s) =>
                      s
                        ? {
                            ...s,
                            downloadMode: 'selected-units',
                            downloadsEnabled: false,
                            downloadUnitKeys: [],
                          }
                        : s
                    )
                  }
                  className="btn-ghost btn-sm px-3 py-2 text-xs"
                >
                  إلغاء الكل
                </button>
              </div>
            </div>

            <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)]/40 p-3">
              {units.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد وحدات في بنية المنهج الحالية.
                </p>
              ) : (
                units.map((unit) => {
                  const checked = draft?.downloadUnitKeys.includes(unit.key) ?? false;
                  return (
                    <label
                      key={unit.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
                        checked
                          ? 'border-[color:var(--maroon)] bg-[color:var(--maroon)]/5'
                          : 'border-[color:var(--hairline)] bg-[color:var(--surface)] hover:border-[color:var(--gold)]'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnit(unit.key)}
                        className="mt-1 h-5 w-5 accent-[color:var(--maroon)]"
                      />
                      <span className="min-w-0">
                        <span className="block font-black text-[color:var(--maroon)]">
                          {unit.unitTitle}
                        </span>
                        <span className="mt-1 block text-xs font-bold text-muted-foreground">
                          {unit.subjectTitle} ← {unit.gradeTitle}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {selectedCount === 0 && (
              <p className="mt-3 rounded-xl bg-[color:var(--gold)]/10 px-4 py-3 text-sm font-bold text-[color:var(--gold)]">
                لم تحدد أي وحدة؛ بعد الحفظ لن يظهر زر التحميل لأي لعبة.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--hairline)] pt-5">
          <p className="text-sm font-bold text-muted-foreground">
            {mode === 'all'
              ? 'الحالة: التنزيل متاح لكل الألعاب.'
              : mode === 'none'
                ? 'الحالة: التنزيل متوقف لجميع الألعاب.'
                : `الحالة: التنزيل متاح في ${selectedCount} وحدة محددة.`}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || busy}
            className="flex items-center gap-2 rounded-xl bg-[color:var(--maroon)] px-5 py-2.5 text-sm font-black text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ إعدادات التنزيل
          </button>
        </div>
      </div>

      {saved && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          تم حفظ صلاحيات التنزيل وتصل التغييرات للزوّار مباشرة.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}

      {!isFirebaseConfigured && (
        <p className="rounded-xl bg-[color:var(--gold)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--gold)]">
          وضع العرض المحلي: Firebase غير مُعدّ، لذا تُحفظ الإعدادات في هذا المتصفّح فقط.
        </p>
      )}
    </div>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Download;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-right transition',
        active
          ? 'border-[color:var(--maroon)] bg-[color:var(--maroon)]/5 shadow-sm'
          : 'border-[color:var(--hairline)] bg-[color:var(--surface)] hover:border-[color:var(--gold)]'
      )}
    >
      <span
        className={cn(
          'mb-3 grid h-10 w-10 place-items-center rounded-xl',
          active
            ? 'bg-[color:var(--maroon)] text-white'
            : 'bg-[color:var(--surface-2)] text-[color:var(--maroon)]'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="block font-black text-[color:var(--maroon)]">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}
