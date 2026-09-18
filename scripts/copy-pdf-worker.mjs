// ينسخ عامل pdf.js إلى public/ ليُحمَّل من أصل الموقع نفسه.
// يعمل تلقائيًا بعد npm install، فيبقى مطابقًا لإصدار الحزمة المثبّت
// دون الحاجة إلى إضافة ملف ضخم إلى المستودع.
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = join(root, 'public', 'vendor');
const dest = join(destDir, 'pdf.worker.min.mjs');

try {
  if (!existsSync(src)) {
    console.log('[pdf-worker] pdfjs-dist غير مثبّت — تم التخطّي.');
    process.exit(0);
  }
  await mkdir(destDir, { recursive: true });
  await copyFile(src, dest);
  console.log('[pdf-worker] نُسخ إلى public/vendor/pdf.worker.min.mjs');
} catch (err) {
  // لا نُفشل التثبيت — استيراد PDF ميزة اختيارية
  console.warn('[pdf-worker] تعذّر النسخ:', err?.message ?? err);
}
