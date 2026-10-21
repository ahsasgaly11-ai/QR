# three.js (محلي)

نسخة محلية من `three@0.186.1` (رخصة MIT، © three.js authors — ملف `LICENSE`)، مصغّرة من `build/` في حزمة npm:

| الملف | الغرض |
|---|---|
| `three.core.min.js` | النواة المشتركة (يستوردها الملفّان التاليان) |
| `three.webgpu.min.js` | محرّك WebGPU مع الرجوع التلقائي إلى WebGL2 (`WebGPURenderer`) + المواد العقدية |
| `three.tsl.min.js` | دوال TSL (تستورد `three/webgpu` عبر خريطة الاستيراد) |
| `three.module.min.js` | المحرّك القديم `WebGLRenderer` (لعبة «عالَمٌ تحت العدسة») |

**ألعاب النخبة (WebGPU + TSL)** تضع خريطة الاستيراد في `index.html` قبل سكربت اللعبة (كما في أمثلة three.js الرسمية):
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
```
ثم جرّب كل الألعاب ثلاثية الأبعاد (`?sim`، و`?tier=A|B|C` في ألعاب النخبة) قبل الدمج.
