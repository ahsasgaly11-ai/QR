'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Users, Eye, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { subscribeSiteStats } from '@/lib/stats';
import { CountUp } from './count-up';

// أربع لوحات بارزة، على كل منها وسام نحاسي/ملوّن محفور بأيقونته — أرقام حيّة
// تُقرأ بسرعة، بعمق وحافّة سفلية كقطع الجصّ المرفوعة.
export function SiteStatsStrip({ activities }: { activities: number }) {
  const [s, setS] = useState({ visitors: 0, views: 0, downloads: 0 });

  // اشتراك حيّ: آخر أرقام مشتركة معروفة فورًا، ثم كل تحديث من الخادم.
  useEffect(() => subscribeSiteStats(setS), []);

  const items: { label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { label: 'نشاطًا تفاعليًا', value: activities, icon: Sparkles, tone: '#8a1538' },
    { label: 'زائرًا', value: s.visitors, icon: Users, tone: '#2b6b62' },
    { label: 'مشاهدة', value: s.views, icon: Eye, tone: '#2d5f7c' },
    { label: 'تنزيلًا', value: s.downloads, icon: Download, tone: '#b0862a' },
  ];

  return (
    <dl className="stat-tiles">
      {items.map(({ label, value, icon: Icon, tone }, i) => (
        <div
          key={label}
          className="stat-tile"
          style={{ '--tone': tone, '--d': `${-i * 0.9}s` } as React.CSSProperties}
        >
          <span className="stat-medal" aria-hidden>
            <Icon className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <dt className="sr-only">{label}</dt>
          <dd className="stat-body">
            <CountUp value={value} className="stat-n" />
            <span className="stat-l" aria-hidden>
              {label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
