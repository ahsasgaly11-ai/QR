import { UserHeatmap } from '@/components/user-heatmap';
import { StatsSyncNotice } from '@/components/stats-sync-notice';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { SITE_NAME } from '@/lib/site';

// العناوين تُحرَّر من لوحة الإدارة؛ تُعاد قراءتها دوريًا وفور الحفظ.
export const revalidate = 60;

export const metadata = { title: `الخريطة الحرارية للمستخدمين | ${SITE_NAME}` };

export default async function HeatmapPage() {
  const texts = await fetchSiteTextsServer();
  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'nav.heatmap') }]}
        kicker={txt(texts, 'page.heatmap.kicker')}
        title={txt(texts, 'page.heatmap.title')}
        icon="globe"
        color="#2d5f7c"
        lead={txt(texts, 'page.heatmap.lead')}
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <StatsSyncNotice />
        <UserHeatmap />
      </div>
    </>
  );
}
