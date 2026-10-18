import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardCheck,
  Coins,
  Compass,
  Fingerprint,
  Lightbulb,
  Mail,
  Map,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageCourt } from '@/components/page-court';
import { fetchSiteTextsServer, txt } from '@/lib/site-texts';
import { getAllActivities, getSubjects } from '@/lib/content';
import { getMasteryServer, getReachServer, getSiteStatsServer } from '@/lib/stats-server';
import { pedagogyStatus } from '@/lib/pedagogy';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';
import { formatFull } from '@/lib/utils';

export const revalidate = 300;

export const metadata = {
  title: `عن المنصّة | ${SITE_NAME}`,
  description:
    'فكرة المنصّة وأهميتها وأصالتها وأهدافها والفئة المستهدفة وطريقة استخدامها في الصف وتكلفتها وقابليتها للتطوير، بأرقام حقيقية من الاستخدام.',
  alternates: { canonical: '/about' },
};

// ---------------------------------------------------------------------------
//  صفحة «عن المنصّة»: ما يحتاجه محكّم أو مشرف أو معلّم ليفهم المنتج في خمس
//  دقائق. أقسامها تطابق محاور كتيّب المنتج (الفكرة، الأهمية، الأصالة،
//  الأهداف، الفئة، طريقة الاستخدام، التكلفة، قابلية التطوير) والأرقام فيها
//  تُقرأ من الاستخدام الفعلي وقت توليد الصفحة، لا من نصّ ثابت.
// ---------------------------------------------------------------------------

type SectionDef = { id: string; icon: LucideIcon; kicker: string; title: string };

const SECTIONS: SectionDef[] = [
  { id: 'idea', icon: Lightbulb, kicker: '١', title: 'فكرة المنتج' },
  { id: 'why', icon: Compass, kicker: '٢', title: 'أهمية المنتج والمشكلة التي يعالجها' },
  { id: 'original', icon: Fingerprint, kicker: '٣', title: 'أصالة الفكرة' },
  { id: 'goals', icon: Target, kicker: '٤', title: 'أهداف المنتج' },
  { id: 'audience', icon: Users, kicker: '٥', title: 'الفئة المستهدفة' },
  { id: 'use', icon: Map, kicker: '٦', title: 'طريقة الاستخدام ومراعاة الفروق الفردية' },
  { id: 'evidence', icon: ClipboardCheck, kicker: '٧', title: 'كيف نقيس الأثر؟' },
  { id: 'cost', icon: Coins, kicker: '٨', title: 'التكلفة الاقتصادية' },
  { id: 'growth', icon: TrendingUp, kicker: '٩', title: 'قابلية المنتج للتطوير' },
];

export default async function AboutPage() {
  const [subjects, activities, totals, reach, mastery, texts] = await Promise.all([
    getSubjects(),
    getAllActivities(),
    getSiteStatsServer(),
    getReachServer(),
    getMasteryServer(),
    fetchSiteTextsServer(),
  ]);

  const curricular = activities.filter((a) => !a.smartReinforcement && !a.unitReview && !a.presentation);
  const withObjectives = curricular.filter((a) => pedagogyStatus(a.pedagogy).complete).length;
  const lessons = subjects.reduce(
    (n, s) => n + s.grades.reduce((m, g) => m + g.units.reduce((k, u) => k + u.lessons.length, 0), 0),
    0
  );
  const units = subjects.reduce((n, s) => n + s.grades.reduce((m, g) => m + g.units.length, 0), 0);
  const grades = subjects.reduce((n, s) => n + s.grades.length, 0);

  const facts: { n: string; label: string }[] = [
    { n: formatFull(activities.length), label: 'نشاطًا تفاعليًا منشورًا' },
    { n: formatFull(lessons), label: `درسًا في ${formatFull(units)} وحدات` },
    ...(totals ? [{ n: formatFull(totals.views), label: 'تشغيلًا للأنشطة' }] : []),
    ...(reach ? [{ n: formatFull(reach.schools), label: `مدرسة من ${reach.municipalities} بلديات` }] : []),
    ...(mastery && mastery.percent !== null
      ? [{ n: `${mastery.percent}%`, label: `إتقان في ${formatFull(mastery.attempts)} محاولة تقويم` }]
      : []),
  ];

  return (
    <>
      <PageCourt
        crumbs={[{ href: '/', label: txt(texts, 'nav.home') }, { label: txt(texts, 'nav.about') }]}
        kicker={txt(texts, 'page.about.kicker')}
        title={txt(texts, 'page.about.title')}
        icon="key"
        color="#2b6b62"
        lead={txt(texts, 'page.about.lead')}
        chips={facts.slice(0, 4)}
      />

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:py-14">
        {/* فهرس سريع */}
        <nav aria-label="أقسام الصفحة" className="about-toc">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="about-toc-link">
              <span className="about-toc-n">{s.kicker}</span>
              {s.title}
            </a>
          ))}
        </nav>

        <div className="about-sections">
          <AboutSection def={SECTIONS[0]}>
            <p>
              <b>{SITE_NAME}</b> موقع يجمع لكل درس في الكتاب المدرسي القطري أنشطته التفاعلية:
              تجربة عملية تُنفَّذ بخطواتها، أو محاكاة لظاهرة يصعب رؤيتها، أو أسئلة تفاعلية، أو لعبة
              تعليمية. الطالب والمعلّم يصلان إلى النشاط بترتيب الكتاب نفسه (المادة ← المستوى ← الوحدة
              ← الدرس)، يشغّلانه في المتصفّح أو على السبورة الذكية، أو يحمّلانه ملفًا واحدًا يعمل
              دون إنترنت في الصف أو البيت.
            </p>
            <p>
              كل نشاط يحمل هدفه التعليمي ونواتج تعلّمه وموضعه في الدرس وطريقة توظيفه، وينتهي
              بـ«تذكرة خروج» قصيرة تُسجَّل نتائجها بلا أسماء، فيعرف المعلّم ما فهمه الصف وتعرف
              المنصّة أثرها الحقيقي.
            </p>
          </AboutSection>

          <AboutSection def={SECTIONS[1]}>
            <ul>
              <li>
                <b>مفاهيم العلوم في الحلقة الأولى مجرّدة على طفل الثامنة:</b> الجراثيم لا تُرى،
                والعضلات تعمل داخل الجسم، وخصائص المواد تحتاج اختبارًا بيديه. المنصّة تحوّل هذه
                المفاهيم إلى تجربة يعيشها الطالب لا صورة ينظر إليها.
              </li>
              <li>
                <b>الوسائل الرقمية الجيدة متفرّقة وغير مرتبطة بالمنهج:</b> يبحث المعلّم ساعات ثم يجد
                محتوى بلغة أخرى أو لصف آخر. هنا النشاط موضوع في درسه، بعنوانه كما في الكتاب،
                وبهدفه كما في دليل المعلّم.
              </li>
              <li>
                <b>الإنترنت لا يتوفّر في كل حصّة:</b> النشاط ملف واحد قائم بذاته يُحمَّل مرّة ويعمل
                على أي جهاز بلا اتصال، وهو ما تحتاجه المدارس والبيوت ذات الشبكات البطيئة.
              </li>
              <li>
                <b>الأثر غير مُقاس:</b> أغلب الوسائل لا تخبرنا هل تعلّم الطالب فعلًا. المنصّة تسجّل
                نتائج التقويم الختامي وتعرض «نسبة الإتقان» لكل درس في لوحة الإحصاءات.
              </li>
            </ul>
          </AboutSection>

          <AboutSection def={SECTIONS[2]}>
            <p>ليست مكتبة ألعاب ولا صفحة روابط. ما يميّزها هو اجتماع هذه العناصر في منتج واحد:</p>
            <ul>
              <li>
                <b>هيكل الكتاب المدرسي درسًا درسًا</b> وبعناوينه المشكولة، مع استيراد الفهرس من نصّ
                الكتاب أو صورته بلا كتابة يدوية، فتُبنى مادة كاملة في دقائق.
              </li>
              <li>
                <b>أنشطة أصلية</b> مصمّمة لهذا المنهج: مختبرات ثلاثية الأبعاد، تجارب بخطوات وسجل
                ملاحظات وقياسات، شخصيات كرتونية تحاور الطالب بالعربية.
              </li>
              <li>
                <b>ملف واحد دون اتصال</b> لكل نشاط، مع تشغيل معزول وآمن داخل الموقع.
              </li>
              <li>
                <b>هوية قطرية:</b> واجهة مستوحاة من السدو والأبواب القديمة ونافذة الدوحة، ونظام
                مكافآت «لآلئ الغوص» يرتقي فيه الطالب من «بحّار جديد» إلى «طوّاش اللؤلؤ».
              </li>
              <li>
                <b>خريطة حرارية حقيقية لقطر:</b> يختار المستخدم مدرسته مرّة واحدة، فتُرسم خريطة
                انتشار المنصّة على بلديات الدولة الثماني من بيانات فعلية.
              </li>
              <li>
                <b>إتاحة للجميع:</b> لوحة إمكانية وصول (حجم الخط، التباين، القراءة الميسّرة، تقليل
                الحركة)، ورفيق لغة الإشارة القطرية لكل نشاط، وتوافق مع معايير WCAG 2.2 بالمستوى AA.
              </li>
              <li>
                <b>قياس الأثر مدمج:</b> تذكرة خروج لكل نشاط، وبروتوكول بسيط تبلّغ به اللعبة نفسها
                نتيجة الطالب، ولوحة إحصاءات تجمع كل ذلك على مستوى الدرس.
              </li>
            </ul>
          </AboutSection>

          <AboutSection def={SECTIONS[3]}>
            <ol>
              <li>تحويل مفاهيم العلوم المجرّدة إلى خبرات حسّية يجرّبها الطالب بيده ويرى نتيجتها.</li>
              <li>ربط كل وسيلة رقمية بهدف تعليمي محدّد وناتج تعلّم قابل للملاحظة في دليل المعلّم.</li>
              <li>تمكين المعلّم من توظيف النشاط في ثلاث دقائق: اختيار الدرس، التشغيل، التحميل.</li>
              <li>قياس أثر التعلّم بأداة مدمجة لا تحتاج أسماء ولا حسابات، وعرضه للمعلّم والمشرف.</li>
              <li>بناء مجتمع تعلّم مهني يرفع فيه المعلّمون أنشطتهم ويتبادلون ما نجح في صفوفهم.</li>
            </ol>
          </AboutSection>

          <AboutSection def={SECTIONS[4]}>
            <ul>
              <li>
                <b>الطلبة:</b> المرحلة الابتدائية في مدارس قطر الحكومية (المنهج الحالي للصف الثالث
                في مادة العلوم، {formatFull(grades)} مستوى منشور)، في الصف وفي البيت.
              </li>
              <li>
                <b>المعلّمون:</b> معلّمو العلوم ومعلّمو الصفوف الأولى، على السبورة الذكية أو أجهزة
                الطلبة.
              </li>
              <li>
                <b>أولياء الأمور:</b> لمتابعة الدرس في البيت بنشاط محمَّل يعمل دون اتصال.
              </li>
              <li>
                <b>المشرفون التربويون:</b> عبر لوحة الإحصاءات والخريطة الحرارية ونسبة الإتقان.
              </li>
              <li>
                <b>الطلبة ذوو الإعاقة:</b> بلغة الإشارة القطرية ولوحة إمكانية الوصول وقارئ الشاشة.
              </li>
            </ul>
          </AboutSection>

          <AboutSection def={SECTIONS[5]}>
            <ol>
              <li>
                <b>قبل الحصّة:</b> يفتح المعلّم الدرس من «المناهج»، يقرأ «الهدف التعليمي» و«في الصف»
                أعلى النشاط، ويحمّل الملف إن كانت الشبكة غير مضمونة.
              </li>
              <li>
                <b>أثناء الحصّة:</b> «ملء الشاشة» على السبورة للعرض الجماعي والتنبّؤ، ثم عمل الطلبة
                في ثنائيات على الأجهزة؛ كل نشاط يحمل موضعه (قبل الدرس، أثناءه، بعده) ومدته.
              </li>
              <li>
                <b>بعد النشاط:</b> يجيب الطلبة عن «تذكرة الخروج» فيرون الصواب فورًا، وتظهر للمعلّم
                نسبة الإتقان في لوحة الإحصاءات.
              </li>
            </ol>
            <p className="about-sub">مراعاة الفروق الفردية وأدوات الدعم</p>
            <ul>
              <li>
                <b>بطيئو التعلّم:</b> إعادة النشاط بلا حدّ، تلميحات داخل التجارب، وقراءة ميسّرة
                وخط أكبر من لوحة إمكانية الوصول.
              </li>
              <li>
                <b>المتفوّقون:</b> «ألعاب التعزيز الذكية» و«مراجعات الوحدات» تحدّيات أعلى بعد إتقان
                الدرس.
              </li>
              <li>
                <b>الصمّ وضعاف السمع:</b> رفيق لغة الإشارة القطرية في كل نشاط، ومقطع إشارة خاصّ حين
                يضيفه المعلّم.
              </li>
              <li>
                <b>ذوو الحساسية البصرية والحركية:</b> وضع التباين العالي، تقليل الحركة، الوضع
                الليلي، والتنقّل الكامل بلوحة المفاتيح.
              </li>
              <li>
                <b>بلا إنترنت:</b> الملف الواحد يعمل على أي جهاز، وتطبيق Documents على iPad.
              </li>
            </ul>
          </AboutSection>

          <AboutSection def={SECTIONS[6]}>
            <p>
              المنصّة لا تكتفي بعدّ الزيارات. لكل نشاط «تذكرة خروج» من سؤال إلى ثلاثة يضيفها
              المعلّم، يجيب عنها الطالب بعد النشاط فتُسجَّل محاولته (الإجابات الصحيحة من المجابة)
              بلا اسم ولا جهاز. ومن هذه الأرقام تُحسب <b>نسبة الإتقان</b> لكل نشاط ولكل درس في{' '}
              <Link href="/dashboard">لوحة الإحصاءات</Link>، إلى جانب الزيارات والتشغيل والتنزيل
              والمدارس المستخدِمة على <Link href="/heatmap">الخريطة الحرارية</Link>.
            </p>
            <div className="about-facts">
              {facts.map((f) => (
                <div key={f.label} className="about-fact">
                  <span className="about-fact-n">{f.n}</span>
                  <span className="about-fact-l">{f.label}</span>
                </div>
              ))}
              <div className="about-fact">
                <span className="about-fact-n">
                  {formatFull(withObjectives)}/{formatFull(curricular.length)}
                </span>
                <span className="about-fact-l">نشاطًا مكتمل البيانات التربوية</span>
              </div>
            </div>
            <p>
              وفي قسم <Link href="/#impact">أثر التعلّم</Link> بالصفحة الرئيسية تُنشر آراء المعلّمين
              والطلبة الذين جرّبوا الأنشطة في صفوفهم، ولا يُنشر فيه أي رأي افتراضي.
            </p>
          </AboutSection>

          <AboutSection def={SECTIONS[7]}>
            <p>
              <b>التشغيل: صفر ريال.</b> الاستضافة على الخطة المجانية (Vercel)، وقاعدة البيانات
              والمصادقة على خطة Firebase المجانية (Spark) بلا بطاقة بنكية، وملفات الأنشطة تُخزَّن
              داخل قاعدة البيانات نفسها مقسّمة إلى أجزاء بدل خدمة تخزين مدفوعة. لا اشتراكات ولا
              تراخيص ولا أجهزة خاصّة: أي متصفّح حديث على حاسوب أو جهاز لوحي أو هاتف يكفي.
            </p>
            <p>
              <b>الإنتاج:</b> أدوات مفتوحة (Next.js وReact وThree.js) وجهد المعلّم في تصميم
              الأنشطة وتجريبها. الحدود المجانية تكفي لمئة لعبة ونحو خمسين ألف قراءة يوميًا، وعند
              التوسّع على مستوى الدولة تكلّف الترقية بضع عشرات من الدولارات شهريًا دون تغيير أي كود.
            </p>
          </AboutSection>

          <AboutSection def={SECTIONS[8]}>
            <ul>
              <li>
                <b>مواد وصفوف جديدة بلا كود:</b> من لوحة الإدارة يُستورد فهرس أي كتاب (نصًا أو PDF أو
                صورة) فتُبنى وحداته ودروسه، ثم تُرفع الأنشطة في أماكنها.
              </li>
              <li>
                <b>مجتمع معلّمين:</b> نموذج الرفع نفسه يصلح ليرفع كل معلّم نشاطه، مع مراجعة المشرف
                قبل النشر.
              </li>
              <li>
                <b>أنشطة ذكية:</b> أي لعبة تبلّغ نتيجتها بسطر واحد (<code dir="ltr">qaReport(correct, total)</code>)
                فتنضمّ إلى قياس الإتقان؛ والواقع المعزّز مجرَّب في «قرص التحدي» وسيُضمّ إلى الدروس.
              </li>
              <li>
                <b>قاموس لغة الإشارة القطرية:</b> يعمل اليوم بأكثر من ألف وخمسمئة مفردة مستوردة
                من قاعدة KArSL والقاموس الإشاري العربي للصم (منسوبة المصدر)، وبأشكال تهجئة من
                قاعدة ASLAD-190K (CC BY 4.0)، وبنيته جاهزة لاستبدالها بمقاطع قطرية موثّقة من مترجم
                معتمد، حرفًا حرفًا وكلمةً كلمة.
              </li>
              <li>
                <b>إحداثيات المدارس الفعلية</b> وربط الحسابات بنظام الوزارة عند اعتماد المنصّة
                رسميًا.
              </li>
            </ul>
          </AboutSection>
        </div>

        <div className="about-cta">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold text-white">جرّب نشاطًا الآن أو راسلنا</p>
            <p className="mt-1 text-sm text-white/80">
              اقتراحات المعلّمين والمشرفين تُقرأ وتُنفَّذ، وآراؤهم تُنشر في «أثر التعلّم» بعد مراجعتها.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/browse" className="closing-cta">
              تصفّح المناهج <ArrowLeft className="h-4 w-4" />
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="closing-cta closing-cta--ghost">
              <Mail className="h-4 w-4" /> <span dir="ltr">{CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function AboutSection({ def, children }: { def: SectionDef; children: React.ReactNode }) {
  return (
    <section id={def.id} className="about-section scroll-mt-24" aria-labelledby={`${def.id}-title`}>
      <div className="about-section-head">
        <span className="about-section-icon" aria-hidden>
          <def.icon className="h-5 w-5" strokeWidth={2.3} />
        </span>
        <h2 id={`${def.id}-title`} className="about-section-title">
          <span className="about-section-n">{def.kicker}</span>
          {def.title}
        </h2>
      </div>
      <div className="about-body">{children}</div>
    </section>
  );
}

