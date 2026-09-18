import type { Activity, Subject } from '@/lib/types';

// ---------------------------------------------------------------------------
// وضع العرض المحلي (Local preview store)
//
// عند عدم إعداد Firebase، تُحفَظ الأنشطة المرفوعة داخل متصفّح المستخدم:
//   • ملف الـ HTML نفسه في IndexedDB (يتحمّل ملفات بحجم عدة ميجابايت)
//   • بنية المناهج المعدّلة (وحدات/دروس جديدة) في localStorage
// هذا يجعل النشاط قابلًا للتشغيل والتحميل فورًا بعد الرفع — لكنه يبقى
// داخل هذا المتصفّح فقط إلى أن يُفعَّل Firebase للمشاركة مع الزوّار.
// ---------------------------------------------------------------------------

const DB_NAME = 'qa-curriculum';
const STORE = 'activities';
const DB_VERSION = 1;
const STRUCTURE_KEY = 'qa-local-structure-v1';

export interface LocalRecord {
  id: string;
  activity: Activity;
  html: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return new Promise(async (resolve) => {
    const db = await openDb();
    if (!db) return resolve(null);
    try {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** يحفظ نشاطًا مرفوعًا مع محتوى ملف الـ HTML داخل المتصفّح. */
export async function saveLocalActivity(
  activity: Activity,
  html: string
): Promise<boolean> {
  const rec: LocalRecord = { id: activity.id, activity, html, savedAt: Date.now() };
  const res = await tx('readwrite', (s) => s.put(rec) as IDBRequest<IDBValidKey>);
  return res !== null;
}

export async function getLocalRecord(id: string): Promise<LocalRecord | null> {
  const res = await tx<LocalRecord>('readonly', (s) => s.get(id));
  return res ?? null;
}

export async function listLocalActivities(): Promise<Activity[]> {
  const res = await tx<LocalRecord[]>('readonly', (s) => s.getAll());
  if (!res) return [];
  return res
    .filter((r) => r && r.activity)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .map((r) => ({ ...r.activity, local: true }));
}

export async function deleteLocalActivity(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** ينشئ رابط Blob لتشغيل/تحميل النشاط المخزّن محليًا. */
export function htmlToBlobUrl(html: string): string {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

// --- بنية المناهج المحلّية (وحدات/دروس أُنشئت في وضع العرض) ----------------

export function getLocalStructure(): Subject[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STRUCTURE_KEY);
    return raw ? (JSON.parse(raw) as Subject[]) : null;
  } catch {
    return null;
  }
}

export function saveLocalStructure(subjects: Subject[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STRUCTURE_KEY, JSON.stringify(subjects));
  } catch {
    /* تجاهل (قد تمتلئ المساحة) */
  }
}

/**
 * يدمج الأنشطة المحلية (وبنية محلية إن وُجدت) في شجرة مادة قادمة من الخادم،
 * ويعيد نسخة جديدة دون المساس بالأصل.
 */
export function mergeLocalIntoSubject(
  subject: Subject,
  localStructure: Subject[] | null,
  localActivities: Activity[]
): Subject {
  const base =
    localStructure?.find((s) => s.id === subject.id) ?? subject;
  const merged = JSON.parse(JSON.stringify(base)) as Subject;

  for (const a of localActivities) {
    if (a.subjectId !== merged.id) continue;
    const grade = merged.grades.find((g) => g.id === a.gradeId);
    const unit = grade?.units.find((u) => u.id === a.unitId);
    const lesson = unit?.lessons.find((l) => l.id === a.lessonId);
    if (lesson && !lesson.activities.some((x) => x.id === a.id)) {
      lesson.activities.push(a);
    }
  }
  return merged;
}
