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
  /** معرّف مقطع يوتيوب يُضمَّن بمشغّل يوتيوب (بديل عن ملف محلي). */
  yt?: string;
  /** تسمية توضيحية تُعرض تحت الإشارة (اختياري). */
  gloss?: string;
  /** مصدر الإشارة إن لم تكن تصويرًا محليًّا (مثل "karsl") — يُنسَب في المشغّل. */
  source?: string;
}

/** أسماء مصادر القاموس الخارجية كما تُعرض للطالب. */
export const SIGN_SOURCES: Record<string, { label: string; note: string }> = {
  karsl: {
    label: 'قاعدة KArSL — جامعة الملك فهد للبترول والمعادن',
    note: 'لهجة إشارية سعودية؛ تُستبدَل بالإشارة القطرية المعتمدة عند تصويرها.',
  },
  sshi: {
    label: 'مكتبة لغة الإشارة السعودية — الجمعية السعودية للإعاقة السمعية',
    note: 'لهجة إشارية سعودية بمؤدٍّ بشري؛ تُستبدَل بالإشارة القطرية المعتمدة عند تصويرها.',
  },
  'kisr-unified': {
    label: 'القاموس الإشاري العربي الموحّد — معهد الكويت للأبحاث العلمية (يوتيوب)',
    note: 'القاموس العربي الموحّد المعتمد في قطر، يُعرض من قناة المعهد على يوتيوب.',
  },
  'kisr-kuwaiti': {
    label: 'القاموس الإشاري الكويتي — معهد الكويت للأبحاث العلمية (يوتيوب)',
    note: 'لهجة إشارية كويتية (خليجية)، يُعرض من قناة المعهد على يوتيوب.',
  },
  'kisr-preschool': {
    label: 'قاموس الأطفال الإشاري — معهد الكويت للأبحاث العلمية (يوتيوب)',
    note: 'لهجة إشارية كويتية (خليجية)، يُعرض من قناة المعهد على يوتيوب.',
  },
  menasy: {
    label: 'القاموس الإشاري العربي للصم (menasy.com) — مشروع مفتوح المصدر',
    note: 'إشارات عربية موحّدة/خليجية بصور متحرّكة، متاحة مجّانًا للاستخدام التعليمي بحسب ناشرها.',
  },
  'kisr-scout': {
    label: 'القاموس الإشاري الكشفي — معهد الكويت للأبحاث العلمية (يوتيوب)',
    note: 'لهجة إشارية كويتية (خليجية)، يُعرض من قناة المعهد على يوتيوب.',
  },
};

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
  media?: 'img' | 'video' | 'yt';
  /** عدد كلمات النصّ التي تغطّيها هذه الخطوة (2 للإشارة المركّبة من كلمتين). */
  span?: number;
  /** هل توجد إشارة موثّقة لهذا العنصر؟ */
  hasAsset: boolean;
  /** ترتيب الكلمة المصدر التي ينتمي إليها (لإبراز النصّ). */
  word: number;
  /** مصدر الإشارة الخارجي إن وُجد (مفتاح في SIGN_SOURCES). */
  source?: string;
}

// مقسّم الكلمات: حروف وأرقام **وعلامات تشكيل** (\p{M}) حتى لا تنقسم «ينفّذ» عند الشدّة.
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;
// علامات التشكيل والتطويل — تُزال قبل المطابقة والتهجئة.
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;
// نطاق الحروف العربية الأساسية.
const ARABIC = /[ء-ي]/;

function stripMarks(s: string): string {
  return s.replace(MARKS, '');
}

// الأرقام العربية المشرقية (٠–٩) تُحوَّل إلى أرقام لاتينية لمطابقة إشارات الأعداد.
const INDIC_DIGITS = /[٠-٩]/g;

/** تطبيع الكلمة للمطابقة: توحيد الهمزات والألف المقصورة والتاء المربوطة والأرقام. */
function normalizeWord(s: string): string {
  return stripMarks(s)
    .replace(INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

/**
 * يبحث عن إشارة كلمة في القاموس: المطابقة التامّة أولًا، ثم بعد نزع السوابق
 * الشائعة (واو/فاء العطف، «ال» التعريف، و«بال/لل/كال»). محافظ عن قصد: لا يُنزع
 * حرف جرّ وحده (كي لا تتحوّل «باب» إلى «أب»).
 */
function lookupWord(m: SignManifest | null, raw: string): SignEntry | undefined {
  const words = m?.words;
  if (!words) return undefined;
  const has = (k: string) => {
    const e = words[k];
    return e && (e.img || e.video || e.yt) ? e : undefined;
  };
  const n = normalizeWord(raw);
  const candidates = [n];
  const conj = n.replace(/^[وف](?=.{3,})/, '');
  if (conj !== n) candidates.push(conj);
  for (const base of [...candidates]) {
    const noAl = base.replace(/^(ال|لل|بال|كال|فال|وال)(?=.{2,})/, '');
    if (noAl !== base) candidates.push(noAl);
  }
  // عبارة من كلمتين: مفاتيح الإشارات المركّبة مخزّنة بلا «ال» في كل كلمة.
  if (n.includes(' ')) {
    const bare = n
      .split(' ')
      .map((p) => p.replace(/^(ال|لل|بال|كال|فال|وال)(?=.{2,})/, '').replace(/^[وف](?=.{3,})/, ''))
      .join(' ');
    if (!candidates.includes(bare)) candidates.push(bare);
  }
  for (const c of candidates) {
    const e = has(c);
    if (e) return e;
  }
  return undefined;
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
  const src = entry?.yt ? entry.yt : assetUrl(entry?.video || entry?.img);
  return {
    kind,
    glyph,
    gloss,
    word,
    src,
    media: entry?.yt ? 'yt' : entry?.video ? 'video' : entry?.img ? 'img' : undefined,
    hasAsset: !!src,
    source: src ? entry?.source : undefined,
  };
}

/**
 * يبني تسلسل الإشارات من نصّ حرّ. آمن مع النصّ الفارغ أو غياب القاموس:
 * يعود بخطوات نصّية واضحة تُعرَض حرفًا حرفًا حتى تُضاف الأصول الموثّقة.
 */
export function buildSequence(text: string, m: SignManifest | null): SignStep[] {
  const steps: SignStep[] = [];
  const words = (text || '').match(WORD_RE) || [];
  let skip = 0;
  words.forEach((w, wi) => {
    if (skip > 0) {
      skip--;
      return;
    }
    // إشارة مركّبة من كلمتين (مثل «هيكل عظمي» أو «درجة الحرارة») تُفضَّل على الكلمة المفردة.
    const nextW = words[wi + 1];
    if (nextW) {
      const pair = lookupWord(m, `${w} ${nextW}`);
      if (pair) {
        steps.push({
          ...makeStep('word', `${w} ${nextW}`, pair.gloss || `${w} ${nextW}`, wi, pair),
          span: 2,
        });
        skip = 1;
        return;
      }
    }
    const wordEntry = lookupWord(m, w);
    if (wordEntry) {
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
  return (text || '').match(WORD_RE) || [];
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
