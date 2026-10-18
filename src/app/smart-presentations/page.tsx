import type { Metadata } from 'next';
import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
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
  const [subjects, activities, texts] = await Promise.all([
    getSubjects(),
    getAllActivities(),
    fetchSiteTextsServer(),
  ]);
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
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'page.presentations.title') }]}
        kicker={<T k="page.presentations.kicker" v={txt(texts, 'page.presentations.kicker')} />}
        title={<T k="page.presentations.title" v={txt(texts, 'page.presentations.title')} />}
        icon="screen"
        color={PRESENTATION_META.color}
        lead={<T k="page.presentations.lead" v={txt(texts, 'page.presentations.lead')} />}
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
