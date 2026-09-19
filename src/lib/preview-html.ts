// ---------------------------------------------------------------------------
// نسخة معاينة خفيفة من ملف اللعبة.
//
// ألعاب المنصّة تُضمَّن فيها الموسيقى والمؤثرات والصور بصيغة Base64، فيصل
// حجم الملف الواحد إلى 10 ميجابايت. تحميل هذا كلّه داخل بطاقة الدرس مجرّد
// «صورة» للّعبة مكلفة جدًا: صفحة فيها ثلاث ألعاب تعني 25 ميجابايت.
//
// لذا نبني نسخة مخفَّفة تحتفظ بالشكل والتخطيط وتتخلّى عن الوسائط الثقيلة،
// فتُحفَظ في وثيقة واحدة وتُقرأ بقراءة واحدة سريعة.
// ---------------------------------------------------------------------------

// أقصى حجم لوثيقة المعاينة. الحدّ ليس حدّ Firestore (1 م.ب) بل سرعة
// التحميل: صفحة درس فيها عشر بطاقات تعني عشرة أضعاف هذا الرقم على
// شبكة الجوال، فكلّما صغر كان فتح الصفحة أسرع.
const MAX_PREVIEW_BYTES = 260_000;

/** الحدّ الأقصى المطلق — دون حدّ وثيقة Firestore (1 م.ب) بهامش أمان. */
const MAX_DOC_BYTES = 850_000;

/** مقطع صوتي صامت صالح، يحلّ محلّ الموسيقى فلا ينكسر كود التشغيل. */
const SILENT_AUDIO =
  'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tAAA=';

/**
 * بكسل شفّاف تمامًا (0,0,0,0)، يحلّ محلّ الصور الضخمة.
 * وُلِّد وتُحقّق من قيمته بدل نسخه: النسخة الشائعة المتداولة أخضر نصف
 * شفّاف (0,255,0,127)، فكانت كل صورة مستبدَلة تظهر مستطيلًا أخضر.
 */
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==';

const MEDIA_RE = /data:(?:audio|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const IMAGE_RE = /data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/gi;

/**
 * نصّ Base64 طويل داخل علامتَي اقتباس في كود JavaScript.
 *
 * كثير من الألعاب لا تضع الموسيقى في وسم HTML بل في متغيّر:
 *   const MUSIC_B64 = "SUQzBAAA…";  ثم  audio.src = "data:audio/mp3;base64," + MUSIC_B64
 * فلا يلتقطها البحث عن data: لأن البادئة مفصولة عن الحمولة. وهذه الحمولة
 * وحدها قد تبلغ مليونَي حرف — أي كامل ثقل الملف.
 */
const B64_LITERAL_RE = /(["'`])([A-Za-z0-9+/=]{3000,})\1/g;

/** بديل صالح كصورة (شفّاف)، ويفشل بهدوء إن كان الأصل صوتًا. */
const TINY_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==';

/**
 * نسخة مولّد المعاينة. تُحفَظ مع كل معاينة، فإن تغيّر المولّد عرفت اللوحة
 * أي المعاينات بُنيت بنسخة قديمة وتحتاج إعادة توليد.
 */
export const PREVIEW_VERSION = 2;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * يبني نسخة معاينة من ملف اللعبة، أو `null` إن تعذّر تصغيرها بما يكفي.
 * لا يُعدَّل الملف الأصلي إطلاقًا — هذه نسخة منفصلة للعرض فقط.
 */
export function makePreviewHtml(html: string): string | null {
  // 1) الصوت والفيديو المكتوبان بصيغة data: كاملة
  let out = html.replace(MEDIA_RE, SILENT_AUDIO);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 2) حمولات Base64 الطويلة داخل كود JavaScript — غالبًا هي الأثقل
  out = out.replace(B64_LITERAL_RE, (_m, q: string) => `${q}${TINY_B64}${q}`);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 3) الصور الكبيرة فقط — نُبقي الصغيرة لأنها غالبًا أيقونات تصنع الشكل
  out = out.replace(IMAGE_RE, (m, payload: string) =>
    payload.length > 12_000 ? BLANK_PNG : m
  );
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 4) كل الصور
  out = out.replace(IMAGE_RE, BLANK_PNG);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 5) تجاوزنا الحجم المفضَّل لكنه ما زال دون حدّ الوثيقة: معاينة أبطأ
  //    قليلًا خير من بطاقة فارغة، فنقبلها بدل التخلّي عنها.
  if (bytes(out) <= MAX_DOC_BYTES) return out;

  return null;
}

/**
 * بصمة البكسل الأخضر الذي استُخدم بالخطأ في النسخة الأولى من المولّد.
 * معاينات بُنيت بها ما زالت محفوظة، فنُصلحها لحظة العرض بدل انتظار إعادة
 * توليدها — فيرى الطالب صورة سليمة فورًا دون أي إجراء من المشرف.
 */
const LEGACY_GREEN = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** يستبدل البكسل الأخضر القديم بالشفّاف في معاينة محفوظة سابقًا. */
export function repairLegacyPreview(html: string): string {
  return html.includes(LEGACY_GREEN)
    ? html.split(LEGACY_GREEN).join(TINY_B64)
    : html;
}
