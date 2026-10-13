'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Users, Eye, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getFeedState, subscribeSiteStats } from '@/lib/stats';
import type { SiteTotals } from '@/lib/stats-server';
import { CountUp } from './count-up';

const ZERO: SiteTotals = { visitors: 0, views: 0, downloads: 0 };

// أربع لوحات بارزة، على كل منها وسام نحاسي/ملوّن محفور بأيقونته — أرقام حيّة
// تُقرأ بسرعة، بعمق وحافّة سفلية كقطع الجصّ المرفوعة.
//
// `initial`: الأرقام المشتركة كما قرأها الخادم وقت توليد الصفحة، فتظهر القيم
// الفعلية في أوّل رسم (وفي HTML نفسه) بدل أصفار تنتظر المتصفّح.
export function SiteStatsStrip({
  activities,
  initial,
}: {
  activities: number;
  initial?: SiteTotals | null;
}) {
  const [s, setS] = useState<SiteTotals>(initial ?? ZERO);

  // اشتراك حيّ: آخر أرقام مشتركة معروفة فورًا، ثم كل تحديث من الخادم.
  useEffect(
    () =>
      subscribeSiteStats((next) =>
        setS((prev) => {
          // اللقطة المؤكَّدة من الخادم هي المرجع. أمّا النسخة المخزَّنة في هذا
          // المتصفّح (قد تكون أقدم من أرقام الخادم المضمَّنة في الصفحة) فلا
          // تُنزِل رقمًا ظاهرًا: العدّادات لا تنقص.
          if (getFeedState().status === 'live') return next;
          return {
            visitors: Math.max(prev.visitors, next.visitors),
            views: Math.max(prev.views, next.views),
            downloads: Math.max(prev.downloads, next.downloads),
          };
        })
      ),
    []
  );

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
