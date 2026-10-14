'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Pause, ChevronRight, ChevronLeft, RotateCcw, Info, Sparkles, User } from 'lucide-react';
import {
  buildSequence,
  buildSequenceFromGloss,
  loadSignManifest,
  sourceWords,
  SIGN_SOURCES,
  type SignManifest,
} from '@/lib/sign-interpreter';
import { glossCacheKey, GLOSS_VERSION, type Gloss } from '@/lib/sign-gloss';
import { SignSkeleton, poseUrlFor } from './sign-skeleton';
import { SignAvatar } from './sign-avatar';
import { SignYouTube } from './sign-youtube';
import { HandSign } from './hand-sign';
import { getLetterHandshape, isSignReviewMode } from '@/lib/handshapes';
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
// صورة متحرّكة (GIF) لإشارة كلمة: تُمهَل لتُرى الحركة كاملة.
const GIF_MS = 3800;

// جلب الغلوس: الملف المحسوب مسبقًا أوّلًا (صفر تكلفة)، ثم الخادم، وإلا الوضع الحرفي.
let staticGloss: Promise<Record<string, Gloss>> | null = null;
function loadStaticGloss(): Promise<Record<string, Gloss>> {
  if (!staticGloss) {
    staticGloss = fetch('/sign/gloss-cache.json', { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.version === GLOSS_VERSION ? (j.items ?? {}) : {}))
      .catch(() => ({}));
  }
  return staticGloss;
}
const glossMemo = new Map<string, Promise<Gloss | null>>();
function fetchGloss(text: string): Promise<Gloss | null> {
  const key = glossCacheKey(text);
  if (!glossMemo.has(key)) {
    glossMemo.set(
      key,
      loadStaticGloss().then(async (items) => {
        if (items[key]) return items[key];
        try {
          const r = await fetch('/api/sign/gloss', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (!r.ok) return null;
          const j = (await r.json()) as { gloss?: Gloss };
          return j.gloss ?? null;
        } catch {
          return null;
        }
      })
    );
  }
  return glossMemo.get(key)!;
}

const MODE_STORE = 'qa-sign-mode'; // smart | literal
const AVATAR_STORE = 'qa-sign-avatar'; // on | off

export function SignLanguagePlayer({ text }: { text: string }) {
  const [manifest, setManifest] = useState<SignManifest | null>(null);
  const [ready, setReady] = useState(false);
  // الترتيب الإشاري الذكي (نموذج الغلوس) أم الحرفي كلمةً كلمة
  const [mode, setMode] = useState<'smart' | 'literal'>('smart');
  const [gloss, setGloss] = useState<Gloss | null>(null);
  // الأفاتار الموحّد (بنك الحركات) بدل فيديو المصدر حين يتوفّر
  const [avatar, setAvatar] = useState(false);
  const [noPose, setNoPose] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_STORE);
      if (m === 'literal' || m === 'smart') setMode(m);
      setAvatar(localStorage.getItem(AVATAR_STORE) === 'on');
    } catch {
      /* التخزين غير متاح */
    }
  }, []);
  useEffect(() => {
    let alive = true;
    setGloss(null);
    fetchGloss(text).then((g) => {
      if (alive) setGloss(g);
    });
    return () => {
      alive = false;
    };
  }, [text]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  // وضع المراجعة (للمترجم المعتمد فقط) — يكشف أوضاع الحروف المسودّة غير المعتمدة.
  const [review, setReview] = useState(false);
  useEffect(() => setReview(isSignReviewMode()), []);
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

  const smart = mode === 'smart' && !!gloss && gloss.items.length > 0;
  const steps = useMemo(
    () => (smart && gloss ? buildSequenceFromGloss(text, gloss, manifest) : buildSequence(text, manifest)),
    [text, manifest, gloss, smart]
  );
  const words = useMemo(() => sourceWords(text), [text]);

  // أعِد الضبط عند تغيّر النشاط (النصّ) أو وصول القاموس أو تبديل الوضع.
  useEffect(() => {
    setI(0);
    setPlaying(true);
  }, [text, manifest, smart]);

  const total = steps.length;
  const step = steps[i];
  const atEnd = i >= total - 1;
  // هل نعرض وسيطًا فعليًّا الآن؟ (له أصل، ولم يتعذّر تحميله)
  const broken = !!step?.src && failed.has(step.src);
  const showMedia = !!step && !!step.media && !!step.src && !broken;
  // وضع يد الشخصية للحرف الحالي (الموثّق للطلبة، والمسودّات أيضًا في المراجعة)
  const handshape =
    step && step.kind === 'letter' && !showMedia
      ? getLetterHandshape(step.glyph, review)
      : null;

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
    if (showMedia && (step.media === 'video' || step.media === 'yt')) return;
    const isGif = showMedia && step.media === 'img' && /\.gif(\?|$)/i.test(step.src || '');
    const t = setTimeout(next, isGif ? GIF_MS : step.kind === 'word' ? WORD_MS : IMG_MS);
    return () => clearTimeout(t);
  }, [playing, i, step, showMedia, next]);

  const anyAsset = useMemo(
    () => steps.some((s) => s.hasAsset && !failed.has(s.src!)),
    [steps, failed]
  );
  // مصدر الإشارة المعروضة الآن (إن كانت من قاعدة خارجية) — يُنسَب بصدق للطالب.
  const source = showMedia && step?.source ? SIGN_SOURCES[step.source] : undefined;
  const poseUrl = showMedia && step.media === 'video' ? poseUrlFor(step.src) : null;
  const showSkeleton = avatar && !!poseUrl && !noPose.has(poseUrl);

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
      {/* وضع المراجعة: تنبيه للمترجم أنّ أوضاع اليد مسودّات غير معتمدة */}
      {review && (
        <p className="flex items-start gap-2 bg-[color:var(--gold)]/90 px-3 py-2 text-[11px] font-black leading-5 text-black">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          وضع المراجعة (للمترجم المعتمد): أوضاع اليد المعروضة مسودّات غير معتمدة —
          راجِعها واعتمدها قبل عرضها على الطلبة.
        </p>
      )}
      {/* شريط صدق: يُعلن حين لا يحوي القاموس أصولًا موثّقة بعد */}
      {!anyAsset && !review && (
        <p className="flex items-start gap-2 bg-[color:var(--maroon-100)] px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--maroon)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          لا تتوفّر في القاموس الإشاري إشارة لكلمات هذا النصّ بعد، فيُعرَض حرفًا
          حرفًا مؤقتًا. كلّما أُضيفت إشارات موثّقة ظهرت تلقائيًّا هنا.
        </p>
      )}

      {/* شريط الوضع: الترتيب الإشاري الذكي / الحرفي، والأفاتار الموحّد */}
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--hairline)] px-2 py-1.5 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => {
            const m = mode === 'smart' ? 'literal' : 'smart';
            setMode(m);
            try {
              localStorage.setItem(MODE_STORE, m);
            } catch {
              /* تجاهل */
            }
          }}
          aria-pressed={mode === 'smart'}
          title={
            smart
              ? 'ترتيب إشاري تقريبي من نموذج لغوي مقيّد بمفردات القاموس — بانتظار اعتماد مترجم. اضغط للوضع الحرفي.'
              : gloss
              ? 'الوضع الحرفي: كلمةً كلمة بترتيب الجملة العربية. اضغط للترتيب الإشاري الذكي.'
              : 'الوضع الحرفي: كلمةً كلمة (الغلوس الذكي غير متاح لهذا النصّ بعد).'
          }
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 transition',
            smart
              ? 'bg-[color:var(--maroon-100)] text-[color:var(--maroon)]'
              : 'text-muted-foreground hover:bg-[color:var(--surface-2)]'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {smart ? 'ترتيب إشاري ذكي' : 'حرفي كلمةً كلمة'}
        </button>
        <button
          type="button"
          onClick={() => {
            const v = !avatar;
            setAvatar(v);
            try {
              localStorage.setItem(AVATAR_STORE, v ? 'on' : 'off');
            } catch {
              /* تجاهل */
            }
          }}
          aria-pressed={avatar}
          title="الأفاتار الموحّد يعيد أداء الإشارة من الهيكل العظمي المستخلص آليًّا من مقطع المصدر"
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 transition',
            avatar
              ? 'bg-[color:var(--maroon-100)] text-[color:var(--maroon)]'
              : 'text-muted-foreground hover:bg-[color:var(--surface-2)]'
          )}
        >
          <User className="h-3.5 w-3.5" />
          الأفاتار الموحّد
        </button>
      </div>

      {/* المسرح */}
      <div className="relative grid aspect-square w-full place-items-center bg-black">
        {showMedia && step.media === 'yt' ? (
          <>
            <SignYouTube id={step.src!} title={step.gloss} onEnded={next} />
            <div className="absolute bottom-2 left-2 grid h-16 w-16 place-items-end overflow-hidden rounded-full bg-white/90 shadow-md">
              <SignAvatar state="greet" />
            </div>
          </>
        ) : showSkeleton && poseUrl ? (
          <>
            <SignSkeleton
              key={`${i}-${poseUrl}`}
              src={poseUrl}
              playing={playing}
              onEnded={next}
              onUnavailable={() => setNoPose((p) => new Set(p).add(poseUrl))}
            />
            <span className="absolute right-2 top-2 rounded-lg bg-white/15 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
              الأفاتار الموحّد
            </span>
          </>
        ) : showMedia && step.media === 'video' ? (
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
        ) : handshape ? (
          // الشخصية تؤدّي وضع اليد للحرف من بياناته
          <div className="flex w-full items-center justify-center gap-1 px-4">
            <div className="h-36 w-32 shrink-0 sm:h-40 sm:w-36">
              <HandSign pose={handshape.pose} />
            </div>
            <span className="font-display text-[3.5rem] font-black leading-none text-white sm:text-[4.5rem]">
              {step.glyph}
            </span>
            {!handshape.verified && (
              <span className="absolute right-2 top-2 rounded-lg bg-[color:var(--gold)] px-2 py-0.5 text-[11px] font-black text-black shadow">
                قيد المراجعة
              </span>
            )}
            <div className="absolute bottom-2 left-2 grid h-14 w-14 place-items-end overflow-hidden rounded-full bg-white/90 shadow-md">
              <SignAvatar state="present" />
            </div>
          </div>
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
        {source && (
          <p
            className="mt-0.5 text-[10px] font-bold leading-4 text-muted-foreground"
            title={source.note}
          >
            المصدر: {source.label}
          </p>
        )}
      </div>

      {/* النصّ المقروء مع إبراز الكلمة الجارية */}
      <p className="max-h-16 overflow-y-auto px-3 py-2 text-center text-sm font-bold leading-7">
        {words.map((w, wi) => (
          <button
            key={wi}
            type="button"
            aria-label={`الانتقال إلى إشارة كلمة «${w}»`}
            aria-current={wi >= step.word && wi < step.word + (step.span ?? 1) ? 'true' : undefined}
            onClick={() => {
              const first = steps.findIndex((s) => s.word === wi);
              if (first >= 0) {
                goto(first);
                setPlaying(false);
              }
            }}
            className={cn(
              'mx-0.5 cursor-pointer rounded px-1 font-bold transition',
              wi >= step.word && wi < step.word + (step.span ?? 1)
                ? 'bg-[color:var(--gold)]/40 text-[color:var(--ink)]'
                : 'text-muted-foreground hover:bg-[color:var(--surface-2)]'
            )}
          >
            {w}
          </button>
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
