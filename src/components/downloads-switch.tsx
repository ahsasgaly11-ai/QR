'use client';

import type { ReactNode } from 'react';
import { useDownloadsEnabled } from '@/lib/site-settings';

/** يعرض `on` عندما يسمح المشرف بتنزيل الألعاب، وإلا `off`. */
export function DownloadsSwitch({ on, off }: { on: ReactNode; off: ReactNode }) {
  return <>{useDownloadsEnabled() ? on : off}</>;
}
