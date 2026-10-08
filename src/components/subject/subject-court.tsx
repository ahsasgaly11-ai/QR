import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { Subject } from '@/lib/types';
import { BackButton } from '@/components/back-button';
import { DownloadsSwitch } from '@/components/downloads-switch';
import { HeritageIcon } from '@/components/heritage-icons';
import type { HeritageIconKind } from '@/components/heritage-icons';

// ---------------------------------------------------------------------------
// رأس صفحة المادة: «الفناء» خلف باب المادة الذي فُتح في الرئيسية — جدار جصّي
// وباب مفتوح يتدفّق منه الضوء وفي قلبه رمز المادة ثلاثي الأبعاد، ثم اسم المادة
// وأعداد وحداتها ودروسها وأنشطتها.
// ---------------------------------------------------------------------------

const SUBJECT_ICON: Record<string, HeritageIconKind> = {
  science: 'flask',
};

export function SubjectCourt({ subject }: { subject: Subject }) {
  const units = subject.grades.reduce((n, g) => n + g.units.length, 0);
  const lessons = subject.grades.reduce(
    (n, g) => n + g.units.reduce((m, u) => m + u.lessons.length, 0),
    0
  );
  const activities = subject.grades.reduce(
    (n, g) =>
      n + g.units.reduce((m, u) => m + u.lessons.reduce((k, l) => k + l.activities.length, 0), 0),
    0
  );
  const icon = SUBJECT_ICON[subject.id] ?? 'pearl';

  return (
    <section className="subject-court" style={{ '--door': subject.color } as React.CSSProperties}>
      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pt-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:gap-12 md:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 pb-8 md:pb-10">
          <BackButton fallback="/browse" />
          <nav aria-label="مسار الصفحة" className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-[color:var(--maroon)]">الرئيسية</Link>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            <Link href="/browse" className="hover:text-[color:var(--maroon)]">المناهج</Link>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            <span className="font-semibold text-foreground" aria-current="page">{subject.title}</span>
          </nav>

          <div className="mt-5 flex items-end gap-5">
            <div className="min-w-0 flex-1">
              {subject.grades.length > 0 && (
                <p className="kicker">{subject.grades.map((g) => g.title).join(' • ')}</p>
              )}
              <h1 className="mt-2 font-calli text-5xl text-foreground sm:text-6xl lg:text-7xl">
                {subject.title}
              </h1>
            </div>
            {/* الباب مصغّرًا بجانب العنوان على الجوال */}
            <SubjectDoor icon={icon} className="court-door--mini md:hidden" />
          </div>

          <p className="mt-3 max-w-2xl text-[1.05rem] leading-8 text-[color:var(--ink-2)]">
            وحدات الكتاب المدرسي ودروسه بالترتيب نفسه، ولكل درس تجاربه ومحاكاته
            وأسئلته وألعابه — شغّلها مباشرة
            <DownloadsSwitch on=" أو حمّلها للعمل دون اتصال" off=" من الموقع" />.
          </p>

          <ul className="court-chips">
            <li><b>{units}</b> {units === 1 ? 'وحدة' : 'وحدات'}</li>
            <li><b>{lessons}</b> درسًا</li>
            <li><b>{activities}</b> نشاطًا</li>
          </ul>
        </div>

        <SubjectDoor icon={icon} className="hidden md:block" />
      </div>
      <div className="sadu-band" aria-hidden />
    </section>
  );
}

function SubjectDoor({ icon, className }: { icon: HeritageIconKind; className?: string }) {
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
