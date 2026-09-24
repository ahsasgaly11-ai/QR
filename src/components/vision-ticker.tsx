import { Sparkles } from 'lucide-react';

const VISION = 'متعلّم ريادي لتنمية مستدامة';
/** عدد تكرار العبارة في النصف الواحد — يكفي لملء أعرض الشاشات دون فراغ. */
const REPEAT = 8;

/**
 * شريط رؤية الوزارة المثبّت أسفل الصفحة: تتحرّك العبارة من اليمين إلى
 * اليسار باستمرار. المسار مكوّن من نصفين متطابقين يُزاح بمقدار نصفه ثم
 * يعود، فتبدو الحركة بلا انقطاع. يتوقّف عند المرور عليه، ويثبت لمن اختار
 * تقليل الحركة.
 */
export function VisionTicker() {
  const half = () => (
    <div className="vision-ticker-half">
      {Array.from({ length: REPEAT }, (_, i) => (
        <span key={i} className="vision-ticker-item" dir="rtl">
          <span className="vision-ticker-gem" aria-hidden />
          <strong>{VISION}</strong>
        </span>
      ))}
    </div>
  );

  return (
    <aside className="vision-ticker print:hidden" aria-label="رؤية الوزارة">
      <div className="vision-ticker-badge">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span>رؤية الوزارة</span>
      </div>
      <div className="vision-ticker-viewport" dir="ltr">
        {/* التكرار زخرفي: يقرأ قارئ الشاشة العبارة مرّة واحدة فقط */}
        <p className="sr-only" dir="rtl">
          رؤية الوزارة: {VISION}
        </p>
        <div className="vision-ticker-track" aria-hidden>
          {half()}
          {half()}
        </div>
      </div>
    </aside>
  );
}
