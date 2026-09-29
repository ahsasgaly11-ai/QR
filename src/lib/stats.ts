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

/** آخر إحصاءات أنشطة مشتركة قُرئت من Firestore (بديل عند تعثّر الاتصال). */
const SHARED_ACT_CACHE_KEY = 'qa-activity-stats-shared-v1';

function readSharedActivityCache(): Record<string, ActivityStats> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SHARED_ACT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActivityStats>) : {};
  } catch {
    return {};
  }
}

function writeSharedActivityCache(patch: Record<string, ActivityStats>, replace = false) {
  if (typeof window === 'undefined') return;
  try {
    const next = replace ? patch : { ...readSharedActivityCache(), ...patch };
    localStorage.setItem(SHARED_ACT_CACHE_KEY, JSON.stringify(next));
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
    const { doc, writeBatch, increment } = await import('firebase/firestore');
    // دفعة ذرّية: إمّا يُحتسب العدّادان معًا أو لا يُحتسب أيّ منهما، فلا
    // يبتعد إجمالي الموقع عن مجموع عدّادات الأنشطة مع الوقت.
    const batch = writeBatch(db);
    batch.set(doc(db, 'activityStats', activityId), { [field]: increment(1) }, { merge: true });
    batch.set(doc(db, 'stats', 'site'), { [field]: increment(1) }, { merge: true });
    await batch.commit();
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
/**
 * إحصاءات الموقع المشتركة. مع Firestore تُعاد الأرقام المشتركة وحدها — أو آخر
 * نسخة مشتركة معروفة عند تعثّر الاتصال، أو null إن لم تتوفّر — ولا تُعرض أبدًا
 * عدّادات هذا المتصفّح المحلية، وإلا رأى كل مستخدم رقمًا مختلفًا.
 */
export async function getSiteStats(): Promise<SiteStats | null> {
  await settleVisit();
  if (!isFirebaseConfigured) return readLocal().site;
  const db = getDb();
  if (!db) return getCachedSiteStats();
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
    return getCachedSiteStats();
  }
}

/**
 * اشتراك حيّ في إحصاءات الموقع: يصل كل تحديث مؤكَّد من الخادم فورًا، فيرى
 * جميع المستخدمين الأرقام نفسها في اللحظة نفسها دون إعادة تحميل الصفحة.
 * تُتجاهل اللقطات المحلية غير المؤكَّدة (كتابة لم يقبلها الخادم بعد).
 */
export function subscribeSiteStats(cb: (s: SiteStats) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const cached = getCachedSiteStats();
  if (cached) cb(cached);
  let alive = true;
  let unsub: (() => void) | null = null;

  (async () => {
    await settleVisit();
    if (!alive) return;
    if (!isFirebaseConfigured) {
      cb(readLocal().site);
      return;
    }
    const db = getDb();
    if (!db) return;
    const { doc, onSnapshot } = await import('firebase/firestore');
    if (!alive) return;
    unsub = onSnapshot(
      doc(db, 'stats', 'site'),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
        const d = (snap.exists() ? snap.data() : {}) as Partial<SiteStats>;
        const out = {
          visitors: d.visitors ?? 0,
          views: d.views ?? 0,
          downloads: d.downloads ?? 0,
        };
        writeCachedSiteStats(out);
        cb(out);
      },
      (e) => reportSyncError(e, 'قراءة إحصاءات الموقع')
    );
  })().catch((e) => reportSyncError(e, 'قراءة إحصاءات الموقع'));

  return () => {
    alive = false;
    unsub?.();
  };
}

export async function getActivityStats(id: string): Promise<ActivityStats> {
  if (!isFirebaseConfigured) return readLocal().activities[id] ?? { views: 0, downloads: 0 };
  // عند التعثّر: آخر رقم مشترك معروف، لا عدّاد هذا المتصفّح.
  const fallback = readSharedActivityCache()[id] ?? { views: 0, downloads: 0 };
  const db = getDb();
  if (!db) return fallback;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await withTimeout(
      getDoc(doc(db, 'activityStats', id)),
      READ_TIMEOUT_MS
    );
    const d = (snap.exists() ? snap.data() : {}) as Partial<ActivityStats>;
    const out = { views: d.views ?? 0, downloads: d.downloads ?? 0 };
    if (!snap.metadata.fromCache) writeSharedActivityCache({ [id]: out });
    return out;
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات النشاط');
    return fallback;
  }
}

export async function getAllActivityStats(): Promise<
  Record<string, ActivityStats>
> {
  if (!isFirebaseConfigured) return readLocal().activities;
  const db = getDb();
  if (!db) return readSharedActivityCache();
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
    if (!snap.metadata.fromCache) writeSharedActivityCache(out, true);
    return out;
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات الأنشطة');
    return readSharedActivityCache();
  }
}
