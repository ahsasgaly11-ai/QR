'use client';

import { useEffect, useRef, useState } from 'react';
import { Quote, Sparkles, type LucideIcon } from 'lucide-react';

interface TickerMessage {
  /** نص الشارة الذهبية على الشاشات المتوسّطة فأكبر */
  badge: string;
  /** نص مختصر للشارة على الجوال */
  badgeShort: string;
  icon: LucideIcon;
  text: string;
}

const MESSAGES: TickerMessage[] = [
  {
    badge: 'رؤية الوزارة',
    badgeShort: 'رؤية الوزارة',
    icon: Sparkles,
    text: 'متعلّم ريادي لتنمية مستدامة',
  },
  {
    badge: 'من أقوال سمو الأمير تميم بن حمد آل ثاني',
    badgeShort: 'من أقوال سمو الأمير',
    icon: Quote,
    text: '«إننا نؤمن أن رأس المال البشري هو الثروة الحقيقية لأي دولة، ولذلك فإننا ماضون في تطوير منظومة التعليم والتدريب، وتأهيل كوادرنا الوطنية للمستقبل»',
  },
];

/** سرعة مرور النص بالبكسل في الثانية — ثابتة مهما طال النص. */
const SPEED = 70;
/** مدّة عرض كل رسالة لمن اختار تقليل الحركة. */
const STATIC_MS = 9000;

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.getAttribute('data-motion') === 'reduce'
  );
}

/**
 * شريط مثبّت أسفل الصفحة يتناوب بين رؤية الوزارة ومن أقوال سمو الأمير:
 * تدخل كل رسالة من الحافّة اليسرى وتعبر حتى تخرج من اليمين، ثم تبدأ التالية
 * وتتبدّل معها الشارة الذهبية. يتوقّف عند المرور عليه، ولمن اختار تقليل
 * الحركة تُعرض الرسائل ثابتة وتتبدّل كل بضع ثوانٍ.
 */
export function VisionTicker() {
  const [idx, setIdx] = useState(0);
  const [animated, setAnimated] = useState(true);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const msgRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<Animation | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    const view = viewRef.current;
    const msg = msgRef.current;
    if (!view || !msg) return;
    const next = () => setIdx((i) => (i + 1) % MESSAGES.length);

    if (prefersReducedMotion() || typeof msg.animate !== 'function') {
      setAnimated(false);
      const t = setTimeout(next, STATIC_MS);
      return () => clearTimeout(t);
    }
    setAnimated(true);

    // من خارج الحافّة اليسرى إلى ما بعد الحافّة اليمنى بالكامل، فيدخل أول
    // النص العربي (طرفه الأيمن) أولًا ويُقرأ بترتيبه الطبيعي.
    const from = -msg.scrollWidth;
    const to = view.clientWidth;
    const anim = msg.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration: ((to - from) / SPEED) * 1000, easing: 'linear', fill: 'both' }
    );
    if (hoverRef.current) anim.pause();
    animRef.current = anim;
    anim.onfinish = next;
    return () => {
      anim.onfinish = null;
      anim.cancel();
      animRef.current = null;
    };
  }, [idx]);

  const current = MESSAGES[idx];
  const Icon = current.icon;

  return (
    <aside
      className="vision-ticker print:hidden"
      aria-label="رؤية الوزارة ومن أقوال سمو الأمير"
      onMouseEnter={() => {
        hoverRef.current = true;
        animRef.current?.pause();
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        animRef.current?.play();
      }}
    >
      <div className="vision-ticker-badge" aria-hidden>
        <span key={idx} className="vision-ticker-badge-label">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{current.badge}</span>
          <span className="sm:hidden">{current.badgeShort}</span>
        </span>
      </div>

      {/* قارئ الشاشة يقرأ الرسالتين مرّة واحدة بدل متابعة الحركة */}
      <ul className="sr-only">
        {MESSAGES.map((m) => (
          <li key={m.badge}>
            {m.badge}: {m.text}
          </li>
        ))}
      </ul>

      <div ref={viewRef} className="vision-ticker-viewport" dir="ltr" aria-hidden>
        <div
          ref={msgRef}
          className={animated ? 'vision-ticker-msg' : 'vision-ticker-msg is-static'}
          dir="rtl"
        >
          <span className="vision-ticker-gem" />
          <strong>{current.text}</strong>
          <span className="vision-ticker-gem" />
        </div>
      </div>
    </aside>
  );
}
