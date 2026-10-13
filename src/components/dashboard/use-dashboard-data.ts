'use client';

import { useEffect, useState } from 'react';
import { getAllActivityStats, getSiteDaily, subscribeSiteStats } from '@/lib/stats';
import { getSchoolMetrics } from '@/lib/school-store';
import { lastDays, MAX_LOOKBACK_DAYS, type DailySite, type SiteTotals } from '@/lib/dashboard-metrics';
import type { ActivityStats } from '@/lib/types';
import type { SchoolMetric } from '@/lib/heatmap-shared';

export interface DashboardData {
  totals: SiteTotals;
  daily: DailySite;
  stats: Record<string, ActivityStats>;
  schools: Record<string, SchoolMetric>;
  /** وصلت قراءة الأنشطة والتوزيع اليومي (الإجمالي حيّ ومستقلّ). */
  loaded: boolean;
}

const ZERO: SiteTotals = { visitors: 0, views: 0, downloads: 0 };

/** يجمع كل ما تحتاجه اللوحة بقراءة واحدة لكل مجموعة. */
export function useDashboardData(): DashboardData {
  const [totals, setTotals] = useState<SiteTotals>(ZERO);
  const [daily, setDaily] = useState<DailySite>({});
  const [stats, setStats] = useState<Record<string, ActivityStats>>({});
  const [schools, setSchools] = useState<Record<string, SchoolMetric>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsub = subscribeSiteStats(setTotals);
    const days = lastDays(MAX_LOOKBACK_DAYS);
    Promise.all([
      getAllActivityStats(),
      getSiteDaily(days[0], days[days.length - 1]),
      getSchoolMetrics().catch(() => ({}) as Record<string, SchoolMetric>),
    ]).then(([s, d, sc]) => {
      if (!alive) return;
      setStats(s);
      setDaily(d);
      setSchools(sc);
      setLoaded(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return { totals, daily, stats, schools, loaded };
}

/** هل الزائر الحالي هو المالك؟ (في وضع العرض بلا Firebase: نعم). */
export function useIsOwner(): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    let off = () => {};
    import('@/lib/auth').then(({ isFirebaseConfigured, watchAdmin, isOwnerUid }) => {
      if (!alive) return;
      if (!isFirebaseConfigured) {
        setOwner(true);
        return;
      }
      off = watchAdmin((u) => {
        if (!u) {
          setOwner(false);
          return;
        }
        isOwnerUid(u.uid).then((ok) => alive && setOwner(ok));
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return owner;
}
