'use client';

import { cn } from '@/lib/utils';
import type { HandPose } from '@/lib/handshapes';

// ---------------------------------------------------------------------------
// يد مُفصَّلة قابلة للتحريك — تؤدّي أي «وضع يد» (HandPose) من بيانات:
// انبساط كل إصبع (0 مطويّ .. 1 ممدود)، الإبهام، والدوران/الانعكاس. تنتقل بين
// الأوضاع بسلاسة (transition)، فتبدو الشخصية وكأنها تؤدّي الإشارة.
//
// مهمّ: هذه أداة عرض فقط. صحّة الشكل تأتي من بيانات الوضع الموثّقة (يراجعها
// مترجم معتمد)، لا من هذا الملف. لا يُعرَض وضع غير موثّق للطلبة (بوّابة الاعتماد
// في lib/handshapes.ts).
// ---------------------------------------------------------------------------

const SKIN = '#e9b892';
const SKIN_LINE = '#c98a5c';

// أعمدة الأصابع الأربعة فوق الكفّ: [x، الطول الكامل]
const FINGERS: { x: number; len: number }[] = [
  { x: 40, len: 50 }, // السبّابة
  { x: 58, len: 58 }, // الوسطى
  { x: 76, len: 52 }, // البنصر
  { x: 93, len: 40 }, // الخنصر
];
const BASE_Y = 66; // أعلى الكفّ حيث تبدأ الأصابع

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

export function HandSign({
  pose,
  className,
}: {
  pose: HandPose;
  className?: string;
}) {
  const f = pose.fingers;
  const thumb = clamp(pose.thumb ?? 0);
  // الإبهام: 1 ممدود جانبًا (زاوية أوسع)، 0 مطويّ فوق الكفّ
  const thumbRot = -40 - thumb * 55;

  return (
    <svg
      viewBox="0 0 130 170"
      className={cn('block h-full w-full', className)}
      role="img"
      aria-label={pose.label ? `وضع اليد: ${pose.label}` : 'وضع اليد'}
    >
      <g
        style={{
          transformOrigin: '65px 130px',
          transform: `rotate(${pose.rot ?? 0}deg)${pose.flip ? ' scaleX(-1)' : ''}`,
          transition: 'transform 320ms ease',
        }}
      >
        {/* المعصم */}
        <rect x="48" y="120" width="34" height="42" rx="16" fill={SKIN} stroke={SKIN_LINE} strokeWidth="2" />

        {/* الأصابع الأربعة */}
        {FINGERS.map((fg, idx) => {
          const v = clamp(f[idx] ?? 0);
          const shown = 0.16 + v * 0.84; // يبقى عُقدة ظاهرة عند الطيّ
          return (
            <g
              key={idx}
              style={{
                transformOrigin: `${fg.x}px ${BASE_Y}px`,
                transform: `scaleY(${shown})`,
                transition: 'transform 300ms ease',
              }}
            >
              <rect
                x={fg.x - 8}
                y={BASE_Y - fg.len}
                width="16"
                height={fg.len + 10}
                rx="8"
                fill={SKIN}
                stroke={SKIN_LINE}
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* الإبهام */}
        <g
          style={{
            transformOrigin: '44px 108px',
            transform: `rotate(${thumbRot}deg)`,
            transition: 'transform 300ms ease',
          }}
        >
          <rect x="30" y="78" width="16" height="40" rx="8" fill={SKIN} stroke={SKIN_LINE} strokeWidth="2" />
        </g>

        {/* الكفّ */}
        <rect x="34" y="60" width="62" height="66" rx="20" fill={SKIN} stroke={SKIN_LINE} strokeWidth="2" />
      </g>
    </svg>
  );
}
