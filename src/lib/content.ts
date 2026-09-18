import { SUBJECTS, SEED_ACTIVITIES } from '@/data/curriculum';
import type { Subject, Activity, Lesson } from '@/lib/types';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Content service. Returns the curriculum tree with activities attached to
// their lessons. Merges bundled seed activities with any uploaded activities
// stored in Firestore (collection: "activities").
// ---------------------------------------------------------------------------

function cloneSubjects(): Subject[] {
  return JSON.parse(JSON.stringify(SUBJECTS)) as Subject[];
}

async function fetchUploadedActivities(): Promise<Activity[]> {
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
  const subjects = cloneSubjects();
  const uploaded = await fetchUploadedActivities();
  attachActivities(subjects, [...SEED_ACTIVITIES, ...uploaded]);
  return subjects;
}

export async function getAllActivities(): Promise<Activity[]> {
  const uploaded = await fetchUploadedActivities();
  const map = new Map<string, Activity>();
  for (const a of [...SEED_ACTIVITIES, ...uploaded]) map.set(a.id, a);
  return [...map.values()];
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
