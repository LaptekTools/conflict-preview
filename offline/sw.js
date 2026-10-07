/* Own bounded static cache. No user files, reports, arbitrary requests or origin-wide deletes. */
const HASHES={"index.html": "1ae9fb9ab2a40f35063e194f10ebb3b615ad8069b04a21760716cead9b9f31a2", "manifest.webmanifest": "a42a002f70edb023f32cfb7f55b09aff4cf6ff59784afb44d8801c095831e0a4", "icon192.png": "230734cbc7c69b43e0bb116ecb5dfedb20dc69217616210c4aab771b07bdb8d6", "icon512.png": "0d94b86c150b45ae76b49c4acf6f098fba913a35c5a75088474ee0cd7c45894e"};
const PREFIX='laptek-conflict-offline:'+self.location.origin+':'+new URL('./',self.location.href).pathname+':';
const CACHE=PREFIX+"9dc698302973cb3cec83";
const URLS=Object.keys(HASHES).map(n=>new URL(n,self.registration.scope).href);
async function installAssets(){
  if((await caches.keys()).includes(CACHE)){
    const existing=await caches.open(CACHE);
    for(const [name,expected] of Object.entries(HASHES)){
      const saved=await existing.match(new URL(name,self.registration.scope).href);
      if(!saved)throw new Error('Existing cache incomplete; remove the offline copy and revisit online');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await saved.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==expected)throw new Error('Existing cache mismatch; remove the offline copy and revisit online');
    }
    return;
  }
  const verified=[];
  for(const [name,expected] of Object.entries(HASHES)){
    const url=new URL(name,self.registration.scope).href;
    const response=await fetch(url,{cache:'no-store',credentials:'omit'});
    if(!response.ok||response.type==='opaque')throw new Error('Asset unavailable: '+name);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==expected)throw new Error('Asset revision mismatch: '+name);
    verified.push([url,response]);
  }
  const cache=await caches.open(CACHE);
  try {for(const [url,response] of verified)await cache.put(url,response);}
  catch(e){await caches.delete(CACHE);throw e;}
}
self.addEventListener('install',event=>event.waitUntil(installAssets()));
// No skipWaiting: old controlled tabs remain coherent; activate after they close.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const rootNavigation=event.request.mode==='navigate'&&event.request.url===self.registration.scope;
  if(event.request.method!=='GET'||(!rootNavigation&&!URLS.includes(event.request.url)))return;
  event.respondWith((async()=>{
    const response=await (await caches.open(CACHE)).match(rootNavigation?new URL('index.html',self.registration.scope).href:event.request.url);
    if(response)return response;
    return new Response('Offline application asset unavailable. Connect and remove the offline copy and revisit online.',{status:503,headers:{'Content-Type':'text/plain'}});
  })());
});
