# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## مجسمات 3D

### مجسمات تشريحية جاهزة

مجلد `models/` فيه مجسمات GLB جاهزة للذراع (عظام + عضلة ذات الرأسين وثلاثية الرؤوس
مع هدف تشويه للانقباض). عدّل `models/anatomy-parts.json` ثم:

```bash
npm run models:build     # إعادة توليد المجسمات
npm run models:verify    # فحص سلامتها
npx serve .              # ثم افتح model-editor.html للتعديل التفاعلي
```

التفاصيل في [docs/anatomy-models.md](docs/anatomy-models.md).

### توليد مجسمات جديدة عبر Tripo Studio

```bash
npm run tripo -- --list-presets
npm run tripo -- --preset arm-muscles
```

التفاصيل في [docs/tripo-3d-models.md](docs/tripo-3d-models.md) (يحتاج مفتاح API).
