'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { isLite } from '@/lib/perf';
import { SOUND_FOCUS_EVENT, claimSound, type SoundOwner } from '@/components/home/sound-focus';

// ---------------------------------------------------------------------------
// فيديو إطلاق المنصّة (عمودي 9:16، ثلاثون ثانية) في الصفحة الرئيسية.
//
// • يبدأ تلقائيًا بلا صوت حين يصل الزائر إليه بالتمرير (نصفه على الأقل في
//   الشاشة)، ويتوقّف مؤقتًا حين يخرج منها أو تُخفى الصفحة، ويُكمل عند العودة.
//   المتصفحات لا تسمح بالتشغيل التلقائي إلا مكتومًا، لذا الصوت لا يعمل
//   إلا بضغطة من الزائر نفسه على زرّ الصوت.
// • حين يشغّل الزائر صوت الفيديو يُكتم عرض «نسيج المجتمع القطري» المجاور،
//   والعكس، حتى لا تتداخل الموسيقيان (sound-focus).
// • في «الوضع الخفيف» أو عند تفضيل تقليل الحركة لا يبدأ وحده: تظهر صورة
//   الغلاف وزرّ تشغيل، ولا يُحمَّل الملف قبل الطلب.
// ---------------------------------------------------------------------------

const OWNER: SoundOwner = 'launch-video';
const VIDEO_SRC = '/videos/launch.mp4';
const POSTER_SRC = '/videos/launch-poster.jpg';

export function LaunchVideo() {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [auto, setAuto] = useState(true);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  // يصبح صحيحًا بعد أول ضغطة يدوية؛ بعدها لا يعود التمرير يوقف الفيديو أو يشغّله
  // إلا إن خرج من الشاشة كلّيًا.
  const manual = useRef(false);
  // نسخة مرجعية من auto يقرؤها مراقب التمرير دون انتظار إعادة التصيير
  const autoRef = useRef(true);

  // لا تشغيل تلقائي في الوضع الخفيف أو مع تقليل الحركة
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (isLite() || reduce) {
      autoRef.current = false;
      setAuto(false);
    }
  }, []);

  // التشغيل حين يدخل الشاشة والإيقاف حين يخرج منها
  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (es) => {
        const e = es[0];
        if (!e) return;
        // يبدأ حين يظهر نصفه، ولا يتوقّف إلا حين يبقى أقل من ربعه (حتى لا
        // يتذبذب عند حدود الشاشة)، وبعد التشغيل اليدوي لا يتوقّف إلا بخروجه كلّيًا
        if (e.intersectionRatio >= 0.5) {
          if (!manual.current) {
            if (!autoRef.current) return;
            // React يضبط muted خاصيّةً لا سمةً؛ نؤكّدها قبل التشغيل التلقائي
            v.muted = true;
          }
          v.play().catch(() => {});
        } else if (e.intersectionRatio === 0 || (!manual.current && e.intersectionRatio < 0.25)) {
          v.pause();
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // إخفاء التبويب يوقف الفيديو (المتصفح لا يفعل ذلك وحده)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let wasPlaying = false;
    const onVis = () => {
      if (document.hidden) {
        wasPlaying = !v.paused;
        v.pause();
      } else if (wasPlaying) {
        v.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // عنصر آخر في الصفحة شغّل صوته: نكتم الفيديو
  useEffect(() => {
    const onFocus = (e: Event) => {
      const owner = (e as CustomEvent<SoundOwner>).detail;
      const v = video.current;
      if (owner !== OWNER && v && !v.muted) {
        v.muted = true;
        setMuted(true);
      }
    };
    window.addEventListener(SOUND_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(SOUND_FOCUS_EVENT, onFocus);
  }, []);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    manual.current = true;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    manual.current = true;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next) {
      claimSound(OWNER);
      if (v.paused) v.play().catch(() => {});
    }
  };

  return (
    <figure className="launch-video">
      <div ref={box} className="launch-stage" data-playing={playing || undefined}>
        <video
          ref={video}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          loop
          playsInline
          preload={auto ? 'metadata' : 'none'}
          disablePictureInPicture
          aria-label="فيديو إطلاق منصّة مناهج قطر التفاعلية"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={togglePlay}
        />

        {/* زرّ التشغيل الكبير في الوسط حين يكون الفيديو متوقفًا */}
        {!playing && (
          <button type="button" className="launch-play" onClick={togglePlay} aria-label="تشغيل الفيديو">
            <Play className="h-7 w-7" aria-hidden />
          </button>
        )}

        {/* تلميح: يعمل بلا صوت */}
        {playing && muted && (
          <button type="button" className="launch-chip" onClick={toggleSound}>
            <VolumeX className="h-4 w-4" aria-hidden />
            بدون صوت • اضغط لتشغيله
          </button>
        )}

        <div className="launch-controls">
          <button
            type="button"
            className="launch-ctl"
            onClick={togglePlay}
            aria-label={playing ? 'إيقاف الفيديو مؤقتًا' : 'تشغيل الفيديو'}
          >
            {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
          </button>
          <button
            type="button"
            className={muted ? 'launch-ctl' : 'launch-ctl is-on'}
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      <figcaption className="launch-caption">
        <strong>فيديو الإطلاق</strong> • ثلاثون ثانية تعرّفك بالمنصّة
      </figcaption>
    </figure>
  );
}
