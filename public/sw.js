// Flybench service worker: makes the site work offline once visited.
// Same-origin GET requests are answered from the cache when possible and refreshed
// from the network in the background (stale-while-revalidate).
const CACHE = "flybench-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./", "./manifest.webmanifest", "./favicon.svg", "./logo.svg"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Every page is the same app; a page not visited before falls back to the front page's
      // HTML when offline, and the app shows the right page for the address.
      const navigation = request.mode === "navigate";
      const cached = (await cache.match(request, { ignoreSearch: navigation })) ?? (navigation ? await cache.match("./") : undefined);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});
