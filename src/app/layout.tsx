import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { FloatingMascot } from '@/components/mascot-cheer';
import { ContactFab } from '@/components/contact-fab';
import { RouteTransitions } from '@/components/route-transitions';
import { AccessibilityPanel } from '@/components/accessibility-panel';
import { VisitTracker } from '@/components/visit-tracker';
import { Analytics } from '@/components/analytics';
import { SITE_URL, SITE_NAME } from '@/lib/site';

const DESC =
  'منصة تعليمية تفاعلية لمناهج دولة قطر — تجارب عملية ومحاكاة ثلاثية الأبعاد وأسئلة وألعاب بصيغة HTML يمكن تجربتها مباشرة أو تحميلها. وزارة التربية والتعليم والتعليم العالي.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s`,
  },
  description: DESC,
  applicationName: SITE_NAME,
  keywords: [
    'مناهج قطر',
    'العلوم',
    'وزارة التربية والتعليم والتعليم العالي',
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
    title: SITE_NAME,
    description: DESC,
    images: [{ url: '/images/science-book-cover.jpg', width: 1200, height: 1200, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
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
            // يُطبَّق قبل الرسم لمنع الوميض: الوضع الليلي + إعدادات إمكانية
            // الوصول (التباين، القراءة الميسّرة، حجم الخط، تقليل الحركة).
            // الافتراضي دائمًا: نهاري وبلا تعديلات، ولا نتبع إعداد النظام.
            __html: `(function(){try{var r=document.documentElement,g=function(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}};var t=g('qa-theme','light');r.setAttribute('data-theme',t);r.classList.toggle('dark',t==='dark');r.setAttribute('data-contrast',g('qa-a11y-contrast','normal'));r.setAttribute('data-reading',g('qa-a11y-reading','normal'));r.setAttribute('data-text',g('qa-a11y-text','base'));r.setAttribute('data-motion',g('qa-a11y-motion','auto'));r.setAttribute('data-signlang',g('qa-a11y-signlang','off'));try{var sr=new URLSearchParams(location.search).get('sign-review');if(sr==='1')localStorage.setItem('qa-sign-review','1');else if(sr==='0')localStorage.removeItem('qa-sign-review');}catch(e){}}catch(e){}})();`,
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
          <RouteTransitions>{children}</RouteTransitions>
        </main>
        <SiteFooter />
        <FloatingMascot />
        <ContactFab />
        <AccessibilityPanel />
        <Analytics />
      </body>
    </html>
  );
}
