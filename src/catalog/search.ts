import MiniSearch from "minisearch";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";
import { materialName } from "../tying/describe";

/**
 * Catalog search: free text (name, aliases, materials, insect, originator) plus
 * facet filters. The gallery lists main patterns; variants are found through their
 * main pattern, and their materials count for it.
 */

export interface Filters {
  q?: string;
  type?: Recipe["type"];
  imitates?: Recipe["imitates"][number];
  difficulty?: Recipe["difficulty"];
  species?: Recipe["species"][number];
  month?: Recipe["season"][number];
  /** Every one of these must be used. */
  materials?: MaterialKind[];
  /** Only what can be tied with the user's materials (applied by the UI, which knows the inventory). */
  have?: "1";
}

export const FILTER_KEYS = ["q", "type", "imitates", "difficulty", "species", "month", "materials", "have"] as const;

export interface CatalogEntry {
  recipe: Recipe;
  variants: Recipe[];
  /** Material kinds used by the pattern or any of its variants. */
  materials: Set<MaterialKind>;
}

export function catalogEntries(recipes: Recipe[]): CatalogEntry[] {
  const mains = recipes.filter((r) => r.variantOf === undefined);
  return mains
    .map((recipe) => {
      const variants = recipes.filter((r) => r.variantOf === recipe.id);
      const materials = new Set([recipe, ...variants].flatMap((r) => r.materials.map((m) => m.kind)));
      return { recipe, variants, materials };
    })
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
}

export class CatalogSearch {
  private index: MiniSearch<{ id: string; name: string; aliases: string; materials: string; about: string }>;
  private byId: Map<string, CatalogEntry>;

  constructor(readonly entries: CatalogEntry[]) {
    this.byId = new Map(entries.map((e) => [e.recipe.id, e]));
    this.index = new MiniSearch({
      fields: ["name", "aliases", "materials", "about"],
      searchOptions: { boost: { name: 4, aliases: 3, materials: 1.5 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    this.index.addAll(
      entries.map((e) => {
        const all = [e.recipe, ...e.variants];
        return {
          id: e.recipe.id,
          name: e.recipe.name,
          aliases: e.recipe.aliases.join(" "),
          materials: all
            .flatMap((r) => r.materials.map((m) => `${materialName(m)} ${MATERIALS[m.kind].name}`))
            .join(" "),
          about: [
            e.recipe.type,
            ...e.recipe.imitates,
            e.recipe.origin?.originator ?? "",
            e.recipe.origin?.region ?? "",
            e.recipe.description ?? "",
          ].join(" "),
        };
      }),
    );
  }

  search(filters: Filters): CatalogEntry[] {
    const q = filters.q?.trim();
    const candidates = q ? this.index.search(q).map((hit) => this.byId.get(hit.id as string)!) : this.entries;
    return candidates.filter((e) => matches(e, filters));
  }

  /** How many entries each value of a facet would leave, given the other filters. */
  facetCounts<K extends "type" | "imitates" | "difficulty" | "species">(key: K, values: readonly string[], filters: Filters) {
    const rest = this.search({ ...filters, [key]: undefined });
    return new Map(values.map((v) => [v, rest.filter((e) => matches(e, { [key]: v } as Filters)).length]));
  }
}

function matches(e: CatalogEntry, f: Filters): boolean {
  const r = e.recipe;
  if (f.type && r.type !== f.type) return false;
  if (f.imitates && !r.imitates.includes(f.imitates)) return false;
  if (f.difficulty && r.difficulty !== f.difficulty) return false;
  if (f.species && !r.species.includes(f.species)) return false;
  if (f.month && !r.season.includes(f.month)) return false;
  if (f.materials?.some((m) => !e.materials.has(m))) return false;
  return true;
}

/** Filters <-> URL query string, so a filtered gallery can be linked to. */
export function filtersToQuery(f: Filters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const v = f[key];
    if (Array.isArray(v)) {
      if (v.length) params.set(key, v.join(","));
    } else if (v) params.set(key, v);
  }
  return params.toString();
}

export function filtersFromQuery(query: string): Filters {
  const params = new URLSearchParams(query);
  const f: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (!v) continue;
    f[key] = key === "materials" ? v.split(",").filter((m) => m in MATERIALS) : v;
  }
  return f as Filters;
}
