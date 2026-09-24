const CACHE='coastline-drive-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/manifest.webmanifest','/icons/icon.svg'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(request.mode==='navigate'){try{const response=await fetch(request);cache.put(request,response.clone());return response;}catch{return await cache.match('/')||Response.error();}}
    const saved=await cache.match(request);if(saved)return saved;
    try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}catch{return Response.error();}
  })());
});
