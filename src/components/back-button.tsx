'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * الصفحات التي زارها المستخدم داخل الموقع في هذا التبويب.
 *
 * تُحفَظ في sessionStorage لا في متغيّر عادي، لأن إعادة تحميل الصفحة تمسح
 * المتغيّرات بينما ذاكرة التبويب تبقى — فلو حدّث الطالب الصفحة لم يفقد
 * الزرّ معرفته بالصفحة السابقة.
 *
 * ولا نعتمد على history.length لأنه يَعُدّ ما قبل دخول الموقع أيضًا: من يفتح
 * رابط لعبة من واتساب كان الزرّ يُرجعه إلى صفحة فارغة خارج الموقع.
 */
const KEY = 'qa-visited-paths';

function readVisited(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberVisit(path: string) {
  try {
    const list = readVisited();
    if (!list.includes(path)) {
      list.push(path);
      // نحتفظ بآخر عشرين مسارًا فقط؛ لا حاجة لأكثر ولا لتضخيم الذاكرة
      sessionStorage.setItem(KEY, JSON.stringify(list.slice(-20)));
    }
  } catch {
    /* وضع التصفّح الخاص قد يمنع الكتابة — الزرّ يبقى يعمل بالبديل */
  }
}

export function BackButton({
  fallback = '/',
  label = 'رجوع',
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) rememberVisit(pathname);
  }, [pathname]);

  return (
    <button
      type="button"
      onClick={() => {
        // صفحة واحدة فقط في هذا التبويب = لا «سابق» داخل الموقع نعود إليه
        if (readVisited().length > 1) router.back();
        else router.push(fallback);
      }}
      aria-label={label}
      title={label}
      className={cn(
        'group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--hairline-strong)]',
        'bg-[color:var(--surface)] px-3 py-2 text-sm font-black text-[color:var(--maroon)]',
        'shadow-[var(--shadow-sm)] transition hover:border-[color:var(--maroon)] hover:bg-[color:var(--gold)]/10',
        'active:scale-95',
        className
      )}
    >
      {/* السهم يمينًا: الواجهة عربية، فالرجوع إلى الخلف = إلى اليمين */}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
