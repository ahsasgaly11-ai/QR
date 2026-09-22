// ---------------------------------------------------------------------------
//  حالة المدرسة المختارة + عدّادات المستخدمين لكل مدرسة (للخريطة الحرارية).
//
//  • الاختيار يُحفظ في متصفّح المستخدم (localStorage) فيبقى بين الجلسات.
//  • عند أوّل اختيار على هذا المتصفّح يُزاد عدّاد مدرسته في Firestore بمقدار 1
//    (مثل عدّادات المشاهدات/التنزيلات)، فتُبنى خريطة حرارية حقيقية من اختيارات
//    كل المستخدمين. بلا Firebase يُحتسب محليًا فقط (وضع العرض).
//
//  تخطيط Firestore:
//    schoolStats/{schoolId}   { count: number }
// ---------------------------------------------------------------------------

import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import { type QatarSchool } from '@/data/qatar-schools';

const SEL_KEY = 'qa-school-v1';
const COUNTED_KEY = 'qa-school-counted-v1';
const LOCAL_STATS_KEY = 'qa-school-stats-v1';
/** حدث داخلي يُطلق عند تغيّر المدرسة المختارة (لتحديث الواجهة فورًا). */
export const SCHOOL_EVENT = 'qa-school-change';

export interface StoredSchool {
  id: string;
  name: string;
  municipalityId: string;
}

// --- الاختيار الحالي --------------------------------------------------------
export function getSelectedSchool(): StoredSchool | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSchool;
    // نحتفظ بالاسم والبلدية المخزّنَين حتى لو تغيّرت معرّفات القائمة في تحديث
    // لاحق، فلا يُعاد حجب المستخدم؛ ومؤشّر «مدرستك» على الخريطة يُحلّ بأمان
    // (يغيب إن لم يعُد المعرّف موجودًا) بدل إسقاط الاختيار كلّه.
    return parsed?.id && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function setSelectedSchool(school: QatarSchool): void {
  if (typeof window === 'undefined') return;
  const stored: StoredSchool = {
    id: school.id,
    name: school.name,
    municipalityId: school.municipalityId,
  };
  try {
    localStorage.setItem(SEL_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
  // احتسب المستخدم في الخريطة الحرارية (مرّة واحدة لكل مدرسة على هذا المتصفّح).
  void countSchoolUser(school.id);
  notify();
}

export function clearSelectedSchool(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEL_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

function notify() {
  try {
    window.dispatchEvent(new Event(SCHOOL_EVENT));
  } catch {
    /* ignore */
  }
}

/** اشترك في تغيّر المدرسة المختارة؛ تُعيد دالة إلغاء الاشتراك. */
export function onSchoolChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SCHOOL_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(SCHOOL_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// --- عدّادات المستخدمين لكل مدرسة -------------------------------------------
function readLocalStats(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeLocalStats(stats: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

/** يزيد عدّاد المدرسة مرّة واحدة فقط لكل مدرسة على هذا المتصفّح. */
async function countSchoolUser(schoolId: string): Promise<void> {
  let counted: string[] = [];
  try {
    counted = JSON.parse(localStorage.getItem(COUNTED_KEY) || '[]');
  } catch {
    counted = [];
  }
  if (counted.includes(schoolId)) return;
  counted.push(schoolId);
  try {
    localStorage.setItem(COUNTED_KEY, JSON.stringify(counted));
  } catch {
    /* ignore */
  }

  // عدّاد محلي (يعمل دائمًا، ويشكّل الاحتياطي في وضع العرض).
  const local = readLocalStats();
  local[schoolId] = (local[schoolId] ?? 0) + 1;
  writeLocalStats(local);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolStats', schoolId),
      { count: increment(1) },
      { merge: true }
    );
  } catch {
    /* ignore */
  }
}

/** يقرأ عدّادات كل المدارس (Firestore عند التفعيل، وإلا محليًا). */
export async function getSchoolStats(): Promise<Record<string, number>> {
  const local = readLocalStats();
  if (!isFirebaseConfigured) return local;
  const db = getDb();
  if (!db) return local;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'schoolStats'));
    const out: Record<string, number> = { ...local };
    snap.docs.forEach((d) => {
      const data = d.data() as { count?: number };
      out[d.id] = data.count ?? 0;
    });
    return out;
  } catch {
    return local;
  }
}
