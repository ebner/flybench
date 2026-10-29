import { NAMED_COLORS, type NamedColor, type Recipe } from "../recipe/schema";
import { materialColor } from "./inventory";

/**
 * A pattern in other colours: the colour playground. A variation is the recipe with some of
 * its materials (or its thread) in another named colour; everything else is the pattern's.
 * Written "body:yellow,tail:red" in an address or a fly box entry.
 */
export type Colours = Record<string, NamedColor>;

/** The colours offered: the usual dyed and sold shades, not the natural feather and fur names. */
// Assumption: these are colours most tying materials can be had in.
export const DYE_COLORS: NamedColor[] = [
  "black", "white", "cream", "grey", "dun", "blue-dun", "olive", "brown", "red-brown", "tan", "ginger",
  "yellow", "gold", "orange", "red", "fluo-red", "claret", "pink", "purple", "blue", "green", "chartreuse",
  "silver", "copper", "pearl",
];

const isNamed = (c: string): c is NamedColor => c in NAMED_COLORS;

/** The colour a part is tied in by the pattern: its own, or the catalog's default for it. */
export function tiedColour(recipe: Recipe, part: string): string | undefined {
  if (part === "thread") return recipe.thread.color;
  const m = recipe.materials.find((m) => m.id === part);
  return m && materialColor(m);
}

/** Reads "body:yellow,tail:red", keeping only the recipe's parts in named colours that differ from the pattern's. */
export function parseColours(spec: string, recipe: Recipe): Colours {
  const colours: Colours = {};
  for (const pair of spec.split(",")) {
    const [part = "", colour = ""] = pair.split(":");
    const known = part === "thread" || recipe.materials.some((m) => m.id === part);
    if (known && isNamed(colour) && tiedColour(recipe, part) !== colour) colours[part] = colour;
  }
  return colours;
}

/** "body:yellow,tail:red", in the order the parts are listed in the recipe; "" for none. */
export function coloursSpec(colours: Colours, recipe: Recipe): string {
  const order = ["thread", ...recipe.materials.map((m) => m.id)];
  return order.filter((p) => colours[p]).map((p) => `${p}:${colours[p]}`).join(",");
}

/** The recipe in these colours. */
export function recolor(recipe: Recipe, colours: Colours): Recipe {
  if (Object.keys(colours).length === 0) return recipe;
  return {
    ...recipe,
    thread: colours.thread ? { ...recipe.thread, color: colours.thread } : recipe.thread,
    // A label names the material as tied ("Red game cock hackle"): in another colour it goes.
    materials: recipe.materials.map((m) => (colours[m.id] ? { ...m, color: colours[m.id], label: undefined } : m)),
    steps: recipe.steps.map((step) => {
      if (!step.note) return step;
      // A step's note about its own part follows the part's colour ("A short red butt."); the
      // thread's steps are those without a material (the head at the whip finish).
      const part = "material" in step ? step.material : "thread";
      // A note naming another material by its colour ("level with the yellow") follows it too,
      // when every material of that colour has the same new one. All at once, so one swap
      // doesn't feed the next (a black head made red, then the red made blue).
      const swaps = new Map(materialSwaps(recipe, colours));
      const own = tiedColour(recipe, part);
      if (own && isNamed(own) && colours[part]) swaps.set(own, colours[part]);
      const note = swapColours(step.note, swaps);
      return note === step.note ? step : { ...step, note };
    }),
  };
}

/** Each colour all of whose materials changed to one new colour, with that colour. */
function materialSwaps(recipe: Recipe, colours: Colours): [string, NamedColor][] {
  const byColour = new Map<string, Set<string | undefined>>();
  for (const m of recipe.materials) {
    const from = materialColor(m);
    if (!isNamed(from)) continue;
    if (!byColour.has(from)) byColour.set(from, new Set());
    byColour.get(from)!.add(colours[m.id]);
  }
  return [...byColour].flatMap(([from, to]) => {
    const [only] = [...to];
    return to.size === 1 && only ? [[from, only] as [string, NamedColor]] : [];
  });
}

/** The note with each colour word (whole words, any case) swapped for its new colour. */
function swapColours(note: string, swaps: Map<string, NamedColor>): string {
  for (const [from, to] of swaps) if (from === to) swaps.delete(from);
  if (swaps.size === 0) return note;
  const pattern = [...swaps.keys()].map((c) => c.replace(/-/g, "[ -]")).join("|");
  return note.replace(new RegExp(`\\b(${pattern})\\b`, "gi"), (found) => {
    const to = swaps.get(found.toLowerCase().replace(/ /g, "-"))!;
    const name = to.replace(/-/g, " ");
    return found[0] === found[0]!.toUpperCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
  });
}

/** "Body yellow, tail red" */
export function coloursText(colours: Colours, recipe: Recipe): string {
  const text = coloursSpec(colours, recipe)
    .split(",")
    .filter(Boolean)
    .map((pair) => pair.replace(":", " ").replace(/-/g, " "))
    .join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A fly box entry: a recipe id, with "?colours=…" for a variation. */
export function boxEntry(id: string, spec = ""): string {
  return spec ? `${id}?colours=${spec}` : id;
}

export function parseBoxEntry(entry: string): { id: string; colours: string } {
  const [id = "", query = ""] = entry.split("?");
  return { id, colours: new URLSearchParams(query).get("colours") ?? "" };
}
