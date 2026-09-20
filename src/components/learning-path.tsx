'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Trophy, Target, PlayCircle } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { getAllProgress, type ActivityProgress } from '@/lib/activity-events';
import {
  suggestNext,
  overallStats,
  inProgress,
  MASTERY_THRESHOLD,
  type Suggestion,
  type OverallStats,
} from '@/lib/adaptive';

const REASON: Record<Suggestion['reason'], { label: string; hint: string }> = {
  continue: { label: 'واصِل من حيث توقّفت', hint: 'أنت قريب من الإتقان — أكمل هذا النشاط' },
  new: { label: 'ابدأ نشاطك التالي', hint: 'خطوتك القادمة في رحلة المنهج' },
  review: { label: 'راجع لتثبيت إتقانك', hint: 'أتقنتَ الكثير! راجعة سريعة تثبّت ما تعلّمت' },
  empty: { label: '', hint: '' },
};

function pct(x: number) {
  return Math.round(x * 100);
}

/** حلقة تقدّم دائرية بسيطة (SVG) بلون الهوية. */
function Ring({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value);
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--maroon)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className="absolute text-lg font-black text-[color:var(--maroon)]">
        {pct(value)}%
      </span>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--surface-2)] text-[color:var(--maroon)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-black text-[color:var(--ink)]">{value}</span>
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

export function LearningPath({ activities }: { activities: Activity[] }) {
  const [progress, setProgress] = useState<ActivityProgress[] | null>(null);

  useEffect(() => {
    setProgress(getAllProgress());
  }, []);

  // قبل قراءة التخزين المحلّي لا نعرض شيئًا (يتجنّب اختلاف الترطيب SSR)
  if (progress === null) return null;

  const stats: OverallStats = overallStats(activities, progress);
  const suggestion = suggestNext(activities, progress);
  const wip = inProgress(activities, progress).slice(0, 3);
  const started = stats.attempted > 0;

  if (!suggestion.activity) return null;

  const meta = ACTIVITY_META[suggestion.activity.type];
  const r = REASON[suggestion.reason];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-3xl border-2 border-[color:var(--gold)]/30 bg-[color:var(--surface)] p-5 shadow-[var(--shadow-md)] sm:p-7">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[color:var(--gold)]" />
          <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
            رحلتك التعليمية
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          {/* الإحصاء العام */}
          <div className="flex items-center gap-5 rounded-2xl bg-[color:var(--surface-2)]/60 p-4">
            <Ring value={started ? stats.avgMastery : 0} />
            <div className="space-y-3">
              <Stat icon={Trophy} value={stats.mastered} label="نشاط أُتقن" />
              <Stat icon={Target} value={stats.attempted} label="نشاط بدأته" />
            </div>
          </div>

          {/* النشاط المقترح */}
          <div className="flex flex-col justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-wide text-[color:var(--gold)]">
                {r.label}
              </p>
              <Link
                href={`/play/${suggestion.activity.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] p-3 transition hover:border-[color:var(--maroon)] hover:shadow-[var(--shadow-sm)]"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
                  style={{ background: meta.color }}
                >
                  <PlayCircle className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[color:var(--ink)]">
                    {suggestion.activity.title}
                  </span>
                  <span className="block text-xs font-medium text-muted-foreground">
                    {meta.label} · {r.hint}
                  </span>
                </span>
                <ArrowLeft className="h-5 w-5 shrink-0 text-[color:var(--maroon)] transition group-hover:-translate-x-1" />
              </Link>
            </div>

            {/* واصِل التعلّم */}
            {wip.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">واصِل التعلّم</p>
                <ul className="space-y-2">
                  {wip.map(({ activity, mastery }) => (
                    <li key={activity.id}>
                      <Link
                        href={`/play/${activity.id}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[color:var(--surface-2)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)]">
                          {activity.title}
                        </span>
                        <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${pct(mastery)}%`,
                              background:
                                mastery >= MASTERY_THRESHOLD
                                  ? 'var(--gold)'
                                  : 'var(--maroon)',
                            }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-left text-xs font-black text-[color:var(--maroon)]">
                          {pct(mastery)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
