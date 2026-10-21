import type { Metadata } from 'next';
import { Camera, Hand, Projector, ShieldCheck, Smartphone, Tv } from 'lucide-react';
import { PageCourt } from '@/components/page-court';
import { SectionHead } from '@/components/home/section-head';
import { SchoolGate } from '@/components/school-gate';
import { Reveal } from '@/components/reveal';
import { BoardGameCard, ClassroomSetupDiagram } from '@/components/board-games';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { T } from '@/components/editable-text';
import { SITE_NAME } from '@/lib/site';
import { boardGames } from '@/data/board-games';

export const revalidate = 300;

const TITLE = 'ألعاب السبورة الذكية';
const DESCRIPTION =
  'ألعاب صفّية تُلعب بلمس السبورة بالأيدي بلا أقلام ولا أجهزة للطلاب: جهاز المعلّم يعرض اللعبة على جهاز العرض ويرى أيدي الطلاب بكاميرته.';

export const metadata: Metadata = {
  title: `${TITLE} | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: '/board-games' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: '/board-games', images: ['/asnan/cover.jpg'] },
};

const NEEDS = [
  { icon: Projector, title: 'جهاز عرض', text: 'تفاعلي أو عادي، يعرض على سبورة بيضاء أو جدار فاتح.' },
  { icon: Smartphone, title: 'آيباد أو هاتف', text: 'بالوضع الأفقي على حامل، بنظام iOS ‏16.4 أو أندرويد حديث.' },
  { icon: Tv, title: 'انعكاس الشاشة', text: 'مباشرة إلى جهاز العرض: Screen Mirroring في أندرويد، أو تطبيق Epson iProjection للآيفون والآيباد، أو Apple TV، أو كابل HDMI.' },
  { icon: Hand, title: 'أيدي الطلاب فقط', text: 'لا أقلام إلكترونية ولا أجهزة للطلاب ولا تطبيقات تُثبَّت.' },
];

const STEPS = [
  { title: 'ثبّت الجهاز جانبيًا', text: 'على حامل في زاوية قريبة من السبورة (متر إلى متر ونصف)، والكاميرا الخلفية ترى الصورة المعروضة كاملة. لا تضعه على طاولة خلف الطلاب.' },
  { title: 'اعكس الشاشة على جهاز العرض', text: 'لا يلزم Apple TV: في أندرويد «بث الشاشة» (Screen Mirroring) مباشرة إلى جهاز العرض، وفي الآيفون والآيباد تطبيق Epson iProjection ← «Mirror device screen»، أو Apple TV إن وُجد، أو كابل HDMI. ثم افتح اللعبة من هذه الصفحة.' },
  { title: 'شغّل الكاميرا وعايِر', text: 'من زر ⚙ في اللعبة: «تشغيل الكاميرا» ثم «معايرة تلقائية» وابتعدوا عن السبورة ٨ ثوانٍ. المعايرة تصلح لكل ألعاب القسم ما دام الحامل مكانه.' },
  { title: 'العبوا بأيديكم', text: 'يضع الطالب كفّه على البطاقة ويبقيها حتى تمتلئ الدائرة، ثم يسحبها إلى مكانها ويبقيها لحظة. يلعب أكثر من طالب معًا.' },
];

const FAQ = [
  {
    q: 'هل تظهر صورة الطلاب على السبورة أو تُرسل إلى أي مكان؟',
    a: 'لا. الكاميرا تعمل في الخلفية ولا تُعرض صورتها على الصفحة، وتتبّع اليد يجري داخل الجهاز نفسه؛ لا يُرسل أي فيديو أو صورة إلى خادم.',
  },
  {
    q: 'الطلاب الصغار لا يصلون إلى أعلى السبورة؟',
    a: 'من ⚙ في اللعبة: «أنزِل منطقة اللعب» يجعل كل ما يُلمس في الجزء السفلي، و«إبعاد البطاقات عن طرفي الصورة» إن كانت الأطراف خارج السبورة.',
  },
  {
    q: 'اليد لا تُكشف أحيانًا أو تضيع أثناء السحب؟',
    a: 'قرّب الجهاز من السبورة وضعه في زاوية جانبية، واجعل «دقة تتبّع اليد» على «قصوى». إن اختفت اليد لحظة يبقى العنصر مكانه بدائرة ذهبية حتى تعود اليد إليه.',
  },
  {
    q: 'لا يوجد Apple TV في الصف؟',
    a: 'لا بأس. جهاز العرض التفاعلي من Epson يستقبل الشاشة لاسلكيًا بنفسه: الهاتف الأندرويد عبر «بث الشاشة» (Screen Mirroring / Miracast)، والآيفون والآيباد عبر تطبيق Epson iProjection المجاني (على شبكة Wi-Fi نفسها) ثم «Mirror device screen». ويصلح أيضًا كابل HDMI مع محوّل. المعايرة تقيس تأخير الانعكاس وتعمل مع كل الطرق.',
  },
  {
    q: 'لا تتوفّر كاميرا أو حامل الآن؟',
    a: 'كل الألعاب تعمل أيضًا بلمس شاشة الجهاز نفسه (سحب وإفلات)، والصورة تنعكس على السبورة كالمعتاد.',
  },
];

export default async function BoardGamesPage() {
  const texts = await fetchSiteTextsServer();
  const games = boardGames();
  const subjects = new Set(games.map((g) => g.subject)).size;

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'page.boardGames.title') }]}
        kicker={<T k="page.boardGames.kicker" v={txt(texts, 'page.boardGames.kicker')} />}
        title={<T k="page.boardGames.title" v={txt(texts, 'page.boardGames.title')} />}
        icon="screen"
        color="#1d5c63"
        lead={<T k="page.boardGames.lead" v={txt(texts, 'page.boardGames.lead')} />}
        chips={[
          { n: games.length, label: games.length === 1 ? 'لعبة' : games.length <= 10 ? 'ألعاب' : 'لعبة' },
          { n: subjects, label: subjects === 1 ? 'مادة' : 'مواد' },
        ]}
      />

      {/* ما تحتاجه */}
      <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-6" aria-labelledby="bg-needs">
        <h2 id="bg-needs" className="sr-only">ما تحتاجه</h2>
        <ul className="bg-needs">
          {NEEDS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="bg-needs-icon" aria-hidden>
                <Icon className="h-6 w-6" />
              </span>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* الألعاب */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6" id="games">
        <SectionHead kicker="مكتبة ألعاب السبورة" title="اختر لعبة واعرضها على السبورة" lead="كل لعبة تُفتح بملء الشاشة على جهاز المعلّم، وتعمل باللمس باليد أو بلمس شاشة الجهاز." />
        <SchoolGate>
          <div className="bg-grid">
            {games.map((g, i) => (
              <Reveal key={g.slug} delay={i * 70}>
                <BoardGameCard game={g} />
              </Reveal>
            ))}
          </div>
        </SchoolGate>
      </section>

      {/* تجهيز الصف */}
      <section className="bg-setup" id="setup" aria-labelledby="bg-setup-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:py-16">
          <div className="min-w-0">
            <p className="kicker">دليل المعلّم</p>
            <h2 id="bg-setup-title" className="mt-2 font-calli text-[1.9rem] leading-[1.5] text-foreground sm:text-[2.3rem]">
              جهّز صفّك في أربع خطوات
            </h2>
            <ol className="bg-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="bg-step-n" aria-hidden>
                    {(i + 1).toLocaleString('ar-EG')}
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className="bg-diagram">
            <ClassroomSetupDiagram />
            <figcaption>
              <Camera className="inline h-4 w-4" aria-hidden /> الجهاز في زاوية جانبية يرى السبورة والأيدي، لا خلف الطلاب حيث تحجب أجسامهم أيديهم.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* أسئلة */}
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-6" aria-labelledby="bg-faq">
        <SectionHead kicker="أسئلة المعلّمين" title={<span id="bg-faq">قبل أن تبدأ</span>} />
        <div className="bg-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <p className="bg-privacy">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          تتبّع اليد يجري داخل جهاز المعلّم فقط، ولا تُحفظ صور الطلاب ولا تُرسل.
        </p>
      </section>
    </>
  );
}
