import { useEffect, useState } from "react";

/**
 * Hash routes, so the site works on any static host:
 *   #/                  the gallery (filters in the query: #/?type=dry&q=elk)
 *   #/fly/<id>          a pattern
 *   #/fly/<id>/<step>   a pattern at a step (1-based)
 * Old links of the form #/<id> are understood as #/fly/<id>.
 */
export type Route =
  | { page: "gallery"; query: string }
  | { page: "fly"; id: string; step?: number }
  | { page: "not-found"; path: string };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [path = "", query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: "gallery", query };
  if (parts[0] === "fly" && parts[1]) {
    const step = Number(parts[2]);
    return { page: "fly", id: parts[1], ...(Number.isInteger(step) && step > 0 ? { step } : {}) };
  }
  if (parts.length === 1) return { page: "fly", id: parts[0]! };
  return { page: "not-found", path };
}

export const href = {
  gallery: (query = "") => (query ? `#/?${query}` : "#/"),
  fly: (id: string, step?: number) => `#/fly/${encodeURIComponent(id)}${step ? `/${step}` : ""}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Changes the URL without adding a history entry (for filters and step changes). */
export function replaceHash(hash: string) {
  if (location.hash !== hash) history.replaceState(null, "", hash);
}
