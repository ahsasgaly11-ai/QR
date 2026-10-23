'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Home, RotateCcw } from 'lucide-react';
import { OryxMascot } from '@/components/oryx-mascot';

// ---------------------------------------------------------------------------
// حدّ الأخطاء للصفحات: بدل رسالة Next.js الإنجليزية الصامتة («Application error…»)
// التي لا تقول ما الخطأ، تُعرض رسالة عربية مع نصّ الخطأ نفسه ورمزه (digest) وزرّ
// نسخ، فيستطيع المعلّم إرسالها للمطوّر بلقطة شاشة بدل فتح وحدة التحكّم (غير
// متاحة على الآيباد)، وزرّ «أعد المحاولة» يعيد تصيير الصفحة بلا تحديث.
// ---------------------------------------------------------------------------
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);
  const [path, setPath] = useState('');

  useEffect(() => {
    setPath(location.pathname + location.search);
    console.error('[site] client error', error);
  }, [error]);

  const details = [
    `الصفحة: ${path}`,
    `الخطأ: ${error?.name || 'Error'}: ${error?.message || ''}`,
    error?.digest ? `الرمز: ${error.digest}` : '',
    `المتصفّح: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    error?.stack ? `\n${error.stack.split('\n').slice(0, 6).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* الحافظة غير متاحة: النص ظاهر على الشاشة للتصوير */
    }
  }

  return (
    <section className="door-wall border-t-0">
      <div className="relative mx-auto max-w-4xl px-5 py-10 sm:px-6 lg:py-16">
        <div className="grid items-start gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
          <OryxMascot className="mx-auto h-28 w-auto sm:h-36" />
          <div className="text-center md:text-start">
            <p className="kicker">حدث خطأ في الصفحة</p>
            <h1 className="mt-2 font-calli text-[2.2rem] leading-[1.4] text-foreground sm:text-4xl">تعثّرت هذه الصفحة لحظة</h1>
            <p className="mx-auto mt-3 max-w-xl text-[1.02rem] leading-8 text-[color:var(--ink-2)] md:mx-0">
              جرّب «أعد المحاولة». وإن تكرّر الخطأ، صوّر هذه الشاشة أو انسخ التفاصيل أدناه وأرسلها إلى المطوّر، ففيها ما يلزم
              لمعرفة السبب.
            </p>
            <pre
              dir="ltr"
              className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--surface)] p-4 text-start text-xs leading-6 text-[color:var(--ink-2)]"
            >
              {details}
            </pre>
            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              <button type="button" onClick={reset} className="btn-primary px-6">
                <RotateCcw className="h-5 w-5" /> أعد المحاولة
              </button>
              <button type="button" onClick={() => void copy()} className="btn-ghost px-5">
                <Copy className="h-5 w-5" /> {copied ? 'نُسخت التفاصيل' : 'نسخ التفاصيل'}
              </button>
              <Link href="/" className="btn-ghost px-5">
                <Home className="h-5 w-5" /> الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
