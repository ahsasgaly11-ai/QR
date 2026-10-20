# MediaPipe Tasks Vision

نسخة محلية من `@mediapipe/tasks-vision@0.10.35` (رخصة Apache-2.0، © Google LLC):
`vision_bundle.mjs` و`wasm/vision_wasm_internal.{js,wasm}` (نسخة SIMD فقط؛ تعمل على iPadOS 16.4 فأحدث).

نموذج اليد `../../models/hand_landmarker.task` من
`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
(رخصة Apache-2.0).

تُستضاف محليًا لأن سياسة أمان المحتوى في الموقع لا تسمح بالسكربتات من خوادم أخرى،
ولتعمل اللعبة في الصف دون الاعتماد على خوادم خارجية.

للتحديث:
```bash
npm pack @mediapipe/tasks-vision@<الإصدار> && tar xzf mediapipe-tasks-vision-*.tgz
cp package/vision_bundle.mjs public/asnan/vendor/mediapipe/
cp package/wasm/vision_wasm_internal.{js,wasm} public/asnan/vendor/mediapipe/wasm/
```
