import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  Atom,
  HelpCircle,
  Gamepad2,
  Sparkles,
  MonitorPlay,
  DownloadCloud,
  Layers,
} from 'lucide-react';
import { getSubjects, getAllActivities, countActivities } from '@/lib/content';
import { Book3D } from '@/components/book-3d';
import { Reveal } from '@/components/reveal';
import { SiteStatsStrip } from '@/components/site-stats-strip';
import { ActivityCard } from '@/components/activity-card';
import { Icon3D } from '@/components/icon-3d';

// المحتوى يُقرأ من Firestore عند إعادة التوليد، لا مرّة واحدة عند النشر،
// وإلا لما ظهرت الأنشطة المرفوعة بعد البناء إلا بنشر جديد.
export const revalidate = 60;

export default async function HomePage() {
  const subjects = await getSubjects();
  const activities = await getAllActivities();
  const total = countActivities(subjects);
  const featured = activities.slice(0, 4);

  return (
    <>
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 girih-backdrop" />
        {/* floating orbs */}
        <div className="pointer-events-none absolute right-[8%] top-24 h-40 w-40 rounded-full bg-[color:var(--gold)]/20 blur-3xl float-slow" />
        <div className="pointer-events-none absolute left-[6%] top-64 h-52 w-52 rounded-full bg-[color:var(--gold)]/20 blur-3xl float-mid" />
        <div className="pointer-events-none absolute bottom-10 right-1/3 h-44 w-44 rounded-full bg-[color:var(--maroon)]/15 blur-3xl float-slow" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="order-2 text-center lg:order-1 lg:text-right">
            <div className="rise-in inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--surface)]/75 px-4 py-1.5 text-xs font-bold text-[color:var(--maroon)] shadow-sm">
              <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
              منصة تعليمية تفاعلية • دولة قطر
            </div>

            <h1
              className="rise-in mt-5 font-calli text-4xl font-bold sm:text-5xl lg:text-6xl"
              style={{ animationDelay: '80ms' }}
            >
              <span className="text-gradient-maroon">تعلّم مناهجك</span>
              <br />
              <span className="text-foreground">باللمس والتجربة</span>
              <span className="text-gradient-gold"> والاكتشاف</span>
            </h1>

            <p
              className="rise-in mx-auto mt-5 max-w-xl text-base leading-8 text-muted-foreground lg:mx-0 lg:text-lg"
              style={{ animationDelay: '160ms' }}
            >
              تجارب عملية ومحاكاة ثلاثية الأبعاد وأسئلة تفاعلية وألعاب
              تعليمية عبر مواد المناهج القطرية — جرّبها مباشرة من المتصفّح أو
              حمّلها للعمل دون اتصال. صُمّمت بروح المناهج القطرية.
            </p>

            <div
              className="rise-in mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ animationDelay: '240ms' }}
            >
              <Link
                href="/browse"
                className="group flex items-center gap-2 rounded-2xl bg-[color:var(--maroon)] px-7 py-3.5 text-base font-black text-white shadow-xl shadow-[color:var(--maroon)]/30 transition-all hover:-translate-y-1 hover:bg-[color:var(--maroon-700)]"
              >
                ابدأ الاستكشاف
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-2xl border-2 border-[color:var(--gold)] bg-[color:var(--surface)]/70 px-7 py-3.5 text-base font-black text-[color:var(--maroon)] transition-all hover:-translate-y-1 hover:bg-[color:var(--gold)]/15"
              >
                لوحة الإحصاءات
              </Link>
            </div>
          </div>

          {/* 3D book */}
          <div className="order-1 flex max-w-full justify-center overflow-hidden lg:order-2">
            <div className="fade-in relative max-w-full">
              <div className="pointer-events-none absolute -inset-2 rounded-full bg-gradient-to-tr from-[color:var(--maroon)]/15 to-[color:var(--gold)]/15 blur-2xl sm:-inset-8" />
              <div className="relative">
                <Book3D
                  subjects={subjects.map((s) => ({
                    id: s.id,
                    title: s.title,
                    emoji: s.emoji,
                    color: s.color,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* stats strip */}
        <div className="relative mx-auto -mt-4 max-w-6xl px-6 pb-8">
          <SiteStatsStrip activities={total} />
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="text-center">
          <p className="diamond-divider mx-auto max-w-xs text-sm font-black">
            كيف تعمل المنصّة؟
          </p>
          <h2 className="mt-3 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
            ثلاث خطوات نحو تعلّم ممتع
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: 'تصفّح حسب المنهج',
              desc: 'اختر المادة ثم المستوى فالوحدة فالدرس لتصل إلى الأنشطة المناسبة.',
              color: 'var(--maroon)',
            },
            {
              icon: MonitorPlay,
              title: 'جرّب مباشرة',
              desc: 'شغّل التجربة أو المحاكاة أو اللعبة داخل المتصفّح دون أي تثبيت.',
              color: 'var(--maroon-700)',
            },
            {
              icon: DownloadCloud,
              title: 'حمّل واستخدم دون اتصال',
              desc: 'نزّل النشاط كملف HTML واحد يعمل على أي جهاز في الصف أو المنزل.',
              color: 'var(--gold)',
            },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <div className="card-premium relative h-full overflow-hidden rounded-3xl border border-[color:var(--gold)]/20 bg-[color:var(--surface)] p-7 shadow-lg">
                <span
                  className="absolute left-5 top-5 font-calli text-6xl font-bold opacity-10"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <Icon3D icon={step.icon} color={step.color} size="lg" />
                <h3 className="mt-5 font-display text-xl font-black text-[color:var(--maroon)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== ACTIVITY TYPES ===================== */}
      <section className="relative overflow-hidden py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
              أربعة أنواع من الأنشطة التفاعلية
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FlaskConical, label: 'تجارب عملية', color: 'var(--maroon-700)' },
              { icon: Atom, label: 'محاكاة تفاعلية', color: 'var(--maroon)' },
              { icon: HelpCircle, label: 'أسئلة وتقويم', color: 'var(--gold)' },
              { icon: Gamepad2, label: 'ألعاب تعليمية', color: 'var(--maroon-300)' },
            ].map((t, i) => (
              <Reveal key={t.label} delay={i * 90}>
                <div
                  className="group relative flex h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl text-white shadow-xl transition-transform hover:-translate-y-2"
                  style={{ background: t.color }}
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-150" />
                  <Icon3D
                    icon={t.icon}
                    color="rgba(255,255,255,0.22)"
                    size="xl"
                    className="backdrop-blur-sm"
                  />
                  <span className="font-display text-lg font-black">{t.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SUBJECTS ===================== */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-[color:var(--gold)]">المواد الدراسية</p>
            <h2 className="mt-1 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
              اختر مادّتك
            </h2>
          </div>
          <Link
            href="/browse"
            className="flex items-center gap-1 text-sm font-black text-[color:var(--maroon)] hover:underline"
          >
            كل المواد <ArrowLeft className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {/* المواد الحيّة من قاعدة البيانات، لا القائمة المضمّنة —
              وإلا لما ظهرت أي مادة يضيفها المشرف من لوحة الإدارة. */}
          {subjects.map((s, i) => {
            const available = s.grades.length > 0;
            const card = (
              <div
                className="card-premium relative flex h-56 flex-col justify-between overflow-hidden rounded-3xl p-6 text-white shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${s.color}, ${s.accent})`,
                }}
              >
                <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                <div className="absolute bottom-2 left-4 text-7xl opacity-25">
                  {s.emoji}
                </div>
                <div className="relative">
                  <span className="text-4xl">{s.emoji}</span>
                  <h3 className="mt-3 font-display text-2xl font-black">{s.title}</h3>
                  <p className="text-sm text-white/80">{s.titleEn}</p>
                </div>
                <div className="relative flex items-center justify-between">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                    {available ? s.tagline : 'قريبًا'}
                  </span>
                  {available && <ArrowLeft className="h-6 w-6" />}
                </div>
              </div>
            );
            return (
              <Reveal key={s.id} delay={i * 100}>
                {available ? (
                  <Link href={`/subject/${s.id}`}>{card}</Link>
                ) : (
                  <div className="cursor-not-allowed opacity-70">{card}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ===================== FEATURED (only when content exists) ========= */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <Reveal className="mb-10 text-center">
            <p className="text-sm font-black text-[color:var(--gold)]">الأكثر تفاعلاً</p>
            <h2 className="mt-1 font-calli text-3xl font-bold text-[color:var(--maroon)] sm:text-4xl">
              أنشطة مميّزة
            </h2>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((a, i) => (
              <Reveal key={a.id} delay={i * 80}>
                <ActivityCard activity={a} index={i} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ===================== CTA ===================== */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-[color:var(--maroon)] p-10 text-center text-white shadow-2xl md:p-16">
            <div className="pointer-events-none absolute inset-0 girih-light" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[color:var(--gold)]/20 blur-2xl spin-slower" />
            <h2 className="relative font-calli text-3xl font-bold sm:text-4xl">
              هل لديك نشاط تفاعلي جاهز؟
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              ارفع ملف الـ HTML الخاص بك ونظّمه حسب المادة والوحدة والدرس ليصبح
              متاحًا للطلبة في جميع أنحاء المنصّة.
            </p>
            <Link
              href="/admin"
              className="relative mt-7 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--gold)] px-8 py-3.5 font-black text-[color:var(--maroon-700)] shadow-lg transition-transform hover:-translate-y-1"
            >
              ارفع نشاطك الآن
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
