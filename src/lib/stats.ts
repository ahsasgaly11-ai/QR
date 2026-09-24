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

interface LocalStore {
  site: { visitors: number; views: number; downloads: number };
  activities: Record<string, ActivityStats>;
  seenVisitDay?: string;
  /** آخر يوم احتُسبت فيه الزيارة في Firestore فعليًا. */
  syncedVisitDay?: string;
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

// --- visitor tracking (once per browser per day) ---------------------------
let visitInFlight = false;

export async function trackVisit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const local = readLocal();
  if (local.seenVisitDay !== today) {
    local.seenVisitDay = today;
    local.site.visitors += 1;
    writeLocal(local);
  }
  // الاحتساب المشترك يُعلَّم منفصلًا، فلا يُعدّ اليوم محتسبًا إلا بعد نجاح
  // الحفظ في Firestore — وإن فشل تُعاد المحاولة في الزيارة التالية.
  if (local.syncedVisitDay === today || visitInFlight) return;

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  visitInFlight = true;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'stats', 'site'),
      { visitors: increment(1) },
      { merge: true }
    );
    const after = readLocal();
    after.syncedVisitDay = today;
    writeLocal(after);
    reportSyncOk();
  } catch (e) {
    reportSyncError(e, 'حفظ عدّاد الزوّار');
  } finally {
    visitInFlight = false;
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
export async function getSiteStats(): Promise<{
  visitors: number;
  views: number;
  downloads: number;
}> {
  const local = readLocal();
  if (!isFirebaseConfigured) return local.site;
  const db = getDb();
  if (!db) return local.site;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'stats', 'site'));
    const d = (snap.exists() ? snap.data() : {}) as Partial<LocalStore['site']>;
    return {
      visitors: d.visitors ?? 0,
      views: d.views ?? 0,
      downloads: d.downloads ?? 0,
    };
  } catch (e) {
    reportSyncError(e, 'قراءة إحصاءات الموقع');
    return local.site;
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
    const snap = await getDoc(doc(db, 'activityStats', id));
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
    const snap = await getDocs(collection(db, 'activityStats'));
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
