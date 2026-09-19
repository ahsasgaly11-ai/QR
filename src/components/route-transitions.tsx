'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// تنقّلات سينمائية بين الصفحات عبر View Transitions الأصلية في المتصفّح.
//
// لا مكتبة: المتصفّح يلتقط صورة الصفحة الحالية، ينتظر ظهور الجديدة، ثم
// ينتقل بينهما على بطاقة الرسوم. صفر بايت مضافة على الزائر.
//
// يُلتقط النقر على مستوى المستند مرّة واحدة بدل تعديل كل رابط في الموقع،
// فتنطبق الحركة تلقائيًا على أي رابط جديد يُضاف لاحقًا.
//
// التحدّي الوحيد أن startViewTransition يتوقّع أن يتغيّر DOM داخل دالّته،
// بينما تنقّل Next غير متزامن: نعطيه وعدًا (Promise) لا يُحلّ إلا بعد أن
// يتغيّر المسار فعلًا — فيبقى المتصفّح ممسكًا باللقطة القديمة حتى تجهز
// الصفحة الجديدة.
// ---------------------------------------------------------------------------

type Doc = Document & {
  startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> };
};

function canAnimate() {
  return (
    typeof document !== 'undefined' &&
    typeof (document as Doc).startViewTransition === 'function' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** هل هذا نقر عادي على رابط داخلي نتولّاه نحن؟ */
function internalLink(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;

  const a = (e.target as Element | null)?.closest?.('a[href]') as
    | HTMLAnchorElement
    | null;
  if (!a) return null;
  if (a.target && a.target !== '_self') return null;
  if (a.hasAttribute('download')) return null;

  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  // نفس الصفحة أو مجرّد مرساة داخلها: لا انتقال
  if (url.pathname === location.pathname && url.search === location.search)
    return null;

  return a;
}

export function RouteTransitions({ children }: { children: React.ReactNode }) {
  const pending = useRef<(() => void) | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // وصلت الصفحة الجديدة: أفرج عن الانتقال
  useEffect(() => {
    if (pending.current) {
      pending.current();
      pending.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (!canAnimate()) return;

    const onClick = (e: MouseEvent) => {
      const a = internalLink(e);
      if (!a) return;

      // الالتقاط المبكر يسبق معالج Next للرابط؛ ونُوقف انتشار الحدث حتى
      // لا ينتقل هو أيضًا فيحدث تنقّلان متزامنان يكسران الحركة.
      e.preventDefault();
      e.stopPropagation();
      const href = new URL(a.href, location.href).pathname;

      // عنصر يتحوّل بصريًا إلى نظيره في الصفحة التالية (غلاف اللعبة يكبر
      // ليصبح المشغّل). يُسمّى لحظة النقر فقط لأن الاسم يجب أن يكون فريدًا
      // في الصفحة، ولا يصحّ أن تحمله كل البطاقات معًا.
      const sel = a.dataset.vtMorph;
      const morph = sel
        ? (a.closest('[data-vt-scope]')?.querySelector(sel) as HTMLElement | null)
        : null;
      if (morph) morph.style.viewTransitionName = 'game-stage';

      const vt = (document as Doc).startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            pending.current = resolve;
            router.push(href);
            // شبكة أمان: لو تعذّر التنقّل لا تبقَ الصفحة مجمّدة على اللقطة
            window.setTimeout(() => {
              if (pending.current === resolve) {
                pending.current = null;
                resolve();
              }
            }, 2500);
          })
      );

      vt.finished.finally(() => {
        if (morph) morph.style.viewTransitionName = '';
      });
    };

    // capture: يجب أن نسبق معالج Next وإلا وجدنا الحدث وقد أُلغي مسبقًا
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return <>{children}</>;
}
