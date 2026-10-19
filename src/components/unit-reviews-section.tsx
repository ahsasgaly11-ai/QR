import { locateActivity } from '@/lib/content';
import type { Activity, Subject } from '@/lib/types';
import { SectionHead } from '@/components/home/section-head';
import { UnitReviewsGrid, type ReviewRow } from '@/components/unit-reviews-grid';

/**
 * قسم «مراجعات الوحدات» تحت الواجهة الأولى مباشرة ليراه الزائر فور دخوله.
 * يعرض ألعاب المراجعة التي يرفعها المشرف من تبويب «مراجعات الوحدات» ببطاقات
 * النشاط نفسها المستخدمة في الألعاب التعليمية والعروض التقديمية،
 * ولا يظهر إطلاقًا ما لم تُرفع مراجعة.
 */
export function UnitReviewsSection({
  reviews,
  subjects,
  kicker = 'جديد • استعدّ للاختبار',
  title = 'مراجعات الوحدات',
}: {
  reviews: Activity[];
  subjects: Subject[];
  kicker?: React.ReactNode;
  title?: React.ReactNode;
}) {
  if (reviews.length === 0) return null;

  const rows: ReviewRow[] = reviews.map((r) => {
    const { subject, grade, unit } = locateActivity(subjects, r);
    return {
      activity: r,
      subjectId: subject?.id ?? r.subjectId,
      subjectTitle: subject?.title ?? '',
      context: [grade?.title, unit?.title].filter(Boolean).join(' • '),
    };
  });

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-12 sm:px-6">
      <SectionHead kicker={kicker} title={title} />
      <UnitReviewsGrid initialRows={rows} />
    </section>
  );
}
