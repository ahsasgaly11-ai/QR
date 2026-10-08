import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // فحص الأنواع مُفعَّل وقت البناء: أي خطأ يوقف النشر بدل أن يصل للزوّار.
  // (فحص ESLint يبقى متوقّفًا لأن ESLint غير مثبَّت في المشروع.)
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
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
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
      // عرض «نسيج المجتمع القطري» (ملف واحد ثابت داخل public/naseej، يُضمَّن في الرئيسية)
      { source: '/naseej', destination: '/naseej/index.html', permanent: false },
      { source: '/naseej/', destination: '/naseej/index.html', permanent: false },
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
