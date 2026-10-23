// ---------------------------------------------------------------------------
// Worker تتبّع اليد: يشغّل نواة الكشف بعيدًا عن الخيط الرئيسي، فلا يوقف
// الاستدلالُ رسمَ المشهد ثلاثي الأبعاد ولا يوقف الرسمُ الاستدلال. الإطار يصل
// ImageBitmap (نقل بلا نسخ)، وتعود المعالم بإحداثيات كل نافذة.
//
// الرسائل:
//   ← {type:'init', vendor, model, forceCpu}         → {type:'ready', delegate} | {type:'error', code, message}
//   ← {type:'configure', mode, tiles, focus}         → {type:'configured', tiles, focus} | {type:'error', …}
//   ← {type:'frame', images, ts, crops}              → {type:'result', ts, results, ms}
//      images: ImageBitmap لكل نافذة (قُصّت وصُغّرت في الخيط الرئيسي بـ createImageBitmap)
//   ← {type:'close'}
// ---------------------------------------------------------------------------
import { DetectCore } from './detect-core.js';

// محمّل wasm في MediaPipe سكربت كلاسيكي يعرّف ModuleFactory متغيّرًا عامًّا. في Worker
// من نوع module لا يعمل importScripts، فتلجأ MediaPipe إلى self.import(url) إن وُجد:
// نقرأ السكربت ونشغّله في النطاق العام (eval غير مباشر) فيصير ModuleFactory عامًّا.
self.import = async (url) => {
  const src = await (await fetch(url)).text();
  (0, eval)(`${src}\n;self.ModuleFactory = ModuleFactory;`);
};

let core = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      core = new DetectCore({ vendor: m.vendor, model: m.model, forceCpu: !!m.forceCpu });
      await core.init();
      // نجرّب إنشاء كاشف واحد الآن لنعرف الـ delegate المتاح قبل أن يعتمد عليه الخيط الرئيسي
      await core.configure({ mode: 'smart', focus: 0 });
      self.postMessage({ type: 'ready', delegate: core.delegate });
    } else if (m.type === 'configure') {
      const got = await core.configure({ mode: m.mode, tiles: m.tiles, focus: m.focus });
      self.postMessage({ type: 'configured', ...got, delegate: core.delegate });
    } else if (m.type === 'frame') {
      const t0 = performance.now();
      let results = [];
      try {
        results = core.run(null, m.crops, m.ts, m.images); // لا إطار كامل: كل نافذة صورتها الجاهزة
      } finally {
        for (const b of m.images) b?.close?.();
      }
      self.postMessage({ type: 'result', ts: m.ts, results, ms: performance.now() - t0, delegate: core.delegate });
    } else if (m.type === 'close') {
      core?.close();
      core = null;
      self.close();
    }
  } catch (err) {
    const message = String(err?.message || err);
    self.postMessage({ type: 'error', code: message === 'nosimd' ? 'nosimd' : m.type, message });
  }
};
