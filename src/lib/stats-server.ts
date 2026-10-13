import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import { SCHOOL_BY_ID } from '@/data/qatar-schools';
import { LEGACY_SCHOOL_IDS } from '@/data/legacy-school-ids';

// ---------------------------------------------------------------------------
//  قراءة العدّادات المشتركة من الخادم وقت توليد الصفحة.
//
//  كانت الصفحة الرئيسية تُرسَل من الخادم بأصفار، ثم يقرأ المتصفّح الأرقام
//  الحقيقية بعد الفتح — فمن يفتح الصفحة (أو يلتقط لها صورة، أو يقرؤها بأداة
//  بلا JavaScript) يرى أصفارًا لثوانٍ أو دائمًا. هنا تُقرأ الأرقام في الخادم
//  نفسه وتُضمَّن في HTML، فتظهر القيم الفعلية فورًا، ثم يتابع الاشتراك الحيّ
//  في المتصفّح كل تحديث لاحق.
//
//  الصفحات التي تستدعي هذه الدوال تُعاد توليدها دوريًّا (revalidate)، فالأرقام
//  المضمَّنة تتجدّد تلقائيًّا بلا أي قراءة إضافية لكل زائر.
//
//  لا ترمي الدوال خطأً أبدًا: تعذّر القراءة يُعيد null فتُعرض الصفحة كما كانت.
// ---------------------------------------------------------------------------

export interface SiteTotals {
  visitors: number;
  views: number;
  downloads: number;
}

/** انتشار المنصّة كما تسجّله اختيارات المدارس قبل اللعب. */
export interface ReachSnapshot {
  /** عدد المدارس التي سجّل منها مستخدم واحد على الأقل. */
  schools: number;
  /** عدد بلديات قطر (من ثمانٍ) التي ظهرت فيها مدرسة مستخدمة. */
  municipalities: number;
}

/** أقصى انتظار للخادم: صفحة تتأخّر لثوانٍ أسوأ من رقم يصل بعد قليل. */
const SERVER_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** إجمالي الزوّار/المشاهدات/التنزيلات من stats/site، أو null إن تعذّر. */
export async function getSiteStatsServer(): Promise<SiteTotals | null> {
  if (!isFirebaseConfigured) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await withTimeout(getDoc(doc(db, 'stats', 'site')), SERVER_TIMEOUT_MS);
    if (!snap.exists()) return null;
    const d = snap.data() as Partial<SiteTotals>;
    return {
      visitors: Number(d.visitors) || 0,
      views: Number(d.views) || 0,
      downloads: Number(d.downloads) || 0,
    };
  } catch {
    return null;
  }
}

/** المعرّف الحالي لمعرّف مدرسة قديم (إن عُرف)، وإلا المعرّف كما هو. */
function canonicalSchoolId(id: string): string {
  if (SCHOOL_BY_ID[id]) return id;
  return LEGACY_SCHOOL_IDS[id]?.[0] || id;
}

/**
 * عدد المدارس والبلديات التي استُخدمت المنصّة منها، من schoolStats.
 * تُحتسب المدرسة إن سجّلت مستخدمًا أو تشغيلًا أو تنزيلًا واحدًا على الأقل.
 */
export async function getReachServer(): Promise<ReachSnapshot | null> {
  if (!isFirebaseConfigured) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await withTimeout(getDocs(collection(db, 'schoolStats')), SERVER_TIMEOUT_MS);
    const schools = new Set<string>();
    const municipalities = new Set<string>();
    snap.docs.forEach((d) => {
      const x = d.data() as { users?: number; count?: number; plays?: number; downloads?: number };
      const used = (x.users ?? x.count ?? 0) + (x.plays ?? 0) + (x.downloads ?? 0);
      if (used <= 0) return;
      const id = canonicalSchoolId(d.id);
      schools.add(id);
      const m = SCHOOL_BY_ID[id]?.municipalityId ?? LEGACY_SCHOOL_IDS[d.id]?.[2];
      if (m) municipalities.add(m);
    });
    return { schools: schools.size, municipalities: municipalities.size };
  } catch {
    return null;
  }
}
