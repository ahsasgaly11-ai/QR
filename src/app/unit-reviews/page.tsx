import type { Metadata } from 'next';
import { getAllActivities } from '@/lib/content';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
import { ReviewCards } from '@/components/review-cards';
import { HeritageIcon } from '@/components/heritage-icons';
import { SITE_NAME } from '@/lib/site';

export const revalidate = 30;

const TITLE = 'مراجعات الوحدات';
const DESCRIPTION = 'ألعاب مراجعة شاملة لكل وحدة دراسية، يراجع بها الطالب دروس الوحدة كلّها قبل الاختبار.';

export const metadata: Metadata = {
  title: `${TITLE} | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: '/unit-reviews' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: '/unit-reviews' },
};

export default async function UnitReviewsPage() {
  const [activities, texts] = await Promise.all([getAllActivities(), fetchSiteTextsServer()]);
  const reviews = activities
    .filter((a) => a.unitReview)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'page.reviews.title') }]}
        kicker={<T k="page.reviews.kicker" v={txt(texts, 'page.reviews.kicker')} />}
        title={<T k="page.reviews.title" v={txt(texts, 'page.reviews.title')} />}
        icon="oyster"
        color="#1f4f48"
        lead={<T k="page.reviews.lead" v={txt(texts, 'page.reviews.lead')} />}
        chips={[{ n: reviews.length, label: reviews.length === 1 ? 'مراجعة' : 'مراجعات' }]}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        {reviews.length > 0 ? (
          <ReviewCards initialReviews={reviews} />
        ) : (
          <div className="explorer-empty">
            <HeritageIcon kind="oyster" className="mx-auto h-20 w-20" />
            <h3 className="mt-3 font-calli text-2xl text-foreground">لا توجد مراجعات مضافة بعد</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-7 text-muted-foreground">
              ستظهر ألعاب مراجعة الوحدات هنا تلقائيًا عند رفعها من لوحة الإدارة.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
