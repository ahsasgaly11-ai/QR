// النطاق الرسمي (canonical) للموقع — يُستخدم لخريطة الموقع والروابط المعيارية
// وبطاقات المشاركة. اضبط NEXT_PUBLIC_SITE_URL على النطاق الفعلي (أو نطاق
// الوزارة الرسمي عند توفّره) حتى تؤرشف Google الموقع الصحيح.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://qr-xi-seven.vercel.app';

export const SITE_NAME = 'منصة مناهج قطر التفاعلية';

// رمز التحقّق من ملكية الموقع في Google Search Console (اختياري).
// ضعه في NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION فيظهر وسم التحقّق تلقائيًّا.
export const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || '';

// بيانات التواصل الرسمية لصاحب المنصّة — مصدر واحد يُستخدم في التذييل وبطاقة
// «التواصل» وقسم «أثر التعلّم»، فلا يتفرّق البريد أو الرقم بين الملفات.
export const CONTACT_EMAIL = 'a.aldhahli1610@education.qa';
export const CONTACT_PHONE_E164 = '+97470776067';
export const CONTACT_PHONE_PRETTY = '+974 7077 6067';
