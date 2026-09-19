import { BarChart3 } from 'lucide-react';
import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { StatsDashboard } from '@/components/stats-dashboard';
import { BackButton } from '@/components/back-button';
import { Icon3D } from '@/components/icon-3d';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = { title: 'لوحة الإحصاءات | منصة مناهج قطر' };

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
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-6 flex">
        <BackButton fallback="/" />
      </div>
      <div className="mb-10 flex items-center gap-4">
        <Icon3D icon={BarChart3} size="lg" />
        <div>
          <h1 className="font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
            لوحة الإحصاءات
          </h1>
          <p className="text-muted-foreground">
            متابعة حيّة للزوّار والمشاهدات والتنزيلات عبر المنصّة.
          </p>
        </div>
      </div>
      <StatsDashboard activities={rows} />
    </div>
  );
}
