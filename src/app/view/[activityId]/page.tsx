import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getActivity } from '@/lib/content';
import { StandaloneView } from '@/components/standalone-view';
import { SITE_NAME } from '@/lib/site';
import { opensStandalone } from '@/lib/types';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، مثل صفحة التشغيل.
export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ activityId: string }>;
}): Promise<Metadata> {
  const { activityId } = await params;
  const activity = await getActivity(activityId);
  if (!activity) return { robots: { index: false } };
  // نسخة من صفحة التشغيل بلا واجهة الموقع: الأصل المعياري هو صفحة التشغيل
  return {
    title: `${activity.title} | ${SITE_NAME}`,
    alternates: { canonical: `/play/${activity.id}` },
    robots: { index: false, follow: true },
  };
}

/**
 * الصفحة المستقلة للعروض التقديمية ومراجعات الوحدات: المسرح وحده بملء
 * النافذة، بلا رأس الموقع ولا تذييله. الأنشطة الأخرى تُحال إلى صفحة التشغيل.
 */
export default async function StandalonePage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = await getActivity(activityId);
  if (activity && !opensStandalone(activity)) redirect(`/play/${activity.id}`);
  // غير موجود في الخادم: قد يكون محفوظًا في متصفّح الزائر (وضع العرض)
  return <StandaloneView activity={activity} activityId={activityId} />;
}
