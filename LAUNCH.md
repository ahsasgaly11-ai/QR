# قائمة الإطلاق

خطوات تُنفَّذ من لوحات التحكّم (Vercel وFirebase وGoogle) ولا يمكن تنفيذها من الكود.

## 1. متغيّرات البيئة على Vercel
Project → Settings → Environment Variables (بيئة Production):

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `STORAGE_BUCKET` / `MESSAGING_SENDER_ID` / `APP_ID`
- [ ] `NEXT_PUBLIC_SITE_URL`: النطاق الفعلي بلا `/` في النهاية
- [ ] `ADMIN_UID`: معرّف حسابك من Firebase Authentication
- [ ] (اختياري) `NEXT_PUBLIC_GA_ID` و`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` و`GEMINI_API_KEY`
- [ ] أعد النشر (Redeploy) بعد الحفظ، لأن متغيّرات `NEXT_PUBLIC_` تُضمَّن وقت البناء

> بدون متغيّرات Firebase يعمل الموقع في «وضع العرض»، وتكون لوحة `/admin` مفتوحة
> ما لم يُضبط `NEXT_PUBLIC_ADMIN_PASSCODE`.

## 2. Firebase Console
- [ ] نشر القواعد: `firebase deploy --only firestore:rules`
- [ ] إنشاء وثيقة `admins/{UID}` لحسابك (Firestore → Start collection → `admins`)
- [ ] Authentication → Settings → User actions: **إلغاء تفعيل** Enable create (sign-up)
- [ ] Authentication → Settings → Authorized domains: إضافة النطاق الفعلي
- [ ] Google Cloud Console → APIs & Services → Credentials: تقييد مفتاح API
      على نطاقك (HTTP referrers)
- [ ] Usage and billing: متابعة حصّة Firestore المجانية (20 ألف كتابة يوميًا،
      وكل زيارة تستهلك بضع كتابات للعدّادات)

## 3. البحث والقياس
- [ ] Google Search Console: التحقّق من الملكية ثم إرسال `/sitemap.xml`
- [ ] تشغيل Lighthouse (Chrome DevTools) على الرئيسية وصفحة مادة وصفحة نشاط

## 4. تجربة يدوية بعد النشر
- [ ] الجوال (Safari على iOS وChrome على Android) والكمبيوتر، في الوضعين الفاتح والداكن
- [ ] اختيار مدرسة ← تشغيل نشاط ← تحميل ← التأكّد من زيادة العدّادات والخريطة الحرارية
- [ ] رفع نشاط من `/admin`، والتأكّد من ظهوره للزوّار فورًا وأنه يعمل داخل الإطار المعزول
- [ ] مفتاح إيقاف التنزيل من لوحة الإدارة
- [ ] صفحة 404 وروابط لغة الإشارة الخارجية
