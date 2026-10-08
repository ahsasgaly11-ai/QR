'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Activity, ActivityType } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { ActivityCard } from './activity-card';
import { ACTIVITY_ICON, HeritageIcon } from './heritage-icons';
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
  rows: serverRows,
  subjects,
}: {
  rows: SearchRow[];
  subjects: { id: string; title: string }[];
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<ActivityType | 'all'>('all');
  const [subject, setSubject] = useState<string>('all');
  const [localRows, setLocalRows] = useState<SearchRow[]>([]);

  // ضمّ الأنشطة المرفوعة في «وضع العرض» (محفوظة في هذا المتصفّح)
  useEffect(() => {
    Promise.all([
      import('@/lib/local-store').then((m) => m.listLocalActivities()),
      import('@/lib/local-store').then((m) => m.getLocalStructure()),
    ]).then(([acts, struct]) => {
      setLocalRows(
        acts.map((a) => {
          const s = struct?.find((x) => x.id === a.subjectId);
          const g = s?.grades.find((x) => x.id === a.gradeId);
          const u = g?.units.find((x) => x.id === a.unitId);
          const l = u?.lessons.find((x) => x.id === a.lessonId);
          return {
            activity: a,
            subjectId: a.subjectId,
            subjectTitle: s?.title ?? '',
            unitTitle: u?.title ?? '',
            lessonTitle: l?.title ?? '',
          };
        })
      );
    });
  }, []);

  const rows = useMemo(() => {
    const ids = new Set(serverRows.map((r) => r.activity.id));
    return [...serverRows, ...localRows.filter((r) => !ids.has(r.activity.id))];
  }, [serverRows, localRows]);

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

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.activity.type] = (c[r.activity.type] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      {/* بئر البحث: حقل كبير بحافّة سفلية بارزة */}
      <label className="search-well">
        <Search className="h-6 w-6 shrink-0 text-[color:var(--gold)]" aria-hidden />
        <span className="sr-only">ابحث في الأنشطة</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب كلمة: المغناطيس، النبات، الكسور…"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="مسح البحث" className="search-clear">
            <X className="h-5 w-5" />
          </button>
        )}
      </label>

      {/* أنواع الأنشطة بأيقوناتها، ثم المواد */}
      <div className="mt-6 grid gap-3">
        <div className="search-types" role="group" aria-label="نوع النشاط">
          <button type="button" onClick={() => setType('all')} className={cn('search-type', type === 'all' && 'is-on')} aria-pressed={type === 'all'}>
            <span className="search-type-n">{rows.length}</span>
            الكل
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn('search-type', type === t && 'is-on')}
              aria-pressed={type === t}
            >
              <HeritageIcon kind={ACTIVITY_ICON[t]} className="h-8 w-8" />
              {ACTIVITY_META[t].label}
              <span className="search-type-n">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        {subjects.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="المادة">
            <button type="button" onClick={() => setSubject('all')} className={cn('level-tab', subject === 'all' && 'is-on')} aria-pressed={subject === 'all'}>
              كل المواد
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubject(s.id)}
                className={cn('level-tab', subject === s.id && 'is-on')}
                aria-pressed={subject === s.id}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* النتائج */}
      <p className="mt-10 text-sm font-semibold text-muted-foreground" aria-live="polite">
        {results.length > 0 ? (
          <>
            <b className="text-lg text-foreground">{results.length}</b> {results.length === 1 ? 'نتيجة' : 'نتائج'}
            {q && <> لـ «{q}»</>}
          </>
        ) : null}
      </p>

      {results.length > 0 ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r, i) => (
            <ActivityCard key={r.activity.id} activity={r.activity} index={i} />
          ))}
        </div>
      ) : (
        <div className="explorer-empty mt-2">
          <HeritageIcon kind="question" className="mx-auto h-20 w-20" />
          <h3 className="mt-3 font-calli text-2xl text-foreground">
            {rows.length === 0 ? 'لا توجد أنشطة بعد' : 'لا توجد نتائج مطابقة'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? 'ستظهر الأنشطة هنا عند إضافتها من لوحة الإدارة.'
              : 'جرّب كلمة أخرى، أو اختر «الكل» من الأنواع والمواد.'}
          </p>
        </div>
      )}
    </div>
  );
}
