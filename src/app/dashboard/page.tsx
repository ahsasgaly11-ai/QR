import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { StatsDashboard } from '@/components/stats-dashboard';
import { UserHeatmap } from '@/components/user-heatmap';
import { StatsSyncNotice } from '@/components/stats-sync-notice';
import { PageCourt } from '@/components/page-court';
import { SITE_NAME } from '@/lib/site';

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

  const rows = activities.map((a) => {
    const { subject } = locateActivity(subjects, a);
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      subject: subject?.title ?? '',
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
        lead="الزوّار والمشاهدات والتنزيلات عبر المنصّة لحظة بلحظة، وأكثر الأنشطة إقبالًا، وانتشار المستخدمين في مناطق قطر."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <StatsSyncNotice />
        <StatsDashboard activities={rows} />

        <div className="mt-5 sm:mt-8">
          <UserHeatmap />
        </div>
      </div>
    </>
  );
}
