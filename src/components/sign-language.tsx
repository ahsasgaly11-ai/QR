'use client';

import { useEffect, useRef, useState } from 'react';
import { Hand, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// رفيق لغة الإشارة القطرية
// زرّ يفتح نافذة عائمة (Picture-in-Picture) تعرض مقطع الشرح بلغة الإشارة
// المرفق بالنشاط. عند غياب مقطع، تظهر رسالة لبقة تشرح الميزة وكيف تُضيف
// الوزارة المقاطع لاحقًا (يكفي تعبئة الحقل signLang للنشاط) — دون تلفيق محتوى.
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
  className,
}: {
  src?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

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

  const embed = src ? toEmbed(src) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'flex items-center gap-1.5 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 px-3 py-2 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10',
          className
        )}
        title="شرح النشاط بلغة الإشارة"
      >
        <Hand className="h-4 w-4" /> لغة الإشارة
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="شرح النشاط بلغة الإشارة القطرية"
          className="fixed bottom-4 left-4 z-[110] w-[min(92vw,22rem)] overflow-hidden rounded-2xl border-2 border-[color:var(--gold)]/60 bg-[color:var(--surface)] shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center justify-between gap-2 bg-[color:var(--maroon)] px-3 py-2 text-white">
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Hand className="h-4 w-4" /> لغة الإشارة
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

          {embed ? (
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
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--maroon-100)] text-[color:var(--maroon)]">
                <Info className="h-6 w-6" />
              </span>
              <p className="text-sm font-black text-[color:var(--ink)]">
                لا يتوفّر شرح بلغة الإشارة لهذا النشاط بعد.
              </p>
              <p className="text-xs font-medium leading-6 text-muted-foreground">
                هذه الميزة جاهزة: عند إضافة مقطع لغة الإشارة القطرية للنشاط
                (من لوحة الإدارة) سيظهر هنا تلقائيًا لخدمة الطلبة الصمّ وضعاف
                السمع.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
