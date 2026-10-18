'use client';

import Link from 'next/link';
import { footerLinks, txt } from '@/lib/site-texts';
import { useSiteTexts } from './use-site-texts';

// أجزاء التذييل التي يحرّرها المشرف. التذييل في القالب العام (layout) فلا
// يُعاد توليده مع الصفحات، لذا تُقرأ نصوصه حيّةً من المتصفّح.

export function LiveText({ k }: { k: string }) {
  const texts = useSiteTexts();
  return <span data-tk={k}>{txt(texts, k)}</span>;
}

export function FooterLinks() {
  const texts = useSiteTexts();
  return (
    <ul className="space-y-2 text-sm text-white/80">
      {footerLinks(texts).map((l, i) => {
        const external = !l.href.startsWith('/');
        return (
          <li key={`${l.href}-${i}`}>
            {external ? (
              <a
                href={l.href}
                target={l.href.startsWith('https://') ? '_blank' : undefined}
                rel="noreferrer"
                className="underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="underline-offset-4 transition-colors hover:text-white hover:underline">
                {l.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
