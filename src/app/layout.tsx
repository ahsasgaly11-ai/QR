import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { VisitTracker } from '@/components/visit-tracker';

export const metadata: Metadata = {
  title: 'منصة مناهج قطر التفاعلية | العلوم',
  description:
    'منصة تعليمية تفاعلية لمناهج دولة قطر — تجارب عملية ومحاكاة وأسئلة تفاعلية بصيغة HTML يمكن تجربتها أو تحميلها. وزارة التربية والتعليم والتعليم العالي.',
  keywords: [
    'مناهج قطر',
    'العلوم',
    'وزارة التربية والتعليم',
    'تجارب تفاعلية',
    'محاكاة',
    'ألعاب تعليمية',
  ],
  authors: [{ name: 'وزارة التربية والتعليم والتعليم العالي - دولة قطر' }],
};

export const viewport: Viewport = {
  themeColor: '#8a1538',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <VisitTracker />
        <SiteHeader />
        <main className="relative">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
