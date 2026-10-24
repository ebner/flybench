import type { Recipe } from "../recipe/schema";

/** Catalog wording: short facts about a pattern, written as plain sentences. */

const TYPE_NOUNS: Record<Recipe["type"], string> = {
  dry: "dry fly",
  wet: "wet fly",
  nymph: "nymph",
  emerger: "emerger",
  midge: "midge pattern",
  streamer: "streamer",
  terrestrial: "terrestrial",
  salmon: "salmon fly",
  saltwater: "saltwater fly",
};

export const TYPE_LABELS: Record<Recipe["type"], string> = {
  dry: "Dry flies",
  wet: "Wet flies",
  nymph: "Nymphs",
  emerger: "Emergers",
  midge: "Midges",
  streamer: "Streamers",
  terrestrial: "Terrestrials",
  salmon: "Salmon flies",
  saltwater: "Saltwater",
};

export const IMITATES_LABELS: Record<Recipe["imitates"][number], string> = {
  mayfly: "Mayflies",
  caddis: "Caddis",
  stonefly: "Stoneflies",
  chironomid: "Chironomids",
  damselfly: "Damselflies",
  terrestrial: "Land insects",
  baitfish: "Baitfish",
  crustacean: "Shrimp and scuds",
  attractor: "Attractors",
};

export const SPECIES_LABELS: Record<Recipe["species"][number], string> = {
  trout: "Trout",
  grayling: "Grayling",
  "sea-trout": "Sea trout",
  salmon: "Salmon",
  char: "Char",
  bass: "Bass",
  panfish: "Panfish",
  pike: "Pike",
  "striped-bass": "Striped bass",
  bonefish: "Bonefish",
};

export const DIFFICULTY_LABELS: Record<Recipe["difficulty"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Dry fly imitating caddis", "Wet fly, an attractor". */
export function factsLine(r: Recipe): string {
  const noun = capitalize(TYPE_NOUNS[r.type]);
  const insects = r.imitates.filter((i) => i !== "attractor").map((i) => lower(IMITATES_LABELS[i]));
  if (insects.length) return `${noun} imitating ${list(insects)}`;
  if (r.imitates.includes("attractor")) return `${noun}, an attractor`;
  return noun;
}

/** "Dry fly imitating caddis, for trout and grayling." */
export function factsSentence(r: Recipe): string {
  const species = r.species.map((s) => lower(SPECIES_LABELS[s]));
  return `${factsLine(r)}${species.length ? `, for ${list(species)}` : ""}.`;
}

/** "Al Troth, 1957" or "" when unknown. */
export function originLine(r: Recipe): string {
  return [r.origin?.originator, r.origin?.year].filter(Boolean).join(", ");
}
