import type { Metadata } from 'next';
import { getAllActivities } from '@/lib/content';
import { PageCourt } from '@/components/page-court';
import { SmartGamesGrid } from '@/components/smart-games-grid';
import { SITE_NAME } from '@/lib/site';

export const revalidate = 30;

export const metadata: Metadata = {
  title: `ألعاب التعزيز الذكية | ${SITE_NAME}`,
  description:
    'ألعاب تعليمية تفاعلية لتعزيز المفاهيم والمهارات بطريقة ممتعة ومباشرة.',
  alternates: { canonical: '/smart-games' },
  openGraph: {
    title: `ألعاب التعزيز الذكية | ${SITE_NAME}`,
    description:
      'ألعاب تعليمية تفاعلية لتعزيز المفاهيم والمهارات بطريقة ممتعة ومباشرة.',
    url: '/smart-games',
  },
};

export default async function SmartGamesPage() {
  const activities = await getAllActivities();
  const games = activities
    .filter((a) => a.smartReinforcement)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: 'ألعاب التعزيز الذكية' }]}
        kicker="تعلّم • العب • عزّز"
        title="ألعاب التعزيز الذكية"
        icon="oyster"
        color="#2d5f7c"
        lead="مجموعة مستقلة من الألعاب التفاعلية تساعد على تثبيت المفاهيم والمهارات بطريقة ممتعة، مع وصف مختصر لكل لعبة."
        chips={[{ n: games.length + 1, label: games.length + 1 === 1 ? 'لعبة' : 'ألعاب' }]}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <SmartGamesGrid initialGames={games} />
      </section>
    </>
  );
}
