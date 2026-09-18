import { cn } from '@/lib/utils';

/**
 * Stylized Arabian Oryx (المها العربي) — Qatar's national animal and the
 * science book's mascot. Built as inline SVG so it scales crisply and can be
 * animated. Palette echoes the book: violet body, cream face, maroon accents.
 */
export function OryxMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 300"
      className={cn('select-none', className)}
      role="img"
      aria-label="المها العربي — رمز العلوم"
    >
      <defs>
        <linearGradient id="oryxBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a45bb0" />
          <stop offset="1" stopColor="#7a3d94" />
        </linearGradient>
        <linearGradient id="oryxFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf6ec" />
          <stop offset="1" stopColor="#e8d9c3" />
        </linearGradient>
        <linearGradient id="oryxHorn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2b22" />
          <stop offset="1" stopColor="#5f4636" />
        </linearGradient>
        <radialGradient id="oryxGem" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#e7cf6f" />
          <stop offset="1" stopColor="#c9a227" />
        </radialGradient>
      </defs>

      {/* horns */}
      <g fill="url(#oryxHorn)">
        <path d="M96 92 C88 60 84 34 92 8 L100 8 C98 36 102 62 108 90 Z" />
        <path d="M144 92 C152 60 156 34 148 8 L140 8 C142 36 138 62 132 90 Z" />
      </g>
      {/* horn ridges */}
      <g stroke="#2a1e17" strokeWidth="2" opacity="0.4">
        <line x1="90" y1="26" x2="99" y2="24" />
        <line x1="89" y1="44" x2="100" y2="42" />
        <line x1="90" y1="62" x2="103" y2="60" />
        <line x1="150" y1="26" x2="141" y2="24" />
        <line x1="151" y1="44" x2="140" y2="42" />
        <line x1="150" y1="62" x2="137" y2="60" />
      </g>

      {/* ears */}
      <ellipse cx="66" cy="112" rx="20" ry="13" fill="url(#oryxBody)" transform="rotate(-24 66 112)" />
      <ellipse cx="174" cy="112" rx="20" ry="13" fill="url(#oryxBody)" transform="rotate(24 174 112)" />

      {/* head */}
      <path
        d="M120 96 C160 96 180 124 180 158 C180 205 150 236 120 236 C90 236 60 205 60 158 C60 124 80 96 120 96 Z"
        fill="url(#oryxBody)"
      />
      {/* face blaze */}
      <path
        d="M120 108 C144 108 156 130 156 160 C156 198 138 224 120 224 C102 224 84 198 84 160 C84 130 96 108 120 108 Z"
        fill="url(#oryxFace)"
      />
      {/* dark oryx facial markings */}
      <path d="M96 128 q-6 26 4 52 q6 -30 2 -52 Z" fill="#3a2b22" opacity="0.85" />
      <path d="M144 128 q6 26 -4 52 q-6 -30 -2 -52 Z" fill="#3a2b22" opacity="0.85" />

      {/* eyes */}
      <g>
        <ellipse cx="104" cy="156" rx="12" ry="14" fill="#241a14" />
        <ellipse cx="136" cy="156" rx="12" ry="14" fill="#241a14" />
        <circle cx="100" cy="151" r="4" fill="#fff" />
        <circle cx="132" cy="151" r="4" fill="#fff" />
      </g>

      {/* muzzle */}
      <ellipse cx="120" cy="200" rx="20" ry="15" fill="#e8d9c3" />
      <ellipse cx="120" cy="197" rx="9" ry="6" fill="#3a2b22" />
      <path d="M120 203 v10" stroke="#3a2b22" strokeWidth="3" strokeLinecap="round" />

      {/* science gem on the chest (nod to the robotic mascot) */}
      <circle cx="120" cy="252" r="18" fill="url(#oryxGem)" stroke="#8a1538" strokeWidth="3" />
      <circle cx="120" cy="252" r="7" fill="#fff" opacity="0.85" />
    </svg>
  );
}
