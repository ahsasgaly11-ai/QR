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

/**
 * نطاق المشكلة: «core» = العدّادات الأساسية (الإجمالي والمدارس)،
 * «daily» = التوزيع اليومي وحده (الإجمالي يُحفظ لكن الاتجاهات لا).
 */
export type SyncScope = 'core' | 'daily';

export interface SyncProblem {
  /** رمز خطأ Firestore، مثل permission-denied أو unavailable. */
  code: string;
  at: number;
  scope?: SyncScope;
}

/** نوع العملية التي فشلت: كتابة عدّاد أو قراءته. */
export type SyncOp = 'write' | 'read';

/**
 * مشكلة عابرة (شبكة بطيئة أو منقطعة، لا قواعد) لا تُعرض بعد هذه المدّة: إن لم
 * تنجح كتابة تمحوها فالأرجح أن المستخدم لم يلعب منذ ذلك الحين، لا أن الاتصال
 * ما زال معطّلًا.
 */
const TRANSIENT_TTL_MS = 10 * 60 * 1000;

function isTransient(code: string): boolean {
  return code !== 'permission-denied';
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

/**
 * يُستدعى عند فشل كتابة/قراءة عدّاد في Firestore.
 *
 * القراءة التي تتجاوز مهلتها (deadline-exceeded) أو تتعثّر لحظيًا لا تُسجَّل
 * مشكلةً: لم تضِع أي بيانات، والأرقام ستصل مع الاشتراك الحيّ أو المحاولة
 * التالية. كانت تُسجَّل سابقًا فيظهر في لوحة الإحصاءات إشعار «لم تُحفظ آخر
 * عملية» عند كل بطء عابر في الشبكة، ويبقى حتى ينجح حفظٌ ما. أمّا رفض القواعد
 * للقراءة فيُسجَّل لأنه يعني أن القواعد المنشورة ليست قواعد المنصّة.
 */
export function reportSyncError(
  e: unknown,
  what: string,
  scope: SyncScope = 'core',
  op: SyncOp = 'write'
): void {
  const code = errorCode(e);
  if (code === 'permission-denied') {
    console.error(
      `[stats] رفضت قواعد Firestore ${what} (permission-denied). ` +
        'انشر ملف firestore.rules على مشروع Firebase: ' +
        'firebase deploy --only firestore:rules'
    );
  } else if (op === 'read') {
    console.warn(`[stats] تأخّرت ${what} من Firestore (${code}) — ستُعاد المحاولة.`);
    return;
  } else {
    console.error(`[stats] تعذّر ${what} في Firestore:`, e);
  }
  // مشكلة أساسية لا تُستبدل بمشكلة يومية أخفّ منها.
  const cur = getSyncProblem();
  if (scope === 'daily' && cur && (cur.scope ?? 'core') === 'core') return;
  write({ code, at: Date.now(), scope });
}

/**
 * يُستدعى حين تصل قراءة مؤكَّدة من خادم Firestore: الاتصال سليم إذن، فأي
 * مشكلة عابرة مسجَّلة (مهلة، انقطاع) صارت قديمة وتُمحى. مشكلة القواعد
 * (permission-denied) تبقى، لأن القراءة مسموحة للجميع حتى حين تُرفض الكتابة.
 */
export function reportReadOk(): void {
  const cur = getSyncProblem();
  if (!cur || !isTransient(cur.code)) return;
  write(null);
}

/**
 * يُستدعى عند نجاح كتابة في Firestore. نجاح الإجمالي لا يمحو مشكلة التوزيع
 * اليومي (تبقى ظاهرة حتى تنجح كتابة يومية)، والعكس صحيح.
 */
export function reportSyncOk(scope: SyncScope = 'core'): void {
  const cur = getSyncProblem();
  if (!cur) return;
  if ((cur.scope ?? 'core') !== scope) return;
  write(null);
}

export function getSyncProblem(): SyncProblem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SyncProblem;
    // مشكلة عابرة قديمة: لا تُعرض (ولا تُمحى هنا كي لا تتكرّر الكتابة في كل قراءة).
    if (isTransient(p.code) && Date.now() - (p.at || 0) > TRANSIENT_TTL_MS) return null;
    return p;
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
