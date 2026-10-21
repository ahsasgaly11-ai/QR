import { Camera, ChevronLeft, Hand, Users } from 'lucide-react';
import { boardGames } from '@/data/board-games';

/**
 * بطاقة مميّزة في صفحة ألعاب التعزيز تقود إلى قسم «ألعاب السبورة الذكية»
 * (ألعاب لمس السبورة باليد بكاميرا جهاز المعلّم). تستعير تخطيط بطاقة «قرص التحدي»
 * بألوان القسم.
 */
export function BoardGamesFeaturedCard() {
  const n = boardGames().length;
  return (
    <a href="/board-games" aria-label="افتح قسم ألعاب السبورة الذكية" className="qurs-card asnan-card group">
      <span className="qurs-disc asnan-disc" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/asnan/icons/icon-512.png" alt="" width={176} height={176} loading="lazy" />
      </span>
      <span className="qurs-body">
        <span className="qurs-badge">قسم جديد • لمس السبورة باليد</span>
        <span className="qurs-title">ألعاب السبورة الذكية</span>
        <span className="qurs-text">
          ألعاب يلعبها الصف بلمس السبورة بالأيدي، بلا أقلام ولا أجهزة للطلاب: جهاز المعلّم يعرض اللعبة على
          جهاز العرض ويرى أيدي الطلاب بكاميرته. {n.toLocaleString('ar-EG')} {n === 1 ? 'لعبة' : n <= 10 ? 'ألعاب' : 'لعبة'} حتى الآن.
        </span>
        <span className="qurs-feats">
          <span><Hand className="h-4 w-4" aria-hidden /> اللمس باليد على السبورة</span>
          <span><Camera className="h-4 w-4" aria-hidden /> آيباد أو هاتف + Apple TV</span>
          <span><Users className="h-4 w-4" aria-hidden /> الصف كله أو فريقان</span>
        </span>
      </span>
      <span className="qurs-go">
        افتح القسم
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </span>
    </a>
  );
}
