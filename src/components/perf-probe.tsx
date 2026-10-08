'use client';

import { useEffect } from 'react';
import { PERF_SLOW_KEY } from '@/lib/perf';

/**
 * يقيس سرعة الرسم بعد استقرار الصفحة: إن بقي معدّل الإطارات دون ~24 إطارًا
 * في الثانية، يُفعَّل الوضع الخفيف تلقائيًا ويُتذكَّر للزيارات التالية. لا يعمل
 * إن اختار المستخدم وضعًا بعينه، ولا يُعيد القياس إن سبق القرار.
 */
export function PerfProbe() {
  useEffect(() => {
    const r = document.documentElement;
    if ((r.getAttribute('data-perf') || 'auto') !== 'auto') return;
    if (r.getAttribute('data-perf-auto') === 'lite') return;

    let raf = 0;
    let frames = 0;
    let first = 0;
    let stopped = false;

    const tick = (t: number) => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') {
        // القياس في لسان مخفيّ لا معنى له
        first = 0;
        frames = 0;
      } else if (!first) {
        first = t;
      } else {
        frames++;
        const elapsed = t - first;
        if (elapsed >= 3000) {
          const fps = (frames * 1000) / elapsed;
          if (fps < 24) {
            r.setAttribute('data-perf-auto', 'lite');
            try {
              localStorage.setItem(PERF_SLOW_KEY, '1');
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    // نبدأ بعد انتهاء حركات الدخول حتى لا تُحسب عليها
    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 2500);
    return () => {
      stopped = true;
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
