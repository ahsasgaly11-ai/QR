import type { Metadata } from 'next';
import { Camera, Hand, Projector, ShieldCheck, Smartphone, Tv } from 'lucide-react';
import { PageCourt } from '@/components/page-court';
import { SectionHead } from '@/components/home/section-head';
import { ClassroomSetupDiagram } from '@/components/board-games';
import { BoardGamesGrid, type BoardGameRow } from '@/components/board-games-grid';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
import { SITE_NAME } from '@/lib/site';
import { getSubjects } from '@/lib/content';
import { boardGameContext, getBoardGames, visibleBoardGames } from '@/lib/board-games';
import { BOARD_GAME_META, BOARD_GAMES_PATH } from '@/lib/types';

// المحتوى يُقرأ من Firestore عند إعادة التوليد (وتطلبها لوحة الإدارة فورًا بعد
// كل حفظ)، فيظهر تعديل المشرف للزوّار في اللحظة نفسها.
export const revalidate = 30;

const TITLE = 'ألعاب السبورة الذكية';
const DESCRIPTION =
  'ألعاب صفّية تُلعب بلمس السبورة بالأيدي بلا أقلام ولا أجهزة للطلاب: جهاز المعلّم يعرض اللعبة على جهاز العرض ويرى أيدي الطلاب بكاميرته.';

export const metadata: Metadata = {
  title: `${TITLE} | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: BOARD_GAMES_PATH },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: BOARD_GAMES_PATH, images: ['/asnan/cover.jpg'] },
};

const NEED_ICONS = [Projector, Smartphone, Tv, Hand];

export default async function BoardGamesPage() {
  const [texts, subjects, allGames] = await Promise.all([fetchSiteTextsServer(), getSubjects(), getBoardGames()]);
  const t = (key: string) => txt(texts, key);
  // نصّ قابل للتحرير المباشر من الصفحة (InlineTextEditor)
  const e = (key: string) => <T k={key} v={t(key)} />;

  // تُمرَّر القائمة كاملة: الزائر لا يرى المخفيّ، والمالك يراه معلَّمًا ليُظهره
  const rows: BoardGameRow[] = allGames.map((game) => ({ game, ...boardGameContext(subjects, game) }));
  const games = visibleBoardGames(allGames);
  const subjectCount = new Set(games.map((g) => boardGameContext(subjects, g).subjectId)).size;

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: t('nav.home') }, { label: t('page.boardGames.title') }]}
        kicker={e('page.boardGames.kicker')}
        title={e('page.boardGames.title')}
        icon="screen"
        color={BOARD_GAME_META.color}
        lead={e('page.boardGames.lead')}
        chips={[
          { n: games.length, label: games.length === 1 ? 'لعبة' : games.length <= 10 ? 'ألعاب' : 'لعبة' },
          { n: subjectCount, label: subjectCount === 1 ? 'مادة' : 'مواد' },
        ]}
      />

      {/* ما تحتاجه */}
      <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-6" aria-labelledby="bg-needs">
        <h2 id="bg-needs" className="sr-only">ما تحتاجه</h2>
        <ul className="bg-needs">
          {NEED_ICONS.map((Icon, i) => (
            <li key={i}>
              <span className="bg-needs-icon" aria-hidden>
                <Icon className="h-6 w-6" />
              </span>
              <b>{e(`page.boardGames.needs.${i + 1}.title`)}</b>
              <span>{e(`page.boardGames.needs.${i + 1}.text`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* الألعاب */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6" id="games">
        <SectionHead
          kicker={e('page.boardGames.library.kicker')}
          title={e('page.boardGames.library.title')}
          lead={e('page.boardGames.library.lead')}
        />
        <BoardGamesGrid initialRows={rows} />
      </section>

      {/* تجهيز الصف */}
      <section className="bg-setup" id="setup" aria-labelledby="bg-setup-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:py-16">
          <div className="min-w-0">
            <p className="kicker">{e('page.boardGames.setup.kicker')}</p>
            <h2 id="bg-setup-title" className="mt-2 font-calli text-[1.9rem] leading-[1.5] text-foreground sm:text-[2.3rem]">
              {e('page.boardGames.setup.title')}
            </h2>
            <ol className="bg-steps">
              {[1, 2, 3, 4].map((n) => (
                <li key={n}>
                  <span className="bg-step-n" aria-hidden>
                    {n.toLocaleString('ar-EG')}
                  </span>
                  <div>
                    <h3>{e(`page.boardGames.setup.${n}.title`)}</h3>
                    <p>{e(`page.boardGames.setup.${n}.text`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className="bg-diagram">
            <ClassroomSetupDiagram />
            <figcaption>
              <Camera className="inline h-4 w-4" aria-hidden /> {e('page.boardGames.setup.caption')}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* أسئلة */}
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-6" aria-labelledby="bg-faq">
        <SectionHead kicker={e('page.boardGames.faq.kicker')} title={<span id="bg-faq">{e('page.boardGames.faq.title')}</span>} />
        <div className="bg-faq">
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n}>
              <summary>{e(`page.boardGames.faq.${n}.q`)}</summary>
              <p>{e(`page.boardGames.faq.${n}.a`)}</p>
            </details>
          ))}
        </div>
        <p className="bg-privacy">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          {e('page.boardGames.privacy')}
        </p>
      </section>
    </>
  );
}
