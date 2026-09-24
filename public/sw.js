const CACHE='coastline-drive-v1.1.0';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/manifest.webmanifest','/icons/icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('coastline-drive-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put('/',copy));}
      return response;
    }).catch(async()=>await (await caches.open(CACHE)).match('/')||Response.error()));
    return;
  }
  if(new URL(request.url).pathname.startsWith('/assets/'))event.respondWith(caches.open(CACHE).then(async cache=>{
    const saved=await cache.match(request);if(saved)return saved;
    const response=await fetch(request);if(response.ok)void cache.put(request,response.clone());return response;
  }));
});
