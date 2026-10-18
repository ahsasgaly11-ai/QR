import Link from 'next/link';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import { getSubjects, getAllActivities } from '@/lib/content';
import { Reveal } from '@/components/reveal';
import { SiteStatsStrip } from '@/components/site-stats-strip';
import { ActivityCard } from '@/components/activity-card';
import { DownloadsSwitch } from '@/components/downloads-switch';
import { UnitReviewsSection } from '@/components/unit-reviews-section';
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
import { PRESENTATION_META, PRESENTATIONS_PATH, presentationsCount } from '@/lib/types';
import { fetchSiteTextsServer, isSectionHidden, txt } from '@/lib/site-texts';
import { HighlightText } from '@/components/highlight-text';

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
  const latestReview = reviews[0];
  const smartGames = activities.filter((a) => a.smartReinforcement).length;
  const presentations = activities.filter((a) => a.presentation).length;

  return (
    <>
      {/* ===================== نافذة الدوحة ===================== */}
      <section className="home-hero" data-hero>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-10 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-12 lg:pb-12 lg:pt-10">
          <div className="hero-rise order-2 lg:order-1">
            <p className="kicker" style={{ '--i': 0 } as React.CSSProperties}>
              {t('home.hero.kicker')}
            </p>
            <h1
              className="mt-4 font-calli text-[2.4rem] leading-[1.45] text-foreground sm:text-5xl lg:text-[3.6rem]"
              style={{ '--i': 1 } as React.CSSProperties}
            >
              <HighlightText text={t('home.hero.line1')} />
              <br />
              <HighlightText text={t('home.hero.line2')} />
            </h1>
            <p
              className="mt-5 max-w-[34rem] text-[1.05rem] leading-8 text-[color:var(--ink-2)]"
              style={{ '--i': 2 } as React.CSSProperties}
            >
              {t('home.hero.lead')}
              <DownloadsSwitch on=" أو حمّلها للعمل دون اتصال" off=" في الصف أو البيت" />.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-3"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <a href="#doors" className="btn-primary px-7 text-[1.05rem]">
                {t('home.hero.cta')}
                <ArrowLeft className="h-5 w-5" />
              </a>
              {latestReview ? (
                <Link
                  href={`/play/${latestReview.id}`}
                  className="review-ticket"
                  aria-label={`العب ${latestReview.title}`}
                >
                  <span className="review-ticket-icon" aria-hidden>
                    <HeritageIcon kind="oyster" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="review-ticket-kicker">
                      <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                      مراجعة الوحدة • لعبة
                    </span>
                    <span className="review-ticket-title">{latestReview.title}</span>
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

      {/* ============ فيديو الإطلاق + عرض نسيج المجتمع القطري ============ */}
      {shown('home.naseej') && (
      <section id="naseej" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-6 lg:py-14">
        <SectionHead
          kicker={t('home.naseej.kicker')}
          title={t('home.naseej.title')}
          lead={t('home.naseej.lead')}
        />
        <div className="showcase-grid">
          <div className="showcase-main">
            <p className="showcase-label">
              <span className="showcase-dot" aria-hidden />
              {t('home.naseej.showLabel')}
            </p>
            <NaseejShow />
          </div>
          <div className="showcase-side">
            <p className="showcase-label">
              <span className="showcase-dot" aria-hidden />
              {t('home.naseej.videoLabel')}
            </p>
            <LaunchVideo />
          </div>
        </div>
      </section>
      )}

      {/* ===================== مراجعات الوحدات ===================== */}
      {shown('home.reviews') && (
        <UnitReviewsSection
          reviews={reviews}
          subjects={subjects}
          kicker={t('home.reviews.kicker')}
          title={t('home.reviews.title')}
        />
      )}

      {/* ===================== أبواب المواد ===================== */}
      {shown('home.doors') && (
      <section id="doors" className="door-wall scroll-mt-24">
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:py-12">
          <SectionHead
            kicker={t('home.doors.kicker')}
            title={t('home.doors.title')}
            lead={t('home.doors.lead')}
            action={{ href: '/browse', label: t('home.doors.action') }}
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
                  color={DOOR_PAINT[i % DOOR_PAINT.length]}
                  emblem={emblemFor(s.id)}
                  locked={!available}
                />
              );
            })}
            <HeritageDoor
              href="/smart-games"
              title={t('home.doors.games')}
              meta={smartGames > 0 ? `${smartGames} لعبة` : 'تعلّم • العب • عزّز'}
              color="#2d5f7c"
              emblem="games"
            />
            <HeritageDoor
              href={PRESENTATIONS_PATH}
              title={t('home.doors.presentations')}
              meta={presentations > 0 ? `تجريبي • ${presentationsCount(presentations)}` : 'تجريبي • اعرض • جرّب • تفاعل'}
              color={PRESENTATION_META.color}
              emblem="slides"
            />
          </div>
        </div>
      </section>
      )}

      {/* ===================== كيف تعمل المنصّة ===================== */}
      {shown('home.steps') && (
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
        <SectionHead kicker={t('home.steps.kicker')} title={t('home.steps.title')} />
        <ol className="steps">
          <li>
            <span className="steps-n">١</span>
            <h3>{t('home.steps.1.title')}</h3>
            <p>{t('home.steps.1.desc')}</p>
          </li>
          <li>
            <span className="steps-n">٢</span>
            <h3>{t('home.steps.2.title')}</h3>
            <p>{t('home.steps.2.desc')}</p>
          </li>
          <li>
            <span className="steps-n">٣</span>
            <DownloadsSwitch
              on={
                <>
                  <h3>{t('home.steps.3.title')}</h3>
                  <p>{t('home.steps.3.desc')}</p>
                </>
              }
              off={
                <>
                  <h3>{t('home.steps.3off.title')}</h3>
                  <p>{t('home.steps.3off.desc')}</p>
                </>
              }
            />
          </li>
        </ol>
      </section>
      )}

      {/* ===================== أنواع الأنشطة ===================== */}
      {shown('home.types') && (
      <section className="types-band">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <SectionHead kicker={t('home.types.kicker')} title={t('home.types.title')} />
          <ul className="types-grid">
            {TYPE_ICONS.map((icon, i) => (
              <li key={icon} className="type-tile">
                <span className="type-icon" style={{ '--d': `${-i * 1.1}s` } as React.CSSProperties}>
                  <HeritageIcon kind={icon} />
                </span>
                <h3>{t(`home.types.${i + 1}.title`)}</h3>
                <p>{t(`home.types.${i + 1}.desc`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* ===================== أثر التعلّم ===================== */}
      {shown('home.impact') && (
        <ImpactSection
          activities={total}
          totals={siteStats}
          reach={reach}
          voices={impact}
          mastery={mastery}
          kicker={t('home.impact.kicker')}
          title={t('home.impact.title')}
          lead={t('home.impact.lead')}
        />
      )}

      {/* ===================== أنشطة مميّزة (عند وجود محتوى) ========= */}
      {featured.length > 0 && shown('home.featured') && (
        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <SectionHead
            kicker={t('home.featured.kicker')}
            title={t('home.featured.title')}
            action={{ href: '/search', label: t('home.featured.action') }}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((a, i) => (
              <Reveal key={a.id} delay={i * 80}>
                <ActivityCard activity={a} index={i} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ===================== الخاتمة ===================== */}
      {shown('home.closing') && (
      <section className="mx-auto max-w-7xl px-5 pb-6 sm:px-6">
        <div className="closing-band">
          <div className="sadu-band" aria-hidden />
          <div className="closing-body">
            <HeritageIcon kind="pearl" className="closing-pearl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-calli text-2xl text-white sm:text-3xl">
                {t('home.closing.title')}
              </h2>
              <p className="mt-2 max-w-xl text-white/80">
                {t('home.closing.lead')}
              </p>
            </div>
            <Link href="/browse" className="closing-cta">
              {t('home.closing.cta')}
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
