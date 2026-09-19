import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * الأرقام في المنصّة تُعرض بالصيغة اللاتينية (1، 2، 3) لا الهندية (١، ٢، ٣).
 * هذا اختيار مقصود: الأرقام اللاتينية هي المعتمدة في الكتب المدرسية القطرية
 * وفي فهرس الكتاب نفسه (الدرس 1.2)، فتبقى الواجهة متّسقة مع ما يقرأه الطالب.
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function formatFull(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * تطبيع النص العربي للبحث: إزالة التشكيل والتطويل، وتوحيد الألف والهمزات
 * والتاء المربوطة والألف المقصورة — حتى يطابق البحث بلا تشكيل العناوينَ
 * المشكولة المأخوذة من الكتاب.
 */
export function normalizeAr(input: string): string {
  return input
    .normalize('NFKD')
    // التشكيل والعلامات الفوقية والتطويل
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    // الألف بأشكالها
    .replace(/[آأإٱ]/g, 'ا')
    // الواو والياء بالهمزة
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // الألف المقصورة والتاء المربوطة
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** نسبة مئوية بالأرقام اللاتينية، بمنزلة عشرية واحدة عند الحاجة فقط. */
export function formatPercent(part: number, whole: number): string {
  if (!whole) return '0%';
  const p = (part / whole) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, '')}%`;
}
