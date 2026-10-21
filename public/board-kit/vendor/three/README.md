# three.js (محلي)

نسخة محلية من `three@0.186.1` (رخصة MIT، © three.js authors — ملف `LICENSE`)، مصغّرة من `build/` في حزمة npm:

| الملف | الغرض |
|---|---|
| `three.core.min.js` | النواة المشتركة (يستوردها الملفّان التاليان) |
| `three.webgpu.min.js` | محرّك WebGPU مع الرجوع التلقائي إلى WebGL2 (`WebGPURenderer`) + المواد العقدية |
| `three.tsl.min.js` | دوال TSL (تستورد `three/webgpu` عبر خريطة الاستيراد) |
| `three.module.min.js` | **المسار السينمائي الأساسي** `WebGLRenderer` (الملف 10؛ «صيّادو الجراثيم» و«عالَمٌ تحت العدسة») |
| `addons/` | إضافات من `examples/jsm` للنسخة نفسها كما هي (بلا تصغير): المعالجة اللاحقة (`EffectComposer` و`RenderPass` و`UnrealBloomPass` و`ShaderPass` و`OutputPass` ومظلِّلاتها)، و`environments/RoomEnvironment.js`، و`loaders/GLTFLoader.js` مع `utils/`، و`libs/meshopt_decoder.module.js` |

**المسار السينمائي (الأساسي، الملف 10):**
```html
<script type="importmap">{ "imports": {
  "three": "/board-kit/vendor/three/three.module.min.js",
  "three/addons/": "/board-kit/vendor/three/addons/"
} }</script>
```

**المسار الاختياري (WebGPU + TSL)** يضع خريطة الاستيراد في `index.html` قبل سكربت اللعبة (كما في أمثلة three.js الرسمية):
```html
<script type="importmap">{ "imports": {
  "three": "/board-kit/vendor/three/three.webgpu.min.js",
  "three/webgpu": "/board-kit/vendor/three/three.webgpu.min.js",
  "three/tsl": "/board-kit/vendor/three/three.tsl.min.js"
} }</script>
```
لا تستورد `three.module.min.js` في صفحة تستعمل `three/webgpu`: الأضواء والمواد من نسخة لا تعمل مع محرّك الأخرى.

تُستضاف محليًا لأن سياسة أمان المحتوى في الموقع لا تسمح بالسكربتات من خوادم أخرى.
النسخة هنا قد تسبق نسخة `three` في `package.json` (التي يستعملها تطبيق Next.js نفسه): الألعاب تستعمل هذه الملفات فقط.

للتحديث (حزمة npm الحديثة لا تحوي ملفات `.min.js`، فنصغّرها):
```bash
npm pack three@<الإصدار> && tar xzf three-*.tgz
for f in three.core three.module three.webgpu three.tsl; do
  npx esbuild package/build/$f.js --minify --format=esm --legal-comments=inline --outfile=public/board-kit/vendor/three/$f.min.js
done
sed -i 's#"./three.core.js"#"./three.core.min.js"#g' public/board-kit/vendor/three/*.min.js
cp package/LICENSE public/board-kit/vendor/three/LICENSE
# الإضافات كما هي (تحفظ المجلدات): انسخ من package/examples/jsm/ الملفات المذكورة في الجدول أعلاه إلى addons/
```
ثم جرّب كل الألعاب ثلاثية الأبعاد (`?sim`، و`?tier=A|B|C` في ألعاب النخبة) قبل الدمج.

## الإضافات (`addons/`)
ملفات من `examples/jsm/` في `three@0.186.1` نفسها، بمجلداتها، عبر خريطة الاستيراد `"three/addons/": "/board-kit/vendor/three/addons/"`:

| الملف | الغرض | المسار |
|---|---|---|
| `postprocessing/{EffectComposer,RenderPass,ShaderPass,MaskPass,Pass,UnrealBloomPass,OutputPass}.js` و`shaders/{CopyShader,LuminosityHighPassShader,OutputShader}.js` | المعالجة اللاحقة للمسار السينمائي `WebGLRenderer` (الملف 10) | WebGL |
| `tsl/display/BloomNode.js` | التوهّج بعقد TSL مع `RenderPipeline` | WebGPU |
| `environments/RoomEnvironment.js` | الإضاءة البيئية المنعكسة (PMREM) | الاثنان |
| `geometries/RoundedBoxGeometry.js`، `utils/BufferGeometryUtils.js` | صناديق بحواف مستديرة، وأدوات الهندسة | الاثنان |

للتحديث: `cp node_modules/three/examples/jsm/<المسار> public/board-kit/vendor/three/addons/<المسار>` بالنسخة نفسها.
