import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { getSubjects, countActivities } from '@/lib/content';
import { Reveal } from '@/components/reveal';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = { title: 'تصفّح المناهج | منصة مناهج قطر' };

export default async function BrowsePage() {
  const subjects = await getSubjects();

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <Reveal className="mb-10 text-center">
        <p className="diamond-divider mx-auto max-w-xs text-sm font-black">
          المكتبة التعليمية
        </p>
        <h1 className="mt-3 font-calli text-4xl font-bold text-[color:var(--maroon)] sm:text-5xl">
          تصفّح المناهج الدراسية
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          اختر المادة للوصول إلى المستويات والوحدات والدروس والأنشطة التفاعلية.
        </p>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s, i) => {
          const available = s.grades.length > 0;
          const count = countActivities([s]);
          const units = s.grades.reduce((n, g) => n + g.units.length, 0);
          const card = (
            <div
              className="card-premium relative flex h-64 flex-col justify-between overflow-hidden rounded-3xl p-7 text-white shadow-xl"
              style={{ background: `linear-gradient(135deg, ${s.color}, ${s.accent})` }}
            >
              <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
              <div className="absolute bottom-1 left-3 text-8xl opacity-20">{s.emoji}</div>
              <div className="relative">
                <span className="text-5xl">{s.emoji}</span>
                <h2 className="mt-3 font-display text-2xl font-black">{s.title}</h2>
                <p className="text-sm text-white/80">{s.titleEn}</p>
              </div>
              <div className="relative flex items-center justify-between">
                {available ? (
                  <span className="flex items-center gap-2 text-sm font-bold text-white/90">
                    <Layers className="h-4 w-4" />
                    {units} وحدة • {count} نشاط
                  </span>
                ) : (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                    قريبًا
                  </span>
                )}
                {available && <ArrowLeft className="h-6 w-6" />}
              </div>
            </div>
          );
          return (
            <Reveal key={s.id} delay={i * 90}>
              {available ? (
                <Link href={`/subject/${s.id}`}>{card}</Link>
              ) : (
                <div className="cursor-not-allowed opacity-70">{card}</div>
              )}
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
