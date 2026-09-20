'use client';

import { useId, useState } from 'react';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** فجوة بصرية بين القطاعات بلون السطح — تفصل الألوان المتجاورة دون حدّ إضافي. */
const GAP_PX = 3;

/**
 * حلقة نسبية (Donut) لعرض «جزء من كلّ» — بطابع ثلاثي الأبعاد احترافي.
 *
 * العمق يُصنع بالإضاءة لا بالمنظور: لكل قطاع قوسٌ فاتح على حافّته الخارجية
 * وقوسٌ غامق على الداخلية فيبدو كأنبوب مجسَّم، مع ظلّ ناعم يرفع الحلقة عن
 * البطاقة ولمعانٍ علوي خفيف. الهندسة تبقى دقيقة تمامًا (لا ميل ولا منظور
 * يُشوّه النِّسَب)، والألوان تبقى دلالية لكل نوع.
 *
 * القيمة في المنتصف هي الرقم الرئيسي، وعند تمرير المؤشّر فوق قطاع يتحوّل
 * المنتصف إلى تفصيل ذلك القطاع. الهوية لا تُحمل باللون وحده: لكل قطاع صفّ
 * في المفتاح باسمه.
 */
export function DonutChart({
  data,
  size = 176,
  thickness = 24,
  animate = true,
  activeKey,
  onActiveChange,
  centerValue,
  centerLabel,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  animate?: boolean;
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  centerValue: string;
  centerLabel: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [innerActive, setInnerActive] = useState<string | null>(null);
  const active = activeKey !== undefined ? activeKey : innerActive;
  const setActive = (k: string | null) => {
    if (onActiveChange) onActiveChange(k);
    else setInnerActive(k);
  };

  const total = data.reduce((n, d) => n + d.value, 0);
  const gap = data.length > 1 ? GAP_PX : 0;

  // أنصاف أقطار الطبقات الثلاث: القوس الأساس، والحافّة الفاتحة (خارجًا)،
  // والحافّة الغامقة (داخلًا) — يصنعان انحناء الأنبوب المجسَّم.
  const mid = size / 2;
  const rMain = (size - thickness) / 2 - 4;
  const rHi = rMain + thickness * 0.24;
  const rLo = rMain - thickness * 0.24;
  const cMain = 2 * Math.PI * rMain;
  const cHi = 2 * Math.PI * rHi;
  const cLo = 2 * Math.PI * rLo;
  const edgeW = thickness * 0.36;

  let cursor = 0;
  const arcs = data.map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const startFrac = cursor;
    cursor += frac;
    return { ...d, frac, startFrac };
  });

  /** خصائص القوس على دائرة نصف قطرها R (طول القطعة + الإزاحة + المحيط). */
  const dash = (frac: number, startFrac: number, circ: number) => {
    const full = frac * circ;
    const len = Math.max(0, full - gap);
    return {
      strokeDasharray: animate ? `${len} ${circ - len}` : `0 ${circ}`,
      strokeDashoffset: -startFrac * circ,
    };
  };

  const arcTransition =
    'stroke-dasharray 900ms cubic-bezier(.22,1,.36,1), opacity 220ms ease, stroke-width 220ms ease';

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      onMouseLeave={() => setActive(null)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`رسم حلقي: ${data
          .map((d) => `${d.label} ${d.value}`)
          .join('، ')}`}
      >
        <defs>
          {/* ظلّ ناعم يرفع الحلقة عن سطح البطاقة */}
          <filter
            id={`sh-${uid}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#4b0f1a"
              floodOpacity="0.28"
            />
          </filter>

          {/* لمعان علوي: ضوء قادم من الأعلى يمسح الحلقة */}
          <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* مسار الخلفية (المضمار) بإحساس غائر خفيف */}
        <circle
          cx={mid}
          cy={mid}
          r={rMain}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={thickness}
        />
        <circle
          cx={mid}
          cy={mid}
          r={rMain + thickness / 2 - 0.75}
          fill="none"
          stroke="#000000"
          strokeOpacity="0.06"
          strokeWidth={1.5}
        />

        {/* القطاعات — كل قطاع ثلاث طبقات: أساس + حافّة فاتحة + حافّة غامقة */}
        <g
          transform={`rotate(-90 ${mid} ${mid})`}
          filter={`url(#sh-${uid})`}
        >
          {arcs.map((a) => {
            const dim = active !== null && active !== a.key;
            const isActive = active === a.key;
            const baseW = isActive ? thickness + 4 : thickness;
            return (
              <g
                key={a.key}
                opacity={dim ? 0.32 : 1}
                style={{ transition: 'opacity 220ms ease' }}
              >
                {/* الطبقة الأساس (اللون الدلالي) — هي وحدها القابلة للتمرير */}
                <circle
                  cx={mid}
                  cy={mid}
                  r={rMain}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={baseW}
                  strokeLinecap="butt"
                  {...dash(a.frac, a.startFrac, cMain)}
                  style={{ transition: arcTransition, cursor: 'default' }}
                  onMouseEnter={() => setActive(a.key)}
                  onFocus={() => setActive(a.key)}
                />
                {/* حافّة فاتحة على الخارج → بروز الأنبوب نحو الضوء */}
                <circle
                  cx={mid}
                  cy={mid}
                  r={rHi}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.34}
                  strokeWidth={edgeW}
                  strokeLinecap="butt"
                  pointerEvents="none"
                  {...dash(a.frac, a.startFrac, cHi)}
                  style={{ transition: arcTransition }}
                />
                {/* حافّة غامقة على الداخل → انحناء الأنبوب في الظلّ */}
                <circle
                  cx={mid}
                  cy={mid}
                  r={rLo}
                  fill="none"
                  stroke="#000000"
                  strokeOpacity={0.2}
                  strokeWidth={edgeW}
                  strokeLinecap="butt"
                  pointerEvents="none"
                  {...dash(a.frac, a.startFrac, cLo)}
                  style={{ transition: arcTransition }}
                />
              </g>
            );
          })}
        </g>

        {/* لمعان علوي فوق كل شيء (لا يعترض التمرير) */}
        <circle
          cx={mid}
          cy={mid}
          r={rMain}
          fill="none"
          stroke={`url(#gloss-${uid})`}
          strokeWidth={thickness}
          pointerEvents="none"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center px-2 text-center">
        <div>
          <div className="font-display text-2xl font-black leading-none text-foreground tabular-nums sm:text-3xl">
            {centerValue}
          </div>
          <p className="mt-1 text-[11px] font-bold leading-tight text-muted-foreground sm:text-xs">
            {centerLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
