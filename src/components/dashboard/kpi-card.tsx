'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CountUp } from '@/components/count-up';

/**
 * بطاقة مؤشّر: الرقم الرئيسي + اتجاهه عن الفترة السابقة + خطّ مصغّر.
 * الاتجاه لا يُحمل باللون وحده: سهم + نسبة + نصّ «عن الفترة السابقة».
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  hasPrevious,
  series,
  tone,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  /** نسبة التغيّر (أو null حين لا قاعدة للمقارنة). */
  delta: number | null;
  /** هل توجد فترة سابقة أصلًا (false في «كل الفترة»). */
  hasPrevious: boolean;
  series?: number[];
  tone: string;
  note?: string;
}) {
  return (
    <div className="kpi-card" style={{ '--tone': tone } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="kpi-label">{label}</p>
          <CountUp value={value} className="kpi-value" />
        </div>
        <span className="kpi-icon" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <DeltaBadge delta={delta} hasPrevious={hasPrevious} value={value} />
        {series && series.length > 1 && <Sparkline values={series} />}
      </div>
      {note && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}

function DeltaBadge({
  delta,
  hasPrevious,
  value,
}: {
  delta: number | null;
  hasPrevious: boolean;
  value: number;
}) {
  if (!hasPrevious) {
    return <span className="kpi-delta is-flat">منذ البداية</span>;
  }
  if (delta === null) {
    return (
      <span className="kpi-delta is-flat">
        {value > 0 ? 'لا بيانات سابقة للمقارنة' : 'لا نشاط بعد'}
      </span>
    );
  }
  const rounded = Math.round(delta);
  const up = rounded > 0;
  const down = rounded < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const cls = up ? 'is-up' : down ? 'is-down' : 'is-flat';
  const word = up ? 'ارتفاع' : down ? 'انخفاض' : 'دون تغيّر';
  return (
    <span className={`kpi-delta ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="tabular-nums" dir="ltr">
        {up ? '+' : ''}
        {rounded}%
      </span>
      <span className="sr-only">
        {word} عن الفترة السابقة
      </span>
      <span className="kpi-delta-ctx font-medium opacity-80" aria-hidden>
        عن الفترة السابقة
      </span>
    </span>
  );
}

/** خطّ مصغّر بلا محاور — الزمن يجري من اليمين إلى اليسار (اتجاه القراءة). */
export function Sparkline({
  values,
  width = 84,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => {
    const x = width - i * step;
    const y = height - 3 - (v / max) * (height - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${width},${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="kpi-spark shrink-0"
      aria-hidden
    >
      <path d={area} className="kpi-spark-area" />
      <path d={line} className="kpi-spark-line" />
      <circle cx={last[0]} cy={last[1]} r={2.5} className="kpi-spark-dot" />
    </svg>
  );
}
