'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Eye, Download, Sparkles, TrendingUp, Play } from 'lucide-react';
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

  const rows = activities
    .map((a) => ({
      ...a,
      views: map[a.id]?.views ?? 0,
      downloads: map[a.id]?.downloads ?? 0,
    }))
    .sort((a, b) => b.views - a.views);

  const maxViews = Math.max(1, ...rows.map((r) => r.views));

  const cards = [
    { icon: Users, label: 'إجمالي الزوّار', value: site.visitors, color: 'var(--maroon)' },
    { icon: Eye, label: 'إجمالي المشاهدات', value: site.views, color: 'var(--sky)' },
    { icon: Download, label: 'إجمالي التنزيلات', value: site.downloads, color: 'var(--teal)' },
    { icon: Sparkles, label: 'عدد الأنشطة', value: activities.length, color: 'var(--gold)' },
  ];

  return (
    <div className="space-y-10">
      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card-premium relative overflow-hidden rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] p-6 shadow-lg"
          >
            <div
              className="absolute -left-6 -top-6 h-24 w-24 rounded-full opacity-10"
              style={{ background: c.color }}
            />
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md"
              style={{ background: c.color }}
            >
              <c.icon className="h-7 w-7" />
            </span>
            <div className="mt-4 font-display text-4xl font-black text-foreground">
              <CountUp value={c.value} />
            </div>
            <p className="mt-1 text-sm font-bold text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* chart: most viewed */}
      <div className="rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-[color:var(--maroon)]" />
          <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
            الأنشطة الأكثر مشاهدة
          </h2>
        </div>
        <div className="space-y-4">
          {rows.slice(0, 8).map((r, i) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-center font-display text-lg font-black text-[color:var(--gold)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Link
                    href={`/play/${r.id}`}
                    className="truncate text-sm font-bold text-foreground hover:text-[color:var(--maroon)]"
                  >
                    {r.title}
                  </Link>
                  <span className="shrink-0 text-xs font-black text-muted-foreground">
                    {formatFull(r.views)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: loaded ? `${(r.views / maxViews) * 100}%` : '0%',
                      background: `linear-gradient(90deg, ${ACTIVITY_META[r.type].color}, var(--maroon))`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* full table */}
      <div className="overflow-hidden rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[color:var(--gold)]/20 bg-[color:var(--maroon)]/5 text-[color:var(--maroon)]">
                <th className="p-4 font-black">النشاط</th>
                <th className="p-4 font-black">النوع</th>
                <th className="p-4 font-black">المشاهدات</th>
                <th className="p-4 font-black">التنزيلات</th>
                <th className="p-4 font-black"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--gold)]/10 transition hover:bg-black/[0.02]"
                >
                  <td className="p-4 font-bold text-foreground">{r.title}</td>
                  <td className="p-4">
                    <ActivityTypeBadge type={r.type} />
                  </td>
                  <td className="p-4 font-bold text-muted-foreground">
                    {formatFull(r.views)}
                  </td>
                  <td className="p-4 font-bold text-muted-foreground">
                    {formatFull(r.downloads)}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/play/${r.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--maroon)] px-3 py-1.5 text-xs font-black text-white hover:bg-[color:var(--maroon-700)]"
                    >
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
