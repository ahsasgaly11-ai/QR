'use client';

import { useState } from 'react';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** فجوة بصرية بين القطاعات بلون السطح — تفصل الألوان المتجاورة دون حدّ إضافي. */
const GAP_PX = 3;

/**
 * حلقة نسبية (Donut) لعرض «جزء من كلّ».
 *
 * القيمة في المنتصف هي الرقم الرئيسي، وعند تمرير المؤشّر فوق قطاع يتحوّل
 * المنتصف إلى تفصيل ذلك القطاع — فلا نحتاج تلميحًا عائمًا يُزاحم البطاقة
 * على الجوال. الهوية لا تُحمل باللون وحده: لكل قطاع صفّ في المفتاح باسمه.
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
  const [innerActive, setInnerActive] = useState<string | null>(null);
  const active = activeKey !== undefined ? activeKey : innerActive;
  const setActive = (k: string | null) => {
    if (onActiveChange) onActiveChange(k);
    else setInnerActive(k);
  };

  const total = data.reduce((n, d) => n + d.value, 0);
  const r = (size - thickness) / 2 - 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;

  let cursor = 0;
  const arcs = data.map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const full = frac * c;
    const len = Math.max(0, full - (data.length > 1 ? GAP_PX : 0));
    const start = cursor;
    cursor += full;
    return { ...d, len, start, frac };
  });

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
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={thickness}
        />
        <g transform={`rotate(-90 ${mid} ${mid})`}>
          {arcs.map((a) => {
            const dim = active !== null && active !== a.key;
            return (
              <circle
                key={a.key}
                cx={mid}
                cy={mid}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={active === a.key ? thickness + 5 : thickness}
                strokeLinecap="butt"
                strokeDasharray={animate ? `${a.len} ${c - a.len}` : `0 ${c}`}
                strokeDashoffset={-a.start}
                opacity={dim ? 0.3 : 1}
                style={{
                  transition:
                    'stroke-dasharray 900ms cubic-bezier(.22,1,.36,1), opacity 200ms, stroke-width 200ms',
                  cursor: 'default',
                }}
                onMouseEnter={() => setActive(a.key)}
                onFocus={() => setActive(a.key)}
              />
            );
          })}
        </g>
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
