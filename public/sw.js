// Flybench service worker: makes the site work offline once visited.
// Same-origin GET requests are answered from the cache when possible and refreshed
// from the network in the background (stale-while-revalidate).

// The build (scripts/prerender.ts) fills these in: a cache name per build, so a new
// deployment replaces the old cache, and the app's own files (scripts, styles, fonts),
// which the first visit loads before this worker is running.
const CACHE = "flybench-dev";
const SHELL = ["./", "./manifest.webmanifest", "./favicon.svg", "./logo.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
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
      // The site's files are the same whatever Origin or encoding was asked for, so Vary
      // headers (Vary: Origin from module scripts) must not stop a cached copy from matching.
      const options = { ignoreSearch: navigation, ignoreVary: true };
      const cached = (await cache.match(request, options)) ?? (navigation ? await cache.match("./", options) : undefined);
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
