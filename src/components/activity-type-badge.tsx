import { FlaskConical, Atom, HelpCircle, Gamepad2 } from 'lucide-react';
import { ACTIVITY_META, type ActivityType } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS = {
  flask: FlaskConical,
  atom: Atom,
  help: HelpCircle,
  gamepad: Gamepad2,
} as const;

export function ActivityTypeBadge({
  type,
  className,
}: {
  type: ActivityType;
  className?: string;
}) {
  const meta = ACTIVITY_META[type];
  const Icon = ICONS[meta.icon as keyof typeof ICONS];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm',
        className
      )}
      style={{ background: meta.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}
