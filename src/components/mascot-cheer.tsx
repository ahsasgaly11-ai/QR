'use client';

import { useEffect, useRef, useState } from 'react';
import { OryxMascot } from './oryx-mascot';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// التميمة وهي تُطلق عبارات تحفيزية باستمرار.
//
// العبارات موجَّهة لطلبة الصف الثالث: قصيرة، بصيغة المخاطَب، بلا تعقيد، مع
// رمز تعبيري واحد يساعد من لم يُتقن القراءة بعد على التقاط المعنى.
// ---------------------------------------------------------------------------

const CHEERS = [
  'أهلًا يا عالِم الغد! 🔬',
  'جاهز للمغامرة؟ هيّا بنا! 🚀',
  'كل سؤال تسأله يجعلك أذكى 💡',
  'العلم يبدأ بالفضول 🔍',
  'جرّب… والخطأ طريقٌ للتعلّم ✨',
  'أنت أقوى مما تظنّ! 💪',
  'خطوة خطوة تصل للقمة ⛰️',
  'عقلك يكبر مع كل تجربة 🧠',
  'الأبطال لا يستسلمون 🏆',
  'اقرأ بتمعّن… ستجد الجواب 📖',
  'رائع! واصل التقدّم 👏',
  'اليوم تتعلّم شيئًا جديدًا 🌟',
  'الصبر مفتاح الاكتشاف 🗝️',
  'لاحِظ… فكّر… استنتج 🧪',
  'أنت فخر مدرستك 🇶🇦',
  'المها العربي يشجّعك! 🦌',
];

/** كل كم ثانية تتبدّل العبارة. */
const EVERY_MS = 5200;

export function MascotCheer({
  className,
  mascotClassName,
  side = 'right',
}: {
  className?: string;
  mascotClassName?: string;
  /** جهة فقاعة الكلام بالنسبة للتميمة */
  side?: 'right' | 'left';
}) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);
  // ترتيب عشوائي لكل زائر حتى لا تتكرّر البداية نفسها في كل زيارة
  const order = useRef<number[]>([]);

  useEffect(() => {
    const idx = CHEERS.map((_, n) => n);
    for (let n = idx.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      [idx[n], idx[j]] = [idx[j], idx[n]];
    }
    order.current = idx;
    setI(0);
  }, []);

  useEffect(() => {
    // نحترم تفضيل تقليل الحركة: تبقى العبارة ثابتة بلا تلاشٍ متكرّر
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const t = setInterval(() => {
      setShown(false);
      window.setTimeout(() => {
        setI((n) => (n + 1) % CHEERS.length);
        setShown(true);
      }, 420);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, []);

  const text = CHEERS[order.current[i] ?? i] ?? CHEERS[0];

  return (
    <div className={cn('flex items-end gap-2 sm:gap-3', className)}>
      {side === 'left' && <Bubble text={text} shown={shown} tail="left" />}
      <OryxMascot className={cn('h-32 w-auto float-mid', mascotClassName)} />
      {side === 'right' && <Bubble text={text} shown={shown} tail="right" />}
    </div>
  );
}

/**
 * التميمة مرافِقة ثابتة في زاوية الصفحة، تظهر في كل صفحات الموقع وتواصل
 * تشجيع الطالب أثناء تصفّحه. لا تلتقط النقرات إطلاقًا فلا تحجب أي زرّ
 * تحتها، وتختفي على الشاشات القصيرة جدًا (الجوال بالوضع العرضي) حتى لا
 * تزاحم اللعبة.
 */
export function FloatingMascot() {
  return (
    <div
      aria-hidden={false}
      className="short-hide pointer-events-none fixed bottom-3 left-3 z-40 hidden sm:block"
    >
      <MascotCheer
        side="right"
        mascotClassName="h-20 w-auto drop-shadow-xl lg:h-24"
        className="items-end"
      />
    </div>
  );
}

function Bubble({
  text,
  shown,
  tail,
}: {
  text: string;
  shown: boolean;
  tail: 'right' | 'left';
}) {
  return (
    <div
      // aria-live يجعل قارئ الشاشة يعلن العبارة الجديدة دون نقل التركيز
      aria-live="polite"
      className={cn(
        'relative mb-6 max-w-[15rem] rounded-2xl border-2 border-[color:var(--gold)]/50 bg-white px-4 py-2.5',
        'text-sm font-black leading-6 text-[color:var(--maroon)] shadow-lg',
        'transition-all duration-400',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
      )}
    >
      {text}
      <span
        className={cn(
          'absolute bottom-[-9px] h-4 w-4 rotate-45 border-b-2 border-l-2 border-[color:var(--gold)]/50 bg-white',
          tail === 'right' ? 'left-6' : 'right-6'
        )}
      />
    </div>
  );
}
