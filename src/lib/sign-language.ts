// ---------------------------------------------------------------------------
// لغة الإشارة القطرية — تفضيل دائم + حلّ مصدر المقطع
//
// الفكرة: يصبح دعم لغة الإشارة خيارًا متاحًا تلقائيًا على كل نشاط بمجرد
// إضافته، ويمكن لمن يحتاجه (الطلبة الصمّ وضعاف السمع) تفعيله مرّة واحدة من
// لوحة إمكانية الوصول فيبقى مُفعَّلًا في كل المنصّة. عند التفعيل يظهر رفيق
// لغة الإشارة تلقائيًا في مشغّل كل نشاط دون البحث عنه في كل مرّة.
//
//   data-signlang = on | off     (يُحفظ في localStorage: qa-a11y-signlang)
// ---------------------------------------------------------------------------

export const SIGN_LANG_STORE = 'qa-a11y-signlang';
export const SIGN_LANG_ATTR = 'signlang'; // ⇒ data-signlang على <html>
export const SIGN_LANG_DEFAULT = 'off';

/**
 * رابط مقطع لغة الإشارة القطرية العام (اختياري). عند ضبطه يُعرض على أي نشاط
 * لا يملك مقطعًا خاصًّا به، فيبقى الخيار فعّالًا على كل الأنشطة تلقائيًا حتى
 * قبل أن تُرفق الوزارة مقطعًا مخصّصًا لكل نشاط. يقبل رابط mp4 أو يوتيوب/فيميو.
 */
export const DEFAULT_SIGN_LANGUAGE_URL =
  process.env.NEXT_PUBLIC_SIGN_LANGUAGE_URL?.trim() || '';

/**
 * يحلّ مصدر لغة الإشارة لنشاط: المقطع الخاصّ بالنشاط أولًا، ثم المقطع العام.
 * تُعيد undefined عند غياب الاثنين (فتظهر رسالة «لم يُضَف بعد»).
 */
export function resolveSignLanguageSrc(src?: string): string | undefined {
  const own = src?.trim();
  if (own) return own;
  return DEFAULT_SIGN_LANGUAGE_URL || undefined;
}

/** هل فعّل الزائر دعم لغة الإشارة من لوحة الوصول؟ */
export function isSignLanguageOn(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.getAttribute(`data-${SIGN_LANG_ATTR}`) === 'on'
  );
}
