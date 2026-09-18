import { UploadCloud } from 'lucide-react';
import { getSubjects } from '@/lib/content';
import { AdminUploader } from '@/components/admin-uploader';

export const metadata = { title: 'رفع نشاط | منصة مناهج قطر' };

export default async function AdminPage() {
  const subjects = await getSubjects();
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-lg">
          <UploadCloud className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-black text-[color:var(--maroon)] sm:text-4xl">
          رفع نشاط تفاعلي جديد
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          نظّم نشاطك حسب المادة والمستوى والوحدة والدرس، وارفع ملف الـ HTML
          ليصبح متاحًا للتجربة والتحميل داخل المنصّة.
        </p>
      </div>
      <AdminUploader subjects={subjects} />
    </div>
  );
}
