'use client';

import { useEffect, useState } from 'react';
import { Users, Eye, Download, Sparkles } from 'lucide-react';
import { getSiteStats } from '@/lib/stats';
import { CountUp } from './count-up';

export function SiteStatsStrip({ activities }: { activities: number }) {
  const [s, setS] = useState({ visitors: 0, views: 0, downloads: 0 });

  useEffect(() => {
    getSiteStats().then(setS);
  }, []);

  const items = [
    { icon: Users, label: 'الزوّار', value: s.visitors, color: 'var(--qa-maroon)' },
    { icon: Eye, label: 'المشاهدات', value: s.views, color: 'var(--qa-sky)' },
    { icon: Download, label: 'التنزيلات', value: s.downloads, color: 'var(--qa-teal)' },
    { icon: Sparkles, label: 'الأنشطة التفاعلية', value: activities, color: 'var(--qa-gold)' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="card-3d glass flex items-center gap-3 rounded-2xl p-4"
        >
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-md"
            style={{ background: it.color }}
          >
            <it.icon className="h-6 w-6" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-2xl font-black text-foreground">
              <CountUp value={it.value} />
            </div>
            <div className="text-xs font-bold text-muted-foreground">
              {it.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
