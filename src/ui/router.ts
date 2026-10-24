import { useEffect, useState } from "react";

/**
 * Hash routes, so the site works on any static host:
 *   #/                  the gallery (filters in the query: #/?type=dry&q=elk)
 *   #/fly/<id>          a pattern
 *   #/fly/<id>/<step>   a pattern at a step (1-based)
 *   #/techniques        the techniques index; #/technique/<id> one technique
 *   #/learn             the learning path
 *   #/box               the user's fly box; #/materials their materials inventory
 * Old links of the form #/<id> are understood as #/fly/<id>.
 */
export type Route =
  | { page: "gallery"; query: string }
  | { page: "fly"; id: string; step?: number }
  | { page: "techniques" }
  | { page: "technique"; id: string }
  | { page: "learn" }
  | { page: "box" }
  | { page: "materials" }
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
  if (parts[0] === "techniques" && parts.length === 1) return { page: "techniques" };
  if (parts[0] === "technique" && parts[1]) return { page: "technique", id: parts[1] };
  if (parts[0] === "learn" && parts.length === 1) return { page: "learn" };
  if (parts[0] === "box" && parts.length === 1) return { page: "box" };
  if (parts[0] === "materials" && parts.length === 1) return { page: "materials" };
  if (parts.length === 1) return { page: "fly", id: parts[0]! };
  return { page: "not-found", path };
}

export const href = {
  gallery: (query = "") => (query ? `#/?${query}` : "#/"),
  fly: (id: string, step?: number) => `#/fly/${encodeURIComponent(id)}${step ? `/${step}` : ""}`,
  techniques: () => "#/techniques",
  technique: (id: string) => `#/technique/${encodeURIComponent(id)}`,
  learn: () => "#/learn",
  box: () => "#/box",
  materials: () => "#/materials",
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
