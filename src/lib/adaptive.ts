// ---------------------------------------------------------------------------
// المحرّك التكيّفي (Adaptive Engine)
// ---------------------------------------------------------------------------
// دوالّ نقيّة تقرأ إتقان الطالب (activity-events) وتقترح النشاط التالي:
//   • واصِل: نشاط بدأه ولم يُتقنه بعد (الأضعف أولًا).
//   • جديد: أوّل نشاط لم يبدأه بعدُ بترتيب المنهج.
//   • مراجعة: أُتقن كل شيء → يقترح أضعف نشاط للمراجعة.
// لا حالة ولا تخزين هنا — تُمرَّر الأنشطة والتقدّم، فتَسهُل التجربة والاختبار.
// ---------------------------------------------------------------------------

import type { Activity } from './types';
import type { ActivityProgress } from './activity-events';

/** حدّ اعتبار النشاط «مُتقَنًا». */
export const MASTERY_THRESHOLD = 0.8;

export type SuggestionReason = 'continue' | 'new' | 'review' | 'empty';

export interface Suggestion {
  activity: Activity | null;
  reason: SuggestionReason;
  /** إتقان النشاط المقترح (0–1) إن وُجد له تقدّم. */
  mastery: number;
}

export interface OverallStats {
  total: number;
  attempted: number;
  mastered: number;
  /** متوسّط الإتقان عبر الأنشطة التي بدأها الطالب (0–1). */
  avgMastery: number;
}

function byId(progress: ActivityProgress[]): Map<string, ActivityProgress> {
  return new Map(progress.map((p) => [p.activityId, p]));
}

function isAttempted(p?: ActivityProgress): boolean {
  return !!p && (p.answered > 0 || p.attempts > 0);
}

/** إحصاء عام لتقدّم الطالب. */
export function overallStats(
  activities: Activity[],
  progress: ActivityProgress[]
): OverallStats {
  const map = byId(progress);
  let attempted = 0;
  let mastered = 0;
  let sum = 0;
  for (const a of activities) {
    const p = map.get(a.id);
    if (isAttempted(p)) {
      attempted += 1;
      sum += p!.mastery;
      if (p!.mastery >= MASTERY_THRESHOLD) mastered += 1;
    }
  }
  return {
    total: activities.length,
    attempted,
    mastered,
    avgMastery: attempted > 0 ? sum / attempted : 0,
  };
}

/** الأنشطة قيد التقدّم (بدأها ولم يُتقنها) — الأضعف أولًا. */
export function inProgress(
  activities: Activity[],
  progress: ActivityProgress[]
): { activity: Activity; mastery: number }[] {
  const map = byId(progress);
  return activities
    .map((a) => ({ activity: a, p: map.get(a.id) }))
    .filter((x) => isAttempted(x.p) && x.p!.mastery < MASTERY_THRESHOLD)
    .sort((a, b) => a.p!.mastery - b.p!.mastery)
    .map((x) => ({ activity: x.activity, mastery: x.p!.mastery }));
}

/** يقترح النشاط التالي الأنسب للطالب. */
export function suggestNext(
  activities: Activity[],
  progress: ActivityProgress[]
): Suggestion {
  if (activities.length === 0) return { activity: null, reason: 'empty', mastery: 0 };

  // 1) واصِل الأضعف مما بدأه ولم يُتقنه
  const wip = inProgress(activities, progress);
  if (wip.length > 0) {
    return { activity: wip[0].activity, reason: 'continue', mastery: wip[0].mastery };
  }

  // 2) أوّل نشاط جديد بترتيب المنهج
  const map = byId(progress);
  const fresh = activities.find((a) => !isAttempted(map.get(a.id)));
  if (fresh) return { activity: fresh, reason: 'new', mastery: 0 };

  // 3) أُتقن كل شيء → اقترح الأضعف للمراجعة
  let weakest: Activity | null = null;
  let min = Infinity;
  for (const a of activities) {
    const m = map.get(a.id)?.mastery ?? 1;
    if (m < min) {
      min = m;
      weakest = a;
    }
  }
  return { activity: weakest, reason: 'review', mastery: min === Infinity ? 1 : min };
}
