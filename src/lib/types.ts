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

export interface Activity {
  id: string;
  title: string;
  description?: string;
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
}
