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

/** ألوان الأبواب بالتناوب: عنابي، فيروزي، أزرق بحري، أخضر نخيل، ساج. */
export const DOOR_PAINT = ['#8a1538', '#2b6b62', '#2d5f7c', '#3f6b3a', '#5b3a22'];
