'use client';

import { cn } from '@/lib/utils';
import { SIGN_AVATAR_SVG } from './sign-avatar-art';

// ---------------------------------------------------------------------------
// أفاتار «مرشد لغة الإشارة» — شخصية مفتوحة المصدر (Open Peeps بأسلوب Pablo
// Stanley، رخصة CC0 / ملكية عامة) بزيّ بهوية المنصّة. تُولَّد ثابتةً في
// sign-avatar-art.ts فلا تُشحَن أي مكتبة للمتصفّح.
//
// دوره مُرشِد ومُقدِّم يرافق لوحة لغة الإشارة (يحيّي/يوجّه بحركة لطيفة). لا يؤدّي
// إشارة بعينها — الإشارة الصحيحة تأتي من القاموس الموثّق لا من الأفاتار.
//   state = greet (تحيّة) | present (توجيه) | idle
// يحترم «تقليل الحركة» تلقائيًّا (قواعد data-motion في globals.css).
// ---------------------------------------------------------------------------

export function SignAvatar({
  state = 'greet',
  className,
}: {
  state?: 'greet' | 'present' | 'idle';
  className?: string;
}) {
  const anim =
    state === 'greet'
      ? 'sign-avatar--greet'
      : state === 'present'
      ? 'sign-avatar--present'
      : 'sign-avatar--idle';

  return (
    <div
      role="img"
      aria-label="مرشد لغة الإشارة"
      className={cn(
        'block h-full w-full [&>svg]:h-full [&>svg]:w-full',
        anim,
        className
      )}
      dangerouslySetInnerHTML={{ __html: SIGN_AVATAR_SVG }}
    />
  );
}
