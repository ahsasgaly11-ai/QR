'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, BookMarked, Inbox, UploadCloud, Search } from 'lucide-react';
import type { Subject, Activity } from '@/lib/types';
import { ActivityCard } from './activity-card';
import { cn, normalizeAr } from '@/lib/utils';
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
  // عند دخول الصفحة تُعرض عناوين الوحدات فقط (كلّها مطويّة)، ولا تنسدل دروس
  // أي وحدة إلا عند نقر الزائر عليها.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // البحث داخل المادة: يطابق عنوان الدرس أو عنوان أحد أنشطته، بلا تشكيل
  const [query, setQuery] = useState('');
  const q = normalizeAr(query);

  if (!grade) {
    return (
      <div className="explorer-empty">
        <BookMarked className="mx-auto h-11 w-11 text-[color:var(--gold)]" aria-hidden />
        <p className="mt-3">لا توجد مستويات متاحة لهذه المادة بعد.</p>
      </div>
    );
  }

  const units = grade.units
    .map((unit) => {
      const lessons = q
        ? unit.lessons.filter(
            (l) =>
              normalizeAr(l.title).includes(q) ||
              l.activities.some((a) => normalizeAr(a.title).includes(q))
          )
        : unit.lessons;
      return { unit, lessons };
    })
    .filter(({ unit, lessons }) => !q || lessons.length > 0 || normalizeAr(unit.title).includes(q));

  return (
    <div>
      <div className="section-head">
        <div className="min-w-0">
          <p className="kicker">بترتيب الكتاب المدرسي</p>
          <h2 className="mt-2 font-calli text-[1.9rem] leading-[1.5] text-foreground sm:text-[2.2rem]">
            وحدات المنهج
          </h2>
        </div>
        <label className="explorer-search">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">ابحث في دروس {subject.title}</span>
          <input
            id="explorer-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`ابحث في دروس ${subject.title}`}
          />
        </label>
      </div>

      {/* المستويات */}
      {subject.grades.length > 1 && (
        <div className="mb-7 flex flex-wrap gap-2" role="tablist" aria-label="المستويات">
          {subject.grades.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === grade.id}
              onClick={() => setGradeId(g.id)}
              className={cn('level-tab', g.id === grade.id && 'is-on')}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      {grade.units.length === 0 && (
        <div className="explorer-empty">
          <BookMarked className="mx-auto h-11 w-11 text-[color:var(--gold)]" aria-hidden />
          <h3 className="mt-3 font-display text-xl text-foreground">لا توجد وحدات بعد</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            ابدأ بإضافة الوحدات والدروس ورفع أنشطتك (تجارب، محاكاة، أسئلة، ألعاب)
            من لوحة الإدارة.
          </p>
          <Link href="/admin" className="btn-primary mt-6 px-6 py-2.5 text-sm">
            <UploadCloud className="h-4 w-4" /> ابدأ من لوحة الإدارة
          </Link>
        </div>
      )}

      {q && units.length === 0 && (
        <div className="explorer-empty">
          <p>لا توجد دروس تطابق «{query}».</p>
        </div>
      )}

      <div className="space-y-4">
        {units.map(({ unit, lessons }) => {
          const ui = grade.units.indexOf(unit);
          // نتائج البحث تُفتح تلقائيًا
          const isOpen = q ? true : !!open[unit.id];
          const count = unit.lessons.reduce((n, l) => n + l.activities.length, 0);
          const covered = unit.lessons.filter((l) => l.activities.length > 0).length;
          const color = unit.color ?? 'var(--maroon)';
          const panelId = `unit-panel-${unit.id}`;
          return (
            <div key={unit.id} className="unit-card" style={{ '--c': color } as React.CSSProperties}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [unit.id]: !o[unit.id] }))}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="unit-head"
              >
                <span className="unit-medal" aria-hidden>{ui + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="unit-title">{unit.title}</span>
                  {unit.summary && <span className="unit-summary">{unit.summary}</span>}
                </span>
                <span className="unit-count">
                  <span><b>{unit.lessons.length}</b> دروس</span>
                  <span><b>{count}</b> نشاطًا</span>
                  {unit.lessons.length > 0 && (
                    <span
                      className="unit-bar"
                      title={`${covered} من ${unit.lessons.length} دروس لها أنشطة`}
                      aria-label={`${covered} من ${unit.lessons.length} دروس لها أنشطة`}
                    >
                      <i style={{ width: `${(covered / unit.lessons.length) * 100}%` }} />
                    </span>
                  )}
                </span>
                <ChevronDown className={cn('unit-chev', isOpen && 'rotate-180')} aria-hidden />
              </button>

              {isOpen && (
                <div id={panelId} className="unit-body">
                  <ol className="lesson-list">
                    {lessons.map((lesson, li) => {
                      const m = lesson.title.match(/^\s*([\d٠-٩]+(?:[.,٫][\d٠-٩]+)?)\s+(.*)$/);
                      const num = m ? m[1] : String(li + 1);
                      const title = m ? m[2] : lesson.title;
                      return (
                        <li key={lesson.id} className="lesson-item">
                          <span className="lesson-num" aria-hidden>{num}</span>
                          <div className="min-w-0">
                            <h3 className="lesson-title">
                              <span className="sr-only">{num} </span>
                              {title}
                            </h3>
                            {lesson.activities.length > 0 ? (
                              <div className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {lesson.activities.map((a, i) => (
                                  <ActivityCard
                                    key={a.id}
                                    activity={a}
                                    index={i}
                                    isOwner={isOwner}
                                    onChanged={(id, patch) =>
                                      setPatched((p) => ({ ...p, [id]: patch }))
                                    }
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="lesson-empty">
                                <Inbox className="h-3.5 w-3.5" aria-hidden />
                                لا توجد أنشطة بعد
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
