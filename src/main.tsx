import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./glossaries";
import "./translations";
import { App } from "./ui/App";
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
  // A new deployment's worker taking over gets the whole list again.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const urls = performance.getEntriesByType("resource").map((e) => e.name);
    navigator.serviceWorker.controller?.postMessage({ type: "cache", urls });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
