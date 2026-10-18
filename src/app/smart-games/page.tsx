import type { Metadata } from 'next';
import { getAllActivities } from '@/lib/content';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
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
  const [activities, texts] = await Promise.all([getAllActivities(), fetchSiteTextsServer()]);
  const games = activities
    .filter((a) => a.smartReinforcement)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'page.smartGames.title') }]}
        kicker={<T k="page.smartGames.kicker" v={txt(texts, 'page.smartGames.kicker')} />}
        title={<T k="page.smartGames.title" v={txt(texts, 'page.smartGames.title')} />}
        icon="oyster"
        color="#2d5f7c"
        lead={<T k="page.smartGames.lead" v={txt(texts, 'page.smartGames.lead')} />}
        chips={[{ n: games.length + 1, label: games.length + 1 === 1 ? 'لعبة' : 'ألعاب' }]}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <SmartGamesGrid initialGames={games} />
      </section>
    </>
  );
}
