import { ChevronLeft, Gamepad2, GraduationCap, Sparkles } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { reviewHref, unitReviews } from '@/lib/unit-reviews';

/**
 * قسم «مراجعات الوحدات» تحت الواجهة الأولى مباشرة ليراه الزائر فور دخوله.
 * اللعبة تُفتح في صفحة كاملة (ملف HTML مستقل) لا داخل إطار.
 */
export function UnitReviewsSection() {
  if (unitReviews.length === 0) return null;

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-6 pt-8">
      <Reveal className="mb-6 text-center lg:text-right">
        <p className="text-sm font-black text-[color:var(--gold)]">جديد • استعدّ للاختبار</p>
        <h2 className="mt-1 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
          مراجعات الوحدات
        </h2>
      </Reveal>

      <div className="grid gap-6">
        {unitReviews.map((r) => (
          <Reveal key={r.id}>
            <a
              href={reviewHref(r)}
              aria-label={`افتح لعبة ${r.title} – ${r.subject} ${r.grade}`}
              className="group relative block overflow-hidden rounded-[2rem] border border-[color:var(--gold)]/40 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--gold)]"
              style={{ background: `linear-gradient(135deg, ${r.from} 0%, ${r.to} 100%)` }}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:var(--gold)]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8 sm:p-8">
                <div
                  aria-hidden
                  className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-white/10 text-7xl shadow-2xl ring-4 ring-white/15 transition duration-500 group-hover:rotate-12 sm:h-40 sm:w-40 sm:text-8xl"
                >
                  {r.emoji}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-right">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-3 py-1 text-xs font-black text-[#1a1600]">
                    <Sparkles className="h-4 w-4" />
                    لعبة مراجعة شاملة
                  </div>
                  <h3 className="font-calli text-3xl font-bold sm:text-4xl">{r.title}</h3>
                  <p className="mt-2 max-w-2xl text-white/85">{r.description}</p>
                  <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold sm:justify-start">
                    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                      <Gamepad2 className="h-4 w-4 text-[color:var(--gold)]" /> {r.subject}
                    </li>
                    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                      <GraduationCap className="h-4 w-4 text-[color:var(--gold)]" /> {r.grade}
                    </li>
                  </ul>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[color:var(--gold)] px-6 py-4 text-lg font-black text-[#1a1600] shadow-lg transition group-hover:scale-105">
                  ابدأ المراجعة
                  <ChevronLeft className="h-5 w-5" />
                </span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
