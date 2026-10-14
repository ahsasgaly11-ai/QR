'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, Loader2, RefreshCw, SpellCheck2, X } from 'lucide-react';
import type { Activity, Subject } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  fetchUploadedActivities,
  getStructure,
  saveStructure,
  updateActivity,
} from '@/lib/content';
import { revalidateContent } from '@/lib/revalidate';
import {
  AUDIT_KIND_LABEL,
  auditContent,
  type AuditFinding,
  type AuditKind,
} from '@/lib/content-audit';
import { cn } from '@/lib/utils';

const KINDS = Object.keys(AUDIT_KIND_LABEL) as AuditKind[];

/**
 * «تدقيق المحتوى»: يمسح العناوين والأوصاف والبيانات التربوية وعناوين الوحدات
 * والدروس، ويعرض كل ملاحظة مع التصحيح المقترح. المشرف يطبّق ما يوافق عليه
 * بضغطة (أو «تطبيق الكل» للإملاء والمسافات)، ويتجاهل ما لا يراه صوابًا.
 * لا يُغيَّر أي شيء دون ضغطة صريحة.
 */
export function ContentAudit({
  activities: initialActivities,
  structure: initialStructure,
}: {
  activities: Activity[];
  structure: Subject[];
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [structure, setStructure] = useState<Subject[]>(initialStructure);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AuditKind | 'all'>('all');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  // الحالة الحيّة من قاعدة البيانات (أو المتصفّح في وضع العرض) لا نسخة الخادم
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
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
  }, [tick]);

  const findings = useMemo(() => auditContent(activities, structure), [activities, structure]);
  const visible = findings.filter(
    (f) => !applied.has(f.id) && !dismissed.has(f.id) && (filter === 'all' || f.kind === filter)
  );
  const counts = useMemo(() => {
    const c: Record<AuditKind, number> = { spelling: 0, spacing: 0, type: 0, pedagogy: 0, description: 0 };
    for (const f of findings) if (!applied.has(f.id) && !dismissed.has(f.id)) c[f.kind]++;
    return c;
  }, [findings, applied, dismissed]);

  async function persistActivity(id: string, patch: Partial<Activity>) {
    const cur = activities.find((a) => a.id === id);
    if (isFirebaseConfigured) {
      await updateActivity(id, patch);
      await revalidateContent({ subjectId: cur?.subjectId, activityId: id });
    } else {
      const { getLocalRecord, saveLocalActivity } = await import('@/lib/local-store');
      const rec = await getLocalRecord(id);
      if (!rec) throw new Error('لم يُعثر على النشاط في هذا المتصفّح.');
      if (!(await saveLocalActivity({ ...rec.activity, ...patch }, rec.html)))
        throw new Error('تعذّر الحفظ في متصفّحك.');
    }
    setActivities((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function persistStructure(next: Subject[]) {
    if (isFirebaseConfigured) {
      await saveStructure(next);
      await revalidateContent({});
    } else {
      const { saveLocalStructure } = await import('@/lib/local-store');
      saveLocalStructure(next);
    }
    setStructure(next);
  }

  /** يبني التعديل الذي تقترحه الملاحظة ويحفظه. */
  async function applyOne(f: AuditFinding) {
    const t = f.target;
    if (t.scope === 'activity') {
      const a = activities.find((x) => x.id === t.activityId);
      if (!a) throw new Error('النشاط غير موجود.');
      if (f.kind === 'type' && f.suggestedType) {
        await persistActivity(a.id, { type: f.suggestedType });
        return;
      }
      if (f.after === undefined) return;
      const field = t.field;
      if (field === 'title') await persistActivity(a.id, { title: f.after });
      else if (field === 'description') await persistActivity(a.id, { description: f.after });
      else await persistActivity(a.id, { pedagogy: { ...a.pedagogy, [field]: f.after } });
      return;
    }
    const next = JSON.parse(JSON.stringify(structure)) as Subject[];
    const s = next.find((x) => x.id === t.subjectId);
    const g = s?.grades.find((x) => x.id === t.gradeId);
    const u = g?.units.find((x) => x.id === t.unitId);
    if (!u || f.after === undefined) throw new Error('الموضع غير موجود في البنية.');
    if (t.scope === 'unit') u.title = f.after;
    else {
      const l = u.lessons.find((x) => x.id === t.lessonId);
      if (!l) throw new Error('الدرس غير موجود في البنية.');
      l.title = f.after;
    }
    await persistStructure(next);
  }

  async function apply(f: AuditFinding) {
    setBusy(f.id);
    setError('');
    try {
      await applyOne(f);
      setApplied((s) => new Set(s).add(f.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تطبيق التصحيح.');
    } finally {
      setBusy(null);
    }
  }

  /** الإملاء والمسافات على الأنشطة فقط (البنية تُحفظ وثيقة واحدة، فتُطبَّق دفعة). */
  async function applyAllText() {
    const targets = visible.filter((f) => f.fixable && (f.kind === 'spelling' || f.kind === 'spacing'));
    if (!targets.length) return;
    setBusy('all');
    setError('');
    const done = new Set(applied);
    try {
      // البنية: كل التصحيحات في حفظة واحدة
      const structural = targets.filter((f) => f.target.scope !== 'activity');
      if (structural.length) {
        const next = JSON.parse(JSON.stringify(structure)) as Subject[];
        for (const f of structural) {
          const t = f.target;
          if (t.scope === 'activity' || f.after === undefined) continue;
          const u = next
            .find((x) => x.id === t.subjectId)
            ?.grades.find((x) => x.id === t.gradeId)
            ?.units.find((x) => x.id === t.unitId);
          if (!u) continue;
          if (t.scope === 'unit') u.title = f.after;
          else {
            const lessonId = t.lessonId;
            const l = u.lessons.find((x) => x.id === lessonId);
            if (l) l.title = f.after;
          }
          done.add(f.id);
        }
        await persistStructure(next);
      }
      // الأنشطة: نشاط نشاطًا، وتجميع حقول النشاط الواحد في حفظة واحدة
      const byActivity = new Map<string, AuditFinding[]>();
      for (const f of targets) {
        const t = f.target;
        if (t.scope === 'activity') byActivity.set(t.activityId, [...(byActivity.get(t.activityId) ?? []), f]);
      }
      for (const [id, list] of byActivity) {
        const a = activities.find((x) => x.id === id);
        if (!a) continue;
        const patch: Partial<Activity> = {};
        let ped = a.pedagogy;
        for (const f of list) {
          const t = f.target;
          if (t.scope !== 'activity' || f.after === undefined) continue;
          const field = t.field;
          if (field === 'title') patch.title = f.after;
          else if (field === 'description') patch.description = f.after;
          else ped = { ...ped, [field]: f.after };
          done.add(f.id);
        }
        if (ped !== a.pedagogy) patch.pedagogy = ped;
        await persistActivity(id, patch);
      }
      setApplied(done);
    } catch (e) {
      setApplied(done);
      setError(e instanceof Error ? e.message : 'توقّف التطبيق عند خطأ.');
    } finally {
      setBusy(null);
    }
  }

  const textFixable = visible.filter((f) => f.fixable && (f.kind === 'spelling' || f.kind === 'spacing')).length;
  const total = findings.length - applied.size - dismissed.size;

  return (
    <div className="space-y-4">
      <div className="panel rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <SpellCheck2 className="h-5 w-5 text-[color:var(--maroon)]" />
              {loading ? 'يجري المسح…' : total === 0 ? 'لا ملاحظات، المحتوى سليم' : `${total} ملاحظة`}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              يُفحص الإملاء والمسافات في عناوين الأنشطة وأوصافها وبياناتها التربوية وعناوين الوحدات والدروس،
              وتصنيف النوع، واكتمال الهدف التعليمي والوصف. لا يُطبَّق أي تصحيح إلا بضغطتك.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setApplied(new Set());
                setDismissed(new Set());
                setTick((t) => t + 1);
              }}
              className="btn-ghost btn-sm px-3 py-2 text-sm"
              disabled={!!busy}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> إعادة المسح
            </button>
            <button
              type="button"
              onClick={applyAllText}
              disabled={!!busy || textFixable === 0}
              className="btn-primary btn-sm px-4 py-2 text-sm"
            >
              {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              تطبيق كل تصحيحات الإملاء ({textFixable})
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="تصفية الملاحظات">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="الكل" n={total} />
          {KINDS.map((k) => (
            <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={AUDIT_KIND_LABEL[k]} n={counts[k]} />
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[color:var(--coral)]/15 px-4 py-2.5 text-sm font-bold text-[color:var(--coral)]">
            {error}
          </p>
        )}
      </div>

      {visible.length === 0 && !loading && (
        <p className="rounded-2xl border border-dashed border-[color:var(--hairline-strong)] p-6 text-center text-sm text-muted-foreground">
          لا ملاحظات في هذا التصنيف.
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((f) => (
          <li key={f.id} className="panel rounded-2xl p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('pill', KIND_TONE[f.kind])}>{AUDIT_KIND_LABEL[f.kind]}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.target.scope === 'activity'
                      ? FIELD_LABEL[f.target.field]
                      : f.target.scope === 'unit'
                        ? 'عنوان وحدة'
                        : 'عنوان درس'}
                  </span>
                </div>
                <p className="mt-1.5 truncate font-bold text-foreground" title={f.label}>
                  {f.label}
                </p>
                <p className="mt-1 text-sm text-[color:var(--ink-2)]">{f.message}</p>
                {f.before !== undefined && f.after !== undefined && (
                  <div className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                    <p className="rounded-lg bg-[color:var(--coral)]/10 px-3 py-1.5 line-through decoration-[color:var(--coral)]/60">
                      {f.before}
                    </p>
                    <p className="rounded-lg bg-[color:var(--teal)]/12 px-3 py-1.5 font-bold">{f.after}</p>
                  </div>
                )}
                {f.kind === 'type' && f.suggestedType && (
                  <p className="mt-2 text-sm">
                    المقترح:{' '}
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                      style={{ background: ACTIVITY_META[f.suggestedType].color }}
                    >
                      {ACTIVITY_META[f.suggestedType].label}
                    </span>
                  </p>
                )}
                {!f.fixable && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    يُستكمل من «إدارة الأنشطة» ← تعديل ← الهدف التعليمي والتقويم.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {f.fixable && (
                  <button
                    type="button"
                    onClick={() => apply(f)}
                    disabled={!!busy}
                    className="btn-primary btn-sm px-3 py-2 text-sm"
                  >
                    {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    تطبيق
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDismissed((s) => new Set(s).add(f.id))}
                  disabled={!!busy}
                  className="btn-ghost btn-sm px-3 py-2 text-sm"
                  title="إخفاء هذه الملاحظة في هذه الجلسة"
                >
                  <X className="h-4 w-4" /> تجاهل
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KIND_TONE: Record<AuditKind, string> = {
  spelling: 'bg-[color:var(--coral)]/12 text-[color:var(--coral)]',
  spacing: 'bg-[color:var(--gold)]/20 text-[color:var(--maroon)]',
  type: 'bg-[color:var(--teal)]/12 text-[color:var(--teal)]',
  pedagogy: 'bg-[color:var(--maroon)]/10 text-[color:var(--maroon)]',
  description: 'bg-[color:var(--surface-2)] text-muted-foreground',
};

const FIELD_LABEL = {
  title: 'عنوان نشاط',
  description: 'وصف نشاط',
  objective: 'الهدف التعليمي',
  usage: 'طريقة التوظيف',
} as const;

function FilterChip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-bold transition',
        active ? 'bg-[color:var(--maroon)] text-white' : 'bg-[color:var(--surface-2)] text-[color:var(--ink-2)] hover:text-[color:var(--maroon)]'
      )}
    >
      {label} <span className="tabular-nums opacity-80">({n})</span>
    </button>
  );
}
