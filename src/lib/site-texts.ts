// ---------------------------------------------------------------------------
//  نصوص الموقع وعناوين أقسامه — يحرّرها المشرف من لوحة التحكّم بلا تعديل
//  على الشيفرة ولا إعادة نشر.
//
//  كل نصّ قابل للتعديل له مفتاح ثابت ونصّ افتراضي في SITE_TEXT_GROUPS أدناه.
//  لا يُحفظ في Firestore إلا ما غيّره المشرف (curriculum/texts)، فيبقى
//  الافتراضي هو المرجع، ويعود إليه أي حقل يُفرَّغ أو «يُستعاد».
//  (مجموعة curriculum قواعدها منشورة أصلًا: قراءة عامة، وكتابة للمالك وحده.)
//
//  الصفحات تقرأ الوثيقة في الخادم وقت التوليد (fetchSiteTextsServer)، ولوحة
//  التحكّم تطلب إعادة توليدها فور الحفظ فيرى الزوّار التعديل في اللحظة نفسها.
//  القائمة العلوية (مكوّن متصفّح) تستمع للوثيقة مباشرة (subscribeSiteTexts).
//  وبلا Firebase (وضع العرض) تُحفظ في هذا المتصفّح فقط.
//
//  لإضافة نصّ جديد قابل للتعديل: أضِف حقلًا إلى المجموعة المناسبة، ثم اقرأه
//  في الصفحة بـ txt(texts, 'المفتاح').
// ---------------------------------------------------------------------------

import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export interface SiteTextField {
  key: string;
  label: string;
  default: string;
  /** حقل متعدّد الأسطر (وصف أو فقرة) */
  long?: boolean;
  /** ملاحظة تظهر تحت الحقل في لوحة التحكّم */
  hint?: string;
}

export interface SiteTextGroup {
  id: string;
  label: string;
  /** الصفحة التي يظهر فيها القسم — لزر «معاينة في الموقع» */
  href: string;
  /** مفتاح إخفاء القسم من الصفحة — للأقسام التي يمكن إخفاؤها فقط */
  hideable?: boolean;
  fields: SiteTextField[];
}

const HIGHLIGHT_HINT = 'ضع الكلمة بين نجمتين *هكذا* لتظهر باللون العنّابي.';

/** بطاقة رأس صفحة داخلية (PageCourt): تمهيد + عنوان + وصف. */
function court(id: string, kicker: string, title: string, lead: string): SiteTextField[] {
  return [
    { key: `${id}.kicker`, label: 'السطر التمهيدي', default: kicker },
    { key: `${id}.title`, label: 'عنوان الصفحة', default: title },
    { key: `${id}.lead`, label: 'وصف الصفحة', default: lead, long: true },
  ];
}

export const SITE_TEXT_GROUPS: SiteTextGroup[] = [
  {
    id: 'nav',
    label: 'الترويسة والقائمة العلوية',
    href: '/',
    fields: [
      { key: 'header.flag', label: 'شريط العلم • النص الأول', default: 'منصة تعليمية لطلبة مدارس دولة قطر' },
      { key: 'header.flag2', label: 'شريط العلم • النص الثاني', default: 'وزارة التربية والتعليم والتعليم العالي' },
      { key: 'header.tagline', label: 'السطر تحت اسم المنصّة', default: 'تجارب • محاكاة • أسئلة • ألعاب' },
      { key: 'nav.home', label: 'الرئيسية', default: 'الرئيسية' },
      { key: 'nav.browse', label: 'المناهج', default: 'المناهج' },
      { key: 'nav.search', label: 'بحث', default: 'بحث' },
      { key: 'nav.dashboard', label: 'الإحصاءات', default: 'الإحصاءات' },
      { key: 'nav.heatmap', label: 'الخريطة الحرارية', default: 'الخريطة الحرارية' },
      { key: 'nav.about', label: 'عن المنصّة', default: 'عن المنصّة' },
      { key: 'nav.upload', label: 'زر رفع نشاط', default: 'رفع نشاط' },
    ],
  },
  {
    id: 'home.hero',
    label: 'الرئيسية • الواجهة',
    href: '/',
    fields: [
      { key: 'home.hero.kicker', label: 'السطر التمهيدي', default: 'منصة تعليمية تفاعلية • دولة قطر' },
      { key: 'home.hero.line1', label: 'العنوان الكبير • السطر الأول', default: 'نتعلّم *بأيدينا*', hint: HIGHLIGHT_HINT },
      { key: 'home.hero.line2', label: 'العنوان الكبير • السطر الثاني', default: 'ونكتشف *بعقولنا*', hint: HIGHLIGHT_HINT },
      {
        key: 'home.hero.lead',
        label: 'الفقرة التعريفية',
        default:
          'تجارب عملية ومحاكاة وأسئلة وألعاب تعليمية لمناهج دولة قطر، مرتّبة حسب المادة والوحدة والدرس — جرّبها مباشرة من المتصفّح',
        long: true,
        hint: 'تُكمَّل تلقائيًا بعبارة التنزيل («أو حمّلها…») أو («في الصف أو البيت») حسب إعداد التنزيل.',
      },
      { key: 'home.hero.cta', label: 'زر الدخول إلى المواد', default: 'ادخل إلى المواد' },
    ],
  },
  {
    id: 'home.naseej',
    label: 'الرئيسية • العرض وفيديو الإطلاق',
    href: '/#naseej',
    hideable: true,
    fields: [
      { key: 'home.naseej.kicker', label: 'السطر التمهيدي', default: 'شاهد قبل أن تبدأ' },
      { key: 'home.naseej.title', label: 'عنوان القسم', default: 'نسيج المجتمع القطري وفيديو الإطلاق' },
      {
        key: 'home.naseej.lead',
        label: 'وصف القسم',
        default:
          'عرض تفاعلي يعمل تلقائيًا من درس «أنا ومجتمعي»، وإلى جانبه فيديو قصير يعرّفك بالمنصّة. الفيديو يبدأ بلا صوت حين تصل إليه، وتشغّل صوته متى شئت.',
        long: true,
      },
      { key: 'home.naseej.showLabel', label: 'عنوان العرض', default: 'عرض تلقائي متواصل • أنا ومجتمعي' },
      { key: 'home.naseej.videoLabel', label: 'عنوان الفيديو', default: 'فيديو الإطلاق • يعمل عند الوصول إليه' },
    ],
  },
  {
    id: 'home.reviews',
    label: 'الرئيسية • مراجعات الوحدات',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.reviews.kicker', label: 'السطر التمهيدي', default: 'جديد • استعدّ للاختبار' },
      { key: 'home.reviews.title', label: 'عنوان القسم', default: 'مراجعات الوحدات' },
    ],
  },
  {
    id: 'home.doors',
    label: 'الرئيسية • أبواب المواد',
    href: '/#doors',
    hideable: true,
    fields: [
      { key: 'home.doors.kicker', label: 'السطر التمهيدي', default: 'المواد الدراسية' },
      { key: 'home.doors.title', label: 'عنوان القسم', default: 'افتح باب المادة' },
      { key: 'home.doors.lead', label: 'وصف القسم', default: 'كل مادة باب. ادخل لتصل إلى وحداتها ودروسها وأنشطتها.', long: true },
      { key: 'home.doors.action', label: 'الرابط الجانبي', default: 'كل المناهج' },
      { key: 'home.doors.games', label: 'باب ألعاب التعزيز', default: 'ألعاب التعزيز الذكية' },
      { key: 'home.doors.presentations', label: 'باب العروض التقديمية', default: 'العروض التقديمية الذكية' },
    ],
  },
  {
    id: 'home.steps',
    label: 'الرئيسية • كيف تعمل المنصّة',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.steps.kicker', label: 'السطر التمهيدي', default: 'كيف تعمل المنصّة؟' },
      { key: 'home.steps.title', label: 'عنوان القسم', default: 'من الكتاب إلى التجربة في ثلاث خطوات' },
      { key: 'home.steps.1.title', label: 'الخطوة ١ • العنوان', default: 'اختر الدرس' },
      { key: 'home.steps.1.desc', label: 'الخطوة ١ • الوصف', default: 'المادة، ثم المستوى، ثم الوحدة، ثم الدرس — بترتيب الكتاب المدرسي نفسه.', long: true },
      { key: 'home.steps.2.title', label: 'الخطوة ٢ • العنوان', default: 'جرّب مباشرة' },
      { key: 'home.steps.2.desc', label: 'الخطوة ٢ • الوصف', default: 'شغّل التجربة أو المحاكاة أو اللعبة داخل المتصفّح دون أي تثبيت، وبملء الشاشة على السبورة.', long: true },
      { key: 'home.steps.3.title', label: 'الخطوة ٣ • العنوان (التنزيل متاح)', default: 'خذها معك' },
      { key: 'home.steps.3.desc', label: 'الخطوة ٣ • الوصف (التنزيل متاح)', default: 'نزّل النشاط ملفًا واحدًا يعمل على أي جهاز في الصف أو البيت دون اتصال.', long: true },
      { key: 'home.steps.3off.title', label: 'الخطوة ٣ • العنوان (التنزيل مغلق)', default: 'تعلّم في أي مكان' },
      { key: 'home.steps.3off.desc', label: 'الخطوة ٣ • الوصف (التنزيل مغلق)', default: 'استخدم الأنشطة من الموقع في الصف أو البيت، على أي جهاز متصل بالإنترنت.', long: true },
    ],
  },
  {
    id: 'home.types',
    label: 'الرئيسية • أنواع الأنشطة',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.types.kicker', label: 'السطر التمهيدي', default: 'أنواع الأنشطة' },
      { key: 'home.types.title', label: 'عنوان القسم', default: 'أربع طرق لتعلّم الدرس نفسه' },
      { key: 'home.types.1.title', label: 'البطاقة ١ • العنوان', default: 'تجارب عملية' },
      { key: 'home.types.1.desc', label: 'البطاقة ١ • الوصف', default: 'يجرّب الطالب بيده ويرى النتيجة كما في المختبر.', long: true },
      { key: 'home.types.2.title', label: 'البطاقة ٢ • العنوان', default: 'محاكاة تفاعلية' },
      { key: 'home.types.2.desc', label: 'البطاقة ٢ • الوصف', default: 'ظواهر يصعب رؤيتها في الصف، يغيّر الطالب متغيّراتها ويراقب.', long: true },
      { key: 'home.types.3.title', label: 'البطاقة ٣ • العنوان', default: 'أسئلة وتقويم' },
      { key: 'home.types.3.desc', label: 'البطاقة ٣ • الوصف', default: 'أسئلة قصيرة تُظهر للطالب ما فهمه وما يحتاج مراجعته.', long: true },
      { key: 'home.types.4.title', label: 'البطاقة ٤ • العنوان', default: 'ألعاب تعليمية' },
      { key: 'home.types.4.desc', label: 'البطاقة ٤ • الوصف', default: 'تحدّيات ومراحل تعزّز ما تعلّمه الطالب في الدرس.', long: true },
    ],
  },
  {
    id: 'home.impact',
    label: 'الرئيسية • أثر التعلّم',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.impact.kicker', label: 'السطر التمهيدي', default: 'أثر التعلّم' },
      { key: 'home.impact.title', label: 'عنوان القسم', default: 'ماذا صنعت المنصّة في الصفوف؟' },
      {
        key: 'home.impact.lead',
        label: 'وصف القسم',
        default:
          'أرقام حقيقية تُحتسب من استخدام الطلبة والمعلّمين الفعلي، لا تقديرات — وآراء من جرّبوا الأنشطة في صفوفهم.',
        long: true,
      },
    ],
  },
  {
    id: 'home.featured',
    label: 'الرئيسية • أنشطة مميّزة',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.featured.kicker', label: 'السطر التمهيدي', default: 'الأكثر تفاعلًا' },
      { key: 'home.featured.title', label: 'عنوان القسم', default: 'أنشطة مميّزة' },
      { key: 'home.featured.action', label: 'الرابط الجانبي', default: 'كل الأنشطة' },
    ],
  },
  {
    id: 'home.closing',
    label: 'الرئيسية • الخاتمة',
    href: '/',
    hideable: true,
    fields: [
      { key: 'home.closing.title', label: 'العنوان', default: 'كل درس فيه لؤلؤة تنتظر من يكتشفها' },
      { key: 'home.closing.lead', label: 'الوصف', default: 'تصفّح المناهج واختر الدرس الذي تدرسه هذا الأسبوع، وابدأ بنشاطه.', long: true },
      { key: 'home.closing.cta', label: 'نص الزر', default: 'تصفّح المناهج' },
    ],
  },
  {
    id: 'page.browse',
    label: 'صفحة تصفّح المناهج',
    href: '/browse',
    fields: court(
      'page.browse',
      'المكتبة التعليمية',
      'تصفّح المناهج',
      'كل مادة باب. اختر الباب لتصل إلى مستوياتها ووحداتها ودروسها، ثم إلى أنشطتها التفاعلية.'
    ),
  },
  {
    id: 'page.search',
    label: 'صفحة البحث',
    href: '/search',
    fields: court(
      'page.search',
      'الفهرس',
      'ابحث في المنصّة',
      'اعثر على أي تجربة أو محاكاة أو لعبة أو سؤال بكلمة من عنوانه أو درسه، وصفِّ النتائج حسب النوع أو المادة.'
    ),
  },
  {
    id: 'page.smartGames',
    label: 'صفحة ألعاب التعزيز الذكية',
    href: '/smart-games',
    fields: court(
      'page.smartGames',
      'تعلّم • العب • عزّز',
      'ألعاب التعزيز الذكية',
      'مجموعة مستقلة من الألعاب التفاعلية تساعد على تثبيت المفاهيم والمهارات بطريقة ممتعة، مع وصف مختصر لكل لعبة.'
    ),
  },
  {
    id: 'page.presentations',
    label: 'صفحة العروض التقديمية الذكية',
    href: '/smart-presentations',
    fields: court(
      'page.presentations',
      'قسم تجريبي • اعرض • جرّب • تفاعل',
      'العروض التقديمية الذكية',
      'شرح الدرس كما في البوربوينت، لكن الشرائح هنا حيّة: تجارب ومحاكاة ومؤثّرات يتفاعل معها الطالب. افتح العرض بملء الشاشة على السبورة وتنقّل بالأسهم.'
    ),
  },
  {
    id: 'page.dashboard',
    label: 'صفحة الإحصاءات',
    href: '/dashboard',
    fields: court(
      'page.dashboard',
      'متابعة حيّة',
      'لوحة الإحصاءات',
      'المؤشّرات الرئيسية واتجاهها عبر الزمن في شاشة واحدة، والتفاصيل في أقسام مستقلّة.'
    ),
  },
  {
    id: 'page.heatmap',
    label: 'صفحة الخريطة الحرارية',
    href: '/heatmap',
    fields: court(
      'page.heatmap',
      'من الدوحة إلى الشمال',
      'الخريطة الحرارية',
      'تركيز مستخدمي الألعاب التعليمية في بلديات قطر بحسب موقع المدرسة التي يختارها الطالب — بلا أي بيانات شخصية.'
    ),
  },
  {
    id: 'page.about',
    label: 'صفحة عن المنصّة',
    href: '/about',
    fields: court(
      'page.about',
      'للمعلّمين والمشرفين والمحكّمين',
      'عن المنصّة',
      'ما الذي تحلّه المنصّة، ولماذا هي مختلفة، وكيف تُستخدم في الصف، وكيف نعرف أنها تعلّم فعلًا. كل رقم في هذه الصفحة يُقرأ من الاستخدام الحقيقي وقت فتحها.'
    ),
  },
];

export const SITE_TEXT_DEFAULTS: Record<string, string> = Object.fromEntries(
  SITE_TEXT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.default]))
);

const HIDEABLE = new Set(SITE_TEXT_GROUPS.filter((g) => g.hideable).map((g) => g.id));

export const SITE_TEXT_LIMITS = { short: 120, long: 600 };

export interface SiteTexts {
  /** ما غيّره المشرف فقط: مفتاح ← نص */
  texts: Record<string, string>;
  /** معرّفات الأقسام المخفية (من المجموعات القابلة للإخفاء) */
  hidden: string[];
}

export const DEFAULT_SITE_TEXTS: SiteTexts = { texts: {}, hidden: [] };

const DOC_PATH = ['curriculum', 'texts'] as const;
const CACHE_KEY = 'qa-site-texts-v1';
const LOCAL_EVENT = 'qa-site-texts-change';

/** النص النافذ لمفتاح: ما كتبه المشرف، وإلا الافتراضي. */
export function txt(s: SiteTexts, key: string): string {
  return s.texts[key] || SITE_TEXT_DEFAULTS[key] || '';
}

export function isSectionHidden(s: SiteTexts, groupId: string): boolean {
  return s.hidden.includes(groupId);
}

/**
 * ينظّف البيانات الواردة: يتجاهل المفاتيح المجهولة والقيم الفارغة وما يطابق
 * الافتراضي، فلا تتراكم في الوثيقة نصوص لا أثر لها.
 */
export function normalizeSiteTexts(raw: unknown): SiteTexts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { texts?: unknown; hidden?: unknown };
  const texts: Record<string, string> = {};
  if (r.texts && typeof r.texts === 'object') {
    for (const [k, v] of Object.entries(r.texts as Record<string, unknown>)) {
      if (!(k in SITE_TEXT_DEFAULTS) || typeof v !== 'string') continue;
      const clean = v.trim().slice(0, SITE_TEXT_LIMITS.long);
      if (clean && clean !== SITE_TEXT_DEFAULTS[k]) texts[k] = clean;
    }
  }
  const hidden = Array.isArray(r.hidden)
    ? [...new Set(r.hidden.filter((v): v is string => typeof v === 'string' && HIDEABLE.has(v)))]
    : [];
  return { texts, hidden };
}

function readCache(): SiteTexts | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeSiteTexts(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(s: SiteTexts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** يقرأ النصوص في الخادم وقت توليد الصفحة (لا يرمي خطأً أبدًا). */
export async function fetchSiteTextsServer(): Promise<SiteTexts> {
  if (!isFirebaseConfigured) return DEFAULT_SITE_TEXTS;
  const db = getDb();
  if (!db) return DEFAULT_SITE_TEXTS;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, ...DOC_PATH));
    return normalizeSiteTexts(snap.exists() ? snap.data() : null);
  } catch {
    return DEFAULT_SITE_TEXTS;
  }
}

/**
 * يشترك في النصوص من المتصفّح (للمكوّنات التي لا يولّدها الخادم مثل القائمة
 * العلوية). يستدعي cb فورًا بالمحفوظ في المتصفّح إن وُجد، ثم بكل نسخة جديدة.
 */
export function subscribeSiteTexts(cb: (s: SiteTexts) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const cached = readCache();
  if (cached) cb(cached);

  if (!isFirebaseConfigured) {
    const onLocal = () => cb(readCache() ?? DEFAULT_SITE_TEXTS);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY) onLocal();
    };
    window.addEventListener(LOCAL_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOCAL_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }

  const db = getDb();
  if (!db) return () => {};

  let unsub: (() => void) | null = null;
  let cancelled = false;
  import('firebase/firestore')
    .then(({ doc, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, ...DOC_PATH),
        (snap) => {
          const s = normalizeSiteTexts(snap.exists() ? snap.data() : null);
          writeCache(s);
          cb(s);
        },
        () => {
          /* تعذّرت القراءة: نبقي على آخر قيمة معروفة */
        }
      );
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** يقرأ النصوص الحالية مرّة واحدة (للوحة التحكّم). */
export async function getSiteTexts(): Promise<SiteTexts> {
  if (!isFirebaseConfigured) return readCache() ?? DEFAULT_SITE_TEXTS;
  const db = getDb();
  if (!db) return DEFAULT_SITE_TEXTS;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, ...DOC_PATH));
  return normalizeSiteTexts(snap.exists() ? snap.data() : null);
}

/** ينشر النصوص لكل الزوّار (Firestore)، أو يحفظها محليًا في وضع العرض. */
export async function saveSiteTexts(s: SiteTexts): Promise<SiteTexts> {
  const clean = normalizeSiteTexts(s);
  if (!isFirebaseConfigured) {
    writeCache(clean);
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return clean;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, ...DOC_PATH), { ...clean, updatedAt: Date.now() });
  writeCache(clean);
  return clean;
}
