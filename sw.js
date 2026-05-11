const CACHE = "ghostdrop-v3.9";
const ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./app.js",
  "./style.css",
  "./crypto.js",
  "./i18n.js",
  "./storage-b2-client.js",
  "./supabase-config.js",
  "./supabase.min.js",
  "./icon.png",
  "./manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
