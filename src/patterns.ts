import { lang, type Lang } from "./i18n/lang";
import { inPageLanguage } from "./i18n/prose";
import { partIds } from "./i18n/terms";
import { CatalogSearch, catalogEntries } from "./catalog/search";
import { NAMED_COLORS, type Recipe } from "./recipe/schema";
// Read and checked when the site is built (scripts/catalog-plugin.ts).
import catalog from "virtual:flybench/catalog";

export interface Pattern {
  file: string;
  recipe: Recipe;
}

/** Problems with pattern files, as "file: message" lines. Patterns with errors are left out of the catalog. */
export const PATTERN_ERRORS: string[] = catalog.patternErrors;

export const PATTERNS: Pattern[] = [...catalog.patterns].sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));

/** The part ids the patterns use: the glossaries name them in every language, so own flies use these. */
export const KNOWN_PARTS: readonly string[] = partIds(PATTERNS.map((p) => p.recipe));

const known = new Set(KNOWN_PARTS);
/**
 * The part ids own flies may use: the patterns' own, and ids made of their single words and
 * named colours ("hackle-front", "tail-badger"), which the glossaries name word by word.
 */
export const NAMEABLE_PARTS: ReadonlySet<string> = {
  // Own properties only: "constructor" is no colour.
  has: (id: string) => known.has(id) || id.split("-").every((w) => known.has(w) || Object.hasOwn(NAMED_COLORS, w)),
} as ReadonlySet<string>;

export function findPattern(id: string): Pattern | undefined {
  return PATTERNS.find((p) => p.recipe.id === id);
}

/** The main pattern and its variants, main first. */
export function variantFamily(recipe: Recipe): Pattern[] {
  const mainId = recipe.variantOf ?? recipe.id;
  return PATTERNS.filter((p) => p.recipe.id === mainId || p.recipe.variantOf === mainId).sort(
    (a, b) => Number(a.recipe.variantOf !== undefined) - Number(b.recipe.variantOf !== undefined),
  );
}

export const CATALOG = catalogEntries(PATTERNS.map((p) => p.recipe));
const searches = new Map<Lang, CatalogSearch>();

/** The catalog's search, in the page's language (material names, types, descriptions), made on first use. */
export function catalogSearch(): CatalogSearch {
  const l = lang();
  let s = searches.get(l);
  if (!s) {
    const local = (r: Recipe) => inPageLanguage(r, l);
    s = new CatalogSearch(CATALOG.map((e) => ({ ...e, recipe: local(e.recipe), variants: e.variants.map(local) })));
    searches.set(l, s);
  }
  return s;
}
