// ---------------------------------------------------------------------------
// Advanced heatmap analytics helpers.
// Keeps filtering/period calculations out of the rendering components.
// ---------------------------------------------------------------------------

import type { Activity, Subject } from '@/lib/types';
import type { QatarSchool, SchoolGender, SchoolStage } from '@/data/qatar-schools';
import type { MetricKey, SchoolMetric } from '@/lib/heatmap-shared';

export type PeriodKey = 'today' | '7d' | '30d' | 'term' | 'all';
export type NormalizationMode = 'total' | 'per-school';

export interface SchoolActivityMetric {
  schoolId: string;
  activityId: string;
  subjectId: string;
  gradeId: string;
  unitId: string;
  plays: number;
  downloads: number;
  playsByDay: Record<string, number>;
  downloadsByDay: Record<string, number>;
  lastActiveAt: number;
}

export interface HeatmapFilters {
  period: PeriodKey;
  subjectId: string;
  gradeId: string;
  unitId: string;
  gender: 'all' | SchoolGender;
  stage: 'all' | SchoolStage;
}

export interface PeriodWindow {
  current: string[] | null;
  previous: string[] | null;
  playback: string[];
  label: string;
}

export interface ActivityAggregate {
  activityId: string;
  value: number;
  plays: number;
  downloads: number;
  lastActiveAt: number;
}

export interface UnitAggregate {
  key: string;
  subjectId: string;
  gradeId: string;
  unitId: string;
  title: string;
  value: number;
  plays: number;
  downloads: number;
  activeSchools: number;
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateAtLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, amount: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + amount);
  return out;
}

function daysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (
    let d = dateAtLocalMidnight(start);
    d.getTime() <= dateAtLocalMidnight(end).getTime();
    d = addDays(d, 1)
  ) {
    out.push(localDateKey(d));
  }
  return out;
}

function currentTermStart(now: Date): Date {
  // The platform is school-oriented. Use the two teaching-semester anchors:
  // 1 January and 1 September. July/August remain part of the January term
  // until the new academic year begins.
  return now.getMonth() >= 8
    ? new Date(now.getFullYear(), 8, 1)
    : new Date(now.getFullYear(), 0, 1);
}

export function getPeriodWindow(period: PeriodKey, now = new Date()): PeriodWindow {
  const end = dateAtLocalMidnight(now);
  if (period === 'all') {
    return {
      current: null,
      previous: null,
      playback: daysBetween(addDays(end, -29), end),
      label: 'كل الفترة',
    };
  }

  let start = end;
  let label = 'اليوم';
  if (period === '7d') {
    start = addDays(end, -6);
    label = 'آخر 7 أيام';
  } else if (period === '30d') {
    start = addDays(end, -29);
    label = 'آخر 30 يومًا';
  } else if (period === 'term') {
    start = currentTermStart(now);
    label = 'الفصل الحالي';
  }

  const current = daysBetween(start, end);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(current.length - 1));
  const previous = daysBetween(previousStart, previousEnd);
  const playback = current.length > 45 ? current.slice(-45) : current;

  return { current, previous, playback, label };
}

export function hasContentFilter(filters: HeatmapFilters): boolean {
  return (
    filters.subjectId !== 'all' ||
    filters.gradeId !== 'all' ||
    filters.unitId !== 'all'
  );
}

export function schoolMatches(
  school: QatarSchool,
  filters: Pick<HeatmapFilters, 'gender' | 'stage'>
): boolean {
  return (
    (filters.gender === 'all' || school.gender === filters.gender) &&
    (filters.stage === 'all' || school.stage === filters.stage)
  );
}

export function activityMatches(
  row: Pick<SchoolActivityMetric, 'subjectId' | 'gradeId' | 'unitId'>,
  filters: Pick<HeatmapFilters, 'subjectId' | 'gradeId' | 'unitId'>
): boolean {
  return (
    (filters.subjectId === 'all' || row.subjectId === filters.subjectId) &&
    (filters.gradeId === 'all' || row.gradeId === filters.gradeId) &&
    (filters.unitId === 'all' || row.unitId === filters.unitId)
  );
}

export function sumDays(
  map: Record<string, number> | undefined,
  days: string[] | null
): number {
  if (!map) return 0;
  if (!days) return Object.values(map).reduce((n, v) => n + (Number(v) || 0), 0);
  return days.reduce((n, d) => n + (Number(map[d]) || 0), 0);
}

export function rowMetricValue(
  row: SchoolActivityMetric,
  metric: Extract<MetricKey, 'plays' | 'downloads'>,
  days: string[] | null
): number {
  if (!days) return metric === 'plays' ? row.plays || 0 : row.downloads || 0;
  return metric === 'plays'
    ? sumDays(row.playsByDay, days)
    : sumDays(row.downloadsByDay, days);
}

export function buildSchoolValues(args: {
  baseMetrics: Record<string, SchoolMetric>;
  activityMetrics: SchoolActivityMetric[];
  schools: QatarSchool[];
  filters: HeatmapFilters;
  metric: MetricKey;
  days: string[] | null;
}): Record<string, number> {
  const { baseMetrics, activityMetrics, schools, filters, metric, days } = args;
  const out: Record<string, number> = {};
  const contentFiltered = hasContentFilter(filters);
  const eligible = new Set(
    schools.filter((s) => schoolMatches(s, filters)).map((s) => s.id)
  );

  if (metric === 'users' && !contentFiltered) {
    for (const schoolId of eligible) {
      const m = baseMetrics[schoolId];
      out[schoolId] = days ? sumDays(m?.days, days) : m?.users || 0;
    }
    return out;
  }

  // For content-filtered "users", report reach as one active school rather than
  // pretending that user counts are attributable to a specific activity.
  if (metric === 'users' && contentFiltered) {
    for (const row of activityMetrics) {
      if (!eligible.has(row.schoolId) || !activityMatches(row, filters)) continue;
      const engaged =
        (days
          ? sumDays(row.playsByDay, days) + sumDays(row.downloadsByDay, days)
          : (row.plays || 0) + (row.downloads || 0)) > 0;
      if (engaged) out[row.schoolId] = 1;
    }
    return out;
  }

  const key = metric as Extract<MetricKey, 'plays' | 'downloads'>;

  // Preserve historical aggregate totals for the all-time, unfiltered view.
  // Detailed activity tracking starts when the advanced heatmap is deployed.
  if (!days && !contentFiltered) {
    for (const schoolId of eligible) out[schoolId] = baseMetrics[schoolId]?.[key] || 0;
    return out;
  }

  for (const row of activityMetrics) {
    if (!eligible.has(row.schoolId) || !activityMatches(row, filters)) continue;
    out[row.schoolId] = (out[row.schoolId] || 0) + rowMetricValue(row, key, days);
  }
  return out;
}

export function buildDailyValues(args: {
  baseMetrics: Record<string, SchoolMetric>;
  activityMetrics: SchoolActivityMetric[];
  schools: QatarSchool[];
  filters: HeatmapFilters;
  metric: MetricKey;
  days: string[];
}): Record<string, Record<string, number>> {
  const { baseMetrics, activityMetrics, schools, filters, metric, days } = args;
  const out: Record<string, Record<string, number>> = {};
  const contentFiltered = hasContentFilter(filters);
  const eligible = new Set(
    schools.filter((s) => schoolMatches(s, filters)).map((s) => s.id)
  );

  for (const id of eligible) out[id] = {};

  if (metric === 'users' && !contentFiltered) {
    for (const id of eligible) {
      for (const day of days) out[id][day] = baseMetrics[id]?.days?.[day] || 0;
    }
    return out;
  }

  for (const row of activityMetrics) {
    if (!eligible.has(row.schoolId) || !activityMatches(row, filters)) continue;
    const target = (out[row.schoolId] ??= {});
    for (const day of days) {
      if (metric === 'users') {
        if ((row.playsByDay?.[day] || 0) + (row.downloadsByDay?.[day] || 0) > 0) {
          target[day] = 1;
        }
      } else if (metric === 'plays') {
        target[day] = (target[day] || 0) + (row.playsByDay?.[day] || 0);
      } else {
        target[day] = (target[day] || 0) + (row.downloadsByDay?.[day] || 0);
      }
    }
  }
  return out;
}

export function aggregateActivities(args: {
  rows: SchoolActivityMetric[];
  filters: HeatmapFilters;
  metric: Extract<MetricKey, 'plays' | 'downloads'>;
  days: string[] | null;
  schoolIds?: Set<string>;
}): ActivityAggregate[] {
  const { rows, filters, metric, days, schoolIds } = args;
  const map = new Map<string, ActivityAggregate>();
  for (const row of rows) {
    if (schoolIds && !schoolIds.has(row.schoolId)) continue;
    if (!activityMatches(row, filters)) continue;
    const value = rowMetricValue(row, metric, days);
    if (value <= 0) continue;
    const cur = map.get(row.activityId) ?? {
      activityId: row.activityId,
      value: 0,
      plays: 0,
      downloads: 0,
      lastActiveAt: 0,
    };
    cur.value += value;
    cur.plays += days ? sumDays(row.playsByDay, days) : row.plays || 0;
    cur.downloads += days ? sumDays(row.downloadsByDay, days) : row.downloads || 0;
    cur.lastActiveAt = Math.max(cur.lastActiveAt, row.lastActiveAt || 0);
    map.set(row.activityId, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.value - a.value || b.lastActiveAt - a.lastActiveAt
  );
}

function curriculumUnitTitle(
  subjects: Subject[],
  subjectId: string,
  gradeId: string,
  unitId: string
): string {
  const subject = subjects.find((s) => s.id === subjectId);
  const grade = subject?.grades.find((g) => g.id === gradeId);
  const unit = grade?.units.find((u) => u.id === unitId);
  return [subject?.title, grade?.title, unit?.title].filter(Boolean).join(' ← ') || unitId;
}

export function aggregateUnits(args: {
  rows: SchoolActivityMetric[];
  filters: HeatmapFilters;
  metric: Extract<MetricKey, 'plays' | 'downloads'>;
  days: string[] | null;
  subjects: Subject[];
  schoolIds?: Set<string>;
}): UnitAggregate[] {
  const { rows, filters, metric, days, subjects, schoolIds } = args;
  const map = new Map<string, UnitAggregate & { schools: Set<string> }>();
  for (const row of rows) {
    if (schoolIds && !schoolIds.has(row.schoolId)) continue;
    if (!activityMatches(row, filters)) continue;
    const value = rowMetricValue(row, metric, days);
    if (value <= 0) continue;
    const key = `${row.subjectId}::${row.gradeId}::${row.unitId}`;
    const cur = map.get(key) ?? {
      key,
      subjectId: row.subjectId,
      gradeId: row.gradeId,
      unitId: row.unitId,
      title: curriculumUnitTitle(subjects, row.subjectId, row.gradeId, row.unitId),
      value: 0,
      plays: 0,
      downloads: 0,
      activeSchools: 0,
      schools: new Set<string>(),
    };
    cur.value += value;
    cur.plays += days ? sumDays(row.playsByDay, days) : row.plays || 0;
    cur.downloads += days ? sumDays(row.downloadsByDay, days) : row.downloads || 0;
    cur.schools.add(row.schoolId);
    cur.activeSchools = cur.schools.size;
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ schools: _schools, ...v }) => v)
    .sort((a, b) => b.value - a.value || b.activeSchools - a.activeSchools);
}

export function activityTitle(
  activityId: string,
  activities: Activity[]
): string {
  return activities.find((a) => a.id === activityId)?.title || activityId;
}

export function latestActivityAt(
  rows: SchoolActivityMetric[],
  schoolIds?: Set<string>
): number {
  let latest = 0;
  for (const row of rows) {
    if (schoolIds && !schoolIds.has(row.schoolId)) continue;
    latest = Math.max(latest, row.lastActiveAt || 0);
  }
  return latest;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}
