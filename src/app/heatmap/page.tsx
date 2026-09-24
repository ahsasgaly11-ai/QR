import { Flame } from 'lucide-react';
import { UserHeatmap } from '@/components/user-heatmap';
import { BackButton } from '@/components/back-button';
import { StatsSyncNotice } from '@/components/stats-sync-notice';
import { Icon3D } from '@/components/icon-3d';
import { SITE_NAME } from '@/lib/site';

export const metadata = { title: `الخريطة الحرارية للمستخدمين | ${SITE_NAME}` };

export default function HeatmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
      <div className="mb-6 flex">
        <BackButton fallback="/" />
      </div>
      <div className="mb-10 flex items-center gap-4">
        <Icon3D icon={Flame} size="lg" />
        <div>
          <h1 className="font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
            الخريطة الحرارية للمستخدمين
          </h1>
          <p className="text-muted-foreground">
            تركيز مستخدمي الألعاب التعليمية في مناطق قطر بحسب موقع المدرسة المختارة.
          </p>
        </div>
      </div>
      <StatsSyncNotice />
      <UserHeatmap />
    </div>
  );
}
