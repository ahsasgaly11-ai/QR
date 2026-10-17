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
 * بقية الحمولات المضمَّنة التي ليست صورًا ولا صوتًا: نماذج ثلاثية الأبعاد
 * (model/gltf-binary، application/octet-stream)، ملفات JSON/ZIP، الخطوط…
 * ألعاب 3D تُضمِّن نموذج GLB كاملًا بهذه الصيغة فيبقى الملف ميجابايتات
 * بعد حذف الصوت والصور، فكانت المعاينة تُرفض وتبقى البطاقة بلا صورة.
 * الخطوط مستثناة هنا وتُعالَج في خطوة لاحقة لأنها تصنع شكل النص.
 */
const BLOB_RE =
  /data:(?!image\/|audio\/|video\/|font\/|application\/(?:x-)?font)[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{2000,}/gi;
const FONT_RE =
  /data:(?:font\/|application\/(?:x-)?font)[a-z0-9.+-]*;base64,[A-Za-z0-9+/=]{2000,}/gi;

/**
 * نصّ Base64 طويل داخل علامتَي اقتباس في كود JavaScript.
 *
 * كثير من الألعاب لا تضع الموسيقى في وسم HTML بل في متغيّر:
 *   const MUSIC_B64 = "SUQzBAAA…";  ثم  audio.src = "data:audio/mp3;base64," + MUSIC_B64
 * فلا يلتقطها البحث عن data: لأن البادئة مفصولة عن الحمولة. وهذه الحمولة
 * وحدها قد تبلغ مليونَي حرف — أي كامل ثقل الملف.
 */
const B64_LITERAL_RE = /(["'`])([A-Za-z0-9+/=]{3000,})\1/g;

/**
 * الحمولة نفسها داخل نصّ مهرَّب، أي كود محفوظ هو نفسه داخل نصّ:
 *   window.__A={music:\"SUQz…\"}   (العروض المجمَّعة تحفظ أصولها هكذا)
 */
const B64_ESCAPED_RE = /(\\["'])([A-Za-z0-9+/=]{3000,})\1/g;

/**
 * مستند HTML كامل محفوظ كنصّ داخل الكود — العروض التقديمية تُضمِّن ألعابها
 * هكذا:  window.__GAMES={"hospital":"<!DOCTYPE html>…"}  ولا تُشغَّل إلا عند
 * فتح شريحتها، فلا مكان لها في معاينة الشريحة الأولى. تُستبدل بنصّ فارغ.
 */
const EMBEDDED_DOC_RE = /(["'])(?:<!DOCTYPE|<html)(?:[^"'\\]|\\[\s\S]|(?!\1)["'])*\1/gi;
const EMBEDDED_DOC_MIN = 20_000;

/** بديل صالح كصورة (شفّاف)، ويفشل بهدوء إن كان الأصل صوتًا. */
const TINY_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==';

/**
 * نسخة مولّد المعاينة. تُحفَظ مع كل معاينة، فإن تغيّر المولّد عرفت اللوحة
 * أي المعاينات بُنيت بنسخة قديمة وتحتاج إعادة توليد.
 */
export const PREVIEW_VERSION = 4;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * يبني نسخة معاينة من ملف اللعبة، أو `null` إن تعذّر تصغيرها بما يكفي.
 * لا يُعدَّل الملف الأصلي إطلاقًا — هذه نسخة منفصلة للعرض فقط.
 *
 * `maxBytes`: الحدّ الذي تُرفض فوقه المعاينة. `Infinity` تعني «خفّف قدر
 * الإمكان وأعد النتيجة أيًّا كان حجمها» (للضغط أو للعرض المحلي).
 */
export function makePreviewHtml(
  html: string,
  maxBytes: number = MAX_DOC_BYTES
): string | null {
  // 1) الصوت والفيديو المكتوبان بصيغة data: كاملة
  let out = html.replace(MEDIA_RE, SILENT_AUDIO);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 1ب) النماذج ثلاثية الأبعاد وبقية الحمولات الثنائية المضمَّنة
  out = out.replace(BLOB_RE, `data:application/octet-stream;base64,${TINY_B64}`);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 2) حمولات Base64 الطويلة داخل كود JavaScript — غالبًا هي الأثقل
  out = out.replace(B64_LITERAL_RE, (_m, q: string) => `${q}${TINY_B64}${q}`);
  out = out.replace(B64_ESCAPED_RE, (_m, q: string) => `${q}${TINY_B64}${q}`);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 2ب) الألعاب والمستندات المضمَّنة كنصوص (لا تظهر في الشريحة الأولى)
  out = out.replace(EMBEDDED_DOC_RE, (m, q: string) => (m.length >= EMBEDDED_DOC_MIN ? `${q}${q}` : m));
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 3) الصور الكبيرة فقط — نُبقي الصغيرة لأنها غالبًا أيقونات تصنع الشكل
  out = out.replace(IMAGE_RE, (m, payload: string) =>
    payload.length > 12_000 ? BLANK_PNG : m
  );
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 4) كل الصور
  out = out.replace(IMAGE_RE, BLANK_PNG);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 5) الخطوط المضمَّنة — يعود النص إلى خط النظام، والتخطيط يبقى
  out = out.replace(FONT_RE, `data:font/woff2;base64,${TINY_B64}`);
  if (bytes(out) <= MAX_PREVIEW_BYTES) return out;

  // 6) تجاوزنا الحجم المفضَّل: معاينة أبطأ قليلًا خير من بطاقة فارغة،
  //    فنقبلها ما دامت دون الحدّ المطلوب.
  if (bytes(out) <= maxBytes) return out;

  return null;
}

/** حدّ وثيقة المعاينة في Firestore (يُستخدَم لتقرير الضغط). */
export const PREVIEW_DOC_BYTES = MAX_DOC_BYTES;

// ---------------------------------------------------------------------------
// ضمان المعاينة: سلسلة بدائل تنتهي ببديل يتّسع دائمًا.
//
// قد تبقى المعاينة الخفيفة فوق حدّ الوثيقة حتى مضغوطةً: العروض والألعاب
// تُضمِّن مكتبات 3D كاملة (three.js بنسختيها، مختبرات WebGPU…) وهي كود لا
// وسائط. فبدل ترك البطاقة بلا صورة نجرّب بالترتيب:
//   ١. المعاينة الخفيفة كما هي
//   ٢. بلا المكتبات الضخمة (+200 ك.ب ثم +60 ك.ب): الشاشة الأولى في العروض
//      المحوَّلة من البوربوينت HTML وCSS ثابتان، فتبقى مطابقة لشكلها
//   ٣. صورة الشريحة الأولى (أو أكبر صورة في الملف) بملء البطاقة
//   ٤. بطاقة بعنوان الملف — بضعة كيلوبايتات، فتتّسع دائمًا
// ---------------------------------------------------------------------------

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

/** يحذف وسوم السكربت الأكبر من `minChars` ويُبقي الصغيرة (المحرّك والتهيئة). */
function dropBigScripts(html: string, minChars: number): string {
  return html.replace(SCRIPT_RE, (m) => (m.length > minChars ? '' : m));
}

const IMAGE_URI_RE = /data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+/gi;
/** أكبر حجم لصورة البديل — يبقى دون حدّ الوثيقة بهامش. */
const MAX_POSTER_CHARS = 700_000;

/**
 * صورة تمثّل الملف: مصغّرة الشريحة الأولى إن وُجدت (العروض المحوَّلة تحفظ
 * صور الشرائح الأصلية باسم thumbs/t1)، وإلا أكبر صورة تتّسع.
 */
function posterImage(html: string): string | null {
  const t1 = html.search(/thumbs\/t1\.[a-z]+/i);
  if (t1 >= 0) {
    IMAGE_URI_RE.lastIndex = t1;
    const m = IMAGE_URI_RE.exec(html);
    IMAGE_URI_RE.lastIndex = 0;
    if (m && m.index - t1 < 400 && m[0].length <= MAX_POSTER_CHARS) return m[0];
  }
  let best: string | null = null;
  for (const m of html.matchAll(IMAGE_URI_RE)) {
    const len = m[0].length;
    if (len > 4_000 && len <= MAX_POSTER_CHARS && len > (best?.length ?? 0)) best = m[0];
  }
  return best;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** عنوان الملف كما كتبه صاحبه: <title> ثم أول <h1>. */
function documentTitle(html: string): string {
  const pick = (re: RegExp) =>
    (re.exec(html)?.[1] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
}

function posterPreview(img: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#140c10}body{display:flex;align-items:center;justify-content:center}img{width:100%;height:100%;object-fit:contain}</style></head><body><img src="${img}" alt=""></body></html>`;
}

function titlePreview(title: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden}body{display:flex;align-items:center;justify-content:center;padding:8%;box-sizing:border-box;background:radial-gradient(120% 120% at 80% 0%,#b5552b 0%,#6a0f2e 55%,#231a17 100%);color:#fff;font-family:system-ui,"Segoe UI",Tahoma,sans-serif;text-align:center}h1{margin:0;font-size:64px;line-height:1.45;font-weight:800;text-shadow:0 6px 24px rgba(0,0,0,.35)}</style></head><body><h1>${escapeHtml(title.slice(0, 120) || 'عرض تفاعلي')}</h1></body></html>`;
}

/**
 * هل يبقى في الصفحة ما يُرى بلا سكربتات؟ الألعاب التي تبني واجهتها كلّها
 * بالكود تصبح صفحة فارغة إن حُذفت مكتباتها، والبطاقة الفارغة لا تفيد.
 */
function hasStaticContent(html: string): boolean {
  const body = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
  if (/<(img|svg|video|picture)\b/i.test(body)) return true;
  const text = body.replace(/<head\b[\s\S]*?<\/head>/i, '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return text.replace(/\s+/g, '').length >= 20;
}

/** بدائل المعاينة بالترتيب، من الأقرب إلى شكل الملف إلى الأصغر حجمًا. */
export function* previewCandidates(html: string): Generator<string> {
  const light = makePreviewHtml(html, Infinity);
  if (light) {
    yield light;
    const noLibs = dropBigScripts(light, 200_000);
    if (noLibs !== light && hasStaticContent(noLibs)) yield noLibs;
    const noBig = dropBigScripts(noLibs, 60_000);
    if (noBig !== noLibs && hasStaticContent(noBig)) yield noBig;
  }
  const img = posterImage(html);
  if (img) yield posterPreview(img);
  yield titlePreview(documentTitle(html));
}

export type StoredPreview = { s: string } | { z: Uint8Array };

/**
 * أول بديل يتّسع في وثيقة واحدة: نصًّا عاديًا، أو مضغوطًا (الكود ينضغط إلى
 * نحو الربع). البديل الأخير بضعة كيلوبايتات فلا تعود الدالة فارغة إلا إن
 * تعذّر الضغط والعنوان معًا — وهو لا يحدث عمليًا.
 */
export async function pickPreview(
  html: string,
  gzip: (s: string) => Promise<Uint8Array | null>
): Promise<StoredPreview | null> {
  for (const candidate of previewCandidates(html)) {
    if (bytes(candidate) <= MAX_DOC_BYTES) return { s: candidate };
    const z = await gzip(candidate);
    if (z && z.byteLength <= MAX_DOC_BYTES) return { z };
  }
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
