# شخصية المترجم ثلاثية الأبعاد — خطّ البناء

شخصية المترجم (`public/sign/avatar/signer.glb`) **مملوكة للمنصّة بالكامل**: تُبنى من
بيانات مشروع MakeHuman المنشورة برخصة **CC0** (شبكة الجسم الأساسية، أهداف الشكل،
تعريف الهيكل وأوزانه، وحدات تعابير الوجه) بسكربتاتنا هنا، دون أي أصول مملوكة لغير
المنصّة، فيمكن طرحها تجاريًّا بلا قيود ترخيص.

| الملف | الدور |
|---|---|
| `character.py` | هوية الشخصية: مقادير الشكل (الجنس، العمر، البنية، الملامح) والألوان (البشرة، الشفاه، الشعر، القزحية، الثوب، الغترة، العقال) |
| `mh_common.py` | قراءة `base.obj` وتطبيق الأهداف ومراكز المفاصل، وخريطة تعابير الوجه (23 تعبيرًا ← وحدات MakeHuman) |
| `skin_texture.py` | يولّد نسيج البشرة `skin.jpg` (الحاجبان، اللحية القصيرة، الشفاه، الاحمرار، الأظافر…) ونسيج العين `iris.png` |
| `render_front.py` | داخل Blender: رسم الرأس من الأمام بكاميرا متعامدة معروفة (لاستخراج معالم وجه الشخصية) |
| `face_from_photo.py` | يُسقط وجه الصورة المرجعية `reference/signer-ref.png` على نسيج الرأس: معالم MediaPipe في الصورة وفي الرسم الأمامي → تشويه TPS → لون كل تكسل من الصورة، ممزوجًا مع النسيج المولَّد بحسب مواجهة السطح وداخل بيضوي الوجه |
| `build_signer.py` | داخل Blender: الجسم + الهيكل (أذرع وأصابع ورقبة ورأس وعينان) + 23 مفتاح شكل للوجه + الثوب والغترة والعقال + التصدير إلى GLB مع `signer.json` (مواضع المفاصل المرجعية للمحرّك) |

## إعادة البناء

```bash
# 1) بيانات MakeHuman (CC0): نزّل حزمة إضافة MPFB وفكّها — نستعمل ملفّات data/ فقط
curl -L -o mpfb.zip 'https://extensions.blender.org/add-ons/mpfb/'   # اختر رابط التنزيل من الصفحة
unzip -q mpfb.zip -d mpfb && export MHDATA=$PWD/mpfb/data

# 2) Blender 4.2 LTS (يعمل بلا واجهة)
curl -L -o blender.tar.xz https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz
tar -xJf blender.tar.xz && export BLENDER=$PWD/blender-4.2.23-linux-x64/blender

# 3) النسيج المولَّد، ثم بناء أوّلي، ثم إسقاط وجه الصورة المرجعية، ثم البناء النهائي
curl -L -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3 scripts/avatar/skin_texture.py --mhdata $MHDATA --out public/sign/avatar
$BLENDER -b --python scripts/avatar/build_signer.py -- --mhdata $MHDATA --out public/sign/avatar
$BLENDER -b --python scripts/avatar/render_front.py -- --glb public/sign/avatar/signer.glb --out /tmp/front
python3 scripts/avatar/face_from_photo.py --mhdata $MHDATA --photo scripts/avatar/reference/signer-ref.png \
    --front /tmp/front --model face_landmarker.task --out public/sign/avatar
$BLENDER -b --python scripts/avatar/build_signer.py -- --mhdata $MHDATA --out public/sign/avatar
```

**الصورة المرجعية** (`reference/signer-ref.png`) هي هوية الشخصية: ملامح الوجه والبشرة
تُؤخذ منها، وتُقاس نسب الوجه (العرض/الطول، الفكّ، الفم، الأنف) لضبط أهداف الشكل في
`character.py`. استبدلها بصورة أمامية أخرى وأعد الخطوة 3 لتغيير الشخصية.

يستغرق البناء دقيقة تقريبًا. عدّل `character.py` لتغيير الشكل أو الألوان ثم أعد الخطوة 3.

## كيف يتحرّك

`src/components/sign-avatar-3d.tsx` يحمّل الـGLB ويحرّك عظامه من بنك الحركات
(`public/sign/poses/*.json`) بعد إعادة الاستهداف في `src/lib/sign-motion.ts`:

- **الذراعان**: الحركية العكسية إلى موضع المعصم المقاس، مع لفّ العضد ليواجه المرفقُ
  مستوى الثني، ولفّ الساعد (كبّ/بسط) مستمدًّا من اتجاه راحة اليد.
- **الأصابع (تشريحيًّا)**: `src/lib/sign-hand.ts` يقيس من معالم اليد بالمتر زوايا
  المفاصل في إطار الكفّ (ثني MCP وتبعيده، PIP وDIP مفصلا ثني فقط في مستوى الإصبع)،
  ويقيّدها بالحدود الطبيعية، ويحسم أشكال اليد (إصبع مطويّ/مفرود)، ثم يبني يد
  الشخصية بأطوال عظامها هي — فلا ينثني إصبع جانبيًّا ولا للخلف ولا يتمطّط.
- **التصادم**: `src/lib/sign-collide.ts` يمنع اليدين والساعدين والمرفقين من اختراق
  الثوب والغترة والوجه (مجسّم تصادم مخبوز في `signer.json`)، وإشارات التلامس مع
  الوجه تُقاس نسبةً إلى فم المؤدّي فتصل يد الشخصية إلى الموضع نفسه من وجهها.
- **الكفّ**: اتجاهها من إطار معالمها الأربعة (الرسغ وقواعد الأصابع)، وكل سلامية
  إصبع تُوجَّه نحو معلمها التالي.
- **الرأس والرقبة والجذع**: من بيانات المؤدّي، والعينان تنظران إلى المشاهد.
- **الوجه**: 23 مفتاح شكل (الحاجبان، الجفون، الفكّ، الفم، الخدّان) من تعابير المؤدّي
  — العلامات غير اليدوية جزء من قواعد لغة الإشارة.
- في السكون: تنفّس ورمش وحركة رأس خفيفة؛ وبين الإشارات انتقال سلس بلا عودة إلى
  وضع الراحة.

`signer.json` يحمل مواضع المفاصل في وضع الراحة (كتفان، مرفقان، رسغان، 21 معلمًا
لكل كفّ، الرأس) بالترتيب نفسه الذي يعطيه MediaPipe، فيُقاس كل مقطع على جسم الشخصية.
