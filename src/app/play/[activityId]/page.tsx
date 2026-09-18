import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';
import {
  getActivity,
  getSubjects,
  locateActivity,
  getAllActivities,
} from '@/lib/content';
import { SEED_ACTIVITIES } from '@/data/curriculum';
import { ActivityPlayer } from '@/components/activity-player';
import { ActivityCard } from '@/components/activity-card';

export function generateStaticParams() {
  return SEED_ACTIVITIES.map((a) => ({ activityId: a.id }));
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = await getActivity(activityId);
  if (!activity) notFound();

  const subjects = await getSubjects();
  const { subject, unit, lesson } = locateActivity(subjects, activity);

  const all = await getAllActivities();
  const related = all.filter(
    (a) => a.lessonId === activity.lessonId && a.id !== activity.id
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* breadcrumb */}
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-[color:var(--qa-maroon)]">
          <Home className="h-4 w-4" /> الرئيسية
        </Link>
        <ChevronLeft className="h-4 w-4" />
        {subject && (
          <>
            <Link
              href={`/subject/${subject.id}`}
              className="hover:text-[color:var(--qa-maroon)]"
            >
              {subject.title}
            </Link>
            <ChevronLeft className="h-4 w-4" />
          </>
        )}
        {unit && (
          <>
            <span>{unit.title}</span>
            <ChevronLeft className="h-4 w-4" />
          </>
        )}
        {lesson && <span className="font-bold text-foreground">{lesson.title}</span>}
      </nav>

      <h1 className="mb-1 font-display text-3xl font-black text-[color:var(--qa-maroon)] sm:text-4xl">
        {activity.title}
      </h1>
      {activity.description && (
        <p className="mb-6 max-w-3xl text-muted-foreground">{activity.description}</p>
      )}

      <ActivityPlayer activity={activity} />

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 font-display text-2xl font-black text-[color:var(--qa-maroon)]">
            أنشطة أخرى في الدرس نفسه
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a, i) => (
              <ActivityCard key={a.id} activity={a} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
