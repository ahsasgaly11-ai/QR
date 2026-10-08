'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { PearlChest } from './pearls/pearl-chest';
import { SITE_NAME } from '@/lib/site';

// روابط التنقّل نصّية فقط — بلا أيقونات.
const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/browse', label: 'المناهج' },
  { href: '/search', label: 'بحث' },
  { href: '/dashboard', label: 'الإحصاءات' },
  { href: '/heatmap', label: 'الخريطة الحرارية' },
];

const UPLOAD = { href: '/admin', label: 'رفع نشاط' };

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* شريط العلم: يمرّ مع الصفحة ولا يثبت، فيبقى الشريط المثبّت نحيفًا */}
      <div className="qatar-flag-bar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-1.5 pl-16 pr-4 font-gov text-[12px] leading-5">
          <span>منصة تعليمية لطلبة مدارس دولة قطر</span>
          <span className="hidden sm:inline">وزارة التربية والتعليم والتعليم العالي</span>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-50 border-b border-[color:var(--hairline-strong)] bg-[color:var(--paper)] transition-shadow duration-300',
          scrolled && 'shadow-[var(--shadow-sm)]'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[color:var(--hairline-strong)] bg-white p-1">
              <Image
                src="/images/moehe-mark.png"
                alt="شعار وزارة التربية والتعليم والتعليم العالي"
                fill
                sizes="44px"
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[15px] font-extrabold leading-snug text-[color:var(--maroon)] sm:text-[17px]">
                {SITE_NAME}
              </p>
              <p className="hidden truncate font-gov text-[12px] text-muted-foreground sm:block">
                تجارب • محاكاة • أسئلة • ألعاب
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="القائمة الرئيسية">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative px-3 py-2 font-gov text-[15px] font-semibold transition-colors duration-200',
                    // خط سفلي يلامس حدّ الترويسة للرابط الحالي، ويظهر رفيعًا عند المرور
                    'after:absolute after:inset-x-3 after:-bottom-[15px] after:h-[3px] after:origin-center after:bg-[color:var(--maroon)] after:transition-transform after:duration-300',
                    active
                      ? 'text-[color:var(--maroon)] after:scale-x-100'
                      : 'text-foreground/70 after:scale-x-0 hover:text-[color:var(--maroon)] hover:after:scale-x-50'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <PearlChest />
            <ThemeToggle />
            <Link
              href={UPLOAD.href}
              className="btn-primary btn-sm hidden px-4 py-2 font-gov text-sm font-semibold sm:inline-flex"
            >
              <UploadCloud className="h-4 w-4" />
              {UPLOAD.label}
            </Link>
            <button
              className="header-icon-btn lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            className="border-t border-[color:var(--hairline)] bg-[color:var(--paper)] lg:hidden"
            aria-label="القائمة الرئيسية"
          >
            <ul className="mx-auto flex max-w-7xl flex-col divide-y divide-[color:var(--hairline)] px-4 py-1">
              {[...NAV, UPLOAD].map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between px-2 py-3.5 font-gov text-[16px] font-semibold transition-colors',
                        active
                          ? 'text-[color:var(--maroon)]'
                          : 'text-foreground/80 hover:text-[color:var(--maroon)]'
                      )}
                    >
                      {item.label}
                      {active && (
                        <span
                          className="h-2 w-2 rotate-45 bg-[color:var(--maroon)]"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
