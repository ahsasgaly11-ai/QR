'use client';

import { useEffect, useRef, useState } from 'react';
import { formatFull } from '@/lib/utils';

/**
 * Counts up to `value`. Starts once scrolled into view, and re-animates
 * whenever `value` changes afterwards (e.g. async stats arriving after mount).
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
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
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
  }, [visible, value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatFull(display)}
    </span>
  );
}
