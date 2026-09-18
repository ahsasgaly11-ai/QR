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

/** أقصى حجم لوثيقة المعاينة — دون حدّ Firestore (1 م.ب) بهامش أمان. */
const MAX_PREVIEW_BYTES = 700_000;

/** مقطع صوتي صامت صالح، يحلّ محلّ الموسيقى فلا ينكسر كود التشغيل. */
const SILENT_AUDIO =
  'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tAAA=';

/** بكسل شفّاف، يحلّ محلّ الصور الضخمة. */
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const MEDIA_RE = /data:(?:audio|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const IMAGE_RE = /data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/gi;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * يبني نسخة معاينة من ملف اللعبة، أو `null` إن تعذّر تصغيرها بما يكفي.
 * لا يُعدَّل الملف الأصلي إطلاقًا — هذه نسخة منفصلة للعرض فقط.
 */
export function makePreviewHtml(html: string): string | null {
  // 1) الصوت والفيديو: الأثقل دائمًا، ولا معنى لهما في صورة ساكنة
  let out = html.replace(MEDIA_RE, SILENT_AUDIO);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 2) الصور الكبيرة فقط — نُبقي الصغيرة لأنها غالبًا أيقونات تصنع الشكل
  out = out.replace(IMAGE_RE, (m, payload: string) =>
    payload.length > 40_000 ? BLANK_PNG : m
  );
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 3) كل الصور
  out = out.replace(IMAGE_RE, BLANK_PNG);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 4) ما زال كبيرًا: معاينة مشوّهة أسوأ من لا معاينة
  return null;
}
