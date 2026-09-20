// ---------------------------------------------------------------------------
// محرّك الترجمة الإشارية التلقائي
//
// يحوّل نصّ النشاط (العنوان + الوصف + أي نصّ يحدّده الطالب) إلى تسلسل إشارات
// يُعرَض إشارة إشارة. المنطق:
//   1) لكل كلمة: إن توفّرت إشارة موثّقة لها في القاموس تُعرض إشارةً واحدة.
//   2) وإلا تُهجّى الكلمة حرفًا حرفًا من إشارات الأبجدية الإشارية العربية.
//   3) وما لا تتوفّر له إشارة موثّقة (بعد) يُعرَض نصًّا واضحًا — دون تلفيق يد.
//
// كل الإشارات تُحمَّل من قاموس أصول موثّق (public/sign/manifest.json) تُزوّده
// الجهة المختصّة (مثل مركز مدى). فبمجرّد إضافة الأصول يعمل العرض البصري فورًا،
// ويبقى المحرّك تلقائيًّا يتعرّف على كل نشاط دون أي إعداد لكل نشاط على حدة.
// ---------------------------------------------------------------------------

export interface SignEntry {
  /** مسار صورة الإشارة (نسبيّ إلى /sign/ أو رابط مطلق). */
  img?: string;
  /** مسار مقطع الإشارة (نسبيّ إلى /sign/ أو رابط مطلق). */
  video?: string;
  /** تسمية توضيحية تُعرض تحت الإشارة (اختياري). */
  gloss?: string;
}

export interface SignManifest {
  version?: number;
  /** إشارات مستوى الكلمة: المفتاح كلمة عربية مُطبَّعة. */
  words?: Record<string, SignEntry>;
  /** إشارات الأبجدية الإشارية: المفتاح حرف عربي. */
  letters?: Record<string, SignEntry>;
}

export type SignKind = 'word' | 'letter' | 'raw';

export interface SignStep {
  kind: SignKind;
  /** الرمز المعروض نصًّا (بالأصل كما كتبه المؤلّف). */
  glyph: string;
  /** التسمية أسفل الإشارة. */
  gloss: string;
  /** رابط أصل الإشارة إن توفّر. */
  src?: string;
  media?: 'img' | 'video';
  /** هل توجد إشارة موثّقة لهذا العنصر؟ */
  hasAsset: boolean;
  /** ترتيب الكلمة المصدر التي ينتمي إليها (لإبراز النصّ). */
  word: number;
}

// علامات التشكيل والتطويل — تُزال قبل المطابقة والتهجئة.
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;
// نطاق الحروف العربية الأساسية.
const ARABIC = /[ء-ي]/;

function stripMarks(s: string): string {
  return s.replace(MARKS, '');
}

/** تطبيع الكلمة للمطابقة: توحيد الهمزات والألف المقصورة والتاء المربوطة. */
function normalizeWord(s: string): string {
  return stripMarks(s)
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  return `/sign/${path.replace(/^\.?\//, '')}`;
}

function makeStep(
  kind: SignKind,
  glyph: string,
  gloss: string,
  word: number,
  entry?: SignEntry
): SignStep {
  const src = assetUrl(entry?.video || entry?.img);
  return {
    kind,
    glyph,
    gloss,
    word,
    src,
    media: entry?.video ? 'video' : entry?.img ? 'img' : undefined,
    hasAsset: !!src,
  };
}

/**
 * يبني تسلسل الإشارات من نصّ حرّ. آمن مع النصّ الفارغ أو غياب القاموس:
 * يعود بخطوات نصّية واضحة تُعرَض حرفًا حرفًا حتى تُضاف الأصول الموثّقة.
 */
export function buildSequence(text: string, m: SignManifest | null): SignStep[] {
  const steps: SignStep[] = [];
  const words = (text || '').match(/[\p{L}\p{N}]+/gu) || [];
  words.forEach((w, wi) => {
    const wordEntry = m?.words?.[normalizeWord(w)];
    if (wordEntry && (wordEntry.img || wordEntry.video)) {
      steps.push(makeStep('word', w, wordEntry.gloss || w, wi, wordEntry));
      return;
    }
    const bare = stripMarks(w);
    if (!ARABIC.test(bare)) {
      // أرقام أو حروف لاتينية — تُعرَض نصًّا كما هي.
      steps.push(makeStep('raw', w, w, wi));
      return;
    }
    for (const ch of Array.from(bare)) {
      if (!ARABIC.test(ch)) {
        steps.push(makeStep('raw', ch, ch, wi));
        continue;
      }
      const entry = m?.letters?.[ch] || m?.letters?.[normalizeWord(ch)];
      steps.push(makeStep('letter', ch, ch, wi, entry));
    }
  });
  return steps;
}

/** الكلمات المصدر (لإبراز النصّ المقروء أثناء العرض). */
export function sourceWords(text: string): string[] {
  return (text || '').match(/[\p{L}\p{N}]+/gu) || [];
}

// تحميل القاموس مرّة واحدة وتخزينه. غياب الملف لا يكسر المحرّك.
let cache: SignManifest | null | undefined;
let inflight: Promise<SignManifest | null> | null = null;

export async function loadSignManifest(): Promise<SignManifest | null> {
  if (cache !== undefined) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/sign/manifest.json', { cache: 'force-cache' });
      cache = res.ok ? ((await res.json()) as SignManifest) : null;
    } catch {
      cache = null;
    }
    inflight = null;
    return cache ?? null;
  })();
  return inflight;
}
