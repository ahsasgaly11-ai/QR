// ---------------------------------------------------------------------------
//  «أثر التعلّم»: آراء المعلّمين والطلبة بعد تجربة المنصّة — يحرّرها المشرف
//  من لوحة التحكّم وتظهر في قسم «أثر التعلّم» في الصفحة الرئيسية.
//
//  تُحفظ في وثيقة Firestore واحدة: curriculum/impact
//  (مجموعة curriculum قواعدها منشورة أصلًا: قراءة عامة، وكتابة للمالك وحده،
//  فلا يلزم تعديل قواعد الأمان.)
//
//  الصفحة الرئيسية تقرأ الوثيقة في الخادم وقت التوليد (فتظهر الآراء في HTML
//  فورًا)، ثم يستمع المكوّن للوثيقة في المتصفّح فيصل أي تعديل ينشره المشرف
//  إلى الزوّار في اللحظة نفسها. وبلا Firebase (وضع العرض) تُحفظ في هذا
//  المتصفّح فقط.
//
//  لا تُشحن المنصّة بآراء افتراضية: ما يظهر هنا هو ما يكتبه المشرف فعلًا.
// ---------------------------------------------------------------------------

import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export const IMPACT_ROLES = {
  teacher: 'معلّم/ة',
  student: 'طالب/ة',
  parent: 'وليّ أمر',
  supervisor: 'مشرف/ة تربوي/ة',
} as const;

export type ImpactRole = keyof typeof IMPACT_ROLES;

export interface Testimonial {
  /** اسم صاحب الرأي (أو وصفه إن فضّل عدم ذكر الاسم) */
  name: string;
  role: ImpactRole;
  /** المدرسة أو الصف — اختياري */
  school: string;
  /** نص الرأي أو النتيجة الملحوظة */
  quote: string;
}

export interface ImpactSettings {
  /** إظهار قسم الآراء أو إخفاؤه لكل الزوّار */
  enabled: boolean;
  items: Testimonial[];
}

export const IMPACT_LIMITS = { name: 60, school: 80, quote: 320, items: 8 };

export const DEFAULT_IMPACT: ImpactSettings = { enabled: true, items: [] };

const DOC_PATH = ['curriculum', 'impact'] as const;
const CACHE_KEY = 'qa-impact-v1';
const LOCAL_EVENT = 'qa-impact-change';

/** ينظّف البيانات الواردة (من Firestore أو التخزين) ويتجاهل الآراء الفارغة. */
export function normalizeImpact(raw: unknown): ImpactSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { enabled?: unknown; items?: unknown };
  if (!Array.isArray(r.items)) return null;
  const items: Testimonial[] = [];
  for (const m of r.items.slice(0, IMPACT_LIMITS.items)) {
    if (!m || typeof m !== 'object') continue;
    const x = m as Partial<Record<keyof Testimonial, unknown>>;
    const quote =
      typeof x.quote === 'string' ? x.quote.trim().slice(0, IMPACT_LIMITS.quote) : '';
    if (!quote) continue;
    const name = typeof x.name === 'string' ? x.name.trim().slice(0, IMPACT_LIMITS.name) : '';
    const school =
      typeof x.school === 'string' ? x.school.trim().slice(0, IMPACT_LIMITS.school) : '';
    const role =
      typeof x.role === 'string' && x.role in IMPACT_ROLES ? (x.role as ImpactRole) : 'teacher';
    items.push({ name, role, school, quote });
  }
  return { enabled: r.enabled !== false, items };
}

function readCache(): ImpactSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeImpact(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(s: ImpactSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * يقرأ الآراء في الخادم وقت توليد الصفحة (لا يرمي خطأً أبدًا).
 * يُعيد الافتراضي (بلا آراء) بلا Firebase أو عند تعذّر القراءة.
 */
export async function fetchImpactServer(): Promise<ImpactSettings> {
  if (!isFirebaseConfigured) return DEFAULT_IMPACT;
  const db = getDb();
  if (!db) return DEFAULT_IMPACT;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, ...DOC_PATH));
    return (snap.exists() && normalizeImpact(snap.data())) || DEFAULT_IMPACT;
  } catch {
    return DEFAULT_IMPACT;
  }
}

/**
 * يشترك في الآراء من المتصفّح. يستدعي cb بكل نسخة جديدة ينشرها المشرف.
 * لا يستدعيها بالنسخة الافتراضية إطلاقًا: الصفحة تحمل أصلًا ما قرأه الخادم.
 * يُعيد دالة إلغاء الاشتراك.
 */
export function subscribeImpact(cb: (s: ImpactSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!isFirebaseConfigured) {
    const onLocal = () => cb(readCache() ?? DEFAULT_IMPACT);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY) onLocal();
    };
    onLocal();
    window.addEventListener(LOCAL_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOCAL_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }

  const db = getDb();
  if (!db) return () => {};

  let unsub: (() => void) | null = null;
  let cancelled = false;
  import('firebase/firestore')
    .then(({ doc, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, ...DOC_PATH),
        (snap) => {
          // لقطة من ذاكرة المتصفّح قد تكون ناقصة؛ ننتظر ردّ الخادم.
          if (snap.metadata.fromCache) return;
          const s = (snap.exists() && normalizeImpact(snap.data())) || DEFAULT_IMPACT;
          writeCache(s);
          cb(s);
        },
        () => {
          /* تعذّرت القراءة: تبقى نسخة الخادم المضمَّنة في الصفحة */
        }
      );
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** يقرأ الإعدادات الحالية مرّة واحدة (للوحة التحكّم). */
export async function getImpact(): Promise<ImpactSettings> {
  if (!isFirebaseConfigured) return readCache() ?? DEFAULT_IMPACT;
  const db = getDb();
  if (!db) return DEFAULT_IMPACT;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, ...DOC_PATH));
  return (snap.exists() && normalizeImpact(snap.data())) || DEFAULT_IMPACT;
}

/** ينشر الآراء لكل الزوّار (Firestore)، أو يحفظها محليًا في وضع العرض. */
export async function saveImpact(settings: ImpactSettings): Promise<void> {
  const clean = normalizeImpact(settings) ?? DEFAULT_IMPACT;
  if (!isFirebaseConfigured) {
    writeCache(clean);
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, ...DOC_PATH), { ...clean, updatedAt: Date.now() });
}
