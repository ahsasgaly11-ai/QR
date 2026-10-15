// ---------------------------------------------------------------------------
// أجهزة Apple المحمولة (iPhone / iPad) وتطبيق Documents.
//
// سفاري على iOS يحفظ ملف اللعبة (HTML) في تطبيق «الملفات»، لكن فتحه من هناك
// يعرضه بمعاينة سريعة بلا JavaScript فلا تعمل اللعبة. تطبيق Documents
// (من Readdle، مجاني) فيه متصفّح داخلي يشغّل ملفات HTML المحفوظة كاملةً،
// لذا نوصي به أصحاب iPhone وiPad ونوجّه إليه عند التحميل.
// ---------------------------------------------------------------------------

export type AppleDevice = 'iphone' | 'ipad';

/** معرّف التطبيق في App Store (Documents - File Manager, Readdle). */
const DOCUMENTS_APP_ID = '364901807';

export const DOCUMENTS_APP = {
  name: 'Documents',
  vendor: 'Readdle',
  /** رابط المتجر بحسب الجهاز: صفحة App Store تعرض لقطات الجهاز نفسه. */
  storeUrl(device: AppleDevice): string {
    return `https://apps.apple.com/app/documents-file-manager-docs/id${DOCUMENTS_APP_ID}?platform=${device}`;
  },
} as const;

/** حدث يُطلق بعد تنزيل/مشاركة لعبة على جهاز Apple ليُعرض إرشاد الفتح. */
export const IOS_DOWNLOAD_EVENT = 'qa-ios-download';

/**
 * يكشف iPhone وiPad (iPadOS 13+ يقدّم نفسه كـMac، فنفرّقه بشاشة اللمس).
 * يعود null على بقيّة الأجهزة وعلى الخادم.
 */
export function detectAppleDevice(): AppleDevice | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  if (/iPad/i.test(ua)) return 'ipad';
  // iPadOS 13+ بوضع «سطح المكتب» (الافتراضي في سفاري على iPad): يقدّم نفسه
  // كـMac، والفارق الوحيد شاشة اللمس — أجهزة Mac لا تعلن عن أي نقطة لمس.
  if (/Macintosh/i.test(ua)) {
    const touch =
      (navigator.maxTouchPoints ?? 0) > 0 ||
      (typeof document !== 'undefined' && 'ontouchend' in document);
    if (touch) return 'ipad';
  }
  return null;
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/**
 * يعرض قائمة المشاركة في iOS ومعها ملف اللعبة: منها يختار المستخدم تطبيق
 * Documents مباشرةً (أو «حفظ في الملفات»). يعود `unsupported` إن لم يدعم
 * المتصفّح مشاركة الملفات أو رفضها، فيتولّى المستدعي التنزيل العادي.
 */
export async function shareHtmlFile(
  html: string,
  filename: string,
  title: string
): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  let file: File;
  try {
    file = new File([html], filename, { type: 'text/html' });
  } catch {
    return 'unsupported';
  }
  const data: ShareData = { files: [file], title };
  if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
    return 'unsupported';
  }
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    return name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** يعلن للصفحة أن لعبة نُزّلت على جهاز Apple (لإظهار إرشاد فتحها). */
export function announceIosDownload(title: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(IOS_DOWNLOAD_EVENT, { detail: { title } }));
  } catch {
    /* لا شيء */
  }
}
