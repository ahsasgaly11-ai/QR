// ---------------------------------------------------------------------------
//  حالة مزامنة العدّادات مع Firestore.
//
//  كانت أخطاء الكتابة تُبتلع بصمت، فيرى اللاعب أرقامه المحلية بينما لا يصل
//  شيء إلى Firestore (فلا يراها المشرف ولا بقيّة المستخدمين). هنا نسجّل آخر
//  نتيجة كتابة/قراءة في هذا المتصفّح لتعرض لوحة الإحصاءات تنبيهًا واضحًا
//  بالسبب (غالبًا: قواعد Firestore غير منشورة على المشروع).
// ---------------------------------------------------------------------------

const SYNC_KEY = 'qa-stats-sync-v1';
export const SYNC_EVENT = 'qa-stats-sync-change';

export interface SyncProblem {
  /** رمز خطأ Firestore، مثل permission-denied أو unavailable. */
  code: string;
  at: number;
}

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  return typeof code === 'string' && code ? code : 'unknown';
}

function write(value: SyncProblem | null) {
  if (typeof window === 'undefined') return;
  try {
    const prev = localStorage.getItem(SYNC_KEY);
    if (value) localStorage.setItem(SYNC_KEY, JSON.stringify(value));
    else if (prev) localStorage.removeItem(SYNC_KEY);
    else return;
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

/** يُستدعى عند فشل كتابة/قراءة عدّاد في Firestore. */
export function reportSyncError(e: unknown, what: string): void {
  const code = errorCode(e);
  if (code === 'permission-denied') {
    console.error(
      `[stats] رفضت قواعد Firestore ${what} (permission-denied). ` +
        'انشر ملف firestore.rules على مشروع Firebase: ' +
        'firebase deploy --only firestore:rules'
    );
  } else {
    console.error(`[stats] تعذّر ${what} في Firestore:`, e);
  }
  write({ code, at: Date.now() });
}

/** يُستدعى عند نجاح كتابة عدّاد في Firestore. */
export function reportSyncOk(): void {
  write(null);
}

export function getSyncProblem(): SyncProblem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncProblem) : null;
  } catch {
    return null;
  }
}

export function onSyncChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SYNC_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(SYNC_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
