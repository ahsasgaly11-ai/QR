import { Settings2 } from 'lucide-react';
import {
  getSubjects,
  getStructure,
  getAllActivities,
  getUploadedActivityIds,
  locateActivity,
} from '@/lib/content';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata = { title: 'لوحة الإدارة | منصة مناهج قطر' };

export default async function AdminPage() {
  const [subjects, structure, activities, uploadedIds] = await Promise.all([
    getSubjects(),
    getStructure(),
    getAllActivities(),
    getUploadedActivityIds(),
  ]);

  const labels: Record<string, string> = {};
  for (const a of activities) {
    const { subject, unit, lesson } = locateActivity(subjects, a);
    labels[a.id] = [subject?.title, unit?.title, lesson?.title]
      .filter(Boolean)
      .join(' ← ');
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-[var(--shadow-md)]">
          <Settings2 className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
          لوحة الإدارة
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          ارفع الأنشطة ونظّمها، وأدِر بنية المناهج والمواد والوحدات والدروس.
        </p>
      </div>
      <AdminShell
        subjects={subjects}
        structure={structure}
        activities={activities}
        uploadedIds={[...uploadedIds]}
        labels={labels}
      />
    </div>
  );
}
