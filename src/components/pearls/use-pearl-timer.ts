'use client';

import { useEffect } from 'react';
import { awardPearl, hasPearl, PEARL_SECONDS } from '@/lib/pearls';

/** يعدّ ثواني التجربة الفعلية (والصفحة ظاهرة) ويمنح اللؤلؤة عند اكتمال الدقيقة. */
export function usePearlTimer(activityId: string, title: string) {
  useEffect(() => {
    if (hasPearl(activityId)) return;
    let seconds = 0;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      seconds++;
      if (seconds >= PEARL_SECONDS) {
        clearInterval(t);
        awardPearl(activityId, title);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activityId, title]);
}
