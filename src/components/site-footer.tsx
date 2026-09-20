import Link from 'next/link';
import Image from 'next/image';

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-[color:var(--maroon-700)] text-white/90">
      <div className="h-2 w-full flag-strip" aria-hidden />
      {/* faint heritage motif */}
      <div className="pointer-events-none absolute -left-16 -top-10 h-64 w-64 rounded-full bg-[color:var(--gold)]/10 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-white p-1.5">
              <Image
                src="/images/moehe-mark.png"
                alt="شعار الوزارة"
                fill
                sizes="56px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="font-display text-lg font-black">منصة منهاج قطر التفاعلية</p>
              <p className="text-xs text-white/70">
                وزارة التربية والتعليم والتعليم العالي — دولة قطر
              </p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-7 text-white/70">
            منصة تعليمية تفاعلية تجمع التجارب العملية والمحاكاة والأسئلة بصيغة
            تفاعلية، يمكن للطلبة تجربتها مباشرة أو تحميلها لاستخدامها دون اتصال.
          </p>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-black text-[color:var(--gold-200)]">
            روابط سريعة
          </h3>
          <ul className="space-y-2 text-sm text-white/75">
            <li><Link href="/" className="hover:text-white">الرئيسية</Link></li>
            <li><Link href="/browse" className="hover:text-white">تصفّح المناهج</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">لوحة الإحصاءات</Link></li>
            <li><Link href="/admin" className="hover:text-white">رفع نشاط جديد</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-black text-[color:var(--gold-200)]">
            رؤية قطر الوطنية 2030
          </h3>
          <p className="text-sm leading-7 text-white/70">
            نُسهم في بناء التنمية البشرية من خلال تعليم رقمي إبداعي يواكب أحدث
            التقنيات ويعزّز حبّ الاستكشاف لدى المتعلّمين.
          </p>
        </div>
      </div>

      {/* اعتماد التصميم */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-5 text-center">
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
            <span className="text-white/55">تصميم</span>
            <span className="font-display font-bold text-[color:var(--gold-200)]">
              الأستاذ عبداللطيف الذهلي
            </span>
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} وزارة التربية والتعليم والتعليم العالي — جميع الحقوق محفوظة.</p>
          <p>صُمّمت بروح المناهج القطرية 🇶🇦</p>
        </div>
      </div>
    </footer>
  );
}
