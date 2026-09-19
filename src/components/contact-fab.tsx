'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircleMore, Phone, X } from 'lucide-react';

/** رقم التواصل — مصدر واحد تُشتقّ منه كل الروابط. */
const PHONE_E164 = '+97470776067';
const PHONE_DIGITS = PHONE_E164.replace(/\D/g, '');
const PHONE_PRETTY = '+974 7077 6067';

/** شعار واتساب الرسمي (مسار واحد، 24×24) — يبقى بلونه الأخضر المعروف. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/**
 * زرّ «التواصل» العائم أسفل الصفحة.
 * بالنقر تنفتح بطاقة فيها شعار واتساب ورقم الهاتف مع روابط مباشرة
 * (فتح واتساب، اتصال، نسخ الرقم). موضعه على اليمين لأن التميمة على اليسار.
 */
export function ContactFab() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // الإغلاق بالنقر خارج البطاقة أو بمفتاح Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_E164);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* بعض المتصفحات تمنع الحافظة دون تفاعل مباشر */
    }
  };

  return (
    <div ref={wrapRef} className="fixed bottom-4 right-4 z-50 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="بيانات التواصل"
          className="absolute bottom-[72px] right-0 w-[min(86vw,20rem)] origin-bottom-right animate-[contact-pop_.22s_cubic-bezier(.22,1,.36,1)] overflow-hidden rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--surface)] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 bg-[color:var(--maroon)] px-4 py-3 text-white">
            <p className="font-display text-sm font-black">تواصل معنا</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="rounded-lg p-1 transition hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30">
                <WhatsAppGlyph className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground">واتساب</p>
                <p
                  dir="ltr"
                  className="text-right font-display text-lg font-black tabular-nums text-[color:var(--maroon)]"
                >
                  {PHONE_PRETTY}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <a
                href={`https://wa.me/${PHONE_DIGITS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white transition hover:brightness-95"
              >
                <WhatsAppGlyph className="h-4 w-4" /> مراسلة عبر واتساب
              </a>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${PHONE_E164}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--gold)]/40 px-3 py-2.5 text-sm font-black text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
                >
                  <Phone className="h-4 w-4" /> اتصال
                </a>
                <button
                  onClick={copy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--gold)]/40 px-3 py-2.5 text-sm font-black text-[color:var(--maroon)] transition hover:bg-[color:var(--gold)]/10"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> نسخ الرقم
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="التواصل"
        className="group flex items-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--maroon)] py-3 pe-4 ps-3.5 text-white shadow-xl shadow-[color:var(--maroon)]/25 transition hover:bg-[color:var(--maroon-700)] active:scale-95"
      >
        <MessageCircleMore className="h-6 w-6" />
        <span className="font-display text-sm font-black">التواصل</span>
      </button>
    </div>
  );
}
