'use client';

import { useEffect, useState } from 'react';
import { HeritageIcon } from '@/components/heritage-icons';
import { PEARL_EVENT } from '@/lib/pearls';

type Detail = { total: number; title: string; rankUp: string | null };

/** إشعار يطفو أعلى الصفحة: محارة تنفتح وتخرج منها اللؤلؤة الجديدة. */
export function PearlToast() {
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    let hide = 0;
    const on = (e: Event) => {
      setD((e as CustomEvent<Detail>).detail);
      clearTimeout(hide);
      hide = window.setTimeout(() => setD(null), 5200);
    };
    window.addEventListener(PEARL_EVENT, on);
    return () => {
      window.removeEventListener(PEARL_EVENT, on);
      clearTimeout(hide);
    };
  }, []);

  return (
    <div className="pearl-toast-host" aria-live="polite" role="status">
      {d && (
        <div className="pearl-toast" key={d.total}>
          <span className="pearl-toast-icon" aria-hidden>
            <HeritageIcon kind="oyster" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg font-semibold leading-snug">
              {d.rankUp ? `رتبة جديدة: ${d.rankUp}!` : 'حصلت على لؤلؤة!'}
            </span>
            <span className="block truncate text-sm opacity-85">
              {d.title} • في صندوقك {d.total} {d.total === 1 ? 'لؤلؤة' : d.total === 2 ? 'لؤلؤتان' : d.total <= 10 ? 'لآلئ' : 'لؤلؤة'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
