import type { Natural, NATURAL_GROUPS, REGIONS, STAGES } from "../recipe/natural";
import { MONTHS, type Recipe } from "../recipe/schema";
import { gapeMm, HOOK_MODELS, unitMm, hookModel } from "../tying/hook";

export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  "southern-sweden": "Southern Sweden",
  "northern-scandinavia": "Northern Scandinavia",
  "british-isles": "British Isles",
  "central-europe": "Central Europe",
  "northern-usa": "Northern USA",
};

export const GROUP_LABELS: Record<(typeof NATURAL_GROUPS)[number], string> = {
  mayfly: "Mayflies",
  caddis: "Caddis",
  stonefly: "Stoneflies",
  chironomid: "Midges",
  damselfly: "Damselflies",
  terrestrial: "Land insects",
  baitfish: "Small fish",
  crustacean: "Shrimps and prawns",
  leech: "Leeches",
};

export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  nymph: "nymph",
  larva: "larva",
  pupa: "pupa",
  emerger: "emerger",
  dun: "dun",
  spinner: "spinner",
  adult: "adult",
  juvenile: "young",
};

export const RIDES_TEXT: Record<Natural["rides"], string> = {
  "on-surface": "Rides on the surface.",
  "in-film": "Floats low, in the surface film.",
  drifting: "Drifts with the current.",
  swimming: "Swims.",
  crawling: "Crawls on the bottom.",
};

/** Month numbers (0 = January) a hatch covers; a range may run over the new year. */
export function hatchMonths(h: Natural["hatches"][number]): number[] {
  const from = MONTHS.indexOf(h.from);
  const to = MONTHS.indexOf(h.to);
  const months: number[] = [];
  for (let m = from; ; m = (m + 1) % 12) {
    months.push(m);
    if (m === to) break;
  }
  return months;
}

/** The naturals about in a region in a month, with that region's hatch. */
export function activeIn(naturals: Natural[], region: Region, month: number) {
  return naturals.flatMap((n) => {
    const hatch = n.hatches.find((h) => h.region === region);
    return hatch && hatchMonths(hatch).includes(month) ? [{ natural: n, hatch }] : [];
  });
}

/** Main patterns that imitate a natural, by any version of them; the ones naming it first come first. */
export function imitatedBy(recipes: Recipe[], id: string): Recipe[] {
  const mains = recipes.filter((r) => r.variantOf === undefined);
  const rank = (r: Recipe) => {
    const versions = [r, ...recipes.filter((v) => v.variantOf === r.id)];
    const places = versions.map((v) => v.naturals.indexOf(id)).filter((i) => i >= 0);
    return places.length ? Math.min(...places) : -1;
  };
  return mains
    .map((r) => ({ r, place: rank(r) }))
    .filter((x) => x.place >= 0)
    .sort((a, b) => a.place - b.place || a.r.name.localeCompare(b.r.name))
    .map((x) => x.r);
}

/**
 * Hook sizes whose shank is about as long as the natural's body: the sizes it is usually
 * matched with (the shank, not the whole fly, matches the body). On a standard-shank hook
 * unless another shank length (in gapes) is given.
 */
export function matchingHookSizes(n: Natural, shank = HOOK_MODELS["dry-standard"].shankLength): number[] {
  const sizes: number[] = [];
  for (let s = 2; s <= 24; s += 2) {
    const mm = shank * gapeMm(s);
    if (mm >= n.size.min * 0.9 && mm <= n.size.max * 1.1) sizes.push(s);
  }
  return sizes;
}

/**
 * How long to show a natural beside a fly, in the fly's gapes: the natural at the size the fly
 * matches (its shank length in millimetres), within the natural's own range.
 */
export function naturalLengthFor(n: Natural, recipe: Recipe): number {
  const unit = unitMm(recipe.hook);
  const shank = hookModel(recipe.hook).shankLength * unit;
  return Math.min(n.size.max, Math.max(n.size.min, shank)) / unit;
}

/** "April to October", or "All year". */
export function hatchText(h: Natural["hatches"][number]): string {
  const month = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
  return hatchMonths(h).length === 12 ? "All year" : `${month(h.from)} to ${month(h.to)}`;
}

/** "6–11 mm" */
export function sizeText(n: Natural): string {
  const mm = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));
  return n.size.max >= 40 ? `${mm(n.size.min / 10)}–${mm(n.size.max / 10)} cm` : `${mm(n.size.min)}–${mm(n.size.max)} mm`;
}
