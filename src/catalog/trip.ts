import type { Natural } from "../recipe/natural";
import { isTube, MONTHS, type Recipe, type SPECIES } from "../recipe/schema";
import { fishing } from "../tying/fishing";
import { hookModel } from "../tying/hook";
import { activeIn, matchingHookSizes, type Region } from "./naturals";

/** A fly box for a trip: where, when, on what water and for what fish. */
export type Water = "river" | "lake" | "coast";
export type Species = (typeof SPECIES)[number];

export interface Trip {
  region: Region;
  /** 0 = January. */
  month: number;
  water: Water;
  species: Species;
}

export interface Suggestion {
  recipe: Recipe;
  /** Naturals about then that the fly imitates, its main one first. */
  matches: Natural[];
  /** Hook sizes to tie it in: its main natural's about then, or the size it is tied on. Empty for tubes. */
  sizes: number[];
}

export const WATER_LABELS: Record<Water, string> = { river: "River", lake: "Lake", coast: "Sea coast" };

const COASTAL_NATURALS = new Set(["prawn", "marine-baitfish"]);
const FRESHWATER: Species[] = ["trout", "grayling", "salmon", "char", "bass", "panfish", "pike"];

/**
 * Whether a fly is fished on this water.
 */
// Assumption: on the coast, saltwater flies, flies imitating prawns and sea fish, and the sea
// trout's flies that imitate small fish or shrimps (a Gammarus too); salmon flies (prawn-like as
// some are) stay in the rivers. On rivers and lakes, no saltwater fly unless it is tied for the
// freshwater fish chosen (a Clouser for trout or pike); salmon flies only on rivers.
function fitsWater(r: Recipe, water: Water, species: Species): boolean {
  const saltwater = r.type === "saltwater";
  if (water === "coast") {
    if (r.type === "salmon") return false;
    return (
      saltwater ||
      r.naturals.some((n) => COASTAL_NATURALS.has(n)) ||
      (r.species.includes("sea-trout") && r.imitates.some((i) => i === "baitfish" || i === "crustacean"))
    );
  }
  if (saltwater && !(FRESHWATER.includes(species) && r.species.includes(species))) return false;
  return water === "river" || r.type !== "salmon";
}

/** Even sizes within four of the size it is tied on: the same fly, a little bigger or smaller. */
// Assumption: a pattern is tied two sizes either way of its usual size, not further.
function nearSizes(size: number): number[] {
  const sizes: number[] = [];
  for (let s = Math.max(2, size - 4); s <= Math.min(24, size + 4); s += 2) sizes.push(s);
  return sizes;
}

/**
 * Patterns for a trip, best first: those imitating what hatches there and then (their main
 * natural counts most), then searching patterns and attractors in season, spread over the
 * naturals about and the depths. A fly out of season with no natural about is left out.
 */
// Assumption: a pattern's `season` holds for every region; the hatch calendar decides the rest.
export function suggestBox(recipes: Recipe[], naturals: Natural[], trip: Trip): Suggestion[] {
  const about = new Map(activeIn(naturals, trip.region, trip.month).map(({ natural }) => [natural.id, natural]));
  const month = MONTHS[trip.month]!;
  const scored = recipes
    .filter((r) => r.variantOf === undefined && r.species.includes(trip.species) && fitsWater(r, trip.water, trip.species))
    .flatMap((r) => {
      // Sea fish and prawns are about only on the coast.
      const matches = r.naturals.flatMap((id) => (trip.water !== "coast" && COASTAL_NATURALS.has(id) ? [] : (about.get(id) ?? [])));
      const inSeason = r.season.length === 0 || r.season.includes(month);
      if (matches.length === 0 && !inSeason) return [];
      const score = (matches.length > 0 ? (about.has(r.naturals[0]!) ? 3 : 2) : 0) + (inSeason ? 1 : 0);
      let sizes: number[] = [];
      if (!isTube(r.hook.model) && r.hook.size !== undefined) {
        const near = nearSizes(r.hook.size);
        // Sized for its main natural of those about, on the fly's own hook (a long shank matches
        // a long body on a smaller size).
        const shank = hookModel(r.hook).shankLength;
        const matching = matches.length ? matchingHookSizes(matches[0]!, shank).filter((s) => near.includes(s)) : [];
        sizes = matching.length ? matching.sort((a, b) => b - a) : [r.hook.size];
      }
      return [{ suggestion: { recipe: r, matches, sizes }, score }];
    });
  // A box covers what is about rather than ten flies for one natural: each pick counts less for
  // the next fly for the same natural or fishing at the same depth. Easier flies first on a tie.
  const forNatural = new Map<string, number>();
  const atDepth = new Map<string, number>();
  const ordered: Suggestion[] = [];
  const left = [...scored];
  const value = (x: (typeof scored)[number]) => {
    const main = x.suggestion.matches[0]?.id ?? "";
    return x.score - 1.5 * (forNatural.get(main) ?? 0) - 0.5 * (atDepth.get(fishing(x.suggestion.recipe).depth) ?? 0);
  };
  while (left.length > 0) {
    left.sort(
      (a, b) =>
        value(b) - value(a) ||
        DIFFICULTY_RANK[a.suggestion.recipe.difficulty] - DIFFICULTY_RANK[b.suggestion.recipe.difficulty] ||
        a.suggestion.recipe.name.localeCompare(b.suggestion.recipe.name),
    );
    const next = left.shift()!;
    const main = next.suggestion.matches[0]?.id ?? "";
    forNatural.set(main, (forNatural.get(main) ?? 0) + 1);
    const depth = fishing(next.suggestion.recipe).depth;
    atDepth.set(depth, (atDepth.get(depth) ?? 0) + 1);
    ordered.push(next.suggestion);
  }
  return ordered;
}

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

/** "12–16", "14" */
export function sizesText(sizes: number[]): string {
  if (sizes.length === 0) return "";
  const lo = Math.min(...sizes);
  const hi = Math.max(...sizes);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
