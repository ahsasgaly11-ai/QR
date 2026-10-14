'use client';

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// إشارة مضمَّنة من يوتيوب (قواميس مؤسسية تنشر مقاطعها على قناتها الرسمية).
// يُضمَّن المقطع بوضع الخصوصية المحسّن (youtube-nocookie) بلا أزرار ولا مقترحات،
// ويُبلّغ عن انتهائه عبر رسائل مشغّل يوتيوب (postMessage) ليتقدّم المشغّل
// للإشارة التالية؛ مع مهلة احتياطية إن لم تصل الرسالة (مقطع محذوف/شبكة بطيئة).
// ---------------------------------------------------------------------------

const FALLBACK_MS = 9000;

export function SignYouTube({
  id,
  title,
  onEnded,
}: {
  /** معرّف مقطع يوتيوب (11 رمزًا). */
  id: string;
  title: string;
  /** يُستدعى مرّة واحدة عند انتهاء المقطع أو انقضاء المهلة الاحتياطية. */
  onEnded: () => void;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      endedRef.current();
    };
    const timer = setTimeout(finish, FALLBACK_MS);

    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (typeof e.data !== 'string') return;
      try {
        const data = JSON.parse(e.data) as {
          event?: string;
          info?: number | { playerState?: number };
        };
        // 0 = انتهى (YT.PlayerState.ENDED)
        if (data.event === 'onStateChange' && data.info === 0) finish();
        else if (
          data.event === 'infoDelivery' &&
          typeof data.info === 'object' &&
          data.info?.playerState === 0
        )
          finish();
      } catch {
        /* رسائل أخرى من الإطار — نتجاهلها */
      }
    };
    window.addEventListener('message', onMessage);

    // نطلب من مشغّل يوتيوب إرسال أحداث الحالة إلى هذه النافذة (بعد تحميل الإطار،
    // وإلا كانت نافذته لا تزال فارغة بأصل الصفحة فيُرفض الإرسال).
    const listen = () => {
      ref.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'sign-yt', channel: 'widget' }),
        'https://www.youtube-nocookie.com'
      );
    };
    const el = ref.current;
    el?.addEventListener('load', listen);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      el?.removeEventListener('load', listen);
    };
  }, [id]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` +
    `?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1` +
    (origin ? `&origin=${encodeURIComponent(origin)}` : '');

  return (
    <iframe
      key={id}
      ref={ref}
      src={src}
      title={`إشارة: ${title}`}
      allow="autoplay; encrypted-media"
      referrerPolicy="strict-origin-when-cross-origin"
      className="h-full w-full border-0 bg-black"
    />
  );
}
