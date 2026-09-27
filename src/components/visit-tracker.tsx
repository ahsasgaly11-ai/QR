'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/stats';

/** عدّاد الزوّار: يحتسب كل دخول للموقع زيارةً جديدة (حتى لو تكرّر الشخص نفسه). */
export function VisitTracker() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}
