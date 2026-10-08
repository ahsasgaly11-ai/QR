// نقش كل باب: رمز مرسوم للمواد المعروفة، وإلا الحرف الأول من اسم المادة.
// ملف مستقل (لا 'use client') حتى تستدعيه الصفحة من الخادم.

export type DoorEmblem = 'science' | 'math' | 'arabic' | 'islamic' | 'english' | 'games' | 'letter';

const KNOWN: Record<string, DoorEmblem> = {
  science: 'science',
  math: 'math',
  mathematics: 'math',
  arabic: 'arabic',
  islamic: 'islamic',
  english: 'english',
};

export function emblemFor(subjectId: string): DoorEmblem {
  return KNOWN[subjectId] ?? 'letter';
}
