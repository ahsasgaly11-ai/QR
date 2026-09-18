import type { Subject, Activity } from '@/lib/types';

// ---------------------------------------------------------------------------
// Bundled seed curriculum. This ships with the platform so the site is alive
// on first load. Uploaded activities (via /admin → Firestore) are merged on
// top of this structure at runtime by lib/content.ts.
// ---------------------------------------------------------------------------

export const SUBJECTS: Subject[] = [
  {
    id: 'science',
    title: 'العلوم',
    titleEn: 'Science',
    tagline: 'اكتشف • جرّب • تعلّم',
    color: '#1b9bd8',
    accent: '#17a398',
    emoji: '🔬',
    grades: [
      {
        id: 'g3',
        title: 'المستوى الثالث',
        units: [
          {
            id: 'u-plants',
            title: 'الوحدة الأولى: النباتات',
            summary: 'أجزاء النبات ووظائفها وكيف تنمو وتتكاثر.',
            color: '#17a398',
            lessons: [
              { id: 'l-plant-parts', title: 'أجزاء النبات ووظائفها', activities: [] },
              { id: 'l-plant-grow', title: 'كيف تنمو النباتات', activities: [] },
            ],
          },
          {
            id: 'u-animals',
            title: 'الوحدة الثانية: الحيوانات',
            summary: 'تصنيف الحيوانات ودورات حياتها وبيئاتها.',
            color: '#c9a227',
            lessons: [
              { id: 'l-animal-groups', title: 'تصنيف الحيوانات', activities: [] },
              { id: 'l-life-cycle', title: 'دورة حياة الحيوان', activities: [] },
            ],
          },
          {
            id: 'u-body',
            title: 'الوحدة الثالثة: جسم الإنسان',
            summary: 'الأجهزة الحيوية والحواس والحركة في جسم الإنسان.',
            color: '#8a1538',
            lessons: [
              { id: 'l-muscles', title: 'العضلات والحركة', activities: [] },
              { id: 'l-senses', title: 'الحواس الخمس', activities: [] },
            ],
          },
          {
            id: 'u-matter',
            title: 'الوحدة الرابعة: المادة',
            summary: 'حالات المادة وخصائصها والتغيرات التي تطرأ عليها.',
            color: '#1b9bd8',
            lessons: [
              { id: 'l-states', title: 'حالات المادة الثلاث', activities: [] },
              { id: 'l-properties', title: 'خصائص المواد', activities: [] },
            ],
          },
          {
            id: 'u-earth',
            title: 'الوحدة الخامسة: الأرض والفضاء',
            summary: 'الماء والطقس والأرض والنظام الشمسي.',
            color: '#ef5b3c',
            lessons: [
              { id: 'l-water', title: 'الماء والطقس', activities: [] },
              { id: 'l-space', title: 'الأرض والفضاء', activities: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'math',
    title: 'الرياضيات',
    titleEn: 'Mathematics',
    tagline: 'قريبًا',
    color: '#8a1538',
    accent: '#c9a227',
    emoji: '➗',
    grades: [],
  },
  {
    id: 'arabic',
    title: 'اللغة العربية',
    titleEn: 'Arabic',
    tagline: 'قريبًا',
    color: '#c9a227',
    accent: '#8a1538',
    emoji: '📖',
    grades: [],
  },
];

// Seed activities (the HTML games already authored). These are bundled files
// under /public/games. New uploads live in Firestore and merge on top.
export const SEED_ACTIVITIES: Activity[] = [
  {
    id: 'muscle-3d',
    title: 'محاكاة انقباض العضلات ثلاثية الأبعاد',
    description:
      'نشاط تفاعلي ثلاثي الأبعاد يوضّح كيف تنقبض العضلة وترتخي لتحريك العظام.',
    type: 'simulation',
    file: 'muscle-contraction-3d.html',
    subjectId: 'science',
    gradeId: 'g3',
    unitId: 'u-body',
    lessonId: 'l-muscles',
    createdAt: Date.UTC(2026, 8, 1),
  },
  {
    id: 'muscle-quiz',
    title: 'اختبر معلوماتك: العضلات والحركة',
    description: 'أسئلة تفاعلية قصيرة لمراجعة درس العضلات والحركة.',
    type: 'quiz',
    file: 'muscles-quiz.html',
    subjectId: 'science',
    gradeId: 'g3',
    unitId: 'u-body',
    lessonId: 'l-muscles',
    createdAt: Date.UTC(2026, 8, 5),
  },
  {
    id: 'states-of-matter',
    title: 'تجربة حالات المادة الثلاث',
    description:
      'حرّك درجة الحرارة وشاهد كيف تتحول المادة بين الحالة الصلبة والسائلة والغازية.',
    type: 'experiment',
    file: 'states-of-matter.html',
    subjectId: 'science',
    gradeId: 'g3',
    unitId: 'u-matter',
    lessonId: 'l-states',
    createdAt: Date.UTC(2026, 8, 8),
  },
  {
    id: 'plant-parts',
    title: 'لعبة: ركّب أجزاء النبات',
    description: 'اسحب كل جزء إلى مكانه الصحيح وتعرّف على وظيفته.',
    type: 'game',
    file: 'plant-parts.html',
    subjectId: 'science',
    gradeId: 'g3',
    unitId: 'u-plants',
    lessonId: 'l-plant-parts',
    createdAt: Date.UTC(2026, 8, 12),
  },
];
