import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App, preloadPage } from "./ui/App";
import { splitLang } from "./i18n/lang";
import { loadLanguage } from "./i18n/load";
import { watchForUpdates } from "./ui/update";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/400-italic.css";
import "@fontsource/spectral/600.css";
import "./ui/styles.css";

// Offline support in the built site; the dev server always serves fresh files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // Without a service worker the site still works, just not offline.
  });
  // Files this visit loaded, or started loading, before the worker was running (gallery
  // pictures): it caches them as each one finishes, including those that finish later.
  navigator.serviceWorker.ready.then((registration) => {
    new PerformanceObserver((list) => {
      registration.active?.postMessage({ type: "cache", urls: list.getEntries().map((e) => e.name) });
    }).observe({ type: "resource", buffered: true });
  });
  // A new deployment's worker taking over gets the whole list again; a page that an earlier
  // worker served is now out of date, and says so.
  watchForUpdates(navigator.serviceWorker);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const urls = performance.getEntriesByType("resource").map((e) => e.name);
    navigator.serviceWorker.controller?.postMessage({ type: "cache", urls });
  });
}

// A Swedish or German page first fetches its language's words; the prerendered page shows meanwhile.
const base = import.meta.env.BASE_URL;
const [first, relative] = splitLang(location.pathname.startsWith(base) ? location.pathname.slice(base.length) : "");
// With the page's own code, where that is fetched on demand: the app takes a page over whole.
Promise.all([loadLanguage(first), preloadPage(relative)])
  .catch(() => {
    // Offline and never fetched: the app still starts; the page shows what it can.
  })
  .finally(() => {
    const root = document.getElementById("root")!;
    // A page built ahead of time as the app itself draws it (its root says for which address)
    // is taken over as it stands. Anything else is drawn afresh: a page not built that way yet,
    // an address with filters or a step in it, the front page standing in for another offline.
    const here = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : null;
    const prerendered = root.dataset.page !== undefined && root.dataset.page === here && !location.search && !location.hash.startsWith("#/");
    const app = (
      <StrictMode>
        <App prerendered={prerendered} />
      </StrictMode>
    );
    if (prerendered) hydrateRoot(root, app);
    else createRoot(root).render(app);
  });
