/* مختبر العطسة: يعمل دون إنترنت بعد أول فتح */
const V='sneeze-lab-v1', CORE=['./index.html','./alva_ar.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('sneeze-lab-')&&n!==V).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||!u.pathname.startsWith(new URL('./',location.href).pathname))return;
  const page=r.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/');
  if(page){ // stale-while-revalidate: instant from cache, refreshed in the background for next time
    e.respondWith(caches.open(V).then(c=>c.match('./index.html').then(hit=>{const net=fetch(new Request('./index.html',{cache:'no-cache'})).then(res=>{if(res&&res.ok)c.put('./index.html',res.clone());return res}).catch(()=>hit);return hit||net})));return}
  e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res}))));
});
