'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  Download,
  Sparkles,
  TrendingUp,
  Play,
  PieChart,
  Table2,
} from 'lucide-react';
import { getSiteStats, getAllActivityStats } from '@/lib/stats';
import type { ActivityStats, ActivityType } from '@/lib/types';
import { ACTIVITY_META } from '@/lib/types';
import { CountUp } from './count-up';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatFull } from '@/lib/utils';

interface Row {
  id: string;
  title: string;
  type: ActivityType;
  subject: string;
}
type FullRow = Row & { views: number; downloads: number };

export function StatsDashboard({ activities }: { activities: Row[] }) {
  const [site, setSite] = useState({ visitors: 0, views: 0, downloads: 0 });
  const [map, setMap] = useState<Record<string, ActivityStats>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getSiteStats(), getAllActivityStats()]).then(([s, m]) => {
      setSite(s);
      setMap(m);
      setLoaded(true);
    });
  }, []);

  const rows: FullRow[] = activities
    .map((a) => ({
      ...a,
      views: map[a.id]?.views ?? 0,
      downloads: map[a.id]?.downloads ?? 0,
    }))
    .sort((a, b) => b.views - a.views);

  const maxViews = Math.max(1, ...rows.map((r) => r.views));

  // type breakdown (count + views per type)
  const types = Object.keys(ACTIVITY_META) as ActivityType[];
  const byType = types
    .map((t) => {
      const list = rows.filter((r) => r.type === t);
      return {
        type: t,
        count: list.length,
        views: list.reduce((n, r) => n + r.views, 0),
      };
    })
    .filter((x) => x.count > 0);
  const maxTypeViews = Math.max(1, ...byType.map((t) => t.views));

  const cards = [
    { icon: Users, label: 'إجمالي الزوّار', value: site.visitors, color: 'var(--maroon)' },
    { icon: Eye, label: 'إجمالي المشاهدات', value: site.views, color: 'var(--sky)' },
    { icon: Download, label: 'إجمالي التنزيلات', value: site.downloads, color: 'var(--teal)' },
    { icon: Sparkles, label: 'عدد الأنشطة', value: activities.length, color: 'var(--gold)' },
  ];

  return (
    <div className="space-y-8">
      {/* stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-premium relative overflow-hidden rounded-3xl p-6">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full opacity-[0.08]" style={{ background: c.color }} />
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[var(--shadow-sm)]" style={{ background: c.color }}>
              <c.icon className="h-6 w-6" />
            </span>
            <div className="mt-4 font-display text-4xl font-bold text-foreground">
              <CountUp value={c.value} />
            </div>
            <p className="mt-1 text-sm font-bold text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ranking: most viewed (single-hue magnitude; identity via type badge) */}
        <figure className="card-premium rounded-3xl p-6 sm:p-7 lg:col-span-3">
          <figcaption className="mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[color:var(--maroon)]" />
            <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
              الأنشطة الأكثر مشاهدة
            </h2>
          </figcaption>
          <div className="space-y-5">
            {rows.slice(0, 8).map((r, i) => (
              <div key={r.id} className="group" title={`${r.title} — ${formatFull(r.views)} مشاهدة`}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-[color:var(--gold)]">
                      {i + 1}
                    </span>
                    <Link href={`/play/${r.id}`} className="truncate text-sm font-bold text-foreground hover:text-[color:var(--maroon)]">
                      {r.title}
                    </Link>
                    <ActivityTypeBadge type={r.type} className="hidden shrink-0 sm:inline-flex" />
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums text-muted-foreground">
                    {formatFull(r.views)}
                  </span>
                </div>
                {/* track + bar */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-[900ms] ease-out group-hover:brightness-110"
                    style={{
                      width: loaded ? `${(r.views / maxViews) * 100}%` : '0%',
                      background: 'linear-gradient(90deg, var(--maroon-300), var(--maroon))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </figure>

        {/* type breakdown (each bar directly labeled: name + icon carry identity) */}
        <figure className="card-premium rounded-3xl p-6 sm:p-7 lg:col-span-2">
          <figcaption className="mb-6 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[color:var(--maroon)]" />
            <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
              المشاهدات حسب النوع
            </h2>
          </figcaption>
          <div className="space-y-5">
            {byType.map((t) => {
              const meta = ACTIVITY_META[t.type];
              return (
                <div key={t.type} title={`${meta.label} — ${formatFull(t.views)} مشاهدة (${t.count} نشاط)`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <span className="h-3 w-3 rounded-sm" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <span className="tabular-nums">{formatFull(t.views)} مشاهدة</span>
                      <span className="text-[color:var(--gold)]">•</span>
                      <span className="tabular-nums">{t.count} نشاط</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                      style={{ width: loaded ? `${(t.views / maxTypeViews) * 100}%` : '0%', background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </figure>
      </div>

      {/* full table (the accessible data view) */}
      <div className="card-premium overflow-hidden rounded-3xl">
        <div className="flex items-center gap-2 border-b border-[color:var(--hairline)] p-5">
          <Table2 className="h-5 w-5 text-[color:var(--maroon)]" />
          <h2 className="font-display text-lg font-bold text-[color:var(--maroon)]">
            كل الأنشطة
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[color:var(--hairline)] bg-[color:var(--surface-2)] text-[color:var(--maroon)]">
                <th className="p-4 font-bold">النشاط</th>
                <th className="p-4 font-bold">النوع</th>
                <th className="p-4 font-bold">المشاهدات</th>
                <th className="p-4 font-bold">التنزيلات</th>
                <th className="p-4 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--hairline)] transition hover:bg-[color:var(--surface-2)]/50">
                  <td className="p-4 font-bold text-foreground">{r.title}</td>
                  <td className="p-4"><ActivityTypeBadge type={r.type} /></td>
                  <td className="p-4 font-bold tabular-nums text-muted-foreground">{formatFull(r.views)}</td>
                  <td className="p-4 font-bold tabular-nums text-muted-foreground">{formatFull(r.downloads)}</td>
                  <td className="p-4">
                    <Link href={`/play/${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[color:var(--maroon-700)]">
                      <Play className="h-3 w-3 fill-current" /> تشغيل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
