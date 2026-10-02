// ---------------------------------------------------------------------------
//  إعدادات الموقع العامة التي يتحكّم بها المشرف من لوحة التحكّم.
//
//  التنزيل يدعم ثلاثة أوضاع:
//   • all            كل الأنشطة قابلة للتنزيل.
//   • none           لا تنزيل؛ الاستخدام داخل الموقع فقط.
//   • selected-units التنزيل متاح فقط للوحدات التي يحددها المشرف.
//
//  تُحفظ الإعدادات في curriculum/settings. القراءة عامة، والكتابة للمالك فقط
//  وفق قواعد Firestore الحالية.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import type { Activity } from '@/lib/types';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

export type DownloadMode = 'all' | 'none' | 'selected-units';

export interface SiteSettings {
  /**
   * حقل توافق مع النسخ السابقة.
   * true فقط في وضع all؛ وفي selected-units يبقى false حتى لا تسمح نسخة قديمة
   * بالتنزيل لكل الألعاب بدل الوحدات المحددة.
   */
  downloadsEnabled: boolean;
  downloadMode: DownloadMode;
  /** مفاتيح الوحدات المسموح تنزيل ألعابها عند استخدام selected-units. */
  downloadUnitKeys: string[];
}

export const DEFAULT_SETTINGS: SiteSettings = {
  downloadsEnabled: true,
  downloadMode: 'all',
  downloadUnitKeys: [],
};

const CACHE_KEY = 'qa-site-settings-v2';
const LEGACY_CACHE_KEY = 'qa-site-settings-v1';
const LOCAL_EVENT = 'qa-site-settings-change';

type DownloadTarget = Pick<Activity, 'subjectId' | 'gradeId' | 'unitId'>;

export function downloadUnitKey(target: DownloadTarget): string {
  return [target.subjectId, target.gradeId, target.unitId].join('::');
}

function normalize(raw: unknown): SiteSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as {
    downloadsEnabled?: unknown;
    downloadMode?: unknown;
    downloadUnitKeys?: unknown;
  };

  const mode: DownloadMode =
    r.downloadMode === 'all' ||
    r.downloadMode === 'none' ||
    r.downloadMode === 'selected-units'
      ? r.downloadMode
      : r.downloadsEnabled === false
        ? 'none'
        : 'all';

  const unitKeys = Array.isArray(r.downloadUnitKeys)
    ? [...new Set(r.downloadUnitKeys.filter((v): v is string => typeof v === 'string' && v.length > 0))]
    : [];

  return {
    // مهم للتوافق مع الواجهات القديمة أثناء الانتقال.
    downloadsEnabled: mode === 'all',
    downloadMode: mode,
    downloadUnitKeys: unitKeys,
  };
}

function readCache(): SiteSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY) ?? localStorage.getItem(LEGACY_CACHE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(s: SiteSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// آخر نسخة معروفة — تُفحص لحظة الضغط على «تحميل» احتياطًا.
let current: SiteSettings | null = null;

export function isDownloadAllowed(
  settings: SiteSettings,
  target?: DownloadTarget
): boolean {
  if (settings.downloadMode === 'all') return true;
  if (settings.downloadMode === 'none') return false;
  if (!target) return false;
  return settings.downloadUnitKeys.includes(downloadUnitKey(target));
}

/** هل التنزيل مسموح لهذا النشاط الآن؟ */
export function downloadsAllowedNow(target?: DownloadTarget): boolean {
  const settings =
    current ??
    (typeof window === 'undefined' ? DEFAULT_SETTINGS : readCache() ?? DEFAULT_SETTINGS);
  return isDownloadAllowed(settings, target);
}

/**
 * يشترك في الإعدادات. يستدعي cb فورًا بالنسخة المحفوظة في المتصفح (إن وُجدت)،
 * ثم بكل نسخة جديدة ينشرها المشرف.
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
      if (e.key === CACHE_KEY || e.key === LEGACY_CACHE_KEY) onLocal();
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
    current = clean;
    window.dispatchEvent(new Event(LOCAL_EVENT));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase غير مُعدّ.');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'curriculum', 'settings'), { ...clean, updatedAt: Date.now() });
  current = clean;
}

/**
 * توافق خلفي: true فقط عندما يكون تنزيل جميع الأنشطة مسموحًا.
 * المكوّنات التي تعرف النشاط ينبغي أن تستخدم useActivityDownloadEnabled.
 */
export function useDownloadsEnabled(): boolean {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.downloadMode === 'all');
  useEffect(
    () => subscribeSettings((s) => setEnabled(s.downloadMode === 'all')),
    []
  );
  return enabled;
}

/** هل التنزيل مسموح للنشاط المحدد؟ يتحدّث فورًا مع تغيير إعداد المشرف. */
export function useActivityDownloadEnabled(target: DownloadTarget): boolean {
  const [enabled, setEnabled] = useState(() =>
    isDownloadAllowed(DEFAULT_SETTINGS, target)
  );

  useEffect(
    () => subscribeSettings((s) => setEnabled(isDownloadAllowed(s, target))),
    [target.subjectId, target.gradeId, target.unitId]
  );

  return enabled;
}
