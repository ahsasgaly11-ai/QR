'use client';

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// الأفاتار الموحّد: يعيد أداء الإشارة من بنك الحركات (public/sign/poses/*.json)
// المستخلص آليًّا من مقاطع القاموس بنموذج MediaPipe Holistic.
//
// لماذا؟ المقاطع تأتي من مصادر مختلفة (مؤدّون وخلفيات وأحجام متباينة)؛ الأفاتار
// يعرضها جميعًا بشخصية واحدة بهوية المنصّة، وبحجم أصغر بكثير من الفيديو.
// الحركة تُرسم على canvas: جذع ورأس وذراعان من معالم الجسم (33)، وأصابع من
// معالم اليدين (21 لكل يد). بلا تلفيق: إن غابت يد في إطار ما لا تُرسم.
// ---------------------------------------------------------------------------

type Pt = number[];
interface PoseFrame {
  p: Pt[] | null; // 33 معلمًا [x, y, vis]
  l: Pt[] | null; // 21 معلمًا لليد اليسرى [x, y]
  r: Pt[] | null; // 21 معلمًا لليد اليمنى
}
interface PoseFile {
  v: number;
  fps: number;
  src: string;
  frames: PoseFrame[];
}

// وصلات اليد (MediaPipe Hands)
const HAND_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const cache = new Map<string, Promise<PoseFile | null>>();
function loadPose(src: string): Promise<PoseFile | null> {
  if (!cache.has(src)) {
    cache.set(
      src,
      fetch(src, { cache: 'force-cache' })
        .then((r) => (r.ok ? (r.json() as Promise<PoseFile>) : null))
        .catch(() => null)
    );
  }
  return cache.get(src)!;
}

/** مسار ملف الحركة لمقطع محلي: /sign/words/x/y.mp4 → /sign/poses/words/x/y.json */
export function poseUrlFor(videoSrc?: string): string | null {
  if (!videoSrc || !videoSrc.startsWith('/sign/') || !/\.(mp4|webm)$/i.test(videoSrc)) return null;
  return '/sign/poses/' + videoSrc.slice('/sign/'.length).replace(/\.(mp4|webm)$/i, '.json');
}

export function SignSkeleton({
  src,
  onEnded,
  onUnavailable,
  playing = true,
}: {
  /** مسار ملف الحركة JSON. */
  src: string;
  /** يُستدعى مرّة عند انتهاء الأداء. */
  onEnded: () => void;
  /** يُستدعى إن لم يتوفّر ملف الحركة (فيتراجع المشغّل إلى الفيديو). */
  onUnavailable: () => void;
  playing?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<PoseFile | null | undefined>(undefined);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const unavailRef = useRef(onUnavailable);
  unavailRef.current = onUnavailable;

  useEffect(() => {
    let alive = true;
    setData(undefined);
    loadPose(src).then((d) => {
      if (!alive) return;
      if (!d || !d.frames?.length) {
        setData(null);
        unavailRef.current();
      } else setData(d);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const maroon = css.getPropertyValue('--maroon').trim() || '#8a1538';
    const gold = css.getPropertyValue('--gold').trim() || '#c8a24a';
    const skin = '#f1d3b8';

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || 400;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const frames = data.frames;
    const frameMs = 1000 / (data.fps || 15);
    let raf = 0;
    let start = 0;
    let done = false;

    const X = (p: Pt) => p[0] * size;
    const Y = (p: Pt) => p[1] * size;
    const seg = (a: Pt, b: Pt, w: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(a), Y(a));
      ctx.lineTo(X(b), Y(b));
      ctx.stroke();
    };
    const dot = (p: Pt, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(p), Y(p), r, 0, Math.PI * 2);
      ctx.fill();
    };
    const hand = (h: Pt[] | null) => {
      if (!h) return;
      for (const [a, b] of HAND_LINKS) seg(h[a], h[b], size * 0.014, skin);
      for (const p of h) dot(p, size * 0.008, '#d9a885');
    };
    const draw = (f: PoseFrame) => {
      ctx.clearRect(0, 0, size, size);
      const p = f.p;
      if (!p) return;
      const [ls, rs, le, re, lw, rw, lh, rh] = [p[11], p[12], p[13], p[14], p[15], p[16], p[23], p[24]];
      const neck: Pt = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2];
      const hip: Pt = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
      // الجذع
      ctx.fillStyle = maroon;
      ctx.beginPath();
      ctx.moveTo(X(ls), Y(ls));
      ctx.lineTo(X(rs), Y(rs));
      ctx.lineTo(X(rh), Y(rh) + size * 0.25);
      ctx.lineTo(X(lh), Y(lh) + size * 0.25);
      ctx.closePath();
      ctx.fill();
      seg(ls, rs, size * 0.06, maroon);
      // الرأس من الأنف وعرض الكتفين
      const nose = p[0];
      const headR = Math.max(size * 0.06, Math.hypot(X(ls) - X(rs), Y(ls) - Y(rs)) * 0.3);
      seg(neck, [nose[0], nose[1] + headR * 0.6 / size], size * 0.05, skin);
      dot([nose[0], nose[1] - headR * 0.15 / size], headR, skin);
      ctx.fillStyle = gold; // طوق بهوية المنصّة
      ctx.beginPath();
      ctx.arc(X(nose), Y(nose) - headR * 0.15, headR, Math.PI, Math.PI * 2);
      ctx.fill();
      // الذراعان (أكمام) ثم الساعدان
      seg(ls, le, size * 0.055, maroon);
      seg(rs, re, size * 0.055, maroon);
      seg(le, lw, size * 0.045, skin);
      seg(re, rw, size * 0.045, skin);
      // اليدان بالأصابع
      hand(f.l);
      hand(f.r);
      void hip;
    };

    const tick = (t: number) => {
      if (!start) start = t;
      const i = Math.min(frames.length - 1, Math.floor((t - start) / frameMs));
      draw(frames[i]);
      if (i >= frames.length - 1) {
        if (!done) {
          done = true;
          // نُبقي آخر إطار لحظة ثم نُعلن الانتهاء
          setTimeout(() => endedRef.current(), 350);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    draw(frames[0]);
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, playing]);

  if (data === null) return null;
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="الأفاتار الموحّد يؤدّي الإشارة"
      className="h-full w-full bg-black"
    />
  );
}
