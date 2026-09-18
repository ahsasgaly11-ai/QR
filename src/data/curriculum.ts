import type { Subject, Activity } from '@/lib/types';

// ---------------------------------------------------------------------------
// Starting curriculum. Intentionally EMPTY of activities — the platform owner
// builds the units/lessons and uploads their own HTML activities from the
// admin panel (/admin). Add more subjects/grades there or here.
// ---------------------------------------------------------------------------

export const SUBJECTS: Subject[] = [
  {
    id: 'science',
    title: 'العلوم',
    titleEn: 'Science',
    tagline: 'اكتشف • جرّب • تعلّم',
    color: '#1a86c9',
    accent: '#12897f',
    emoji: '🔬',
    grades: [
      {
        id: 'g3',
        title: 'المستوى الثالث',
        units: [],
      },
    ],
  },
];

// No bundled activities — everything is uploaded by the platform owner.
export const SEED_ACTIVITIES: Activity[] = [];
