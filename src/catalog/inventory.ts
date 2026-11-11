import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { mixColours, type Material, type Recipe } from "../recipe/schema";
import { kindName } from "../tying/describe";
import { lang } from "../i18n/lang";

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
    // A blended bunch needs each of its colours.
    for (const color of [materialColor(m), ...mixColours(m)]) {
      const n = { kind: m.kind, color };
      seen.set(inventoryKey(n), n);
    }
  }
  return [...seen.values()];
}

export type Match = "have" | "substitute" | "missing";

/**
 * Kinds that count as each other in the inventory: owning one is owning the other, colour for
 * colour. The dry-fly and the wet-fly cock hackle are one feather to a tyer's box (the catalog
 * tells them apart for how full they are drawn). Decided by the reviewer (2026-11-11).
 */
const SAME_TO_OWN: readonly (readonly MaterialKind[])[] = [["cock-hackle", "wet-fly-cock-hackle"]];

/** A kind and the kinds that count as it when owned. */
function ownedAs(kind: MaterialKind): readonly MaterialKind[] {
  return SAME_TO_OWN.find((group) => group.includes(kind)) ?? [kind];
}

export function match(n: Need, owned: Set<string>): Match {
  const kinds = ownedAs(n.kind);
  if (kinds.some((kind) => owned.has(inventoryKey({ kind, color: n.color })))) return "have";
  for (const k of owned) if (kinds.some((kind) => k.startsWith(`${kind}:`))) return "substitute";
  return "missing";
}

const RANK: Record<Match, number> = { have: 0, substitute: 1, missing: 2 };

/** How far a recipe's material is owned: a blended bunch only as well as its least-owned colour. */
export function materialMatch(m: Material, owned: Set<string>): Match {
  return [materialColor(m), ...mixColours(m)]
    .map((color) => match({ kind: m.kind, color }, owned))
    .reduce((worst, x) => (RANK[x] > RANK[worst] ? x : worst));
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
  return new Set(c.missing.map((n) => ownedAs(n.kind)[0])).size;
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

export interface ShoppingItem {
  need: Need;
  /** Not owned at all, or owned in another colour that could stand in. */
  status: "missing" | "substitute";
  /** The flies that need it. */
  flies: Recipe[];
}

/**
 * What to buy to tie these flies: their materials merged (one line per material and colour,
 * with the flies needing it), less what is owned. Missing ones first, then those owned in
 * another colour; by material name within each.
 */
export function shoppingList(recipes: Recipe[], owned: Set<string>): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const r of recipes) {
    for (const n of needs(r)) {
      const status = match(n, owned);
      if (status === "have") continue;
      const key = inventoryKey(n);
      const item = items.get(key) ?? { need: n, status, flies: [] };
      if (!item.flies.includes(r)) item.flies.push(r);
      items.set(key, item);
    }
  }
  const rank = (i: ShoppingItem) => (i.status === "missing" ? 0 : 1);
  return [...items.values()].sort(
    (a, b) => rank(a) - rank(b) || kindName(a.need.kind).localeCompare(kindName(b.need.kind), lang()) || a.need.color.localeCompare(b.need.color, "en"),
  );
}
