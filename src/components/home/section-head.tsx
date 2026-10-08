import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** عنوان قسم موحّد: سطر تمهيدي صغير، عنوان كوفي، ورابط جانبي اختياري. */
export function SectionHead({
  kicker,
  title,
  lead,
  action,
}: {
  kicker: string;
  title: string;
  lead?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="section-head">
      <div className="min-w-0">
        <p className="kicker">{kicker}</p>
        <h2 className="mt-2 font-calli text-[1.9rem] leading-[1.5] text-foreground sm:text-[2.3rem]">
          {title}
        </h2>
        {lead && <p className="mt-2 max-w-2xl text-[color:var(--ink-2)]">{lead}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1.5 font-gov text-[15px] font-semibold text-[color:var(--maroon)] underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowLeft className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
