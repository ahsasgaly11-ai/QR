import { Camera, ChevronLeft, Hand, Users } from 'lucide-react';

/**
 * بطاقة مميّزة للعبة «ركّب الأسنان» (لمس السبورة باليد).
 * اللعبة تطبيق ويب ثابت في public/asnan، وتُفتح في صفحة كاملة لا داخل الإطار المعزول،
 * لأنها تحتاج كاميرا الآيباد. تستعير تخطيط بطاقة «قرص التحدي» بألوان العنّابي.
 */
export function AsnanFeaturedCard() {
  return (
    <a href="/asnan" aria-label="افتح لعبة ركّب الأسنان على السبورة" className="qurs-card asnan-card group">
      <span className="qurs-disc asnan-disc" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/asnan/icons/icon-512.png" alt="" width={176} height={176} loading="lazy" />
      </span>
      <span className="qurs-body">
        <span className="qurs-badge">لعبة مميّزة • لمس السبورة باليد</span>
        <span className="qurs-title">ركّب الأسنان</span>
        <span className="qurs-text">
          يركّب الطلاب القواطع والأنياب والضواحك والطواحن في الفكّين بلمس السبورة بأيديهم،
          وكاميرا الآيباد المنعكس على جهاز العرض ترى أيديهم — بلا أقلام ولا أجهزة للطلاب.
        </span>
        <span className="qurs-feats">
          <span><Hand className="h-4 w-4" aria-hidden /> اللمس باليد على السبورة</span>
          <span><Camera className="h-4 w-4" aria-hidden /> كاميرا الآيباد + Apple TV</span>
          <span><Users className="h-4 w-4" aria-hidden /> فردي أو سباق فريقين</span>
        </span>
      </span>
      <span className="qurs-go">
        ابدأ اللعب
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </span>
    </a>
  );
}
