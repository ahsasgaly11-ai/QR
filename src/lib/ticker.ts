// ---------------------------------------------------------------------------
//  رسائل الشريط المتحرّك أسفل الصفحة — يحرّرها المشرف من لوحة التحكّم.
//
//  تُحفظ في وثيقة Firestore واحدة: curriculum/ticker
//  (مجموعة curriculum قواعدها منشورة أصلًا: قراءة عامة، وكتابة للمالك وحده،
//  فلا يلزم تعديل قواعد الأمان.)
//
//  يستمع الشريط للوثيقة مباشرة (onSnapshot)، فيصل أي تعديل ينشره المشرف إلى
//  كل زوّار الموقع فورًا — حتى من كانت الصفحة مفتوحة لديه — دون إعادة نشر
//  الموقع. وبلا Firebase (وضع العرض) تُحفظ في هذا المتصفّح فقط.
// ---------------------------------------------------------------------------

import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export const TICKER_ICONS = {
  sparkles: 'نجمة (رؤية)',
  quote: 'علامة اقتباس',
  megaphone: 'إعلان',
  star: 'نجمة',
  graduation: 'قبعة تخرّج',
  book: 'كتاب',
  info: 'معلومة',
} as const;

export type TickerIcon = keyof typeof TICKER_ICONS;

export interface TickerMessage {
  /** العنوان في الشارة الذهبية */
  badge: string;
  /** عنوان مختصر للجوال — اختياري، يُستخدم العنوان الكامل إن كان فارغًا */
  badgeShort: string;
  icon: TickerIcon;
  text: string;
}

export interface TickerSettings {
  /** إظهار الشريط أو إخفاؤه لكل الزوّار */
  enabled: boolean;
  messages: TickerMessage[];
}

export const TICKER_LIMITS = { badge: 60, badgeShort: 30, text: 400, messages: 12 };

export const DEFAULT_TICKER: TickerSettings = {
  enabled: true,
  messages: [
    {
      badge: 'رؤية الوزارة',
      badgeShort: 'رؤية الوزارة',
      icon: 'sparkles',
      text: 'متعلّم ريادي لتنمية مستدامة',
    },
    {
      badge: 'من أقوال سمو الأمير تميم بن حمد آل ثاني',
      badgeShort: 'من أقوال سمو الأمير',
      icon: 'quote',
      text: '«إننا نؤمن أن رأس المال البشري هو الثروة الحقيقية لأي دولة، ولذلك فإننا ماضون في تطوير منظومة التعليم والتدريب، وتأهيل كوادرنا الوطنية للمستقبل»',
    },
  ],
};

const CACHE_KEY = 'qa-ticker-v1';
const LOCAL_EVENT = 'qa-ticker-change';

/** ينظّف البيانات الواردة (من Firestore أو التخزين) ويتجاهل الرسائل الفارغة. */
export function normalizeTicker(raw: unknown): TickerSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { enabled?: unknown; messages?: unknown };
  if (!Array.isArray(r.messages)) return null;
  const messages: TickerMessage[] = [];
  for (const m of r.messages.slice(0, TICKER_LIMITS.messages)) {
    if (!m || typeof m !== 'object') continue;
    const x = m as Partial<Record<keyof TickerMessage, unknown>>;
    const text = typeof x.text === 'string' ? x.text.trim().slice(0, TICKER_LIMITS.text) : '';
    if (!text) continue;
    const badge =
      typeof x.badge === 'string' ? x.badge.trim().slice(0, TICKER_LIMITS.badge) : '';
    const badgeShort =
      typeof x.badgeShort === 'string'
        ? x.badgeShort.trim().slice(0, TICKER_LIMITS.badgeShort)
        : '';
    const icon =
      typeof x.icon === 'string' && x.icon in TICKER_ICONS ? (x.icon as TickerIcon) : 'sparkles';
    messages.push({ badge, badgeShort, icon, text });
  }
  return { enabled: r.enabled !== false, messages };
}

function readCache(): TickerSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeTicker(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(s: TickerSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * يشترك في إعدادات الشريط. يستدعي cb فورًا بالنسخة المحفوظة في المتصفّح (إن
 * وُجدت) لتجنّب وميض النص الافتراضي، ثم بكل نسخة جديدة ينشرها المشرف.
 * يُعيد دالة إلغاء الاشتراك.
 */
export function subscribeTicker(cb: (s: TickerSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const cached = readCache();
  if (cached) cb(cached);

  if (!isFirebaseConfigured) {
    if (!cached) cb(DEFAULT_TICKER);
    // LOCAL_EVENT لهذه النافذة، و storage للنوافذ الأخرى المفتوحة
    const onLocal = () => cb(readCache() ?? DEFAULT_TICKER);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY) onLocal();
    };
    window.addEventListener(LOCAL_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOCAL_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }

  const db = getDb();
  if (!db) {
    if (!cached) cb(DEFAULT_TICKER);
    return () => {};
  }

  let unsub: (() => void) | null = null;
  let cancelled = false;
  import('firebase/firestore')
    .then(({ doc, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, 'curriculum', 'ticker'),
        (snap) => {
          const s = (snap.exists() && normalizeTicker(snap.data())) || DEFAULT_TICKER;
          writeCache(s);
          cb(s);
        },
        () => {
          // تعذّرت القراءة (انقطاع مثلًا): نبقي على المحفوظ أو الافتراضي
          if (!cached) cb(DEFAULT_TICKER);
        }
      );
    })
    .catch(() => {
      if (!cached) cb(DEFAULT_TICKER);
    });

  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** يقرأ الإعدادات الحالية مرّة واحدة (للوحة التحكّم). */
export async function getTicker(): Promise<TickerSettings> {
  if (!isFirebaseConfigured) return readCache() ?? DEFAULT_TICKER;
  const db = getDb();
  if (!db) return DEFAULT_TICKER;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'curriculum', 'ticker'));
  return (snap.exists() && normalizeTicker(snap.data())) || DEFAULT_TICKER;
}

/** ينشر الإعدادات لكل الزوّار (Firestore)، أو يحفظها محليًا في وضع العرض. */
export async function saveTicker(settings: TickerSettings): Promise<void> {
  const clean = normalizeTicker(settings);
  if (!clean || clean.messages.length === 0) {
    throw new Error('أضِف رسالة واحدة على الأقل فيها نص.');
  }
  if (!isFirebaseConfigured) {
    writeCache(clean);
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'curriculum', 'ticker'), { ...clean, updatedAt: Date.now() });
}
