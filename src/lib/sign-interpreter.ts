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
  /** للمقطع حركة مستخلصة سليمة يؤدّيها المترجم ثلاثي الأبعاد */
  pose?: number;
  /** ملف حركة مستقلّ بلا مقطع مصدر (مسار داخل /sign/)، مثل أشكال حروف ASLAD */
  motion?: string;
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
  aslad: {
    label: 'شكل اليد من قاعدة ASLAD-190K (CC BY 4.0)',
    note: 'شكل يد إجماعي محسوب من آلاف الصور لكل حرف في الأبجدية الإشارية العربية.',
  },
  menasy: {
    label: 'القاموس الإشاري العربي للصم (menasy.com)',
    note: 'إشارات عربية موحّدة/خليجية، متاحة مجّانًا للاستخدام التعليمي والشخصي بحسب ناشرها.',
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
  /** رابط ملف الحركة المستقلّ (يتقدّم على حركة المقطع). */
  motion?: string;
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
export interface SequenceOptions {
  /**
   * المترجم الموحّد: لا تُعدّ الكلمة «موجودة» إلا إذا كان لها مقطع محلي يملك
   * حركة مستخلصة يؤدّيها المترجم ثلاثي الأبعاد؛ ما عداه (تضمين يوتيوب، صور)
   * يُهجّى حرفًا حرفًا بالشخصية نفسها — شخصية واحدة لكل النصّ.
   */
  avatarOnly?: boolean;
}

function lookupWord(m: SignManifest | null, raw: string, opts?: SequenceOptions): SignEntry | undefined {
  const words = m?.words;
  if (!words) return undefined;
  const has = (k: string) => {
    const e = words[k];
    if (!e) return undefined;
    if (opts?.avatarOnly) return (e.video && e.pose) || e.motion ? e : undefined;
    return e.img || e.video || e.yt ? e : undefined;
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
  // جذع الكلمة: نزع لواحق الجمع والضمائر الشائعة (الطلاب ← طالب لا، لكن «العضلات»
  // ← «عضله»، «معلمون» ← «معلم»، «كتابه» ← «كتاب») — محافظ: يبقى 3 أحرف فأكثر.
  if (!n.includes(' ')) {
    const bases = new Set(candidates);
    for (const base of bases) {
      for (const [suf, rep] of SUFFIXES) {
        if (base.length - suf.length >= 3 && base.endsWith(suf)) {
          const e = has(base.slice(0, base.length - suf.length) + rep);
          if (e) return e;
        }
      }
    }
  }
  return undefined;
}

// [اللاحقة، البديل]: ترتيب من الأطول إلى الأقصر
const SUFFIXES: [string, string][] = [
  ['اتها', 'ه'],
  ['اته', 'ه'],
  ['ات', 'ه'],
  ['ات', ''],
  ['ون', ''],
  ['ين', ''],
  ['ان', ''],
  ['تان', 'ه'],
  ['تين', 'ه'],
  ['هما', ''],
  ['هم', ''],
  ['ها', ''],
  ['نا', ''],
  ['كم', ''],
  ['ه', ''],
  ['ي', ''],
  ['ك', ''],
];

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
  const motion = assetUrl(entry?.motion);
  return {
    kind,
    glyph,
    gloss,
    word,
    src,
    media: entry?.yt ? 'yt' : entry?.video ? 'video' : entry?.img ? 'img' : undefined,
    hasAsset: !!src || !!motion,
    source: src || motion ? entry?.source : undefined,
    ...(motion ? { motion } : {}),
  };
}

/**
 * يبني تسلسل الإشارات من نصّ حرّ. آمن مع النصّ الفارغ أو غياب القاموس:
 * يعود بخطوات نصّية واضحة تُعرَض حرفًا حرفًا حتى تُضاف الأصول الموثّقة.
 */
export function buildSequence(text: string, m: SignManifest | null, opts?: SequenceOptions): SignStep[] {
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
      const pair = lookupWord(m, `${w} ${nextW}`, opts);
      if (pair) {
        steps.push({
          ...makeStep('word', `${w} ${nextW}`, pair.gloss || `${w} ${nextW}`, wi, pair),
          span: 2,
        });
        skip = 1;
        return;
      }
    }
    const wordEntry = lookupWord(m, w, opts);
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

/**
 * يبني تسلسل الإشارات من غلوس جاهز (نموذج الغلوس): كل عنصر إمّا مفتاح موجود في
 * القاموس فيُعرض إشارةً واحدة تغطّي كلمات النصّ من from إلى to، أو كلمة تُهجّى
 * حرفًا حرفًا. يحافظ على قاعدة الصدق نفسها: لا إشارة بلا أصل موثّق.
 */
export function buildSequenceFromGloss(
  text: string,
  gloss: { items: { key: string; word: string; from: number; to: number; spell?: string }[] },
  m: SignManifest | null,
  opts?: SequenceOptions
): SignStep[] {
  const steps: SignStep[] = [];
  const words = (text || '').match(WORD_RE) || [];
  for (const it of gloss.items) {
    const from = Math.max(0, Math.min(words.length - 1, it.from | 0));
    const to = Math.max(from, Math.min(words.length - 1, it.to | 0));
    const span = to - from + 1;
    // إشارة مركّبة لا تحلّ محلّ كلمة مفردة («أسنان» ليست «كلية طب أسنان»): المفتاح
    // الذي كلماته أكثر من الكلمات التي يغطّيها يغيّر المعنى، فيُردّ.
    const keyOk = !!it.key && it.key.trim().split(/\s+/).length <= span;
    const glyph = it.word || words.slice(from, to + 1).join(' ');
    // قبل التهجئة: الكلمة نفسها قد تكون في القاموس (بعد نزع «ال» والتصريف) وإن لم
    // يعرفها النموذج — مطابقة حرفية آمنة لا تغيّر المعنى.
    const entry =
      (keyOk ? lookupWord(m, it.key, opts) : undefined) ?? (span === 1 ? lookupWord(m, glyph, opts) : undefined);
    if (entry) {
      steps.push({ ...makeStep('word', glyph, entry.gloss || glyph, from, entry), span });
      continue;
    }
    const bare = stripMarks(it.spell || glyph);
    // الكلمات الوظيفية لا تُهجّى أبدًا (القاعدة 7 في موجّه النموذج)
    if (!keyOk && span === 1 && GLOSS_FUNCTION.has(normalizeWord(bare))) continue;
    if (!ARABIC.test(bare)) {
      steps.push({ ...makeStep('raw', glyph, glyph, from), span });
      continue;
    }
    for (const ch of Array.from(bare)) {
      if (!ARABIC.test(ch)) {
        if (ch.trim()) steps.push({ ...makeStep('raw', ch, ch, from), span });
        continue;
      }
      const le = m?.letters?.[ch] || m?.letters?.[normalizeWord(ch)];
      steps.push({ ...makeStep('letter', ch, ch, from, le), span });
    }
  }
  return fillSkippedWords(steps, words, m);
}

// أدوات تُحذف عمدًا في الغلوس (القاعدة 4 في موجّه النموذج) فلا تُستعاد.
const GLOSS_DROPPABLE = new Set(['ان', 'قد', 'كان', 'يكون', 'كانت', 'تكون', 'هو', 'هي', 'ما', 'ثم']);
// حروف الجرّ والعطف والضمائر والأدوات: تُحذف إن لم تكن لها إشارة، ولا تُهجّى.
const GLOSS_FUNCTION = new Set([
  ...GLOSS_DROPPABLE,
  'من', 'مع', 'في', 'عن', 'الي', 'علي', 'او', 'ام', 'و', 'ف', 'ب', 'ل', 'ك', 'ثم', 'حتي', 'لكن', 'بل',
  'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين', 'انت', 'انا', 'نحن', 'هم', 'كن', 'كي', 'لكي', 'اي', 'ايها', 'يا',
]);

/**
 * شبكة أمان فوق الغلوس: النموذج (وخاصة نسخ lite) قد يُسقط كلمات ذات معنى. كل كلمة
 * لم يغطّها أي عنصر ولها إشارة في القاموس تُدرَج إشارتها بعد الخطوة التي تغطّي
 * أقرب كلمة سابقة لها، فلا يفقد الطالب محتوى له إشارة. لا تُهجّى الكلمات المُستعادة
 * (حتى لا يطول العرض)؛ الوضع الحرفي متاح لمن يريد النصّ كاملًا.
 */
function fillSkippedWords(steps: SignStep[], words: string[], m: SignManifest | null): SignStep[] {
  const covered = new Set<number>();
  for (const s of steps) for (let k = s.word; k < s.word + (s.span ?? 1); k++) covered.add(k);
  const out = [...steps];
  for (let wi = 0; wi < words.length; wi++) {
    if (covered.has(wi) || GLOSS_DROPPABLE.has(normalizeWord(words[wi]))) continue;
    const next = words[wi + 1];
    const pair = next && !covered.has(wi + 1) ? lookupWord(m, `${words[wi]} ${next}`) : undefined;
    const entry = pair ?? lookupWord(m, words[wi]);
    if (!entry) continue;
    const span = pair ? 2 : 1;
    const glyph = words.slice(wi, wi + span).join(' ');
    // موضع الإدراج: بعد آخر خطوة تغطّي أقرب كلمة سابقة (أو في البداية)
    let pos = 0;
    for (let j = wi - 1; j >= 0 && !pos; j--) {
      for (let i = out.length - 1; i >= 0; i--) {
        const s = out[i];
        if (j >= s.word && j < s.word + (s.span ?? 1)) {
          pos = i + 1;
          break;
        }
      }
    }
    out.splice(pos, 0, { ...makeStep('word', glyph, entry.gloss || glyph, wi, entry), span });
    for (let k = wi; k < wi + span; k++) covered.add(k);
    if (pair) wi++;
  }
  return out;
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
