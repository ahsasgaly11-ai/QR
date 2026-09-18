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
import { htmlToBlobUrl } from '@/lib/local-store';

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

export function ActivityPlayer({
  activity,
  localHtml,
}: {
  activity: Activity;
  /** محتوى الملف عند تشغيل نشاط محفوظ محليًا (وضع العرض) */
  localHtml?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localHtml) return;
    const u = htmlToBlobUrl(localHtml);
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [localHtml]);

  const url = localHtml ? blobUrl ?? '' : fileUrl(activity);
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

  // على الشاشات القصيرة (الجوال عرضيًا) نقيس المساحة المتبقية فعليًا ونملأها،
  // بدل افتراض ارتفاع ثابت قد يُخرج جزءًا من اللعبة خارج الشاشة.
  const [fitH, setFitH] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      if (document.fullscreenElement) return;
      const short = window.matchMedia('(max-height: 560px)').matches;
      if (!short) {
        setFitH(null);
        return;
      }
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      const STRIP = 6; // شريط العلم أعلى المسرح
      const GAP = 10;
      setFitH(Math.max(170, window.innerHeight - docTop - STRIP - GAP));
    };
    compute();
    const t = setTimeout(compute, 300);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, []);

  const onFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="short-hide flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ActivityTypeBadge type={activity.type} />
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Eye className="h-4 w-4" /> {formatFull(stats.views)} مشاهدة
          </span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Download className="h-4 w-4" /> {formatFull(stats.downloads)} تنزيل
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setKey((k) => k + 1);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-2 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
            title="إعادة تشغيل"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-2 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
          >
            <ExternalLink className="h-4 w-4" /> فتح في نافذة
          </a>
          <button
            onClick={onFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-2 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
          >
            <Maximize2 className="h-4 w-4" /> ملء الشاشة
          </button>
          <a
            href={url}
            download={activity.file || 'activity.html'}
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-xl bg-[color:var(--maroon)] px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-[color:var(--maroon-700)]"
          >
            <Download className="h-4 w-4" /> تحميل
          </a>
        </div>
      </div>

      {/* stage */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-3xl border-2 border-[color:var(--gold)]/30 bg-white shadow-2xl"
      >
        <div className="h-1.5 w-full flag-strip" />
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color:var(--surface)]">
            <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
            <p className="text-sm font-bold text-muted-foreground">
              جارٍ تحميل النشاط…
            </p>
          </div>
        )}
        {url ? (
          <iframe
            key={`${key}-${url}`}
            ref={frameRef}
            src={url}
            title={activity.title}
            className="game-stage w-full bg-white"
            style={fitH ? { height: fitH, minHeight: 0 } : undefined}
            sandbox="allow-scripts allow-same-origin allow-popups allow-downloads allow-forms allow-modals"
            onLoad={() => setLoading(false)}
          />
        ) : (
          <div className="game-stage w-full bg-white" style={fitH ? { height: fitH, minHeight: 0 } : undefined} />
        )}
      </div>
    </div>
  );
}
