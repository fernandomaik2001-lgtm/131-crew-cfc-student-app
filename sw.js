// Only static, same-origin assets are cached. Never cache Supabase responses or member data.
const STATIC_CACHE='crew131-static-v2';
const STATIC=['./','./index.html','./style.css','./app.js','./icon.svg','./manifest.webmanifest'];
const ALLOWED=new Set(STATIC.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==STATIC_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!ALLOWED.has(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(event.request,copy))}
    return response;
  }).catch(()=>caches.match(event.request)));
});