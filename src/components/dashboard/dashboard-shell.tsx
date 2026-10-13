'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Activity as ActivityIcon,
  BarChart3,
  CalendarClock,
  ClipboardCopy,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  LayoutDashboard,
  Lock,
  MapPinned,
  Printer,
  RotateCcw,
  School,
  Sparkles,
  Table2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ACTIVITY_META, type ActivityType } from '@/lib/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import { formatFull, formatPercent } from '@/lib/utils';
import {
  activityValue,
  dailySeries,
  downloadText,
  firstTrackedDay,
  hasContentFilter,
  metricTotal,
  NO_FILTERS,
  peakDay,
  percentDelta,
  PERIOD_LABEL,
  periodWindow,
  rowMatches,
  shortDate,
  toCsv,
  type DashboardRow,
  type Filters,
  type Metric,
  type Period,
} from '@/lib/dashboard-metrics';
import { MUNICIPALITY_BY_ID, SCHOOL_BY_ID } from '@/data/qatar-schools';
import { UserHeatmap } from '@/components/user-heatmap';
import { HeritageIcon } from '@/components/heritage-icons';
import { ActivityTypeBadge } from '@/components/activity-type-badge';
import { KpiCard } from './kpi-card';
import { TrendChart } from './lazy-trend-chart';
import { ActivitiesTable } from './activities-table';
import { useDashboardData, useIsOwner } from './use-dashboard-data';

type TabKey = 'overview' | 'activities' | 'schools' | 'reports';
const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { key: 'activities', label: 'الأنشطة', icon: Table2 },
  { key: 'schools', label: 'المدارس والمناطق', icon: MapPinned },
  { key: 'reports', label: 'التقارير', icon: BarChart3 },
];
/**
 * التبويبات المتاحة للزوّار. البقيّة للمشرف وحده (بعد تسجيل الدخول من /admin).
 * لإتاحة تبويب للجميع أضِفه هنا.
 */
const PUBLIC_TABS: TabKey[] = ['overview'];

const PERIODS: Period[] = ['7d', '30d', '90d', 'all'];
const METRIC_META: Record<Metric, { label: string; unit: string; color: string }> = {
  views: { label: 'المشاهدات', unit: 'مشاهدة', color: 'var(--maroon)' },
  visitors: { label: 'الزوّار', unit: 'زائر', color: 'var(--teal)' },
  downloads: { label: 'التنزيلات', unit: 'تنزيل', color: 'var(--gold)' },
};

function readUrl(): { tab?: TabKey; period?: Period } {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const tab = p.get('tab') as TabKey | null;
  const period = p.get('period') as Period | null;
  return {
    tab: tab && TABS.some((t) => t.key === tab) ? tab : undefined,
    period: period && PERIODS.includes(period) ? period : undefined,
  };
}

function writeUrl(tab: TabKey, period: Period) {
  try {
    const url = new URL(window.location.href);
    if (tab === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    url.searchParams.set('period', period);
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* ignore */
  }
}

export function DashboardShell({ rows: serverRows }: { rows: DashboardRow[] }) {
  const { totals, daily, stats, schools, loaded } = useDashboardData();

  // أنشطة «وضع العرض» محفوظة في هذا المتصفّح وحده؛ مع Firestore لا نضمّها،
  // وإلا اختلف عدد الأنشطة من مستخدم لآخر.
  const [localRows, setLocalRows] = useState<DashboardRow[]>([]);
  useEffect(() => {
    if (isFirebaseConfigured) return;
    import('@/lib/local-store').then((mod) =>
      mod.listLocalActivities().then((acts) =>
        setLocalRows(
          acts.map((a) => ({
            id: a.id,
            title: a.title,
            type: a.type,
            subjectId: a.subjectId ?? '',
            subject: '',
            gradeId: a.gradeId ?? '',
            grade: '',
          }))
        )
      )
    );
  }, []);
  const rows = useMemo(() => {
    const ids = new Set(serverRows.map((r) => r.id));
    return [...serverRows, ...localRows.filter((r) => !ids.has(r.id))];
  }, [serverRows, localRows]);
  const owner = useIsOwner();

  const [tab, setTab] = useState<TabKey>('overview');
  const [period, setPeriodState] = useState<Period>('all');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [trendMetric, setTrendMetric] = useState<Metric>('views');
  const periodChosen = useRef(false);

  // الحالة الأولى من الرابط (قابلة للمشاركة)
  useEffect(() => {
    const u = readUrl();
    if (u.tab) setTab(u.tab);
    if (u.period) {
      setPeriodState(u.period);
      periodChosen.current = true;
    }
  }, []);

  const firstDay = useMemo(() => firstTrackedDay(daily), [daily]);

  // الافتراضي: آخر 30 يومًا متى توفّر توزيع يومي، وإلا «كل الفترة»
  useEffect(() => {
    if (!loaded || periodChosen.current) return;
    if (firstDay) setPeriodState('30d');
  }, [loaded, firstDay]);

  useEffect(() => {
    writeUrl(tab, period);
  }, [tab, period]);

  const setPeriod = useCallback((p: Period) => {
    periodChosen.current = true;
    setPeriodState(p);
  }, []);

  // --- خيارات الفلاتر (تظهر فقط حين يوجد أكثر من خيار) ---------------------
  const options = useMemo(() => {
    const subj = new Map<string, string>();
    const grade = new Map<string, string>();
    const types = new Set<ActivityType>();
    for (const r of rows) {
      if (r.subjectId) subj.set(r.subjectId, r.subject || r.subjectId);
      if (r.gradeId && (filters.subjectId === 'all' || r.subjectId === filters.subjectId))
        grade.set(r.gradeId, r.grade || r.gradeId);
      types.add(r.type);
    }
    return { subj: [...subj], grade: [...grade], types: [...types] };
  }, [rows, filters.subjectId]);

  // --- الحسابات ---------------------------------------------------------------
  const win = useMemo(() => periodWindow(period), [period]);
  const filteredRows = useMemo(() => rows.filter((r) => rowMatches(r, filters)), [rows, filters]);
  const contentFiltered = hasContentFilter(filters);

  const base = { site: daily, stats, rows, filters, totals };
  const kpi = (metric: Metric) => {
    const value = metricTotal({ ...base, metric, period, days: win.current });
    const prev = win.previous
      ? metricTotal({ ...base, metric, period, days: win.previous })
      : 0;
    const sparkDays = win.current.slice(-Math.min(win.current.length, 30));
    return {
      value,
      delta: win.previous ? percentDelta(value, prev) : null,
      series: dailySeries({ ...base, metric, days: sparkDays }),
    };
  };
  const kVisitors = kpi('visitors');
  const kViews = kpi('views');
  const kDownloads = kpi('downloads');

  const perActivity = useMemo(
    () =>
      filteredRows.map((r) => ({
        ...r,
        views: activityValue(stats[r.id], 'views', period, win.current),
        downloads: activityValue(stats[r.id], 'downloads', period, win.current),
        prevViews: win.previous ? activityValue(stats[r.id], 'views', period, win.previous) : 0,
      })),
    [filteredRows, stats, period, win]
  );
  const activeCount = perActivity.filter((r) => r.views > 0 || r.downloads > 0).length;

  const trendValues = useMemo(
    () => dailySeries({ ...base, metric: trendMetric, days: win.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [daily, stats, rows, filters, trendMetric, win]
  );

  const locked = (t: TabKey) => !PUBLIC_TABS.includes(t) && owner !== true;
  const canSee = (t: TabKey) => !locked(t);
  const goTab = (t: TabKey) => {
    setTab(t);
    if (typeof window !== 'undefined') {
      document.getElementById('dash-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const showDailyNote = period !== 'all' && loaded && (!firstDay || firstDay > win.current[0]);

  return (
    <div className="space-y-5">
      {/* ---------------- شريط الفلاتر ---------------- */}
      <div className="dash-toolbar" role="group" aria-label="فلاتر اللوحة">
        <div className="seg-group" role="radiogroup" aria-label="الفترة الزمنية">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={'seg-btn ' + (period === p ? 'is-on' : '')}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {options.subj.length > 1 && (
            <FilterSelect
              label="المادة"
              value={filters.subjectId}
              onChange={(v) => setFilters((f) => ({ ...f, subjectId: v, gradeId: 'all' }))}
              options={options.subj}
            />
          )}
          {options.grade.length > 1 && (
            <FilterSelect
              label="الصف"
              value={filters.gradeId}
              onChange={(v) => setFilters((f) => ({ ...f, gradeId: v }))}
              options={options.grade}
            />
          )}
          {options.types.length > 1 && (
            <FilterSelect
              label="نوع النشاط"
              value={filters.type}
              onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
              options={options.types.map((t) => [t, ACTIVITY_META[t].label] as [string, string])}
            />
          )}
          {contentFiltered && (
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="btn-ghost min-h-[38px] px-3 py-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> إلغاء الفلاتر
            </button>
          )}
        </div>
      </div>

      {showDailyNote && (
        <p className="dash-note">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          {firstDay
            ? `التوزيع اليومي يُسجَّل منذ ${shortDate(firstDay)}، فالمقارنة بالفترة السابقة تكتمل بمرور الوقت. الإجمالي التراكمي كاملًا في «كل الفترة».`
            : 'لم يُسجَّل توزيع يومي بعد؛ تظهر الاتجاهات تلقائيًا مع أوّل زيارة بعد التحديث. الإجمالي التراكمي في «كل الفترة».'}
        </p>
      )}

      {/* ---------------- التبويبات ---------------- */}
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)} dir="rtl" id="dash-tabs">
        <Tabs.List className="dash-tabs" aria-label="أقسام لوحة الإحصاءات">
          {TABS.map(({ key, label, icon: Icon }) => (
            <Tabs.Trigger key={key} value={key} className="dash-tab">
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              {locked(key) && owner === false && (
                <Lock className="h-3 w-3 opacity-60" aria-label="للمشرف" />
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ===== نظرة عامة ===== */}
        <Tabs.Content value="overview" className="dash-panel">
          <div className="kpi-grid">
            <KpiCard
              icon={Users}
              label="الزوّار"
              value={kVisitors.value}
              delta={kVisitors.delta}
              hasPrevious={!!win.previous}
              series={period === 'all' ? undefined : kVisitors.series}
              tone="#2b6b62"
              note={contentFiltered ? 'على مستوى الموقع (لا يُنسب لنشاط)' : undefined}
            />
            <KpiCard
              icon={Eye}
              label="المشاهدات"
              value={kViews.value}
              delta={kViews.delta}
              hasPrevious={!!win.previous}
              series={period === 'all' ? undefined : kViews.series}
              tone="#2d5f7c"
            />
            <KpiCard
              icon={Download}
              label="التنزيلات"
              value={kDownloads.value}
              delta={kDownloads.delta}
              hasPrevious={!!win.previous}
              series={period === 'all' ? undefined : kDownloads.series}
              tone="#b0862a"
            />
            <KpiCard
              icon={Sparkles}
              label="الأنشطة"
              value={filteredRows.length}
              delta={null}
              hasPrevious={false}
              tone="#8a1538"
              note={
                loaded
                  ? `${formatFull(activeCount)} منها استُخدم ${period === 'all' ? 'حتى الآن' : 'في الفترة'}`
                  : undefined
              }
            />
          </div>

          {rows.length === 0 ? (
            <EmptyLibrary />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {/* الاتجاه */}
                <figure className="panel min-w-0 p-4 sm:p-6 lg:col-span-2">
                  <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="panel-title flex items-center gap-2">
                      <ActivityIcon className="h-5 w-5 text-[color:var(--gold)]" aria-hidden />
                      {METRIC_META[trendMetric].label} يوميًا
                    </h2>
                    <div className="seg-group" role="radiogroup" aria-label="المقياس">
                      {(['views', 'visitors', 'downloads'] as Metric[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={trendMetric === m}
                          onClick={() => setTrendMetric(m)}
                          className={'seg-btn ' + (trendMetric === m ? 'is-on' : '')}
                        >
                          {METRIC_META[m].label}
                        </button>
                      ))}
                    </div>
                  </figcaption>
                  {trendValues.some((v) => v > 0) ? (
                    <>
                      <TrendChart
                        days={win.current}
                        values={trendValues}
                        unit={METRIC_META[trendMetric].unit}
                        color={METRIC_META[trendMetric].color}
                      />
                      <TrendFacts days={win.current} values={trendValues} unit={METRIC_META[trendMetric].unit} />
                    </>
                  ) : (
                    <EmptyBlock
                      text={
                        loaded
                          ? 'لا توجد بيانات يومية في هذه الفترة بعد. يبدأ المخطّط بالامتلاء مع أوّل زيارة.'
                          : 'يجري التحميل…'
                      }
                      tall
                    />
                  )}
                </figure>

                {/* أنواع الأنشطة */}
                <TypeBreakdown rows={perActivity} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <TopActivities
                  rows={perActivity}
                  loaded={loaded}
                  onMore={canSee('activities') ? () => goTab('activities') : undefined}
                />
                <TopSchools
                  schools={schools}
                  loaded={loaded}
                  onMore={canSee('schools') ? () => goTab('schools') : undefined}
                />
                <Insights
                  rows={perActivity}
                  period={period}
                  loaded={loaded}
                  onMore={canSee('reports') ? () => goTab('reports') : undefined}
                />
              </div>
            </>
          )}
        </Tabs.Content>

        {/* ===== الأنشطة ===== */}
        <Tabs.Content value="activities" className="dash-panel">
          {locked('activities') ? (
            <LockedPanel checking={owner === null} />
          ) : (
            <ActivitiesTable rows={filteredRows} stats={stats} period={period} days={win.current} />
          )}
        </Tabs.Content>

        {/* ===== المدارس ===== */}
        <Tabs.Content value="schools" className="dash-panel">
          {locked('schools') ? (
            <LockedPanel checking={owner === null} />
          ) : (
            <>
              <SchoolsRanking schools={schools} loaded={loaded} />
              <UserHeatmap />
            </>
          )}
        </Tabs.Content>

        {/* ===== التقارير ===== */}
        <Tabs.Content value="reports" className="dash-panel">
          {locked('reports') ? (
            <LockedPanel checking={owner === null} />
          ) : (
            <Reports
              rows={perActivity}
              period={period}
              days={win.current}
              kpis={{ visitors: kVisitors, views: kViews, downloads: kDownloads }}
              trend={{
                views: dailySeries({ ...base, metric: 'views', days: win.current }),
                visitors: dailySeries({ ...base, metric: 'visitors', days: win.current }),
                downloads: dailySeries({ ...base, metric: 'downloads', days: win.current }),
              }}
              hasPrevious={!!win.previous}
            />
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

// ---------------------------------------------------------------------------
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="dash-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="all">{label}: الكل</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyBlock({ text, tall = false }: { text: string; tall?: boolean }) {
  return (
    <p
      className={
        'flex items-center justify-center rounded-xl border border-dashed border-[color:var(--hairline-strong)] px-4 text-center text-sm text-muted-foreground ' +
        (tall ? 'min-h-[240px]' : 'py-6')
      }
    >
      {text}
    </p>
  );
}

function EmptyLibrary() {
  return (
    <div className="explorer-empty">
      <HeritageIcon kind="chart" className="mx-auto" />
      <h2 className="mt-3 font-calli text-2xl text-foreground">لا توجد بيانات بعد</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        ستظهر الإحصاءات هنا تلقائيًا بمجرّد رفع الأنشطة وبدء الزوّار بتجربتها.
      </p>
    </div>
  );
}

function CardHead({
  icon: Icon,
  title,
  onMore,
  moreLabel = 'عرض الكل',
}: {
  icon: typeof Users;
  title: string;
  onMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <figcaption className="mb-4 flex items-center justify-between gap-2">
      <h2 className="panel-title flex items-center gap-2 !text-lg">
        <Icon className="h-5 w-5 text-[color:var(--gold)]" aria-hidden />
        {title}
      </h2>
      {onMore && (
        <button type="button" onClick={onMore} className="dash-more">
          {moreLabel} ←
        </button>
      )}
    </figcaption>
  );
}

function TrendFacts({ days, values, unit }: { days: string[]; values: number[]; unit: string }) {
  const total = values.reduce((a, b) => a + b, 0);
  const peak = peakDay(days, values);
  const avg = total / Math.max(1, values.length);
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[color:var(--hairline)] pt-3 text-center">
      <div>
        <dt className="text-[11px] font-semibold text-muted-foreground">المجموع</dt>
        <dd className="font-bold tabular-nums text-foreground">{formatFull(total)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold text-muted-foreground">المتوسّط اليومي</dt>
        <dd className="font-bold tabular-nums text-foreground">
          {avg >= 10 ? formatFull(Math.round(avg)) : avg.toFixed(1)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold text-muted-foreground">يوم الذروة</dt>
        <dd className="font-bold text-foreground">
          {peak ? (
            <>
              {shortDate(peak.day)}{' '}
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                ({formatFull(peak.value)} {unit})
              </span>
            </>
          ) : (
            '—'
          )}
        </dd>
      </div>
    </dl>
  );
}

type PerActivity = DashboardRow & { views: number; downloads: number; prevViews: number };

function TypeBreakdown({ rows }: { rows: PerActivity[] }) {
  const types = (Object.keys(ACTIVITY_META) as ActivityType[])
    .map((t) => {
      const list = rows.filter((r) => r.type === t);
      return {
        type: t,
        count: list.length,
        views: list.reduce((n, r) => n + r.views, 0),
      };
    })
    .filter((t) => t.count > 0);
  const totalViews = types.reduce((n, t) => n + t.views, 0);
  const totalCount = types.reduce((n, t) => n + t.count, 0);
  const byViews = totalViews > 0;
  const whole = byViews ? totalViews : totalCount;

  return (
    <figure className="panel min-w-0 p-4 sm:p-6">
      <CardHead icon={BarChart3} title="أنواع الأنشطة" />
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {byViews ? 'حصّة كل نوع من المشاهدات' : 'حصّة كل نوع من المكتبة'}
      </p>
      <div className="type-bar" role="img" aria-label="توزيع الأنواع — التفاصيل في القائمة أدناه">
        {types.map((t) => {
          const v = byViews ? t.views : t.count;
          if (!v) return null;
          return (
            <span
              key={t.type}
              style={{ flexGrow: v, background: ACTIVITY_META[t.type].color }}
              title={`${ACTIVITY_META[t.type].label}: ${formatPercent(v, whole)}`}
            />
          );
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {types.map((t) => (
          <li key={t.type} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-bold text-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: ACTIVITY_META[t.type].color }}
                aria-hidden
              />
              <span className="truncate">{ACTIVITY_META[t.type].label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground tabular-nums">
              {formatFull(t.count)} نشاط · {formatFull(t.views)} مشاهدة
              <span className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-bold text-foreground">
                {formatPercent(byViews ? t.views : t.count, whole)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function TopActivities({
  rows,
  loaded,
  onMore,
}: {
  rows: PerActivity[];
  loaded: boolean;
  onMore?: () => void;
}) {
  const top = [...rows].filter((r) => r.views > 0).sort((a, b) => b.views - a.views).slice(0, 5);
  const max = Math.max(1, ...top.map((r) => r.views));
  return (
    <figure className="panel min-w-0 p-4 sm:p-6">
      <CardHead icon={TrendingUp} title="الأكثر مشاهدة" onMore={onMore} />
      {top.length === 0 ? (
        <EmptyBlock text={loaded ? 'لا مشاهدات في هذه الفترة بعد.' : 'يجري التحميل…'} />
      ) : (
        <ol className="space-y-3">
          {top.map((r, i) => (
            <li key={r.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <Link
                  href={`/play/${r.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 font-bold text-foreground hover:text-[color:var(--maroon)]"
                >
                  <span className="w-4 shrink-0 text-center text-xs text-[color:var(--gold)] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate">{r.title}</span>
                </Link>
                <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                  {formatFull(r.views)}
                </span>
              </div>
              <div className="bar-track !h-1.5">
                <div className="h-full" style={{ width: `${(r.views / max) * 100}%`, background: 'var(--maroon)' }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

function rankSchools(schools: Record<string, { users: number; plays: number; downloads: number }>) {
  return Object.entries(schools)
    .map(([id, m]) => ({ id, ...m, school: SCHOOL_BY_ID[id] }))
    .filter((s) => s.users + s.plays + s.downloads > 0)
    .sort((a, b) => b.plays - a.plays || b.users - a.users);
}

function TopSchools({
  schools,
  loaded,
  onMore,
}: {
  schools: Record<string, { users: number; plays: number; downloads: number }>;
  loaded: boolean;
  onMore?: () => void;
}) {
  const top = rankSchools(schools).slice(0, 5);
  return (
    <figure className="panel min-w-0 p-4 sm:p-6">
      <CardHead icon={School} title="أنشط المدارس" onMore={onMore} />
      {top.length === 0 ? (
        <EmptyBlock
          text={loaded ? 'لم يختر أي مستخدم مدرسته بعد.' : 'يجري التحميل…'}
        />
      ) : (
        <ol className="space-y-2.5">
          {top.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-center text-xs text-[color:var(--gold)] tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-foreground">
                    {s.school?.name ?? 'مدرسة غير معروفة'}
                  </span>
                  {s.school && (
                    <span className="block text-[11px] text-muted-foreground">
                      {MUNICIPALITY_BY_ID[s.school.municipalityId]?.name}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {formatFull(s.plays)} لعبة
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">منذ البداية · لا تُعرض أي بيانات شخصية</p>
    </figure>
  );
}

function Insights({
  rows,
  period,
  loaded,
  onMore,
}: {
  rows: PerActivity[];
  period: Period;
  loaded: boolean;
  onMore?: () => void;
}) {
  const unused = rows.filter((r) => r.views === 0).length;
  const growing = period === 'all'
    ? null
    : [...rows]
        .filter((r) => r.views > r.prevViews && r.views > 0)
        .sort((a, b) => b.views - b.prevViews - (a.views - a.prevViews))[0];
  const usedShare = rows.length ? formatPercent(rows.length - unused, rows.length) : '0%';
  return (
    <figure className="panel min-w-0 p-4 sm:p-6">
      <CardHead icon={CalendarClock} title="مؤشّرات سريعة" onMore={onMore} moreLabel="التقارير" />
      {!loaded ? (
        <EmptyBlock text="يجري التحميل…" />
      ) : (
        <ul className="space-y-3 text-sm">
          <li className="insight">
            <span className="insight-k">نسبة الأنشطة المستخدمة</span>
            <span className="insight-v tabular-nums">{usedShare}</span>
          </li>
          <li className="insight">
            <span className="insight-k">أنشطة بلا مشاهدات {period === 'all' ? '' : 'في الفترة'}</span>
            <span className="insight-v tabular-nums">{formatFull(unused)}</span>
          </li>
          <li className="insight">
            <span className="insight-k">الأسرع نموًّا</span>
            <span className="insight-v truncate text-left">
              {period === 'all' ? 'اختر فترة زمنية' : growing ? growing.title : '—'}
            </span>
          </li>
        </ul>
      )}
    </figure>
  );
}

function SchoolsRanking({
  schools,
  loaded,
}: {
  schools: Record<string, { users: number; plays: number; downloads: number }>;
  loaded: boolean;
}) {
  const [all, setAll] = useState(false);
  const ranked = rankSchools(schools);
  const shown = all ? ranked : ranked.slice(0, 10);
  return (
    <div className="panel mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--hairline)] p-4">
        <h2 className="panel-title flex items-center gap-2 !text-lg">
          <School className="h-5 w-5 text-[color:var(--gold)]" aria-hidden /> ترتيب المدارس
        </h2>
        {ranked.length > 0 && (
          <button
            type="button"
            className="btn-ghost min-h-[38px] px-3 py-1 text-xs"
            onClick={() =>
              downloadText(
                'المدارس.csv',
                toCsv(
                  ['المدرسة', 'البلدية', 'المستخدمون', 'مرّات اللعب', 'التنزيلات'],
                  ranked.map((s) => [
                    s.school?.name ?? s.id,
                    s.school ? MUNICIPALITY_BY_ID[s.school.municipalityId]?.name ?? '' : '',
                    s.users,
                    s.plays,
                    s.downloads,
                  ])
                )
              )
            }
          >
            <FileSpreadsheet className="h-4 w-4" /> تصدير CSV
          </button>
        )}
      </div>
      {ranked.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {loaded ? 'لا توجد بيانات مدارس بعد.' : 'يجري التحميل…'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <caption className="sr-only">المدارس مرتّبة بعدد مرّات اللعب منذ البداية</caption>
              <thead>
                <tr className="border-b border-[color:var(--hairline)] bg-[color:var(--plaster)]">
                  <th scope="col" className="px-4 py-2.5 font-bold">#</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">المدرسة</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">المستخدمون</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">اللعب</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-bold sm:table-cell">التنزيلات</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id} className="border-b border-[color:var(--hairline)]">
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-foreground">{s.school?.name ?? s.id}</span>
                      {s.school && (
                        <span className="block text-[11px] text-muted-foreground">
                          {MUNICIPALITY_BY_ID[s.school.municipalityId]?.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{formatFull(s.users)}</td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{formatFull(s.plays)}</td>
                    <td className="hidden px-4 py-2.5 font-semibold tabular-nums sm:table-cell">
                      {formatFull(s.downloads)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ranked.length > 10 && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="w-full border-t border-[color:var(--hairline)] p-3 text-sm font-bold text-[color:var(--maroon)]"
            >
              {all ? 'عرض أعلى 10 فقط' : `عرض كل المدارس (${formatFull(ranked.length)})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Reports({
  rows,
  period,
  days,
  kpis,
  trend,
  hasPrevious,
}: {
  rows: PerActivity[];
  period: Period;
  days: string[];
  kpis: Record<'visitors' | 'views' | 'downloads', { value: number; delta: number | null }>;
  trend: Record<Metric, number[]>;
  hasPrevious: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const unused = rows.filter((r) => r.views === 0);
  const top = [...rows].sort((a, b) => b.views - a.views).filter((r) => r.views > 0).slice(0, 3);
  const declining = hasPrevious
    ? [...rows]
        .filter((r) => r.prevViews > 0 && r.views < r.prevViews)
        .sort((a, b) => a.views - a.prevViews - (b.views - b.prevViews))
        .slice(0, 5)
    : [];

  const deltaText = (d: number | null) =>
    !hasPrevious || d === null ? '' : ` (${d >= 0 ? '+' : ''}${Math.round(d)}% عن الفترة السابقة)`;

  const summary = [
    `ملخّص لوحة الإحصاءات — ${PERIOD_LABEL[period]}${
      period === 'all' ? '' : ` (${shortDate(days[0])} – ${shortDate(days[days.length - 1])})`
    }`,
    `• الزوّار: ${formatFull(kpis.visitors.value)}${deltaText(kpis.visitors.delta)}`,
    `• المشاهدات: ${formatFull(kpis.views.value)}${deltaText(kpis.views.delta)}`,
    `• التنزيلات: ${formatFull(kpis.downloads.value)}${deltaText(kpis.downloads.delta)}`,
    `• الأنشطة المستخدمة: ${formatFull(rows.length - unused.length)} من ${formatFull(rows.length)}`,
    top.length ? `• الأكثر مشاهدة: ${top.map((r) => `${r.title} (${formatFull(r.views)})`).join('، ')}` : '',
    unused.length ? `• أنشطة تحتاج ترويجًا (بلا مشاهدات): ${formatFull(unused.length)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const exportDaily = () =>
    downloadText(
      `التوزيع-اليومي-${days[days.length - 1]}.csv`,
      toCsv(
        ['اليوم', 'الزوّار', 'المشاهدات', 'التنزيلات'],
        days.map((d, i) => [d, trend.visitors[i] || 0, trend.views[i] || 0, trend.downloads[i] || 0])
      )
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-4 sm:p-6 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="panel-title !text-lg">ملخّص الفترة</h2>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={copy} className="btn-ghost min-h-[38px] px-3 py-1 text-xs">
              <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? 'نُسخ ✓' : 'نسخ الملخّص'}
            </button>
            <button type="button" onClick={() => window.print()} className="btn-ghost min-h-[38px] px-3 py-1 text-xs">
              <Printer className="h-3.5 w-3.5" /> طباعة
            </button>
            <button type="button" onClick={exportDaily} className="btn-ghost min-h-[38px] px-3 py-1 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" /> التوزيع اليومي CSV
            </button>
          </div>
        </div>
        <pre className="report-text">{summary}</pre>
        <p className="mt-2 text-[11px] text-muted-foreground">
          انسخ الملخّص وأرسله للإدارة أو المعلّمين أسبوعيًا. الإرسال التلقائي بالبريد يحتاج خدمة خادم
          غير مفعّلة في هذا النشر.
        </p>
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="panel-title mb-3 flex items-center gap-2 !text-lg">
          <TrendingDown className="h-5 w-5 text-[color:var(--maroon)]" aria-hidden />
          تراجع الإقبال
        </h2>
        {!hasPrevious ? (
          <EmptyBlock text="اختر فترة زمنية للمقارنة بالفترة السابقة." />
        ) : declining.length === 0 ? (
          <EmptyBlock text="لا أنشطة تراجعت مشاهداتها مقارنةً بالفترة السابقة." />
        ) : (
          <ul className="space-y-2 text-sm">
            {declining.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <Link href={`/play/${r.id}`} className="min-w-0 truncate font-bold hover:text-[color:var(--maroon)]">
                  {r.title}
                </Link>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground" dir="ltr">
                  {formatFull(r.prevViews)} → {formatFull(r.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="panel-title mb-3 flex items-center gap-2 !text-lg">
          <Info className="h-5 w-5 text-[color:var(--gold)]" aria-hidden />
          أنشطة بلا مشاهدات {period === 'all' ? '' : 'في الفترة'}
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            ({formatFull(unused.length)})
          </span>
        </h2>
        {unused.length === 0 ? (
          <EmptyBlock text="كل الأنشطة شوهدت مرّة واحدة على الأقل. 👏" />
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pl-1 text-sm">
            {unused.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <Link href={`/play/${r.id}`} className="min-w-0 truncate font-bold hover:text-[color:var(--maroon)]">
                  {r.title}
                </Link>
                <ActivityTypeBadge type={r.type} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LockedPanel({ checking }: { checking: boolean }) {
  return (
    <div className="explorer-empty">
      <Lock className="mx-auto h-10 w-10 text-[color:var(--gold)]" aria-hidden />
      <h2 className="mt-3 font-display text-xl font-bold text-foreground">
        {checking ? 'يجري التحقّق من الصلاحية…' : 'هذا القسم للمشرف'}
      </h2>
      {!checking && (
        <>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            التفاصيل الكاملة للأنشطة والمدارس والتقارير متاحة بعد تسجيل الدخول بحساب المشرف.
            النظرة العامة متاحة للجميع.
          </p>
          <Link href="/admin" className="btn-primary mt-4 inline-flex px-4 py-2 text-sm">
            تسجيل دخول المشرف
          </Link>
        </>
      )}
    </div>
  );
}
