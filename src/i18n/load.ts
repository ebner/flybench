import type { Lang } from "./lang";

/**
 * Swedish and German words beyond the interface (the glossary, the translated prose) come in a
 * chunk per language, fetched for the first page in that language: English pages carry none.
 */
const LOADERS: Record<Exclude<Lang, "en">, () => Promise<unknown>> = {
  sv: () => import("./bundles/sv"),
  de: () => import("./bundles/de"),
};

const loaded = new Set<Lang>(["en"]);
const loading = new Map<Lang, Promise<void>>();

export const isLoaded = (l: Lang) => loaded.has(l);

export function loadLanguage(l: Lang): Promise<void> {
  if (l === "en" || loaded.has(l)) return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    p = LOADERS[l]().then(() => {
      loaded.add(l);
    });
    loading.set(l, p);
  }
  return p;
}
