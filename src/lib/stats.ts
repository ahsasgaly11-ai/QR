import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import type { ActivityStats } from '@/lib/types';

// ---------------------------------------------------------------------------
// Stats service — visitors, views, downloads.
// Uses Firestore atomic counters when configured (shared across all visitors);
// otherwise falls back to per-browser localStorage so the UI stays functional
// in demo mode.
//   Firestore layout:
//     stats/site               { visitors, views, downloads }
//     activityStats/{id}       { views, downloads }
// ---------------------------------------------------------------------------

const LS_KEY = 'qa-curriculum-stats-v1';

interface LocalStore {
  site: { visitors: number; views: number; downloads: number };
  activities: Record<string, ActivityStats>;
  seenVisitDay?: string;
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
  // Seed with lively baseline numbers so demo mode doesn't look empty.
  return {
    site: { visitors: 1284, views: 3960, downloads: 742 },
    activities: {
      'muscle-3d': { views: 1180, downloads: 305 },
      'muscle-quiz': { views: 640, downloads: 96 },
      'states-of-matter': { views: 910, downloads: 214 },
      'plant-parts': { views: 730, downloads: 127 },
    },
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
export async function trackVisit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const local = readLocal();
  if (local.seenVisitDay === today) return;
  local.seenVisitDay = today;
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
  } catch {
    /* ignore */
  }
}

export async function trackView(activityId: string): Promise<void> {
  const local = readLocal();
  const a = (local.activities[activityId] ??= { views: 0, downloads: 0 });
  a.views += 1;
  local.site.views += 1;
  writeLocal(local);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await Promise.all([
      setDoc(
        doc(db, 'activityStats', activityId),
        { views: increment(1) },
        { merge: true }
      ),
      setDoc(doc(db, 'stats', 'site'), { views: increment(1) }, { merge: true }),
    ]);
  } catch {
    /* ignore */
  }
}

export async function trackDownload(activityId: string): Promise<void> {
  const local = readLocal();
  const a = (local.activities[activityId] ??= { views: 0, downloads: 0 });
  a.downloads += 1;
  local.site.downloads += 1;
  writeLocal(local);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await Promise.all([
      setDoc(
        doc(db, 'activityStats', activityId),
        { downloads: increment(1) },
        { merge: true }
      ),
      setDoc(
        doc(db, 'stats', 'site'),
        { downloads: increment(1) },
        { merge: true }
      ),
    ]);
  } catch {
    /* ignore */
  }
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
    if (snap.exists()) {
      const d = snap.data() as Partial<LocalStore['site']>;
      return {
        visitors: d.visitors ?? 0,
        views: d.views ?? 0,
        downloads: d.downloads ?? 0,
      };
    }
  } catch {
    /* ignore */
  }
  return local.site;
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
    if (snap.exists()) {
      const d = snap.data() as Partial<ActivityStats>;
      return { views: d.views ?? 0, downloads: d.downloads ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return fallback;
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
    const out: Record<string, ActivityStats> = { ...local.activities };
    snap.docs.forEach((d) => {
      const data = d.data() as Partial<ActivityStats>;
      out[d.id] = { views: data.views ?? 0, downloads: data.downloads ?? 0 };
    });
    return out;
  } catch {
    return local.activities;
  }
}
