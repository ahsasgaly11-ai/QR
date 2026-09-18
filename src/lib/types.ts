// ---------------------------------------------------------------------------
// Domain model for the Qatar curriculum platform.
// Hierarchy:  Subject (المادة) › Grade/Level (المستوى) › Unit (الوحدة)
//             › Lesson (الدرس) › Activity/Game (نشاط/لعبة)
// A lesson can hold more than one activity.
// ---------------------------------------------------------------------------

export type ActivityType = 'experiment' | 'simulation' | 'quiz' | 'game';

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: string; color: string }
> = {
  experiment: { label: 'تجربة عملية', icon: 'flask', color: 'var(--maroon-700)' },
  simulation: { label: 'محاكاة', icon: 'atom', color: 'var(--maroon)' },
  quiz: { label: 'أسئلة تفاعلية', icon: 'help', color: 'var(--gold)' },
  game: { label: 'لعبة تعليمية', icon: 'gamepad', color: 'var(--maroon-300)' },
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
