import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllActivities, getSubjects } from '@/lib/content';
import { HeritageDoor } from '@/components/home/heritage-door';
import { DOOR_PAINT, emblemFor } from '@/components/home/door-emblem';
import { SectionHead } from '@/components/home/section-head';
import { PageCourt } from '@/components/page-court';
import { SITE_NAME } from '@/lib/site';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = {
  title: `تصفّح المناهج | ${SITE_NAME}`,
  alternates: { canonical: '/browse' },
};

export default async function BrowsePage() {
  const [subjects, activities] = await Promise.all([getSubjects(), getAllActivities()]);

  const rows = subjects.map((s, i) => {
    const units = s.grades.reduce((n, g) => n + g.units.length, 0);
    const lessons = s.grades.reduce((n, g) => n + g.units.reduce((m, u) => m + u.lessons.length, 0), 0);
    const count = activities.filter((a) => a.subjectId === s.id && !a.smartReinforcement).length;
    return { s, units, lessons, count, available: s.grades.length > 0, color: DOOR_PAINT[i % DOOR_PAINT.length] };
  });
  const smartGames = activities.filter((a) => a.smartReinforcement).length;
  const open = rows.filter((r) => r.available);

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: 'الرئيسية' }, { label: 'المناهج' }]}
        kicker="المكتبة التعليمية"
        title="تصفّح المناهج"
        icon="globe"
        color="#2d5f7c"
        lead="كل مادة باب. اختر الباب لتصل إلى مستوياتها ووحداتها ودروسها، ثم إلى أنشطتها التفاعلية."
        chips={[
          { n: open.length, label: open.length === 1 ? 'مادة متاحة' : 'مواد متاحة' },
          { n: open.reduce((n, r) => n + r.units, 0), label: 'وحدات' },
          { n: open.reduce((n, r) => n + r.count, 0), label: 'نشاطًا' },
        ]}
      />

      <section className="door-wall border-t-0">
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:py-16">
          <div className="door-row">
            {rows.map(({ s, count, available, color }) => (
              <HeritageDoor
                key={s.id}
                href={`/subject/${s.id}`}
                title={s.title}
                meta={
                  available
                    ? [s.grades.map((g) => g.title).join(' • '), count > 0 && `${count} نشاطًا`]
                        .filter(Boolean)
                        .join(' • ')
                    : 'قريبًا'
                }
                color={color}
                emblem={emblemFor(s.id)}
                locked={!available}
              />
            ))}
            <HeritageDoor
              href="/smart-games"
              title="ألعاب التعزيز الذكية"
              meta={smartGames > 0 ? `${smartGames} لعبة` : 'تعلّم • العب • عزّز'}
              color="#2d5f7c"
              emblem="games"
            />
          </div>
        </div>
      </section>

      {/* دليل مختصر يقرأ أرقام كل مادة دفعة واحدة */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <SectionHead kicker="دليل المواد" title="ما في كل مادة" />
        <ol className="subject-ledger">
          {rows.map(({ s, units, lessons, count, available, color }) => {
            const body = (
              <>
                <span className="ledger-swatch" style={{ background: color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="ledger-title">{s.title}</span>
                  <span className="ledger-sub">
                    {available ? s.grades.map((g) => g.title).join(' • ') : 'تُضاف قريبًا'}
                  </span>
                </span>
                {available && (
                  <span className="ledger-nums">
                    <span><b>{units}</b> وحدات</span>
                    <span><b>{lessons}</b> درسًا</span>
                    <span><b>{count}</b> نشاطًا</span>
                  </span>
                )}
                {available && <ArrowLeft className="ledger-go h-5 w-5" aria-hidden />}
              </>
            );
            return (
              <li key={s.id}>
                {available ? (
                  <Link href={`/subject/${s.id}`} className="ledger-row">{body}</Link>
                ) : (
                  <div className="ledger-row is-soon" aria-disabled>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
