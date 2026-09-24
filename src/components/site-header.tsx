'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Home, BookOpen, BarChart3, UploadCloud, Search, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { Icon3D } from './icon-3d';
import { SITE_NAME } from '@/lib/site';

// لكل رابط لون لوحه ثلاثي الأبعاد — من لوحة ألوان الهوية نفسها.
const NAV = [
  { href: '/', label: 'الرئيسية', icon: Home, color: 'var(--maroon)' },
  { href: '/browse', label: 'المناهج', icon: BookOpen, color: 'var(--gold)' },
  { href: '/search', label: 'بحث', icon: Search, color: 'var(--sky)' },
  { href: '/dashboard', label: 'الإحصاءات', icon: BarChart3, color: 'var(--teal)' },
  { href: '/heatmap', label: 'الخريطة الحرارية', icon: Flame, color: 'var(--coral)' },
];

const UPLOAD = {
  href: '/admin',
  label: 'رفع نشاط',
  icon: UploadCloud,
  color: 'var(--maroon-700)',
};

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
    <header className="sticky top-0 z-50">
      <div className="flag-hairline" aria-hidden />
      <div
        className={cn(
          'transition-all duration-500',
          scrolled ? 'glass shadow-[var(--shadow-md)]' : 'bg-transparent'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="group flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-white p-1 gold-ring transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 sm:h-11 sm:w-11">
              <Image
                src="/images/moehe-mark.png"
                alt="شعار وزارة التربية والتعليم والتعليم العالي"
                fill
                sizes="44px"
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[15px] font-bold text-[color:var(--maroon)] sm:text-[17px]">
                {SITE_NAME}
              </p>
              <p className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">
                وزارة التربية والتعليم والتعليم العالي
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 font-gov text-[14.5px] font-semibold transition-all duration-300',
                    active
                      ? 'bg-[color:var(--surface)] text-[color:var(--maroon)] shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)]'
                      : 'text-foreground/65 hover:text-[color:var(--maroon)]'
                  )}
                >
                  <Icon3D icon={item.icon} color={item.color} size="xs" />
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-l from-[color:var(--maroon)] to-[color:var(--gold)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="btn-primary btn-sm hidden px-4 py-2 font-gov text-sm font-semibold sm:inline-flex"
            >
              <UploadCloud className="h-4 w-4" />
              رفع نشاط
            </Link>
            <button
              className="icon-3d icon-3d-lift h-10 w-10 rounded-xl lg:hidden"
              style={{ ['--i3d' as string]: 'var(--maroon)' }}
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="glass border-t border-[color:var(--hairline)] lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {[...NAV, UPLOAD].map(
                (item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2 font-gov text-[15px] font-semibold transition',
                        active
                          ? 'bg-[color:var(--surface-2)] text-[color:var(--maroon)] ring-1 ring-[rgba(176,137,46,0.4)]'
                          : 'text-foreground/80 hover:bg-[color:var(--surface-2)]'
                      )}
                    >
                      <Icon3D icon={item.icon} color={item.color} size="sm" />
                      {item.label}
                    </Link>
                  );
                }
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
