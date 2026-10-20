import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalPlay } from '@/components/local-play';
import { ChevronLeft } from 'lucide-react';
import {
  getActivity,
  getSubjects,
  locateActivity,
  getAllActivities,
} from '@/lib/content';
import { SEED_ACTIVITIES } from '@/data/curriculum';
import { ActivityPlayer } from '@/components/activity-player';
import { ReviewCards } from '@/components/review-cards';
import { PlayHeader } from '@/components/play-header';
import { PlayPageMode } from '@/components/play-page-mode';
import { IosDocumentsNotice } from '@/components/ios-documents-notice';
import { HeritageIcon, activityIcon } from '@/components/heritage-icons';
import { BackButton } from '@/components/back-button';
import { LessonObjectives } from '@/components/lesson-objectives';
import { ExitTicket } from '@/components/exit-ticket';
import { SITE_NAME } from '@/lib/site';
import { PRESENTATIONS_PATH, activityLabel } from '@/lib/types';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 30;

export function generateStaticParams() {
  return SEED_ACTIVITIES.map((a) => ({ activityId: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ activityId: string }>;
}): Promise<Metadata> {
  const { activityId } = await params;
  const activity = await getActivity(activityId);
  // لا noindex هنا: تعذّر قراءة Firestore لحظيًا قد يُخفي نشاطًا حقيقيًا عن Google
  if (!activity) return {};
  const title = `${activity.title} | ${SITE_NAME}`;
  const description =
    activity.description?.trim() ||
    `${activityLabel(activity)?.label ?? 'نشاط تفاعلي'}: ${activity.title} — جرّبه مباشرة على ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: `/play/${activity.id}` },
    openGraph: { title, description, url: `/play/${activity.id}` },
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = await getActivity(activityId);
  // قد يكون النشاط مرفوعًا في «وضع العرض» ومحفوظًا في متصفّح الزائر
  if (!activity) return <LocalPlay activityId={activityId} />;

  const subjects = await getSubjects();
  const { subject, unit, lesson } = locateActivity(subjects, activity);

  const all = await getAllActivities();
  // أنشطة المجموعة نفسها (الدرس، أو ألعاب التعزيز، أو المراجعات) بما فيها الحالي.
  // العرض التقديمي يتصدّر أنشطة درسه فيكون «التالي» بعده أوّل نشاط، أمّا من
  // داخل النشاط فلا تظهر عروض الدرس ضمن الأنشطة.
  const siblings = all.filter((a) =>
    activity.smartReinforcement
      ? a.smartReinforcement
      : activity.unitReview
        ? a.unitReview
        : a.lessonId === activity.lessonId &&
          !a.smartReinforcement &&
          !a.unitReview &&
          (!a.presentation || a.id === activity.id)
  );
  if (activity.presentation) siblings.sort((a, b) => Number(!!b.presentation) - Number(!!a.presentation));
  if (!siblings.some((a) => a.id === activity.id)) siblings.unshift(activity);
  const at = siblings.findIndex((a) => a.id === activity.id);
  const nextActivity = siblings.length > 1 ? siblings[(at + 1) % siblings.length] : undefined;

  const context = activity.smartReinforcement
    ? 'ألعاب التعزيز الذكية'
    : [subject?.title, activity.unitReview ? unit?.title : lesson?.title].filter(Boolean).join(' • ');

  return (
    <div className="short-tight mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <PlayPageMode />
      <div className="short-hide mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <BackButton
          fallback={
            activity.smartReinforcement
              ? '/smart-games'
              : activity.presentation
                ? PRESENTATIONS_PATH
                : activity.unitReview
                ? '/unit-reviews'
                : `/subject/${activity.subjectId}`
          }
        />
        <nav aria-label="مسار الصفحة" className="play-crumbs flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-[color:var(--maroon)]">الرئيسية</Link>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {activity.smartReinforcement ? (
            <Link href="/smart-games" className="hover:text-[color:var(--maroon)]">ألعاب التعزيز الذكية</Link>
          ) : activity.unitReview ? (
            <>
              <Link href="/unit-reviews" className="hover:text-[color:var(--maroon)]">مراجعات الوحدات</Link>
              {unit && (
                <>
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  <span>{unit.title}</span>
                </>
              )}
            </>
          ) : (
            <>
              {subject && (
                <>
                  <Link href={`/subject/${subject.id}`} className="hover:text-[color:var(--maroon)]">
                    {subject.title}
                  </Link>
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </>
              )}
              {unit && (
                <>
                  <span>{unit.title}</span>
                  {!activity.unitReview && lesson && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
                </>
              )}
              {!activity.unitReview && lesson && (
                <span className="font-semibold text-foreground">{lesson.title}</span>
              )}
            </>
          )}
        </nav>
      </div>

      <PlayHeader activity={activity} context={context} />

      <ActivityPlayer
        activity={activity}
        next={nextActivity ? { href: `/play/${nextActivity.id}`, title: nextActivity.title } : undefined}
      />

      {/* لأصحاب iPhone/iPad: توصية بتطبيق Documents لتشغيل الألعاب المحمَّلة */}
      <IosDocumentsNotice variant="inline" />

      <div className="play-below short-hide">
        <LessonObjectives activity={activity} lesson={lesson} />
        {activity.pedagogy?.exitTicket?.length ? (
          <ExitTicket activityId={activity.id} questions={activity.pedagogy.exitTicket} />
        ) : null}
        <section>
          <h2 className="play-below-title">عن النشاط</h2>
          <p className="leading-8 text-[color:var(--ink-2)]">
            {activity.description?.trim() ||
              `${activityLabel(activity).label}${lesson ? ` من درس «${lesson.title}»` : ''} — شغّله داخل الموقع، أو بملء الشاشة على السبورة.`}
          </p>
        </section>
        {activity.unitReview && (
          // كل مراجعات الوحدات (الأحدث أولًا) ببطاقات بمعاينة حيّة كبطاقات أنشطة الدروس
          <section className="play-below-wide min-w-0">
            <h2 className="play-below-title">مراجعات الوحدات</h2>
            <ReviewCards
              initialReviews={[...siblings].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))}
            />
          </section>
        )}
        {!activity.unitReview && siblings.length > 1 && (
          <section className="min-w-0">
            <h2 className="play-below-title">
              {activity.smartReinforcement
                ? 'ألعاب التعزيز الذكية'
                : activity.unitReview
                  ? 'مراجعات الوحدات'
                  : activity.presentation
                    ? 'أنشطة الدرس بعد العرض'
                    : 'أنشطة الدرس نفسه'}
            </h2>
            <ul className="sibling-strip">
              {siblings.map((a) => {
                const current = a.id === activity.id;
                const inner = (
                  <>
                    <HeritageIcon kind={activityIcon(a)} className="sibling-icon" />
                    <span className="min-w-0">
                      <span className="sibling-title">{a.title}</span>
                      <span className="sibling-type">
                        {activityLabel(a).label}
                        {current && ' • تشاهده الآن'}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={a.id}>
                    {current ? (
                      <span className="sibling is-current" aria-current="page">{inner}</span>
                    ) : (
                      <Link href={`/play/${a.id}`} className="sibling">{inner}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
