import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Home, Sparkles } from 'lucide-react';
import { getAllActivities } from '@/lib/content';
import { BackButton } from '@/components/back-button';
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
    <div className="relative">
      <section
        className="relative overflow-hidden py-14 text-white"
        style={{
          background: 'linear-gradient(135deg, var(--maroon), #6a4c93)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 girih-light" />
        <div className="pointer-events-none absolute -left-10 top-6 h-52 w-52 rounded-full bg-white/10 blur-2xl float-slow" />
        <div className="pointer-events-none absolute right-10 top-10 h-36 w-36 rounded-full bg-[color:var(--gold)]/20 blur-2xl float-mid" />

        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-6">
          <div>
            <div className="mb-4 flex">
              <BackButton
                fallback="/"
                className="border-white/40 bg-white/15 text-white shadow-none backdrop-blur hover:border-white hover:bg-white/25"
              />
            </div>

            <nav className="mb-4 flex items-center gap-2 text-sm text-white/80">
              <Link href="/" className="flex items-center gap-1 hover:text-white">
                <Home className="h-4 w-4" /> الرئيسية
              </Link>
              <ChevronLeft className="h-4 w-4" />
              <span className="font-bold text-white">ألعاب التعزيز الذكية</span>
            </nav>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">
              <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
              تعلّم • العب • عزّز
            </div>

            <h1 className="font-calli text-4xl font-bold sm:text-5xl">
              ألعاب التعزيز الذكية
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              مجموعة مستقلة من الألعاب التفاعلية التي تساعد الطالب على تعزيز
              المفاهيم والمهارات بطريقة ممتعة، مع وصف مختصر أسفل كل لعبة.
            </p>
          </div>

          <div className="hidden h-36 w-36 shrink-0 place-items-center rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur md:grid">
            <span className="text-7xl" aria-hidden>
              🎮
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SmartGamesGrid initialGames={games} />
      </section>
    </div>
  );
}
