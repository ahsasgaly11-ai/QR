// ---------------------------------------------------------------------------
//  حسابات لوحة الإحصاءات — دوال خالصة بلا واجهة ولا شبكة، لتُختبر بسهولة.
//
//  مصدر البيانات:
//   • الإجمالي التراكمي: stats/site و activityStats/{id}.views/downloads
//   • التوزيع اليومي:    siteDaily/{day} و activityStats/{id}.viewsByDay …
//  التوزيع اليومي يبدأ من يوم تفعيله، لذا «كل الفترة» تُحسب من الإجمالي
//  التراكمي دائمًا، والفترات الزمنية من التوزيع اليومي.
// ---------------------------------------------------------------------------

import { localDateKey } from '@/lib/heatmap-analytics';
import type { ActivityStats, ActivityType } from '@/lib/types';

export type Period = '7d' | '30d' | '90d' | 'all';
export type Metric = 'visitors' | 'views' | 'downloads';
export type SiteTotals = Record<Metric, number>;
export type DailySite = Record<string, SiteTotals>;

export const PERIOD_LABEL: Record<Period, string> = {
  '7d': 'آخر 7 أيام',
  '30d': 'آخر 30 يومًا',
  '90d': 'آخر 90 يومًا',
  all: 'كل الفترة',
};

export const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** عدد الأيام التي يُعرض فيها المخطّط في «كل الفترة». */
export const ALL_CHART_DAYS = 90;

/** أقدم يوم تحتاجه اللوحة: فترة 90 يومًا + الفترة السابقة لها. */
export const MAX_LOOKBACK_DAYS = 180;

export interface DashboardRow {
  id: string;
  title: string;
  type: ActivityType;
  subjectId: string;
  subject: string;
  gradeId: string;
  grade: string;
}

export interface Filters {
  subjectId: string; // 'all' أو معرّف
  gradeId: string;
  type: string;
}

export const NO_FILTERS: Filters = { subjectId: 'all', gradeId: 'all', type: 'all' };

export function hasContentFilter(f: Filters): boolean {
  return f.subjectId !== 'all' || f.gradeId !== 'all' || f.type !== 'all';
}

export function rowMatches(r: DashboardRow, f: Filters): boolean {
  return (
    (f.subjectId === 'all' || r.subjectId === f.subjectId) &&
    (f.gradeId === 'all' || r.gradeId === f.gradeId) &&
    (f.type === 'all' || r.type === f.type)
  );
}

/** أيام متتالية تصاعديًا تنتهي اليوم (بالتوقيت المحلي). */
export function lastDays(n: number, now = new Date()): string[] {
  const out: string[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(localDateKey(d));
  }
  return out;
}

export interface PeriodWindow {
  /** أيام الفترة الحالية (أو آخر 90 يومًا للمخطّط في «كل الفترة»). */
  current: string[];
  /** أيام الفترة السابقة المماثلة — null في «كل الفترة». */
  previous: string[] | null;
}

export function periodWindow(p: Period, now = new Date()): PeriodWindow {
  if (p === 'all') return { current: lastDays(ALL_CHART_DAYS, now), previous: null };
  const n = PERIOD_DAYS[p];
  const both = lastDays(n * 2, now);
  return { current: both.slice(n), previous: both.slice(0, n) };
}

export function sumMap(m: Record<string, number> | undefined, days: string[]): number {
  if (!m) return 0;
  let s = 0;
  for (const d of days) s += m[d] || 0;
  return s;
}

function activityDayMap(s: ActivityStats | undefined, metric: 'views' | 'downloads') {
  return metric === 'views' ? s?.viewsByDay : s?.downloadsByDay;
}

/** قيمة نشاط واحد في الفترة (أو إجماليه التراكمي في «كل الفترة»). */
export function activityValue(
  s: ActivityStats | undefined,
  metric: 'views' | 'downloads',
  p: Period,
  days: string[]
): number {
  if (!s) return 0;
  if (p === 'all') return s[metric] || 0;
  return sumMap(activityDayMap(s, metric), days);
}

/**
 * السلسلة اليومية لمقياس ما. بلا فلتر محتوى تُقرأ من siteDaily (تشمل الزوّار)،
 * ومع فلتر محتوى تُجمع من التوزيع اليومي للأنشطة المطابقة.
 * الزوّار لا يُنسبون لنشاط، فمع فلتر المحتوى تبقى سلسلتهم على مستوى الموقع.
 */
export function dailySeries(args: {
  metric: Metric;
  days: string[];
  site: DailySite;
  stats: Record<string, ActivityStats>;
  rows: DashboardRow[];
  filters: Filters;
}): number[] {
  const { metric, days, site, stats, rows, filters } = args;
  if (metric === 'visitors' || !hasContentFilter(filters)) {
    return days.map((d) => site[d]?.[metric] || 0);
  }
  const matched = rows.filter((r) => rowMatches(r, filters));
  return days.map((d) => {
    let s = 0;
    for (const r of matched) s += activityDayMap(stats[r.id], metric)?.[d] || 0;
    return s;
  });
}

/** القيمة الإجمالية لمقياس في الفترة، مع مراعاة الفلاتر. */
export function metricTotal(args: {
  metric: Metric;
  period: Period;
  days: string[];
  totals: SiteTotals;
  site: DailySite;
  stats: Record<string, ActivityStats>;
  rows: DashboardRow[];
  filters: Filters;
}): number {
  const { metric, period, totals, stats, rows, filters } = args;
  if (period === 'all') {
    if (metric === 'visitors' || !hasContentFilter(filters)) return totals[metric] || 0;
    return rows
      .filter((r) => rowMatches(r, filters))
      .reduce((n, r) => n + (stats[r.id]?.[metric] || 0), 0);
  }
  return dailySeries(args).reduce((a, b) => a + b, 0);
}

/** نسبة التغيّر؛ null حين لا توجد قاعدة للمقارنة (الفترة السابقة صفر). */
export function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** أوّل يوم سُجّل فيه توزيع يومي (أو null إن لم يبدأ بعد). */
export function firstTrackedDay(site: DailySite): string | null {
  const keys = Object.keys(site).filter((k) => {
    const v = site[k];
    return v && v.visitors + v.views + v.downloads > 0;
  });
  if (!keys.length) return null;
  keys.sort();
  return keys[0];
}

/** يوم الذروة في سلسلة ما. */
export function peakDay(days: string[], values: number[]): { day: string; value: number } | null {
  let best = -1;
  let idx = -1;
  values.forEach((v, i) => {
    if (v > best) {
      best = v;
      idx = i;
    }
  });
  if (idx < 0 || best <= 0) return null;
  return { day: days[idx], value: best };
}

// --- CSV ---------------------------------------------------------------------
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV بعلامة BOM ليفتحه Excel بالعربية صحيحًا. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** تاريخ قصير بالعربية: «13 أكتوبر». */
export function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  // أرقام لاتينية كبقيّة الواجهة (انظر formatFull).
  return new Date(y, m - 1, d).toLocaleDateString('ar-QA-u-nu-latn', {
    day: 'numeric',
    month: 'short',
  });
}
