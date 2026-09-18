import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';
import { getSubject } from '@/lib/content';
import { SUBJECTS } from '@/data/curriculum';
import { CurriculumExplorer } from '@/components/curriculum-explorer';
import { OryxMascot } from '@/components/oryx-mascot';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 30;

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subjectId: s.id }));
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
      {/* subject hero */}
      <section
        className="relative overflow-hidden py-14 text-white"
        style={{
          background: `linear-gradient(135deg, ${subject.color}, ${subject.accent})`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 girih-light" />
        <div className="pointer-events-none absolute -left-10 top-6 h-52 w-52 rounded-full bg-white/10 blur-2xl float-slow" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6">
          <div>
            <nav className="mb-4 flex items-center gap-2 text-sm text-white/80">
              <Link href="/" className="flex items-center gap-1 hover:text-white">
                <Home className="h-4 w-4" /> الرئيسية
              </Link>
              <ChevronLeft className="h-4 w-4" />
              <Link href="/browse" className="hover:text-white">المناهج</Link>
              <ChevronLeft className="h-4 w-4" />
              <span className="font-bold text-white">{subject.title}</span>
            </nav>
            <h1 className="font-calli text-4xl font-bold sm:text-5xl">
              {subject.title}
            </h1>
            <p className="mt-2 max-w-lg text-white/85">
              استكشف وحدات المنهج ودروسه، وشغّل الأنشطة التفاعلية مباشرة أو
              حمّلها للعمل دون اتصال.
            </p>
          </div>
          <OryxMascot priority className="hidden h-40 w-auto float-mid drop-shadow-2xl md:block" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <CurriculumExplorer subject={subject} />
      </section>
    </div>
  );
}
