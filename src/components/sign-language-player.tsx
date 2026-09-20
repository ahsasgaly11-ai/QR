'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, ChevronRight, ChevronLeft, RotateCcw, Info } from 'lucide-react';
import {
  buildSequence,
  loadSignManifest,
  sourceWords,
  type SignManifest,
} from '@/lib/sign-interpreter';
import { SignAvatar } from './sign-avatar';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// مُشغّل الترجمة الإشارية التلقائي
// يعرض نصّ النشاط إشارةً إشارة من القاموس الموثّق، مع تحكّم كامل (تشغيل/إيقاف،
// السابق/التالي، إعادة). صادق: حيث لا تتوفّر إشارة موثّقة يعرض الحرف/الكلمة
// نصًّا واضحًا دون تلفيق يد، ويُعلن ذلك في شريط أعلى المُشغّل.
// ---------------------------------------------------------------------------

// ملّي ثانية لكل خطوة صورة/نص (تُطال للكلمة). المقاطع تتقدّم عند انتهائها.
const IMG_MS = 1200;
const WORD_MS = 1700;

export function SignLanguagePlayer({ text }: { text: string }) {
  const [manifest, setManifest] = useState<SignManifest | null>(null);
  const [ready, setReady] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  // مصادر تعذّر تحميلها (مقطع مُخطَّط لم يُصوَّر بعد) — نتراجع بلطف للنصّ.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = useCallback((src?: string) => {
    if (!src) return;
    setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);

  useEffect(() => {
    let alive = true;
    loadSignManifest().then((m) => {
      if (!alive) return;
      setManifest(m);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const steps = useMemo(() => buildSequence(text, manifest), [text, manifest]);
  const words = useMemo(() => sourceWords(text), [text]);

  // أعِد الضبط عند تغيّر النشاط (النصّ) أو وصول القاموس.
  useEffect(() => {
    setI(0);
    setPlaying(true);
  }, [text, manifest]);

  const total = steps.length;
  const step = steps[i];
  const atEnd = i >= total - 1;
  // هل نعرض وسيطًا فعليًّا الآن؟ (له أصل، ولم يتعذّر تحميله)
  const broken = !!step?.src && failed.has(step.src);
  const showMedia = !!step && !!step.media && !!step.src && !broken;

  const goto = useCallback(
    (n: number) => {
      if (total === 0) return;
      setI(Math.max(0, Math.min(total - 1, n)));
    },
    [total]
  );

  const next = useCallback(() => {
    setI((p) => {
      if (p >= total - 1) {
        setPlaying(false);
        return p;
      }
      return p + 1;
    });
  }, [total]);

  const restart = useCallback(() => {
    setI(0);
    setPlaying(true);
  }, []);

  // التقدّم التلقائي للصور/النصّ (المقاطع العاملة تتقدّم على onEnded).
  useEffect(() => {
    if (!playing || !step) return;
    if (showMedia && step.media === 'video') return;
    const t = setTimeout(next, step.kind === 'word' ? WORD_MS : IMG_MS);
    return () => clearTimeout(t);
  }, [playing, i, step, showMedia, next]);

  const anyAsset = useMemo(
    () => steps.some((s) => s.hasAsset && !failed.has(s.src!)),
    [steps, failed]
  );

  if (!ready) {
    return (
      <div className="grid place-items-center px-4 py-10 text-sm font-bold text-muted-foreground">
        جارٍ تجهيز الترجمة الإشارية…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm font-bold text-muted-foreground">
        لا يوجد نصّ لترجمته في هذا النشاط.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* شريط صدق: يُعلن حين لا يحوي القاموس أصولًا موثّقة بعد */}
      {!anyAsset && (
        <p className="flex items-start gap-2 bg-[color:var(--maroon-100)] px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--maroon)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          لم تُضَف بعد أصول القاموس الإشاري الموثّق، فيُعرَض النصّ حرفًا حرفًا
          مؤقتًا. عند إضافة إشارات مركز مدى المعتمدة تظهر تلقائيًّا هنا.
        </p>
      )}

      {/* المسرح */}
      <div className="relative grid aspect-square w-full place-items-center bg-black">
        {showMedia && step.media === 'video' ? (
          <>
            <video
              key={`${i}-${step.src}`}
              src={step.src}
              autoPlay
              muted
              playsInline
              onEnded={next}
              onError={() => markFailed(step.src)}
              className="h-full w-full object-contain"
            />
            {/* المرشد حاضر بحجم صغير في الزاوية */}
            <div className="absolute bottom-2 left-2 grid h-16 w-16 place-items-end overflow-hidden rounded-full bg-white/90 shadow-md">
              <SignAvatar state="greet" />
            </div>
          </>
        ) : showMedia && step.media === 'img' ? (
          <>
            <img
              src={step.src}
              alt={`إشارة: ${step.gloss}`}
              onError={() => markFailed(step.src)}
              className="h-full w-full object-contain"
            />
            <div className="absolute bottom-2 left-2 grid h-16 w-16 place-items-end overflow-hidden rounded-full bg-white/90 shadow-md">
              <SignAvatar state="greet" />
            </div>
          </>
        ) : (
          // لا إشارة موثّقة — المرشد يوجّه إلى الرمز المعروض نصًّا (دون تلفيق يد)
          <div className="flex w-full items-center justify-center gap-2 px-4">
            <div className="h-28 w-28 shrink-0 sm:h-32 sm:w-32">
              <SignAvatar state={playing ? 'present' : 'greet'} />
            </div>
            <span className="flex flex-col items-center text-center">
              <span className="font-display text-[4.5rem] font-black leading-none text-white sm:text-[5.5rem]">
                {step.glyph}
              </span>
              <span className="mt-1 text-[11px] font-bold text-white/70">
                {step.kind === 'word' ? 'كلمة' : step.kind === 'letter' ? 'حرف' : 'رمز'}
              </span>
            </span>
          </div>
        )}

        {/* عدّاد الخطوة */}
        <span className="absolute left-2 top-2 rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
          {i + 1} / {total}
        </span>
      </div>

      {/* التسمية أسفل الإشارة */}
      <div className="bg-[color:var(--surface-2)] px-3 py-2 text-center">
        <p className="font-display text-lg font-black text-[color:var(--maroon)]">
          {step.gloss}
        </p>
      </div>

      {/* النصّ المقروء مع إبراز الكلمة الجارية */}
      <p className="max-h-16 overflow-y-auto px-3 py-2 text-center text-sm font-bold leading-7">
        {words.map((w, wi) => (
          <span
            key={wi}
            onClick={() => {
              const first = steps.findIndex((s) => s.word === wi);
              if (first >= 0) {
                goto(first);
                setPlaying(false);
              }
            }}
            className={cn(
              'mx-0.5 cursor-pointer rounded px-1 transition',
              step.word === wi
                ? 'bg-[color:var(--gold)]/40 text-[color:var(--ink)]'
                : 'text-muted-foreground hover:bg-[color:var(--surface-2)]'
            )}
          >
            {w}
          </span>
        ))}
      </p>

      {/* التحكّم */}
      <div className="flex items-center justify-center gap-1.5 border-t border-[color:var(--hairline)] px-3 py-2">
        <button
          onClick={restart}
          aria-label="إعادة من البداية"
          className="grid h-9 w-9 place-items-center rounded-xl text-[color:var(--maroon)] transition hover:bg-[color:var(--surface-2)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            goto(i - 1);
            setPlaying(false);
          }}
          disabled={i === 0}
          aria-label="الإشارة السابقة"
          className="grid h-9 w-9 place-items-center rounded-xl text-[color:var(--maroon)] transition hover:bg-[color:var(--surface-2)] disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            if (atEnd) restart();
            else setPlaying((p) => !p);
          }}
          aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--maroon)] text-white shadow-md transition hover:bg-[color:var(--maroon-700)]"
        >
          {playing && !atEnd ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={() => {
            goto(i + 1);
            setPlaying(false);
          }}
          disabled={atEnd}
          aria-label="الإشارة التالية"
          className="grid h-9 w-9 place-items-center rounded-xl text-[color:var(--maroon)] transition hover:bg-[color:var(--surface-2)] disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {/* موازنة بصرية مقابل زر الإعادة */}
        <span className="h-9 w-9" aria-hidden />
      </div>
    </div>
  );
}
