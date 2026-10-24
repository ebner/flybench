import { validateCatalog } from "./recipe/catalog";
import { formatError } from "./recipe/errors";
import { loadRecipe } from "./recipe/load";
import type { Recipe } from "./recipe/schema";

const sources = import.meta.glob("../patterns/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export interface Pattern {
  file: string;
  recipe: Recipe;
}

/** Problems with pattern files, as "file: message" lines. Patterns with errors are left out of the catalog. */
export const PATTERN_ERRORS: string[] = [];

const loaded: Pattern[] = [];
for (const [path, text] of Object.entries(sources)) {
  const file = path.split("/").pop()!;
  const result = loadRecipe(text);
  if (result.ok) loaded.push({ file, recipe: result.recipe });
  else PATTERN_ERRORS.push(...result.errors.map((e) => `${file}: ${formatError(e)}`));
}
PATTERN_ERRORS.push(...validateCatalog(loaded).map((e) => `${e.file}: ${e.message}`));

export const PATTERNS: Pattern[] = loaded.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));

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
