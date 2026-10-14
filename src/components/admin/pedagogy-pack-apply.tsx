'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PackageCheck, Sparkles } from 'lucide-react';
import type { Activity, Subject } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import { fetchUploadedActivities, getStructure, saveStructure, updateActivity } from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import { normalizePedagogy, pedagogyStatus } from '@/lib/pedagogy';
import { fixLessonTitle, PEDAGOGY_PACK, type PackEntry } from '@/data/pedagogy-pack';
import { cn } from '@/lib/utils';

type Plan = {
  id: string;
  entry: PackEntry;
  current: Activity;
  changes: string[];
  skipPedagogy: boolean;
};

/**
 * «الحزمة التربوية»: محتوى مُعدّ مسبقًا لكل نشاط مرفوع (العنوان المصحّح،
 * النوع الصحيح، وصف للطالب، الهدف التعليمي، نواتج التعلّم، التوظيف، الفروق
 * الفردية، وأسئلة التقويم الختامي) يُطبَّق على الأنشطة دفعة واحدة بضغطة.
 *
 * لا يُستبدل ما كتبه المشرف يدويًا: النشاط الذي تكتمل بياناته التربوية
 * يُترك كما هو ما لم يُفعَّل خيار «استبدال الموجود».
 */
export function PedagogyPackApply({ activities: initial, structure: initialStructure }: { activities: Activity[]; structure: Subject[] }) {
  const [activities, setActivities] = useState<Activity[]>(initial);
  const [structure, setStructure] = useState<Subject[]>(initialStructure);
  const [loading, setLoading] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<{ ok: number; failed: string[]; lessons: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isFirebaseConfigured) {
          const [acts, tree] = await Promise.all([fetchUploadedActivities(), getStructure()]);
          if (!alive) return;
          if (acts.length) setActivities(acts);
          setStructure(tree);
        } else {
          const { listLocalActivities, getLocalStructure } = await import('@/lib/local-store');
          const acts = await listLocalActivities();
          if (!alive) return;
          if (acts.length) setActivities(acts);
          const tree = getLocalStructure();
          if (tree) setStructure(tree);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const plans = useMemo<Plan[]>(() => {
    const byId = new Map(activities.map((a) => [a.id, a]));
    const out: Plan[] = [];
    for (const [id, entry] of Object.entries(PEDAGOGY_PACK)) {
      const current = byId.get(id);
      if (!current) continue;
      const changes: string[] = [];
      if (entry.title && entry.title !== current.title) changes.push('العنوان');
      if (entry.type && entry.type !== current.type) changes.push(`النوع ← ${ACTIVITY_META[entry.type].label}`);
      if (entry.description && entry.description !== (current.description ?? '')) changes.push('الوصف');
      const complete = pedagogyStatus(current.pedagogy).complete;
      const skipPedagogy = complete && !overwrite;
      if (!skipPedagogy) changes.push(complete ? 'البيانات التربوية (استبدال)' : 'البيانات التربوية');
      out.push({ id, entry, current, changes, skipPedagogy });
    }
    return out;
  }, [activities, overwrite]);

  const pending = plans.filter((p) => p.changes.length > 0);
  const unmatched = Object.keys(PEDAGOGY_PACK).length - plans.length;
  /** عناوين دروس ما زالت بترقيم مزدوج (تُصحَّح مع الحزمة) */
  const lessonFixes = useMemo(() => {
    const out: { before: string; after: string }[] = [];
    for (const s of structure)
      for (const g of s.grades)
        for (const u of g.units)
          for (const l of u.lessons) {
            const after = fixLessonTitle(l.title);
            if (after !== l.title) out.push({ before: l.title, after });
          }
    return out;
  }, [structure]);

  async function apply() {
    setBusy(true);
    setError('');
    setReport(null);
    setProgress({ done: 0, total: pending.length });
    let ok = 0;
    const failed: string[] = [];
    let touchedSubject: string | undefined;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const patch: Partial<Activity> = {};
      if (p.entry.title && p.entry.title !== p.current.title) patch.title = p.entry.title;
      if (p.entry.type && p.entry.type !== p.current.type) patch.type = p.entry.type;
      if (p.entry.description && p.entry.description !== (p.current.description ?? ''))
        patch.description = p.entry.description;
      if (!p.skipPedagogy) {
        const ped = normalizePedagogy(p.entry.pedagogy);
        if (ped) patch.pedagogy = ped;
      }
      try {
        if (isFirebaseConfigured) {
          await updateActivity(p.id, patch);
          touchedSubject = p.current.subjectId;
        } else {
          const { getLocalRecord, saveLocalActivity } = await import('@/lib/local-store');
          const rec = await getLocalRecord(p.id);
          if (!rec) throw new Error('غير موجود في المتصفّح');
          if (!(await saveLocalActivity({ ...rec.activity, ...patch }, rec.html))) throw new Error('تعذّر الحفظ');
        }
        setActivities((list) => list.map((a) => (a.id === p.id ? { ...a, ...patch } : a)));
        ok++;
      } catch (e) {
        failed.push(`${p.current.title}: ${e instanceof Error ? e.message : 'خطأ'}`);
      }
      setProgress({ done: i + 1, total: pending.length });
    }

    // عناوين الدروس (ترقيم مزدوج ونحوه) في وثيقة البنية الواحدة
    let lessons = 0;
    try {
      let tree: Subject[] | null = null;
      if (isFirebaseConfigured) tree = await getStructure();
      else {
        const { getLocalStructure } = await import('@/lib/local-store');
        tree = getLocalStructure();
      }
      if (tree) {
        tree = JSON.parse(JSON.stringify(tree)) as Subject[];
        for (const s of tree)
          for (const g of s.grades)
            for (const u of g.units)
              for (const l of u.lessons) {
                const fix = fixLessonTitle(l.title);
                if (fix !== l.title) {
                  l.title = fix;
                  lessons++;
                }
              }
        if (lessons > 0) {
          if (isFirebaseConfigured) await saveStructure(tree);
          else {
            const { saveLocalStructure } = await import('@/lib/local-store');
            saveLocalStructure(tree);
          }
          setStructure(tree);
        }
      }
    } catch (e) {
      failed.push(`عناوين الدروس: ${e instanceof Error ? e.message : 'خطأ'}`);
    }

    if (isFirebaseConfigured) await revalidateContent({ subjectId: touchedSubject });
    setReport({ ok, failed, lessons });
    setBusy(false);
    setProgress(null);
  }

  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <PackageCheck className="h-5 w-5 text-[color:var(--maroon)]" />
            الحزمة التربوية الجاهزة
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            هدف تعليمي ونواتج تعلّم وطريقة توظيف وأسئلة تقويم ختامي مُعدّة لكل نشاط مرفوع، مع العناوين
            المصحّحة والنوع الصحيح ووصف للطالب. تُطبَّق على الأنشطة الموجودة دفعة واحدة، ويمكن تعديل أي
            شيء بعدها من «إدارة الأنشطة».
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--maroon)]"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          استبدال البيانات التربوية الموجودة
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1.5">
          في الحزمة: {Object.keys(PEDAGOGY_PACK).length}
        </span>
        <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1.5">
          مطابقة لأنشطة مرفوعة: {loading ? '…' : plans.length}
        </span>
        <span className="rounded-full bg-[color:var(--gold)]/20 px-3 py-1.5 text-[color:var(--maroon)]">
          ستتغيّر: {loading ? '…' : pending.length}
        </span>
        {!loading && lessonFixes.length > 0 && (
          <span className="rounded-full bg-[color:var(--gold)]/20 px-3 py-1.5 text-[color:var(--maroon)]">
            عناوين دروس تُصحَّح: {lessonFixes.length}
          </span>
        )}
        {unmatched > 0 && !loading && (
          <span className="rounded-full bg-[color:var(--surface-2)] px-3 py-1.5 text-muted-foreground">
            بلا نشاط مطابق: {unmatched}
          </span>
        )}
      </div>

      {!loading && lessonFixes.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-[color:var(--hairline)] p-2 text-sm">
          {lessonFixes.map((f) => (
            <li key={f.before} className="flex flex-wrap items-center gap-2 px-2 py-1">
              <span className="text-muted-foreground line-through">{f.before}</span>
              <span className="font-bold text-foreground">← {f.after}</span>
            </li>
          ))}
        </ul>
      )}
      {!loading && pending.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-1 overflow-auto rounded-xl border border-[color:var(--hairline)] p-2 text-sm">
          {pending.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[color:var(--surface-2)]">
              <span className="min-w-0 flex-1 truncate font-bold text-foreground">{p.entry.title ?? p.current.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.changes.join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
          {error}
        </p>
      )}
      {report && (
        <div
          className={cn(
            'mt-3 rounded-xl px-4 py-3 text-sm',
            report.failed.length ? 'bg-[color:var(--gold)]/15' : 'bg-[color:var(--teal)]/15'
          )}
        >
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--teal)]" />
            حُدِّث {report.ok} نشاطًا{report.lessons > 0 ? ` و${report.lessons} عنوان درس` : ''}.
          </p>
          {report.failed.length > 0 && (
            <ul className="mt-1 list-disc pr-5 text-xs text-[color:var(--coral)]">
              {report.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={busy || loading || (pending.length === 0 && lessonFixes.length === 0)}
        className="btn-primary mt-4 px-5 py-2.5 text-sm"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress ? `${progress.done}/${progress.total}` : 'جارٍ التطبيق…'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {pending.length > 0
              ? `تطبيق الحزمة على ${pending.length} نشاطًا${lessonFixes.length ? ` و${lessonFixes.length} عنوان درس` : ''}`
              : lessonFixes.length > 0
                ? `تصحيح ${lessonFixes.length} عنوان درس`
                : 'لا تغييرات معلّقة'}
          </>
        )}
      </button>
    </div>
  );
}
