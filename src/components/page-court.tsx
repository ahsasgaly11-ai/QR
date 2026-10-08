import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { HeritageIcon } from '@/components/heritage-icons';
import type { HeritageIconKind } from '@/components/heritage-icons';

// ---------------------------------------------------------------------------
// رأس الصفحات الداخلية: «فناء» جصّي وباب مفتوح يتدفّق منه الضوء وفي قلبه رمز
// ثلاثي الأبعاد، ثم مسار الصفحة والعنوان وأرقامها. صفحة المادة وصفحات التصفّح
// والألعاب والبحث تتشارك هذا الرأس حتى تبدو كلها غرفًا في بيت واحد.
// ---------------------------------------------------------------------------

export type Crumb = { href?: string; label: string };

export function PageCourt({
  crumbs,
  back = '/',
  kicker,
  title,
  lead,
  icon,
  color = '#8a1538',
  chips,
  children,
}: {
  crumbs: Crumb[];
  back?: string;
  kicker?: string;
  title: string;
  lead?: React.ReactNode;
  icon: HeritageIconKind;
  color?: string;
  chips?: { n: number | string; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="subject-court" style={{ '--door': color } as React.CSSProperties}>
      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pt-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:gap-12 md:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 pb-8 md:pb-10">
          <BackButton fallback={back} />
          <nav aria-label="مسار الصفحة" className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.label} className="contents">
                {i > 0 && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-[color:var(--maroon)]">{c.label}</Link>
                ) : (
                  <span className="font-semibold text-foreground" aria-current="page">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="mt-5 flex items-end gap-5">
            <div className="min-w-0 flex-1">
              {kicker && <p className="kicker">{kicker}</p>}
              <h1 className="mt-2 font-calli text-[2.1rem] leading-[1.4] text-foreground sm:text-6xl lg:text-7xl">
                {title}
              </h1>
            </div>
            {/* الباب مصغّرًا بجانب العنوان على الجوال */}
            <CourtDoor icon={icon} className="court-door--mini md:hidden" />
          </div>

          {lead && (
            <p className="mt-3 max-w-2xl text-[1.05rem] leading-8 text-[color:var(--ink-2)]">{lead}</p>
          )}

          {chips && chips.length > 0 && (
            <ul className="court-chips">
              {chips.map((c) => (
                <li key={c.label}>
                  <b>{c.n}</b> {c.label}
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>

        <CourtDoor icon={icon} className="hidden md:block" />
      </div>
      <div className="sadu-band" aria-hidden />
    </section>
  );
}

export function CourtDoor({ icon, className }: { icon: HeritageIconKind; className?: string }) {
  return (
    <div className={`court-door ${className ?? ''}`} aria-hidden>
      <span className="court-niche">
        <span className="court-keystone" />
        <span className="court-inside">
          <span className="court-rays" />
        </span>
        <span className="court-leaf court-leaf--r" />
        <span className="court-leaf court-leaf--l" />
      </span>
      <span className="court-icon">
        <HeritageIcon kind={icon} />
      </span>
      <span className="court-floor" />
    </div>
  );
}
