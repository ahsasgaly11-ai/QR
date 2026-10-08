import { cn } from '@/lib/utils';
import type { ActivityType } from '@/lib/types';

// ---------------------------------------------------------------------------
// أيقونات ثلاثية الأبعاد بخامات من البيئة القطرية (زجاج، نحاس، صدف، لؤلؤ)
// بدل الأشكال البلاستيكية اللامعة. ترسم مرّة واحدة كرموز SVG في
// <HeritageIconSprite/> داخل التخطيط العام، وتُستدعى بـ <use> في أي مكان —
// فلا تتكرّر التدرّجات في الصفحة ولا تتعارض معرّفاتها.
// ---------------------------------------------------------------------------

export type HeritageIconKind = 'flask' | 'globe' | 'question' | 'oyster' | 'pearl' | 'chart' | 'key';

export const ACTIVITY_ICON: Record<ActivityType, HeritageIconKind> = {
  experiment: 'flask',
  simulation: 'globe',
  quiz: 'question',
  game: 'oyster',
};

export function HeritageIcon({
  kind,
  className,
  label,
}: {
  kind: HeritageIconKind;
  className?: string;
  /** نص بديل لقارئ الشاشة؛ بدونه تُعامل الأيقونة كزخرفة. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('heritage-icon', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <use href={`#hi-${kind}`} />
    </svg>
  );
}

/** يُضمَّن مرّة واحدة في التخطيط العام. مخفيّ بالأبعاد لا بـ display:none
 *  لأن المتصفّحات لا تطبّق تدرّجات عنصر مخفيّ بالكامل. */
export function HeritageIconSprite() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id="hi-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#e4efef" />
          <stop offset=".5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c3d8d8" />
        </linearGradient>
        <linearGradient id="hi-liquid" x1="0" x2="1">
          <stop offset="0" stopColor="#5c0e26" />
          <stop offset=".45" stopColor="#b8264f" />
          <stop offset="1" stopColor="#4d0a20" />
        </linearGradient>
        <linearGradient id="hi-cork" x1="0" x2="1">
          <stop offset="0" stopColor="#6e4a2a" />
          <stop offset=".5" stopColor="#b98a5a" />
          <stop offset="1" stopColor="#5b3a22" />
        </linearGradient>
        <radialGradient id="hi-sea" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#86bad8" />
          <stop offset=".6" stopColor="#2d5f7c" />
          <stop offset="1" stopColor="#163a4f" />
        </radialGradient>
        <radialGradient id="hi-sand" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#f6dfb0" />
          <stop offset="1" stopColor="#b98a4a" />
        </radialGradient>
        <linearGradient id="hi-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dc8e" />
          <stop offset=".5" stopColor="#d4a843" />
          <stop offset="1" stopColor="#8a6418" />
        </linearGradient>
        <linearGradient id="hi-gold-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7dc8f" />
          <stop offset="1" stopColor="#d4a843" />
        </linearGradient>
        <linearGradient id="hi-gold-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a87b22" />
          <stop offset="1" stopColor="#6d4e12" />
        </linearGradient>
        <linearGradient id="hi-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1e3cc" />
          <stop offset="1" stopColor="#b3946f" />
        </linearGradient>
        <linearGradient id="hi-nacre" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbeff2" />
          <stop offset=".5" stopColor="#e3c9d6" />
          <stop offset="1" stopColor="#c6d6e0" />
        </linearGradient>
        <radialGradient id="hi-pearl-g" cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#f0e8da" />
          <stop offset="1" stopColor="#ad9c82" />
        </radialGradient>

        {/* دورق التجارب */}
        <symbol id="hi-flask" viewBox="0 0 120 120">
          <ellipse cx="60" cy="112" rx="34" ry="6" fill="#231a17" opacity=".16" />
          <path d="M48 14h24v28l26 50a12 12 0 0 1-11 18H33a12 12 0 0 1-11-18l26-50z" fill="url(#hi-glass)" stroke="#9db7b7" strokeWidth="2" />
          <path d="M35 70h50l13 22a12 12 0 0 1-11 18H33a12 12 0 0 1-11-18z" fill="url(#hi-liquid)" />
          <ellipse cx="60" cy="70" rx="25" ry="5" fill="#d9577d" />
          <circle cx="50" cy="88" r="4" fill="#ffd1dd" opacity=".8" />
          <circle cx="66" cy="96" r="3" fill="#ffd1dd" opacity=".7" />
          <circle cx="58" cy="80" r="2.5" fill="#ffd1dd" opacity=".7" />
          <rect x="44" y="6" width="32" height="14" rx="4" fill="url(#hi-cork)" />
          <path d="M52 24v22l-22 44" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" fill="none" />
        </symbol>

        {/* كرة أرضية تظهر فيها شبه الجزيرة العربية وقطر، بحلقة نحاسية */}
        <symbol id="hi-globe" viewBox="0 0 120 120">
          <ellipse cx="60" cy="112" rx="30" ry="6" fill="#231a17" opacity=".16" />
          <circle cx="60" cy="56" r="42" fill="url(#hi-sea)" />
          <path d="M44 28c10-4 22-2 28 6 6 8 2 16 8 22 4 4 10 4 12 10-6 10-14 16-24 18-2-8-10-10-12-18-2-8-10-10-14-16-4-6-4-16 2-22z" fill="url(#hi-sand)" />
          <path d="M77 51l3 2-1 5-3-2z" fill="#8a1538" />
          <ellipse cx="60" cy="56" rx="56" ry="14" fill="none" stroke="url(#hi-brass)" strokeWidth="4" transform="rotate(-18 60 56)" />
          <circle cx="108" cy="40" r="6" fill="url(#hi-brass)" />
          <ellipse cx="44" cy="34" rx="12" ry="7" fill="#fff" opacity=".32" transform="rotate(-30 44 34)" />
        </symbol>

        {/* فقاعة سؤال ذهبية بسماكة */}
        <symbol id="hi-question" viewBox="0 0 120 120">
          <ellipse cx="60" cy="112" rx="34" ry="6" fill="#231a17" opacity=".16" />
          <path d="M20 28a14 14 0 0 1 14-14h56a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H56l-20 18v-18h-2a14 14 0 0 1-14-14z" fill="url(#hi-gold-side)" transform="translate(0 8)" />
          <path d="M20 28a14 14 0 0 1 14-14h56a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H56l-20 18v-18h-2a14 14 0 0 1-14-14z" fill="url(#hi-gold-top)" />
          <text x="62" y="70" textAnchor="middle" fontFamily="'Readex Pro', sans-serif" fontWeight="700" fontSize="54" fill="#8a1538">؟</text>
          <path d="M30 26a8 8 0 0 1 8-6h30" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none" />
        </symbol>

        {/* محارة مفتوحة فيها لؤلؤة — تراث الغوص */}
        <symbol id="hi-oyster" viewBox="0 0 120 120">
          <ellipse cx="60" cy="112" rx="38" ry="6" fill="#231a17" opacity=".16" />
          <path d="M14 76c10 26 82 26 92 0z" fill="url(#hi-shell)" stroke="#8c6f4e" strokeWidth="2" />
          <path d="M18 76c12 18 72 18 84 0z" fill="url(#hi-nacre)" />
          <g transform="rotate(-14 20 70)">
            <path d="M14 70C18 30 102 30 106 70c-10-10-82-10-92 0z" fill="url(#hi-shell)" stroke="#8c6f4e" strokeWidth="2" />
            <path d="M30 60q30-18 60 0M38 50q22-12 44 0" stroke="#a88a66" strokeWidth="2" fill="none" />
          </g>
          <circle cx="60" cy="78" r="15" fill="url(#hi-pearl-g)" />
          <circle cx="55" cy="73" r="4" fill="#fff" />
        </symbol>

        {/* لوحة أعمدة مجسّمة على قاعدة من الساج — للإحصاءات */}
        <symbol id="hi-chart" viewBox="0 0 120 120">
          <ellipse cx="60" cy="110" rx="44" ry="6" fill="#231a17" opacity=".16" />
          <path d="M12 92l48 14 48-14-48-12z" fill="url(#hi-cork)" />
          <path d="M12 92v6l48 14v-6z" fill="#5b3a22" />
          <path d="M108 92v6l-48 14v-6z" fill="#3f2816" />
          {/* عمود عنابي */}
          <path d="M22 88V52l14 4v36z" fill="#5c0e26" />
          <path d="M36 92V56l12-4v36z" fill="#8a1538" />
          <path d="M22 52l12-4 14 4-12 4z" fill="#c2456b" />
          {/* عمود ذهبي (الأطول) */}
          <path d="M46 94V30l14 4v64z" fill="url(#hi-gold-side)" />
          <path d="M60 98V34l12-4v64z" fill="#d4a843" />
          <path d="M46 30l12-4 14 4-12 4z" fill="url(#hi-gold-top)" />
          {/* عمود بحري */}
          <path d="M72 92V62l14 4v26z" fill="#163a4f" />
          <path d="M86 96V66l12-4v30z" fill="#2d5f7c" />
          <path d="M72 62l12-4 14 4-12 4z" fill="#86bad8" />
          <path d="M50 38v40" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".45" />
        </symbol>

        {/* مفتاح نحاسي قديم بمقبض مثمّن — للوحة الإدارة */}
        <symbol id="hi-key" viewBox="0 0 120 120">
          <ellipse cx="60" cy="110" rx="40" ry="5" fill="#231a17" opacity=".16" />
          <g transform="rotate(-35 60 60)">
            <rect x="46" y="54" width="62" height="12" rx="4" fill="url(#hi-gold-side)" transform="translate(0 4)" />
            <rect x="46" y="54" width="62" height="12" rx="4" fill="url(#hi-brass)" />
            <path d="M84 66h8v14h-8zM98 66h8v20h-8z" fill="url(#hi-gold-side)" />
            <path d="M84 66h8v12h-8zM98 66h8v18h-8z" fill="url(#hi-brass)" />
            <path d="M30 32l9 4 9-4 4 9 9 4-4 9 4 9-9 4-4 9-9-4-9 4-4-9-9-4 4-9-4-9 9-4z" fill="url(#hi-gold-side)" transform="translate(0 4)" />
            <path d="M30 32l9 4 9-4 4 9 9 4-4 9 4 9-9 4-4 9-9-4-9 4-4-9-9-4 4-9-4-9 9-4z" fill="url(#hi-brass)" />
            <circle cx="39" cy="60" r="10" fill="#8a1538" />
            <circle cx="39" cy="60" r="5" fill="#5c0e26" />
            <path d="M52 57h50" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
          </g>
        </symbol>

        <symbol id="hi-pearl" viewBox="0 0 120 120">
          <ellipse cx="60" cy="108" rx="28" ry="5" fill="#231a17" opacity=".14" />
          <circle cx="60" cy="58" r="40" fill="url(#hi-pearl-g)" />
          <circle cx="46" cy="44" r="10" fill="#fff" opacity=".9" />
        </symbol>
      </defs>
    </svg>
  );
}
