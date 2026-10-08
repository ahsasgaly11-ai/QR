'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DoorEmblem } from './door-emblem';

// ---------------------------------------------------------------------------
// باب قطري خشبي بمصراعين (ساج ملوّن، ألواح محفورة، مسامير نحاس، حلقتا طرق)
// داخل كوّة جصّية. عند المرور ينفرج قليلًا ويتسرّب الضوء، وعند الضغط:
//   ١. ينفتح المصراعان إلى الداخل ويقترب الباب
//   ٢. يغمر ضوء ذهبي الشاشة انطلاقًا من فتحة الباب
//   ٣. يُفتح الرابط خلف الضوء، ثم يتلاشى الضوء عن الصفحة الجديدة
// الرابط حقيقي (<a href>) فيعمل الفتح في لسان جديد ومحرّكات البحث، ومن
// يطلب تقليل الحركة ينتقل مباشرة.
// ---------------------------------------------------------------------------

function Emblem({ kind, letter }: { kind: DoorEmblem; letter: string }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'science':
      return (
        <g {...stroke}>
          <circle cx="50" cy="50" r="8" fill="currentColor" stroke="none" />
          <ellipse cx="50" cy="50" rx="38" ry="14" />
          <ellipse cx="50" cy="50" rx="38" ry="14" transform="rotate(60 50 50)" />
          <ellipse cx="50" cy="50" rx="38" ry="14" transform="rotate(120 50 50)" />
        </g>
      );
    case 'math':
      return (
        <g {...stroke}>
          <path d="M14 86L50 16l36 70z" />
          <circle cx="50" cy="62" r="15" />
        </g>
      );
    case 'islamic':
      return (
        <g {...stroke}>
          <path d="M28 88V58a22 22 0 0 1 44 0v30z" />
          <path d="M50 36V20M14 88V52M86 88V52" />
        </g>
      );
    case 'english':
      return (
        <text x="50" y="66" textAnchor="middle" fontSize="42" fontWeight="700" fill="currentColor" fontFamily="'IBM Plex Sans Arabic', sans-serif">
          Aa
        </text>
      );
    case 'games':
      return (
        <g>
          <circle cx="50" cy="52" r="26" fill="url(#hi-pearl-g)" />
          <circle cx="42" cy="44" r="7" fill="#fff" opacity=".9" />
        </g>
      );
    default:
      return (
        <text x="50" y="72" textAnchor="middle" fontSize="56" fontWeight="900" fill="currentColor" fontFamily="'Noto Kufi Arabic', sans-serif">
          {kind === 'arabic' ? 'ض' : letter}
        </text>
      );
  }
}

function motionAllowed() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.getAttribute('data-motion') !== 'reduce'
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ستارة ضوء خارج شجرة React حتى تبقى أثناء تبدّل الصفحة. */
function lightCurtain(x: number, y: number, tint: string) {
  const el = document.createElement('div');
  el.className = 'door-curtain';
  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  el.style.setProperty('--tint', tint);
  document.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add('is-in');
  return el;
}

export function HeritageDoor({
  href,
  title,
  meta,
  color,
  emblem,
  letter,
  locked = false,
}: {
  href: string;
  title: string;
  meta: string;
  color: string;
  emblem: DoorEmblem;
  letter?: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const frame = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (locked) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!motionAllowed()) return; // تنقّل عادي بلا حركة
    e.preventDefault();
    if (open) return;

    router.prefetch(href);
    setOpen(true);
    await wait(620);

    const r = frame.current?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : innerWidth / 2;
    const y = r ? r.top + r.height * 0.62 : innerHeight / 2;
    const curtain = lightCurtain(x, y, color);
    await wait(820);

    const target = new URL(href, location.href).pathname;
    router.push(href);

    // انتظر وصول الصفحة الجديدة ورسمها، ثم بدّد الضوء عنها
    const started = performance.now();
    while (location.pathname !== target && performance.now() - started < 4000) {
      await wait(50);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await wait(120);
    curtain.classList.add('is-out');
    await wait(750);
    curtain.remove();
  };

  return (
    <Link
      href={href}
      prefetch={false}
      data-no-vt
      onClick={onClick}
      onMouseEnter={() => !locked && router.prefetch(href)}
      onFocus={() => !locked && router.prefetch(href)}
      aria-disabled={locked || undefined}
      aria-label={locked ? `${title} — قريبًا` : `افتح باب ${title}`}
      className={cn('heritage-door', open && 'is-open', locked && 'is-locked')}
      style={{ '--door': color } as React.CSSProperties}
    >
      <span ref={frame} className="hd-niche">
        <span className="hd-keystone" aria-hidden />
        <span className="hd-light" aria-hidden />
        <span className="hd-floor" aria-hidden />
        <span className="hd-opening" aria-hidden>
          <span className="hd-leaf hd-leaf--r">
            <span className="hd-face">
              <span className="hd-panel" />
              <span className="hd-panel" />
              <span className="hd-panel" />
              <span className="hd-ring" />
            </span>
            <span className="hd-edge" />
          </span>
          <span className="hd-leaf hd-leaf--l">
            <span className="hd-face">
              <span className="hd-panel" />
              <span className="hd-panel" />
              <span className="hd-panel" />
              <span className="hd-ring" />
            </span>
            <span className="hd-edge" />
          </span>
          <svg className="hd-emblem" viewBox="0 0 100 100" aria-hidden>
            <Emblem kind={emblem} letter={letter ?? title.replace(/^ال/, '').charAt(0)} />
          </svg>
          {locked && <span className="hd-lock">قريبًا</span>}
        </span>
      </span>
      <span className="hd-caption">
        <span className="hd-title">{title}</span>
        <span className="hd-meta">{meta}</span>
      </span>
    </Link>
  );
}
