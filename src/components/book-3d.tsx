import Image from 'next/image';
import { OryxMascot } from './oryx-mascot';

/**
 * A CSS 3D rendering of the Science student book — front cover + spine + pages,
 * floating cinematically. Mirrors the printed book: ministry mark, the big
 * blue "العلوم" title, the level line, and the oryx holding the "3" badge.
 */
export function Book3D() {
  return (
    <div className="scene">
      <div className="book-3d preserve-3d relative h-[420px] w-[300px]">
        {/* ---- page block (gives thickness) ---- */}
        <div
          className="book-face"
          style={{
            transform: 'translateZ(-22px)',
            background: 'linear-gradient(#efe7d6, #d8cbb2)',
            boxShadow: '0 40px 60px -20px rgba(95,14,38,0.55)',
          }}
        />
        {/* right-edge pages */}
        <div
          className="absolute right-[-22px] top-1 h-[calc(100%-8px)] w-[44px]"
          style={{
            transform: 'rotateY(90deg)',
            transformOrigin: 'right center',
            background:
              'repeating-linear-gradient(to left,#fffdf8 0 2px,#e6ddc8 2px 4px)',
            borderRadius: '2px',
          }}
        />
        {/* spine (right side for RTL) */}
        <div
          className="absolute left-[-22px] top-0 h-full w-[44px] rounded-l-md"
          style={{
            transform: 'rotateY(-90deg)',
            transformOrigin: 'left center',
            background:
              'linear-gradient(#1b9bd8,#0f6fa0)',
          }}
        >
          <div className="flag-strip h-full w-2" />
        </div>

        {/* ---- front cover ---- */}
        <div
          className="book-face overflow-hidden border border-white/60 bg-white shadow-2xl"
          style={{ transform: 'translateZ(22px)' }}
        >
          {/* soft blue frame like the printed cover */}
          <div className="flex h-full flex-col p-4">
            <div className="mx-auto mb-2 h-10 w-40 relative">
              <Image
                src="/images/ministry-logo.jpg"
                alt="شعار الوزارة"
                fill
                sizes="160px"
                className="object-contain"
              />
            </div>

            <div className="relative mt-2 text-center">
              <h3
                className="font-display text-6xl font-black tracking-tight text-[#2aa9e0]"
                style={{
                  WebkitTextStroke: '2px #ffffff',
                  textShadow:
                    '0 3px 0 #cdeafa, 0 6px 12px rgba(27,155,216,0.35)',
                }}
              >
                العلوم
              </h3>
              <p className="mt-1 text-sm font-bold text-[#1b6f9e]">
                كتاب الطالب – المستوى الثالث
              </p>
            </div>

            {/* mascot + badge */}
            <div className="relative mt-auto flex items-end justify-center">
              <span
                className="absolute -top-2 right-6 z-10 grid h-12 w-12 place-items-center rounded-full text-2xl font-black text-white shadow-lg"
                style={{ background: 'radial-gradient(circle at 35% 30%,#ff7a5c,#ef5b3c)' }}
              >
                ٣
              </span>
              <OryxMascot className="h-44 w-auto float-mid drop-shadow-xl" />
            </div>

            <div className="mt-1 h-1.5 w-full rounded-full flag-strip" />
          </div>
        </div>

        {/* glossy sheen sweeping across the cover */}
        <div
          className="book-face pointer-events-none overflow-hidden"
          style={{ transform: 'translateZ(23px)' }}
        >
          <div className="h-full w-full shimmer opacity-40" />
        </div>
      </div>
    </div>
  );
}
