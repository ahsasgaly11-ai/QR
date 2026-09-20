import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { getSubjects, getAllActivities } from '@/lib/content';

// تُبنى خريطة الموقع من المحتوى الفعلي (المواد والأنشطة المرفوعة) لا من بذور
// ثابتة، فتكتشف Google كل صفحات الأنشطة. تُعاد كل ساعة.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = ['', '/browse', '/search', '/dashboard'].map(
    (p) => ({
      url: `${SITE_URL}${p}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1 : 0.7,
    })
  );

  let subjectRoutes: MetadataRoute.Sitemap = [];
  let activityRoutes: MetadataRoute.Sitemap = [];
  try {
    const [subjects, activities] = await Promise.all([
      getSubjects(),
      getAllActivities(),
    ]);
    subjectRoutes = subjects
      .filter((s) => s.grades.length > 0)
      .map((s) => ({
        url: `${SITE_URL}/subject/${s.id}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    activityRoutes = activities
      .filter((a) => !a.local)
      .map((a) => ({
        url: `${SITE_URL}/play/${a.id}`,
        lastModified: a.createdAt ? new Date(a.createdAt) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
  } catch {
    // في حال تعذّر قراءة المحتوى، تبقى الصفحات الثابتة على الأقل.
  }

  return [...staticRoutes, ...subjectRoutes, ...activityRoutes];
}
