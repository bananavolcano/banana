/* 周期伴行 · 离线缓存：只缓存本应用静态资源与识别模型 CDN，天气接口保持联网。 */
const CACHE='cycle-companion-v15';
const ASSETS=['./','./index.html','./styles.css','./core.js','./food-data.js','./app.js','./recognizer.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===location.origin){e.respondWith(caches.match(req).then(r=>r||fetch(req)));return;}
  if(/cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|cdn\.jsdmirror\.com|unpkg\.com|huggingface\.co|hf-mirror\.com/.test(url.host)){e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);const net=fetch(req).then(res=>{if(res&&res.status===200)c.put(req,res.clone());return res;}).catch(()=>hit);return hit||net;}));}
});
