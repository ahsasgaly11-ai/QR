'use client';

import { useEffect, useRef, useState } from 'react';
import { formatFull } from '@/lib/utils';

/**
 * يعرض القيمة الحقيقية فورًا — في HTML القادم من الخادم وفي أوّل رسم — ولا
 * يحرّك العدّ إلا حين تتغيّر القيمة لاحقًا (وصول رقم حيّ أحدث من الخادم).
 *
 * كان يبدأ من الصفر ويعدّ صعودًا عند الظهور، فبدت العدّادات أصفارًا لمن يفتح
 * الصفحة أو يلتقط لها صورة أو يقرؤها بأداة بلا JavaScript قبل انتهاء الحركة.
 */
export function CountUp({
  value,
  duration = 1600,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{formatFull(display)}</span>;
}
