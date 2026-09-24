'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Info,
  Megaphone,
  Quote,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { subscribeTicker, type TickerIcon, type TickerSettings } from '@/lib/ticker';

export const TICKER_ICON_COMPONENTS: Record<TickerIcon, LucideIcon> = {
  sparkles: Sparkles,
  quote: Quote,
  megaphone: Megaphone,
  star: Star,
  graduation: GraduationCap,
  book: BookOpen,
  info: Info,
};

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
 * شريط مثبّت أسفل الصفحة يتناوب بين رسائل يحرّرها المشرف من لوحة التحكّم
 * (رؤية الوزارة، من أقوال سمو الأمير، …): تدخل كل رسالة من الحافّة اليسرى
 * وتعبر حتى تخرج من اليمين، ثم تبدأ التالية وتتبدّل معها الشارة الذهبية.
 * يتوقّف عند المرور عليه، ولمن اختار تقليل الحركة تُعرض الرسائل ثابتة
 * وتتبدّل كل بضع ثوانٍ.
 */
export function VisionTicker() {
  // null = لم تصل الإعدادات بعد: لا نعرض نصًّا افتراضيًا قد يستبدله المنشور فورًا.
  const [settings, setSettings] = useState<TickerSettings | null>(null);
  const [idx, setIdx] = useState(0);
  const [animated, setAnimated] = useState(true);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const msgRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<Animation | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => subscribeTicker(setSettings), []);

  const messages = settings?.enabled ? settings.messages : [];
  const count = messages.length;
  const current = count ? messages[idx % count] : null;
  // مفتاح المحتوى: لا تُعاد الحركة من أوّلها إلا إذا تغيّر النص فعلًا
  const currentKey = current ? JSON.stringify(current) : '';

  // الشريط المخفي لا يحجز مساحة أسفل الصفحة ولا يرفع الأزرار العائمة
  const hidden = settings !== null && count === 0;
  useEffect(() => {
    const root = document.documentElement;
    if (hidden) root.style.setProperty('--ticker-h', '0px');
    else root.style.removeProperty('--ticker-h');
    return () => {
      root.style.removeProperty('--ticker-h');
    };
  }, [hidden]);

  useEffect(() => {
    const view = viewRef.current;
    const msg = msgRef.current;
    if (!view || !msg || !currentKey) return;
    const next = () => setIdx((i) => (i + 1) % count);

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
  }, [idx, count, currentKey]);

  if (hidden) return null;

  const Icon = current ? TICKER_ICON_COMPONENTS[current.icon] : null;

  return (
    <aside
      className="vision-ticker print:hidden"
      aria-label="رسائل الوزارة"
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
        {current && Icon && (
          <span key={`${idx}-${currentKey}`} className="vision-ticker-badge-label">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{current.badge}</span>
            <span className="sm:hidden">{current.badgeShort || current.badge}</span>
          </span>
        )}
      </div>

      {/* قارئ الشاشة يقرأ الرسائل مرّة واحدة بدل متابعة الحركة */}
      <ul className="sr-only">
        {messages.map((m, i) => (
          <li key={i}>
            {m.badge ? `${m.badge}: ` : ''}
            {m.text}
          </li>
        ))}
      </ul>

      <div ref={viewRef} className="vision-ticker-viewport" dir="ltr" aria-hidden>
        {current && (
          <div
            ref={msgRef}
            className={animated ? 'vision-ticker-msg' : 'vision-ticker-msg is-static'}
            dir="rtl"
          >
            <span className="vision-ticker-gem" />
            <strong>{current.text}</strong>
            <span className="vision-ticker-gem" />
          </div>
        )}
      </div>
    </aside>
  );
}
