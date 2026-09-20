'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// أفاتار «مرشد لغة الإشارة» — شخصية ودودة على هوية المنصّة (عنّابي/ذهبي).
//
// دوره: مُرشِد ومُقدِّم يرافق لوحة لغة الإشارة ويوجّه انتباه الطالب إلى الإشارة
// المعروضة (فيديو موثّق أو بطاقة حرف)، ويحيّي بيده. بيداه على هيئة «قُفّاز»
// ودودة عمدًا: فهو لا يؤدّي أشكال أصابع دقيقة، حتى لا يُفهَم أنه يصنع إشارة
// بعينها — الإشارة الصحيحة تأتي من القاموس الموثّق لا من الأفاتار.
//   state = greet (تحيّة/تلويح) | present (توجيه نحو المحتوى) | idle
// يحترم «تقليل الحركة» تلقائيًّا (قواعد data-motion في globals.css).
// ---------------------------------------------------------------------------

const SKIN = '#e9b892';
const SKIN_SHADE = '#dda57b';
const HAIR = '#3b2a26';

export function SignAvatar({
  state = 'greet',
  className,
}: {
  state?: 'greet' | 'present' | 'idle';
  className?: string;
}) {
  const handAnim =
    state === 'greet'
      ? 'sign-hand--wave'
      : state === 'present'
      ? 'sign-hand--present'
      : '';

  return (
    <svg
      viewBox="0 0 220 200"
      className={cn('block h-full w-full', className)}
      role="img"
      aria-label="مرشد لغة الإشارة"
    >
      <g className="sign-body">
        {/* الجذع */}
        <path
          d="M46,200 C46,162 66,150 110,150 C154,150 174,162 174,200 Z"
          fill="var(--maroon)"
        />
        {/* الياقة الذهبية */}
        <path
          d="M93,151 L110,171 L127,151"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* الذراع الساكنة */}
        <g transform="rotate(16 63 158)">
          <rect x="50" y="154" width="26" height="46" rx="13" fill="var(--maroon)" />
        </g>
        <circle cx="55" cy="196" r="14" fill={SKIN} />

        {/* الرقبة */}
        <rect x="99" y="124" width="22" height="32" rx="10" fill={SKIN_SHADE} />

        {/* الأذنان */}
        <circle cx="68" cy="92" r="8" fill={SKIN} />
        <circle cx="152" cy="92" r="8" fill={SKIN} />

        {/* الرأس */}
        <circle cx="110" cy="90" r="42" fill={SKIN} />

        {/* الشعر */}
        <path
          d="M69,88 C69,50 151,50 151,88 C151,68 134,60 110,60 C86,60 69,68 69,88 Z"
          fill={HAIR}
        />

        {/* الوجنتان */}
        <circle cx="87" cy="104" r="6" fill="var(--gold)" opacity="0.28" />
        <circle cx="133" cy="104" r="6" fill="var(--gold)" opacity="0.28" />

        {/* الحاجبان */}
        <path d="M88,79 Q96,75 104,79" fill="none" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M116,79 Q124,75 132,79" fill="none" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round" />

        {/* العينان */}
        <circle cx="96" cy="90" r="4.6" fill={HAIR} />
        <circle cx="124" cy="90" r="4.6" fill={HAIR} />
        <circle cx="97.4" cy="88.6" r="1.4" fill="#fff" />
        <circle cx="125.4" cy="88.6" r="1.4" fill="#fff" />

        {/* الابتسامة */}
        <path
          d="M95,106 Q110,118 125,106"
          fill="none"
          stroke={HAIR}
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        {/* الذراع المرفوعة (تُحيّي/توجّه) — إلى يمين الرأس بعيدًا عن الوجه */}
        <g className={handAnim}>
          <g transform="rotate(17 165 154)">
            <rect x="153" y="92" width="24" height="62" rx="12" fill="var(--maroon)" />
            <circle cx="165" cy="83" r="17" fill={SKIN} />
            <circle cx="180" cy="94" r="7" fill={SKIN} />
          </g>
        </g>
      </g>
    </svg>
  );
}
