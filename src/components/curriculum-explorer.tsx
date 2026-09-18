'use client';

import { useState } from 'react';
import { ChevronDown, BookMarked, FolderOpen, Inbox } from 'lucide-react';
import type { Subject } from '@/lib/types';
import { ActivityCard } from './activity-card';
import { cn } from '@/lib/utils';

export function CurriculumExplorer({ subject }: { subject: Subject }) {
  const [gradeId, setGradeId] = useState(subject.grades[0]?.id ?? '');
  const grade = subject.grades.find((g) => g.id === gradeId) ?? subject.grades[0];
  const [open, setOpen] = useState<Record<string, boolean>>(
    grade ? { [grade.units[0]?.id ?? '']: true } : {}
  );

  if (!grade) {
    return (
      <div className="rounded-3xl border border-dashed border-[color:var(--qa-gold)]/40 p-12 text-center text-muted-foreground">
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
                  ? 'bg-[color:var(--qa-maroon)] text-white shadow-md'
                  : 'bg-white/70 text-[color:var(--qa-maroon)] hover:bg-[color:var(--qa-maroon)]/10'
              )}
            >
              {g.title}
            </button>
          ))}
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
              className="overflow-hidden rounded-3xl border border-[color:var(--qa-gold)]/25 bg-[color:var(--qa-cream)] shadow-md"
            >
              <button
                onClick={() =>
                  setOpen((o) => ({ ...o, [unit.id]: !o[unit.id] }))
                }
                className="flex w-full items-center gap-4 p-5 text-right transition-colors hover:bg-black/[0.02]"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow"
                  style={{ background: unit.color ?? 'var(--qa-maroon)' }}
                >
                  <BookMarked className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-lg font-black text-[color:var(--qa-maroon)]">
                    {unit.title}
                  </span>
                  {unit.summary && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {unit.summary}
                    </span>
                  )}
                </span>
                <span className="hidden shrink-0 rounded-full bg-[color:var(--qa-maroon)]/10 px-3 py-1 text-xs font-black text-[color:var(--qa-maroon)] sm:block">
                  {count} نشاط
                </span>
                <ChevronDown
                  className={cn(
                    'h-6 w-6 shrink-0 text-[color:var(--qa-maroon)] transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-[color:var(--qa-gold)]/20 bg-black/[0.015] p-5">
                  <div className="space-y-6">
                    {unit.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <div className="mb-3 flex items-center gap-2 text-[color:var(--qa-maroon)]">
                          <FolderOpen className="h-5 w-5 text-[color:var(--qa-gold)]" />
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
                              <ActivityCard key={a.id} activity={a} index={i} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[color:var(--qa-gold)]/40 p-4 text-sm text-muted-foreground">
                            <Inbox className="h-4 w-4" />
                            لا توجد أنشطة في هذا الدرس بعد — قريبًا بإذن الله.
                          </div>
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
