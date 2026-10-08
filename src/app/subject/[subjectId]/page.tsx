import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject } from '@/lib/content';
import { SUBJECTS } from '@/data/curriculum';
import { CurriculumExplorer } from '@/components/curriculum-explorer';
import { SubjectCourt } from '@/components/subject/subject-court';
import { SITE_NAME } from '@/lib/site';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 30;

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subjectId: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}): Promise<Metadata> {
  const { subjectId } = await params;
  const subject = await getSubject(subjectId);
  if (!subject) return {};
  const title = `${subject.title} | ${SITE_NAME}`;
  const description = `${subject.title} — ${subject.tagline}`;
  return {
    title,
    description,
    alternates: { canonical: `/subject/${subject.id}` },
    openGraph: { title, description, url: `/subject/${subject.id}` },
  };
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const subject = await getSubject(subjectId);
  if (!subject) notFound();

  return (
    <div className="relative">
      <SubjectCourt subject={subject} />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:py-14">
        <CurriculumExplorer subject={subject} />
      </section>
    </div>
  );
}
