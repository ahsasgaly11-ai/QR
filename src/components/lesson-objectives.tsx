import { Clock3, ListChecks, Target, Users } from 'lucide-react';
import type { Activity, Lesson } from '@/lib/types';
import { PHASE_LABEL } from '@/lib/pedagogy';

/**
 * بطاقة «الهدف التعليمي» في صفحة النشاط: ما يحتاجه المعلّم قبل أن يضغط
 * «تشغيل»، وما يقرؤه المحكّم ليربط النشاط بالمنهج. تُعرض فقط حين يكون للنشاط
 * بيانات تربوية؛ وإلا يبقى سطر «عن النشاط» كما هو.
 */
export function LessonObjectives({ activity, lesson }: { activity: Activity; lesson?: Lesson }) {
  const p = activity.pedagogy;
  if (!p || (!p.objective && !p.outcomes?.length && !p.usage)) return null;
  return (
    <section className="objectives" aria-labelledby="objectives-title">
      <div className="objectives-head">
        <span className="objectives-icon" aria-hidden>
          <Target className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="objectives-title" className="objectives-title">الهدف التعليمي</h2>
          {lesson && <p className="objectives-lesson">{lesson.title}</p>}
        </div>
        <div className="objectives-chips">
          {p.phase && (
            <span className="objectives-chip">
              <ListChecks className="h-3.5 w-3.5" aria-hidden /> {PHASE_LABEL[p.phase]}
            </span>
          )}
          {p.duration && (
            <span className="objectives-chip">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> {p.duration} دقيقة
            </span>
          )}
        </div>
      </div>

      {p.objective && <p className="objectives-goal">{p.objective}</p>}

      <div className="objectives-grid">
        {p.outcomes && p.outcomes.length > 0 && (
          <div>
            <h3 className="objectives-sub">نواتج التعلّم</h3>
            <ol className="objectives-list">
              {p.outcomes.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ol>
          </div>
        )}
        {(p.usage || p.support) && (
          <div>
            {p.usage && (
              <>
                <h3 className="objectives-sub">في الصف</h3>
                <p className="objectives-text">{p.usage}</p>
              </>
            )}
            {p.support && (
              <>
                <h3 className="objectives-sub mt-3 flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden /> الفروق الفردية والدعم
                </h3>
                <p className="objectives-text">{p.support}</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
