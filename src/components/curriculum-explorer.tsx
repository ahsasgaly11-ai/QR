'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, BookMarked, FolderOpen, Inbox, UploadCloud } from 'lucide-react';
import type { Subject, Activity } from '@/lib/types';
import { ActivityCard } from './activity-card';
import { cn } from '@/lib/utils';
import {
  listLocalActivities,
  getLocalStructure,
  mergeLocalIntoSubject,
} from '@/lib/local-store';

export function CurriculumExplorer({ subject: serverSubject }: { subject: Subject }) {
  // ادمج ما رُفع في «وضع العرض» (محفوظ في هذا المتصفّح) مع ما يأتي من الخادم
  const [localActs, setLocalActs] = useState<Activity[]>([]);
  const [localStruct, setLocalStruct] = useState<Subject[] | null>(null);
  // ما رفعه المالك للتوّ وقد لا تكون الصفحة المُخزَّنة قد التقطته بعد
  const [liveActs, setLiveActs] = useState<Activity[]>([]);
  const [liveStruct, setLiveStruct] = useState<Subject[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // تعديلات المالك الفورية قبل إعادة توليد الصفحة
  const [patched, setPatched] = useState<Record<string, Partial<Activity> | null>>({});

  useEffect(() => {
    setLocalStruct(getLocalStructure());
    listLocalActivities().then(setLocalActs);
  }, []);

  // الصفحة تُعاد توليدها كل 30 ثانية، فقد يتأخّر ظهور نشاط رُفع قبل لحظات.
  // لذا يقرأ المالك وحده (المسجَّل دخوله) القائمة الحيّة ليرى رفعه فورًا؛
  // أمّا الزائر فلا يُحمّل شيئًا إضافيًا ولا يُستهلك من حصّة القراءات.
  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    (async () => {
      const { watchAdmin } = await import('@/lib/auth');
      stop = watchAdmin(async (user) => {
        if (!user) {
          if (alive) {
            setLiveActs([]);
            setLiveStruct(null);
            setIsOwner(false);
          }
          return;
        }
        const { isOwnerUid } = await import('@/lib/auth');
        const owner = await isOwnerUid(user.uid);
        if (alive) setIsOwner(owner);
        if (!owner) return;
        const { getUploadedActivitiesFor, getStructure } = await import('@/lib/content');
        // البنية أيضًا: قد يكون الرفع أنشأ وحدة أو درسًا جديدًا
        const [rows, tree] = await Promise.all([
          getUploadedActivitiesFor(serverSubject.id),
          getStructure(),
        ]);
        if (!alive) return;
        setLiveActs(rows);
        setLiveStruct(tree);
      });
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, [serverSubject.id]);

  const subject = useMemo(() => {
    const merged = mergeLocalIntoSubject(
      serverSubject,
      liveStruct ?? localStruct,
      [...liveActs, ...localActs]
    );
    if (!Object.keys(patched).length) return merged;
    // احذف المحذوف وطبّق العناوين المعدَّلة فورًا دون انتظار الخادم
    for (const g of merged.grades)
      for (const u of g.units)
        for (const l of u.lessons) {
          l.activities = l.activities
            .filter((a) => patched[a.id] !== null)
            .map((a) => (patched[a.id] ? { ...a, ...patched[a.id] } : a));
        }
    return merged;
  }, [serverSubject, localStruct, liveStruct, localActs, liveActs, patched]);

  const [gradeId, setGradeId] = useState(serverSubject.grades[0]?.id ?? '');
  const grade = subject.grades.find((g) => g.id === gradeId) ?? subject.grades[0];
  const [open, setOpen] = useState<Record<string, boolean>>(
    grade ? { [grade.units[0]?.id ?? '']: true } : {}
  );

  if (!grade) {
    return (
      <div className="rounded-3xl border border-dashed border-[color:var(--gold)]/40 p-12 text-center text-muted-foreground">
        لا توجد مستويات متاحة لهذه المادة بعد.
      </div>
    );
  }

  return (
    <div>
      {/* grade selector */}
      {subject.grades.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {subject.grades.map((g) => (
            <button
              key={g.id}
              onClick={() => setGradeId(g.id)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-black transition-all',
                g.id === grade.id
                  ? 'bg-[color:var(--maroon)] text-white shadow-md'
                  : 'bg-[color:var(--surface)]/75 text-[color:var(--maroon)] hover:bg-[color:var(--maroon)]/10'
              )}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      {grade.units.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[color:var(--gold)]/40 bg-[color:var(--surface)] p-12 text-center">
          <BookMarked className="mx-auto h-12 w-12 text-[color:var(--gold)]" />
          <h3 className="mt-4 font-display text-xl font-bold text-[color:var(--maroon)]">
            لا توجد وحدات بعد
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            ابدأ بإضافة الوحدات والدروس ورفع أنشطتك (تجارب، محاكاة، أسئلة، ألعاب)
            من لوحة الإدارة.
          </p>
          <Link href="/admin" className="btn-primary mt-6 px-6 py-2.5 text-sm">
            <UploadCloud className="h-4 w-4" /> ابدأ من لوحة الإدارة
          </Link>
        </div>
      )}

      <div className="space-y-5">
        {grade.units.map((unit, ui) => {
          const isOpen = !!open[unit.id];
          const count = unit.lessons.reduce(
            (n, l) => n + l.activities.length,
            0
          );
          return (
            <div
              key={unit.id}
              className="overflow-hidden rounded-3xl border border-[color:var(--gold)]/25 bg-[color:var(--surface)] shadow-md"
            >
              <button
                onClick={() =>
                  setOpen((o) => ({ ...o, [unit.id]: !o[unit.id] }))
                }
                className="flex w-full items-center gap-4 p-5 text-right transition-colors hover:bg-black/[0.02]"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow"
                  style={{ background: unit.color ?? 'var(--maroon)' }}
                >
                  <BookMarked className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-lg font-black text-[color:var(--maroon)]">
                    {unit.title}
                  </span>
                  {unit.summary && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {unit.summary}
                    </span>
                  )}
                </span>
                <span className="hidden shrink-0 rounded-full bg-[color:var(--maroon)]/10 px-3 py-1 text-xs font-black text-[color:var(--maroon)] sm:block">
                  {count} نشاط
                </span>
                <ChevronDown
                  className={cn(
                    'h-6 w-6 shrink-0 text-[color:var(--maroon)] transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-[color:var(--gold)]/20 bg-black/[0.015] p-5">
                  <div className="space-y-6">
                    {unit.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <div className="mb-3 flex items-center gap-2 text-[color:var(--maroon)]">
                          <FolderOpen className="h-5 w-5 text-[color:var(--gold)]" />
                          <h4 className="font-display text-base font-black">
                            {lesson.title}
                          </h4>
                          <span className="text-xs font-bold text-muted-foreground">
                            ({lesson.activities.length})
                          </span>
                        </div>
                        {lesson.activities.length > 0 ? (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {lesson.activities.map((a, i) => (
                              <ActivityCard
                                key={a.id}
                                activity={a}
                                index={i}
                                isOwner={isOwner}
                                onChanged={(id, patch) =>
                                  setPatched((m) => ({ ...m, [id]: patch }))
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="flex items-center gap-1.5 pr-7 text-xs text-muted-foreground/70">
                            <Inbox className="h-3.5 w-3.5" />
                            لا توجد أنشطة بعد
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
