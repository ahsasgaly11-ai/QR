import Link from 'next/link';
import { Home, Layers, Search } from 'lucide-react';
import { OryxMascot } from '@/components/oryx-mascot';
import { BackButton } from '@/components/back-button';

// ---------------------------------------------------------------------------
// صفحة غير موجودة: باب قطري مغلق في جدار جصّي، فوقه لوحة نحاسية بالرقم،
// والمها بجانبه تدلّ على الأبواب المفتوحة.
// ---------------------------------------------------------------------------

function ClosedDoor() {
  return (
    <div
      className="heritage-door is-locked nf-door"
      style={{ '--door': '#5b3a22' } as React.CSSProperties}
      aria-hidden
    >
      <span className="hd-niche">
        <span className="hd-keystone" />
        <span className="hd-opening">
          {(['r', 'l'] as const).map((side) => (
            <span key={side} className={`hd-leaf hd-leaf--${side}`}>
              <span className="hd-face">
                <span className="hd-panel" />
                <span className="hd-panel" />
                <span className="hd-panel" />
                <span className="hd-ring" />
              </span>
              <span className="hd-edge" />
            </span>
          ))}
          <span className="nf-plate">404</span>
        </span>
      </span>
    </div>
  );
}

export default function NotFound() {
  return (
    <section className="door-wall border-t-0">
      <div className="relative mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:py-16">
        <BackButton fallback="/" />
        <div className="mt-8 grid items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14">
          <div className="flex items-end justify-center gap-2">
            <ClosedDoor />
            <OryxMascot className="nf-oryx h-28 w-auto sm:h-36" />
          </div>
          <div className="text-center md:text-start">
            <p className="kicker">الصفحة غير موجودة</p>
            <h1 className="mt-2 font-calli text-[2.4rem] leading-[1.4] text-foreground sm:text-5xl">
              هذا الباب مغلق
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[1.05rem] leading-8 text-[color:var(--ink-2)] md:mx-0">
              ربما انتقل النشاط أو تغيّر الرابط. الأبواب الأخرى مفتوحة — اختر طريقك
              ونكمل الاستكشاف.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/" className="btn-primary px-6">
                <Home className="h-5 w-5" /> الرئيسية
              </Link>
              <Link href="/browse" className="btn-ghost px-5">
                <Layers className="h-5 w-5" /> المناهج
              </Link>
              <Link href="/search" className="btn-ghost px-5">
                <Search className="h-5 w-5" /> بحث
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
