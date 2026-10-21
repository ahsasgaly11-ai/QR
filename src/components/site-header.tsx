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
import { normalizePathname } from '@/lib/pathname';
import { txt } from '@/lib/site-texts';
import { useSiteTexts } from './use-site-texts';

// روابط التنقّل نصّية فقط — بلا أيقونات. عناوينها تُحرَّر من لوحة الإدارة.
const NAV_KEYS = [
  { href: '/', key: 'nav.home' },
  { href: '/browse', key: 'nav.browse' },
  { href: '/board-games', key: 'nav.boardGames' },
  { href: '/search', key: 'nav.search' },
  { href: '/dashboard', key: 'nav.dashboard' },
  { href: '/heatmap', key: 'nav.heatmap' },
  { href: '/about', key: 'nav.about' },
];

export function SiteHeader() {
  const pathname = normalizePathname(usePathname());
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const texts = useSiteTexts();
  const t = (key: string) => txt(texts, key);
  const NAV = NAV_KEYS.map((n) => ({ href: n.href, key: n.key, label: t(n.key) }));
  const UPLOAD = { href: '/admin', key: 'nav.upload', label: t('nav.upload') };

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
      <aside className="qatar-flag-bar" aria-label="عن المنصّة">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-1.5 pl-16 pr-4 font-gov text-[12px] leading-5">
          <span data-tk="header.flag">{t('header.flag')}</span>
          <span className="hidden sm:inline" data-tk="header.flag2">{t('header.flag2')}</span>
        </div>
      </aside>

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
                <span data-tk="header.tagline">{t('header.tagline')}</span>
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
                  <span data-tk={item.key}>{item.label}</span>
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
              <span data-tk={UPLOAD.key}>{UPLOAD.label}</span>
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
                      <span data-tk={item.key}>{item.label}</span>
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
