import { Camera, ChevronLeft, Users, WifiOff } from 'lucide-react';

/**
 * بطاقة مميّزة للعبة «قرص التحدي» (واقع معزز بالكاميرا).
 * اللعبة تطبيق ويب ثابت في public/qurs، وتُفتح في صفحة كاملة لا داخل الإطار المعزول،
 * لأن الكاميرا والتثبيت على الشاشة الرئيسية لا يعملان داخل إطار sandbox.
 *
 * البطاقة لوح بحري ليلي بإطار نحاسي: القرص يطفو فوق ماء متموّج ويدور قليلًا عند
 * المرور، والزرّ نحاسي بحافّة مضغوطة كأزرار المنصّة.
 */
export function QursFeaturedCard() {
  return (
    <a href="/qurs" aria-label="افتح لعبة قرص التحدي بالواقع المعزز" className="qurs-card group">
      <span className="qurs-sea" aria-hidden />
      <span className="qurs-disc" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/qurs/icons/icon-512.png" alt="" width={176} height={176} loading="lazy" />
      </span>
      <span className="qurs-body">
        <span className="qurs-badge">لعبة مميّزة • واقع معزّز</span>
        <span className="qurs-title">قرص التحدي</span>
        <span className="qurs-text">
          وجّه كاميرا الجهاز نحو القرص المعلّق في الصف، وارمِ الكرة: تتعرّف اللعبة على مكان
          الإصابة، وتحسب النقاط، وتعرض سؤالًا مع مؤثرات نارية ثلاثية الأبعاد.
        </span>
        <span className="qurs-feats">
          <span><Camera className="h-4 w-4" aria-hidden /> تحتاج كاميرا الجهاز</span>
          <span><Users className="h-4 w-4" aria-hidden /> فردي أو مجموعات</span>
          <span><WifiOff className="h-4 w-4" aria-hidden /> تعمل دون إنترنت بعد أول فتح</span>
        </span>
      </span>
      <span className="qurs-go">
        ابدأ اللعب
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </span>
    </a>
  );
}
