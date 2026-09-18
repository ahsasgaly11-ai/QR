'use client';

import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Loader2 } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { getLocalRecord, htmlToBlobUrl } from '@/lib/local-store';

/** العرض المرجعي الذي نفترضه للعبة ثم نُصغّره ليملأ عرض البطاقة. */
const REF_WIDTH = 900;

function fileUrl(a: Activity) {
  return a.external ? a.file : `/games/${a.file}`;
}

/**
 * معاينة حيّة مصغّرة لشكل اللعبة داخل بطاقة الدرس.
 * تُحمَّل فقط عند اقتراب البطاقة من الشاشة (توفيرًا للأداء عند تعدّد الألعاب)،
 * وتُعطَّل التفاعلات داخلها حتى تبقى البطاقة كاملةً قابلة للنقر.
 */
export function ActivityPreview({
  activity,
  className,
}: {
  activity: Activity;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(0.28);

  // حمّل المعاينة فقط عند الاقتراب من الشاشة
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '250px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // قِس عرض البطاقة لحساب نسبة التصغير المناسبة
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / REF_WIDTH);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // جهّز مصدر المعاينة (من المخزن المحلي أو من الملف المنشور)
  useEffect(() => {
    if (!inView) return;
    let revoke: string | null = null;
    let alive = true;
    (async () => {
      try {
        if (activity.local) {
          const rec = await getLocalRecord(activity.id);
          if (!alive) return;
          if (rec?.html) {
            const u = htmlToBlobUrl(rec.html);
            revoke = u;
            setUrl(u);
          } else setFailed(true);
        } else {
          setUrl(fileUrl(activity));
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [inView, activity]);

  const boxH = boxRef.current?.clientHeight ?? 168;

  return (
    <div
      ref={boxRef}
      className={
        'relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-white ' +
        (className ?? 'h-44')
      }
    >
      {url && !failed ? (
        <>
          <iframe
            src={url}
            title={`معاينة ${activity.title}`}
            aria-hidden
            tabIndex={-1}
            scrolling="no"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute right-0 top-0 origin-top-right border-0"
            style={{
              width: `${REF_WIDTH}px`,
              height: `${Math.round(boxH / scale)}px`,
              transform: `scale(${scale})`,
            }}
          />
          {/* طبقة تمنع أي تفاعل مع المعاينة وتُبقي البطاقة هي المتحكّمة */}
          <div className="absolute inset-0" />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center bg-[color:var(--surface-2)]">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--maroon)]/60" />
            </div>
          )}
        </>
      ) : (
        <div className="grid h-full place-items-center bg-[color:var(--surface-2)]">
          <Gamepad2 className="h-8 w-8 text-[color:var(--maroon)]/30" />
        </div>
      )}
    </div>
  );
}
