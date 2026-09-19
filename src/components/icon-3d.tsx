import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * لوح أيقونة بعمق ثلاثي الأبعاد.
 *
 * العمق مبنيّ بالكامل من CSS لا من صورة: يبقى حادًّا على أي دقّة شاشة،
 * ولا يزيد حجم الصفحة بايتًا واحدًا، ويأخذ أي لون يُمرَّر إليه — فتحتفظ
 * كل مادة بلونها وتبقى الأيقونات نظامًا واحدًا.
 */
export function Icon3D({
  icon: Icon,
  color = 'var(--maroon)',
  size = 'md',
  lift = true,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  /** لون اللوح — تُشتقّ منه درجات الإضاءة والظلّ تلقائيًا */
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** يرتفع قليلًا عند المرور عليه أو على البطاقة الحاوية */
  lift?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const box = {
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-12 w-12 rounded-xl',
    lg: 'h-16 w-16 rounded-2xl',
    xl: 'h-20 w-20 rounded-[1.25rem]',
  }[size];

  const glyph = {
    sm: 'h-4.5 w-4.5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10',
  }[size];

  return (
    <span
      className={cn('icon-3d shrink-0', lift && 'icon-3d-lift', box, className)}
      style={{ ['--i3d' as string]: color }}
    >
      <Icon className={cn(glyph, iconClassName)} />
    </span>
  );
}
