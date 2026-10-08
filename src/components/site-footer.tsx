import Link from 'next/link';
import Image from 'next/image';
import { SITE_NAME } from '@/lib/site';
import { DownloadsSwitch } from './downloads-switch';

const LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/browse', label: 'تصفّح المناهج' },
  { href: '/dashboard', label: 'لوحة الإحصاءات' },
  { href: '/admin', label: 'رفع نشاط جديد' },
  { href: '/privacy', label: 'سياسة الخصوصية' },
];

// نخلة بسيطة: جذع مائل وسعفات — تُرسم بلون خط الأفق نفسه
function Palm({ x, h = 1 }: { x: number; h?: number }) {
  return (
    <g transform={`translate(${x} 110) scale(${h})`}>
      <path d="M-2 0q4-26-1-48h4q6 22 1 48z" />
      <path d="M0-48c-10-10-22-9-28-2 10-4 18-3 28 2zM0-48c10-10 22-9 28-2-10-4-18-3-28 2zM0-48c-6-14-16-19-24-17 10 1 18 8 24 17zM0-48c6-14 16-19 24-17-10 1-18 8-24 17zM0-48c-1-12 1-22 5-26-1 9-1 17-5 26z" />
    </g>
  );
}

// خط أفق الدوحة: سوق واقف بالبراجيل، متحف الفن الإسلامي، سفينة شراعية،
// أبراج الخليج الغربي، مسجد بقباب ومئذنة، ثم نخيل الكورنيش.
function DohaSkyline() {
  const cren = Array.from({ length: 8 }, (_, i) => 4 + i * 15);
  return (
    <svg
      className="doha-skyline"
      viewBox="0 0 1280 110"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      fill="currentColor"
    >
      {/* سوق واقف */}
      <path d="M0 110V74h124v36z" />
      {cren.map((x) => (
        <rect key={x} x={x} y="67" width="8" height="8" />
      ))}
      <rect x="66" y="38" width="30" height="37" />
      <rect x="62" y="33" width="38" height="6" />
      <g fill="var(--paper)">
        <rect x="71" y="44" width="4" height="22" />
        <rect x="79" y="44" width="4" height="22" />
        <rect x="87" y="44" width="4" height="22" />
      </g>
      <path d="M134 110V84h104v26z" />
      <rect x="196" y="56" width="24" height="29" />
      <rect x="192" y="51" width="32" height="6" />
      <g fill="var(--paper)">
        <rect x="201" y="61" width="3.5" height="18" />
        <rect x="208" y="61" width="3.5" height="18" />
        <rect x="160" y="92" width="10" height="18" rx="5" />
      </g>

      {/* متحف الفن الإسلامي */}
      <path d="M296 110V82h150v28z" />
      <path d="M318 82V64h106v18z" />
      <path d="M344 64V42h54v22z" />
      <path d="M360 42V26h22v16z" />
      <path fill="var(--paper)" d="M364 52a7 7 0 0 1 14 0v6h-14z" />

      {/* الماء والسفينة الشراعية */}
      <rect x="446" y="104" width="170" height="6" />
      <path d="M478 100h84l-13 8h-58z" />
      <path d="M519 98V58" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M521 60c22 12 30 26 32 38h-32z" />
      <path d="M517 70c-12 8-17 18-18 28h18z" />

      {/* أبراج الخليج الغربي */}
      <path d="M640 110V32a15 15 0 0 1 30 0v78z" />
      <rect x="653.5" y="4" width="3" height="14" />
      <path d="M686 110l4-50q6-20-4-38h36q-10 18-4 38l4 50z" />
      <rect x="736" y="34" width="22" height="76" />
      <rect x="764" y="52" width="30" height="58" />
      <path d="M802 110V42l14-20 14 20v68z" />
      <rect x="838" y="62" width="26" height="48" />
      <rect x="870" y="76" width="34" height="34" />

      {/* مسجد بقباب ومئذنة */}
      <path d="M922 110V44l5-12 5 12v66z" />
      <rect x="918" y="60" width="18" height="4" />
      <path d="M944 110V88a28 28 0 0 1 56 0v22z" />
      <path d="M1004 110V96a13 13 0 0 1 26 0v14z" />
      <rect x="970" y="52" width="4" height="10" />

      {/* نخيل الكورنيش */}
      <Palm x={1078} h={1.05} />
      <Palm x={1132} h={0.8} />
      <Palm x={1186} h={1.15} />
      <Palm x={1244} h={0.9} />

      <rect x="0" y="106" width="1280" height="4" />
    </svg>
  );
}

// التذييل داكن في الوضعين، فذهبيّه ثابت (#ecd9a6) ولا يتبع رمز --gold-200
// الذي يُعتَّم في الوضع الليلي.
export function SiteFooter() {
  return (
    <footer className="relative mt-24 text-white/90">
      <DohaSkyline />
      <div className="bg-[color:var(--maroon-800)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-6 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white p-1.5">
                <Image
                  src="/images/moehe-mark.png"
                  alt="شعار الوزارة"
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              </div>
              <div>
                <p className="font-display text-lg font-extrabold leading-snug">{SITE_NAME}</p>
                <p className="text-xs text-white/70">
                  وزارة التربية والتعليم والتعليم العالي — دولة قطر
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-7 text-white/75">
              منصة تعليمية تفاعلية تجمع التجارب العملية والمحاكاة والأسئلة بصيغة
              تفاعلية، يمكن للطلبة تجربتها مباشرة
              <DownloadsSwitch on=" أو تحميلها لاستخدامها دون اتصال" off=" من الموقع" />.
            </p>
          </div>

          <div>
            <h2 className="mb-4 font-display text-sm font-extrabold text-[#ecd9a6]">
              روابط سريعة
            </h2>
            <ul className="space-y-2 text-sm text-white/80">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-display text-sm font-extrabold text-[#ecd9a6]">
              رؤية قطر الوطنية 2030
            </h2>
            <p className="text-sm leading-7 text-white/75">
              نُسهم في بناء التنمية البشرية من خلال تعليم رقمي إبداعي يواكب أحدث
              التقنيات ويعزّز حبّ الاستكشاف لدى المتعلّمين.
            </p>
          </div>
        </div>

        {/* اعتماد التصميم */}
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-6 py-5 text-center">
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
              <span className="text-white/60">تصميم</span>
              <span className="font-display font-bold text-[#ecd9a6]">
                الأستاذ عبداللطيف الذهلي
              </span>
            </p>
          </div>
        </div>

        <div className="sadu-band" aria-hidden />

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-white/65 sm:flex-row">
          <p>© {new Date().getFullYear()} وزارة التربية والتعليم والتعليم العالي — جميع الحقوق محفوظة.</p>
          <p>صُمّمت بروح المناهج القطرية</p>
        </div>
      </div>
    </footer>
  );
}
