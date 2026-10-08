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
import { HeritageIcon } from '@/components/heritage-icons';
import type { HeritageIconKind } from '@/components/heritage-icons';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

// الرابط المعياري لكل صفحة يُضبط فيها وحدها؛ لو وُضع في layout لورثته كل
// الصفحات فعدّتها Google نسخًا من الرئيسية ولم تفهرسها.
export const metadata = { alternates: { canonical: '/' } };

// ألوان الأبواب القطرية القديمة: خشب مطليّ بالأزرق والأخضر والعنّابي أو ساج طبيعي

const TYPES: { icon: HeritageIconKind; label: string; desc: string }[] = [
  { icon: 'flask', label: 'تجارب عملية', desc: 'يجرّب الطالب بيده ويرى النتيجة كما في المختبر.' },
  { icon: 'globe', label: 'محاكاة تفاعلية', desc: 'ظواهر يصعب رؤيتها في الصف، يغيّر الطالب متغيّراتها ويراقب.' },
  { icon: 'question', label: 'أسئلة وتقويم', desc: 'أسئلة قصيرة تُظهر للطالب ما فهمه وما يحتاج مراجعته.' },
  { icon: 'oyster', label: 'ألعاب تعليمية', desc: 'تحدّيات ومراحل تعزّز ما تعلّمه الطالب في الدرس.' },
];

export default async function HomePage() {
  const subjects = await getSubjects();
  const activities = await getAllActivities();
  // العدد نفسه الذي تعرضه لوحة الإحصاءات (كل الأنشطة المنشورة).
  const total = activities.length;
  const featured = activities
    .filter((a) => !a.smartReinforcement && !a.unitReview)
    .slice(0, 4);
  // مراجعات الوحدات التي رفعها المشرف، الأحدث أولًا
  const reviews = activities
    .filter((a) => a.unitReview)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const latestReview = reviews[0];
  const smartGames = activities.filter((a) => a.smartReinforcement).length;

  return (
    <>
      {/* ===================== نافذة الدوحة ===================== */}
      <section className="home-hero" data-hero>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-10 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-14 lg:pb-14 lg:pt-14">
          <div className="hero-rise order-2 lg:order-1">
            <p className="kicker" style={{ '--i': 0 } as React.CSSProperties}>
              منصة تعليمية تفاعلية • دولة قطر
            </p>
            <h1
              className="mt-4 font-calli text-[2.4rem] leading-[1.45] text-foreground sm:text-5xl lg:text-[3.6rem]"
              style={{ '--i': 1 } as React.CSSProperties}
            >
              نتعلّم <span className="text-[color:var(--maroon)]">بأيدينا</span>
              <br />
              ونكتشف <span className="text-[color:var(--maroon)]">بعقولنا</span>
            </h1>
            <p
              className="mt-5 max-w-[34rem] text-[1.05rem] leading-8 text-[color:var(--ink-2)]"
              style={{ '--i': 2 } as React.CSSProperties}
            >
              تجارب عملية ومحاكاة وأسئلة وألعاب تعليمية لمناهج دولة قطر، مرتّبة
              حسب المادة والوحدة والدرس — جرّبها مباشرة من المتصفّح
              <DownloadsSwitch on=" أو حمّلها للعمل دون اتصال" off=" في الصف أو البيت" />.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-3"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <a href="#doors" className="btn-primary px-7 text-[1.05rem]">
                ادخل إلى المواد
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
              <SiteStatsStrip activities={total} />
            </div>
          </div>

          <div className="order-1 mx-auto w-full max-w-[440px] lg:order-2 lg:max-w-none">
            <DohaWindow />
          </div>
        </div>
      </section>

      <div className="sadu-band" aria-hidden />

      {/* ===================== مراجعات الوحدات ===================== */}
      <UnitReviewsSection reviews={reviews} subjects={subjects} />

      {/* ===================== أبواب المواد ===================== */}
      <section id="doors" className="door-wall scroll-mt-24">
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:py-20">
          <SectionHead
            kicker="المواد الدراسية"
            title="افتح باب المادة"
            lead="كل مادة باب. ادخل لتصل إلى وحداتها ودروسها وأنشطتها."
            action={{ href: '/browse', label: 'كل المناهج' }}
          />
          <div className="door-row">
            {/* المواد الحيّة من قاعدة البيانات، لا القائمة المضمّنة —
                وإلا لما ظهرت أي مادة يضيفها المشرف من لوحة الإدارة. */}
            {subjects.map((s, i) => {
              const count = activities.filter((a) => a.subjectId === s.id && !a.smartReinforcement).length;
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
              title="ألعاب التعزيز الذكية"
              meta={smartGames > 0 ? `${smartGames} لعبة` : 'تعلّم • العب • عزّز'}
              color="#2d5f7c"
              emblem="games"
            />
          </div>
        </div>
      </section>

      {/* ===================== كيف تعمل المنصّة ===================== */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
        <SectionHead kicker="كيف تعمل المنصّة؟" title="من الكتاب إلى التجربة في ثلاث خطوات" />
        <ol className="steps">
          <li>
            <span className="steps-n">١</span>
            <h3>اختر الدرس</h3>
            <p>المادة، ثم المستوى، ثم الوحدة، ثم الدرس — بترتيب الكتاب المدرسي نفسه.</p>
          </li>
          <li>
            <span className="steps-n">٢</span>
            <h3>جرّب مباشرة</h3>
            <p>شغّل التجربة أو المحاكاة أو اللعبة داخل المتصفّح دون أي تثبيت، وبملء الشاشة على السبورة.</p>
          </li>
          <li>
            <span className="steps-n">٣</span>
            <DownloadsSwitch
              on={
                <>
                  <h3>خذها معك</h3>
                  <p>نزّل النشاط ملفًا واحدًا يعمل على أي جهاز في الصف أو البيت دون اتصال.</p>
                </>
              }
              off={
                <>
                  <h3>تعلّم في أي مكان</h3>
                  <p>استخدم الأنشطة من الموقع في الصف أو البيت، على أي جهاز متصل بالإنترنت.</p>
                </>
              }
            />
          </li>
        </ol>
      </section>

      {/* ===================== أنواع الأنشطة ===================== */}
      <section className="types-band">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
          <SectionHead kicker="أنواع الأنشطة" title="أربع طرق لتعلّم الدرس نفسه" />
          <ul className="types-grid">
            {TYPES.map((t, i) => (
              <li key={t.label} className="type-tile">
                <span className="type-icon" style={{ '--d': `${-i * 1.1}s` } as React.CSSProperties}>
                  <HeritageIcon kind={t.icon} />
                </span>
                <h3>{t.label}</h3>
                <p>{t.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===================== أنشطة مميّزة (عند وجود محتوى) ========= */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <SectionHead
            kicker="الأكثر تفاعلًا"
            title="أنشطة مميّزة"
            action={{ href: '/search', label: 'كل الأنشطة' }}
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
      <section className="mx-auto max-w-7xl px-5 pb-6 sm:px-6">
        <div className="closing-band">
          <div className="sadu-band" aria-hidden />
          <div className="closing-body">
            <HeritageIcon kind="pearl" className="closing-pearl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-calli text-2xl text-white sm:text-3xl">
                كل درس فيه لؤلؤة تنتظر من يكتشفها
              </h2>
              <p className="mt-2 max-w-xl text-white/80">
                تصفّح المناهج واختر الدرس الذي تدرسه هذا الأسبوع، وابدأ بنشاطه.
              </p>
            </div>
            <Link href="/browse" className="closing-cta">
              تصفّح المناهج
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
