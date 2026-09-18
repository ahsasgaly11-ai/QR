# جلب مجسمات 3D من Tripo Studio

أداة سطر أوامر تولّد مجسمات ثلاثية الأبعاد عبر واجهة [Tripo](https://platform.tripo3d.ai)
وتحفظها بصيغة GLB داخل مجلد `models/` لاستخدامها في الأنشطة التعليمية.

## 1. المفتاح

أنشئ مفتاح API من لوحة Tripo، ثم ضعه في ملف `.env` في جذر المشروع:

```
TRIPO_API_KEY=tsk_xxxxxxxxxxxxxxxx
```

الملف `.env` مستثنى من Git، والمفتاح لا يصل إلى المتصفح إطلاقاً لأن الاستدعاء يتم من Node.
لا تضع المفتاح داخل ملفات HTML.

## 2. الاستخدام

```bash
# عرض الأوصاف الجاهزة
npm run tripo -- --list-presets

# توليد مجسم واحد
npm run tripo -- --preset arm-muscles

# وصف حر مع اسم ملف مخصص
npm run tripo -- --prompt "human heart anatomy cutaway model" --name heart

# كل الأوصاف الجاهزة مع تخفيف عدد المضلعات للمتصفح
npm run tripo -- --all --face-limit 30000

# معاينة ما سيُرسل دون استهلاك رصيد
npm run tripo -- --all --dry-run
```

يمكن تشغيل السكربت مباشرة أيضاً: `node scripts/tripo-fetch.mjs --preset biceps`.

### أهم الخيارات

| الخيار | الوظيفة |
| --- | --- |
| `--preset <key>` | وصف جاهز من `scripts/tripo-presets.json` (يقبل التكرار) |
| `--prompt <text>` | وصف نصي حر (يقبل التكرار) |
| `--all` | توليد كل الأوصاف الجاهزة |
| `--out <dir>` | مجلد الحفظ، الافتراضي `models` |
| `--face-limit <n>` | حد المضلعات؛ ‎30000–40000 مناسب للعرض في المتصفح |
| `--format <FMT>` | تحويل الناتج إلى `FBX` أو `OBJ` أو `USDZ` أو `STL` أو `3MF` |
| `--no-texture` / `--no-pbr` | تقليل حجم الملف بإلغاء الخامات |
| `--seed <n>` | بذرة ثابتة لإعادة إنتاج نفس المجسم |
| `--force` | إعادة التوليد رغم وجود الملف |
| `--api v2` | استخدام الإصدار القديم من الواجهة |

السكربت يتخطى أي مجسم موجود مسبقاً، ويعيد المحاولة تلقائياً عند أخطاء الشبكة
و`429` و`5xx` بتراجع أسّي (2، 4، 8، 16 ثانية).

## 3. المخرجات

- ملفات `models/<name>.glb`
- `models/manifest.json` يسجّل لكل مجسم: الوصف، معرّف المهمة، إصدار النموذج، الحجم، بصمة SHA-256، وتاريخ التوليد.

ملفات GLB قد تتجاوز عدة ميجابايت. قرّر بحسب حاجتك ما إذا كنت سترفعها إلى Git
أم ستكتفي بـ `manifest.json` وتعيد توليدها عند الحاجة (البذرة `--seed` تساعد على التكرار).

## 4. استخدام المجسم داخل نشاط Babylon.js

ملف `muscle-activity-3d.html` يحمّل `babylonjs.loaders` مسبقاً، لذا يكفي:

```js
BABYLON.SceneLoader.ImportMeshAsync("", "models/", "arm-muscles.glb", scene)
  .then((result) => {
    const root = result.meshes[0];
    root.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
    root.position = new BABYLON.Vector3(0, 1, 0);
  });
```

فتح الصفحة عبر `file://` يمنع تحميل الملف بسبب سياسة CORS، لذا شغّل خادماً محلياً:

```bash
npx serve .
```

## 5. ملاحظات عن الواجهة

- الافتراضي هو الإصدار v3: `POST /v3/generation/text-to-model` ثم `GET /v3/tasks/{task_id}`.
- روابط التنزيل التي تعيدها Tripo **تنتهي صلاحيتها خلال دقائق**، ولهذا ينزّل السكربت الملف فور نجاح المهمة.
- الإصدار v2 (`/v2/openapi/task`) متاح عبر `--api v2` لكن Tripo أعلنت إيقافه؛ استخدمه للتوافق المؤقت فقط.
- كل عملية توليد تستهلك رصيداً من حسابك في Tripo، لذا استخدم `--dry-run` للمراجعة أولاً.

## علاقة هذه الأداة بالمجسمات الجاهزة

إن لم يكن لديك مفتاح API، مجلد `models/` فيه مجسمات تشريحية جاهزة مولّدة محلياً
وقابلة للتعديل — انظر [docs/anatomy-models.md](anatomy-models.md).
