// ---------------------------------------------------------------------------
// استخراج نص ملف PDF داخل المتصفّح (بلا خادم وبلا مفاتيح وبلا تكلفة).
// يعمل مع ملفات PDF التي تحتوي طبقة نصية — وهي الغالبة في الكتب الرقمية.
// أمّا الملفات الممسوحة ضوئيًا (صور فقط) فلا نص فيها، وعندها نلجأ للقراءة
// البصرية عبر الخادم.
// ---------------------------------------------------------------------------

export interface PdfExtraction {
  text: string;
  pages: number;
  /** صحيح عندما يبدو الملف ممسوحًا ضوئيًا (بلا طبقة نصية مفيدة). */
  looksScanned: boolean;
}

/** الحد الأدنى من الحروف في الصفحة حتى نعدّها تحتوي نصًا حقيقيًا. */
const MIN_CHARS_PER_PAGE = 40;

/** علامات التشكيل والعلامات المُركَّبة العربية. */
const COMBINING_MARK =
  /[ؐ-ًؚ-ٰٟۖ-ۭ̀-ͯ]/;

/**
 * تُخرج ملفات PDF الحروفَ العربية غالبًا بأشكالها الطباعية
 * (Arabic Presentation Forms مثل ﻟ ﺪ ر) بدل الحروف الأساسية.
 * NFKC يُعيدها إلى صورتها القياسية، ثم نضبط المسافات وعلامات الاتجاه.
 */
export function normalizeArabicPdfText(input: string): string {
  return input
    .normalize('NFKC')
    // علامات التحكّم في الاتجاه التي تُقحمها بعض الملفات
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function extractPdfText(
  file: File,
  opts: { maxPages?: number; onProgress?: (page: number, total: number) => void } = {}
): Promise<PdfExtraction> {
  const pdfjs = await import('pdfjs-dist');
  // العامل يُخدَم من أصل الموقع نفسه (نُسخ عبر سكربت postinstall)
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  const limit = Math.min(total, opts.maxPages ?? 20);

  const lines: string[] = [];
  for (let n = 1; n <= limit; n++) {
    opts.onProgress?.(n, limit);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    // اجمع العناصر في أسطر حسب إحداثي Y (الفهرس سطور مستقلة)
    const rows = new Map<number, { x: number; w: number; s: string }[]>();
    for (const item of content.items as {
      str?: string;
      width?: number;
      transform?: number[];
    }[]) {
      const s = item.str ?? '';
      if (!s.trim()) continue;
      const t = item.transform ?? [];
      const y = Math.round((t[5] ?? 0) / 3) * 3; // تسامح بسيط في المحاذاة
      const x = t[4] ?? 0;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, w: item.width ?? 0, s });
    }

    // من أعلى الصفحة إلى أسفلها، ومن اليمين لليسار (نص عربي)
    const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, parts] of ordered) {
      // ملفات PDF تُخرج الحروف العربية أحيانًا عنصرًا لكل حرف؛ لا نفصل
      // بينها بمسافة إلا عند وجود فجوة أفقية حقيقية (مسافة كلمة).
      const sorted = parts.sort((a, b) => b.x - a.x);
      let line = '';
      let prevLeft: number | null = null;
      for (const p of sorted) {
        // الحركات (التشكيل) تأتي عناصر مستقلة بعرض شبه معدوم وتتداخل مع
        // الحرف السابق — لا يجوز فصلها عنه بمسافة.
        const isMark = COMBINING_MARK.test(p.s.charAt(0));
        if (prevLeft !== null && !isMark && prevLeft - (p.x + p.w) > 1.5) {
          line += ' ';
        }
        line += p.s;
        // الحركة لا تُزيح موضع الحرف
        if (!isMark) prevLeft = p.x;
      }
      const cleaned = normalizeArabicPdfText(line);
      if (cleaned) lines.push(cleaned);
    }
    page.cleanup();
  }

  const text = lines.join('\n');
  const density = text.replace(/\s/g, '').length / Math.max(1, limit);

  return { text, pages: total, looksScanned: density < MIN_CHARS_PER_PAGE };
}
