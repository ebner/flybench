import type { Natural, NATURAL_GROUPS, REGIONS, STAGES } from "../recipe/natural";
import { MONTHS, type Recipe } from "../recipe/schema";
import { gapeMm, HOOK_MODELS, unitMm, hookModel } from "../tying/hook";
import { lang } from "../i18n/lang";
import { localized } from "../i18n/localized";
import { MONTH_NAMES } from "../i18n/months";

export type Region = (typeof REGIONS)[number];

export const REGION_LABELS = localized<Record<Region, string>>({
  en: {
    "southern-sweden": "Southern Sweden", "northern-scandinavia": "Northern Scandinavia", "british-isles": "British Isles",
    "central-europe": "Central Europe", "northern-usa": "Northern USA",
  },
  sv: {
    "southern-sweden": "Södra Sverige", "northern-scandinavia": "Norra Skandinavien", "british-isles": "Brittiska öarna",
    "central-europe": "Centraleuropa", "northern-usa": "Norra USA",
  },
  de: {
    "southern-sweden": "Südschweden", "northern-scandinavia": "Nordskandinavien", "british-isles": "Britische Inseln",
    "central-europe": "Mitteleuropa", "northern-usa": "Nördliche USA",
  },
});

export const GROUP_LABELS = localized<Record<(typeof NATURAL_GROUPS)[number], string>>({
  en: {
    mayfly: "Mayflies", caddis: "Caddis", stonefly: "Stoneflies", chironomid: "Midges", damselfly: "Damselflies",
    terrestrial: "Land insects", baitfish: "Small fish", crustacean: "Shrimps and prawns", leech: "Leeches",
  },
  sv: {
    mayfly: "Dagsländor", caddis: "Nattsländor", stonefly: "Bäcksländor", chironomid: "Fjädermyggor", damselfly: "Flicksländor",
    terrestrial: "Landinsekter", baitfish: "Småfisk", crustacean: "Märlor och räkor", leech: "Iglar",
  },
  de: {
    mayfly: "Eintagsfliegen", caddis: "Köcherfliegen", stonefly: "Steinfliegen", chironomid: "Zuckmücken", damselfly: "Kleinlibellen",
    terrestrial: "Landinsekten", baitfish: "Kleinfische", crustacean: "Bachflohkrebse und Garnelen", leech: "Egel",
  },
});

/** A stage as it is named in a sentence ("nymph"); German nouns keep their capital. */
export const STAGE_LABELS = localized<Record<(typeof STAGES)[number], string>>({
  en: { nymph: "nymph", larva: "larva", pupa: "pupa", emerger: "emerger", dun: "dun", spinner: "spinner", adult: "adult", juvenile: "young" },
  sv: { nymph: "nymf", larva: "larv", pupa: "puppa", emerger: "kläckande", dun: "subimago", spinner: "imago", adult: "fullbildad", juvenile: "ungfisk" },
  de: { nymph: "Nymphe", larva: "Larve", pupa: "Puppe", emerger: "Schlüpfend", dun: "Subimago", spinner: "Imago", adult: "Adult", juvenile: "Jungfisch" },
});

export const RIDES_TEXT = localized<Record<Natural["rides"], string>>({
  en: {
    "on-surface": "Rides on the surface.", "in-film": "Floats low, in the surface film.", drifting: "Drifts with the current.",
    swimming: "Swims.", crawling: "Crawls on the bottom.",
  },
  sv: {
    "on-surface": "Sitter på ytan.", "in-film": "Flyter lågt, i ytfilmen.", drifting: "Driver med strömmen.", swimming: "Simmar.",
    crawling: "Kryper på botten.",
  },
  de: {
    "on-surface": "Sitzt auf der Oberfläche.", "in-film": "Treibt tief im Oberflächenfilm.", drifting: "Treibt mit der Strömung.",
    swimming: "Schwimmt.", crawling: "Krabbelt am Grund.",
  },
});

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
  const name = (m: string) => MONTH_NAMES[MONTHS.indexOf(m as (typeof MONTHS)[number])]!;
  const words = { en: ["All year", "to"], sv: ["Hela året", "till"], de: ["Das ganze Jahr", "bis"] }[lang()];
  return hatchMonths(h).length === 12 ? words[0]! : `${name(h.from)} ${words[1]} ${name(h.to)}`;
}

/** "6–11 mm" */
export function sizeText(n: Natural): string {
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString({ en: "en-GB", sv: "sv-SE", de: "de-DE" }[lang()]);
  return n.size.max >= 40 ? `${mm(n.size.min / 10)}–${mm(n.size.max / 10)} cm` : `${mm(n.size.min)}–${mm(n.size.max)} mm`;
}
