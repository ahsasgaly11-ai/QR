import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// فحص صحّة التتبّع — GET /api/stats/health
//
// لوحة الإحصاءات تقرأ العدّادات في المتصفّح، فإن ظهرت أصفارًا لا يُعرف إن كان
// السبب «لا بيانات بعد» أم «الكتابة مرفوضة» أم «الشبكة محجوبة في هذا الجهاز».
// هذا المسار يقرأ العدّادات المشتركة من الخادم مباشرةً عبر Firestore REST
// (القراءة عامة بحسب firestore.rules) ويُعيد تشخيصًا واضحًا بلا أي كتابة.
//
// لا يحتاج صلاحيات: لا يعرض إلا ما يراه أي زائر أصلًا، ولا يُظهر المفتاح.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
const CONFIGURED = Boolean(PROJECT_ID && API_KEY);
const FETCH_TIMEOUT_MS = 8000;

type FsValue = { integerValue?: string; doubleValue?: number };
type FsDoc = { name?: string; fields?: Record<string, FsValue>; updateTime?: string };
type FsList = { documents?: FsDoc[]; nextPageToken?: string };
type FsError = { error?: { code?: number; status?: string; message?: string } };

function baseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    PROJECT_ID
  )}/databases/(default)/documents`;
}

function num(v: FsValue | undefined): number {
  if (!v) return 0;
  if (v.integerValue !== undefined) return Number(v.integerValue) || 0;
  if (v.doubleValue !== undefined) return Number(v.doubleValue) || 0;
  return 0;
}

async function fsGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${baseUrl()}/${path}`);
  url.searchParams.set('key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as unknown;
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function errStatus(json: unknown): string {
  return (json as FsError)?.error?.status ?? 'UNKNOWN';
}

/** يقرأ مجموعة كاملة (بحقول محدّدة) ويُعيد مستنداتها. */
async function fsListAll(collection: string, fields: string[]): Promise<FsDoc[]> {
  const out: FsDoc[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${baseUrl()}/${collection}`);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '300');
    for (const f of fields) url.searchParams.append('mask.fieldPaths', f);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw Object.assign(new Error('list-failed'), { status: res.status });
      const json = (await res.json()) as FsList;
      out.push(...(json.documents ?? []));
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    } finally {
      clearTimeout(t);
    }
  }
  return out;
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!CONFIGURED) {
    return NextResponse.json({
      ok: false,
      mode: 'local',
      configured: false,
      checkedAt,
      diagnosis:
        'متغيّرات NEXT_PUBLIC_FIREBASE_* غير مضبوطة في هذا النشر، فالعدّادات محلية في كل متصفّح ولا توجد إحصاءات مشتركة.',
      hints: [
        'أضِف NEXT_PUBLIC_FIREBASE_API_KEY و NEXT_PUBLIC_FIREBASE_PROJECT_ID (وبقية القيم) في إعدادات الاستضافة ثم أعد النشر.',
      ],
    });
  }

  // 1) وثيقة إجمالي الموقع
  let site: { visitors: number; views: number; downloads: number } | null = null;
  let siteDoc: 'exists' | 'missing' | 'denied' | 'unreachable' = 'unreachable';
  let siteUpdatedAt: string | null = null;
  let siteError: string | null = null;
  try {
    const { status, json } = await fsGet('stats/site');
    if (status === 200) {
      const d = json as FsDoc;
      site = {
        visitors: num(d.fields?.visitors),
        views: num(d.fields?.views),
        downloads: num(d.fields?.downloads),
      };
      siteUpdatedAt = d.updateTime ?? null;
      siteDoc = 'exists';
    } else if (status === 404) {
      siteDoc = 'missing';
    } else if (status === 403 || errStatus(json) === 'PERMISSION_DENIED') {
      siteDoc = 'denied';
      siteError = errStatus(json);
    } else {
      siteError = `${status} ${errStatus(json)}`;
    }
  } catch (e) {
    siteError = (e as Error)?.name === 'AbortError' ? 'timeout' : 'network';
  }

  // 2) عدد الأنشطة والمدارس التي سُجّلت لها أرقام (لا نقرأ إلا الحقول العدديّة)
  let activitiesTracked: number | null = null;
  let activityViews = 0;
  let activityDownloads = 0;
  let schoolsTracked: number | null = null;
  if (siteDoc === 'exists' || siteDoc === 'missing') {
    try {
      const docs = await fsListAll('activityStats', ['views', 'downloads']);
      activitiesTracked = docs.length;
      for (const d of docs) {
        activityViews += num(d.fields?.views);
        activityDownloads += num(d.fields?.downloads);
      }
    } catch {
      /* يبقى null */
    }
    try {
      const docs = await fsListAll('schoolStats', ['users']);
      schoolsTracked = docs.length;
    } catch {
      /* يبقى null */
    }
  }

  // 3) التشخيص
  let diagnosis: string;
  const hints: string[] = [];
  let ok = false;
  if (siteDoc === 'denied') {
    diagnosis =
      'Firestore يرفض قراءة stats/site (PERMISSION_DENIED): القواعد المنشورة على المشروع ليست قواعد المنصّة، فلا تُحفظ الإحصاءات ولا تُقرأ.';
    hints.push('انشر ملف firestore.rules: firebase deploy --only firestore:rules --project ' + PROJECT_ID);
  } else if (siteDoc === 'unreachable') {
    diagnosis = `تعذّر الوصول إلى Firestore من الخادم (${siteError ?? 'unknown'}).`;
    hints.push('تحقّق من صحّة NEXT_PUBLIC_FIREBASE_PROJECT_ID و NEXT_PUBLIC_FIREBASE_API_KEY، ومن أن Cloud Firestore مفعّل في المشروع.');
  } else if (siteDoc === 'missing') {
    diagnosis =
      'وثيقة stats/site غير موجودة: لم تنجح أي كتابة للعدّادات حتى الآن. كل دخول للموقع يحاول زيادة عدّاد الزوّار، فغياب الوثيقة يعني غالبًا أن قواعد firestore.rules لم تُنشر على المشروع.';
    hints.push('انشر القواعد: firebase deploy --only firestore:rules --project ' + PROJECT_ID);
    hints.push('ثم افتح الموقع في متصفّح وأعد فحص هذا المسار؛ يجب أن تظهر الوثيقة بزائر واحد على الأقل.');
  } else if (site && site.visitors + site.views + site.downloads === 0) {
    diagnosis = 'الوثيقة موجودة لكن كل العدّادات صفر — أُنشئت دون أن تُزاد.';
    hints.push('افتح أي نشاط في المتصفّح وراقب Console: رسائل [stats] تبيّن سبب رفض الزيادة إن وُجد.');
  } else {
    ok = true;
    diagnosis =
      'التتبّع يعمل: العدّادات المشتركة محفوظة في Firestore وتُقرأ من الخادم. إن ظهرت أصفار في لوحة الإحصاءات على جهاز ما فالسبب في ذلك الجهاز (حجب خدمات Google أو شبكة بطيئة أو قراءة الصفحة بلا JavaScript).';
  }

  return NextResponse.json({
    ok,
    mode: 'firestore',
    configured: true,
    projectId: PROJECT_ID,
    checkedAt,
    site,
    siteDoc,
    siteUpdatedAt,
    siteError,
    activitiesTracked,
    activityViews,
    activityDownloads,
    schoolsTracked,
    diagnosis,
    hints,
  });
}
