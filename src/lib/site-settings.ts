// ---------------------------------------------------------------------------
//  إعدادات الموقع العامة التي يتحكّم بها المشرف من لوحة التحكّم.
//
//  حاليًا: السماح بتنزيل الألعاب أو قصر استخدامها على داخل الموقع.
//
//  تُحفظ في وثيقة Firestore واحدة: curriculum/settings
//  (مجموعة curriculum قواعدها منشورة أصلًا: قراءة عامة، وكتابة للمالك وحده،
//  فلا يلزم تعديل قواعد الأمان.)
//
//  يستمع الموقع للوثيقة مباشرة (onSnapshot)، فيصل تغيير المشرف إلى كل
//  الزوّار فورًا — حتى من كانت الصفحة مفتوحة لديه — دون إعادة نشر الموقع.
//  وبلا Firebase (وضع العرض) تُحفظ في هذا المتصفّح فقط.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export interface SiteSettings {
  /** يستطيع الزوّار تنزيل الألعاب؛ وإلا تُستخدم داخل الموقع فقط. */
  downloadsEnabled: boolean;
}

export const DEFAULT_SETTINGS: SiteSettings = { downloadsEnabled: true };

const CACHE_KEY = 'qa-site-settings-v1';
const LOCAL_EVENT = 'qa-site-settings-change';

function normalize(raw: unknown): SiteSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { downloadsEnabled?: unknown };
  return { downloadsEnabled: r.downloadsEnabled !== false };
}

function readCache(): SiteSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(s: SiteSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// آخر نسخة معروفة — تُفحص لحظة الضغط على «تحميل» احتياطًا.
let current: SiteSettings | null = null;

/** هل التنزيل مسموح الآن؟ (آخر قيمة معروفة في هذه الصفحة) */
export function downloadsAllowedNow(): boolean {
  if (current) return current.downloadsEnabled;
  if (typeof window === 'undefined') return DEFAULT_SETTINGS.downloadsEnabled;
  return (readCache() ?? DEFAULT_SETTINGS).downloadsEnabled;
}

/**
 * يشترك في الإعدادات. يستدعي cb فورًا بالنسخة المحفوظة في المتصفّح (إن
 * وُجدت)، ثم بكل نسخة جديدة ينشرها المشرف. يُعيد دالة إلغاء الاشتراك.
 */
export function subscribeSettings(cb: (s: SiteSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const emit = (s: SiteSettings) => {
    current = s;
    cb(s);
  };
  const cached = readCache();
  emit(cached ?? DEFAULT_SETTINGS);

  if (!isFirebaseConfigured) {
    const onLocal = () => emit(readCache() ?? DEFAULT_SETTINGS);
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
  if (!db) return () => {};

  let unsub: (() => void) | null = null;
  let cancelled = false;
  import('firebase/firestore')
    .then(({ doc, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, 'curriculum', 'settings'),
        (snap) => {
          const s = normalize(snap.exists() ? snap.data() : null);
          writeCache(s);
          emit(s);
        },
        () => {
          /* تعذّرت القراءة: نبقي على آخر قيمة معروفة */
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
export async function getSettings(): Promise<SiteSettings> {
  if (!isFirebaseConfigured) return readCache() ?? DEFAULT_SETTINGS;
  const db = getDb();
  if (!db) return DEFAULT_SETTINGS;
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'curriculum', 'settings'));
  return normalize(snap.exists() ? snap.data() : null);
}

/** ينشر الإعدادات لكل الزوّار (Firestore)، أو يحفظها محليًا في وضع العرض. */
export async function saveSettings(settings: SiteSettings): Promise<void> {
  const clean = normalize(settings);
  if (!isFirebaseConfigured) {
    writeCache(clean);
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'curriculum', 'settings'), { ...clean, updatedAt: Date.now() });
}

/** هل يُسمح للزوّار بتنزيل الألعاب؟ يتحدّث فورًا عند تغيير المشرف للإعداد. */
export function useDownloadsEnabled(): boolean {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.downloadsEnabled);
  useEffect(() => subscribeSettings((s) => setEnabled(s.downloadsEnabled)), []);
  return enabled;
}
