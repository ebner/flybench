import { MATERIALS, type MaterialKind } from "../recipe/materials";
import type { Material, Recipe } from "../recipe/schema";

/**
 * The materials inventory: what a tyer owns, as "kind:colour" entries. A material in a
 * recipe is matched exactly when its kind and colour are owned, and counts as a
 * substitute when the kind is owned in another colour. Hooks and thread are assumed.
 */

export interface Need {
  kind: MaterialKind;
  color: string;
}

/** The colour a recipe material is used in: its own, the catalog default, or "natural". */
export function materialColor(m: Material): string {
  const cat = MATERIALS[m.kind];
  return m.color ?? ("defaultColor" in cat ? cat.defaultColor : "natural");
}

/** "red", "red brown"; hex colours and the material's own default colour read as "natural". */
export function colorWord(color: string, kind?: MaterialKind): string {
  const cat = kind ? MATERIALS[kind] : undefined;
  const isDefault = cat !== undefined && "defaultColor" in cat && cat.defaultColor === color;
  return color.startsWith("#") || color === "natural" || isDefault ? "natural" : color.replace(/-/g, " ");
}

export const inventoryKey = (n: Need) => `${n.kind}:${n.color}`;

export function needs(recipe: Recipe): Need[] {
  const seen = new Map<string, Need>();
  for (const m of recipe.materials) {
    const n = { kind: m.kind, color: materialColor(m) };
    seen.set(inventoryKey(n), n);
  }
  return [...seen.values()];
}

export type Match = "have" | "substitute" | "missing";

export function match(n: Need, owned: Set<string>): Match {
  if (owned.has(inventoryKey(n))) return "have";
  for (const k of owned) if (k.startsWith(`${n.kind}:`)) return "substitute";
  return "missing";
}

export interface Coverage {
  recipe: Recipe;
  missing: Need[];
  substitutes: Need[];
}

/**
 * How many materials still have to be bought: colours of one kind count once, since any
 * colour of a kind stands in for the others (see `match`).
 */
export function missingKinds(c: Coverage): number {
  return new Set(c.missing.map((n) => n.kind)).size;
}

/** The member of a pattern family closest to tieable: each variant is a complete recipe of its own. */
export function bestCoverage(recipes: Recipe[], owned: Set<string>): Coverage {
  return recipes.map((r) => coverage(r, owned)).reduce((best, c) => (missingKinds(c) < missingKinds(best) ? c : best));
}

export function coverage(recipe: Recipe, owned: Set<string>): Coverage {
  const missing: Need[] = [];
  const substitutes: Need[] = [];
  for (const n of needs(recipe)) {
    const m = match(n, owned);
    if (m === "missing") missing.push(n);
    if (m === "substitute") substitutes.push(n);
  }
  return { recipe, missing, substitutes };
}

/** Every material and colour the catalog uses, grouped by kind. */
export function catalogNeeds(recipes: Recipe[]): Map<MaterialKind, string[]> {
  const byKind = new Map<MaterialKind, Set<string>>();
  for (const r of recipes) for (const n of needs(r)) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, new Set());
    byKind.get(n.kind)!.add(n.color);
  }
  return new Map([...byKind].map(([k, colors]) => [k, [...colors].sort()]));
}
