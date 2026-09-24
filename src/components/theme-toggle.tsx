'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    root.setAttribute('data-theme', next ? 'dark' : 'light');
    root.classList.toggle('dark', next);
    try {
      localStorage.setItem('qa-theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      className="icon-3d icon-3d-lift h-10 w-10 rounded-xl"
      style={{ ['--i3d' as string]: dark ? 'var(--sky)' : 'var(--gold-500)' }}
    >
      {mounted && (dark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />)}
    </button>
  );
}
