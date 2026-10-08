import type {NextConfig} from 'next';

// ---------------------------------------------------------------------------
// سياسة أمان المحتوى (CSP).
// تنتقل هذه السياسة أيضًا إلى إطارات الألعاب المرفوعة (روابط Blob تَرِث سياسة
// الصفحة التي أنشأتها)، لذا بُنيت على ما تحتاجه الألعاب فعلًا: فحص الألعاب
// المرفوعة وجدها تطلب خطوط Google فقط، وبعضها يستخدم eval. المهم هنا أن
// السكربتات لا تُحمَّل إلا من الموقع نفسه، وأن الاتصال لا يذهب إلا لخدمات
// Firebase/Google، فلا تستطيع لعبة أو حقن أن يسرّب بيانات إلى خادم آخر.
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' data: blob: https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.google-analytics.com https://www.googletagmanager.com",
  "frame-src 'self' blob: data: https://www.youtube-nocookie.com https://player.vimeo.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  // لا داعي لإعلان التقنية المستخدمة في كل استجابة
  poweredByHeader: false,
  // فحص الأنواع مُفعَّل وقت البناء: أي خطأ يوقف النشر بدل أن يصل للزوّار.
  // ESLint يعمل بأمر «npm run lint» (0 أخطاء)، ولا يوقف النشر لأن تحذيراته
  // القديمة ليست أخطاء.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ترويسات أمان عامة لكل الصفحات.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HTTPS فقط لمدة سنتين (يشمل النطاقات الفرعية)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // يمنع تضمين الموقع داخل مواقع أخرى (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: CSP },
          // الكاميرا لـ«قرص التحدي» من الموقع نفسه فقط، ولا ميكروفون ولا موقع جغرافي
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
          // يمنع المتصفح من تخمين نوع الملف
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // لا يُرسَل المسار الكامل للمواقع الخارجية
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // لعبة «قرص التحدي» (تطبيق ويب ثابت داخل public/qurs): رابط نظيف يفتح الملف الرئيسي.
  async redirects() {
    return [
      { source: '/qurs', destination: '/qurs/index.html', permanent: false },
      { source: '/qurs/', destination: '/qurs/index.html', permanent: false },
      // «مختبر العطسة» (ملف واحد ثابت داخل public/sneeze-lab)
      { source: '/sneeze-lab', destination: '/sneeze-lab/index.html', permanent: false },
      { source: '/sneeze-lab/', destination: '/sneeze-lab/index.html', permanent: false },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
