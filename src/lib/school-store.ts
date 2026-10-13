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
import { SCHOOL_BY_ID, resolveSchoolByName, type QatarSchool } from '@/data/qatar-schools';
import type { Activity } from '@/lib/types';
import { emptyMetric, type SchoolMetric } from '@/lib/heatmap-shared';
import { localDateKey, type SchoolActivityMetric } from '@/lib/heatmap-analytics';
import { reportSyncError, reportSyncOk } from '@/lib/stats-sync';

const SEL_KEY = 'qa-school-v1';
const COUNTED_KEY = 'qa-school-counted-v1';
const LOCAL_STATS_KEY = 'qa-school-stats-v1';
const LOCAL_ACTIVITY_STATS_KEY = 'qa-school-activity-stats-v1';
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
    // لاحق، فلا يُعاد حجب المستخدم.
    if (!parsed?.id || !parsed?.name) return null;
    return migrateSelection(parsed);
  } catch {
    return null;
  }
}

/**
 * معرّف مدرسة من قائمة سابقة لم يعد موجودًا → نجد المدرسة الحالية بالاسم
 * المخزّن ونحدّث الاختيار، وإلا بقي اللعب يُنسب لمعرّف قديم يظهر في اللوحة
 * «مدرسة غير معروفة» منفصلًا عن المدرسة نفسها. ننقل علامة «احتُسب» معه حتى لا
 * يُعدّ المستخدم مرّتين.
 */
function migrateSelection(stored: StoredSchool): StoredSchool {
  if (SCHOOL_BY_ID[stored.id]) return stored;
  const hit = resolveSchoolByName(stored.name, stored.municipalityId);
  if (!hit) return stored;
  const next: StoredSchool = { id: hit.id, name: hit.name, municipalityId: hit.municipalityId };
  try {
    localStorage.setItem(SEL_KEY, JSON.stringify(next));
    const counted = readCounted();
    if (counted.includes(stored.id) && !counted.includes(hit.id)) {
      counted.push(hit.id);
      localStorage.setItem(COUNTED_KEY, JSON.stringify(counted));
    }
  } catch {
    /* ignore */
  }
  return next;
}

/** المعرّف الحالي لمعرّف مدرسة (قديمًا كان أو حاليًا). */
async function canonicalizer(): Promise<(id: string) => string> {
  const { LEGACY_SCHOOL_IDS } = await import('@/data/legacy-school-ids');
  return (id: string) => (SCHOOL_BY_ID[id] ? id : LEGACY_SCHOOL_IDS[id]?.[0] || id);
}

/** اسم المدرسة وبلديتها لمعرّف قديم لم يُطابَق بيقين (للعرض فقط). */
export async function getLegacySchoolNames(): Promise<
  Record<string, { name: string; municipalityId: string }>
> {
  const { LEGACY_SCHOOL_IDS } = await import('@/data/legacy-school-ids');
  const out: Record<string, { name: string; municipalityId: string }> = {};
  for (const [id, [, name, mun]] of Object.entries(LEGACY_SCHOOL_IDS)) {
    out[id] = { name, municipalityId: mun };
  }
  return out;
}

function mergeMetric(a: SchoolMetric | undefined, b: SchoolMetric): SchoolMetric {
  if (!a) return { ...b, days: { ...b.days } };
  const days = { ...a.days };
  for (const [d, n] of Object.entries(b.days || {})) days[d] = (days[d] || 0) + (n || 0);
  return {
    users: a.users + b.users,
    plays: a.plays + b.plays,
    downloads: a.downloads + b.downloads,
    days,
  };
}

/** يدمج مقاييس المعرّفات القديمة في المدرسة الحالية المطابقة. */
async function canonicalMetrics(m: MetricMap): Promise<MetricMap> {
  const canon = await canonicalizer().catch(() => (id: string) => id);
  const out: MetricMap = {};
  for (const [id, metric] of Object.entries(m)) {
    const key = canon(id);
    out[key] = mergeMetric(out[key], metric);
  }
  return out;
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
  return localDateKey();
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

type ActivityMetricMap = Record<string, SchoolActivityMetric>;

function activityMetricKey(schoolId: string, activityId: string): string {
  return `${schoolId}::${activityId}`;
}

function firestoreActivityMetricId(schoolId: string, activityId: string): string {
  return `${encodeURIComponent(schoolId)}__${encodeURIComponent(activityId)}`;
}

function readLocalActivityStats(): ActivityMetricMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVITY_STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ActivityMetricMap;
  } catch {
    return {};
  }
}

function writeLocalActivityStats(stats: ActivityMetricMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ACTIVITY_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

function bumpLocalActivity(
  schoolId: string,
  activity: Activity,
  field: 'plays' | 'downloads',
  day: string,
  at: number
) {
  const all = readLocalActivityStats();
  const key = activityMetricKey(schoolId, activity.id);
  const row = (all[key] ??= {
    schoolId,
    activityId: activity.id,
    subjectId: activity.subjectId,
    gradeId: activity.gradeId,
    unitId: activity.unitId,
    plays: 0,
    downloads: 0,
    playsByDay: {},
    downloadsByDay: {},
    lastActiveAt: 0,
  });
  row[field] += 1;
  const daily = field === 'plays' ? row.playsByDay : row.downloadsByDay;
  daily[day] = (daily[day] || 0) + 1;
  row.lastActiveAt = Math.max(row.lastActiveAt || 0, at);
  writeLocalActivityStats(all);
}

function readCounted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COUNTED_KEY) || '[]');
  } catch {
    return [];
  }
}

function markCounted(schoolId: string) {
  const counted = readCounted();
  if (counted.includes(schoolId)) return;
  counted.push(schoolId);
  try {
    localStorage.setItem(COUNTED_KEY, JSON.stringify(counted));
  } catch {
    /* ignore */
  }
}

/** طلبات احتساب جارية — تمنع الاحتساب المزدوج قبل وصول ردّ Firestore. */
const inFlight = new Set<string>();

/**
 * يزيد عدّاد المستخدمين مرّة واحدة فقط لكل مدرسة على هذا المتصفّح.
 * مع Firestore لا تُعلَّم المدرسة كمحتسبة إلا بعد نجاح الحفظ، فإن فشل
 * (انقطاع أو قواعد غير منشورة) تُعاد المحاولة عند اللعب/التحميل التالي.
 */
async function countSchoolUser(schoolId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (readCounted().includes(schoolId) || inFlight.has(schoolId)) return;

  const d = today();
  if (!isFirebaseConfigured) {
    markCounted(schoolId);
    bumpLocal(schoolId, (m) => {
      m.users += 1;
      m.days[d] = (m.days[d] || 0) + 1;
    });
    return;
  }
  const db = getDb();
  if (!db) return;
  inFlight.add(schoolId);
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolStats', schoolId),
      { users: increment(1), days: { [d]: increment(1) } },
      { merge: true }
    );
    markCounted(schoolId);
    bumpLocal(schoolId, (m) => {
      m.users += 1;
      m.days[d] = (m.days[d] || 0) + 1;
    });
    reportSyncOk();
  } catch (e) {
    reportSyncError(e, 'حفظ مستخدم المدرسة للخريطة الحرارية');
  } finally {
    inFlight.delete(schoolId);
  }
}

/** يسجّل تشغيل/تحميل لعبة على المدرسة، مع تفصيل يومي وعلى مستوى النشاط. */
async function bumpSchoolMetric(
  schoolId: string,
  field: 'plays' | 'downloads',
  activity?: Activity
): Promise<void> {
  const day = today();
  const at = Date.now();
  const dayField = field === 'plays' ? 'playsByDay' : 'downloadsByDay';

  bumpLocal(schoolId, (m) => {
    m[field] += 1;
  });
  if (activity) bumpLocalActivity(schoolId, activity, field, day, at);

  if (!isFirebaseConfigured) return;
  const db = getDb();
  if (!db) return;

  // اكتب العداد القديم أولًا وبشكل مستقل. هكذا لا تتوقف العدادات الحالية
  // إن تأخر نشر قواعد مجموعة التحليلات التفصيلية الجديدة.
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolStats', schoolId),
      { [field]: increment(1) },
      { merge: true }
    );
    reportSyncOk();
  } catch (e) {
    reportSyncError(
      e,
      field === 'plays' ? 'حفظ مرّات اللعب للمدرسة' : 'حفظ تنزيلات المدرسة'
    );
    return;
  }

  if (!activity) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'schoolActivityStats', firestoreActivityMetricId(schoolId, activity.id)),
      {
        schoolId,
        activityId: activity.id,
        subjectId: activity.subjectId,
        gradeId: activity.gradeId,
        unitId: activity.unitId,
        [field]: increment(1),
        [dayField]: { [day]: increment(1) },
        lastActiveAt: at,
      },
      { merge: true }
    );
  } catch (e) {
    // لا نعتبر فشل الطبقة التفصيلية فشلًا للعدادات الأساسية؛ قد تكون القواعد
    // الجديدة لم تُنشر بعد، بينما عدادات المدرسة القديمة نجحت أعلاه.
    console.warn('[heatmap-analytics] detailed write failed', e);
  }
}

/** يُستدعى من المشغّل عند تشغيل لعبة (إن كانت هناك مدرسة مختارة). */
export function trackSchoolPlay(activity?: Activity): void {
  const s = getSelectedSchool();
  if (!s?.id) return;
  void countSchoolUser(s.id); // إعادة محاولة احتساب المستخدم إن فشل سابقًا
  void bumpSchoolMetric(s.id, 'plays', activity);
}

/** يُستدعى عند تحميل لعبة (إن كانت هناك مدرسة مختارة). */
export function trackSchoolDownload(activity?: Activity): void {
  const s = getSelectedSchool();
  if (!s?.id) return;
  void countSchoolUser(s.id);
  void bumpSchoolMetric(s.id, 'downloads', activity);
}

/** يقرأ مقاييس كل المدارس (Firestore عند التفعيل، وإلا محليًا). */
export async function getSchoolMetrics(): Promise<MetricMap> {
  return canonicalMetrics(await readSchoolMetrics());
}

async function readSchoolMetrics(): Promise<MetricMap> {
  const local = readLocalStats();
  if (!isFirebaseConfigured) return local;
  const db = getDb();
  if (!db) return local;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'schoolStats'));
    // المقاييس المشتركة فقط — لا نخلطها بعدّادات هذا المتصفّح، وإلا رأى
    // اللاعب أرقامًا لا يراها المشرف ولا غيره.
    const out: MetricMap = {};
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
  } catch (e) {
    reportSyncError(e, 'قراءة مقاييس المدارس', 'core', 'read');
    return local;
  }
}


/** يقرأ التفصيل مدرسة × نشاط المستخدم في فلاتر الوحدة/اللعبة والزمن. */
export async function getSchoolActivityMetrics(): Promise<SchoolActivityMetric[]> {
  const rows = await readSchoolActivityMetrics();
  const canon = await canonicalizer().catch(() => (id: string) => id);
  return rows.map((r) => ({ ...r, schoolId: canon(r.schoolId) }));
}

async function readSchoolActivityMetrics(): Promise<SchoolActivityMetric[]> {
  const local = Object.values(readLocalActivityStats());
  if (!isFirebaseConfigured) return local;
  const db = getDb();
  if (!db) return local;
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'schoolActivityStats'));
    return snap.docs.map((d) => {
      const x = d.data() as Partial<SchoolActivityMetric>;
      return {
        schoolId: String(x.schoolId || ''),
        activityId: String(x.activityId || ''),
        subjectId: String(x.subjectId || ''),
        gradeId: String(x.gradeId || ''),
        unitId: String(x.unitId || ''),
        plays: Number(x.plays) || 0,
        downloads: Number(x.downloads) || 0,
        playsByDay: (x.playsByDay as Record<string, number>) ?? {},
        downloadsByDay: (x.downloadsByDay as Record<string, number>) ?? {},
        lastActiveAt: Number(x.lastActiveAt) || 0,
      };
    }).filter((x) => x.schoolId && x.activityId);
  } catch (e) {
    // التحليلات التفصيلية طبقة إضافية؛ إن لم تُنشر قواعدها بعد
    // نعود للبيانات المحلية بدون تعطيل العدادات الأساسية أو إظهار إنذار للزائر.
    console.warn('[heatmap-analytics] detailed read failed', e);
    return local;
  }
}
