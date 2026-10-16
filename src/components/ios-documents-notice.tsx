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

/**
 * لا يستطيع سفاري معرفة التطبيقات المثبّتة على الجهاز، لذا يؤكّد المستخدم
 * بنفسه أنه ثبّت Documents؛ عندها فقط تتوقّف التوصية نهائيًا. أمّا «لاحقًا»
 * والإغلاق فيخفيانها حتى الدخول التالي إلى الصفحة الرئيسية.
 */
const INSTALLED_KEY = 'qa-ios-docs-installed';
/** مفتاح الإصدار السابق (إخفاء أسبوعين) — يُحذف حتى لا يحجب التوصية. */
const LEGACY_DISMISS_KEY = 'qa-ios-docs-dismissed';

/** الصفحات التي لا يظهر فيها إرشاد ما بعد التحميل (لا ألعاب فيها). */
const SKIP_PREFIXES = ['/admin', '/dashboard', '/heatmap', '/privacy', '/accessibility'];

/**
 * التوصية العامة تظهر في الصفحة الرئيسية وحدها، وبعد أن يمكث فيها الزائر
 * هذه المدّة، فلا تقاطع التنقّل بين الأقسام ولا تزاحم الألعاب.
 */
const HOME_PATH = '/';
const INTRO_DELAY_MS = 8000;

function isInstalled(): boolean {
  try {
    localStorage.removeItem(LEGACY_DISMISS_KEY);
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function markInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* لا شيء */
  }
}

const DEVICE_LABEL: Record<AppleDevice, string> = { iphone: 'iPhone', ipad: 'iPad' };

/**
 * إشعار لأصحاب iPhone وiPad فقط: سفاري يحفظ اللعبة كملف HTML ولا يشغّلها
 * من تطبيق «الملفات»، فنوصي بتطبيق Documents (مجاني) الذي يشغّلها كاملةً.
 * يظهر بوضعين:
 * - توصية عامة: في الصفحة الرئيسية فقط، بعد مهلة من دخولها، وفي كل زيارة لها
 *   ما لم يؤكّد المستخدم أنه ثبّت التطبيق.
 * - إرشاد فوري بعد كل تحميل لعبة (في أي صفحة فيها ألعاب).
 *
 * - `fixed` (في التخطيط العام): بطاقة عائمة أسفل الشاشة.
 * - `inline` (في صفحة التشغيل تحت المشغّل): لإرشاد ما بعد التحميل فقط، ضمن
 *   تدفّق الصفحة حتى لا يغطّي شريط أدوات اللعبة، ويُحضَر إلى الشاشة.
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

    const onDownload = (e: Event) => {
      setDownloaded((e as CustomEvent<{ title?: string }>).detail?.title ?? '');
      setMode('downloaded');
    };
    window.addEventListener(IOS_DOWNLOAD_EVENT, onDownload);
    return () => window.removeEventListener(IOS_DOWNLOAD_EVENT, onDownload);
  }, []);

  // التوصية: في الصفحة الرئيسية فقط وبعد مهلة. أي تنقّل يُخفي الإشعار المفتوح
  // ويُلغي المهلة، فلا يلاحق الزائر بين الأقسام.
  useEffect(() => {
    if (!device) return;
    setMode('hidden');
    if (variant !== 'fixed' || pathname !== HOME_PATH || isInstalled()) return;
    const t = window.setTimeout(() => {
      setMode((m) => (m === 'hidden' ? 'intro' : m));
    }, INTRO_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [device, pathname, variant]);

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

  const close = () => setMode('hidden');
  const installed = () => {
    markInstalled();
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
      {!after && (
        <button type="button" onClick={installed} className="ios-docs-installed">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> ثبّتُّ التطبيق بالفعل — لا تُظهر هذا مجدّدًا
        </button>
      )}
    </aside>
  );
}
