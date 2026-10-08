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
import { PlayHeader } from '@/components/play-header';
import { HeritageIcon, ACTIVITY_ICON } from '@/components/heritage-icons';
import { BackButton } from '@/components/back-button';
import { SITE_NAME } from '@/lib/site';
import { ACTIVITY_META } from '@/lib/types';

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
    `${ACTIVITY_META[activity.type]?.label ?? 'نشاط تفاعلي'}: ${activity.title} — جرّبه مباشرة على ${SITE_NAME}.`;
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
  // أنشطة المجموعة نفسها (الدرس، أو ألعاب التعزيز، أو المراجعات) بما فيها الحالي
  const siblings = all.filter((a) =>
    activity.smartReinforcement
      ? a.smartReinforcement
      : activity.unitReview
        ? a.unitReview
        : a.lessonId === activity.lessonId && !a.smartReinforcement && !a.unitReview
  );
  if (!siblings.some((a) => a.id === activity.id)) siblings.unshift(activity);
  const at = siblings.findIndex((a) => a.id === activity.id);
  const nextActivity = siblings.length > 1 ? siblings[(at + 1) % siblings.length] : undefined;

  const context = activity.smartReinforcement
    ? 'ألعاب التعزيز الذكية'
    : [subject?.title, activity.unitReview ? unit?.title : lesson?.title].filter(Boolean).join(' • ');

  return (
    <div className="short-tight mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="short-hide mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <BackButton
          fallback={
            activity.smartReinforcement
              ? '/smart-games'
              : activity.unitReview
                ? '/'
                : `/subject/${activity.subjectId}`
          }
        />
        <nav aria-label="مسار الصفحة" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-[color:var(--maroon)]">الرئيسية</Link>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {activity.smartReinforcement ? (
            <Link href="/smart-games" className="hover:text-[color:var(--maroon)]">ألعاب التعزيز الذكية</Link>
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

      <div className="play-below short-hide">
        <section>
          <h2 className="play-below-title">عن النشاط</h2>
          <p className="leading-8 text-[color:var(--ink-2)]">
            {activity.description?.trim() ||
              `${ACTIVITY_META[activity.type].label}${lesson ? ` من درس «${lesson.title}»` : ''} — شغّله داخل الموقع، أو بملء الشاشة على السبورة.`}
          </p>
        </section>
        {siblings.length > 1 && (
          <section className="min-w-0">
            <h2 className="play-below-title">
              {activity.smartReinforcement
                ? 'ألعاب التعزيز الذكية'
                : activity.unitReview
                  ? 'مراجعات الوحدات'
                  : 'أنشطة الدرس نفسه'}
            </h2>
            <ul className="sibling-strip">
              {siblings.map((a) => {
                const current = a.id === activity.id;
                const inner = (
                  <>
                    <HeritageIcon kind={ACTIVITY_ICON[a.type]} className="sibling-icon" />
                    <span className="min-w-0">
                      <span className="sibling-title">{a.title}</span>
                      <span className="sibling-type">
                        {ACTIVITY_META[a.type].label}
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
