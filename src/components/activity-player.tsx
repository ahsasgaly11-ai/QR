'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  Maximize2,
  Minimize2,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { Activity, ActivityStats } from '@/lib/types';
import { getActivityStats, trackView, trackDownload } from '@/lib/stats';
import { isActivityEvent, recordActivityEvent } from '@/lib/activity-events';
import { ActivityTypeBadge } from './activity-type-badge';
import { SignLanguageButton } from './sign-language';
import { formatFull, cn } from '@/lib/utils';
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
  const [fetchFailed, setFetchFailed] = useState(false);
  // الأنشطة المرفوعة تُخزَّن مقسّمة داخل Firestore وتُجمَّع هنا قبل التشغيل
  const remote = !localHtml && activity.stored === 'firestore';

  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;

    if (localHtml) {
      revoke = htmlToBlobUrl(localHtml);
      setBlobUrl(revoke);
    } else if (remote) {
      setFetchFailed(false);
      (async () => {
        const { loadGameHtml } = await import('@/lib/game-store');
        const html = await loadGameHtml(activity.id);
        if (!alive) return;
        if (!html) return setFetchFailed(true);
        revoke = htmlToBlobUrl(html);
        setBlobUrl(revoke);
      })();
    }

    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [localHtml, remote, activity.id]);

  const url = localHtml || remote ? blobUrl ?? '' : fileUrl(activity);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<ActivityStats>({ views: 0, downloads: 0 });
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  // وضع العرض الكامل: طبقة ثابتة داخل الصفحة (لا تعتمد على Fullscreen API)
  // حتى لا يُنهيها التمرير على الجوال، وتعمل على iOS الذي لا يدعم ملء شاشة
  // العناصر. نطلب ملء الشاشة الأصلي إضافةً إليها عند توفّره فقط.
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    trackView(activity.id);
    getActivityStats(activity.id).then((s) =>
      setStats({ views: s.views, downloads: s.downloads })
    );
  }, [activity.id]);

  // مستمع عقد التتبّع: يستقبل نتائج الطالب التي تبثّها اللعبة من داخل الـ
  // iframe (postMessage) ويحفظ التقدّم محليًّا — أساس المحرّك التكيّفي.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // نقبل فقط الرسائل الصادرة من إطار هذا النشاط ووفق العقد المعتمد
      if (e.source !== frameRef.current?.contentWindow) return;
      if (!isActivityEvent(e.data)) return;
      recordActivityEvent(activity.id, e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activity.id]);

  const onDownload = async () => {
    await trackDownload(activity.id);
    setStats((s) => ({ ...s, downloads: s.downloads + 1 }));
  };

  // على الشاشات القصيرة نقيس المساحة المتبقية فعليًا ونملأها
  const [fitH, setFitH] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el || immersive) return;
      const short = window.matchMedia('(max-height: 560px)').matches;
      if (!short) {
        setFitH(null);
        return;
      }
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      const STRIP = 6;
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
  }, [immersive]);

  // امنع تمرير الصفحة خلف الطبقة (السبب المباشر لانقطاع ملء الشاشة سابقًا)
  useEffect(() => {
    if (!immersive) return;
    const body = document.body;
    const root = document.documentElement;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      rootOverflow: root.style.overflow,
    };
    const y = window.scrollY;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    root.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      root.style.overflow = prev.rootOverflow;
      // أعِد الزائر إلى موضعه قبل الدخول
      window.scrollTo(0, y);
    };
  }, [immersive]);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    const d = document as Document & { webkitExitFullscreen?: () => void };
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if ((d as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      d.webkitExitFullscreen?.();
    }
  }, []);

  // الخروج بمفتاح Esc
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitImmersive();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersive, exitImmersive]);

  const enterImmersive = () => {
    setImmersive(true);
    // محاولة ملء الشاشة الأصلي كميزة إضافية — وفشلها لا يؤثّر على الطبقة
    const el = wrapRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    try {
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else el?.webkitRequestFullscreen?.();
    } catch {
      /* الطبقة الثابتة تكفي */
    }
  };

  const toolbarBtn =
    'flex items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-2 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10';

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
            className={toolbarBtn}
            title="إعادة تشغيل"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <SignLanguageButton src={activity.signLang} />
          <a href={url} target="_blank" rel="noopener noreferrer" className={toolbarBtn}>
            <ExternalLink className="h-4 w-4" /> فتح في نافذة
          </a>
          <button onClick={enterImmersive} className={toolbarBtn}>
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

      {/* حافظ على مكان المسرح في الصفحة أثناء وضع العرض الكامل */}
      {immersive && <div className="game-stage w-full" aria-hidden />}

      <div
        ref={wrapRef}
        className={cn(
          'vt-game-stage relative overflow-hidden bg-white',
          immersive
            ? 'fixed inset-0 z-[100] rounded-none border-0'
            : 'rounded-3xl border-2 border-[color:var(--gold)]/30 shadow-2xl'
        )}
        style={immersive ? { overscrollBehavior: 'contain' } : undefined}
      >
        {!immersive && <div className="h-1.5 w-full flag-strip" />}

        {immersive && (
          <button
            onClick={exitImmersive}
            className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-xl bg-[color:var(--maroon)]/90 px-3 py-2 text-sm font-black text-white shadow-lg backdrop-blur transition hover:bg-[color:var(--maroon)]"
            aria-label="إنهاء ملء الشاشة"
          >
            <Minimize2 className="h-4 w-4" /> خروج
          </button>
        )}

        {fetchFailed ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color:var(--surface)] px-6 text-center">
            <p className="font-bold text-[color:var(--maroon)]">
              تعذّر تحميل ملف النشاط.
            </p>
            <p className="text-sm text-muted-foreground">
              تحقّق من اتصالك بالإنترنت ثم أعد المحاولة.
            </p>
          </div>
        ) : (
          loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color:var(--surface)]">
              <Loader2 className="h-10 w-10 animate-spin text-[color:var(--maroon)]" />
              <p className="text-sm font-bold text-muted-foreground">
                جارٍ تحميل النشاط…
              </p>
            </div>
          )
        )}

        {url ? (
          <iframe
            key={`${key}-${url}`}
            ref={frameRef}
            src={url}
            title={activity.title}
            className={cn('w-full bg-white', immersive ? 'h-full' : 'game-stage')}
            style={!immersive && fitH ? { height: fitH, minHeight: 0 } : undefined}
            sandbox="allow-scripts allow-same-origin allow-popups allow-downloads allow-forms allow-modals"
            onLoad={() => setLoading(false)}
          />
        ) : (
          <div
            className={cn('w-full bg-white', immersive ? 'h-full' : 'game-stage')}
            style={!immersive && fitH ? { height: fitH, minHeight: 0 } : undefined}
          />
        )}
      </div>
    </div>
  );
}
