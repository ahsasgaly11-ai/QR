import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { locateActivity } from '@/lib/content';
import type { Activity, Subject } from '@/lib/types';
import { HeritageIcon } from '@/components/heritage-icons';
import { SectionHead } from '@/components/home/section-head';

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
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-12 sm:px-6">
      <SectionHead kicker="جديد • استعدّ للاختبار" title="مراجعات الوحدات" />

      <div className="grid gap-5">
        {reviews.map((r, i) => {
          const { subject, grade, unit } = locateActivity(subjects, r);
          const meta = [subject?.title, grade?.title, unit?.title].filter(Boolean);
          return (
            <Link
              key={r.id}
              href={`/play/${r.id}`}
              aria-label={`افتح لعبة ${r.title}${subject ? ` – ${subject.title}` : ''}`}
              className="review-band group"
              style={{ '--d': `${-i * 1.3}s` } as React.CSSProperties}
            >
              <span className="review-icon" aria-hidden>
                <HeritageIcon kind="oyster" />
              </span>
              <span className="review-body min-w-0 flex-1">
                <span className="review-tag">لعبة مراجعة شاملة</span>
                <span className="review-title mt-2 block font-calli text-2xl leading-[1.5] sm:text-3xl">{r.title}</span>
                {r.description && (
                  <span className="mt-1 block max-w-2xl text-white/80">{r.description}</span>
                )}
                {meta.length > 0 && (
                  <span className="mt-3 block text-sm text-white/70">{meta.join(' • ')}</span>
                )}
              </span>
              <span className="review-cta">
                ابدأ المراجعة
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
