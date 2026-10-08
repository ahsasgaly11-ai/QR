import type { Subject } from '@/lib/types';
import { DownloadsSwitch } from '@/components/downloads-switch';
import type { HeritageIconKind } from '@/components/heritage-icons';
import { PageCourt } from '@/components/page-court';

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

  return (
    <PageCourt
      back="/browse"
      crumbs={[{ href: '/', label: 'الرئيسية' }, { href: '/browse', label: 'المناهج' }, { label: subject.title }]}
      kicker={subject.grades.length > 0 ? subject.grades.map((g) => g.title).join(' • ') : undefined}
      title={subject.title}
      icon={SUBJECT_ICON[subject.id] ?? 'pearl'}
      color={subject.color}
      lead={
        <>
          وحدات الكتاب المدرسي ودروسه بالترتيب نفسه، ولكل درس تجاربه ومحاكاته
          وأسئلته وألعابه — شغّلها مباشرة
          <DownloadsSwitch on=" أو حمّلها للعمل دون اتصال" off=" من الموقع" />.
        </>
      }
      chips={[
        { n: units, label: units === 1 ? 'وحدة' : 'وحدات' },
        { n: lessons, label: 'درسًا' },
        { n: activities, label: 'نشاطًا' },
      ]}
    />
  );
}
