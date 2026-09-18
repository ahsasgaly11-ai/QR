import Image from 'next/image';
import { OryxMascot } from './oryx-mascot';

/**
 * A CSS 3D rendering of the Science student book — front cover + spine + pages,
 * floating cinematically. Mirrors the printed book: ministry mark, the big
 * blue "العلوم" title, the level line, and the oryx holding the "3" badge.
 */
export function Book3D() {
  return (
    <div className="scene book-fit">
      <div className="book-3d preserve-3d relative h-[440px] w-[312px]">
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
        {/* spine */}
        <div
          className="absolute left-[-24px] top-0 h-full w-[48px] overflow-hidden rounded-l-md"
          style={{ transform: 'rotateY(-90deg)', transformOrigin: 'left center', background: 'linear-gradient(#1a86c9,#0d5f8c)' }}
        >
          <div className="flag-strip h-full w-2.5" />
        </div>

        {/* front cover */}
        <div
          className="book-face overflow-hidden border border-white/70 bg-white shadow-2xl"
          style={{ transform: 'translateZ(24px)' }}
        >
          {/* subtle blue inner frame like the printed cover */}
          <div className="absolute inset-3 rounded-[14px] border-2 border-[#dbeefb]" />
          <div className="flex h-full flex-col p-5">
            <div className="mx-auto h-9 w-40 relative">
              <Image
                src="/images/ministry-logo.jpg"
                alt="شعار الوزارة"
                fill
                sizes="160px"
                className="object-contain"
              />
            </div>

            <div className="mt-3 text-center">
              <h3
                className="font-playful text-[68px] leading-none text-[#2aa9e0]"
                style={{
                  WebkitTextStroke: '3px #ffffff',
                  paintOrder: 'stroke fill',
                  textShadow: '0 4px 0 #cbe9fb, 0 8px 16px rgba(26,134,201,.32)',
                }}
              >
                العلوم
              </h3>
              <p className="mt-2 inline-block rounded-full bg-[#eaf6fd] px-4 py-1 text-[13px] font-bold text-[#0d5f8c]">
                كتاب الطالب – المستوى الثالث
              </p>
            </div>

            <div className="relative mt-auto flex items-end justify-center">
              <span
                className="absolute -top-1 right-8 z-10 grid h-12 w-12 place-items-center rounded-full font-playful text-2xl text-white shadow-lg"
                style={{ background: 'radial-gradient(circle at 35% 30%,#ff8064,#e5573a)' }}
              >
                ٣
              </span>
              <OryxMascot className="h-48 w-auto float-mid drop-shadow-xl" />
            </div>

            <div className="mt-2 h-2 w-full rounded-full flag-strip" />
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
