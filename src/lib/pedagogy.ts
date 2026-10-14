// ---------------------------------------------------------------------------
//  البيانات التربوية للنشاط (الهدف، نواتج التعلّم، التوظيف، التقويم الختامي).
//
//  لماذا؟ المحكّم والمعلّم لا يكتفيان بلعبة تعمل؛ يسألان: ما الهدف الذي
//  تخدمه؟ وما الذي يتعلّمه الطالب؟ ومتى تُستخدم في الدرس؟ وكيف نعرف أنه
//  تعلّم؟ هذه الوحدة تعرّف الشكل القياسي لهذه الإجابات وتنظّفها قبل الحفظ.
// ---------------------------------------------------------------------------

import type { ExitQuestion, LessonPhase, Pedagogy } from '@/lib/types';

export const PHASES: { id: LessonPhase; label: string; hint: string }[] = [
  { id: 'before', label: 'قبل الدرس', hint: 'تهيئة وإثارة الدافعية واستكشاف المعرفة السابقة' },
  { id: 'during', label: 'أثناء الدرس', hint: 'بناء المفهوم واستقصاؤه مع المعلّم' },
  { id: 'after', label: 'بعد الدرس', hint: 'تثبيت وتقويم وتعزيز في الصف أو البيت' },
];

export const PHASE_LABEL: Record<LessonPhase, string> = {
  before: 'قبل الدرس',
  during: 'أثناء الدرس',
  after: 'بعد الدرس',
};

export const PEDAGOGY_LIMITS = {
  objective: 240,
  outcome: 160,
  outcomes: 6,
  usage: 600,
  support: 400,
  question: 200,
  option: 80,
  options: 4,
  questions: 3,
  durationMax: 120,
} as const;

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** يحوّل نصًا متعدّد الأسطر إلى قائمة نواتج (سطر لكل ناتج، بلا ترقيم). */
export function parseOutcomes(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)\-])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, PEDAGOGY_LIMITS.outcomes)
    .map((l) => l.slice(0, PEDAGOGY_LIMITS.outcome));
}

export function normalizeQuestion(raw: unknown): ExitQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Partial<Record<keyof ExitQuestion, unknown>>;
  const q = cleanText(x.q, PEDAGOGY_LIMITS.question);
  const options = Array.isArray(x.options)
    ? x.options
        .map((o) => cleanText(o, PEDAGOGY_LIMITS.option))
        .filter(Boolean)
        .slice(0, PEDAGOGY_LIMITS.options)
    : [];
  const answer = Number(x.answer);
  if (!q || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length)
    return null;
  return { q, options, answer };
}

/**
 * ينظّف البيانات التربوية الواردة من النموذج أو من Firestore. يُعيد undefined
 * حين لا يبقى فيها شيء، فلا تُحفظ وثيقة بحقل فارغ.
 */
export function normalizePedagogy(raw: unknown): Pedagogy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const x = raw as Partial<Record<keyof Pedagogy, unknown>>;
  const out: Pedagogy = {};
  const objective = cleanText(x.objective, PEDAGOGY_LIMITS.objective);
  if (objective) out.objective = objective;
  const outcomes = Array.isArray(x.outcomes)
    ? x.outcomes
        .map((o) => cleanText(o, PEDAGOGY_LIMITS.outcome))
        .filter(Boolean)
        .slice(0, PEDAGOGY_LIMITS.outcomes)
    : [];
  if (outcomes.length) out.outcomes = outcomes;
  const duration = Number(x.duration);
  if (Number.isFinite(duration) && duration > 0)
    out.duration = Math.min(PEDAGOGY_LIMITS.durationMax, Math.round(duration));
  if (x.phase === 'before' || x.phase === 'during' || x.phase === 'after') out.phase = x.phase;
  const usage = cleanText(x.usage, PEDAGOGY_LIMITS.usage);
  if (usage) out.usage = usage;
  const support = cleanText(x.support, PEDAGOGY_LIMITS.support);
  if (support) out.support = support;
  const exitTicket = Array.isArray(x.exitTicket)
    ? x.exitTicket.map(normalizeQuestion).filter((q): q is ExitQuestion => q !== null).slice(0, PEDAGOGY_LIMITS.questions)
    : [];
  if (exitTicket.length) out.exitTicket = exitTicket;
  return Object.keys(out).length ? out : undefined;
}

/** هل يحمل النشاط الحدّ الأدنى الذي يطلبه المحكّم: هدف + ناتج + سؤال تقويم؟ */
export function pedagogyStatus(p: Pedagogy | undefined): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!p?.objective) missing.push('الهدف التعليمي');
  if (!p?.outcomes?.length) missing.push('نواتج التعلّم');
  if (!p?.phase) missing.push('موضع التوظيف');
  if (!p?.usage) missing.push('طريقة التوظيف في الصف');
  if (!p?.exitTicket?.length) missing.push('سؤال التقويم الختامي');
  return { complete: missing.length === 0, missing };
}

/** نسبة مئوية مقرّبة للإتقان، أو null بلا محاولات. */
export function masteryPercent(correct: number | undefined, total: number | undefined): number | null {
  if (!total || total <= 0) return null;
  return Math.round(((correct ?? 0) / total) * 100);
}
