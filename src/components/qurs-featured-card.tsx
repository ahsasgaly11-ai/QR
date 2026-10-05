import { Camera, ChevronLeft, Sparkles, Users, WifiOff } from 'lucide-react';

/**
 * بطاقة مميّزة للعبة «قرص التحدي» (واقع معزز بالكاميرا).
 * اللعبة تطبيق ويب ثابت في public/qurs، وتُفتح في صفحة كاملة لا داخل الإطار المعزول،
 * لأن الكاميرا والتثبيت على الشاشة الرئيسية لا يعملان داخل إطار sandbox.
 */
export function QursFeaturedCard() {
  return (
    <a
      href="/qurs"
      aria-label="افتح لعبة قرص التحدي بالواقع المعزز"
      className="group relative mb-10 block overflow-hidden rounded-[2rem] border border-[color:var(--gold)]/40 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--gold)]"
      style={{ background: 'linear-gradient(135deg, #0b1410 0%, #17382a 55%, #0b1410 100%)' }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:var(--gold)]/15 blur-3xl" />
      <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qurs/icons/icon-512.png"
          alt=""
          width={176}
          height={176}
          loading="lazy"
          className="h-36 w-36 shrink-0 rounded-full shadow-2xl ring-4 ring-white/10 transition duration-500 group-hover:rotate-12 sm:h-44 sm:w-44"
        />
        <div className="min-w-0 flex-1 text-center sm:text-right">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-3 py-1 text-xs font-black text-[#1a1600]">
            <Sparkles className="h-4 w-4" />
            لعبة مميّزة • واقع معزز
          </div>
          <h3 className="font-calli text-3xl font-bold sm:text-4xl">قرص التحدي</h3>
          <p className="mt-2 max-w-2xl text-white/85">
            وجّه كاميرا الجهاز نحو القرص المعلّق في الصف، وارمِ الكرة: اللعبة تتعرف على مكان الإصابة،
            تحسب النقاط، وتعرض سؤالًا مع مؤثرات نارية ثلاثية الأبعاد.
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold sm:justify-start">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <Camera className="h-4 w-4 text-[color:var(--gold)]" /> تحتاج كاميرا الجهاز
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <Users className="h-4 w-4 text-[color:var(--gold)]" /> فردي أو مجموعات
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <WifiOff className="h-4 w-4 text-[color:var(--gold)]" /> تعمل دون إنترنت بعد أول فتح
            </li>
          </ul>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[color:var(--gold)] px-6 py-4 text-lg font-black text-[#1a1600] shadow-lg transition group-hover:scale-105">
          ابدأ اللعب
          <ChevronLeft className="h-5 w-5" />
        </span>
      </div>
    </a>
  );
}
