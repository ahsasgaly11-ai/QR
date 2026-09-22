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
import { emptyMetric, type SchoolMetric } from '@/lib/heatmap-shared';

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

// --- مقاييس كل مدرسة (مستخدمون/لعب/تنزيل + توزيع يومي) ----------------------
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type MetricMap = Record<string, SchoolMetric>;

function readLocalStats(): MetricMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: MetricMap = {};
    for (const [id, v] of Object.entries(parsed)) {
      // ترقية الصيغة القديمة (رقم = عدد المستخدمين) إلى الصيغة الغنية.
      if (typeof v === 'number') out[id] = { ...emptyMetric(), users: v };
      else out[id] = { ...emptyMetric(), ...(v as Partial<SchoolMetric>) };
    }
    return out;
  } catch {
    return {};
  }
}

function writeLocalStats(stats: MetricMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

function bumpLocal(schoolId: string, apply: (m: SchoolMetric) => void) {
  const local = readLocalStats();
  const m = (local[schoolId] ??= emptyMetric());
  apply(m);
  writeLocalStats(local);
}

/** يزيد عدّاد المستخدمين مرّة واحدة فقط لكل مدرسة على هذا المتصفّح. */
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

  const d = today();
  bumpLocal(schoolId, (m) => {
    m.users += 1;
    m.days[d] = (m.days[d] || 0) + 1;
  });

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolStats', schoolId),
      { users: increment(1), days: { [d]: increment(1) } },
      { merge: true }
    );
  } catch {
    /* ignore */
  }
}

/** يسجّل تشغيل/تحميل لعبة على مدرسة المستخدم المختارة (يفصل الطبقات). */
async function bumpSchoolMetric(
  schoolId: string,
  field: 'plays' | 'downloads'
): Promise<void> {
  bumpLocal(schoolId, (m) => {
    m[field] += 1;
  });
  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolStats', schoolId),
      { [field]: increment(1) },
      { merge: true }
    );
  } catch {
    /* ignore */
  }
}

/** يُستدعى من المشغّل عند تشغيل لعبة (إن كانت هناك مدرسة مختارة). */
export function trackSchoolPlay(): void {
  const s = getSelectedSchool();
  if (s?.id) void bumpSchoolMetric(s.id, 'plays');
}

/** يُستدعى من المشغّل عند تحميل لعبة (إن كانت هناك مدرسة مختارة). */
export function trackSchoolDownload(): void {
  const s = getSelectedSchool();
  if (s?.id) void bumpSchoolMetric(s.id, 'downloads');
}

/** يقرأ مقاييس كل المدارس (Firestore عند التفعيل، وإلا محليًا). */
export async function getSchoolMetrics(): Promise<MetricMap> {
  const local = readLocalStats();
  if (!isFirebaseConfigured) return local;
  const db = getDb();
  if (!db) return local;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'schoolStats'));
    const out: MetricMap = { ...local };
    snap.docs.forEach((d) => {
      const data = d.data() as Partial<SchoolMetric> & { count?: number };
      out[d.id] = {
        users: data.users ?? data.count ?? 0, // count: توافق مع الصيغة القديمة
        plays: data.plays ?? 0,
        downloads: data.downloads ?? 0,
        days: (data.days as Record<string, number>) ?? {},
      };
    });
    return out;
  } catch {
    return local;
  }
}
