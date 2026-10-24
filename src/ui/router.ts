import { useEffect, useState } from "react";

/**
 * Real paths under the site's base, so every page has its own address for sharing and
 * search (the build writes an HTML file for each, see scripts/prerender.ts):
 *   /                      the gallery (filters in the query: /?type=dry&q=elk)
 *   /fly/<id>/             a pattern; /fly/<id>/?step=<n> at a step (1-based)
 *   /techniques/           the techniques index; /technique/<id>/ one technique
 *   /learn/                the learning path
 *   /about/                what Flybench is
 *   /box/                  the user's fly box; /materials/ their materials inventory
 * Older hash links (#/fly/<id>/<step>, #/<id>, #/?type=dry) are redirected (see `legacyRoute`).
 */
export type Route =
  | { page: "gallery"; query: string }
  | { page: "fly"; id: string; step?: number }
  | { page: "techniques" }
  | { page: "technique"; id: string }
  | { page: "learn" }
  | { page: "about" }
  | { page: "box" }
  | { page: "materials" }
  | { page: "not-found"; path: string };

const BASE = import.meta.env.BASE_URL;

const SINGLE = ["techniques", "learn", "about", "box", "materials"] as const;

/** Parses a path relative to the site's base, with its query: "fly/red-tag/?step=4". */
export function parseRoute(relative: string): Route {
  const [path = "", query = ""] = relative.replace(/^\/+/, "").split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: "gallery", query };
  if (parts[0] === "fly" && parts[1] && parts.length <= 3) {
    // The step used to be a path segment; it is a query parameter now.
    const step = Number(parts[2] ?? params.get("step"));
    return { page: "fly", id: parts[1], ...(Number.isInteger(step) && step > 0 ? { step } : {}) };
  }
  if (parts.length === 1) {
    const single = SINGLE.find((p) => p === parts[0]);
    if (single) return { page: single };
  }
  if (parts[0] === "technique" && parts[1] && parts.length === 2) return { page: "technique", id: parts[1] };
  return { page: "not-found", path };
}

/** The page an old hash link (#/fly/red-tag/4, #/red-tag, #/?type=dry) points to, or null. */
export function legacyRoute(hash: string): Route | null {
  if (!hash.startsWith("#/")) return null;
  const raw = hash.slice(2);
  const parts = (raw.split("?")[0] ?? "").split("/").filter(Boolean);
  // #/<id> was the first form of a pattern link.
  const single = parts.length === 1 && !SINGLE.some((p) => p === parts[0]);
  return parseRoute(single ? `fly/${raw}` : raw);
}

export const href = {
  gallery: (query = "") => (query ? `${BASE}?${query}` : BASE),
  fly: (id: string, step?: number) => `${BASE}fly/${encodeURIComponent(id)}/${step ? `?step=${step}` : ""}`,
  techniques: () => `${BASE}techniques/`,
  technique: (id: string) => `${BASE}technique/${encodeURIComponent(id)}/`,
  learn: () => `${BASE}learn/`,
  about: () => `${BASE}about/`,
  box: () => `${BASE}box/`,
  materials: () => `${BASE}materials/`,
};

/** The address of a page. */
export function routeHref(route: Route): string {
  switch (route.page) {
    case "gallery":
      return href.gallery(route.query);
    case "fly":
      return href.fly(route.id, route.step);
    case "technique":
      return href.technique(route.id);
    case "not-found":
      return BASE + route.path;
    default:
      return href[route.page]();
  }
}

/** The current address relative to the base, as `parseRoute` reads it. */
function currentRelative(): string {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  return path + location.search;
}

const NAVIGATE = "flybench:navigate";

/** Goes to an address on this site without reloading the page. */
export function navigate(url: string) {
  history.pushState(null, "", url);
  window.dispatchEvent(new Event(NAVIGATE));
}

/** Changes the address without adding a history entry (for filters and step changes). */
export function replaceUrl(url: string) {
  if (location.pathname + location.search !== url) history.replaceState(null, "", url);
}

/** A click on a plain link to a page of this site, which the app handles itself. */
function internalLink(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  const url = new URL(a.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return null;
  // An #anchor on the same page is left to the browser.
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return null;
  // Links to files (renders, the manifest) are not pages.
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return a;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => {
    const legacy = legacyRoute(location.hash);
    if (legacy) history.replaceState(null, "", routeHref(legacy));
    return legacy ?? parseRoute(currentRelative());
  });
  useEffect(() => {
    const update = () => {
      const legacy = legacyRoute(location.hash);
      if (legacy) history.replaceState(null, "", routeHref(legacy));
      setRoute(legacy ?? parseRoute(currentRelative()));
    };
    const onClick = (e: MouseEvent) => {
      const a = internalLink(e);
      if (!a) return;
      e.preventDefault();
      const url = new URL(a.href);
      navigate(url.pathname + url.search + url.hash);
    };
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    window.addEventListener(NAVIGATE, update);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      window.removeEventListener(NAVIGATE, update);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return route;
}
