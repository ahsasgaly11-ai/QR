import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import type { ActivityStats } from '@/lib/types';
import { reportSyncError, reportSyncOk } from '@/lib/stats-sync';

// ---------------------------------------------------------------------------
// Stats service — visitors, views, downloads.
// Uses Firestore atomic counters when configured (shared across all visitors);
// otherwise falls back to per-browser localStorage so the UI stays functional
// in demo mode. When Firestore is configured, reads show the shared counters
// only — never this browser's local tally — so every visitor and the admin see
// the same numbers, and write failures are surfaced via stats-sync.
//   Firestore layout:
//     stats/site               { visitors, views, downloads }
//     activityStats/{id}       { views, downloads }
// ---------------------------------------------------------------------------

const LS_KEY = 'qa-curriculum-stats-v1';
/** آخر أرقام مشتركة قُرئت من Firestore — تُعرض فورًا وعند تعثّر الاتصال. */
const SHARED_CACHE_KEY = 'qa-site-stats-shared-v1';

type SiteStats = { visitors: number; views: number; downloads: number };

/** أقصى انتظار لاحتساب زيارة الدخول الحالي قبل قراءة العدّادات. */
const VISIT_SETTLE_MS = 2500;
/** أقصى انتظار لقراءة Firestore قبل الرجوع إلى آخر أرقام معروفة. */
const READ_TIMEOUT_MS = 8000;

/**
 * وعود Firestore قد لا تُحسم أبدًا حين يتعذّر الاتصال (شبكة المدرسة، وضع
 * توفير البيانات، أو سفاري على iPad) — فتبقى البطاقات عالقة على «0».
 * هذه المهلة تضمن أن تنتهي القراءة دائمًا.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(Object.assign(new Error('timeout'), { code: 'deadline-exceeded' })),
      ms
    );
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

/** آخر أرقام مشتركة معروفة في هذا المتصفّح (أو null). */
export function getCachedSiteStats(): SiteStats | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHARED_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SiteStats>;
    return {
      visitors: Number(d.visitors) || 0,
      views: Number(d.views) || 0,
      downloads: Number(d.downloads) || 0,
    };
  } catch {
    return null;
  }
}

function writeCachedSiteStats(s: SiteStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHARED_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

interface LocalStore {
  site: { visitors: number; views: number; downloads: number };
  activities: Record<string, ActivityStats>;
}

function readLocal(): LocalStore {
  if (typeof window === 'undefined')
    return { site: { visitors: 0, views: 0, downloads: 0 }, activities: {} };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    /* ignore */
  }
  // Real counters start at zero — they grow as visitors interact.
  return {
    site: { visitors: 0, views: 0, downloads: 0 },
    activities: {},
  };
}

function writeLocal(store: LocalStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

// --- visitor tracking (every entry to the site) ----------------------------
//  يُحتسب كل دخول للموقع زيارةً جديدة — حتى لو تكرّر دخول الشخص نفسه في
//  اليوم نفسه. «الدخول» = تحميل الموقع في تبويب (فتح الرابط، إعادة فتحه،
//  أو تحديث الصفحة)؛ أمّا التنقّل بين الصفحات داخل الموقع فلا يُعدّ زيارة
//  جديدة. الحارس على مستوى الوحدة يمنع الاحتساب المزدوج (مثل تشغيل
//  useEffect مرّتين في وضع React Strict).
let visitPromise: Promise<void> | null = null;

export function trackVisit(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  visitPromise ??= recordVisit();
  return visitPromise;
}

async function recordVisit(): Promise<void> {
  const local = readLocal();
  local.site.visitors += 1;
  writeLocal(local);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'stats', 'site'),
      { visitors: increment(1) },
      { merge: true }
    );
    reportSyncOk();
  } catch (e) {
    reportSyncError(e, 'حفظ عدّاد الزوّار');
  }
}

/** ينتظر احتساب زيارة هذا الدخول (إن بدأت) حتى تشمل القراءةُ الزائرَ الحالي. */
async function settleVisit(): Promise<void> {
  if (!visitPromise) return;
  try {
    // لا ننتظر إلى الأبد: إن لم تصل الكتابة سريعًا نقرأ على أي حال.
    await withTimeout(visitPromise, VISIT_SETTLE_MS);
  } catch {
    /* ignore */
  }
}

/** يزيد حقلًا في activityStats/{id} و stats/site معًا (Firestore أو محليًا). */
async function bumpActivity(
  activityId: string,
  field: 'views' | 'downloads'
): Promise<void> {
  const local = readLocal();
  const a = (local.activities[activityId] ??= { views: 0, downloads: 0 });
  a[field] += 1;
  local.site[field] += 1;
  writeLocal(local);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await Promise.all([
      setDoc(
        doc(db, 'activityStats', activityId),
        { [field]: increment(1) },
        { merge: true }
      ),
      setDoc(doc(db, 'stats', 'site'), { [field]: increment(1) }, { merge: true }),
    ]);
    reportSyncOk();
  } catch (e) {
    reportSyncError(e, field === 'views' ? 'حفظ عدّاد المشاهدات' : 'حفظ عدّاد التنزيلات');
  }
}

export function trackView(activityId: string): Promise<void> {
  return bumpActivity(activityId, 'views');
}

export function trackDownload(activityId: string): Promise<void> {
  return bumpActivity(activityId, 'downloads');
}

// --- reads -----------------------------------------------------------------
export async function getSiteStats(): Promise<SiteStats> {
  await settleVisit();
  const local = readLocal();
  if (!isFirebaseConfigured) return local.site;
  const db = getDb();
  if (!db) return getCachedSiteStats() ?? local.site;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await withTimeout(getDoc(doc(db, 'stats', 'site')), READ_TIMEOUT_MS);
    // قراءة من ذاكرة Firestore المحلية (دون خادم) قد تكون ناقصة — لا نعرض
    // أصفارًا بدل الأرقام الحقيقية.
    if (snap.metadata.fromCache && !snap.exists()) {
      throw Object.assign(new Error('offline'), { code: 'unavailable' });
    }
    const d = (snap.exists() ? snap.data() : {}) as Partial<SiteStats>;
    const out = {
      visitors: d.visitors ?? 0,
      views: d.views ?? 0,
      downloads: d.downloads ?? 0,
    };
    if (!snap.metadata.fromCache) writeCachedSiteStats(out);
    return out;
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات الموقع');
    return getCachedSiteStats() ?? local.site;
  }
}

export async function getActivityStats(id: string): Promise<ActivityStats> {
  const local = readLocal();
  const fallback = local.activities[id] ?? { views: 0, downloads: 0 };
  if (!isFirebaseConfigured) return fallback;
  const db = getDb();
  if (!db) return fallback;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await withTimeout(
      getDoc(doc(db, 'activityStats', id)),
      READ_TIMEOUT_MS
    );
    const d = (snap.exists() ? snap.data() : {}) as Partial<ActivityStats>;
    return { views: d.views ?? 0, downloads: d.downloads ?? 0 };
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات النشاط');
    return fallback;
  }
}

export async function getAllActivityStats(): Promise<
  Record<string, ActivityStats>
> {
  const local = readLocal();
  if (!isFirebaseConfigured) return local.activities;
  const db = getDb();
  if (!db) return local.activities;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await withTimeout(
      getDocs(collection(db, 'activityStats')),
      READ_TIMEOUT_MS
    );
    const out: Record<string, ActivityStats> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as Partial<ActivityStats>;
      out[d.id] = { views: data.views ?? 0, downloads: data.downloads ?? 0 };
    });
    return out;
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات الأنشطة');
    return local.activities;
  }
}
