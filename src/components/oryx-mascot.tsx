import { cn } from '@/lib/utils';

/**
 * Arabian Oryx (المها العربي) — Qatar's national animal and the science
 * book's mascot. Refined, emblem-quality inline SVG: long ringed horns, the
 * oryx's signature dark facial mask, elegant proportions, a subtle gold spark.
 */
export function OryxMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 320"
      className={cn('select-none', className)}
      role="img"
      aria-label="المها العربي — رمز العلوم"
    >
      <defs>
        <linearGradient id="oxCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfaf3" />
          <stop offset="1" stopColor="#efe4cf" />
        </linearGradient>
        <linearGradient id="oxHorn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2320" />
          <stop offset="1" stopColor="#5a463b" />
        </linearGradient>
        <linearGradient id="oxMask" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2f2b" />
          <stop offset="1" stopColor="#33211f" />
        </linearGradient>
        <radialGradient id="oxSpark" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f0dc9c" />
          <stop offset="1" stopColor="#b0892e" />
        </radialGradient>
      </defs>

      {/* long ringed horns */}
      <g fill="url(#oxHorn)">
        <path d="M104 132 C98 92 92 50 86 10 L96 8 C104 48 110 92 116 130 Z" />
        <path d="M136 132 C142 92 148 50 154 10 L144 8 C136 48 130 92 124 130 Z" />
      </g>
      <g stroke="#1f1815" strokeWidth="2.4" opacity="0.45" strokeLinecap="round">
        <line x1="92" y1="30" x2="100" y2="29" /><line x1="90" y1="48" x2="101" y2="47" />
        <line x1="89" y1="66" x2="104" y2="64" /><line x1="90" y1="86" x2="108" y2="84" />
        <line x1="93" y1="108" x2="112" y2="106" />
        <line x1="148" y1="30" x2="140" y2="29" /><line x1="150" y1="48" x2="139" y2="47" />
        <line x1="151" y1="66" x2="136" y2="64" /><line x1="150" y1="86" x2="132" y2="84" />
        <line x1="147" y1="108" x2="128" y2="106" />
      </g>

      {/* ears */}
      <path d="M74 150 C50 138 40 150 46 168 C64 172 78 166 74 150 Z" fill="url(#oxCoat)" stroke="#e0d2b8" strokeWidth="2" />
      <path d="M166 150 C190 138 200 150 194 168 C176 172 162 166 166 150 Z" fill="url(#oxCoat)" stroke="#e0d2b8" strokeWidth="2" />

      {/* head */}
      <path
        d="M120 118 C156 118 176 142 176 178 C176 214 168 244 150 262 C140 272 130 276 120 276 C110 276 100 272 90 262 C72 244 64 214 64 178 C64 142 84 118 120 118 Z"
        fill="url(#oxCoat)"
      />

      {/* dark facial mask (blaze + eye bands + muzzle band) */}
      <path d="M120 122 C132 122 138 132 138 146 C138 156 130 160 120 160 C110 160 102 156 102 146 C102 132 108 122 120 122 Z" fill="url(#oxMask)" />
      <path d="M96 150 C86 156 82 172 86 196 C92 200 100 198 104 190 C108 176 106 160 96 150 Z" fill="url(#oxMask)" />
      <path d="M144 150 C154 156 158 172 154 196 C148 200 140 198 136 190 C132 176 134 160 144 150 Z" fill="url(#oxMask)" />
      <path d="M120 232 C104 232 92 240 92 252 C92 264 104 272 120 272 C136 272 148 264 148 252 C148 240 136 232 120 232 Z" fill="url(#oxMask)" opacity="0.92" />

      {/* eyes */}
      <g>
        <ellipse cx="99" cy="176" rx="11" ry="13" fill="#1c1512" />
        <ellipse cx="141" cy="176" rx="11" ry="13" fill="#1c1512" />
        <circle cx="95.5" cy="171.5" r="3.4" fill="#fff" />
        <circle cx="137.5" cy="171.5" r="3.4" fill="#fff" />
      </g>

      {/* muzzle highlight + nose */}
      <ellipse cx="120" cy="250" rx="15" ry="10" fill="#5a3f39" />
      <ellipse cx="120" cy="246" rx="8" ry="5.5" fill="#241a17" />

      {/* gold "science" spark on the brow */}
      <circle cx="120" cy="140" r="6.5" fill="url(#oxSpark)" />
      <circle cx="118" cy="138" r="2" fill="#fff" opacity="0.9" />
    </svg>
  );
}
