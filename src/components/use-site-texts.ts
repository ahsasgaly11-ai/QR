'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_SITE_TEXTS, subscribeSiteTexts, type SiteTexts } from '@/lib/site-texts';

// اشتراك واحد مشترك في نصوص الموقع لكل مكوّنات المتصفّح (الترويسة والتذييل
// والمحرّر المباشر)، بدل مستمع منفصل لكل مكوّن.

let current: SiteTexts = DEFAULT_SITE_TEXTS;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!stop) {
    stop = subscribeSiteTexts((s) => {
      current = s;
      listeners.forEach((l) => l());
    });
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

export function useSiteTexts(): SiteTexts {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_SITE_TEXTS
  );
}
