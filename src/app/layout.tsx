import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { FloatingMascot } from '@/components/mascot-cheer';
import { VisitTracker } from '@/components/visit-tracker';
import { Analytics } from '@/components/analytics';
import { SITE_URL, SITE_NAME } from '@/lib/site';

const DESC =
  'منصة تعليمية تفاعلية لمناهج دولة قطر — تجارب عملية ومحاكاة ثلاثية الأبعاد وأسئلة وألعاب بصيغة HTML يمكن تجربتها مباشرة أو تحميلها. وزارة التربية والتعليم والتعليم العالي.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | العلوم`,
    template: `%s`,
  },
  description: DESC,
  applicationName: SITE_NAME,
  keywords: [
    'مناهج قطر',
    'العلوم',
    'وزارة التربية والتعليم',
    'تجارب تفاعلية',
    'محاكاة',
    'ألعاب تعليمية',
    'المستوى الثالث',
  ],
  authors: [{ name: 'وزارة التربية والتعليم والتعليم العالي - دولة قطر' }],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ar_QA',
    siteName: SITE_NAME,
    title: `${SITE_NAME} | العلوم`,
    description: DESC,
    images: [{ url: '/images/science-book-cover.jpg', width: 1200, height: 1200, alt: 'كتاب العلوم' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | العلوم`,
    description: DESC,
    images: ['/images/science-book-cover.jpg'],
  },
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
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Aref+Ruqaa:wght@400;700&family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            // الافتراضي دائمًا: الوضع النهاري. لا يُفعّل الليلي إلا إذا اختاره
            // الزائر صراحةً من زر التبديل (ولا نتبع إعداد نظام الجهاز).
            __html: `(function(){try{var d=localStorage.getItem('qa-theme')==='dark';var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[color:var(--maroon)] focus:px-4 focus:py-2 focus:text-white"
        >
          تخطَّ إلى المحتوى
        </a>
        <VisitTracker />
        <SiteHeader />
        <main id="main" className="relative">
          {children}
        </main>
        <SiteFooter />
        <FloatingMascot />
        <Analytics />
      </body>
    </html>
  );
}
