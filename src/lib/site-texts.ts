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
import type { DoorEmblem } from '@/components/home/door-emblem';

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
      { key: 'home.doors.board', label: 'باب ألعاب السبورة الذكية', default: 'ألعاب السبورة الذكية' },
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
    id: 'footer',
    label: 'التذييل (أسفل كل صفحة)',
    href: '/',
    fields: [
      { key: 'footer.org', label: 'السطر تحت اسم المنصّة', default: 'وزارة التربية والتعليم والتعليم العالي — دولة قطر' },
      {
        key: 'footer.about',
        label: 'نبذة المنصّة',
        default:
          'منصة تعليمية تفاعلية تجمع التجارب العملية والمحاكاة والأسئلة بصيغة تفاعلية، يمكن للطلبة تجربتها مباشرة',
        long: true,
        hint: 'تُكمَّل تلقائيًا بعبارة التنزيل حسب إعداده.',
      },
      { key: 'footer.linksTitle', label: 'عنوان الروابط السريعة', default: 'روابط سريعة' },
      { key: 'footer.visionTitle', label: 'عنوان عمود الرؤية', default: 'رؤية قطر الوطنية 2030' },
      {
        key: 'footer.vision',
        label: 'نص عمود الرؤية',
        default:
          'نُسهم في بناء التنمية البشرية من خلال تعليم رقمي إبداعي يواكب أحدث التقنيات ويعزّز حبّ الاستكشاف لدى المتعلّمين.',
        long: true,
      },
      { key: 'footer.contactTitle', label: 'عنوان التواصل', default: 'تواصل معنا' },
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
    id: 'page.boardGames',
    label: 'صفحة ألعاب السبورة الذكية',
    href: '/board-games',
    fields: court(
      'page.boardGames',
      'جديد • المس السبورة بيدك',
      'ألعاب السبورة الذكية',
      'ألعاب صفّية تُلعب بلمس السبورة بالأيدي، بلا أقلام إلكترونية ولا أجهزة للطلاب: جهاز المعلّم يعرض اللعبة على جهاز العرض ويرى أيدي الطلاب بكاميرته.'
    ),
  },
  {
    id: 'page.reviews',
    label: 'صفحة مراجعات الوحدات',
    href: '/unit-reviews',
    fields: court(
      'page.reviews',
      'جديد • استعدّ للاختبار',
      'مراجعات الوحدات',
      'ألعاب مراجعة شاملة لكل وحدة دراسية: اختر مراجعة وحدتك وراجع دروسها كلّها قبل الاختبار.'
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

/** أقسام الصفحة الرئيسية التي يمكن إخفاؤها وترتيبها، بترتيبها الأصلي. */
export const HOME_SECTIONS = SITE_TEXT_GROUPS.filter((g) => g.hideable).map((g) => ({
  id: g.id,
  label: g.label.replace(/^الرئيسية • /, ''),
}));
const HOME_IDS = new Set(HOME_SECTIONS.map((h) => h.id));

export const SITE_TEXT_LIMITS = { short: 120, long: 600, footerLinks: 12, history: 30 };

// --- مظهر الأبواب ----------------------------------------------------------

export const DOOR_EMBLEMS: Record<DoorEmblem, string> = {
  science: 'ذرّة (علوم)',
  math: 'مثلث ودائرة (رياضيات)',
  arabic: 'حرف عربي (لغة عربية)',
  islamic: 'قبة (تربية إسلامية)',
  english: 'حرف لاتيني (إنجليزي)',
  games: 'ألعاب',
  slides: 'شاشة عرض',
  board: 'يد على السبورة',
  letter: 'الحرف الأول من الاسم',
};

/** ألوان جاهزة للأبواب (يمكن اختيار أي لون آخر). */
export const DOOR_SWATCHES = ['#8a1538', '#2b6b62', '#2d5f7c', '#3f6b3a', '#5b3a22', '#b0862a', '#5a3d7a', '#1f2937'];

/** البابان الخاصّان في الصفحة الرئيسية (غير المواد). */
export const SPECIAL_DOORS: Record<string, { label: string; color: string; emblem: DoorEmblem }> = {
  __games: { label: 'ألعاب التعزيز الذكية', color: '#2d5f7c', emblem: 'games' },
  __presentations: { label: 'العروض التقديمية الذكية', color: '#b5552b', emblem: 'slides' },
  __board: { label: 'ألعاب السبورة الذكية', color: '#1d5c63', emblem: 'board' },
};

export interface DoorStyle {
  color?: string;
  emblem?: DoorEmblem;
}

// --- روابط التذييل ---------------------------------------------------------

export interface FooterLink {
  label: string;
  href: string;
}

export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { href: '/', label: 'الرئيسية' },
  { href: '/browse', label: 'تصفّح المناهج' },
  { href: '/about', label: 'عن المنصّة' },
  { href: '/dashboard', label: 'لوحة الإحصاءات' },
  { href: '/admin', label: 'رفع نشاط جديد' },
  { href: '/privacy', label: 'سياسة الخصوصية' },
  { href: '/accessibility', label: 'إمكانية الوصول' },
];

/** رابط داخلي (/…) أو خارجي آمن (https/mailto/tel) فقط. */
export function isSafeHref(href: string): boolean {
  return /^(\/(?!\/)|https:\/\/|mailto:|tel:)/i.test(href.trim());
}

// --- النموذج ----------------------------------------------------------------

export interface SiteTexts {
  /** ما غيّره المشرف فقط: مفتاح ← نص */
  texts: Record<string, string>;
  /** معرّفات الأقسام المخفية (من المجموعات القابلة للإخفاء) */
  hidden: string[];
  /** ترتيب أقسام الرئيسية — فارغ = الترتيب الأصلي */
  order: string[];
  /** لون الباب ونقشه: معرّف المادة (أو __games / __presentations / __board) ← نمط */
  doors: Record<string, DoorStyle>;
  /** روابط التذييل — null = الروابط الأصلية */
  footerLinks: FooterLink[] | null;
}

export interface SiteTextsSchedule {
  /** موعد النشر (ms) */
  at: number;
  data: SiteTexts;
  by: string;
}

export interface SiteTextsHistoryEntry {
  at: number;
  by: string;
  note: string;
  data: SiteTexts;
}

export const DEFAULT_SITE_TEXTS: SiteTexts = {
  texts: {},
  hidden: [],
  order: [],
  doors: {},
  footerLinks: null,
};

const DOC_PATH = ['curriculum', 'texts'] as const;
const HISTORY_PATH = ['curriculum', 'texts_history'] as const;
const CACHE_KEY = 'qa-site-texts-v2';
const HISTORY_CACHE_KEY = 'qa-site-texts-history-v1';
const LOCAL_EVENT = 'qa-site-texts-change';

/** النص النافذ لمفتاح: ما كتبه المشرف، وإلا الافتراضي. */
export function txt(s: SiteTexts, key: string): string {
  return s.texts[key] || SITE_TEXT_DEFAULTS[key] || '';
}

export function isSectionHidden(s: SiteTexts, groupId: string): boolean {
  return s.hidden.includes(groupId);
}

/** ترتيب أقسام الرئيسية النافذ: ما حدّده المشرف، ثم أي قسم جديد بترتيبه الأصلي. */
export function homeOrder(s: SiteTexts): string[] {
  const seen = new Set(s.order);
  return [...s.order, ...HOME_SECTIONS.map((h) => h.id).filter((id) => !seen.has(id))];
}

/** نمط الباب النافذ: ما اختاره المشرف، وإلا الافتراضي المعطى. */
export function doorStyle(
  s: SiteTexts,
  id: string,
  fallback: { color: string; emblem: DoorEmblem }
): { color: string; emblem: DoorEmblem } {
  const d = s.doors[id];
  return { color: d?.color ?? fallback.color, emblem: d?.emblem ?? fallback.emblem };
}

export function footerLinks(s: SiteTexts): FooterLink[] {
  return s.footerLinks ?? DEFAULT_FOOTER_LINKS;
}

/**
 * ينظّف البيانات الواردة: يتجاهل المفاتيح المجهولة والقيم الفارغة وما يطابق
 * الافتراضي، فلا تتراكم في الوثيقة قيم لا أثر لها.
 */
export function normalizeSiteTexts(raw: unknown): SiteTexts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof SiteTexts, unknown>>;

  const texts: Record<string, string> = {};
  if (r.texts && typeof r.texts === 'object') {
    for (const [k, v] of Object.entries(r.texts as Record<string, unknown>)) {
      if (!(k in SITE_TEXT_DEFAULTS) || typeof v !== 'string') continue;
      const clean = v.trim().slice(0, SITE_TEXT_LIMITS.long);
      if (clean && clean !== SITE_TEXT_DEFAULTS[k]) texts[k] = clean;
    }
  }

  const hidden = Array.isArray(r.hidden)
    ? [...new Set(r.hidden.filter((v): v is string => typeof v === 'string' && HOME_IDS.has(v)))].sort()
    : [];

  let order = Array.isArray(r.order)
    ? [...new Set(r.order.filter((v): v is string => typeof v === 'string' && HOME_IDS.has(v)))]
    : [];
  const full = homeOrder({ ...DEFAULT_SITE_TEXTS, order });
  if (full.join('|') === HOME_SECTIONS.map((h) => h.id).join('|')) order = [];
  else order = full;

  const doors: Record<string, DoorStyle> = {};
  if (r.doors && typeof r.doors === 'object') {
    for (const [id, v] of Object.entries(r.doors as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      if (!/^[\w-]{1,80}$/.test(id) || !v || typeof v !== 'object') continue;
      const x = v as { color?: unknown; emblem?: unknown };
      const style: DoorStyle = {};
      if (typeof x.color === 'string' && /^#[0-9a-f]{6}$/i.test(x.color)) style.color = x.color.toLowerCase();
      if (typeof x.emblem === 'string' && x.emblem in DOOR_EMBLEMS) style.emblem = x.emblem as DoorEmblem;
      if (style.color || style.emblem) doors[id] = style;
    }
  }

  let links: FooterLink[] | null = null;
  if (Array.isArray(r.footerLinks)) {
    links = [];
    for (const l of r.footerLinks.slice(0, SITE_TEXT_LIMITS.footerLinks)) {
      if (!l || typeof l !== 'object') continue;
      const x = l as { label?: unknown; href?: unknown };
      const label = typeof x.label === 'string' ? x.label.trim().slice(0, 60) : '';
      const href = typeof x.href === 'string' ? x.href.trim().slice(0, 300) : '';
      if (label && isSafeHref(href)) links.push({ label, href });
    }
    if (JSON.stringify(links) === JSON.stringify(DEFAULT_FOOTER_LINKS)) links = null;
  }

  return { texts, hidden, order, doors, footerLinks: links };
}

interface ParsedDoc {
  live: SiteTexts;
  scheduled: SiteTextsSchedule | null;
}

function parseDoc(raw: unknown): ParsedDoc {
  const live = normalizeSiteTexts(raw);
  const sc = (raw as { scheduled?: unknown } | null)?.scheduled as
    | { at?: unknown; data?: unknown; by?: unknown }
    | null
    | undefined;
  const scheduled =
    sc && typeof sc.at === 'number' && sc.data
      ? { at: sc.at, data: normalizeSiteTexts(sc.data), by: typeof sc.by === 'string' ? sc.by : '' }
      : null;
  return { live, scheduled };
}

/** النسخة النافذة الآن: المجدولة إن حلّ موعدها، وإلا المنشورة. */
function resolveDoc(d: ParsedDoc, now = Date.now()): SiteTexts {
  return d.scheduled && d.scheduled.at <= now ? d.scheduled.data : d.live;
}

function readCache(): ParsedDoc | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(d: ParsedDoc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...d.live, scheduled: d.scheduled }));
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
    return resolveDoc(parseDoc(snap.exists() ? snap.data() : null));
  } catch {
    return DEFAULT_SITE_TEXTS;
  }
}

/**
 * يشترك في النصوص من المتصفّح (للمكوّنات التي لا يولّدها الخادم مثل القائمة
 * العلوية والتذييل). يستدعي cb فورًا بالمحفوظ في المتصفّح إن وُجد، ثم بكل
 * نسخة جديدة — وعند حلول موعد نسخة مجدولة.
 */
export function subscribeSiteTexts(cb: (s: SiteTexts) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = (d: ParsedDoc) => {
    clearTimeout(timer);
    cb(resolveDoc(d));
    const wait = d.scheduled ? d.scheduled.at - Date.now() : -1;
    // setTimeout لا يقبل أكثر من ~24 يومًا؛ الأبعد يلتقطه أول تحميل لاحق
    if (wait > 0 && wait < 2 ** 31 - 1) timer = setTimeout(() => cb(resolveDoc(d)), wait + 500);
  };
  const cached = readCache();
  if (cached) emit(cached);

  if (!isFirebaseConfigured) {
    const onLocal = () => emit(readCache() ?? { live: DEFAULT_SITE_TEXTS, scheduled: null });
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY) onLocal();
    };
    window.addEventListener(LOCAL_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(timer);
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
          const d = parseDoc(snap.exists() ? snap.data() : null);
          writeCache(d);
          emit(d);
        },
        () => {
          /* تعذّرت القراءة: نبقي على آخر قيمة معروفة */
        }
      );
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    clearTimeout(timer);
    unsub?.();
  };
}

// --- القراءة والكتابة من لوحة التحكّم ----------------------------------------

async function readDoc(): Promise<ParsedDoc> {
  if (!isFirebaseConfigured) return readCache() ?? { live: DEFAULT_SITE_TEXTS, scheduled: null };
  const db = getDb();
  if (!db) return { live: DEFAULT_SITE_TEXTS, scheduled: null };
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, ...DOC_PATH));
  return parseDoc(snap.exists() ? snap.data() : null);
}

async function writeDoc(d: ParsedDoc, by: string): Promise<void> {
  if (!isFirebaseConfigured) {
    writeCache(d);
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  // setDoc بلا merge يستبدل الوثيقة كاملة، فلا تبقى مفاتيح محذوفة
  await setDoc(doc(db, ...DOC_PATH), {
    ...d.live,
    scheduled: d.scheduled,
    updatedAt: Date.now(),
    updatedBy: by,
  });
  writeCache(d);
}

/**
 * يقرأ الحالة الحالية للوحة التحكّم. إن حلّ موعد نسخة مجدولة تُعتمَد هنا
 * نسخةً منشورة (وتُسجَّل في السجل)، فلا تبقى معلّقة في الوثيقة.
 */
export async function getSiteTextsAdmin(by: string): Promise<ParsedDoc> {
  const d = await readDoc();
  if (d.scheduled && d.scheduled.at <= Date.now()) {
    const promoted = { live: d.scheduled.data, scheduled: null };
    try {
      await writeDoc(promoted, d.scheduled.by || by);
      await appendHistory({ at: d.scheduled.at, by: d.scheduled.by || by, note: 'نشر مجدول', data: promoted.live });
    } catch {
      /* لا صلاحية كتابة؟ نعرض النافذ على أي حال */
    }
    return promoted;
  }
  return d;
}

/** ينشر النصوص لكل الزوّار الآن، مع إبقاء أي نشر مجدول كما هو. */
export async function saveSiteTexts(s: SiteTexts, by: string, note = 'نشر'): Promise<SiteTexts> {
  const clean = normalizeSiteTexts(s);
  const current = await readDoc();
  await writeDoc({ live: clean, scheduled: current.scheduled }, by);
  await appendHistory({ at: Date.now(), by, note, data: clean }).catch(() => {});
  return clean;
}

/** يعدّل نصًّا واحدًا وينشره فورًا (التحرير المباشر من صفحات الموقع). */
export async function saveSiteTextKey(key: string, value: string, by: string): Promise<SiteTexts> {
  const current = await readDoc();
  const live = resolveDoc(current);
  const field = SITE_TEXT_GROUPS.flatMap((g) => g.fields).find((f) => f.key === key);
  return saveSiteTexts(
    { ...live, texts: { ...live.texts, [key]: value } },
    by,
    `تعديل مباشر: ${field?.label ?? key}`
  );
}

/** يجدول نشر نسخة في موعد لاحق (أو يلغي المجدول بتمرير null). */
export async function scheduleSiteTexts(
  s: SiteTexts | null,
  at: number,
  by: string
): Promise<void> {
  const current = await readDoc();
  await writeDoc(
    { live: current.live, scheduled: s ? { at, data: normalizeSiteTexts(s), by } : null },
    by
  );
}

export async function getScheduled(): Promise<SiteTextsSchedule | null> {
  return (await readDoc()).scheduled;
}

// --- السجل ------------------------------------------------------------------

function parseHistory(raw: unknown): SiteTextsHistoryEntry[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((x) => ({
      at: typeof x.at === 'number' ? x.at : 0,
      by: typeof x.by === 'string' ? x.by : '',
      note: typeof x.note === 'string' ? x.note : '',
      data: normalizeSiteTexts(x.data),
    }))
    .sort((a, b) => b.at - a.at);
}

export async function getSiteTextsHistory(): Promise<SiteTextsHistoryEntry[]> {
  if (!isFirebaseConfigured) {
    try {
      return parseHistory(JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) ?? 'null'));
    } catch {
      return [];
    }
  }
  const db = getDb();
  if (!db) return [];
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, ...HISTORY_PATH));
  return parseHistory(snap.exists() ? snap.data() : null);
}

async function appendHistory(entry: SiteTextsHistoryEntry): Promise<void> {
  const items = [entry, ...(await getSiteTextsHistory())].slice(0, SITE_TEXT_LIMITS.history);
  if (!isFirebaseConfigured) {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ items }));
    return;
  }
  const db = getDb();
  if (!db) return;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, ...HISTORY_PATH), { items, updatedAt: Date.now() });
}

/** وصف مختصر لما تغيّر بين نسختين — لعرضه في السجل. */
export function diffSiteTexts(a: SiteTexts, b: SiteTexts): string[] {
  const out: string[] = [];
  const fields = SITE_TEXT_GROUPS.flatMap((g) => g.fields.map((f) => ({ ...f, group: g.label })));
  for (const f of fields) {
    if (txt(a, f.key) !== txt(b, f.key)) out.push(`${f.group} ← ${f.label}`);
  }
  if (a.hidden.join('|') !== b.hidden.join('|')) out.push('إظهار/إخفاء الأقسام');
  if (homeOrder(a).join('|') !== homeOrder(b).join('|')) out.push('ترتيب أقسام الرئيسية');
  if (JSON.stringify(a.doors) !== JSON.stringify(b.doors)) out.push('ألوان الأبواب ونقوشها');
  if (JSON.stringify(footerLinks(a)) !== JSON.stringify(footerLinks(b))) out.push('روابط التذييل');
  return out;
}
