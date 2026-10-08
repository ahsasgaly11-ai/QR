'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { onPearls, pearlCount, rankFor, PEARL_SECONDS, RANKS } from '@/lib/pearls';

/**
 * زرّ «لآلئي» في الهيدر: لؤلؤة بعددها، وعند الضغط صندوق صغير فيه عقد اللآلئ
 * المجموعة والرتبة الحالية وما يلزم للرتبة التالية.
 */
export function PearlChest() {
  const [n, setN] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setN(pearlCount());
    return onPearls(() => {
      setN(pearlCount());
      setBump(true);
      window.setTimeout(() => setBump(false), 900);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = n ?? 0;
  const rank = rankFor(count);
  const nextAt = rank.next?.min ?? count;
  const prevAt = rank.min;
  const progress = rank.next ? (count - prevAt) / Math.max(1, nextAt - prevAt) : 1;
  // العقد: حتى 24 لؤلؤة مرسومة، والباقي رقمًا
  const beads = Math.min(count, 24);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`لآلئي: ${count}`}
        className={`header-icon-btn pearl-btn ${bump ? 'is-bump' : ''}`}
      >
        <span className="pearl-dot" aria-hidden />
        {n !== null && <span className="pearl-n">{count}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="صندوق اللآلئ" className="pearl-chest">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="kicker">صندوق اللآلئ</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{rank.title}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-lg p-1 text-muted-foreground hover:text-[color:var(--maroon)]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="pearl-string" aria-hidden>
            {beads === 0 ? (
              <span className="pearl-empty">الصندوق ينتظر أول لؤلؤة</span>
            ) : (
              Array.from({ length: beads }, (_, i) => (
                <span key={i} className="pearl-bead" style={{ '--i': i } as React.CSSProperties} />
              ))
            )}
          </div>

          <p className="text-sm text-[color:var(--ink-2)]">
            <b className="text-lg text-foreground tabular-nums">{count}</b>{' '}
            {count === 1 ? 'لؤلؤة' : count === 2 ? 'لؤلؤتان' : count >= 3 && count <= 10 ? 'لآلئ' : 'لؤلؤة'} — {rank.hint}
          </p>

          {rank.next && (
            <div className="mt-3">
              <div className="bar-track">
                <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--gold-500)' }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {nextAt - count} للوصول إلى «{rank.next.title}»
              </p>
            </div>
          )}

          <ol className="pearl-ranks">
            {RANKS.slice(1).map((r) => (
              <li key={r.title} className={count >= r.min ? 'is-on' : ''}>
                <span>{r.title}</span>
                <span className="tabular-nums">{r.min}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 border-t border-[color:var(--hairline)] pt-3 text-xs leading-6 text-muted-foreground">
            تحصل على لؤلؤة عن كل نشاط تجرّبه {PEARL_SECONDS / 60 === 1 ? 'دقيقة كاملة' : `${PEARL_SECONDS} ثانية`}. تُحفظ
            اللآلئ في هذا الجهاز فقط، بلا حساب ولا بيانات شخصية.
          </p>
        </div>
      )}
    </div>
  );
}
