'use client';

import { useEffect, useState } from 'react';
import { Users, Eye, Download, Sparkles } from 'lucide-react';
import { getCachedSiteStats, getSiteStats } from '@/lib/stats';
import { CountUp } from './count-up';
import { Icon3D } from '@/components/icon-3d';

export function SiteStatsStrip({ activities }: { activities: number }) {
  const [s, setS] = useState({ visitors: 0, views: 0, downloads: 0 });

  useEffect(() => {
    let alive = true;
    // اعرض آخر أرقام معروفة فورًا بدل الأصفار، ثم حدّثها من Firestore.
    const cached = getCachedSiteStats();
    if (cached) setS(cached);
    getSiteStats()
      .then((v) => alive && setS(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    { icon: Users, label: 'الزوّار', value: s.visitors, color: 'var(--maroon)' },
    { icon: Eye, label: 'المشاهدات', value: s.views, color: 'var(--maroon-700)' },
    { icon: Download, label: 'التنزيلات', value: s.downloads, color: 'var(--gold)' },
    { icon: Sparkles, label: 'الأنشطة التفاعلية', value: activities, color: 'var(--maroon-300)' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="card-premium glass flex items-center gap-3 rounded-2xl p-4"
        >
          <Icon3D icon={it.icon} color={it.color} size="md" />
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
