'use client';

import { useEffect, useState } from 'react';
import { subscribeSiteStats } from '@/lib/stats';
import { CountUp } from './count-up';

// صفّ أرقام حيّة بفواصل رفيعة — أرقام تُقرأ لا بطاقات تُزيَّن.
export function SiteStatsStrip({ activities }: { activities: number }) {
  const [s, setS] = useState({ visitors: 0, views: 0, downloads: 0 });

  // اشتراك حيّ: آخر أرقام مشتركة معروفة فورًا، ثم كل تحديث من الخادم.
  useEffect(() => subscribeSiteStats(setS), []);

  const items = [
    { label: 'نشاطًا تفاعليًا', value: activities },
    { label: 'زائرًا', value: s.visitors },
    { label: 'مشاهدة', value: s.views },
    { label: 'تنزيلًا', value: s.downloads },
  ];

  return (
    <dl className="stats-facts">
      {items.map((it) => (
        <div key={it.label} className="stats-fact">
          <dt className="sr-only">{it.label}</dt>
          <dd>
            <CountUp value={it.value} className="stats-fact-n" />
            <span className="stats-fact-l" aria-hidden>
              {it.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
