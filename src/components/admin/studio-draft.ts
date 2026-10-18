// نسخة التحرير المشتركة بين أقسام استوديو الموقع في لوحة الإدارة.

import {
  SITE_TEXT_DEFAULTS,
  footerLinks,
  homeOrder,
  normalizeSiteTexts,
  txt,
  type DoorStyle,
  type FooterLink,
  type SiteTexts,
} from '@/lib/site-texts';

export const inp =
  'w-full rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold outline-none focus:border-[color:var(--maroon)]';
export const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100';

/** نسخة التحرير: النصوص نافذةً لكل مفتاح، والترتيب والروابط كاملة. */
export interface Draft {
  values: Record<string, string>;
  hidden: string[];
  order: string[];
  doors: Record<string, DoorStyle>;
  links: FooterLink[];
}

export function toDraft(s: SiteTexts): Draft {
  const values: Record<string, string> = {};
  for (const key of Object.keys(SITE_TEXT_DEFAULTS)) values[key] = txt(s, key);
  return {
    values,
    hidden: [...s.hidden],
    order: homeOrder(s),
    doors: { ...s.doors },
    links: footerLinks(s).map((l) => ({ ...l })),
  };
}

export function fromDraft(d: Draft): SiteTexts {
  return normalizeSiteTexts({
    texts: d.values,
    hidden: d.hidden,
    order: d.order,
    doors: d.doors,
    footerLinks: d.links,
  });
}

