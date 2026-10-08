'use client';

import { useEffect, useState } from 'react';
import { Eye, Download } from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { subscribeActivityStats } from '@/lib/stats';
import { useActivityDownloadEnabled } from '@/lib/site-settings';
import { formatFull } from '@/lib/utils';

/** مشاهدات النشاط وتنزيلاته الحيّة بجانب عنوانه في صفحة التشغيل. */
export function ActivityStatsChips({ activity }: { activity: Activity }) {
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });
  const canDownload = useActivityDownloadEnabled(activity);

  // العدّادات حيّة: تتغيّر فور احتساب أي مشاهدة/تنزيل من أي مستخدم.
  useEffect(() => subscribeActivityStats(activity.id, setStats), [activity.id]);

  return (
    <ul className="play-chips">
      <li>
        <Eye className="h-4 w-4" aria-hidden />
        <b>{formatFull(stats.views)}</b> مشاهدة
      </li>
      {canDownload && (
        <li>
          <Download className="h-4 w-4" aria-hidden />
          <b>{formatFull(stats.downloads)}</b> تنزيلًا
        </li>
      )}
    </ul>
  );
}
