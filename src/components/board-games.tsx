import { ChevronLeft, Clock, MousePointerClick, Users } from 'lucide-react';
import type { BoardGame } from '@/data/board-games';
import { boardGameHref } from '@/data/board-games';

/**
 * بطاقة لعبة سبورة. اللعبة تطبيق ويب ثابت يُفتح في صفحة كاملة (لا داخل إطار
 * معزول: الكاميرا وملء الشاشة لا يعملان فيه)، لذا الروابط <a> عادية.
 */
export function BoardGameCard({ game }: { game: BoardGame }) {
  const href = boardGameHref(game);
  return (
    <article className="bg-card" style={{ '--bg-color': game.color } as React.CSSProperties}>
      <a href={href} className="bg-cover" aria-label={`افتح لعبة ${game.title} على السبورة`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={game.cover} alt={`لقطة من لعبة ${game.title}`} width={640} height={400} loading="lazy" />
        <span className="bg-subject">{game.subject}</span>
      </a>
      <div className="bg-body">
        <h3 className="bg-title">{game.title}</h3>
        {game.context && <p className="bg-context">{game.context}</p>}
        <p className="bg-summary">{game.summary}</p>
        <ul className="bg-objectives" aria-label="نواتج التعلّم">
          {game.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <div className="bg-meta">
          <span>
            <Clock className="h-4 w-4" aria-hidden /> {game.minutes.toLocaleString('ar-EG')} دقائق للجولة
          </span>
          <span>
            <Users className="h-4 w-4" aria-hidden /> {game.players}
          </span>
        </div>
        <div className="bg-modes" aria-label="أوضاع اللعب">
          {game.modes.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="bg-actions">
          <a href={href} className="bg-go">
            افتح على السبورة
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </a>
          <a href={`${href}?sim`} className="bg-try" title="الماوس يتصرف كيد الطالب: أبقِه على الهدف لحظة">
            <MousePointerClick className="h-4 w-4" aria-hidden /> جرّبها بالماوس
          </a>
        </div>
      </div>
    </article>
  );
}

/** رسم من أعلى للصف: أين يوضع الجهاز (زاوية جانبية) وأين لا يوضع (خلف الطلاب). */
export function ClassroomSetupDiagram() {
  return (
    <svg viewBox="0 0 460 340" role="img" aria-labelledby="bg-diagram-t" className="bg-diagram-svg">
      <title id="bg-diagram-t">
        مخطط الصف من أعلى: السبورة وجهاز العرض فوقها، والطلاب أمامها، والجهاز على حامل في الزاوية الجانبية يرى السبورة، وجهاز Apple TV
        متصل بجهاز العرض.
      </title>
      {/* السبورة وجهاز العرض */}
      <rect x="70" y="22" width="320" height="18" rx="4" className="d-board" />
      <text x="230" y="35" textAnchor="middle" className="d-label-sm">السبورة (الصورة المعروضة)</text>
      <rect x="205" y="6" width="50" height="12" rx="3" className="d-device" />
      <text x="262" y="15" className="d-label-xs">جهاز العرض</text>
      {/* Apple TV */}
      <rect x="400" y="8" width="44" height="18" rx="4" className="d-device" />
      <text x="422" y="40" textAnchor="middle" className="d-label-xs">Apple TV</text>
      <path d="M392 17 h-128" className="d-cable" />
      {/* الطلاب أمام السبورة */}
      {[150, 215, 285].map((x) => (
        <g key={x}>
          <circle cx={x} cy={78} r={15} className="d-kid" />
          <path d={`M${x} 63 v-18`} className="d-arm" />
        </g>
      ))}
      <text x="218" y="114" textAnchor="middle" className="d-label-sm">الطلاب يلمسون السبورة بأيديهم</text>
      {/* الجهاز الصحيح: زاوية جانبية */}
      <path d="M420 120 L392 40 L70 40 Z" className="d-fov" />
      <g transform="rotate(-62 420 128)">
        <rect x="402" y="118" width="36" height="22" rx="4" className="d-ok" />
      </g>
      <text x="420" y="168" textAnchor="middle" className="d-ok-t">✓ هنا</text>
      <text x="420" y="186" textAnchor="middle" className="d-label-xs">حامل في الزاوية، ١–١٫٥ م</text>
      {/* موجة لاسلكية إلى Apple TV */}
      <path d="M432 108 q14 -40 0 -66" className="d-wave" />
      {/* الخطأ: طاولة خلف الطلاب */}
      <rect x="170" y="250" width="120" height="44" rx="6" className="d-desk" />
      <rect x="214" y="238" width="32" height="20" rx="4" className="d-bad" />
      <path d="M230 236 L230 100" className="d-blocked" />
      <text x="230" y="316" textAnchor="middle" className="d-bad-t">✗ لا: على طاولة خلف الطلاب</text>
      <text x="230" y="333" textAnchor="middle" className="d-label-xs">أجسامهم تحجب أيديهم، والبُعد يُصغّرها</text>
    </svg>
  );
}
