import { normalizeAr } from '@/lib/utils';

// ---------------------------------------------------------------------------
// محلّل فهرس الكتاب: يحوّل نص الفهرس (أو ناتج قراءة الصورة) إلى وحدات ودروس.
// يحافظ على النص الأصلي بتشكيله، ويستخدم نسخة مطبّعة للكشف فقط.
// ---------------------------------------------------------------------------

export interface ParsedLesson {
  title: string;
  include: boolean;
}
export interface ParsedUnit {
  title: string;
  include: boolean;
  lessons: ParsedLesson[];
}

/** يزيل نقاط الفهرس المتتابعة ورقم الصفحة في آخر السطر. */
function cleanLine(raw: string): string {
  return raw
    .replace(/ /g, ' ')
    // نقاط الفهرس (....... 12)
    .replace(/[.․‥…·•]{2,}\s*\d*\s*$/u, '')
    // رقم صفحة مفرد في النهاية
    .replace(/\s+\d{1,4}\s*$/u, '')
    // رقم صفحة في البداية (بعض الفهارس تضعه يمينًا في RTL)
    .replace(/^\s*\d{1,4}\s+(?=\D)/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const ORDINALS =
  'الاولي|الثانيه|الثالثه|الرابعه|الخامسه|السادسه|السابعه|الثامنه|التاسعه|العاشره';
const UNIT_RE = new RegExp(`(^|\\s)الوحده\\s*(\\d+|${ORDINALS})`, 'u');
/** نسخة متسامحة: تُطبَّق على النص بعد إزالة كل المسافات، لأن استخراج
 *  الـ PDF/القراءة البصرية قد يُقحم مسافات داخل الكلمة الواحدة. */
const UNIT_TIGHT_RE = new RegExp(`الوحده(\\d+|${ORDINALS})`, 'u');
const LESSON_NUM_RE = /(^|\s)(\d{1,2})\s*[.٫،]\s*(\d{1,2})(\s|$)/u;
const LESSON_WORD_RE = /(^|\s)الدرس(\s|$)/u;
const REVIEW_RE = /ماذا\s+استطيع\s+ان\s+افعل/u;

/**
 * يحلّل نص فهرس كتاب مدرسي إلى وحدات ودروس.
 * يتسامح مع اختلاف التشكيل وترتيب أرقام الصفحات.
 */
export function parseIndexText(text: string): ParsedUnit[] {
  const units: ParsedUnit[] = [];
  let current: ParsedUnit | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line || line.length < 3) continue;
    const norm = normalizeAr(line);
    const tight = norm.replace(/\s+/g, '');

    // --- وحدة جديدة ---
    if ((UNIT_RE.test(norm) || UNIT_TIGHT_RE.test(tight)) && !LESSON_NUM_RE.test(norm)) {
      current = { title: line, include: true, lessons: [] };
      units.push(current);
      continue;
    }

    // --- درس ---
    const isLesson =
      LESSON_NUM_RE.test(norm) ||
      LESSON_WORD_RE.test(norm) ||
      REVIEW_RE.test(norm) ||
      // سطر يشبه سؤالًا داخل وحدة قائمة
      (!!current && /[؟?]\s*$/u.test(line));

    if (isLesson) {
      // إن ورد درس قبل أي وحدة، أنشئ وحدة حاوية
      if (!current) {
        current = { title: 'وحدة بلا عنوان', include: true, lessons: [] };
        units.push(current);
      }
      // احذف كلمة "الدرس" المكرّرة مع إبقاء الترقيم
      const title = line.replace(/^\s*الدَّرْسُ\s*|^\s*الدرس\s*/u, '').trim();
      current.lessons.push({ title: title || line, include: true });
      continue;
    }

    // --- وصف الوحدة (سطر تابع) — يُتجاهل ---
  }

  return units.filter((u) => u.title.trim().length > 0);
}

/** عدد الدروس المحدّدة للإضافة. */
export function countSelected(units: ParsedUnit[]) {
  const u = units.filter((x) => x.include).length;
  const l = units
    .filter((x) => x.include)
    .reduce((n, x) => n + x.lessons.filter((y) => y.include).length, 0);
  return { units: u, lessons: l };
}
