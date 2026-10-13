'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download, CheckCircle2 } from 'lucide-react';
import {
  detectAppleDevice,
  DOCUMENTS_APP,
  IOS_DOWNLOAD_EVENT,
  type AppleDevice,
} from '@/lib/apple-device';
import { DocumentsAppIcon } from './documents-app-icon';

const DISMISS_KEY = 'qa-ios-docs-dismissed';
/** بعد الإغلاق لا تعود التوصية قبل أسبوعين (إرشاد ما بعد التحميل يظهر دائمًا). */
const DISMISS_DAYS = 14;

/** الصفحات التي لا تُعرض فيها التوصية (لا ألعاب فيها). */
const SKIP_PREFIXES = ['/admin', '/dashboard', '/heatmap', '/privacy', '/accessibility'];

function isDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

const DEVICE_LABEL: Record<AppleDevice, string> = { iphone: 'iPhone', ipad: 'iPad' };

/**
 * إشعار لأصحاب iPhone وiPad فقط: سفاري يحفظ اللعبة كملف HTML ولا يشغّلها
 * من تطبيق «الملفات»، فنوصي بتطبيق Documents (مجاني) الذي يشغّلها كاملةً.
 * يظهر بوضعين: توصية عامة قابلة للإغلاق، وإرشاد فوري بعد كل تحميل.
 *
 * - `fixed` (في التخطيط العام): بطاقة عائمة أسفل الشاشة في صفحات التصفّح.
 * - `inline` (في صفحة التشغيل تحت المشغّل): ضمن تدفّق الصفحة حتى لا يغطّي
 *   شريط أدوات اللعبة؛ وبعد التحميل يتحوّل إلى الإرشاد ويُحضَر إلى الشاشة.
 */
export function IosDocumentsNotice({ variant = 'fixed' }: { variant?: 'fixed' | 'inline' }) {
  const pathname = usePathname();
  const [device, setDevice] = useState<AppleDevice | null>(null);
  const [mode, setMode] = useState<'hidden' | 'intro' | 'downloaded'>('hidden');
  const [downloaded, setDownloaded] = useState<string>('');
  const boxRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = detectAppleDevice();
    setDevice(d);
    if (!d) return;
    setMode(isDismissed() ? 'hidden' : 'intro');

    const onDownload = (e: Event) => {
      setDownloaded((e as CustomEvent<{ title?: string }>).detail?.title ?? '');
      setMode('downloaded');
    };
    window.addEventListener(IOS_DOWNLOAD_EVENT, onDownload);
    return () => window.removeEventListener(IOS_DOWNLOAD_EVENT, onDownload);
  }, []);

  const inline = variant === 'inline';
  const onPlayPage = Boolean(pathname?.startsWith('/play/'));

  // بعد التحميل في صفحة التشغيل: أحضر بطاقة الإرشاد (ضمن التدفّق) إلى الشاشة
  useEffect(() => {
    if (!inline || mode !== 'downloaded') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      boxRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    } catch {
      /* لا شيء */
    }
  }, [inline, mode]);

  if (!device || mode === 'hidden') return null;
  if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return null;
  // صفحة التشغيل تعرض نسختها ضمن التدفّق فقط، وبقيّة الصفحات النسخة العائمة
  if (inline !== onPlayPage) return null;

  const close = () => {
    if (mode === 'intro') {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* لا شيء */
      }
    }
    setMode('hidden');
  };

  const label = DEVICE_LABEL[device];
  const after = mode === 'downloaded';

  return (
    <aside
      ref={boxRef}
      data-ios-notice={mode}
      className={inline ? 'ios-docs-notice ios-docs-notice--inline' : 'ios-docs-notice'}
      role={after ? 'status' : 'complementary'}
      aria-live={after ? 'polite' : undefined}
      aria-label={`توصية لأجهزة ${label}: تطبيق Documents`}
    >
      <button type="button" onClick={close} className="ios-docs-close" aria-label="إغلاق التنبيه">
        <X className="h-4 w-4" aria-hidden />
      </button>

      <div className="ios-docs-head">
        <DocumentsAppIcon className="ios-docs-icon" />
        <div className="min-w-0">
          {after ? (
            <>
              <p className="ios-docs-kicker">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> تمّ حفظ اللعبة{downloaded ? `: ${downloaded}` : ''}
              </p>
              <p className="ios-docs-title">افتحها من تطبيق Documents لتعمل على {label}</p>
            </>
          ) : (
            <>
              <p className="ios-docs-kicker">لأصحاب {label}</p>
              <p className="ios-docs-title">تطبيق Documents مهم لتشغيل الألعاب على جهازك</p>
            </>
          )}
        </div>
      </div>

      <p className="ios-docs-body">
        {after
          ? 'اختر «Documents» من قائمة المشاركة، أو احفظ الملف في «الملفات» ثم افتحه من داخل تطبيق Documents. فتحه من «الملفات» مباشرة يعرضه بلا تفاعل.'
          : `سفاري على ${label} يحفظ الألعاب كملفات HTML، وتطبيق «الملفات» يعرضها بلا تفاعل. ثبّت تطبيق Documents المجاني (من ${DOCUMENTS_APP.vendor}) وافتح الألعاب المحمَّلة من داخله لتعمل كاملةً دون إنترنت.`}
      </p>

      <div className="ios-docs-actions">
        <a
          href={DOCUMENTS_APP.storeUrl(device)}
          target="_blank"
          rel="noopener noreferrer"
          className="ios-docs-store"
        >
          <Download className="h-4 w-4" aria-hidden />
          تحميل Documents لـ{label} من App Store
        </a>
        <button type="button" onClick={close} className="ios-docs-later">
          {after ? 'حسنًا' : 'لاحقًا'}
        </button>
      </div>
    </aside>
  );
}
