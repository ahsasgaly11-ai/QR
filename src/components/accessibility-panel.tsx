'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  X,
  Sun,
  Moon,
  Contrast,
  Type,
  BookOpenText,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// لوحة إمكانية الوصول (Accessibility)
// تتبع نفس آلية الوضع الليلي: سمات على <html> + حفظ في localStorage + سكربت
// قبل الرسم (في layout) لمنع الوميض. كل الإعدادات تعمل مع قارئ الشاشة
// ولوحة المفاتيح، وتُطبَّق فورًا على كامل الموقع.
//
//   data-theme    = light | dark        (الوضع الليلي — مشترك مع زر الهيدر)
//   data-contrast = normal | high       (التباين العالي)
//   data-reading  = normal | comfort    (القراءة الميسّرة لعُسر القراءة)
//   data-text     = base | lg | xl      (حجم الخط)
//   data-motion   = auto | reduce       (تقليل الحركة)
// ---------------------------------------------------------------------------

type Attr = 'theme' | 'contrast' | 'reading' | 'text' | 'motion';

const STORE: Record<Attr, string> = {
  theme: 'qa-theme',
  contrast: 'qa-a11y-contrast',
  reading: 'qa-a11y-reading',
  text: 'qa-a11y-text',
  motion: 'qa-a11y-motion',
};

const DEFAULTS: Record<Attr, string> = {
  theme: 'light',
  contrast: 'normal',
  reading: 'normal',
  text: 'base',
  motion: 'auto',
};

function readAttr(a: Attr): string {
  if (typeof document === 'undefined') return DEFAULTS[a];
  return document.documentElement.getAttribute(`data-${a}`) || DEFAULTS[a];
}

function applyAttr(a: Attr, value: string) {
  const root = document.documentElement;
  root.setAttribute(`data-${a}`, value);
  if (a === 'theme') root.classList.toggle('dark', value === 'dark');
  try {
    localStorage.setItem(STORE[a], value);
  } catch {
    /* ignore */
  }
}

export function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<Record<Attr, string>>(DEFAULTS);
  const [announce, setAnnounce] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setState({
      theme: readAttr('theme'),
      contrast: readAttr('contrast'),
      reading: readAttr('reading'),
      text: readAttr('text'),
      motion: readAttr('motion'),
    });
    // زامن اللوحة مع زر الهيدر إن غيّر الوضع الليلي
    const obs = new MutationObserver(() =>
      setState((s) => ({ ...s, theme: readAttr('theme') }))
    );
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  const set = useCallback((a: Attr, value: string, label: string) => {
    applyAttr(a, value);
    setState((s) => ({ ...s, [a]: value }));
    setAnnounce(label);
  }, []);

  const reset = useCallback(() => {
    (Object.keys(DEFAULTS) as Attr[]).forEach((a) => applyAttr(a, DEFAULTS[a]));
    setState({ ...DEFAULTS });
    setAnnounce('تمت إعادة ضبط إعدادات الوصول');
  }, []);

  // إغلاق بمفتاح Esc + حصر التركيز داخل اللوحة
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // انقل التركيز إلى أول عنصر داخل اللوحة
    const t = setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('button, [href], input')
        ?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  const dark = state.theme === 'dark';

  const Segment = ({
    attr,
    options,
    labelId,
  }: {
    attr: Attr;
    labelId: string;
    options: { value: string; label: string; hint?: string }[];
  }) => (
    <div
      role="group"
      aria-labelledby={labelId}
      className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] p-1.5"
    >
      {options.map((o) => {
        const active = state[attr] === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => set(attr, o.value, `${o.label}`)}
            className={cn(
              'rounded-xl px-2 py-2 text-sm font-bold transition',
              active
                ? 'bg-[color:var(--maroon)] text-white shadow-[var(--shadow-sm)]'
                : 'text-foreground/75 hover:bg-[color:var(--surface)]'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const Toggle = ({
    attr,
    onValue,
    offValue,
    label,
    desc,
    icon: Icon,
  }: {
    attr: Attr;
    onValue: string;
    offValue: string;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const on = state[attr] === onValue;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() =>
          set(attr, on ? offValue : onValue, `${label}: ${on ? 'مُعطَّل' : 'مُفعَّل'}`)
        }
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition',
          on
            ? 'border-[color:var(--maroon)] bg-[color:var(--maroon-100)]'
            : 'border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] hover:border-[color:var(--gold)]'
        )}
      >
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            on ? 'bg-[color:var(--maroon)] text-white' : 'bg-[color:var(--surface)] text-[color:var(--maroon)]'
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[color:var(--ink)]">{label}</span>
          <span className="block text-xs font-medium text-muted-foreground">{desc}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition',
            on ? 'bg-[color:var(--maroon)]' : 'bg-[color:var(--hairline-strong)]'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all',
              on ? 'right-0.5' : 'right-[22px]'
            )}
          >
            {on && <Check className="h-3 w-3 text-[color:var(--maroon)]" />}
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      {/* الزرّ العائم — لسان مثبّت على الحافّة اليسرى (مكان متعارف عليه لأدوات
          الوصول ولا يتعارض مع المها أسفل اليسار أو زر التواصل أسفل اليمين) */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="إعدادات إمكانية الوصول"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed left-0 top-1/2 z-[95] grid -translate-y-1/2 place-items-center rounded-l-none rounded-r-2xl border-2 border-l-0 border-[color:var(--gold)] bg-[color:var(--maroon)] text-white shadow-[var(--shadow-lg)] transition hover:pr-4 focus-visible:pr-4 print:hidden"
        style={{ height: 56, width: 48 }}
      >
        <Accessibility className="h-6 w-6" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[96] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="إعدادات إمكانية الوصول"
            className="fixed left-1/2 top-1/2 z-[97] max-h-[88vh] w-[min(94vw,23rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border-2 border-[color:var(--gold)]/50 bg-[color:var(--surface)] p-4 shadow-[var(--shadow-lg)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-black text-[color:var(--maroon)]">
                <Accessibility className="h-5 w-5" />
                إمكانية الوصول
              </h2>
              <button
                onClick={() => {
                  setOpen(false);
                  btnRef.current?.focus();
                }}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-xl text-[color:var(--maroon)] hover:bg-[color:var(--surface-2)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* حجم الخط */}
            <div className="mb-4">
              <p
                id="a11y-text-label"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-[color:var(--ink)]"
              >
                <Type className="h-4 w-4 text-[color:var(--gold)]" /> حجم الخط
              </p>
              <Segment
                attr="text"
                labelId="a11y-text-label"
                options={[
                  { value: 'base', label: 'عادي' },
                  { value: 'lg', label: 'كبير' },
                  { value: 'xl', label: 'أكبر' },
                ]}
              />
            </div>

            {/* المفاتيح */}
            <div className="space-y-2.5">
              <Toggle
                attr="theme"
                onValue="dark"
                offValue="light"
                label={dark ? 'الوضع الليلي' : 'الوضع الليلي'}
                desc="خلفية داكنة أرفق بالعين"
                icon={dark ? Moon : Sun}
              />
              <Toggle
                attr="contrast"
                onValue="high"
                offValue="normal"
                label="تباين عالٍ"
                desc="ألوان قوية وحدود واضحة"
                icon={Contrast}
              />
              <Toggle
                attr="reading"
                onValue="comfort"
                offValue="normal"
                label="قراءة ميسّرة"
                desc="تباعد أوسع للأسطر والكلمات (عُسر القراءة)"
                icon={BookOpenText}
              />
              <Toggle
                attr="motion"
                onValue="reduce"
                offValue="auto"
                label="تقليل الحركة"
                desc="إيقاف الحركات والانتقالات"
                icon={Sparkles}
              />
            </div>

            <button
              onClick={reset}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] px-4 py-2.5 text-sm font-bold text-[color:var(--maroon)] transition hover:bg-[color:var(--surface)]"
            >
              <RotateCcw className="h-4 w-4" /> إعادة الضبط
            </button>
          </div>
        </>
      )}

      {/* إعلان للتقنيات المساعدة عند تغيير أي إعداد */}
      <div className="sr-only" role="status" aria-live="polite">
        {mounted ? announce : ''}
      </div>
    </>
  );
}
