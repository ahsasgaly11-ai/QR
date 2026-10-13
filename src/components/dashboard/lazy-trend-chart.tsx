'use client';

import dynamic from 'next/dynamic';

/**
 * مكتبة المخطّطات (Recharts) ثقيلة نسبيًا، فتُحمَّل عند الحاجة فقط ولا تُبطئ
 * أوّل عرض للوحة. حتى تصل يظهر هيكل بنفس الارتفاع فلا تقفز الصفحة.
 */
export const TrendChart = dynamic(() => import('./trend-chart').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-[240px] animate-pulse rounded-xl bg-[color:var(--surface-2)]" aria-hidden />,
});
