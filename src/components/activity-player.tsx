'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  Maximize2,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { getActivityStats, trackView, trackDownload } from '@/lib/stats';
import { ActivityTypeBadge } from './activity-type-badge';
import { formatFull } from '@/lib/utils';

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

export function ActivityPlayer({ activity }: { activity: Activity }) {
  const url = fileUrl(activity);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    trackView(activity.id);
    getActivityStats(activity.id).then((s) =>
      setStats({ views: s.views, downloads: s.downloads })
    );
  }, [activity.id]);

  const onDownload = async () => {
    await trackDownload(activity.id);
    setStats((s) => ({ ...s, downloads: s.downloads + 1 }));
  };

  const onFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ActivityTypeBadge type={activity.type} />
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Eye className="h-4 w-4" /> {formatFull(stats.views)} مشاهدة
          </span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Download className="h-4 w-4" /> {formatFull(stats.downloads)} تنزيل
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setKey((k) => k + 1);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--qa-gold)]/40 bg-white/60 px-3 py-2 text-sm font-bold text-[color:var(--qa-maroon)] transition hover:bg-[color:var(--qa-gold)]/10"
            title="إعادة تشغيل"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--qa-gold)]/40 bg-white/60 px-3 py-2 text-sm font-bold text-[color:var(--qa-maroon)] transition hover:bg-[color:var(--qa-gold)]/10"
          >
            <ExternalLink className="h-4 w-4" /> فتح في نافذة
          </a>
          <button
            onClick={onFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--qa-gold)]/40 bg-white/60 px-3 py-2 text-sm font-bold text-[color:var(--qa-maroon)] transition hover:bg-[color:var(--qa-gold)]/10"
          >
            <Maximize2 className="h-4 w-4" /> ملء الشاشة
          </button>
          <a
            href={url}
            download
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-xl bg-[color:var(--qa-maroon)] px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-[color:var(--qa-maroon-deep)]"
          >
            <Download className="h-4 w-4" /> تحميل
          </a>
        </div>
      </div>

      {/* stage */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-3xl border-2 border-[color:var(--qa-gold)]/30 bg-white shadow-2xl"
      >
        <div className="h-1.5 w-full flag-strip" />
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color:var(--qa-cream)]">
            <Loader2 className="h-10 w-10 animate-spin text-[color:var(--qa-maroon)]" />
            <p className="text-sm font-bold text-muted-foreground">
              جارٍ تحميل النشاط…
            </p>
          </div>
        )}
        <iframe
          key={key}
          ref={frameRef}
          src={url}
          title={activity.title}
          className="h-[72vh] min-h-[520px] w-full bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-downloads allow-forms allow-modals"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
