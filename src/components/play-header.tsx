import type { Activity } from '@/lib/types';
import { activityLabel } from '@/lib/types';
import { HeritageIcon, activityIcon } from './heritage-icons';
import { ActivityStatsChips } from './activity-stats-chips';

/** رأس صفحة التشغيل: أيقونة نوع النشاط ثلاثية الأبعاد، العنوان، سطر تعريفي،
 *  وعدّادات المشاهدة والتنزيل الحيّة. */
export function PlayHeader({ activity, context }: { activity: Activity; context?: string }) {
  const meta = activityLabel(activity);
  return (
    <header className="play-head">
      <span className="play-head-icon" aria-hidden>
        <HeritageIcon kind={activityIcon(activity)} />
      </span>
      <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
        <h1 className="short-title font-calli text-[1.75rem] leading-[1.45] text-foreground sm:text-4xl">
          {activity.title}
        </h1>
        <p className="short-hide mt-1 text-sm text-muted-foreground">
          <span className="font-semibold" style={{ color: `color-mix(in srgb, ${meta.color} 60%, var(--ink))` }}>{meta.label}</span>
          {context && <> • {context}</>}
        </p>
      </div>
      <div className="short-hide">
        <ActivityStatsChips activity={activity} />
      </div>
    </header>
  );
}
