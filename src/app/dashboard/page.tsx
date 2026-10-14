import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StatsSyncNotice } from '@/components/stats-sync-notice';
import { TrackingStatus } from '@/components/tracking-status';
import { PageCourt } from '@/components/page-court';
import { SITE_NAME } from '@/lib/site';
import type { DashboardRow } from '@/lib/dashboard-metrics';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = {
  title: `لوحة الإحصاءات | ${SITE_NAME}`,
  alternates: { canonical: '/dashboard' },
};

export default async function DashboardPage() {
  const activities = await getAllActivities();
  const subjects = await getSubjects();

  const rows: DashboardRow[] = activities.map((a) => {
    const { subject, grade, unit, lesson } = locateActivity(subjects, a);
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      subjectId: a.subjectId ?? '',
      subject: subject?.title ?? '',
      gradeId: a.gradeId ?? '',
      grade: grade?.title ?? '',
      unitId: a.unitId ?? '',
      unit: unit?.title ?? '',
      lessonId: lesson ? a.lessonId : '',
      lesson: lesson?.title ?? '',
    };
  });

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: 'الإحصاءات' }]}
        kicker="متابعة حيّة"
        title="لوحة الإحصاءات"
        icon="chart"
        color="#b0862a"
        lead="المؤشّرات الرئيسية واتجاهها عبر الزمن في شاشة واحدة، والتفاصيل في أقسام مستقلّة."
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <StatsSyncNotice />
        <TrackingStatus />
        <DashboardShell rows={rows} />
      </div>
    </>
  );
}
