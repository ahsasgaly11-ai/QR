'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePearlTimer } from '@/components/pearls/use-pearl-timer';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { Activity } from '@/lib/types';
import { trackView, trackDownload } from '@/lib/stats';
import { trackSchoolPlay, trackSchoolDownload } from '@/lib/school-store';
import { useActivityDownloadEnabled, downloadsAllowedNow } from '@/lib/site-settings';
import { SchoolGate } from './school-gate';
import { SignLanguageButton, SignLanguagePanel } from './sign-language';
import { resolveSignLanguageSrc, isSignLanguageOn, SIGN_LANG_ATTR } from '@/lib/sign-language';
import { cn } from '@/lib/utils';
import {
  htmlToBlobUrl,
  htmlToFrameUrl,
  htmlToSandboxPageUrl,
  GAME_SANDBOX,
  FS_REQUEST_KEY,
  FS_STATE_KEY,
} from '@/lib/local-store';

function nativeFullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

type PlayerProps = {
  activity: Activity;
  /** محتوى الملف عند تشغيل نشاط محفوظ محليًا (وضع العرض) */
  localHtml?: string;
  /** النشاط التالي في الدرس نفسه — يظهر زرّه في شريط الأدوات */
  next?: { href: string; title: string };
};

/**
 * مشغّل النشاط محاطًا دائمًا ببوّابة اختيار المدرسة: لا تُحمَّل اللعبة ولا
 * تُشغَّل داخل الموقع قبل اختيار المدرسة، أيًّا كان إعداد التنزيل لدى المشرف
 * وأيًّا كانت الصفحة التي تعرض المشغّل.
 */
export function ActivityPlayer(props: PlayerProps) {
  return (
    <SchoolGate>
      <PlayerInner {...props} />
    </SchoolGate>
  );
}

function PlayerInner({ activity, localHtml, next }: PlayerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  // نسخة التشغيل داخل الـiframe المعزول (مع بديل التخزين)؛ blobUrl يبقى
  // للتحميل وفتح النافذة فيصل الملف للمستخدم كما رُفع تمامًا.
  const [frameBlobUrl, setFrameBlobUrl] = useState<string | null>(null);
  // «فتح في نافذة» للأنشطة المرفوعة: صفحة تغلّف اللعبة بإطار معزول، لا الملف
  // نفسه — فتحه مباشرة يشغّله بأصل الموقع وصلاحيات جلسة المشرف.
  const [openBlobUrl, setOpenBlobUrl] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  // الأنشطة المرفوعة تُخزَّن مقسّمة داخل Firestore وتُجمَّع هنا قبل التشغيل
  const remote = !localHtml && activity.stored === 'firestore';

  useEffect(() => {
    let revoke: string | null = null;
    let revokeFrame: string | null = null;
    let revokeOpen: string | null = null;
    let alive = true;

    if (localHtml) {
      revoke = htmlToBlobUrl(localHtml);
      revokeFrame = htmlToFrameUrl(localHtml);
      revokeOpen = htmlToSandboxPageUrl(localHtml, activity.title);
      setBlobUrl(revoke);
      setFrameBlobUrl(revokeFrame);
      setOpenBlobUrl(revokeOpen);
    } else if (remote) {
      setFetchFailed(false);
      (async () => {
        const { loadGameHtml } = await import('@/lib/game-store');
        const html = await loadGameHtml(activity.id);
        if (!alive) return;
        if (!html) return setFetchFailed(true);
        revoke = htmlToBlobUrl(html);
        revokeFrame = htmlToFrameUrl(html);
        revokeOpen = htmlToSandboxPageUrl(html, activity.title);
        setBlobUrl(revoke);
        setFrameBlobUrl(revokeFrame);
        setOpenBlobUrl(revokeOpen);
      })();
    }

    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
      if (revokeFrame) URL.revokeObjectURL(revokeFrame);
      if (revokeOpen) URL.revokeObjectURL(revokeOpen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- العنوان للعرض فقط
  }, [localHtml, remote, activity.id]);

  const uploaded = Boolean(localHtml || remote);
  const url = uploaded ? blobUrl ?? '' : fileUrl(activity);
  // الألعاب المرفوعة تُشغَّل معزولة؛ ملفات /games المرفقة بالموقع والروابط
  // الخارجية تبقى كما هي.
  const frameUrl = uploaded ? frameBlobUrl ?? '' : url;
  const openUrl = uploaded ? openBlobUrl ?? '' : url;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // يوقف المشرف التنزيل من لوحة التحكّم ← تُستخدم اللعبة داخل الموقع فقط
  const canDownload = useActivityDownloadEnabled(activity);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  // رفيق لغة الإشارة: حالة الفتح والتفضيل (تُدار هنا لضبط موضع اللوحة في التدفّق).
  const [signOpen, setSignOpen] = useState(false);
  const [signPref, setSignPref] = useState(false);
  useEffect(() => {
    const sync = () => {
      const on = isSignLanguageOn();
      setSignPref(on);
      setSignOpen(on);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [`data-${SIGN_LANG_ATTR}`],
    });
    return () => obs.disconnect();
  }, []);

  // وضع العرض الكامل: طبقة ثابتة داخل الصفحة (لا تعتمد على Fullscreen API)
  // حتى لا يُنهيها التمرير على الجوال، وتعمل على iOS الذي لا يدعم ملء شاشة
  // العناصر. نطلب ملء الشاشة الأصلي إضافةً إليها عند توفّره فقط.
  const [immersive, setImmersive] = useState(false);

  // لؤلؤة عن كل نشاط يُجرَّب دقيقة كاملة
  usePearlTimer(activity.id, activity.title);

  useEffect(() => {
    trackSchoolPlay(activity); // ينسب اللعب للمدرسة + النشاط/الوحدة
    void trackView(activity.id);
  }, [activity.id]);


  const onDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // احتياط: قد يُوقف المشرف التنزيل والصفحة مفتوحة
    if (!downloadsAllowedNow(activity)) {
      e.preventDefault();
      return;
    }
    await trackDownload(activity.id);
    trackSchoolDownload(activity); // ينسب التحميل لمدرسة المستخدم المختارة
  };

  // على الشاشات القصيرة (الجوال عرضيًا) يملأ المسرح الشاشة كلّها تحت الترويسة
  // المثبّتة بعد التمرير إليه — لا المساحة المتبقية تحت العنوان فقط، فتلك
  // تنكمش إلى شريط بارتفاع أصابع لا تُلعب فيه اللعبة.
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
      const header = document.querySelector<HTMLElement>('header.sticky');
      const headerH = header ? header.getBoundingClientRect().height : 70;
      const STRIP = 14;
      const GAP = 8;
      setFitH(Math.max(240, window.innerHeight - headerH - STRIP - GAP));
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

  // هل فُتح وضع العرض الكامل بطلب من زرّ اللعبة نفسها؟ عندها فقط يُغلقه زرّ
  // اللعبة؛ أمّا إن فتحه زرّ الموقع فيبقى حتى يُغلق بزرّ «خروج» الموقع.
  const gameOwnedRef = useRef(false);
  const immersiveRef = useRef(immersive);
  immersiveRef.current = immersive;

  // هل أُضيف قيد في سجلّ التصفّح لوضع العرض الكامل؟ به يُغلق زرّ «رجوع»
  // في المتصفّح/الجوال وضعَ العرض بدل مغادرة الصفحة كلّها.
  const historyRef = useRef(false);
  // هل نحن فعلًا في ملء الشاشة الأصلي الذي طلبناه؟
  const nativeRef = useRef(false);

  const exitImmersive = useCallback((fromHistory = false) => {
    gameOwnedRef.current = false;
    nativeRef.current = false;
    setImmersive(false);
    if (nativeFullscreenElement()) {
      const d = document as Document & { webkitExitFullscreen?: () => void };
      try {
        if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
        else d.webkitExitFullscreen?.();
      } catch {
        /* لا شيء */
      }
    }
    if (historyRef.current) {
      historyRef.current = false;
      // أزل القيد الذي أضفناه حتى لا يحتاج الزائر للضغط على «رجوع» مرّتين
      if (!fromHistory) window.history.back();
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

  // زرّ «رجوع» أثناء وضع العرض الكامل يُغلقه فقط ولا يغادر الصفحة
  useEffect(() => {
    const onPop = () => {
      if (historyRef.current && immersiveRef.current) exitImmersive(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [exitImmersive]);

  // خروج المتصفّح من ملء الشاشة الأصلي (Esc، إيماءة السحب على iPad، زرّ الرجوع
  // في Android) يُنهي الطبقة أيضًا؛ وإلا بقيت تغطّي الصفحة والتمرير مقفل.
  useEffect(() => {
    const onChange = () => {
      const fsEl = nativeFullscreenElement();
      if (fsEl && fsEl === wrapRef.current) {
        nativeRef.current = true;
      } else if (nativeRef.current) {
        nativeRef.current = false;
        if (immersiveRef.current) exitImmersive();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [exitImmersive]);

  const enterImmersive = useCallback(() => {
    setImmersive(true);
    if (!historyRef.current) {
      try {
        // نسخ الحالة الحالية يحفظ بيانات موجّه Next.js فلا يُعاد تحميل الصفحة
        window.history.pushState({ ...(window.history.state ?? {}), [FS_STATE_KEY]: true }, '');
        historyRef.current = true;
      } catch {
        /* يبقى زرّ «خروج» */
      }
    }
    // محاولة ملء الشاشة الأصلي كميزة إضافية — وفشلها لا يؤثّر على الطبقة
    if (nativeFullscreenElement()) return;
    const el = wrapRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    try {
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else el?.webkitRequestFullscreen?.();
    } catch {
      /* الطبقة الثابتة تكفي */
    }
  }, []);

  // جسر ملء الشاشة (انظر FULLSCREEN_SHIM): زرّ اللعبة يكبّر الجزء الذي
  // تختاره اللعبة داخل إطارها، ويطلب من الموقع ملء الشاشة إن لم يكن مفعّلًا
  // بدل فتح ملء شاشة ثانٍ متداخل يعلق فيه الزائر.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const action = (e.data as Record<string, unknown> | null)?.[FS_REQUEST_KEY];
      if (action === 'enter') {
        if (immersiveRef.current) return;
        gameOwnedRef.current = true;
        enterImmersive();
      } else if (action === 'exit') {
        if (gameOwnedRef.current) exitImmersive();
      } else if (action === 'escape') {
        exitImmersive();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [enterImmersive, exitImmersive]);

  // أبلغ اللعبة بحالة وضع الموقع (عند الخروج منه تُعيد اللعبة الجزء المكبَّر)
  const syncFrameFullscreen = useCallback(() => {
    try {
      frameRef.current?.contentWindow?.postMessage({ [FS_STATE_KEY]: immersive }, '*');
    } catch {
      /* الإطار غير جاهز */
    }
  }, [immersive]);
  useEffect(syncFrameFullscreen, [syncFrameFullscreen]);

  return (
    <div>
      {/* رفيق لغة الإشارة: على الجوّال ضمن التدفّق (فوق اللعبة، بلا تغطية)،
          وعلى الشاشات الكبيرة لوحة عائمة. لا يظهر أثناء ملء الشاشة. */}
      {!immersive && (
        <SignLanguagePanel
          open={signOpen}
          onClose={() => setSignOpen(false)}
          src={resolveSignLanguageSrc(activity.signLang)}
          title={activity.title}
          description={activity.description}
        />
      )}

      {/* حافظ على مكان المسرح في الصفحة أثناء وضع العرض الكامل */}
      {immersive && <div className="game-stage w-full" aria-hidden />}

      <div
        ref={wrapRef}
        className={cn(
          'vt-game-stage relative overflow-hidden bg-white',
          immersive
            ? 'fixed inset-0 z-[100] rounded-none border-0'
            : 'player-frame'
        )}
        style={immersive ? { overscrollBehavior: 'contain' } : undefined}
      >
        {!immersive && <div className="h-1.5 w-full flag-strip" />}

        {immersive && (
          <button
            onClick={() => exitImmersive()}
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

        {frameUrl ? (
          <iframe
            key={`${key}-${frameUrl}`}
            ref={frameRef}
            src={frameUrl}
            title={activity.title}
            className={cn('w-full bg-white', immersive ? 'h-full' : 'game-stage')}
            style={!immersive && fitH ? { height: fitH, minHeight: 0 } : undefined}
            sandbox={
              uploaded
                ? GAME_SANDBOX
                : 'allow-scripts allow-same-origin allow-popups allow-downloads allow-forms allow-modals'
            }
            onLoad={() => {
              setLoading(false);
              syncFrameFullscreen();
            }}
          />
        ) : (
          <div
            className={cn('w-full bg-white', immersive ? 'h-full' : 'game-stage')}
            style={!immersive && fitH ? { height: fitH, minHeight: 0 } : undefined}
          />
        )}
      </div>

      {/* شريط الأدوات تحت المسرح: ملء الشاشة أولًا لأنه أكثر ما يحتاجه المعلّم */}
      {!immersive && (
        <div className="player-toolbar">
          <button
            onClick={() => {
              gameOwnedRef.current = false;
              enterImmersive();
            }}
            className="tool-btn tool-btn--primary"
          >
            <Maximize2 className="h-4 w-4" aria-hidden /> ملء الشاشة
          </button>
          {/* «فتح في نافذة» يعرض ملف اللعبة خارج الموقع فيُمكن حفظه، لذا يُخفى
              مع زرّ التحميل عند قصر الاستخدام على داخل الموقع. */}
          {canDownload && (
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className="tool-btn">
              <ExternalLink className="h-4 w-4" aria-hidden /> فتح في نافذة
            </a>
          )}
          <SignLanguageButton
            active={signPref}
            onClick={() => setSignOpen(true)}
            className="tool-btn"
          />
          <button
            onClick={() => {
              setLoading(true);
              setKey((k) => k + 1);
            }}
            className="tool-btn"
            title="إعادة تشغيل"
            aria-label="إعادة تشغيل النشاط"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">إعادة</span>
          </button>
          {canDownload && (
            <a
              href={url}
              download={activity.file || 'activity.html'}
              onClick={onDownload}
              className="tool-btn"
              title="تحميل للعمل دون إنترنت"
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">تحميل</span>
            </a>
          )}
          {next && (
            <Link href={next.href} className="tool-btn tool-btn--next" title={next.title}>
              النشاط التالي
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
