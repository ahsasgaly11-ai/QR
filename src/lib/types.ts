// ---------------------------------------------------------------------------
// Domain model for the Qatar curriculum platform.
// Hierarchy:  Subject (المادة) › Grade/Level (المستوى) › Unit (الوحدة)
//             › Lesson (الدرس) › Activity/Game (نشاط/لعبة)
// A lesson can hold more than one activity.
// ---------------------------------------------------------------------------

export type ActivityType = 'experiment' | 'simulation' | 'quiz' | 'game';

/**
 * ألوان أنواع الأنشطة — لوحة تصنيفية (هوية لا مقدار).
 *
 * كانت أربع درجات من العنّابي والذهبي، وفحص اللوحة أظهر أن درجتَي
 * العنّابي (#8a173e و #6a0f2e) لا يفرّق بينهما الناظر العادي أصلًا
 * (ΔE 7.7، والحدّ 15)، فضلًا عن عمى الألوان. فاستُبدلت بلوحة تُبقي
 * العنّابي والذهبي من هوية الوزارة وتضيف لونين متباينين.
 *
 * تم التحقّق بمُحقّق اللوحات في الوضعين الفاتح والليلي: كل الفحوص تمرّ
 * (نطاق الإضاءة، حدّ التشبّع، فصل عمى الألوان، الفصل للرؤية العادية،
 * التباين مع الخلفية).
 */
export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: string; color: string }
> = {
  experiment: { label: 'تجربة عملية', icon: 'flask', color: '#a8244e' },
  simulation: { label: 'محاكاة', icon: 'atom', color: '#0f8f7c' },
  quiz: { label: 'أسئلة تفاعلية', icon: 'help', color: '#b0892e' },
  game: { label: 'لعبة تعليمية', icon: 'gamepad', color: '#6a4c93' },
};

/** هوية العرض التقديمي الذكي: يُعرض بها بدل نوع النشاط أينما ظهر. */
export const PRESENTATION_META = {
  label: 'عرض تقديمي ذكي',
  color: '#b5552b',
  play: 'ابدأ العرض',
} as const;

/** عدد العروض بصيغة عربية صحيحة: عرض واحد، عرضان، ٣ عروض، ١١ عرضًا. */
export function presentationsCount(n: number): string {
  if (n === 1) return 'عرض واحد';
  if (n === 2) return 'عرضان';
  return `${n} ${n <= 10 ? 'عروض' : 'عرضًا'}`;
}

/**
 * العروض التقديمية ومراجعات الوحدات تُفتح أيضًا في صفحة مستقلة بلا رأس
 * الموقع ولا تذييله — للسبورة أو لمشاركة رابطها مع الطلبة.
 */
export function opensStandalone(a: Pick<Activity, 'presentation' | 'unitReview'>): boolean {
  return Boolean(a.presentation || a.unitReview);
}

/** رابط الصفحة المستقلة للعرض أو المراجعة. */
export const standalonePath = (id: string) => `/view/${id}`;

/** مسار قسم العروض التقديمية الذكية. */
export const PRESENTATIONS_PATH = '/smart-presentations';

// ---------------------------------------------------------------------------
// ألعاب السبورة الذكية: تُلعب بلمس السبورة باليد، وكل لعبة تطبيق ويب ثابت في
// public/<slug>/ على المحرّك المشترك public/board-kit/. بياناتها الوصفية
// (العنوان، النواتج، الدرس…) تُقرأ من Firestore (boardGames/{slug}) فوق
// القائمة المضمّنة في src/data/board-games.ts، فتُعدَّل من لوحة الإدارة
// ومن صفحة القسم بلا نشر جديد. ملفات اللعبة نفسها تبقى في المستودع.
// ---------------------------------------------------------------------------

/** هوية قسم ألعاب السبورة الذكية. */
export const BOARD_GAME_META = {
  label: 'لعبة سبورة ذكية',
  color: '#1d5c63',
  play: 'افتح على السبورة',
} as const;

/** مسار قسم ألعاب السبورة الذكية. */
export const BOARD_GAMES_PATH = '/board-games';

/** عدد الألعاب بصيغة عربية صحيحة: لعبة واحدة، لعبتان، ٣ ألعاب، ١١ لعبة. */
export function boardGamesCount(n: number): string {
  if (n === 1) return 'لعبة واحدة';
  if (n === 2) return 'لعبتان';
  return `${n} ${n <= 10 ? 'ألعاب' : 'لعبة'}`;
}

export interface BoardGame {
  /** اسم المجلد في public/ وأساس الرابط — معرّف الوثيقة في Firestore */
  slug: string;
  title: string;
  /** وصف قصير يظهر في البطاقة (سطران) */
  summary: string;
  /** اسم المادة كما يظهر على الغلاف إن لم تُربط اللعبة بدرس */
  subject: string;
  /** ملاحظة قصيرة تحت العنوان (مثل: النشاط 1) — تظهر إلى جانب موقع الدرس */
  context?: string;
  /** نواتج التعلّم الرئيسية (٢–٤ نقاط قصيرة) */
  objectives: string[];
  /** أوضاع اللعب كما تظهر في قائمة اللعبة */
  modes: string[];
  /** فردي/الصف كله/سباق فريقين… */
  players: string;
  /** مدة الجولة التقريبية بالدقائق */
  minutes: number;
  /** صورة الغلاف (لقطة من اللعبة، نسبة 16:10) */
  cover: string;
  /** لون البطاقة */
  color: string;
  /** تاريخ الإضافة (YYYY-MM-DD) — الأحدث يظهر أولًا ما لم يُحدَّد ترتيب */
  added: string;
  /**
   * ربط اللعبة بدرسها (كالعروض التقديمية): تظهر شريطًا «لعبة السبورة» داخل
   * الدرس في صفحة المادة، ويُقرأ موقعها من شجرة المنهج. درس واحد لكل لعبة،
   * وقد يحوي الدرس أكثر من لعبة.
   */
  subjectId?: string;
  gradeId?: string;
  unitId?: string;
  lessonId?: string;
  /** مخفيّة من الموقع (تبقى في لوحة الإدارة) */
  hidden?: boolean;
  /** ترتيب يدوي يحدّده المشرف (الأصغر أولًا)؛ غيابه = حسب تاريخ الإضافة */
  order?: number;
  /** طابع آخر تعديل من لوحة الإدارة (ms) */
  updatedAt?: number;
}

/** هل اللعبة مرتبطة بدرس محدّد في شجرة المنهج؟ */
export function boardGameLinked(g: Pick<BoardGame, 'subjectId' | 'gradeId' | 'unitId' | 'lessonId'>): boolean {
  return Boolean(g.subjectId && g.gradeId && g.unitId && g.lessonId);
}

/** تسمية النشاط ولونه كما يراهما الزائر (العرض التقديمي له هويته الخاصة). */
export function activityLabel(a: Pick<Activity, 'type' | 'presentation'>): { label: string; color: string } {
  return a.presentation ? PRESENTATION_META : ACTIVITY_META[a.type];
}

/** سؤال تقويم ختامي (تذكرة خروج) من اختيار من متعدّد. */
export interface ExitQuestion {
  /** نص السؤال */
  q: string;
  /** الخيارات (2 إلى 4) */
  options: string[];
  /** فهرس الإجابة الصحيحة داخل options */
  answer: number;
}

/** موضع توظيف النشاط في الدرس. */
export type LessonPhase = 'before' | 'during' | 'after';

/**
 * البيانات التربوية للنشاط — ما يربطه بالهدف التعليمي للدرس ويُظهر للمعلّم
 * والمحكّم كيف يُوظَّف وما الذي يقيسه.
 */
export interface Pedagogy {
  /** الهدف التعليمي كما في دليل المعلّم */
  objective?: string;
  /** نواتج التعلّم المتوقّعة (كل ناتج سطر) */
  outcomes?: string[];
  /** المدة المقترحة بالدقائق */
  duration?: number;
  /** متى يُوظَّف: قبل الدرس (تهيئة)، أثناءه (بناء)، بعده (تثبيت/تقويم) */
  phase?: LessonPhase;
  /** كيف يوظّفه المعلّم في الصف (خطوات مختصرة) */
  usage?: string;
  /** مراعاة الفروق الفردية وأدوات الدعم */
  support?: string;
  /** أسئلة التقويم الختامي (1 إلى 3) — تُعرض بعد النشاط وتُسجَّل نتائجها */
  exitTicket?: ExitQuestion[];
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  /** الهدف التعليمي ونواتج التعلّم وطريقة التوظيف والتقويم الختامي */
  pedagogy?: Pedagogy;
  /** يظهر النشاط في قسم «ألعاب التعزيز الذكية» في الصفحة الرئيسية. */
  smartReinforcement?: boolean;
  /**
   * لعبة مراجعة شاملة لوحدة كاملة: تظهر في قسم «مراجعات الوحدات» أعلى
   * الصفحة الرئيسية، ومرتبطة بالمادة والمستوى والوحدة دون درس محدّد.
   */
  unitReview?: boolean;
  /**
   * عرض تقديمي ذكي للدرس (قسم تجريبي): ملف HTML يحاكي شرائح البوربوينت
   * بتفاعل ومحاكاة ومؤثّرات. مرتبط بدرسه، ويظهر زرًّا «عرض الدرس» فوق
   * أنشطته وفي قسم «العروض التقديمية الذكية»، ولا يُعدّ ضمن أنشطة الدرس.
   */
  presentation?: boolean;
  /**
   * تنزيل المراجعة (لمراجعات الوحدات فقط): يتحكّم به المشرف لكل مراجعة على
   * حدة، مستقلًّا عن إعدادات تبويب «التنزيل». غيابه يعني أن التنزيل موقوف.
   */
  downloadable?: boolean;
  type: ActivityType;
  /** Path under /public/games (e.g. "muscle.html") OR a full Storage URL. */
  file: string;
  /** true when `file` is an absolute URL (uploaded to Firebase Storage). */
  external?: boolean;
  /** true when the file lives only in this browser (وضع العرض المحلي). */
  local?: boolean;
  /** محتوى الملف مُخزَّن مقسّمًا داخل Firestore (activities/{id}/chunks). */
  stored?: 'firestore';
  /** عدد أجزاء الملف عند التخزين في Firestore. */
  chunks?: number;
  /**
   * طابع آخر استبدال لملف اللعبة (ms). يُبطل المعاينة المخزّنة في متصفّحات
   * الزوّار ويُعيد تحميل الإطار، فلا يبقى أحد على النسخة القديمة.
   */
  fileVersion?: number;
  /** توجد نسخة معاينة خفيفة تُعرض في بطاقة الدرس. */
  hasPreview?: boolean;
  /**
   * رابط مقطع فيديو بلغة الإشارة القطرية يشرح النشاط (اختياري).
   * يظهر عند تشغيله زرّ «لغة الإشارة» في المشغّل. يقبل رابط ملف mp4
   * أو صفحة يوتيوب/فيميو. تُضيفه الوزارة لاحقًا دون لمس الكود.
   */
  signLang?: string;
  /** نسخة مولّد المعاينة التي بُنيت بها — لإعادة التوليد عند تحسينه. */
  previewV?: number;
  subjectId: string;
  gradeId: string;
  unitId: string;
  lessonId: string;
  createdAt?: number;
}

export interface Lesson {
  id: string;
  title: string;
  activities: Activity[];
  /** العروض التقديمية الذكية للدرس — منفصلة عن أنشطته. */
  presentations?: Activity[];
  /** ألعاب السبورة الذكية المرتبطة بالدرس — منفصلة عن أنشطته ولا تُحسب ضمنها. */
  boardGames?: BoardGame[];
}

export interface Unit {
  id: string;
  title: string;
  summary?: string;
  color?: string;
  lessons: Lesson[];
}

export interface Grade {
  id: string;
  title: string; // e.g. "المستوى الثالث"
  units: Unit[];
}

export interface Subject {
  id: string;
  title: string; // e.g. "العلوم"
  titleEn: string;
  tagline: string;
  color: string; // primary accent
  accent: string;
  emoji: string;
  grades: Grade[];
}

export interface ActivityStats {
  views: number;
  downloads: number;
  /** عدد مرّات إكمال التقويم الختامي (محاولة = طالب أجاب كل الأسئلة). */
  attempts?: number;
  /** مجموع الإجابات الصحيحة في كل المحاولات. */
  correct?: number;
  /** مجموع الأسئلة المجابة في كل المحاولات. */
  total?: number;
  /** توزيع المحاولات يوميًا: { 'YYYY-MM-DD': n }. */
  attemptsByDay?: Record<string, number>;
  /** توزيع يومي للمشاهدات: { 'YYYY-MM-DD': n } (يبدأ من يوم تفعيله). */
  viewsByDay?: Record<string, number>;
  /** توزيع يومي للتنزيلات: { 'YYYY-MM-DD': n }. */
  downloadsByDay?: Record<string, number>;
}
