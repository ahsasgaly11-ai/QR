'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/stats';

/** Fire-and-forget visitor counter (once per browser per day). */
export function VisitTracker() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}
