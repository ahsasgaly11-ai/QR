'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RotateCcw, XCircle } from 'lucide-react';
import type { ExitQuestion } from '@/lib/types';
import { recordMastery } from '@/lib/stats';
import { cn } from '@/lib/utils';

/**
 * تذكرة الخروج: أسئلة التقويم الختامي التي يضيفها المشرف لكل نشاط. يجيب
 * الطالب، يرى الصواب والخطأ فورًا، ثم تُسجَّل محاولته (صحيح/مجموع) بلا اسم
 * ولا جهاز، فتتكوّن «نسبة الإتقان» في لوحة الإحصاءات.
 *
 * تُحفظ آخر نتيجة لهذا النشاط في المتصفّح كي لا تُحتسب إعادة فتح الصفحة
 * محاولة جديدة؛ زرّ «إعادة» يسمح بمحاولة أخرى تُحتسب فعلًا.
 */
export function ExitTicket({ activityId, questions }: { activityId: string; questions: ExitQuestion[] }) {
  const key = `qa-exit-${activityId}`;
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [done, setDone] = useState<{ correct: number; total: number } | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw) as { picked: (number | null)[]; correct: number; total: number };
        if (Array.isArray(d.picked) && d.picked.length === questions.length) {
          setPicked(d.picked);
          setDone({ correct: d.correct, total: d.total });
          setSaved(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, [key, questions.length]);

  if (!questions.length) return null;
  const answered = picked.every((p) => p !== null);

  const submit = async () => {
    const correct = questions.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);
    const total = questions.length;
    setDone({ correct, total });
    try {
      sessionStorage.setItem(key, JSON.stringify({ picked, correct, total }));
    } catch {
      /* ignore */
    }
    const outcome = await recordMastery(activityId, correct, total, 'ticket');
    setSaved(outcome !== 'failed');
  };

  const reset = () => {
    setPicked(questions.map(() => null));
    setDone(null);
    setSaved(null);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="exit-ticket" aria-labelledby="exit-ticket-title">
      <div className="exit-ticket-head">
        <span className="exit-ticket-icon" aria-hidden>
          <ClipboardCheck className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="exit-ticket-title" className="exit-ticket-title">ماذا تعلّمت؟</h2>
          <p className="exit-ticket-lead">
            {questions.length === 1 ? 'سؤال واحد' : `${questions.length} أسئلة`} قصيرة بعد النشاط. إجابتك
            بلا اسم، وتساعد معلّمك على معرفة ما فهمه الصف.
          </p>
        </div>
      </div>

      <ol className="exit-ticket-list">
        {questions.map((q, i) => {
          const chosen = picked[i];
          return (
            <li key={i} className="exit-q">
              <p className="exit-q-text">
                <span className="exit-q-n">{i + 1}</span>
                {q.q}
              </p>
              <div className="exit-q-options" role="radiogroup" aria-label={`إجابات السؤال ${i + 1}`}>
                {q.options.map((o, j) => {
                  const isChosen = chosen === j;
                  const isRight = done ? j === q.answer : false;
                  const isWrong = done ? isChosen && j !== q.answer : false;
                  return (
                    <button
                      key={j}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={!!done}
                      onClick={() => setPicked((p) => p.map((v, k) => (k === i ? j : v)))}
                      className={cn(
                        'exit-opt',
                        isChosen && !done && 'is-chosen',
                        isRight && 'is-right',
                        isWrong && 'is-wrong'
                      )}
                    >
                      <span className="exit-opt-mark" aria-hidden>
                        {isRight ? <CheckCircle2 className="h-4 w-4" /> : isWrong ? <XCircle className="h-4 w-4" /> : null}
                      </span>
                      {o}
                      {done && isRight && <span className="sr-only"> (الإجابة الصحيحة)</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {done ? (
        <div className="exit-result" role="status">
          <p className="exit-result-score">
            {done.correct === done.total ? 'ممتاز! ' : done.correct > 0 ? 'أحسنت، ' : 'لا بأس، '}
            أجبت {done.correct} من {done.total} إجابة صحيحة.
          </p>
          <p className="exit-result-note">
            {saved === false
              ? 'تعذّر حفظ النتيجة الآن؛ ستبقى في هذا الجهاز.'
              : done.correct < done.total
                ? 'راجع الإجابات المظلَّلة بالأخضر ثم أعد النشاط لتثبيت الفكرة.'
                : 'استمرّ إلى النشاط التالي أو شارك ما تعلّمته مع زميلك.'}
          </p>
          <button type="button" onClick={reset} className="btn-ghost btn-sm mt-2 px-4 py-2 text-sm">
            <RotateCcw className="h-4 w-4" aria-hidden /> إعادة المحاولة
          </button>
        </div>
      ) : (
        <button type="button" onClick={submit} disabled={!answered} className="btn-primary mt-4 px-6">
          تحقّق من إجاباتي
        </button>
      )}
    </section>
  );
}
