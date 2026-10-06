/**
 * مراجعات الوحدات المعروضة أعلى الصفحة الرئيسية.
 * كل مراجعة لعبة HTML مستقلة داخل public/reviews/<id>/index.html،
 * ولإضافة مراجعة جديدة: انسخ ملف اللعبة إلى مجلدها ثم أضف عنصرًا هنا.
 */
export type UnitReview = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  emoji: string;
  /** لونا التدرّج لخلفية البطاقة */
  from: string;
  to: string;
};

export const unitReviews: UnitReview[] = [
  {
    id: 'science-g3-unit1',
    title: 'مراجعة الوحدة الأولى',
    subject: 'العلوم',
    grade: 'الصف الثالث الابتدائي',
    description: 'لعبة تفاعلية تراجع الوحدة الأولى كاملة بأسئلة وتحديات ممتعة، اختبر نفسك واجمع النقاط!',
    emoji: '🔬',
    from: '#0f5132',
    to: '#1f7a5a',
  },
];

export const reviewHref = (r: UnitReview) => `/reviews/${r.id}/index.html`;
