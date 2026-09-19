import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'منصة منهاج قطر التفاعلية',
    short_name: 'منهاج قطر',
    description:
      'منصة تعليمية تفاعلية لمناهج دولة قطر — تجارب ومحاكاة وأسئلة وألعاب تعليمية.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#8a1538',
    dir: 'rtl',
    lang: 'ar',
    orientation: 'portrait-primary',
    categories: ['education', 'kids'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
