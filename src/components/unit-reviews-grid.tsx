'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { Reveal } from '@/components/reveal';
import { isFirebaseConfigured, isOwnerUid, watchAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type ReviewRow = {
  activity: Activity;
  subjectId: string;
  subjectTitle: string;
  /** المستوى والوحدة كما يظهران فوق البطاقة */
  context: string;
};

const ALL = '__all__';

/** شبكة بطاقات المراجعات على نسق صفحتي الألعاب والعروض التقديمية */
export function UnitReviewsGrid({ initialRows }: { initialRows: ReviewRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isOwner, setIsOwner] = useState(false);
  const [subjectId, setSubjectId] = useState(ALL);

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
  const shown = subjectId === ALL ? rows : rows.filter((r) => r.subjectId === subjectId);

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r, i) => (
          <Reveal key={r.activity.id} delay={i * 70}>
            <p className="mb-2 truncate text-xs font-semibold text-muted-foreground">
              {[r.subjectTitle, r.context].filter(Boolean).join(' • ')}
            </p>
            <ActivityCard activity={r.activity} index={i} isOwner={isOwner} onChanged={handleChanged} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
