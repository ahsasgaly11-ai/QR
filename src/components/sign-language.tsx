'use client';

import { useEffect, useRef, useState } from 'react';
import { Hand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SIGN_LANG_ATTR, isSignLanguageOn } from '@/lib/sign-language';
import { SignLanguagePlayer } from './sign-language-player';

// ---------------------------------------------------------------------------
// رفيق لغة الإشارة القطرية
// نافذة عائمة (Picture-in-Picture) تخدم الطلبة الصمّ وضعاف السمع بطريقتين:
//   • «الترجمة التلقائية»: محرّك يقرأ عنوان النشاط ووصفه ويعرضهما إشارةً إشارة
//     من قاموس موثّق — يتعرّف على كل نشاط تلقائيًّا دون أي إعداد لكلٍّ على حدة.
//   • «فيديو الشرح»: مقطع بشري مرفَق بالنشاط (إن أضافته الوزارة) — أدقّ عرض.
//
// الخيار متاح تلقائيًا على كل نشاط. ومن فعّل «لغة الإشارة القطرية» من لوحة
// إمكانية الوصول يُفتح له الرفيق تلقائيًا عند فتح أي نشاط (data-signlang).
// ---------------------------------------------------------------------------

function toEmbed(url: string): { kind: 'video' | 'iframe'; src: string } {
  const u = url.trim();
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: 'video', src: u };
}

export function SignLanguageButton({
  src,
  title,
  description,
  className,
}: {
  /** رابط مقطع الشرح البشري المرفَق بالنشاط (اختياري). */
  src?: string;
  /** عنوان النشاط — مصدر الترجمة التلقائية. */
  title?: string;
  /** وصف النشاط — يُضاف لنصّ الترجمة التلقائية. */
  description?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preferOn, setPreferOn] = useState(false);
  const [tab, setTab] = useState<'auto' | 'video'>('auto');
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const embed = src ? toEmbed(src) : null;
  const autoText = [title, description].filter(Boolean).join('. ');

  // عند وجود فيديو بشري نبدأ به (أدقّ عرض)، وإلا بالترجمة التلقائية.
  useEffect(() => {
    setTab(embed ? 'video' : 'auto');
  }, [embed]);

  // من فعّل الخيار من لوحة الوصول يُفتح له الرفيق تلقائيًا عند فتح النشاط،
  // ويظل يتابع تغيّر الإعداد فيُفتح عند التفعيل ويُغلق عند الإيقاف.
  useEffect(() => {
    const sync = () => {
      const on = isSignLanguageOn();
      setPreferOn(on);
      setOpen(on);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [`data-${SIGN_LANG_ATTR}`],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  const showVideo = tab === 'video' && embed;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-pressed={preferOn}
        className={cn(
          'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition',
          preferOn
            ? 'border-[color:var(--maroon)] bg-[color:var(--maroon-100)] text-[color:var(--maroon)]'
            : 'border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 text-[color:var(--maroon)] hover:bg-[color:var(--gold)]/10',
          className
        )}
        title="شرح النشاط بلغة الإشارة"
      >
        <Hand className="h-4 w-4" /> لغة الإشارة
        {preferOn && (
          <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--maroon)]" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="شرح النشاط بلغة الإشارة القطرية"
          className="fixed bottom-4 left-4 z-[110] w-[min(94vw,24rem)] overflow-hidden rounded-2xl border-2 border-[color:var(--gold)]/60 bg-[color:var(--surface)] shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center justify-between gap-2 bg-[color:var(--maroon)] px-3 py-2 text-white">
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Hand className="h-4 w-4" /> لغة الإشارة القطرية
            </span>
            <button
              ref={closeRef}
              onClick={() => setOpen(false)}
              aria-label="إغلاق نافذة لغة الإشارة"
              className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* مبدّل الوضعَين — يظهر فقط عند وجود فيديو شرح بشري */}
          {embed && (
            <div className="grid grid-cols-2 gap-1 bg-[color:var(--surface-2)] p-1">
              {(
                [
                  ['auto', 'الترجمة التلقائية'],
                  ['video', 'فيديو الشرح'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  aria-pressed={tab === key}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs font-black transition',
                    tab === key
                      ? 'bg-[color:var(--maroon)] text-white shadow-sm'
                      : 'text-[color:var(--maroon)] hover:bg-[color:var(--surface)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {showVideo ? (
            embed.kind === 'video' ? (
              <video
                src={embed.src}
                controls
                autoPlay
                className="aspect-video w-full bg-black"
              >
                عذرًا، متصفّحك لا يدعم تشغيل الفيديو.
              </video>
            ) : (
              <iframe
                src={embed.src}
                title="شرح بلغة الإشارة القطرية"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full bg-black"
              />
            )
          ) : (
            <SignLanguagePlayer text={autoText} />
          )}
        </div>
      )}
    </>
  );
}
