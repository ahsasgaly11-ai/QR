'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Home, BookOpen, BarChart3, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/browse', label: 'المناهج', icon: BookOpen },
  { href: '/dashboard', label: 'الإحصاءات', icon: BarChart3 },
  { href: '/admin', label: 'رفع نشاط', icon: UploadCloud },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Qatar flag serration ribbon */}
      <div className="h-2 w-full flag-strip" aria-hidden />
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled ? 'glass shadow-lg shadow-black/5' : 'bg-transparent'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white p-1 gold-ring transition-transform group-hover:scale-105">
              <Image
                src="/images/ministry-logo.jpg"
                alt="شعار وزارة التربية والتعليم والتعليم العالي"
                fill
                sizes="44px"
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-black text-[color:var(--qa-maroon)] sm:text-lg">
                منصة مناهج قطر
              </p>
              <p className="text-[11px] text-muted-foreground">
                التفاعلية • وزارة التربية والتعليم
              </p>
            </div>
          </Link>

          {/* desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                    active
                      ? 'bg-[color:var(--qa-maroon)] text-white shadow-md shadow-[color:var(--qa-maroon)]/30'
                      : 'text-foreground/70 hover:bg-[color:var(--qa-maroon)]/10 hover:text-[color:var(--qa-maroon)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="rounded-lg p-2 text-[color:var(--qa-maroon)] md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* mobile nav */}
        {open && (
          <nav className="glass border-t border-[color:var(--qa-gold)]/20 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {NAV.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold',
                      active
                        ? 'bg-[color:var(--qa-maroon)] text-white'
                        : 'text-foreground/80'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
