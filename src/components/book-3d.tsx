import Image from 'next/image';
import { OryxMascot } from './oryx-mascot';

export interface BookSubject {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
}

/** ألوان احتياطية للكتب الخلفية حين لا تكفي المواد المُضافة. */
const FALLBACK_SPINES = ['#0f8f7c', '#b0892e', '#6a4c93'];

/**
 * الكتاب ثلاثي الأبعاد في الواجهة — غلاف عامّ لكل المناهج لا لمادّة بعينها:
 * شعار الوزارة، واسم المنصّة، والتميمة، وخلفه كتبٌ متراصّة بألوان المواد
 * تدلّ على الشمول. لا يُذكر اسم مادّةٍ بعينها على الواجهة كي لا يبدو الغلاف
 * كأنّه كتاب مادّةٍ واحدة حين تكون المادة المُضافة واحدة فقط.
 */
export function Book3D({ subjects = [] }: { subjects?: BookSubject[] }) {
  // الكتب الخلفية: ألوان المواد الأخرى إن وُجدت، وإلا درجات محايدة من اللوحة
  const stack = [0, 1].map(
    (i) => subjects[i + 1]?.color || FALLBACK_SPINES[i] || '#b0892e'
  );

  return (
    <div className="scene book-fit">
      <div className="book-3d preserve-3d relative h-[440px] w-[312px]">
        {/* كتب المواد الأخرى خلف الكتاب الرئيس */}
        <div
          className="book-face"
          style={{
            transform: 'translateZ(-66px) translateX(30px) translateY(26px) rotate(5deg)',
            background: `linear-gradient(140deg, ${stack[1]}, color-mix(in srgb, ${stack[1]} 62%, #000))`,
            boxShadow: '0 30px 50px -20px rgba(0,0,0,.35)',
          }}
        />
        <div
          className="book-face"
          style={{
            transform: 'translateZ(-45px) translateX(15px) translateY(13px) rotate(2.5deg)',
            background: `linear-gradient(140deg, ${stack[0]}, color-mix(in srgb, ${stack[0]} 62%, #000))`,
            boxShadow: '0 30px 50px -20px rgba(0,0,0,.35)',
          }}
        />

        {/* page block (thickness) */}
        <div
          className="book-face"
          style={{
            transform: 'translateZ(-24px)',
            background: 'linear-gradient(#efe7d6,#d5c7ad)',
            boxShadow: '0 46px 70px -22px rgba(94,14,38,.5)',
          }}
        />
        {/* right-edge pages */}
        <div
          className="absolute right-[-24px] top-1 h-[calc(100%-8px)] w-[48px]"
          style={{
            transform: 'rotateY(90deg)',
            transformOrigin: 'right center',
            background: 'repeating-linear-gradient(to left,#fffdf8 0 2px,#e6ddc8 2px 4px)',
            borderRadius: '2px',
          }}
        />
        {/* spine — بلون هوية الوزارة بدل أزرق كتاب العلوم */}
        <div
          className="absolute left-[-24px] top-0 h-full w-[48px] overflow-hidden rounded-l-md"
          style={{
            transform: 'rotateY(-90deg)',
            transformOrigin: 'left center',
            background: 'linear-gradient(#a8244e,#6a0f2e)',
          }}
        >
          <div className="flag-strip h-full w-2.5" />
        </div>

        {/* front cover */}
        <div
          className="book-face overflow-hidden border border-white/70 bg-white shadow-2xl"
          style={{ transform: 'translateZ(24px)' }}
        >
          <div className="absolute inset-3 rounded-[14px] border-2 border-[color:var(--gold)]/30" />
          <div className="flex h-full flex-col p-5">
            <div className="mx-auto h-9 w-40 relative">
              <Image
                src="/images/moehe-logo.png"
                alt="شعار الوزارة"
                fill
                sizes="160px"
                className="object-contain"
              />
            </div>

            <div className="mt-3 text-center">
              <h3
                className="font-playful text-[52px] leading-none text-[#8a173e]"
                style={{
                  WebkitTextStroke: '3px #ffffff',
                  paintOrder: 'stroke fill',
                  textShadow: '0 4px 0 #f1dcc6, 0 8px 16px rgba(138,23,62,.3)',
                }}
              >
                مناهج قطر
              </h3>
              <p className="mt-2 inline-block rounded-full bg-[color:var(--gold)]/15 px-4 py-1 text-[13px] font-bold text-[#6a0f2e]">
                كتاب الطالب التفاعلي
              </p>
            </div>

            <div className="relative mt-1 flex flex-1 items-end justify-center">
              <OryxMascot className="h-40 w-auto float-mid drop-shadow-xl" />
            </div>

            <div className="mt-1.5 h-2 w-full rounded-full flag-strip" />
          </div>
        </div>

        {/* glossy sheen */}
        <div className="book-face pointer-events-none overflow-hidden" style={{ transform: 'translateZ(25px)' }}>
          <div className="h-full w-full shimmer opacity-30" />
        </div>
      </div>
    </div>
  );
}
