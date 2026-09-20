// ---------------------------------------------------------------------------
// عقد تتبّع الأنشطة (Activity Tracking Contract)
// ---------------------------------------------------------------------------
// اللعبة تعمل داخل iframe معزول، فلا يستطيع الموقع "النظر داخلها". الطريقة
// القياسية الوحيدة لنقل نتائج الطالب هي أن تُعلن اللعبة أحداثها عبر
// window.parent.postMessage، ويستمع الموقع لها هنا. هذا هو نفس مبدأ
// معايير التعليم العالمية (SCORM / xAPI).
//
// اللعبة تُرسل (انظر المقتطف الجاهز في public/games/qa-tracking.js):
//   parent.postMessage({ source:'qa-activity', type:'answer', correct:true, qid:'q3' }, '*')
//   parent.postMessage({ source:'qa-activity', type:'result', score:8, total:10 }, '*')
//
// يُحفظ التقدّم محليًّا (localStorage) ليعمل دون اتصال — وهو الأساس الذي
// يبني عليه المحرّك التكيّفي لاحقًا (اقتراح النشاط التالي حسب الإتقان).
// ---------------------------------------------------------------------------

/** مصدر الرسالة المعتمد — تُتجاهل أي رسالة لا تحمله (أمان). */
export const QA_SOURCE = 'qa-activity' as const;

export type QAActivityEvent =
  /** اللعبة جاهزة — تأكيد أن العقد مدعوم. */
  | { source: typeof QA_SOURCE; type: 'ready' }
  /** إجابة واحدة صحيحة/خاطئة (qid معرّف السؤال اختياري). */
  | { source: typeof QA_SOURCE; type: 'answer'; correct: boolean; qid?: string }
  /** تقدّم داخل النشاط (خطوة من أصل خطوات). */
  | { source: typeof QA_SOURCE; type: 'progress'; step: number; steps: number }
  /** النتيجة النهائية عند إتمام النشاط. */
  | { source: typeof QA_SOURCE; type: 'result'; score: number; total: number };

/** سجلّ تقدّم الطالب في نشاط واحد (يتراكم عبر المحاولات). */
export interface ActivityProgress {
  activityId: string;
  attempts: number;
  correct: number;
  answered: number;
  /** أفضل نسبة نتيجة نهائية سُجّلت (0–1). */
  bestScore: number;
  lastAt: number;
  /** نسبة الإتقان المشتقّة (0–1) — يعتمدها المحرّك التكيّفي. */
  mastery: number;
}

const KEY = 'qa-progress';

type Store = Record<string, ActivityProgress>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** تحقّق أن الرسالة الواردة تتبع العقد. */
export function isActivityEvent(data: unknown): data is QAActivityEvent {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.source === QA_SOURCE && typeof d.type === 'string';
}

/** سجّل حدثًا واردًا من لعبة وحدّث تقدّم النشاط. يعيد التقدّم المحدَّث. */
export function recordActivityEvent(
  activityId: string,
  ev: QAActivityEvent
): ActivityProgress {
  const store = read();
  const p: ActivityProgress =
    store[activityId] ?? {
      activityId,
      attempts: 0,
      correct: 0,
      answered: 0,
      bestScore: 0,
      lastAt: 0,
      mastery: 0,
    };

  if (ev.type === 'answer') {
    p.answered += 1;
    if (ev.correct) p.correct += 1;
  } else if (ev.type === 'result') {
    p.attempts += 1;
    const ratio = ev.total > 0 ? ev.score / ev.total : 0;
    if (ratio > p.bestScore) p.bestScore = ratio;
  }

  // الإتقان: النتيجة النهائية الأفضل إن وُجدت، وإلا نسبة الإجابات الصحيحة.
  p.mastery =
    p.attempts > 0
      ? p.bestScore
      : p.answered > 0
        ? p.correct / p.answered
        : 0;
  p.lastAt = Date.now();

  store[activityId] = p;
  write(store);
  return p;
}

export function getActivityProgress(activityId: string): ActivityProgress | null {
  return read()[activityId] ?? null;
}

export function getAllProgress(): ActivityProgress[] {
  return Object.values(read());
}
