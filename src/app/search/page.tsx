import { Search } from 'lucide-react';
import { getAllActivities, getSubjects, locateActivity } from '@/lib/content';
import { SearchExplorer, type SearchRow } from '@/components/search-explorer';
import { BackButton } from '@/components/back-button';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export const metadata = { title: 'بحث | منصة مناهج قطر' };

export default async function SearchPage() {
  const [activities, subjects] = await Promise.all([
    getAllActivities(),
    getSubjects(),
  ]);

  const rows: SearchRow[] = activities.map((a) => {
    const { subject, unit, lesson } = locateActivity(subjects, a);
    return {
      activity: a,
      subjectId: a.subjectId,
      subjectTitle: subject?.title ?? '',
      unitTitle: unit?.title ?? '',
      lessonTitle: lesson?.title ?? '',
    };
  });

  const subjectOpts = subjects
    .filter((s) => s.grades.length > 0)
    .map((s) => ({ id: s.id, title: s.title }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-6 flex">
        <BackButton fallback="/" />
      </div>
      <div className="mb-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-[var(--shadow-md)]">
          <Search className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-calli text-4xl font-bold text-[color:var(--maroon)] sm:text-5xl">
          ابحث في المنصّة
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          اعثر على أي تجربة أو محاكاة أو لعبة أو سؤال عبر الكلمات المفتاحية،
          وصفِّ النتائج حسب النوع أو المادة.
        </p>
      </div>
      <SearchExplorer rows={rows} subjects={subjectOpts} />
    </div>
  );
}
