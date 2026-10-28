import type { Recipe } from "./schema";

export interface CatalogError {
  file: string;
  message: string;
  /** Where in the recipe the problem is, for its line (see `locate`). */
  path: string[];
}

/** Rules that span several recipes: unique ids, and variants pointing at a main pattern. */
export function validateCatalog(entries: { file: string; recipe: Recipe }[]): CatalogError[] {
  const errors: CatalogError[] = [];
  const byId = new Map<string, { file: string; recipe: Recipe }>();
  for (const e of entries) {
    const other = byId.get(e.recipe.id);
    if (other) errors.push({ file: e.file, message: `id "${e.recipe.id}" is also used by ${other.file}`, path: ["id"] });
    else byId.set(e.recipe.id, e);
    if (e.file !== `${e.recipe.id}.kdl`) {
      errors.push({ file: e.file, message: `file name should match the id: ${e.recipe.id}.kdl`, path: ["id"] });
    }
  }
  for (const e of entries) {
    const target = e.recipe.variantOf;
    if (target === undefined) continue;
    const main = byId.get(target);
    if (!main) errors.push({ file: e.file, message: `variant-of "${target}": no such pattern`, path: ["variantOf"] });
    else if (main.recipe.variantOf !== undefined) {
      errors.push({ file: e.file, message: `variant-of "${target}" is itself a variant; point at the main pattern`, path: ["variantOf"] });
    }
  }
  return errors;
}
