'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { isLite } from '@/lib/perf';
import { SOUND_FOCUS_EVENT, claimSound, type SoundOwner } from '@/components/home/sound-focus';

// ---------------------------------------------------------------------------
// عرض «نسيج المجتمع القطري» في الصفحة الرئيسية.
//
// • العرض ملف ثابت في public/naseej يعمل وحده داخل iframe من النطاق نفسه:
//   يبدأ تلقائيًا ويمرّ على المشاهد الخمسة بالترتيب — ينجز مهامّ كل مشهد،
//   ثم تظهر القيمة المستفادة، ثم ينتقل إلى المشهد التالي، ويتكرر باستمرار.
// • الموسيقى تعمل باستمرار ما دامت الصفحة مفتوحة، مع زرّ لإيقافها وتشغيلها
//   (يُحفظ الاختيار). المتصفحات تمنع الصوت قبل أول لمسة من الزائر، لذا
//   تُشغَّل الموسيقى عند أول نقرة أو لمسة أو ضغطة مفتاح في أي مكان من الصفحة.
// • يتوقّف الرسم ثلاثي الأبعاد مؤقتًا حين يخرج العرض من الشاشة توفيرًا
//   لأجهزة المدارس، ويُكمل من حيث توقّف عند العودة إليه.
// • يُكتم تلقائيًا حين يشغّل الزائر صوت فيديو الإطلاق المجاور، والعكس
//   (sound-focus)، حتى لا تتداخل الموسيقيان.
// ---------------------------------------------------------------------------

type AudioState = { muted: boolean; playing: boolean };
type NaseejApi = {
  play: () => void;
  setMute: (m: boolean) => void;
  state: () => AudioState;
  pause: (p: boolean) => void;
};

const SRC = '/naseej/index.html';
const OWNER: SoundOwner = 'naseej';

export function NaseejShow() {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [audio, setAudio] = useState<AudioState>({ muted: false, playing: false });

  const api = useCallback((): NaseejApi | null => {
    try {
      return (frame.current?.contentWindow as (Window & { naseej?: NaseejApi }) | null)?.naseej ?? null;
    } catch {
      return null;
    }
  }, []);

  // يُحمَّل العرض حين يقترب من الشاشة (وهو تحت الواجهة مباشرة فيُحمَّل سريعًا)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const url = `${SRC}?embed=1${isLite() ? '&lite=1' : ''}`;
    if (!('IntersectionObserver' in window)) {
      setSrc(url);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSrc(url);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // حالة الصوت تصل من داخل العرض
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'naseej-audio') setAudio(e.data.state as AudioState);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // أي تفاعل في الصفحة يشغّل الموسيقى إن كانت متوقفة بسياسة التشغيل التلقائي
  // (لا يُعيدها إن أوقفها الزائر بالزر)
  useEffect(() => {
    if (!src) return;
    const evs = ['pointerdown', 'keydown', 'touchend'] as const;
    const kick = () => {
      const s = api()?.state();
      if (s && !s.muted && !s.playing) api()?.play();
    };
    evs.forEach((ev) => window.addEventListener(ev, kick, true));
    return () => evs.forEach((ev) => window.removeEventListener(ev, kick, true));
  }, [src, api]);

  // إيقاف الرسم مؤقتًا خارج الشاشة (الموسيقى تستمر)
  useEffect(() => {
    const el = box.current;
    if (!el || !src || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => {
      const visible = es.some((e) => e.isIntersecting);
      frame.current?.contentWindow?.postMessage({ type: 'naseej-visible', visible }, location.origin);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  // عنصر آخر في الصفحة (فيديو الإطلاق) شغّل صوته: نكتم الموسيقى
  useEffect(() => {
    const onFocus = (e: Event) => {
      if ((e as CustomEvent<SoundOwner>).detail === OWNER) return;
      const a = api();
      if (!a) return;
      a.setMute(true);
      setAudio(a.state());
    };
    window.addEventListener(SOUND_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(SOUND_FOCUS_EVENT, onFocus);
  }, [api]);

  const toggleSound = () => {
    const a = api();
    if (!a) return;
    const s = a.state();
    if (s.muted) a.setMute(false);
    else if (!s.playing) a.play();
    else a.setMute(true);
    const next = a.state();
    if (next.playing && !next.muted) claimSound(OWNER);
    setAudio(next);
  };

  const fullscreen = () => {
    const el = box.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else el.webkitRequestFullscreen?.();
    } catch {}
  };

  const soundOn = audio.playing && !audio.muted;
  const waiting = !audio.muted && !audio.playing;

  return (
    <div className="naseej-show">
      <div ref={box} className="naseej-stage">
        {src ? (
          <iframe
            ref={frame}
            src={src}
            title="عرض نسيج المجتمع القطري"
            allow="autoplay; fullscreen"
            allowFullScreen
            className="naseej-frame"
          />
        ) : (
          <div className="naseej-frame naseej-placeholder" aria-hidden />
        )}
        {src && waiting && (
          <button type="button" className="naseej-hint" onClick={toggleSound}>
            <Volume2 className="h-5 w-5" aria-hidden />
            المس الشاشة لتشغيل الموسيقى
          </button>
        )}
      </div>

      <div className="naseej-dock" role="toolbar" aria-label="التحكّم في عرض النسيج">
        <button
          type="button"
          onClick={toggleSound}
          className={`naseej-ctl${soundOn ? ' is-on' : ''}`}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى'}
          disabled={!src}
        >
          <span className="naseej-ctl-icon" aria-hidden>
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </span>
          <span className="naseej-ctl-text">
            <span className="naseej-ctl-label">الموسيقى</span>
            <span className="naseej-ctl-sub">
              {soundOn ? (
                <>
                  <span className="naseej-eq" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  تعمل الآن
                </>
              ) : (
                'متوقفة'
              )}
            </span>
          </span>
        </button>
        <button type="button" onClick={fullscreen} className="naseej-ctl" disabled={!src}>
          <span className="naseej-ctl-icon" aria-hidden>
            <Maximize2 className="h-5 w-5" />
          </span>
          <span className="naseej-ctl-text">
            <span className="naseej-ctl-label">ملء الشاشة</span>
            <span className="naseej-ctl-sub">عرض أكبر</span>
          </span>
        </button>
        <a href={SRC} target="_blank" rel="noopener" className="naseej-ctl">
          <span className="naseej-ctl-icon" aria-hidden>
            <ExternalLink className="h-5 w-5" />
          </span>
          <span className="naseej-ctl-text">
            <span className="naseej-ctl-label">صفحة مستقلة</span>
            <span className="naseej-ctl-sub">في نافذة جديدة</span>
          </span>
        </a>
      </div>
    </div>
  );
}
