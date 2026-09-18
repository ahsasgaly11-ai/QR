import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { SUBJECTS, SEED_ACTIVITIES } from '@/data/curriculum';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ['', '/browse', '/search', '/dashboard', '/admin'].map(
    (p) => ({
      url: `${SITE_URL}${p}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1 : 0.7,
    })
  );

  const subjectRoutes = SUBJECTS.filter((s) => s.grades.length > 0).map((s) => ({
    url: `${SITE_URL}/subject/${s.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const activityRoutes = SEED_ACTIVITIES.map((a) => ({
    url: `${SITE_URL}/play/${a.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...subjectRoutes, ...activityRoutes];
}
