'use client';

import { useMemo, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import type { Activity, ActivityType } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { ActivityCard } from './activity-card';
import { cn, normalizeAr } from '@/lib/utils';

export interface SearchRow {
  activity: Activity;
  subjectId: string;
  subjectTitle: string;
  unitTitle: string;
  lessonTitle: string;
}

const TYPES = Object.keys(ACTIVITY_META) as ActivityType[];

export function SearchExplorer({
  rows,
  subjects,
}: {
  rows: SearchRow[];
  subjects: { id: string; title: string }[];
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<ActivityType | 'all'>('all');
  const [subject, setSubject] = useState<string>('all');

  const results = useMemo(() => {
    const needle = normalizeAr(q);
    return rows.filter((r) => {
      if (type !== 'all' && r.activity.type !== type) return false;
      if (subject !== 'all' && r.subjectId !== subject) return false;
      if (!needle) return true;
      const hay = normalizeAr(
        [
          r.activity.title,
          r.activity.description ?? '',
          r.unitTitle,
          r.lessonTitle,
          r.subjectTitle,
        ].join(' ')
      );
      return hay.includes(needle);
    });
  }, [rows, q, type, subject]);

  const chip = (active: boolean) =>
    cn(
      'rounded-full px-4 py-1.5 text-sm font-bold transition-all',
      active
        ? 'text-white shadow-[var(--shadow-sm)]'
        : 'bg-[color:var(--surface)] text-foreground/70 hover:text-[color:var(--maroon)] border border-[color:var(--hairline)]'
    );

  return (
    <div>
      {/* search bar */}
      <div className="relative mx-auto max-w-2xl">
        <Search className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن نشاط، درس، أو موضوع…"
          className="w-full rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] py-4 pr-14 pl-12 text-lg font-bold text-foreground shadow-[var(--shadow-md)] outline-none transition focus:border-[color:var(--maroon)] focus:ring-4 focus:ring-[color:var(--maroon)]/15"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-[color:var(--maroon)]"
            aria-label="مسح"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* filters */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <button onClick={() => setType('all')} className={chip(type === 'all')} style={type === 'all' ? { background: 'var(--maroon)' } : {}}>
            كل الأنواع
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={chip(type === t)}
              style={type === t ? { background: ACTIVITY_META[t].color } : {}}
            >
              {ACTIVITY_META[t].label}
            </button>
          ))}
        </div>
        {subjects.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => setSubject('all')} className={chip(subject === 'all')} style={subject === 'all' ? { background: 'var(--gold)' } : {}}>
              كل المواد
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubject(s.id)}
                className={chip(subject === s.id)}
                style={subject === s.id ? { background: 'var(--gold)' } : {}}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* results */}
      <p className="mt-8 text-center text-sm font-bold text-muted-foreground">
        {results.length > 0
          ? `${results.length} نتيجة`
          : 'لا توجد نتائج مطابقة — جرّب كلمة أخرى.'}
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((r, i) => (
          <ActivityCard key={r.activity.id} activity={r.activity} index={i} />
        ))}
      </div>
    </div>
  );
}
