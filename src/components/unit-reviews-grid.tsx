'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Gamepad2 } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { HeritageIcon } from '@/components/heritage-icons';
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
 * (CurriculumExplorer): رأس الوحدة برقمها وعنوانها، وتحته ألعابها تذاكر صغيرة
 * بمحارة طافية على نسق تذكرة «عرض الدرس».
 */
export function UnitReviewsGrid({ initialRows }: { initialRows: ReviewRow[] }) {
  const rows = initialRows;
  const [subjectId, setSubjectId] = useState(ALL);
  // تُعرض عناوين الوحدات مطويّة كما في صفحة المادة، وتنسدل عند النقر
  const [open, setOpen] = useState<Record<string, boolean>>({});

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
          const isOpen = !!open[head.unitKey];
          const panelId = `review-unit-${ui}`;
          return (
            <div
              key={head.unitKey}
              className="unit-card"
              style={{ '--c': head.unitColor ?? 'var(--maroon)' } as React.CSSProperties}
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [head.unitKey]: !o[head.unitKey] }))}
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
                  <div className="review-tickets">
                    {items.map((a) => (
                      <Link
                        key={a.id}
                        href={`/play/${a.id}`}
                        className="review-ticket"
                        aria-label={`العب ${a.title}`}
                      >
                        <span className="review-ticket-icon" aria-hidden>
                          <HeritageIcon kind="oyster" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="review-ticket-kicker">
                            <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                            مراجعة الوحدة • لعبة
                          </span>
                          <span className="review-ticket-title">{a.title}</span>
                        </span>
                        <span className="review-ticket-go" aria-hidden>
                          <ArrowLeft className="h-5 w-5" />
                        </span>
                      </Link>
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
