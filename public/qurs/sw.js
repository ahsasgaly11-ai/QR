// عامل الخدمة: يخزّن التطبيق كاملًا عند أول فتح ليعمل دون إنترنت، ويحدّثه في الخلفية عند توفر نسخة أحدث.
const VERSION = 'qurs-v3.3.0';
const SHELL = ['./index.html', './manifest.webmanifest', './config.js', './css/app.css', './vendor/three.module.min.js',
  './js/main.js', './js/vision/worker.js', './js/vision/camera.js', './js/vision/geometry.js', './js/vision/ball-onnx.js', './js/render/arscene.js',
  './js/game/state.js', './js/game/audio.js', './js/content/store.js', './js/content/firebase.js', './js/ui/editor.js', './js/ui/collect.js',
  './sfx/correct.mp3', './sfx/wrong.mp3', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // الخطوط والمكتبات الخارجية: من الشبكة أولًا، وإلا من المخزن إن سبق تحميلها
  if (u.origin !== location.origin) { e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION + '-ext').then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request))); return; }
  // ملفات التطبيق: من المخزن أولًا (سرعة وعمل دون إنترنت)، مع تحديث خلفي
  e.respondWith(caches.match(e.request).then((cached) => { const net = fetch(e.request).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => cached); return cached || net; }));
});
