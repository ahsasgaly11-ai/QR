'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/activity-card';
import { Reveal } from '@/components/reveal';
import { SectionHead } from '@/components/home/section-head';
import { HeritageIcon } from '@/components/heritage-icons';
import { isFirebaseConfigured, isOwnerUid, watchAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type PresentationRow = {
  activity: Activity;
  subjectId: string;
  subjectTitle: string;
  /** المستوى والدرس كما يظهران فوق البطاقة */
  context: string;
};

const ALL = '__all__';

export function PresentationsGrid({ initialRows }: { initialRows: PresentationRow[] }) {
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

  // تبويب لكل مادة فيها عروض فقط، بترتيب ظهورها
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.subjectId)) seen.set(r.subjectId, r.subjectTitle || 'أخرى');
    return [...seen.entries()];
  }, [rows]);
  const shown = subjectId === ALL ? rows : rows.filter((r) => r.subjectId === subjectId);

  return (
    <>
      <SectionHead
        kicker="مكتبة العروض"
        title="اختر عرض الدرس"
        lead={rows.length > 0 ? 'كل عرض مرتبط بدرسه، ويظهر أيضًا زرًّا «عرض الدرس» فوق أنشطة ذلك الدرس.' : undefined}
      />

      {isOwner && (
        <div className="owner-note mb-6">
          <ShieldCheck className="h-5 w-5" />
          وضع المشرف مفعّل — يمكنك تعديل عنوان العرض ووصفه أو حذفه مباشرة.
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

      {shown.length > 0 ? (
        // grid-cols-1 = minmax(0,1fr): بدونه يتمدّد العمود الضمني على الجوال بعرض
        // سطر المادة والدرس (truncate لا يلتفّ) فتتّسع الصفحة أفقيًا ويُصغّرها الهاتف.
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r, i) => (
            <Reveal key={r.activity.id} delay={i * 70} className="min-w-0">
              <p className="mb-2 truncate text-xs font-semibold text-muted-foreground">
                {[r.subjectTitle, r.context].filter(Boolean).join(' • ')}
              </p>
              <ActivityCard activity={r.activity} index={i} isOwner={isOwner} onChanged={handleChanged} />
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal>
          <div className="explorer-empty">
            <HeritageIcon kind="screen" className="mx-auto h-20 w-20" />
            <h3 className="mt-3 font-calli text-2xl text-foreground">لا توجد عروض مضافة بعد</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-7 text-muted-foreground">
              هذا قسم تجريبي. ستظهر العروض التقديمية هنا تلقائيًا عند رفعها من لوحة الإدارة.
            </p>
          </div>
        </Reveal>
      )}
    </>
  );
}
