import { SUBJECTS, SEED_ACTIVITIES } from '@/data/curriculum';
import type { Subject, Activity, Lesson } from '@/lib/types';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Content service. Returns the curriculum tree with activities attached to
// their lessons. Merges bundled seed activities with any uploaded activities
// stored in Firestore (collection: "activities").
// ---------------------------------------------------------------------------

function cloneSubjects(source: Subject[]): Subject[] {
  return JSON.parse(JSON.stringify(source)) as Subject[];
}

// Structure (subjects › grades › units › lessons, WITHOUT activities) can be
// overridden by an admin-edited Firestore doc: curriculum/tree.
async function fetchStructure(): Promise<Subject[] | null> {
  if (!isFirebaseConfigured) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'curriculum', 'tree'));
    if (snap.exists()) {
      const data = snap.data() as { subjects?: Subject[] };
      if (Array.isArray(data.subjects) && data.subjects.length) {
        return data.subjects;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Strip activities → a pure structure tree (for the structure editor/save). */
export function toStructure(subjects: Subject[]): Subject[] {
  return subjects.map((s) => ({
    ...s,
    grades: s.grades.map((g) => ({
      ...g,
      units: g.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({ ...l, activities: [] })),
      })),
    })),
  }));
}

export async function getStructure(): Promise<Subject[]> {
  const fromDb = await fetchStructure();
  return toStructure(cloneSubjects(fromDb ?? SUBJECTS));
}

export async function saveStructure(subjects: Subject[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'curriculum', 'tree'), {
    subjects: toStructure(subjects),
    updatedAt: Date.now(),
  });
}

/** الأنشطة المرفوعة كما هي في Firestore الآن (تعمل في الخادم والمتصفّح). */
export async function fetchUploadedActivities(): Promise<Activity[]> {
  if (!isFirebaseConfigured) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'activities'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }));
  } catch {
    return [];
  }
}

function attachActivities(subjects: Subject[], activities: Activity[]) {
  for (const a of activities) {
    const subject = subjects.find((s) => s.id === a.subjectId);
    const grade = subject?.grades.find((g) => g.id === a.gradeId);
    const unit = grade?.units.find((u) => u.id === a.unitId);
    const lesson = unit?.lessons.find((l) => l.id === a.lessonId);
    if (lesson) {
      if (!lesson.activities.some((x) => x.id === a.id)) lesson.activities.push(a);
    }
  }
}

export async function getSubjects(): Promise<Subject[]> {
  const [structure, uploaded] = await Promise.all([
    fetchStructure(),
    fetchUploadedActivities(),
  ]);
  const subjects = cloneSubjects(structure ?? SUBJECTS);
  attachActivities(subjects, [...SEED_ACTIVITIES, ...uploaded]);
  return subjects;
}

export async function getAllActivities(): Promise<Activity[]> {
  const uploaded = await fetchUploadedActivities();
  const map = new Map<string, Activity>();
  for (const a of [...SEED_ACTIVITIES, ...uploaded]) map.set(a.id, a);
  return [...map.values()];
}

/**
 * أنشطة مادة واحدة كما هي في Firestore الآن (لا كما كانت وقت البناء).
 * تُستخدم من المتصفّح ليرى المالك ما رفعه فورًا قبل إعادة توليد الصفحة.
 */
export async function getUploadedActivitiesFor(
  subjectId: string
): Promise<Activity[]> {
  if (!isFirebaseConfigured) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(db, 'activities'), where('subjectId', '==', subjectId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }));
  } catch {
    return [];
  }
}

/** نشاط واحد كما هو في Firestore الآن (قراءة وثيقة واحدة فقط). */
export async function getActivityLive(id: string): Promise<Activity | null> {
  if (!isFirebaseConfigured) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'activities', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Activity, 'id'>) };
  } catch {
    return null;
  }
}

/** Uploaded (Firestore) activity ids — these are editable/deletable in admin. */
export async function getUploadedActivityIds(): Promise<Set<string>> {
  const uploaded = await fetchUploadedActivities();
  return new Set(uploaded.map((a) => a.id));
}

export const SEED_ACTIVITY_IDS = new Set(SEED_ACTIVITIES.map((a) => a.id));

export async function deleteActivity(id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  // احذف أجزاء الملف أولًا — حذف الوثيقة الأمّ في Firestore لا يحذف
  // مجموعاتها الفرعية، فتبقى الأجزاء تستهلك المساحة بلا صاحب.
  const { deleteGameChunks } = await import('@/lib/game-store');
  await deleteGameChunks(id);
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'activities', id));
}

export async function updateActivity(
  id: string,
  patch: Partial<Activity>
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  // Firestore يرفض أي حقل قيمته undefined فيفشل الحفظ كلّه — أزِلها أولًا
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => v !== undefined && k !== 'id')
  );
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'activities', id), clean, { merge: true });
}

export async function getActivity(id: string): Promise<Activity | null> {
  const all = await getAllActivities();
  return all.find((a) => a.id === id) ?? null;
}

export async function getSubject(id: string): Promise<Subject | null> {
  const subjects = await getSubjects();
  return subjects.find((s) => s.id === id) ?? null;
}

// Utility: resolve the location labels for an activity (for breadcrumbs).
export function locateActivity(subjects: Subject[], activity: Activity) {
  const subject = subjects.find((s) => s.id === activity.subjectId);
  const grade = subject?.grades.find((g) => g.id === activity.gradeId);
  const unit = grade?.units.find((u) => u.id === activity.unitId);
  const lesson = unit?.lessons.find((l) => l.id === activity.lessonId);
  return { subject, grade, unit, lesson };
}

// Flatten helper for counting.
export function countActivities(subjects: Subject[]): number {
  let n = 0;
  for (const s of subjects)
    for (const g of s.grades)
      for (const u of g.units)
        for (const l of u.lessons) n += l.activities.length;
  return n;
}

export type { Lesson };
