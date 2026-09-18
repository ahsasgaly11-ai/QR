'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Download, Eye } from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { getActivityStats, trackDownload } from '@/lib/stats';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatNumber, cn } from '@/lib/utils';

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

export function ActivityCard({
  activity,
  index = 0,
}: {
  activity: Activity;
  index?: number;
}) {
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });

  useEffect(() => {
    let active = true;
    getActivityStats(activity.id).then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, [activity.id]);

  const onDownload = async () => {
    await trackDownload(activity.id);
    setStats((s) => ({ ...s, downloads: s.downloads + 1 }));
  };

  return (
    <div
      className="card-3d group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--qa-gold)]/20 bg-[color:var(--qa-cream)] p-5 shadow-lg shadow-black/5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* top accent ribbon */}
      <div className="absolute inset-x-0 top-0 h-1.5 flag-strip opacity-80" />

      <div className="mb-3 flex items-center justify-between">
        <ActivityTypeBadge type={activity.type} />
        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {formatNumber(stats.views)}
        </div>
      </div>

      <h3 className="font-display text-lg font-black leading-snug text-[color:var(--qa-maroon)]">
        {activity.title}
      </h3>
      {activity.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {activity.description}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Link
          href={`/play/${activity.id}`}
          className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--qa-maroon)] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[color:var(--qa-maroon)]/25 transition-all hover:-translate-y-0.5 hover:bg-[color:var(--qa-maroon-deep)]"
        >
          <Play className="h-4 w-4 fill-current transition-transform group-hover/btn:scale-110" />
          جرّب الآن
        </Link>
        <a
          href={fileUrl(activity)}
          download
          onClick={onDownload}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border-2 border-[color:var(--qa-gold)] px-4 py-2.5 text-sm font-black text-[color:var(--qa-maroon)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--qa-gold)]/15'
          )}
          title="تحميل النشاط للعمل دون اتصال"
        >
          <Download className="h-4 w-4" />
          {formatNumber(stats.downloads)}
        </a>
      </div>
    </div>
  );
}
