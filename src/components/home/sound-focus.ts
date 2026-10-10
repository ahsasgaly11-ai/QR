// ---------------------------------------------------------------------------
// تنسيق الصوت بين عناصر الصفحة الرئيسية (فيديو الإطلاق وعرض «نسيج المجتمع
// القطري»): حين يشغّل الزائر صوت أحدهما يُعلن ذلك على النافذة، فيكتم الآخر
// نفسه حتى لا تتداخل موسيقاهما.
// ---------------------------------------------------------------------------

export type SoundOwner = 'launch-video' | 'naseej';

export const SOUND_FOCUS_EVENT = 'qa:sound-focus';

export function claimSound(owner: SoundOwner) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SoundOwner>(SOUND_FOCUS_EVENT, { detail: owner }));
}
