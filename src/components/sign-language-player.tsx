'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Pause, ChevronRight, ChevronLeft, RotateCcw, Info, Sparkles, Gauge, Film } from 'lucide-react';
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
import { SignAvatar3D, canUseWebGL } from './sign-avatar-3d';
import { isSignReviewMode } from '@/lib/handshapes';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// مُشغّل الترجمة الإشارية — مترجم واحد لكل النصّ
//
// شخصية ثلاثية الأبعاد واحدة تؤدّي نصّ النشاط إشارةً إشارة: الكلمات التي لها
// إشارة موثّقة في القاموس تُؤدّى من حركتها المستخلصة، وما عداها يُهجّى حرفًا
// حرفًا بالشخصية نفسها. لا مقاطع لمؤدّين مختلفين ولا تضمينات خارجية في واجهة
// الطالب؛ مقطع المصدر يبقى متاحًا للمترجم المعتمد في وضع المراجعة فقط.
// الصدق محفوظ: لا إشارة بلا أصل موثّق، ومصدر كل إشارة يُنسَب تحتها.
// ---------------------------------------------------------------------------

// ملّي ثانية لرمز يُعرض نصًّا (أرقام/حروف لاتينية) ولحرف بلا حركة.
const RAW_MS = 1100;
const SPEEDS = [0.75, 1, 1.25] as const;

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
const SPEED_STORE = 'qa-sign-speed';

export function SignLanguagePlayer({ text }: { text: string }) {
  const [manifest, setManifest] = useState<SignManifest | null>(null);
  const [ready, setReady] = useState(false);
  // الترتيب الإشاري الذكي (نموذج الغلوس) أم الحرفي كلمةً كلمة
  const [mode, setMode] = useState<'smart' | 'literal'>('smart');
  const [gloss, setGloss] = useState<Gloss | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  // المترجم ثلاثي الأبعاد حيث يتوفّر WebGL، وإلا الهيكل ثنائي الأبعاد
  const [gl3d, setGl3d] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [noPose, setNoPose] = useState<Set<string>>(new Set());
  // وضع المراجعة (للمترجم المعتمد فقط): يتيح رؤية مقطع المصدر لكل إشارة.
  const [review, setReview] = useState(false);
  const [showSource, setShowSource] = useState(false);
  useEffect(() => {
    setGl3d(canUseWebGL());
    setReview(isSignReviewMode());
    try {
      const m = localStorage.getItem(MODE_STORE);
      if (m === 'literal' || m === 'smart') setMode(m);
      const sp = Number(localStorage.getItem(SPEED_STORE));
      if (SPEEDS.includes(sp as (typeof SPEEDS)[number])) setSpeed(sp);
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
    () =>
      smart && gloss
        ? buildSequenceFromGloss(text, gloss, manifest, { avatarOnly: true })
        : buildSequence(text, manifest, { avatarOnly: true }),
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
  const poseUrl = step?.motion ?? (step?.media === 'video' ? poseUrlFor(step.src) : null);
  const hasMotion = !!poseUrl && !noPose.has(poseUrl);

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

  // التقدّم التلقائي للرموز النصّية (الإشارات تتقدّم عند انتهاء أدائها).
  useEffect(() => {
    if (!playing || !step || hasMotion || showSource) return;
    const t = setTimeout(next, RAW_MS / speed);
    return () => clearTimeout(t);
  }, [playing, i, step, hasMotion, showSource, next, speed]);

  const anyAsset = useMemo(() => steps.some((s) => s.kind === 'word' && s.hasAsset), [steps]);
  // مصدر الإشارة المعروضة الآن (إن كانت من قاعدة خارجية) — يُنسَب بصدق للطالب.
  const source = step?.kind === 'word' && step.source ? SIGN_SOURCES[step.source] : undefined;
  const setSpeedPersist = (v: number) => {
    setSpeed(v);
    try {
      localStorage.setItem(SPEED_STORE, String(v));
    } catch {
      /* تجاهل */
    }
  };

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

  const stageBg = 'bg-[radial-gradient(circle_at_50%_28%,#8a1538_0%,#4d0a20_55%,#1d0610_100%)]';

  return (
    <div className="flex flex-col">
      {/* وضع المراجعة: تنبيه للمترجم */}
      {review && (
        <p className="flex items-start gap-2 bg-[color:var(--gold)]/90 px-3 py-2 text-[11px] font-black leading-5 text-black">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          وضع المراجعة (للمترجم المعتمد): يمكنك مقارنة أداء المترجم بمقطع المصدر لكل إشارة.
        </p>
      )}
      {/* شريط صدق: يُعلن حين لا يحوي القاموس إشارة لأي كلمة في النصّ */}
      {!anyAsset && !review && (
        <p className="flex items-start gap-2 bg-[color:var(--maroon-100)] px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--maroon)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          لا تتوفّر في القاموس إشارة لكلمات هذا النصّ بعد، فيهجّيه المترجم حرفًا حرفًا.
          كلّما أُضيفت إشارات موثّقة أدّاها تلقائيًّا.
        </p>
      )}

      {/* شريط الوضع: الترتيب الإشاري الذكي / الحرفي، والسرعة */}
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
        <div className="flex items-center gap-1" role="group" aria-label="سرعة الأداء">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {SPEEDS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSpeedPersist(v)}
              aria-pressed={speed === v}
              className={cn(
                'rounded-lg px-1.5 py-1 tabular-nums transition',
                speed === v
                  ? 'bg-[color:var(--maroon-100)] text-[color:var(--maroon)]'
                  : 'text-muted-foreground hover:bg-[color:var(--surface-2)]'
              )}
            >
              {v === 1 ? '١×' : v === 0.75 ? '٠٫٧٥×' : '١٫٢٥×'}
            </button>
          ))}
        </div>
      </div>

      {/* المسرح: المترجم ثلاثي الأبعاد حاضر دائمًا */}
      <div className={cn('relative grid aspect-square w-full place-items-center overflow-hidden', stageBg)}>
        {gl3d && (
          <SignAvatar3D
            src={hasMotion && !showSource ? poseUrl : null}
            cue={i}
            playing={playing}
            speed={speed}
            onEnded={next}
            onReady={() => setAvatarReady(true)}
            onUnavailable={(u) => setNoPose((p) => new Set(p).add(u))}
            onFailed={() => setGl3d(false)}
            className="absolute inset-0 h-full w-full"
          />
        )}
        {!gl3d && hasMotion && poseUrl && !showSource && (
          <SignSkeleton
            key={`${i}-${poseUrl}`}
            src={poseUrl}
            playing={playing}
            onEnded={next}
            onUnavailable={() => setNoPose((p) => new Set(p).add(poseUrl))}
          />
        )}
        {gl3d && !avatarReady && (
          <div className="absolute inset-0 grid place-items-center text-center text-white/85">
            <div className="flex flex-col items-center gap-2">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
              <span className="text-xs font-bold">جارٍ تجهيز المترجم…</span>
            </div>
          </div>
        )}
        {/* مقطع المصدر (وضع المراجعة فقط) */}
        {review && showSource && step?.media === 'video' && step.src && (
          <video
            key={`${i}-${step.src}`}
            src={step.src}
            autoPlay
            muted
            playsInline
            onEnded={next}
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        )}
        {/* رمز يُعرض نصًّا: أرقام وحروف لاتينية، أو حرف لم تتوفّر حركته */}
        {step && !hasMotion && !showSource && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/92 px-4 py-2 shadow-lg backdrop-blur">
            <span className="font-display text-[2.6rem] font-black leading-none text-[color:var(--maroon)]">
              {step.glyph}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {step.kind === 'word' ? 'كلمة' : step.kind === 'letter' ? 'حرف' : 'رمز'}
            </span>
          </div>
        )}
        {/* عدّاد الخطوة */}
        <span className="absolute left-2 top-2 rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
          {i + 1} / {total}
        </span>
        {review && step?.media === 'video' && (
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            aria-pressed={showSource}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/15 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur hover:bg-white/25"
          >
            <Film className="h-3 w-3" />
            {showSource ? 'المترجم' : 'مقطع المصدر'}
          </button>
        )}
      </div>

      {/* التسمية أسفل الإشارة */}
      <div className="bg-[color:var(--surface-2)] px-3 py-2 text-center">
        <p className="font-display text-lg font-black text-[color:var(--maroon)]">
          {step.kind === 'letter' ? `حرف «${step.gloss}»` : step.gloss}
        </p>
        {source && (
          <p className="mt-0.5 text-[10px] font-bold leading-4 text-muted-foreground" title={source.note}>
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
