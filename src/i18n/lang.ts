/**
 * The site's languages. English is at the site's root, the others under their code
 * (/sv/fly/adams/). The language of the page being shown is module state, set by the router
 * from the address, so links and text built anywhere follow it.
 */
export const LANGS = ["en", "sv", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** Each language in its own words, for the language switch. */
export const LANG_NAMES: Record<Lang, string> = { en: "English", sv: "Svenska", de: "Deutsch" };

let current: Lang = "en";

export const lang = (): Lang => current;

export function setLang(l: Lang) {
  current = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

/** Runs `fn` as if the page were in `l`: for links to the same page in another language. */
export function inLang<T>(l: Lang, fn: () => T): T {
  const before = current;
  current = l;
  try {
    return fn();
  } finally {
    current = before;
  }
}

/** The path segment before a page's own path: "" for English, "sv/" for Swedish. */
export const langPrefix = (l: Lang = current): string => (l === "en" ? "" : `${l}/`);

/** "sv/fly/adams/?step=2" → ["sv", "fly/adams/?step=2"]; no language segment is English. */
export function splitLang(relative: string): [Lang, string] {
  const trimmed = relative.replace(/^\/+/, "");
  const first = trimmed.split(/[/?]/)[0] ?? "";
  const l = LANGS.find((x) => x !== "en" && x === first);
  return l ? [l, trimmed.slice(first.length).replace(/^\//, "")] : ["en", trimmed];
}
