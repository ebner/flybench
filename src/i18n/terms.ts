import { MATERIALS } from "../recipe/materials";
import { NAMED_COLORS, TUBE_MODEL_IDS, type Recipe } from "../recipe/schema";
import { HOOK_MODELS } from "../tying/hook";
import type { Section } from "./glossary";

/**
 * The tying words the step texts are made of, beyond materials, colours and parts: each must
 * be in every glossary, so a step says "shank" the same way everywhere.
 */
export const WORDS = {
  hook: "a fishing hook",
  thread: "the tying thread",
  shank: "the hook's shank",
  bend: "the hook's bend",
  eye: "the hook's eye",
  gape: "the hook's gape, the unit of proportions",
  point: "the hook's point",
  tube: "a tube fly's tube",
  bead: "a bead behind the eye",
  cone: "a cone head behind the eye",
  head: "the thread head at the eye",
  turn: "one turn of thread or material round the shank",
  "tag-end": "the short loose end of thread left after attaching it",
  butt: "the cut ends of a bunch of hair or fibres (usually plural: the butts)",
  tip: "the fine end of a feather or fibre (usually plural: the tips)",
  fibre: "one fibre (barb) of a feather",
  strand: "one strand of herl, flash or rubber",
  bunch: "a bunch of hair or fibres tied in together",
  clump: "a clump of deer hair spun round the shank",
  noodle: "a thin rope of dubbing twisted onto the thread",
  body: "the fly's body",
  excess: "the excess material left after tying off",
  stub: "a short stub left standing",
  "tie-down": "the place where a material is tied down",
  "whip-finish": "the whip finish, the knot that finishes the head",
  "figure-of-eight": "figure-of-eight turns (crossing turns between two wings or round dumbbell eyes)",
  lighter: "a lighter, to singe an end",
  base: "the base of a wing post",
  side: "a side of the fly (near side, far side)",
  row: "a row of fibres left standing",
  biot: "one biot (a goose or turkey biot), as counted in the dressing list",
  hair: "one hair, as counted in the dressing list (\"20 hairs\")",
} as const;

/** The step titles: each op, and "palmer" (a wind back towards the bend). */
export const STEP_TITLES = [
  "slide-bead", "weight", "pull-over", "spin", "attach-thread", "wrap-thread", "tie-in", "wind", "dub", "tie-off", "trim",
  "whip-finish", "palmer",
] as const;

/** The words a recipe's part ids are made of ("hackle-grizzly" → hackle, grizzly). */
export function partWords(recipes: Recipe[]): string[] {
  return [...new Set(recipes.flatMap((r) => r.materials.flatMap((m) => m.id.split("-"))))].sort();
}

/** Every part id the recipes use. */
export function partIds(recipes: Recipe[]): string[] {
  return [...new Set(recipes.flatMap((r) => r.materials.map((m) => m.id)))].sort();
}

/**
 * Part ids a glossary can't name: neither the whole id ("larva-case") nor each of its words
 * (as a part word or a colour) is in it.
 */
export function unnamedParts(recipes: Recipe[], has: (section: Section, id: string) => boolean): string[] {
  return partIds(recipes).filter((id) => !has("parts", id) && id.split("-").some((w) => !has("parts", w) && !has("colours", w)));
}

/** Every id each glossary section must have. Part words that are colours are looked up there. */
export function requiredTerms(recipes: Recipe[]): Record<Section, string[]> {
  const colours = Object.keys(NAMED_COLORS);
  return {
    materials: Object.keys(MATERIALS),
    colours,
    // Checked with unnamedParts: a whole id can stand for its words.
    parts: [],
    words: Object.keys(WORDS),
    // "treble": the treble hook a tube or Waddington is fished with.
    hooks: [...Object.keys(HOOK_MODELS), ...TUBE_MODEL_IDS, "treble"],
    steps: [...STEP_TITLES],
  };
}
