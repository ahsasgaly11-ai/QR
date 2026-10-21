import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Gamepad2, Hand, Users } from 'lucide-react';
import { getSubjects, getAllActivities } from '@/lib/content';
import { Reveal } from '@/components/reveal';
import { SiteStatsStrip } from '@/components/site-stats-strip';
import { ActivityCard } from '@/components/activity-card';
import { DownloadsSwitch } from '@/components/downloads-switch';
import { DohaWindow } from '@/components/home/doha-window';
import { HeritageDoor } from '@/components/home/heritage-door';
import { DOOR_PAINT, emblemFor } from '@/components/home/door-emblem';
import { SectionHead } from '@/components/home/section-head';
import { NaseejShow } from '@/components/home/naseej-show';
import { LaunchVideo } from '@/components/home/launch-video';
import { ImpactSection } from '@/components/home/impact-section';
import { getMasteryServer, getReachServer, getSiteStatsServer } from '@/lib/stats-server';
import { fetchImpactServer } from '@/lib/impact';
import { HeritageIcon } from '@/components/heritage-icons';
import type { HeritageIconKind } from '@/components/heritage-icons';
import { PRESENTATIONS_PATH, presentationsCount } from '@/lib/types';
import { doorStyle, fetchSiteTextsServer, homeOrder, isSectionHidden, SPECIAL_DOORS, txt } from '@/lib/site-texts';
import { BOARD_GAMES, boardGames } from '@/data/board-games';
import { BoardGameCard, ClassroomSetupDiagram } from '@/components/board-games';
import { T } from '@/components/editable-text';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

// الرابط المعياري لكل صفحة يُضبط فيها وحدها؛ لو وُضع في layout لورثته كل
// الصفحات فعدّتها Google نسخًا من الرئيسية ولم تفهرسها.
export const metadata = { alternates: { canonical: '/' } };

// ألوان الأبواب القطرية القديمة: خشب مطليّ بالأزرق والأخضر والعنّابي أو ساج طبيعي

// نصوص البطاقات تُحرَّر من لوحة الإدارة (home.types.N.title/desc)
const TYPE_ICONS: HeritageIconKind[] = ['flask', 'globe', 'question', 'oyster'];

export default async function HomePage() {
  // المحتوى والعدّادات المشتركة وآراء «أثر التعلّم» تُقرأ معًا في الخادم،
  // فتصل الأرقام الفعلية مضمَّنة في HTML بدل أصفار تنتظر المتصفّح.
  const [subjects, activities, siteStats, reach, impact, mastery, texts] = await Promise.all([
    getSubjects(),
    getAllActivities(),
    getSiteStatsServer(),
    getReachServer(),
    fetchImpactServer(),
    getMasteryServer(),
    fetchSiteTextsServer(),
  ]);
  const t = (key: string) => txt(texts, key);
  // نصّ قابل للتحرير المباشر من الموقع (انظر InlineTextEditor)
  const e = (key: string) => <T k={key} v={t(key)} />;
  const shown = (id: string) => !isSectionHidden(texts, id);
  // العدد نفسه الذي تعرضه لوحة الإحصاءات (كل الأنشطة المنشورة).
  const total = activities.length;
  const featured = activities
    .filter((a) => !a.smartReinforcement && !a.unitReview && !a.presentation)
    .slice(0, 4);
  // مراجعات الوحدات التي رفعها المشرف، الأحدث أولًا
  const reviews = activities
    .filter((a) => a.unitReview)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const smartGames = activities.filter((a) => a.smartReinforcement).length;
  const presentations = activities.filter((a) => a.presentation).length;
  const boardGameCount = BOARD_GAMES.length;

  // أقسام الرئيسية بمعرّفاتها؛ يُعرض منها الظاهر بالترتيب الذي يحدّده المشرف
  const sections: Record<string, React.ReactNode> = {
    // فيديو الإطلاق + عرض نسيج المجتمع القطري
    'home.naseej': (
      <section id="naseej" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-6 lg:py-14">
        <SectionHead
          kicker={e('home.naseej.kicker')}
          title={e('home.naseej.title')}
          lead={e('home.naseej.lead')}
        />
        <div className="showcase-grid">
          <div className="showcase-main">
            <p className="showcase-label">
              <span className="showcase-dot" aria-hidden />
              {e('home.naseej.showLabel')}
            </p>
            <NaseejShow />
          </div>
          <div className="showcase-side">
            <p className="showcase-label">
              <span className="showcase-dot" aria-hidden />
              {e('home.naseej.videoLabel')}
            </p>
            <LaunchVideo />
          </div>
        </div>
      </section>
    ),
    // أبواب المواد
    'home.doors': (
      <section id="doors" className="door-wall scroll-mt-24">
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:py-12">
          <SectionHead
            kicker={e('home.doors.kicker')}
            title={e('home.doors.title')}
            lead={e('home.doors.lead')}
            action={{ href: '/browse', label: e('home.doors.action') }}
          />
          <div className="door-row">
            {/* المواد الحيّة من قاعدة البيانات، لا القائمة المضمّنة —
                وإلا لما ظهرت أي مادة يضيفها المشرف من لوحة الإدارة. */}
            {subjects.map((s, i) => {
              const count = activities.filter((a) => a.subjectId === s.id && !a.smartReinforcement && !a.presentation).length;
              const available = s.grades.length > 0;
              return (
                <HeritageDoor
                  key={s.id}
                  href={`/subject/${s.id}`}
                  title={s.title}
                  meta={
                    available
                      ? [s.grades.map((g) => g.title).join(' • '), count > 0 && `${count} نشاطًا`]
                          .filter(Boolean)
                          .join(' • ')
                      : 'قريبًا'
                  }
                  {...doorStyle(texts, s.id, {
                    color: DOOR_PAINT[i % DOOR_PAINT.length],
                    emblem: emblemFor(s.id),
                  })}
                  locked={!available}
                />
              );
            })}
            <HeritageDoor
              href="/smart-games"
              title={t('home.doors.games')}
              textKey="home.doors.games"
              meta={smartGames > 0 ? `${smartGames} لعبة` : 'تعلّم • العب • عزّز'}
              {...doorStyle(texts, '__games', SPECIAL_DOORS.__games)}
            />
            <HeritageDoor
              href="/board-games"
              title={t('home.doors.board')}
              textKey="home.doors.board"
              meta={`جديد • ${boardGameCount.toLocaleString('ar-EG')} ${boardGameCount === 1 ? 'لعبة' : 'ألعاب'} • المس بيدك`}
              {...doorStyle(texts, '__board', SPECIAL_DOORS.__board)}
            />
            <HeritageDoor
              href={PRESENTATIONS_PATH}
              title={t('home.doors.presentations')}
              textKey="home.doors.presentations"
              meta={presentations > 0 ? `تجريبي • ${presentationsCount(presentations)}` : 'تجريبي • اعرض • جرّب • تفاعل'}
              {...doorStyle(texts, '__presentations', SPECIAL_DOORS.__presentations)}
            />
          </div>
        </div>
      </section>
    ),
    // قسم ألعاب السبورة الذكية (مستقل عن ألعاب التعزيز): أحدث الألعاب وطريقة اللعب
    'home.boardGames': boardGameCount > 0 ? (
      <section id="board-games" className="bg-home scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <SectionHead
            kicker={e('home.boardGames.kicker')}
            title={e('home.boardGames.title')}
            lead={e('home.boardGames.lead')}
            action={{ href: '/board-games', label: e('home.boardGames.action') }}
          />
          <ul className="bg-home-points">
            <li>
              <Hand className="h-5 w-5" aria-hidden /> لمس السبورة باليد فقط
            </li>
            <li>
              <Camera className="h-5 w-5" aria-hidden /> آيباد أو هاتف + Apple TV
            </li>
            <li>
              <Users className="h-5 w-5" aria-hidden /> الصف كله أو سباق فريقين
            </li>
          </ul>
          {/* أقل من ثلاث ألعاب: بجانبها مخطط تجهيز الصف، وإلا فالبطاقات بعرض القسم */}
          <div className={boardGameCount < 3 ? 'bg-home-split' : undefined}>
            <div className="bg-grid">
              {boardGames()
                .slice(0, 3)
                .map((g, i) => (
                  <Reveal key={g.slug} delay={i * 80}>
                    <BoardGameCard game={g} />
                  </Reveal>
                ))}
            </div>
            {boardGameCount < 3 && (
              <figure className="bg-diagram bg-home-setup">
                <ClassroomSetupDiagram />
                <figcaption>
                  ثبّت الجهاز في زاوية جانبية قريبة من السبورة، واعكس شاشته على جهاز العرض، ثم عايِر مرة واحدة من داخل اللعبة.{' '}
                  <Link href="/board-games#setup" className="font-semibold text-[color:var(--maroon)] underline underline-offset-4">
                    دليل تجهيز الصف
                  </Link>
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      </section>
    ) : null,
    // كيف تعمل المنصّة
    'home.steps': (
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
        <SectionHead kicker={e('home.steps.kicker')} title={e('home.steps.title')} />
        <ol className="steps">
          <li>
            <span className="steps-n">١</span>
            <h3>{e('home.steps.1.title')}</h3>
            <p>{e('home.steps.1.desc')}</p>
          </li>
          <li>
            <span className="steps-n">٢</span>
            <h3>{e('home.steps.2.title')}</h3>
            <p>{e('home.steps.2.desc')}</p>
          </li>
          <li>
            <span className="steps-n">٣</span>
            <DownloadsSwitch
              on={
                <>
                  <h3>{e('home.steps.3.title')}</h3>
                  <p>{e('home.steps.3.desc')}</p>
                </>
              }
              off={
                <>
                  <h3>{e('home.steps.3off.title')}</h3>
                  <p>{e('home.steps.3off.desc')}</p>
                </>
              }
            />
          </li>
        </ol>
      </section>
    ),
    // أنواع الأنشطة
    'home.types': (
      <section className="types-band">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <SectionHead kicker={e('home.types.kicker')} title={e('home.types.title')} />
          <ul className="types-grid">
            {TYPE_ICONS.map((icon, i) => (
              <li key={icon} className="type-tile">
                <span className="type-icon" style={{ '--d': `${-i * 1.1}s` } as React.CSSProperties}>
                  <HeritageIcon kind={icon} />
                </span>
                <h3>{e(`home.types.${i + 1}.title`)}</h3>
                <p>{e(`home.types.${i + 1}.desc`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),
    // أثر التعلّم
    'home.impact': (
        <ImpactSection
          activities={total}
          totals={siteStats}
          reach={reach}
          voices={impact}
          mastery={mastery}
          kicker={e('home.impact.kicker')}
          title={e('home.impact.title')}
          lead={e('home.impact.lead')}
        />
    ),
    // أنشطة مميّزة (عند وجود محتوى)
    'home.featured': featured.length > 0 ? (
        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <SectionHead
            kicker={e('home.featured.kicker')}
            title={e('home.featured.title')}
            action={{ href: '/search', label: e('home.featured.action') }}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((a, i) => (
              <Reveal key={a.id} delay={i * 80}>
                <ActivityCard activity={a} index={i} />
              </Reveal>
            ))}
          </div>
        </section>
    ) : null,
    // الخاتمة
    'home.closing': (
      <section className="mx-auto max-w-7xl px-5 pb-6 sm:px-6">
        <div className="closing-band">
          <div className="sadu-band" aria-hidden />
          <div className="closing-body">
            <HeritageIcon kind="pearl" className="closing-pearl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-calli text-2xl text-white sm:text-3xl">
                {e('home.closing.title')}
              </h2>
              <p className="mt-2 max-w-xl text-white/80">
                {e('home.closing.lead')}
              </p>
            </div>
            <Link href="/browse" className="closing-cta">
              {e('home.closing.cta')}
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    ),
  };

  return (
    <>
      {/* ===================== نافذة الدوحة ===================== */}
      <section className="home-hero" data-hero>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-10 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-12 lg:pb-12 lg:pt-10">
          <div className="hero-rise order-2 lg:order-1">
            <p className="kicker" style={{ '--i': 0 } as React.CSSProperties}>
              {e('home.hero.kicker')}
            </p>
            <h1
              className="mt-4 font-calli text-[2.4rem] leading-[1.45] text-foreground sm:text-5xl lg:text-[3.6rem]"
              style={{ '--i': 1 } as React.CSSProperties}
            >
              <T k="home.hero.line1" v={t('home.hero.line1')} highlight />
              <br />
              <T k="home.hero.line2" v={t('home.hero.line2')} highlight />
            </h1>
            <p
              className="mt-5 max-w-[34rem] text-[1.05rem] leading-8 text-[color:var(--ink-2)]"
              style={{ '--i': 2 } as React.CSSProperties}
            >
              {e('home.hero.lead')}
              <DownloadsSwitch on=" أو حمّلها للعمل دون اتصال" off=" في الصف أو البيت" />.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-3"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <a href="#doors" className="btn-primary px-7 text-[1.05rem]">
                {e('home.hero.cta')}
                <ArrowLeft className="h-5 w-5" />
              </a>
              {reviews.length > 0 ? (
                // يفتح صفحة «مراجعات الوحدات» ببطاقات ألعابها، لا اللعبة مباشرة
                <Link
                  href="/unit-reviews"
                  className="review-ticket"
                  aria-label={`مراجعات الوحدات: ${reviews.length} مراجعة`}
                >
                  <span className="review-ticket-icon" aria-hidden>
                    <HeritageIcon kind="oyster" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="review-ticket-kicker">
                      <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                      مراجعات الوحدات • {reviews.length} {reviews.length === 1 ? 'لعبة' : reviews.length <= 10 ? 'ألعاب' : 'لعبة'}
                    </span>
                    <span className="review-ticket-title">اختر مراجعة وحدتك وابدأ</span>
                  </span>
                  <span className="review-ticket-go" aria-hidden>
                    <ArrowLeft className="h-5 w-5" />
                  </span>
                </Link>
              ) : (
                <Link href="/dashboard" className="btn-ghost px-6">
                  لوحة الإحصاءات
                </Link>
              )}
            </div>
            <div className="mt-10" style={{ '--i': 4 } as React.CSSProperties}>
              <SiteStatsStrip activities={total} initial={siteStats} />
            </div>
          </div>

          <div className="order-1 mx-auto w-full max-w-[440px] lg:order-2 lg:max-w-none">
            <DohaWindow />
          </div>
        </div>
      </section>

      <div className="sadu-band" aria-hidden />
      {homeOrder(texts)
        .filter(shown)
        .map((id) => (
          <Fragment key={id}>{sections[id]}</Fragment>
        ))}
    </>
  );
}
