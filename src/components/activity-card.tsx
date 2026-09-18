'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Download, Eye } from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { getActivityStats, trackDownload } from '@/lib/stats';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatNumber, cn } from '@/lib/utils';
import { getLocalRecord, htmlToBlobUrl } from '@/lib/local-store';
import { ActivityPreview } from './activity-preview';

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

  const onDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // الأنشطة المحفوظة محليًا (وضع العرض) تُنزَّل من مخزن المتصفّح
    if (activity.local) {
      e.preventDefault();
      const rec = await getLocalRecord(activity.id);
      if (rec?.html) {
        const url = htmlToBlobUrl(rec.html);
        const a = document.createElement('a');
        a.href = url;
        a.download = activity.file || 'activity.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    }
    await trackDownload(activity.id);
    setStats((s) => ({ ...s, downloads: s.downloads + 1 }));
  };

  return (
    <div
      className="card-premium group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] p-5 shadow-lg shadow-black/5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* top accent ribbon */}
      <div className="absolute inset-x-0 top-0 h-1.5 flag-strip opacity-80" />

      {/* معاينة حيّة لشكل اللعبة */}
      <Link
        href={`/play/${activity.id}`}
        className="group/prev relative mb-4 block overflow-hidden rounded-2xl"
        aria-label={`تشغيل ${activity.title}`}
      >
        <ActivityPreview activity={activity} />
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-[color:var(--maroon)]/0 transition-colors duration-300 group-hover/prev:bg-[color:var(--maroon)]/35">
          <span className="grid h-12 w-12 scale-75 place-items-center rounded-full bg-white/95 text-[color:var(--maroon)] opacity-0 shadow-lg transition-all duration-300 group-hover/prev:scale-100 group-hover/prev:opacity-100">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
      </Link>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ActivityTypeBadge type={activity.type} />
          {activity.local && (
            <span
              className="pill bg-[color:var(--gold)]/20 text-[color:var(--gold)]"
              title="محفوظ في هذا المتصفّح فقط (وضع العرض)"
            >
              محلي
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {formatNumber(stats.views)}
        </div>
      </div>

      <h3 className="font-display text-lg font-black leading-snug text-[color:var(--maroon)]">
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
          className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--maroon)] px-4 py-2.5 text-sm font-black text-white shadow-md shadow-[color:var(--maroon)]/25 transition-all hover:-translate-y-0.5 hover:bg-[color:var(--maroon-700)]"
        >
          <Play className="h-4 w-4 fill-current transition-transform group-hover/btn:scale-110" />
          جرّب الآن
        </Link>
        <a
          href={fileUrl(activity)}
          download
          onClick={onDownload}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border-2 border-[color:var(--gold)] px-4 py-2.5 text-sm font-black text-[color:var(--maroon)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--gold)]/15'
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
