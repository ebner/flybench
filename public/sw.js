// Flybench service worker: makes the site work offline once visited.
// Same-origin GET requests are answered from the cache when possible and refreshed
// from the network in the background (stale-while-revalidate).

// The build (scripts/prerender.ts) fills these in: a cache name per build, so a new
// deployment replaces the old cache, and the app's own files, which the first visit loads
// before this worker is running. Fonts are worth having offline but not essential.
const CACHE = "flybench-dev";
const SHELL = ["./", "./manifest.webmanifest", "./favicon.svg", "./logo.svg"];
const FONTS = [];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      // One font failing to load must not cost the rest of the offline copy.
      await Promise.all(FONTS.map((font) => cache.add(font).catch(() => {})));
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Other sites on the same origin (a GitHub Pages user site) have their own caches.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("flybench-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const navigation = request.mode === "navigate";
      // The site's files are the same whatever Origin or encoding was asked for, so Vary
      // headers (Vary: Origin from module scripts) must not stop a cached copy from matching.
      const options = { ignoreSearch: navigation, ignoreVary: true };
      const cached = await cache.match(request, options);
      const network = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        network.catch(() => {});
        return cached;
      }
      // Not cached yet: the network. Offline, any page falls back to the front page's HTML,
      // and the app shows the right page for the address.
      return network.catch(async () => (navigation ? await cache.match("./", options) : undefined) ?? Response.error());
    }),
  );
});
