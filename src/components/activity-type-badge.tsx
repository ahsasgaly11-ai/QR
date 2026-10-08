import { ACTIVITY_META, type ActivityType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HeritageIcon, ACTIVITY_ICON } from './heritage-icons';

/** شارة نوع النشاط: أيقونته ثلاثية الأبعاد صغيرة واسمه بلونه. */
export function ActivityTypeBadge({
  type,
  className,
}: {
  type: ActivityType;
  className?: string;
}) {
  const meta = ACTIVITY_META[type];
  return (
    <span
      className={cn('type-badge', className)}
      style={{ '--tc': meta.color } as React.CSSProperties}
    >
      <HeritageIcon kind={ACTIVITY_ICON[type]} className="h-5 w-5" />
      {meta.label}
    </span>
  );
}
