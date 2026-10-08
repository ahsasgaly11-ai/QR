import { UserHeatmap } from '@/components/user-heatmap';
import { StatsSyncNotice } from '@/components/stats-sync-notice';
import { PageCourt } from '@/components/page-court';
import { SITE_NAME } from '@/lib/site';

export const metadata = { title: `الخريطة الحرارية للمستخدمين | ${SITE_NAME}` };

export default function HeatmapPage() {
  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: 'الخريطة الحرارية' }]}
        kicker="من الدوحة إلى الشمال"
        title="الخريطة الحرارية"
        icon="globe"
        color="#2d5f7c"
        lead="تركيز مستخدمي الألعاب التعليمية في بلديات قطر بحسب موقع المدرسة التي يختارها الطالب — بلا أي بيانات شخصية."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <StatsSyncNotice />
        <UserHeatmap />
      </div>
    </>
  );
}
