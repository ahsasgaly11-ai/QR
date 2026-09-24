'use client';

import { useEffect, useRef, useState } from 'react';
import { Hand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignLanguagePlayer } from './sign-language-player';

// ---------------------------------------------------------------------------
// رفيق لغة الإشارة القطرية — زرّ + لوحة.
//   • على الشاشات الكبيرة: لوحة عائمة (Picture-in-Picture) أسفل اليسار.
//   • على الجوّال (طولي): تُعرَض ضمن تدفّق الصفحة فتدفع اللعبة للأسفل ولا تغطّيها.
// اللوحة تخدم بطريقتين: «الترجمة التلقائية» (الشخصية تؤدّي التهجئة من قاموس
// موثّق/بيانات) و«فيديو الشرح» (مقطع بشري مرفَق بالنشاط إن وُجد).
// حالة الفتح والتفضيل تُدار في المشغّل (activity-player) لضبط الموضع في التدفّق.
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
  active,
  onClick,
  className,
}: {
  /** هل تفضيل لغة الإشارة مُفعَّل؟ (لإظهار حالة الزرّ). */
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition',
        active
          ? 'border-[color:var(--maroon)] bg-[color:var(--maroon-100)] text-[color:var(--maroon)]'
          : 'border-[color:var(--gold)]/40 bg-[color:var(--surface)]/70 text-[color:var(--maroon)] hover:bg-[color:var(--gold)]/10',
        className
      )}
      title="شرح النشاط بلغة الإشارة"
    >
      <Hand className="h-4 w-4" /> لغة الإشارة
      {active && <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--maroon)]" />}
    </button>
  );
}

export function SignLanguagePanel({
  open,
  onClose,
  src,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  /** رابط مقطع الشرح البشري المرفَق بالنشاط (اختياري). */
  src?: string;
  /** عنوان النشاط — مصدر الترجمة التلقائية. */
  title?: string;
  /** وصف النشاط — يُضاف لنصّ الترجمة التلقائية. */
  description?: string;
}) {
  const [tab, setTab] = useState<'auto' | 'video'>('auto');
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const embed = src ? toEmbed(src) : null;
  const autoText = [title, description].filter(Boolean).join('. ');

  // عند وجود فيديو بشري نبدأ به (أدقّ عرض)، وإلا بالترجمة التلقائية.
  useEffect(() => {
    setTab(embed ? 'video' : 'auto');
  }, [embed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const showVideo = tab === 'video' && embed;

  return (
    <div
      role="dialog"
      aria-label="شرح النشاط بلغة الإشارة القطرية"
      className={cn(
        'z-[110] overflow-hidden rounded-2xl border-2 border-[color:var(--gold)]/60 bg-[color:var(--surface)] shadow-[var(--shadow-lg)]',
        // الجوّال: ضمن التدفّق فوق اللعبة (لا تغطية)
        'relative mb-4 w-full',
        // الشاشات الكبيرة: لوحة عائمة أسفل اليسار
        'sm:fixed sm:bottom-[calc(var(--ticker-h)+1rem)] sm:left-4 sm:mb-0 sm:w-[min(94vw,24rem)]'
      )}
    >
      <div className="flex items-center justify-between gap-2 bg-[color:var(--maroon)] px-3 py-2 text-white">
        <span className="flex items-center gap-1.5 text-sm font-black">
          <Hand className="h-4 w-4" /> لغة الإشارة القطرية
        </span>
        <button
          ref={closeRef}
          onClick={onClose}
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
          <video src={embed.src} controls autoPlay className="aspect-video w-full bg-black">
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
  );
}
