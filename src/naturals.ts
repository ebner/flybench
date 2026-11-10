import type { Natural } from "./recipe/natural";
// Read and checked when the site is built (scripts/catalog-plugin.ts).
import catalog from "virtual:flybench/catalog";
import { lang } from "./i18n/lang";
import { naturalInPageLanguage } from "./i18n/prose";

/** Problems with natural files, as "file: message" lines. Naturals with errors are left out. */
export const NATURAL_ERRORS: string[] = catalog.naturalErrors;

export const NATURALS: Natural[] = [...catalog.naturals].sort((a, b) => a.name.localeCompare(b.name));

/** The naturals with their names and descriptions in the page's language, by name. */
export function localNaturals(): Natural[] {
  return NATURALS.map((n) => naturalInPageLanguage(n)).sort((a, b) => a.name.localeCompare(b.name, lang()));
}

/** A natural, its prose in the page's language. */
export function findNatural(id: string): Natural | undefined {
  const n = NATURALS.find((x) => x.id === id);
  return n && naturalInPageLanguage(n);
}
