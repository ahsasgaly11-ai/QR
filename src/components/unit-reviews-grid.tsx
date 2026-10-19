'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { isFirebaseConfigured, isOwnerUid, watchAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type ReviewRow = {
  activity: Activity;
  subjectId: string;
  subjectTitle: string;
  gradeTitle: string;
  /** مفتاح الوحدة (المادة/المستوى/الوحدة) لتجميع مراجعاتها في بطاقة واحدة */
  unitKey: string;
  unitTitle: string;
  /** ترتيب الوحدة في مستواها كما في صفحة المادة (0 إن لم تُعرف) */
  unitNumber: number;
  unitColor?: string;
};

const ALL = '__all__';

/**
 * مراجعات الوحدات مجمّعة في بطاقات وحدات قابلة للطيّ على نسق صفحة المادة
 * (CurriculumExplorer): رأس الوحدة برقمها وعنوانها، وتحته بطاقات ألعابها بمعاينة
 * حيّة لشكل اللعبة كبطاقات أنشطة الدروس.
 */
export function UnitReviewsGrid({ initialRows }: { initialRows: ReviewRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isOwner, setIsOwner] = useState(false);
  const [subjectId, setSubjectId] = useState(ALL);
  // الوحدات مفتوحة افتراضيًا لتظهر بطاقات الألعاب بمعايناتها فورًا، وتُطوى بالنقر
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    const unsub = watchAdmin((user) => {
      if (!user) {
        if (alive) setIsOwner(false);
        return;
      }
      isOwnerUid(user.uid).then((ok) => {
        if (alive) setIsOwner(ok);
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  function handleChanged(id: string, patch: Partial<Activity> | null) {
    setRows((current) =>
      patch === null
        ? current.filter((r) => r.activity.id !== id)
        : current.map((r) => (r.activity.id === id ? { ...r, activity: { ...r.activity, ...patch } } : r))
    );
  }

  // تبويب لكل مادة فيها مراجعات فقط، بترتيب ظهورها
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.subjectId)) seen.set(r.subjectId, r.subjectTitle || 'أخرى');
    return [...seen.entries()];
  }, [rows]);

  // الوحدات بترتيب أحدث مراجعة فيها، ومراجعاتها بالترتيب نفسه
  const units = useMemo(() => {
    const shown = subjectId === ALL ? rows : rows.filter((r) => r.subjectId === subjectId);
    const map = new Map<string, { head: ReviewRow; items: Activity[] }>();
    for (const r of shown) {
      const u = map.get(r.unitKey);
      if (u) u.items.push(r.activity);
      else map.set(r.unitKey, { head: r, items: [r.activity] });
    }
    return [...map.values()];
  }, [rows, subjectId]);

  if (rows.length === 0) return null;

  return (
    <>
      {isOwner && (
        <div className="owner-note mb-6">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — يمكنك تعديل عنوان المراجعة ووصفها أو حذفها مباشرة.
        </div>
      )}

      {subjects.length > 1 && (
        <div className="mb-7 flex flex-wrap gap-2" role="tablist" aria-label="المواد">
          {[[ALL, 'الكل'] as const, ...subjects].map(([id, title]) => (
            <button
              key={id}
              role="tab"
              aria-selected={subjectId === id}
              onClick={() => setSubjectId(id)}
              className={cn('level-tab', subjectId === id && 'is-on')}
            >
              {title}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {units.map(({ head, items }, ui) => {
          const isOpen = open[head.unitKey] ?? true;
          const panelId = `review-unit-${ui}`;
          return (
            <div
              key={head.unitKey}
              className="unit-card"
              style={{ '--c': head.unitColor ?? 'var(--maroon)' } as React.CSSProperties}
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [head.unitKey]: !(o[head.unitKey] ?? true) }))}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="unit-head"
              >
                <span className="unit-medal" aria-hidden>{head.unitNumber || ui + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="unit-title">{head.unitTitle}</span>
                  <span className="unit-summary">
                    {[head.subjectTitle, head.gradeTitle].filter(Boolean).join(' • ')}
                  </span>
                </span>
                <span className="unit-count">
                  <span><b>{items.length}</b> {items.length === 1 ? 'مراجعة' : 'مراجعات'}</span>
                </span>
                <ChevronDown className={cn('unit-chev', isOpen && 'rotate-180')} aria-hidden />
              </button>

              {isOpen && (
                <div id={panelId} className="unit-body">
                  <div className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((a, i) => (
                      <ActivityCard
                        key={a.id}
                        activity={a}
                        index={i}
                        isOwner={isOwner}
                        onChanged={handleChanged}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
