import { BarChart3 } from 'lucide-react';
import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { StatsDashboard } from '@/components/stats-dashboard';

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
      <div className="mb-10 flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-lg">
          <BarChart3 className="h-7 w-7" />
        </span>
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
