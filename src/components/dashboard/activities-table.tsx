'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Play,
  Search,
  X,
} from 'lucide-react';
import { ActivityTypeBadge } from '@/components/activity-type-badge';
import { formatFull, normalizeAr } from '@/lib/utils';
import {
  activityValue,
  downloadText,
  lastDays,
  sumMap,
  toCsv,
  type DashboardRow,
  type Period,
  PERIOD_LABEL,
} from '@/lib/dashboard-metrics';
import { ACTIVITY_META, type ActivityStats } from '@/lib/types';
import { Sparkline } from './kpi-card';
import { TrendChart } from './lazy-trend-chart';

type SortKey = 'title' | 'type' | 'views' | 'downloads';
type SortDir = 'asc' | 'desc';
const PAGE = 10;

interface TableRow extends DashboardRow {
  views: number;
  downloads: number;
  totalViews: number;
  totalDownloads: number;
  spark: number[];
}

export function ActivitiesTable({
  rows,
  stats,
  period,
  days,
}: {
  rows: DashboardRow[];
  stats: Record<string, ActivityStats>;
  period: Period;
  days: string[];
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'views', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const sparkDays = useMemo(() => lastDays(14), []);

  const all: TableRow[] = useMemo(
    () =>
      rows.map((r) => {
        const s = stats[r.id];
        return {
          ...r,
          views: activityValue(s, 'views', period, days),
          downloads: activityValue(s, 'downloads', period, days),
          totalViews: s?.views || 0,
          totalDownloads: s?.downloads || 0,
          spark: sparkDays.map((d) => s?.viewsByDay?.[d] || 0),
        };
      }),
    [rows, stats, period, days, sparkDays]
  );

  const filtered = useMemo(() => {
    const nq = normalizeAr(q);
    const list = nq
      ? all.filter((r) => normalizeAr(`${r.title} ${r.subject} ${r.grade}`).includes(nq))
      : all;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let c = 0;
      if (sort.key === 'title') c = a.title.localeCompare(b.title, 'ar');
      else if (sort.key === 'type')
        c = ACTIVITY_META[a.type].label.localeCompare(ACTIVITY_META[b.type].label, 'ar');
      else c = a[sort.key] - b[sort.key];
      return c * dir || a.title.localeCompare(b.title, 'ar');
    });
  }, [all, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * PAGE, cur * PAGE + PAGE);
  const open = openId ? all.find((r) => r.id === openId) ?? null : null;

  const toggleSort = (key: SortKey) => {
    setPage(0);
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'title' || key === 'type' ? 'asc' : 'desc' }
    );
  };

  const exportCsv = () => {
    const csv = toCsv(
      [
        'النشاط',
        'النوع',
        'المادة',
        'الصف',
        `المشاهدات (${PERIOD_LABEL[period]})`,
        `التنزيلات (${PERIOD_LABEL[period]})`,
        'إجمالي المشاهدات',
        'إجمالي التنزيلات',
        'الرابط',
      ],
      filtered.map((r) => [
        r.title,
        ACTIVITY_META[r.type].label,
        r.subject,
        r.grade,
        r.views,
        r.downloads,
        r.totalViews,
        r.totalDownloads,
        `${location.origin}/play/${r.id}`,
      ])
    );
    downloadText(`الأنشطة-${days[days.length - 1] ?? 'export'}.csv`, csv);
  };

  const th = (key: SortKey, label: string, numeric = false) => {
    const on = sort.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={'p-0 font-bold ' + (numeric ? 'w-28' : '')}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="flex w-full items-center gap-1.5 px-4 py-3 text-right hover:text-[color:var(--maroon)]"
        >
          {label}
          <Icon className={'h-3.5 w-3.5 ' + (on ? '' : 'opacity-40')} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="panel overflow-hidden">
      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--hairline)] p-4">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">ابحث في الأنشطة</span>
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="ابحث باسم النشاط أو المادة أو الصف…"
            className="dash-input w-full"
          />
        </label>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {formatFull(filtered.length)} نشاط
        </span>
        <button type="button" onClick={exportCsv} className="btn-ghost min-h-[40px] px-3 py-1.5 text-sm">
          <FileSpreadsheet className="h-4 w-4" /> تصدير CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">لا توجد أنشطة مطابقة.</p>
      ) : (
        <>
          {/* الجوال: بطاقات */}
          <ul className="divide-y divide-[color:var(--hairline)] sm:hidden">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="w-full p-4 text-right"
                >
                  <p className="font-bold text-foreground">{r.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground">
                    <ActivityTypeBadge type={r.type} />
                    <span className="flex items-center gap-1 tabular-nums">
                      <Eye className="h-3.5 w-3.5" aria-hidden /> {formatFull(r.views)}
                      <span className="sr-only">مشاهدة</span>
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Download className="h-3.5 w-3.5" aria-hidden /> {formatFull(r.downloads)}
                      <span className="sr-only">تنزيل</span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* الشاشات الأكبر: جدول */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-right text-sm">
              <caption className="sr-only">
                الأنشطة مع المشاهدات والتنزيلات خلال {PERIOD_LABEL[period]}. انقر رأس العمود للترتيب.
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--hairline)] bg-[color:var(--plaster)] text-[color:var(--ink)]">
                  {th('title', 'النشاط')}
                  {th('type', 'النوع')}
                  {th('views', 'المشاهدات', true)}
                  {th('downloads', 'التنزيلات', true)}
                  <th scope="col" className="px-4 py-3 font-bold">
                    آخر 14 يومًا
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="cursor-pointer border-b border-[color:var(--hairline)] transition hover:bg-[color:var(--surface-2)]/50"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(r.id);
                        }}
                        className="text-right font-bold text-foreground hover:text-[color:var(--maroon)]"
                      >
                        {r.title}
                      </button>
                      {(r.subject || r.grade) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[r.subject, r.grade].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ActivityTypeBadge type={r.type} />
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-foreground">
                      {formatFull(r.views)}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-muted-foreground">
                      {formatFull(r.downloads)}
                    </td>
                    <td className="px-4 py-3">
                      {r.spark.some((v) => v > 0) ? (
                        <Sparkline values={r.spark} width={72} height={22} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ترقيم الصفحات */}
          {pages > 1 && (
            <nav
              aria-label="صفحات الجدول"
              className="flex items-center justify-between gap-3 border-t border-[color:var(--hairline)] p-3 text-sm"
            >
              <button
                type="button"
                onClick={() => setPage(cur - 1)}
                disabled={cur === 0}
                className="btn-ghost min-h-[40px] px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" /> السابق
              </button>
              <span className="font-semibold tabular-nums text-muted-foreground">
                صفحة {cur + 1} من {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage(cur + 1)}
                disabled={cur >= pages - 1}
                className="btn-ghost min-h-[40px] px-3 py-1.5 disabled:opacity-40"
              >
                التالي <ChevronLeft className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      )}

      <ActivityDrawer row={open} stats={open ? stats[open.id] : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** لوحة جانبية بتفاصيل نشاط واحد — بدل أن تطول الصفحة. */
function ActivityDrawer({
  row,
  stats,
  onClose,
}: {
  row: TableRow | null;
  stats: ActivityStats | undefined;
  onClose: () => void;
}) {
  const days30 = useMemo(() => lastDays(30), []);
  const days7 = days30.slice(-7);
  const series = days30.map((d) => stats?.viewsByDay?.[d] || 0);

  return (
    <Dialog.Root open={!!row} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer-panel" aria-describedby={undefined}>
          {row && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ActivityTypeBadge type={row.type} />
                  <Dialog.Title className="mt-2 font-display text-xl font-bold leading-snug text-foreground">
                    {row.title}
                  </Dialog.Title>
                  {(row.subject || row.grade) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[row.subject, row.grade].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <Dialog.Close className="btn-ghost h-10 w-10 shrink-0 justify-center p-0" aria-label="إغلاق">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3">
                <MiniStat label="إجمالي المشاهدات" value={row.totalViews} />
                <MiniStat label="إجمالي التنزيلات" value={row.totalDownloads} />
                <MiniStat label="مشاهدات آخر 7 أيام" value={sumMap(stats?.viewsByDay, days7)} />
                <MiniStat label="مشاهدات آخر 30 يومًا" value={sumMap(stats?.viewsByDay, days30)} />
              </dl>

              <section className="mt-6">
                <h3 className="mb-2 text-sm font-bold text-foreground">المشاهدات اليومية — آخر 30 يومًا</h3>
                {series.some((v) => v > 0) ? (
                  <TrendChart days={days30} values={series} unit="مشاهدة" height={180} />
                ) : (
                  <p className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] p-5 text-center text-sm text-muted-foreground">
                    لا مشاهدات مسجَّلة يوميًا لهذا النشاط بعد.
                  </p>
                )}
              </section>

              <Link href={`/play/${row.id}`} className="btn-primary mt-6 w-full justify-center py-2.5 text-sm">
                <Play className="h-4 w-4 fill-current" /> فتح النشاط
              </Link>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-tile">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">
        {formatFull(value)}
      </dd>
    </div>
  );
}
