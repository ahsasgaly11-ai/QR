'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Home, BookOpen, BarChart3, UploadCloud, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/browse', label: 'المناهج', icon: BookOpen },
  { href: '/search', label: 'بحث', icon: Search },
  { href: '/dashboard', label: 'الإحصاءات', icon: BarChart3 },
];

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
                src="/images/ministry-logo.jpg"
                alt="شعار وزارة التربية والتعليم والتعليم العالي"
                fill
                sizes="44px"
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[15px] font-bold text-[color:var(--maroon)] sm:text-[17px]">
                منصة مناهج قطر
              </p>
              <p className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">
                التفاعلية • وزارة التربية والتعليم
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
                    'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all duration-300',
                    active
                      ? 'text-[color:var(--maroon)]'
                      : 'text-foreground/65 hover:text-[color:var(--maroon)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-l from-[color:var(--maroon)] to-[color:var(--gold)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="btn-primary btn-sm hidden px-4 py-2 text-sm sm:inline-flex"
            >
              <UploadCloud className="h-4 w-4" />
              رفع نشاط
            </Link>
            <button
              className="grid h-10 w-10 place-items-center rounded-xl text-[color:var(--maroon)] lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="glass border-t border-[color:var(--hairline)] lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {[...NAV, { href: '/admin', label: 'رفع نشاط', icon: UploadCloud }].map(
                (item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition',
                        active
                          ? 'bg-[color:var(--maroon)] text-white'
                          : 'text-foreground/80 hover:bg-[color:var(--surface-2)]'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
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
