'use client';

import { useEffect, useRef } from 'react';
import { isLite } from '@/lib/perf';

// ---------------------------------------------------------------------------
// نافذة الدوحة: مشهد تراثي من ست طبقات على أعماق مختلفة داخل قوس.
//   السماء ← أبراج الخليج الغربي ← متحف الفن الإسلامي ← سوق واقف ← البحر
//   والسفينة ← النخيل والمها في المقدّمة.
//
// • يميل المشهد مع المؤشّر (وميلان الجهاز على الجوال حيث يُسمح)، وتنزلق
//   الطبقات بسرعات مختلفة مع التمرير فيظهر العمق.
// • نهاري في الوضع الفاتح، وليلي في الوضع الداكن: قمر ونجوم ونوافذ مضاءة
//   وفانوس على السفينة — المشهد نفسه يتبع زرّ الوضع الليلي.
// • لا حلقة رسم إلا والمشهد ظاهر، ولا حركة لمن طلب تقليلها.
// ---------------------------------------------------------------------------

const LAYERS = [
  { key: 'sky', z: -260, drift: 0.05 },
  { key: 'far', z: -170, drift: 0.12 },
  { key: 'mia', z: -110, drift: 0.18 },
  { key: 'souq', z: -50, drift: 0.26 },
  { key: 'sea', z: 0, drift: 0.32 },
  { key: 'front', z: 70, drift: 0.44 },
] as const;

const PERSPECTIVE = 900;

function motionAllowed() {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.getAttribute('data-motion') !== 'reduce'
  );
}

export function DohaWindow() {
  const root = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const w = world.current;
    if (!el || !w) return;

    // الوضع الخفيف: المشهد ثابت بلا تتبّع للمؤشّر أو الميلان
    if (!motionAllowed() || isLite()) return;

    // الأداء: نكتب التحويل مباشرة على العناصر المتحرّكة بدل متغيّرات CSS على
    // الأب — تغيير متغيّر موروث يجبر المتصفح على إعادة حساب أنماط المشهد كله
    // (مئات عناصر SVG) في كل إطار. وتتوقّف الحلقة حين يستقرّ المشهد، وتعود
    // مع حركة المؤشّر أو التمرير أو ميلان الجهاز.
    const layers = Array.from(w.querySelectorAll<HTMLElement>('.hw-layer')).map((node, i) => ({
      node,
      z: LAYERS[i].z,
      s: (PERSPECTIVE - LAYERS[i].z) / PERSPECTIVE,
      drift: LAYERS[i].drift,
    }));
    const gleam = el.querySelector<HTMLElement>('.hw-gleam');

    let tx = 0, ty = 0, cx = 0, cy = 0, scroll = 0, drawnScroll = -1;
    let visible = true;
    let raf = 0;

    const kick = () => {
      if (visible && !raf) raf = requestAnimationFrame(frame);
    };

    const host = el.closest('[data-hero]') ?? el;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    // ميلان الجهاز: يعمل دون إذن على أندرويد، ويُتجاهل حيث يتطلّب إذنًا
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 25));
      ty = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
      kick();
    };
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      scroll = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
      kick();
    };

    function frame() {
      raf = 0;
      if (!visible) return;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      const settled = Math.abs(tx - cx) < 0.002 && Math.abs(ty - cy) < 0.002;
      if (settled) {
        cx = tx;
        cy = ty;
      }
      w!.style.transform = `rotateX(${(-cy * 5).toFixed(3)}deg) rotateY(${(cx * 9).toFixed(3)}deg)`;
      if (gleam) {
        gleam.style.setProperty('--lx', `${(50 + cx * 30).toFixed(2)}%`);
        gleam.style.setProperty('--ly', `${(32 + cy * 24).toFixed(2)}%`);
      }
      const sp = Math.round(scroll * 1000) / 1000;
      if (sp !== drawnScroll) {
        drawnScroll = sp;
        for (const l of layers) {
          l.node.style.transform = `translateZ(${l.z}px) scale(${l.s.toFixed(4)}) translateY(${(sp * l.drift * 180).toFixed(2)}px)`;
        }
      }
      if (!settled) raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      el.classList.toggle('hw--paused', !visible);
      kick();
    });
    io.observe(el);

    host.addEventListener('pointermove', onPointer as EventListener, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onPointer as EventListener);
      host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={root} className="hw" role="img" aria-label="مشهد من الدوحة: سوق واقف ومتحف الفن الإسلامي وسفينة شراعية ونخيل ومها عربي">
      <div className="hw-frame" aria-hidden />
      <div className="hw-serration" aria-hidden />
      <div className="hw-arch-line" aria-hidden />
      <div className="hw-stage" aria-hidden>
        <div ref={world} className="hw-world">
          {LAYERS.map((l, i) => (
            <div
              key={l.key}
              className="hw-layer"
              style={
                {
                  '--i': i,
                  '--z': `${l.z}px`,
                  '--s': ((PERSPECTIVE - l.z) / PERSPECTIVE).toFixed(4),
                  '--drift': l.drift,
                } as React.CSSProperties
              }
            >
              <LayerArt name={l.key} />
            </div>
          ))}
        </div>
      </div>
      <div className="hw-gleam" aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------------------
// الرسوم: كل طبقة SVG مستقلّة بنفس الإطار (600×560) وتمتدّ خارجه قليلًا حتى
// لا تظهر حوافّها حين يميل المشهد.
// ---------------------------------------------------------------------------

const STARS = [
  [60, 60, 1.6], [120, 120, 1.1], [180, 40, 1.4], [240, 100, 1], [300, 30, 1.7],
  [350, 140, 1.1], [420, 70, 1.3], [520, 50, 1.6], [560, 130, 1], [90, 180, 1.2],
  [270, 170, 1.4], [470, 190, 1.1], [30, 120, 1], [380, 210, 1.2], [210, 220, 1],
] as const;

function Palm({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="hw-palm" style={{ animationDelay: `${delay}s` }}>
        <path d="M-3 0c3-36 5-78 0-104h6c4 30 2 70-1 104z" fill="var(--hw-trunk)" />
        <g fill="var(--hw-frond)">
          <path d="M0-104c-16-16-38-15-48-3 16-7 30-5 48 3z" />
          <path d="M0-104c16-16 38-15 48-3-16-7-30-5-48 3z" />
          <path d="M0-104c-10-24-28-32-42-28 18 2 32 14 42 28z" />
          <path d="M0-104c10-24 28-32 42-28-18 2-32 14-42 28z" />
          <path d="M0-104c-2-20 2-36 8-42-2 15-3 28-8 42z" />
          <path d="M0-104c-14-6-30 2-36 12 12-6 24-8 36-12z" />
        </g>
        <g fill="#c98a2b">
          <circle cx="-4" cy="-96" r="3.5" />
          <circle cx="3" cy="-95" r="3.5" />
          <circle cx="0" cy="-90" r="3.5" />
        </g>
      </g>
    </g>
  );
}

function Oryx({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // المها العربي: قرنان طويلان مستقيمان، وجه بعلامات داكنة، أطراف سفلية داكنة
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M21 6L45 -40M26 5L51 -38" stroke="#2a1d17" strokeWidth="3.2" strokeLinecap="round" />
      <g fill="var(--hw-oryx)">
        <ellipse cx="62" cy="38" rx="36" ry="16" />
        <path d="M30 34L16 10l10-6 18 26z" />
        <ellipse cx="17" cy="11" rx="12" ry="7" transform="rotate(25 17 11)" />
        <rect x="32" y="46" width="6" height="34" rx="2" />
        <rect x="44" y="48" width="6" height="32" rx="2" />
        <rect x="76" y="46" width="6" height="34" rx="2" />
        <rect x="87" y="44" width="6" height="36" rx="2" />
      </g>
      <g fill="#2a1d17">
        <path d="M6 12q6-6 14-2l-2 6q-6-2-12-4z" />
        <rect x="32" y="68" width="6" height="12" />
        <rect x="44" y="68" width="6" height="12" />
        <rect x="76" y="68" width="6" height="12" />
        <rect x="87" y="68" width="6" height="12" />
        <path d="M34 44q28 8 58 0l-2 6q-26 6-54 0z" opacity=".5" />
        <path d="M97 32q8 6 6 20h-3q0-12-6-16z" />
      </g>
    </g>
  );
}

function LayerArt({ name }: { name: (typeof LAYERS)[number]['key'] }) {
  const svg = (children: React.ReactNode) => (
    <svg viewBox="0 0 600 560" preserveAspectRatio="xMidYMid slice">
      {children}
    </svg>
  );

  switch (name) {
    case 'sky':
      return svg(
        <>
          <defs>
            <linearGradient id="hw-sky-day" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3dfbb" />
              <stop offset="1" stopColor="#f6e8cf" />
            </linearGradient>
            <linearGradient id="hw-sky-night" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f1a2c" />
              <stop offset=".7" stopColor="#25304a" />
              <stop offset="1" stopColor="#4a3646" />
            </linearGradient>
            <radialGradient id="hw-sun">
              <stop offset="0" stopColor="#fff3cc" />
              <stop offset=".55" stopColor="#efc15f" />
              <stop offset="1" stopColor="#e2a640" />
            </radialGradient>
            <radialGradient id="hw-halo">
              <stop offset="0" stopColor="#ffe9b0" stopOpacity=".85" />
              <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hw-moonglow">
              <stop offset="0" stopColor="#f6edd2" stopOpacity=".45" />
              <stop offset="1" stopColor="#f6edd2" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g className="hw-day">
            <rect x="-120" y="-120" width="840" height="800" fill="url(#hw-sky-day)" />
            <circle cx="430" cy="150" r="120" fill="url(#hw-halo)" />
            <circle className="hw-sun" cx="430" cy="150" r="56" fill="url(#hw-sun)" />
            <g className="hw-clouds" fill="#fffaf0" opacity=".75">
              <path d="M40 120a18 18 0 0 1 30-12 22 22 0 0 1 40 6 14 14 0 0 1 4 26H44a12 12 0 0 1-4-20z" />
              <path d="M300 70a14 14 0 0 1 24-10 18 18 0 0 1 32 4 11 11 0 0 1 3 20h-56a10 10 0 0 1-3-14z" />
            </g>
          </g>
          <g className="hw-night">
            <rect x="-120" y="-120" width="840" height="800" fill="url(#hw-sky-night)" />
            {STARS.map(([x, y, r], i) => (
              <circle
                key={i}
                className="hw-star"
                cx={x}
                cy={y}
                r={r}
                fill="#fdf3d6"
                style={{ animationDelay: `${(i * 0.37) % 3}s` }}
              />
            ))}
            <circle cx="430" cy="140" r="90" fill="url(#hw-moonglow)" />
            <path d="M452 104a42 42 0 1 0 8 72 34 34 0 1 1-8-72z" fill="#f6edd2" />
          </g>
        </>
      );

    case 'far':
      // أبراج الخليج الغربي: برج الدوحة، برج تورنيدو، وأبراج أخرى
      return svg(
        <g fill="var(--hw-far)">
          <path d="M70 450V200a17 17 0 0 1 34 0v250z" />
          <rect x="85" y="168" width="4" height="18" />
          <path d="M118 450l5-110q8-30-5-62h44q-13 32-5 62l5 110z" />
          <rect x="180" y="250" width="26" height="200" />
          <path d="M214 450V230l16-24 16 24v220z" />
          <rect x="470" y="262" width="28" height="188" />
          <path d="M506 450V236q14-24 28 0v214z" />
          <rect x="544" y="290" width="40" height="160" />
          <g className="hw-night" fill="#f2c96b">
            <rect x="80" y="230" width="3" height="4" />
            <rect x="92" y="260" width="3" height="4" />
            <rect x="80" y="300" width="3" height="4" />
            <rect x="134" y="300" width="3" height="4" />
            <rect x="146" y="330" width="3" height="4" />
            <rect x="188" y="290" width="3" height="4" />
            <rect x="196" y="320" width="3" height="4" />
            <rect x="226" y="270" width="3" height="4" />
            <rect x="480" y="300" width="3" height="4" />
            <rect x="516" y="280" width="3" height="4" />
            <rect x="556" y="320" width="3" height="4" />
          </g>
          <g className="hw-day hw-gulls" fill="none" stroke="#5b3a22" strokeLinecap="round">
            <path className="hw-gull" d="M0 130q8-8 14 0q6-8 14 0" strokeWidth="2.5" />
            <path className="hw-gull" d="M40 108q6-6 11 0q5-6 11 0" strokeWidth="2" style={{ animationDelay: '-.3s' }} />
          </g>
        </g>
      );

    case 'mia':
      // متحف الفن الإسلامي: كتل متدرّجة ونافذة مقوّسة قرب القمّة
      return svg(
        <g transform="translate(330 270)">
          <path d="M0 180V112h190v68z" fill="var(--hw-mia)" />
          <path d="M22 112V86h146v26z" fill="var(--hw-mia)" />
          <path d="M54 86V54h82v32z" fill="var(--hw-mia)" />
          <path d="M78 54V30h34v24z" fill="var(--hw-mia)" />
          <path d="M136 112V86h32v26zM112 86V54h24v32zM190 180V112h-26v68z" fill="var(--hw-mia-shade)" />
          <path d="M86 70a9 9 0 0 1 18 0v8H86z" fill="var(--hw-mia-window)" />
          <rect x="-40" y="176" width="270" height="10" fill="var(--hw-quay)" />
        </g>
      );

    case 'souq':
      return svg(
        <>
          <defs>
            <pattern id="hw-mash" width="14" height="14" patternUnits="userSpaceOnUse">
              <rect width="14" height="14" fill="#5b3a22" />
              <path d="M7 1l6 6-6 6-6-6z" fill="var(--hw-mash)" />
              <circle cx="7" cy="7" r="1.8" fill="#5b3a22" />
            </pattern>
          </defs>
          <g transform="translate(40 220)">
            {/* الكتلة الرئيسية بوجه مضاء وجانب في الظل */}
            <rect x="0" y="40" width="250" height="196" fill="var(--hw-clay)" />
            <rect x="250" y="40" width="18" height="196" fill="var(--hw-clay-shade)" />
            <rect x="0" y="40" width="268" height="12" fill="var(--hw-clay-shade)" />
            {[0, 30, 60, 90, 120].map((x) => (
              <rect key={x} x={x} y="26" width="14" height="14" fill="var(--hw-clay)" />
            ))}
            {/* البرجيل (برج الهواء) */}
            <rect x="150" y="-44" width="70" height="96" fill="var(--hw-clay)" />
            <rect x="220" y="-44" width="12" height="96" fill="var(--hw-clay-shade)" />
            <rect x="146" y="-54" width="90" height="12" fill="var(--hw-clay-shade)" />
            <g fill="#4a2f1b">
              {[160, 176, 192, 208].map((x) => (
                <rect key={x} x={x} y="-34" width="8" height="60" />
              ))}
            </g>
            {/* أعمدة الچندل البارزة */}
            <g fill="#4a2f1b">
              <rect x="-10" y="64" width="16" height="5" />
              {[40, 90, 140, 190].map((x) => (
                <rect key={x} x={x} y="58" width="5" height="11" />
              ))}
              <rect x="262" y="64" width="20" height="5" />
            </g>
            {/* مشربية */}
            <rect x="22" y="92" width="66" height="58" fill="url(#hw-mash)" stroke="#4a2f1b" strokeWidth="4" />
            <rect x="18" y="150" width="74" height="8" fill="#4a2f1b" />
            <rect className="hw-night hw-glow" x="26" y="96" width="58" height="50" fill="#f2c96b" opacity=".35" />
            {/* الباب الخشبي */}
            <path d="M140 236v-80a27 27 0 0 1 54 0v80z" fill="#2d5f7c" stroke="#4a2f1b" strokeWidth="5" />
            <path d="M167 130v106" stroke="#4a2f1b" strokeWidth="3" />
            <g fill="#d4a843">
              {[170, 192, 214].map((y) => (
                <g key={y}>
                  <circle cx="154" cy={y} r="2.5" />
                  <circle cx="180" cy={y} r="2.5" />
                </g>
              ))}
            </g>
            {/* نافذة صغيرة وفانوس */}
            <rect x="216" y="100" width="22" height="32" rx="11" fill="#4a2f1b" />
            <rect className="hw-night hw-glow" x="219" y="104" width="16" height="26" rx="8" fill="#f2c96b" />
            <g transform="translate(118 160)">
              <path d="M0 0h10v4H0z" fill="#4a2f1b" />
              <path d="M1 4h8l2 14H-1z" fill="#d4a843" />
              <circle className="hw-night hw-lantern" cx="5" cy="12" r="16" fill="#f8d27a" opacity=".35" />
            </g>
          </g>
          <rect x="-80" y="452" width="440" height="14" fill="var(--hw-quay)" />
        </>
      );

    case 'sea':
      return svg(
        <>
          <defs>
            <linearGradient id="hw-sea-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--hw-sea-top)" />
              <stop offset="1" stopColor="var(--hw-sea-bottom)" />
            </linearGradient>
          </defs>
          <rect x="-120" y="462" width="840" height="220" fill="url(#hw-sea-g)" />
          {/* انعكاس الشمس أو القمر على الماء */}
          <g className="hw-shimmer" fill="var(--hw-glint)">
            <rect x="410" y="474" width="40" height="3" rx="1.5" />
            <rect x="420" y="486" width="26" height="3" rx="1.5" />
            <rect x="404" y="498" width="50" height="3" rx="1.5" />
            <rect x="418" y="512" width="30" height="3" rx="1.5" />
          </g>
          <g stroke="var(--hw-wave)" strokeWidth="3" fill="none" strokeLinecap="round">
            <path className="hw-wave" d="M-60 490h720" />
            <path className="hw-wave" d="M-60 520h720" style={{ animationDuration: '4.2s' }} />
            <path className="hw-wave" d="M-60 548h720" style={{ animationDuration: '5.4s' }} />
          </g>
          {/* السفينة الشراعية (البوم) */}
          <g className="hw-dhow">
            <g transform="translate(372 380)">
              <path d="M0 76h158l-24 28H24z" fill="#5b3a22" />
              <path d="M8 76l12-11h118l20 11z" fill="#7a5532" />
              <path d="M30 70h100" stroke="#3e2615" strokeWidth="2" />
              <path d="M74 66V-8" stroke="#4a2f1b" strokeWidth="4" />
              <path d="M76 -6c42 21 60 48 64 72H76z" fill="var(--hw-sail)" />
              <path d="M72 4c-25 17-36 36-38 62h38z" fill="var(--hw-sail-2)" />
              <path d="M74 -8l16 4-16 4z" fill="#8a1538" />
              <path d="M76 -6L148 70M72 4L18 74" stroke="#4a2f1b" strokeWidth="1" opacity=".5" />
              <circle className="hw-night hw-lantern" cx="140" cy="62" r="14" fill="#f8d27a" opacity=".4" />
              <circle className="hw-night" cx="140" cy="62" r="3" fill="#ffe3a0" />
            </g>
          </g>
        </>
      );

    case 'front':
      return svg(
        <>
          <Palm x={330} y={458} s={1.15} />
          <Palm x={46} y={460} s={0.95} delay={-2} />
          <Oryx x={218} y={372} s={1} />
        </>
      );
  }
}
