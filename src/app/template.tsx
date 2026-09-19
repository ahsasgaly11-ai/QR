'use client';

/**
 * يُعاد إنشاء هذا المكوّن عند كل تنقّل، فتُعاد حركة الدخول في كل مرّة —
 * بخلاف layout الذي يبقى حيًّا.
 *
 * هذه الحركة هي التنقّل الأساسي في المتصفّحات التي لا تدعم View Transitions
 * (فايرفوكس وسفاري القديم)، وتبقى مكمّلة لطيفة حيث تُدعم. تُلغى تلقائيًا
 * عند تفعيل «تقليل الحركة» في الجهاز.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
