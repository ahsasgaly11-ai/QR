import Link from 'next/link';
import { BookOpen, ChevronLeft, Gamepad2, GraduationCap, Sparkles } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { locateActivity } from '@/lib/content';
import type { Activity, Subject } from '@/lib/types';

// ألوان تتناوب على البطاقات حين تتعدّد المراجعات.
const GRADIENTS: [string, string][] = [
  ['#0f5132', '#1f7a5a'],
  ['#5b1d3a', '#8a173e'],
  ['#1d3557', '#2f5d8a'],
];

/**
 * قسم «مراجعات الوحدات» تحت الواجهة الأولى مباشرة ليراه الزائر فور دخوله.
 * يعرض ألعاب المراجعة التي يرفعها المشرف من تبويب «مراجعات الوحدات»،
 * ولا يظهر إطلاقًا ما لم تُرفع مراجعة.
 */
export function UnitReviewsSection({
  reviews,
  subjects,
}: {
  reviews: Activity[];
  subjects: Subject[];
}) {
  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-6 pt-8">
      <Reveal className="mb-6 text-center lg:text-right">
        <p className="text-sm font-black text-[color:var(--gold)]">جديد • استعدّ للاختبار</p>
        <h2 className="mt-1 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
          مراجعات الوحدات
        </h2>
      </Reveal>

      <div className="grid gap-6">
        {reviews.map((r, i) => {
          const { subject, grade, unit } = locateActivity(subjects, r);
          const [from, to] = GRADIENTS[i % GRADIENTS.length];
          return (
          <Reveal key={r.id}>
            <Link
              href={`/play/${r.id}`}
              aria-label={`افتح لعبة ${r.title}${subject ? ` – ${subject.title}` : ''}`}
              className="group relative block overflow-hidden rounded-[2rem] border border-[color:var(--gold)]/40 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--gold)]"
              style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:var(--gold)]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8 sm:p-8">
                <div
                  aria-hidden
                  className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-white/10 text-7xl shadow-2xl ring-4 ring-white/15 transition duration-500 group-hover:rotate-12 sm:h-40 sm:w-40 sm:text-8xl"
                >
                  {subject?.emoji ?? '📝'}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-right">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-3 py-1 text-xs font-black text-[#1a1600]">
                    <Sparkles className="h-4 w-4" />
                    لعبة مراجعة شاملة
                  </div>
                  <h3 className="font-calli text-3xl font-bold sm:text-4xl">{r.title}</h3>
                  {r.description && <p className="mt-2 max-w-2xl text-white/85">{r.description}</p>}
                  <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold sm:justify-start">
                    {subject && (
                      <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                        <Gamepad2 className="h-4 w-4 text-[color:var(--gold)]" /> {subject.title}
                      </li>
                    )}
                    {grade && (
                      <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                        <GraduationCap className="h-4 w-4 text-[color:var(--gold)]" /> {grade.title}
                      </li>
                    )}
                    {unit && (
                      <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                        <BookOpen className="h-4 w-4 text-[color:var(--gold)]" /> {unit.title}
                      </li>
                    )}
                  </ul>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[color:var(--gold)] px-6 py-4 text-lg font-black text-[#1a1600] shadow-lg transition group-hover:scale-105">
                  ابدأ المراجعة
                  <ChevronLeft className="h-5 w-5" />
                </span>
              </div>
            </Link>
          </Reveal>
          );
        })}
      </div>
    </section>
  );
}
