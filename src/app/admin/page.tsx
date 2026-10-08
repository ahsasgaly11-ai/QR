import {
  getSubjects,
  getStructure,
  getAllActivities,
  getUploadedActivityIds,
  locateActivity,
} from '@/lib/content';
import { AdminShell } from '@/components/admin/admin-shell';
import { PageCourt } from '@/components/page-court';
import { SITE_NAME } from '@/lib/site';

// لوحة المالك تُقرأ حيّة دائمًا حتى يرى ما رفعه فورًا بلا انتظار.
export const dynamic = 'force-dynamic';

export const metadata = { title: `لوحة الإدارة | ${SITE_NAME}` };

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
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: 'لوحة الإدارة' }]}
        kicker="للمشرفين"
        title="لوحة الإدارة"
        icon="key"
        color="#5b3a22"
        lead="ارفع الأنشطة ونظّمها، وأدِر بنية المناهج والمواد والوحدات والدروس، ورسائل الشريط وإعدادات التنزيل."
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <AdminShell
          subjects={subjects}
          structure={structure}
          activities={activities}
          uploadedIds={[...uploadedIds]}
          labels={labels}
        />
      </div>
    </>
  );
}
