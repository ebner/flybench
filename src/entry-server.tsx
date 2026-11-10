import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { LANGS } from "./i18n/lang";
import { loadLanguage } from "./i18n/load";
import { App } from "./ui/App";
import { setServerPath } from "./ui/router";

/**
 * The app drawn without a browser, for the pages built ahead of time (scripts/prerender.ts):
 * the HTML the app itself makes for a page, which the app then takes over in the browser
 * without drawing it again (see main.tsx). Built on its own by `vite build --ssr`.
 */

/** Which pages are built this way so far; the others keep their plain text until the app draws them. */
export function hydrated(path: string): boolean {
  return ["", "about/", "learn/", "techniques/", "naturals/"].includes(path) || /^(fly|technique|natural)\/[^/]+\/$/.test(path);
}

/** Every language's words, which a page in that language needs before it is drawn. */
export async function loadLanguages(): Promise<void> {
  for (const l of LANGS) await loadLanguage(l);
}

/** The app's HTML for a page: its path under the base, with its language ("sv/about/", "" for the front page). */
export async function renderPage(path: string): Promise<string> {
  setServerPath(path);
  // Waits for the pages whose code is fetched on demand in the browser.
  const { prelude } = await prerender(
    <StrictMode>
      <App prerendered />
    </StrictMode>,
    // Everything in place in the HTML: by default React puts a large part of a page at its end,
    // hidden, and moves it in with a script, which shows the footer first and then shifts it down.
    { progressiveChunkSize: 64 * 1024 * 1024 },
  );
  return new Response(prelude).text();
}
