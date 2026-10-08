// ---------------------------------------------------------------------------
// «الوضع الخفيف» لأجهزة المدارس البطيئة.
//
// التفضيل في data-perf على <html>: auto | lite | full (يحفظه لوح إمكانية الوصول).
// في وضع auto يقرّر الجهاز نفسه: سكربت التخطيط يضع data-perf-auto="lite" قبل
// الرسم إن كانت ذاكرة الجهاز أو أنويته قليلة أو طلب المستخدم توفير البيانات،
// ثم يقيس <PerfProbe/> سرعة الرسم فعليًا بعد التحميل ويُكمل القرار.
// ---------------------------------------------------------------------------

export const PERF_SLOW_KEY = 'qa-perf-slow';

export function isLite(): boolean {
  if (typeof document === 'undefined') return false;
  const r = document.documentElement;
  const pref = r.getAttribute('data-perf') || 'auto';
  if (pref === 'lite') return true;
  if (pref === 'full') return false;
  return r.getAttribute('data-perf-auto') === 'lite';
}
