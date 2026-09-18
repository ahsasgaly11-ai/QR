import Link from 'next/link';
import { Home } from 'lucide-react';
import { OryxMascot } from '@/components/oryx-mascot';
import { BackButton } from '@/components/back-button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <div className="mb-8 self-start">
        <BackButton fallback="/" />
      </div>
      <OryxMascot className="h-40 w-auto float-mid" />
      <h1 className="mt-6 font-calli text-6xl font-bold text-gradient-maroon">404</h1>
      <p className="mt-3 text-lg font-bold text-foreground">
        لم نعثر على هذه الصفحة
      </p>
      <p className="mt-2 text-muted-foreground">
        ربما انتقل النشاط أو تغيّر الرابط. لنعُد إلى نقطة البداية ونستكشف من جديد.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--maroon)] px-7 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-1 hover:bg-[color:var(--maroon-700)]"
      >
        <Home className="h-5 w-5" /> العودة للرئيسية
      </Link>
    </div>
  );
}
