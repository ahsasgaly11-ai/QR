import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Arabic-Indic-friendly compact number formatting (uses Latin digits). */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function formatFull(n: number): string {
  return new Intl.NumberFormat('ar-QA').format(n);
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
