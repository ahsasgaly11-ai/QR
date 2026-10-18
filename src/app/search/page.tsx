import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { SearchExplorer, type SearchRow } from '@/components/search-explorer';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
import { SITE_NAME } from '@/lib/site';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = {
  title: `بحث | ${SITE_NAME}`,
  alternates: { canonical: '/search' },
};

export default async function SearchPage() {
  const [activities, subjects, texts] = await Promise.all([
    getAllActivities(),
    getSubjects(),
    fetchSiteTextsServer(),
  ]);

  const rows: SearchRow[] = activities.map((a) => {
    const { subject, unit, lesson } = locateActivity(subjects, a);
    return {
      activity: a,
      subjectId: a.subjectId,
      subjectTitle: subject?.title ?? '',
      unitTitle: unit?.title ?? '',
      lessonTitle: lesson?.title ?? '',
    };
  });

  const subjectOpts = subjects
    .filter((s) => s.grades.length > 0)
    .map((s) => ({ id: s.id, title: s.title }));

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'nav.search') }]}
        kicker={<T k="page.search.kicker" v={txt(texts, 'page.search.kicker')} />}
        title={<T k="page.search.title" v={txt(texts, 'page.search.title')} />}
        icon="question"
        color="#b0862a"
        lead={<T k="page.search.lead" v={txt(texts, 'page.search.lead')} />}
      />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        <SearchExplorer rows={rows} subjects={subjectOpts} />
      </section>
    </>
  );
}
