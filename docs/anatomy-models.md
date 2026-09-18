# المجسمات التشريحية الجاهزة

مجموعة مجسمات GLB جاهزة داخل مجلد `models/` مولّدة من ملف معاملات نصّي،
فتقدر تعدّل أبعادها وألوانها وتعيد توليدها في ثانية واحدة بلا أي أداة خارجية.

## ما الموجود

| الملف | المحتوى | التشويه |
| --- | --- | --- |
| `arm-assembly.glb` | الذراع كاملة: العضد، الزند، الكعبرة، ذات الرأسين، ثلاثية الرؤوس، اليد | نعم |
| `arm-bones.glb` | العظام واليد فقط | — |
| `biceps.glb` | العضلة ذات الرأسين مع وتريها | نعم |
| `triceps.glb` | العضلة ثلاثية الرؤوس مع وتريها | نعم |
| `humerus.glb` · `ulna.glb` · `radius.glb` · `hand.glb` | أجزاء مفردة | — |

المحاور: `Y` للأعلى، الكتف عند `y≈1.6`، المرفق عند `y≈0.5`، الرسغ عند `y≈-0.7`،
والوجه الأمامي باتجاه `z+`. المجموع أقل من ٧٠٠ كيلوبايت، والملفات بلا صور خامات
فتفتح فوراً في المتصفح.

### هدف التشويه (Morph Target)

العضلتان تحملان هدف تشويه اسمه `contracted` يمثّل حالة الانقباض (بطن أقصر وأكثر انتفاخاً).
تحريك وزنه من 0 إلى 1 ينتقل بين الارتخاء والانقباض بسلاسة:

```js
mesh.morphTargetManager.getTarget(0).influence = 0.75;
```

## التعديل

### 1. من المتصفح — محرر تفاعلي

افتح `model-editor.html` عبر خادم محلي:

```bash
npx serve .
```

فيه: اختيار المجسم، منزلقات لانقباض كل عضلة وزاوية ثني المرفق والحجم،
إظهار/إخفاء كل جزء وتغيير لونه، ثم:

- **تصدير الإعدادات** → ملف JSON بالقيم الحالية.
- **تصدير المجسم GLB** → المجسم بعد التعديل، جاهز لفتحه في Blender.

### 2. من ملف المعاملات — تعديل دائم

الملف `models/anatomy-parts.json` هو المصدر الحقيقي للمجسمات:

```jsonc
"biceps": {
  "label": "العضلة ذات الرأسين",
  "morph": "contracted",
  "pieces": [
    {
      "type": "tube", "material": "muscle", "segments": 28, "smooth": 8,
      "path":  [[0.03, 1.56, 0.05], [0.03, 1.2, 0.155], ...],  // مسار العضلة
      "radii": [0.022, 0.105, 0.098, 0.025],                    // نصف القطر عند كل نقطة
      "contracted": { "path": [...], "radii": [...] }           // شكلها منقبضة
    }
  ]
}
```

بعد أي تعديل:

```bash
npm run models:build      # إعادة توليد كل الملفات
npm run models:verify     # فحص سلامة الملفات الناتجة
```

أو جزء واحد فقط: `npm run models:build -- --only biceps`

**أنواع القطع:** `tube` (مسار + أنصاف أقطار)، `sphere` (مركز + نصف قطر + تحجيم محوري)، `box`.
أي قطعة تقبل `transform` بالمفاتيح `translate` و`rotate` (بالدرجات) و`scale`.

**الخامات** معرّفة في أعلى الملف (`bone`, `muscle`, `tendon`) بلون `[r, g, b]` بين 0 و1
ومعامل خشونة، ويمكن إضافة خامات جديدة واستعمالها في أي قطعة.

**التجميعات** في آخر الملف تحدد أي أجزاء تُجمع في ملف واحد، فتقدر تنشئ تجميعة جديدة
(مثلاً عظام فقط بلا يد) بإضافة مدخل واحد.

> قيود مهمة عند تعديل حالة `contracted`: يجب أن يبقى عدد نقاط المسار وقيمة `segments`
> و`smooth` كما هي في الحالة الأساسية، لأن هدف التشويه في glTF يتطلب نفس عدد الرؤوس.
> السكربت يوقف التوليد برسالة واضحة إن اختلفا.

### 3. في Blender أو أي برنامج ثلاثي الأبعاد

ملفات GLB قياسية، تُستورد مباشرة (`File → Import → glTF 2.0`) مع الحفاظ على
أسماء الأجزاء والخامات وأهداف التشويه.

## الاستخدام داخل نشاط Babylon.js

```js
const result = await BABYLON.SceneLoader.ImportMeshAsync("", "models/", "arm-assembly.glb", scene);

// انقباض العضلة
const biceps = result.meshes.find((mesh) => mesh.name.startsWith("biceps"));
biceps.morphTargetManager.getTarget(0).influence = 1;

// ثني المرفق: اربط عظام الساعد واليد بعقدة تدور حول نقطة المرفق
const elbow = new BABYLON.TransformNode("elbow", scene);
elbow.position = new BABYLON.Vector3(0, 0.5, 0);
for (const name of ["ulna", "radius", "hand"]) {
  const mesh = result.meshes.find((m) => m.name.startsWith(name));
  mesh.parent = elbow;
  mesh.position = elbow.position.scale(-1);
}
elbow.rotation.x = -BABYLON.Tools.ToRadians(90);
```

ملف `model-editor.html` يطبّق هذا بالضبط، فارجع إليه كمرجع عملي.

## طرق أخرى للحصول على مجسمات

لتوليد مجسمات بالذكاء الاصطناعي بدل تعديل هذه، انظر
[docs/tripo-3d-models.md](tripo-3d-models.md) — يحتاج مفتاح Tripo API.
