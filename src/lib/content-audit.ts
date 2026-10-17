// ---------------------------------------------------------------------------
//  تدقيق المحتوى — دوال خالصة بلا واجهة ولا شبكة.
//
//  «الصحة والدقة» معيار تحكيم صريح، وعنوان فيه خطأ إملائي أو نشاط مصنّف
//  نوعًا خاطئًا يُقرأ قبل أي لعبة. هذه الوحدة تمسح عناوين الأنشطة وأوصافها
//  وبياناتها التربوية وعناوين الوحدات والدروس وتقترح تصحيحًا لكل ملاحظة،
//  فيراجعه المشرف ويطبّقه بضغطة. لا تُغيّر شيئًا من تلقاء نفسها.
// ---------------------------------------------------------------------------

import type { Activity, ActivityType, Subject } from '@/lib/types';
import { pedagogyStatus } from '@/lib/pedagogy';
import { fixLessonTitle } from '@/data/pedagogy-pack';

export type AuditKind = 'spelling' | 'spacing' | 'type' | 'pedagogy' | 'description';

export interface AuditFinding {
  id: string;
  kind: AuditKind;
  /** ما يُعرض للمشرف */
  message: string;
  /** أين وُجدت الملاحظة */
  target:
    | { scope: 'activity'; activityId: string; field: 'title' | 'description' | 'objective' | 'usage' }
    | { scope: 'lesson'; subjectId: string; gradeId: string; unitId: string; lessonId: string }
    | { scope: 'unit'; subjectId: string; gradeId: string; unitId: string };
  /** تسمية الموضع للعرض (عنوان النشاط أو الدرس) */
  label: string;
  before?: string;
  after?: string;
  /** نوع مقترح (لملاحظات التصنيف) */
  suggestedType?: ActivityType;
  /** يمكن تطبيقه آليًا بضغطة */
  fixable: boolean;
}

interface Rule {
  re: RegExp;
  to: string | ((m: string, ...g: string[]) => string);
  why: string;
}

/**
 * قاموس تصحيحات شائعة في عناوين الأنشطة التعليمية. قُصد به الدقّة لا
 * الشمول: كل قاعدة تطابق خطأً لا يُقصد في نصّ تعليمي صحيح.
 */
const WORD_FIXES: [string, string][] = [
  ['الاسنان', 'الأسنان'],
  ['الاعضاء', 'الأعضاء'],
  ['الانسان', 'الإنسان'],
  ['الامعاء', 'الأمعاء'],
  ['الامراض', 'الأمراض'],
  ['الاجهزة', 'الأجهزة'],
  ['الاجسام', 'الأجسام'],
  ['الاشياء', 'الأشياء'],
  ['الادوات', 'الأدوات'],
  ['الاطعمة', 'الأطعمة'],
  ['الافضل', 'الأفضل'],
  ['الاولى', 'الأولى'],
  ['الارض', 'الأرض'],
  ['الاحياء', 'الأحياء'],
  ['الالوان', 'الألوان'],
  ['الاصوات', 'الأصوات'],
  ['الايدي', 'الأيدي'],
  ['الاطفال', 'الأطفال'],
  ['اسئلة', 'أسئلة'],
  ['اسنان', 'أسنان'],
  ['اعضاء', 'أعضاء'],
  ['انواع', 'أنواع'],
  ['اجزاء', 'أجزاء'],
  ['الحيونات', 'الحيوانات'],
  ['الحيوانت', 'الحيوانات'],
  ['الاعاقة', 'الإعاقة'],
  ['الكهربائيه', 'الكهربائية'],
  ['اختار', 'اختر'],
  ['الشي', 'الشيء'],
  ['شي', 'شيء'],
  ['اي', 'أي'],
  ['او', 'أو'],
  ['اذا', 'إذا'],
  ['الى', 'إلى'],
];

// حدّ الكلمة العربية: \b في JavaScript لا يعرف الحروف العربية، فنستخدم
// نظرة خلفية/أمامية تمنع أن يكون الحرف المجاور عربيًا.
const AR = '[\\u0600-\\u06FF]';
const NOT_BEFORE = `(?<!${AR})`;
const NOT_AFTER = `(?!${AR})`;

function wordRule(from: string, to: string): Rule | null {
  if (from === to) return null;
  // مع السماح بسوابق الجرّ والعطف الملتصقة (و، ف، ب، ل، ك).
  const re = new RegExp(`${NOT_BEFORE}([وفبلك]?)${from}${NOT_AFTER}`, 'g');
  return { re, to: (_m, prefix: string) => `${prefix}${to}`, why: `«${from}» ← «${to}»` };
}

const RULES: Rule[] = [
  // «الغير معدية» ← «غير المعدية» (الصحيح أن «غير» لا تُعرَّف، ويُعرَّف ما بعدها)
  {
    re: new RegExp(`${NOT_BEFORE}الغير\\s+(${AR}+)`, 'g'),
    to: (_m, w: string) => `غير ${w.startsWith('ال') ? w : 'ال' + w}`,
    why: '«الغير» لا تُعرَّف: تُكتب «غير» ويُعرَّف ما بعدها',
  },
  // المثنّى بعد مضاف: «وظيفة الرئتان» ← «وظيفة الرئتين». يقتصر على أعضاء
  // مثنّاة معروفة حتى لا يُخطئ مع جمع ينتهي بـ«ان» مثل «الأسنان».
  {
    re: new RegExp(
      `${NOT_BEFORE}(وظيفة|وظائف|عمل|دور|أجزاء|تركيب|شكل|مكان|حركة|موضع)\\s+(ال(?:رئت|كليت|عين|أذن|يد|قدم|فكّ|فك|شفت|ساق|ذراع|ركبت|كتف))ان${NOT_AFTER}`,
      'g'
    ),
    to: (_m, head: string, stem: string) => `${head} ${stem}ين`,
    why: 'المثنّى بعد المضاف يُجرّ بالياء',
  },
  ...WORD_FIXES.map(([a, b]) => wordRule(a, b)).filter((r): r is Rule => r !== null),
];

const SPACING_RULES: Rule[] = [
  { re: new RegExp(`${NOT_BEFORE}و\\s+(?=${AR})`, 'g'), to: 'و', why: 'واو العطف تلتصق بما بعدها' },
  { re: /\s+([،؛:.!؟?])/g, to: '$1', why: 'لا مسافة قبل علامة الترقيم' },
  { re: /([،؛:!؟?])(?=[؀-ۿ])/g, to: '$1 ', why: 'مسافة بعد علامة الترقيم' },
  { re: /\(\s+/g, to: '(', why: 'لا مسافة بعد القوس المفتوح' },
  { re: /\s+\)/g, to: ')', why: 'لا مسافة قبل القوس المغلق' },
  { re: /[ \t]{2,}/g, to: ' ', why: 'مسافات مكرّرة' },
  { re: /\s+-\s+(?=[؀-ۿ])/g, to: ' - ', why: 'توحيد الشرطة' },
];

function applyRules(text: string, rules: Rule[]): { out: string; reasons: string[] } {
  let out = text;
  const reasons: string[] = [];
  for (const r of rules) {
    const next = out.replace(r.re, r.to as string);
    if (next !== out) {
      reasons.push(r.why);
      out = next;
    }
  }
  return { out: out.trim(), reasons };
}

/** تصحيح نصّ واحد: إملاء ثم مسافات. يُعيد null إن لم يتغيّر شيء. */
export function proofread(text: string): { after: string; reasons: string[] } | null {
  if (!text) return null;
  const a = applyRules(text, RULES);
  const b = applyRules(a.out, SPACING_RULES);
  const after = b.out;
  if (after === text.trim() && text === text.trim()) return null;
  const reasons = [...a.reasons, ...b.reasons];
  if (!reasons.length && after === text.trim()) reasons.push('مسافات زائدة في الطرفين');
  return { after, reasons };
}

// --- تصنيف النوع من العنوان ---------------------------------------------------
const TYPE_HINTS: { type: ActivityType; re: RegExp }[] = [
  { type: 'game', re: /(تحدي|لعبة|مغامرة|سباق|مملكة|أبطال|ابطال|بطل|اربح|نقاط|مراحل|غوّاص|غواص|صقّار|صقار)/ },
  { type: 'quiz', re: /(أسئلة|اسئلة|اختبر|اختبار|مراجعة|تقويم|صحيح أم خطأ|صح أم خطأ)/ },
  { type: 'experiment', re: /(تجربة|نفذ|نفّذ|مختبر|اختبر\s+(?:مهارات)|قم بقياس|قس\b|جرّب|جرب)/ },
  { type: 'simulation', re: /(محاكاة|كيف تبدو|كيف يعمل|كيف تعمل|رحلة|شاهد|استكشف)/ },
];

/**
 * النوع الذي يوحي به العنوان، أو null إن لم يوحِ بشيء مؤكّد. عنوان يجمع
 * دلالتين (مثل «تجربة» و«اختبار») لا يُقترح له شيء، تجنّبًا للملاحظات الخاطئة.
 */
export function suggestType(title: string): ActivityType | null {
  const hits = TYPE_HINTS.filter((h) => h.re.test(title)).map((h) => h.type);
  return hits.length === 1 ? hits[0] : null;
}

// --- المسح الكامل --------------------------------------------------------------
const TYPE_LABEL: Record<ActivityType, string> = {
  experiment: 'تجربة عملية',
  simulation: 'محاكاة',
  quiz: 'أسئلة تفاعلية',
  game: 'لعبة تعليمية',
};

export function auditContent(activities: Activity[], structure: Subject[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  let n = 0;
  const push = (f: Omit<AuditFinding, 'id'>) => out.push({ id: `f${++n}`, ...f });

  for (const a of activities) {
    const fields: { field: 'title' | 'description' | 'objective' | 'usage'; text: string | undefined }[] = [
      { field: 'title', text: a.title },
      { field: 'description', text: a.description },
      { field: 'objective', text: a.pedagogy?.objective },
      { field: 'usage', text: a.pedagogy?.usage },
    ];
    for (const { field, text } of fields) {
      if (!text) continue;
      const fix = proofread(text);
      if (!fix) continue;
      const spelling = fix.reasons.some((r) => !SPACING_RULES.some((s) => s.why === r) && r !== 'مسافات زائدة في الطرفين');
      push({
        kind: spelling ? 'spelling' : 'spacing',
        message: fix.reasons.join(' · '),
        target: { scope: 'activity', activityId: a.id, field },
        label: a.title,
        before: text,
        after: fix.after,
        fixable: true,
      });
    }

    // تصنيف النوع: اقتراح فقط حين يوحي العنوان بنوع مختلف بوضوح
    const hinted = suggestType(a.title);
    if (hinted && hinted !== a.type && !a.unitReview && !a.presentation) {
      push({
        kind: 'type',
        message: `مصنّف «${TYPE_LABEL[a.type]}» بينما يوحي العنوان بـ«${TYPE_LABEL[hinted]}»`,
        target: { scope: 'activity', activityId: a.id, field: 'title' },
        label: a.title,
        suggestedType: hinted,
        fixable: true,
      });
    }

    if (!a.smartReinforcement) {
      const st = pedagogyStatus(a.pedagogy);
      if (!st.complete) {
        push({
          kind: 'pedagogy',
          message: `ناقص: ${st.missing.join('، ')}`,
          target: { scope: 'activity', activityId: a.id, field: 'objective' },
          label: a.title,
          fixable: false,
        });
      }
      if (!a.description?.trim()) {
        push({
          kind: 'description',
          message: 'بلا وصف مختصر: يظهر للطالب والمحكّم سطر عام بدل وصف النشاط',
          target: { scope: 'activity', activityId: a.id, field: 'description' },
          label: a.title,
          fixable: false,
        });
      }
    }
  }

  for (const s of structure) {
    for (const g of s.grades) {
      for (const u of g.units) {
        const uf = proofread(u.title);
        if (uf)
          push({
            kind: 'spelling',
            message: uf.reasons.join(' · '),
            target: { scope: 'unit', subjectId: s.id, gradeId: g.id, unitId: u.id },
            label: u.title,
            before: u.title,
            after: uf.after,
            fixable: true,
          });
        for (const l of u.lessons) {
          const lf = proofread(l.title);
          // ترقيم مزدوج مثل «1. الدَّرْسُ 3.1:» — نُبقي رقم الدرس وحده (مطابقة بلا تشكيل)
          const numbered = fixLessonTitle(lf?.after ?? l.title);
          const dbl = numbered !== (lf?.after ?? l.title);
          const after = dbl ? numbered : lf?.after;
          if (after && after !== l.title)
            push({
              kind: 'spelling',
              message: [dbl ? 'ترقيم مزدوج في عنوان الدرس' : '', ...(lf?.reasons ?? [])].filter(Boolean).join(' · '),
              target: { scope: 'lesson', subjectId: s.id, gradeId: g.id, unitId: u.id, lessonId: l.id },
              label: l.title,
              before: l.title,
              after,
              fixable: true,
            });
        }
      }
    }
  }

  return out;
}

export const AUDIT_KIND_LABEL: Record<AuditKind, string> = {
  spelling: 'إملاء ولغة',
  spacing: 'مسافات وترقيم',
  type: 'تصنيف النوع',
  pedagogy: 'بيانات تربوية ناقصة',
  description: 'وصف ناقص',
};
