import type { Metadata } from 'next';
import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { PageCourt } from '@/components/page-court';
import { PresentationsGrid, type PresentationRow } from '@/components/presentations-grid';
import { SITE_NAME } from '@/lib/site';
import { PRESENTATION_META, PRESENTATIONS_PATH } from '@/lib/types';

export const revalidate = 30;

const TITLE = 'العروض التقديمية الذكية';
const DESCRIPTION =
  'عروض تقديمية تفاعلية للدروس: شرائح بتجارب ومحاكاة ومؤثّرات، يعرضها المعلّم بملء الشاشة في الصف.';

export const metadata: Metadata = {
  title: `${TITLE} | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: PRESENTATIONS_PATH },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: PRESENTATIONS_PATH },
};

export default async function SmartPresentationsPage() {
  const [subjects, activities] = await Promise.all([getSubjects(), getAllActivities()]);
  const rows: PresentationRow[] = activities
    .filter((a) => a.presentation)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((a) => {
      const { subject, grade, lesson } = locateActivity(subjects, a);
      return {
        activity: a,
        subjectId: subject?.id ?? a.subjectId,
        subjectTitle: subject?.title ?? '',
        context: [grade?.title, lesson?.title].filter(Boolean).join(' • '),
      };
    });

  const subjectCount = new Set(rows.map((r) => r.subjectId)).size;

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: TITLE }]}
        kicker="قسم تجريبي • اعرض • جرّب • تفاعل"
        title={TITLE}
        icon="screen"
        color={PRESENTATION_META.color}
        lead="شرح الدرس كما في البوربوينت، لكن الشرائح هنا حيّة: تجارب ومحاكاة ومؤثّرات يتفاعل معها الطالب. افتح العرض بملء الشاشة على السبورة وتنقّل بالأسهم."
        chips={[
          { n: rows.length, label: rows.length === 1 ? 'عرض' : rows.length <= 10 ? 'عروض' : 'عرضًا' },
          { n: subjectCount, label: subjectCount === 1 ? 'مادة' : 'مواد' },
        ]}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <PresentationsGrid initialRows={rows} />
      </section>
    </>
  );
}
