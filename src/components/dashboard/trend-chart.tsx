'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatFull } from '@/lib/utils';
import { shortDate } from '@/lib/dashboard-metrics';

/**
 * مخطّط الاتجاه اليومي — سلسلة واحدة ومحور واحد، فلا حاجة لمفتاح: العنوان
 * يسمّي المقياس. الزمن يجري من اليمين إلى اليسار (محور X معكوس) ليوافق
 * اتجاه القراءة العربية، والمحور الرأسي على اليمين.
 */
export function TrendChart({
  days,
  values,
  unit,
  color = 'var(--maroon)',
  height = 240,
}: {
  days: string[];
  values: number[];
  unit: string;
  color?: string;
  height?: number;
}) {
  const data = days.map((d, i) => ({ day: d, value: values[i] || 0 }));

  return (
    <div style={{ height }} className="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="day"
            reversed
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
            tickFormatter={shortDate}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickMargin={8}
          />
          <YAxis
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickFormatter={(v: number) => formatFull(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--hairline-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { day: string; value: number };
              return (
                <div className="chart-tip">
                  <p className="chart-tip-day">{shortDate(p.day)}</p>
                  <p className="chart-tip-val">
                    <span className="tabular-nums">{formatFull(p.value)}</span> {unit}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#trendFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
