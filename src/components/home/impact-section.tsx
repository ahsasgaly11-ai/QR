import { ClipboardCheck, Download, Landmark, Mail, PlayCircle, School, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionHead } from '@/components/home/section-head';
import { ImpactVoices } from '@/components/home/impact-voices';
import { MUNICIPALITIES } from '@/data/qatar-schools';
import type { ImpactSettings } from '@/lib/impact';
import { CONTACT_EMAIL } from '@/lib/site';
import type { MasterySnapshot, ReachSnapshot, SiteTotals } from '@/lib/stats-server';
import { formatFull } from '@/lib/utils';

type Figure = {
  icon: LucideIcon;
  value: number;
  label: string;
  note: string;
  tone: string;
  /** يُعرض الرقم نسبة مئوية (مثل الإتقان) بدل عدد. */
  suffix?: string;
};

/**
 * قسم «أثر التعلّم» في الصفحة الرئيسية: أرقام حقيقية تُحتسب من استخدام
 * المنصّة (لا تقديرات)، ثم آراء المعلّمين والطلبة التي ينشرها المشرف، ثم
 * دعوة لمشاركة الأثر بالبريد. الأرقام تُقرأ في الخادم وقت توليد الصفحة.
 */
export function ImpactSection({
  activities,
  totals,
  reach,
  voices,
  mastery,
}: {
  activities: number;
  totals: SiteTotals | null;
  reach: ReachSnapshot | null;
  voices: ImpactSettings;
  mastery?: MasterySnapshot | null;
}) {
  const figures: Figure[] = [
    {
      icon: Sparkles,
      value: activities,
      label: 'نشاطًا تفاعليًا منشورًا',
      note: 'تجارب ومحاكاة وأسئلة وألعاب مرتّبة على دروس المنهج القطري.',
      tone: '#8a1538',
    },
  ];
  if (totals && totals.visitors > 0) {
    figures.push({
      icon: Users,
      value: totals.visitors,
      label: 'زيارة للمنصّة',
      note: 'تُحتسب كل زيارة فعليًا عند فتح الموقع.',
      tone: '#2b6b62',
    });
  }
  if (totals && totals.views > 0) {
    figures.push({
      icon: PlayCircle,
      value: totals.views,
      label: 'تشغيلًا للأنشطة',
      note: 'كل تشغيل لنشاط داخل المتصفّح يُحتسب مرّة واحدة.',
      tone: '#2d5f7c',
    });
  }
  if (totals && totals.downloads > 0) {
    figures.push({
      icon: Download,
      value: totals.downloads,
      label: 'تنزيلًا للعمل دون اتصال',
      note: 'أنشطة أُخذت إلى الصف أو البيت ملفًا واحدًا.',
      tone: '#b0862a',
    });
  }
  if (reach && reach.schools > 0) {
    figures.push({
      icon: School,
      value: reach.schools,
      label: 'مدرسة استخدمت المنصّة',
      note: 'من اختيار المستخدمين لمدارسهم قبل تشغيل الألعاب.',
      tone: '#1f4f48',
    });
  }
  if (reach && reach.municipalities > 0) {
    figures.push({
      icon: Landmark,
      value: reach.municipalities,
      label: `من بلديات قطر الـ${MUNICIPALITIES.length}`,
      note: 'انتشار جغرافي كما تعرضه الخريطة الحرارية في لوحة الإحصاءات.',
      tone: '#5b3a22',
    });
  }

  if (mastery && mastery.percent !== null && mastery.attempts > 0) {
    figures.push({
      icon: ClipboardCheck,
      value: mastery.percent,
      suffix: '%',
      label: 'نسبة الإتقان في التقويم الختامي',
      note: `إجابات صحيحة من ${formatFull(mastery.total)} سؤالًا أجاب عنها الطلبة بعد الأنشطة، في ${formatFull(mastery.attempts)} محاولة بلا أسماء.`,
      tone: '#0f8f7c',
    });
  }

  const subject = encodeURIComponent('أثر منصة مناهج قطر التفاعلية في صفّي');

  return (
    <section id="impact" className="impact-band scroll-mt-24">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
        <SectionHead
          kicker="أثر التعلّم"
          title="ماذا صنعت المنصّة في الصفوف؟"
          lead="أرقام حقيقية تُحتسب من استخدام الطلبة والمعلّمين الفعلي، لا تقديرات — وآراء من جرّبوا الأنشطة في صفوفهم."
          action={{ href: '/dashboard', label: 'لوحة الإحصاءات الكاملة' }}
        />

        <ul className="impact-figures" aria-label="أثر المنصّة بالأرقام">
          {figures.map((f) => (
            <li
              key={f.label}
              className="impact-figure"
              style={{ '--tone': f.tone } as React.CSSProperties}
            >
              <span className="impact-figure-icon" aria-hidden>
                <f.icon className="h-5 w-5" strokeWidth={2.3} />
              </span>
              <span className="min-w-0">
                <span className="impact-figure-n">
                  {formatFull(f.value)}
                  {f.suffix}
                </span>
                <span className="impact-figure-l">{f.label}</span>
                <span className="impact-figure-note">{f.note}</span>
              </span>
            </li>
          ))}
        </ul>

        <ImpactVoices initial={voices} />

        <p className="impact-invite">
          <span>
            معلّم أو طالب جرّب المنصّة؟ شاركنا ما تغيّر في صفّك — ملاحظة قصيرة تكفي، وتظهر
            هنا بعد مراجعتها.
          </span>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>
            <Mail className="h-4 w-4" aria-hidden />
            <span dir="ltr">{CONTACT_EMAIL}</span>
          </a>
        </p>
      </div>
    </section>
  );
}
