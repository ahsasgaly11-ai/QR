import { BackButton } from '@/components/back-button';
import { SITE_NAME } from '@/lib/site';

export const metadata = {
  title: `سياسة الخصوصية | ${SITE_NAME}`,
  description: 'ما البيانات التي تستخدمها المنصّة وكيف تُحفَظ.',
  alternates: { canonical: '/privacy' },
};

const sections: { title: string; body: string[] }[] = [
  {
    title: 'لا نجمع بيانات شخصية',
    body: [
      'تصفّح المنصّة وتشغيل الأنشطة وتحميلها لا يتطلّب إنشاء حساب ولا إدخال اسم أو بريد إلكتروني أو رقم هاتف.',
      'حسابات الدخول مخصّصة لمشرفي المنصّة فقط لرفع المحتوى وإدارته.',
    ],
  },
  {
    title: 'اختيار المدرسة',
    body: [
      'قبل تشغيل نشاط أو تحميله يُطلب اختيار المدرسة. يُحفَظ هذا الاختيار في متصفّحك فقط، ولا يرتبط بهويّة الطالب.',
      'تُضاف العملية إلى عدّادات إجمالية للمدرسة (عدد المستخدمين وعدد مرّات اللعب والتحميل) تظهر في الخريطة الحرارية، دون أي معلومات عن الأفراد.',
    ],
  },
  {
    title: 'الإحصاءات العامة',
    body: [
      'نحتسب أعدادًا إجمالية للزوّار والمشاهدات والتنزيلات لكل نشاط ولكل الموقع، وهي أرقام مجمّعة لا تحدّد أي زائر.',
      'قد تُستخدم خدمة Google Analytics لقياس الزيارات بصورة مجمّعة، وتخضع لسياسة خصوصية Google.',
    ],
  },
  {
    title: 'التخزين في متصفّحك',
    body: [
      'تحفظ المنصّة بعض التفضيلات في متصفّحك (مثل الوضع الليلي، وخيار لغة الإشارة، والمدرسة المختارة) لتبقى كما تركتها في زيارتك القادمة.',
      'يمكنك حذفها في أي وقت بمسح بيانات الموقع من إعدادات المتصفّح.',
    ],
  },
  {
    title: 'الأنشطة التفاعلية',
    body: [
      'تعمل الأنشطة المرفوعة داخل إطار معزول عن بقيّة الموقع، فلا تصل إلى بيانات الموقع أو جلسات الدخول.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-6 flex">
        <BackButton fallback="/" />
      </div>
      <h1 className="font-calli text-4xl font-bold text-[color:var(--maroon)] sm:text-5xl">
        سياسة الخصوصية
      </h1>
      <p className="mt-3 text-muted-foreground">
        صُمّمت {SITE_NAME} للطلبة، لذا نقلّل البيانات المستخدمة إلى أدنى حدّ ممكن.
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-black text-[color:var(--maroon)]">
              {s.title}
            </h2>
            <div className="mt-3 space-y-2 leading-8 text-foreground/85">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
