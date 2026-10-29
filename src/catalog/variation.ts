import { NAMED_COLORS, type NamedColor, type Recipe } from "../recipe/schema";
import { materialColor } from "./inventory";
import { hasTerm, term } from "../i18n/glossary";
import { deAdjective, inSentence } from "../i18n/grammar";
import { colourWord, partLabel } from "../tying/describe";
import { lang, type Lang } from "../i18n/lang";

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
    const [given = "", colour = ""] = pair.split(":");
    // A part renamed since the link was made ("case" → "larva-case") is the one material
    // whose id ends with the old name.
    const renamed = recipe.materials.filter((m) => m.id.endsWith(`-${given}`));
    const part = given === "thread" || recipe.materials.some((m) => m.id === given) ? given : renamed.length === 1 ? renamed[0]!.id : "";
    if (part && isNamed(colour) && tiedColour(recipe, part) !== colour) colours[part] = colour;
  }
  return colours;
}

/** "body:yellow,tail:red", in the order the parts are listed in the recipe; "" for none. */
export function coloursSpec(colours: Colours, recipe: Recipe): string {
  const order = ["thread", ...recipe.materials.map((m) => m.id)];
  return order.filter((p) => colours[p]).map((p) => `${p}:${colours[p]}`).join(",");
}

/** The recipe in these colours; its notes are in `l` (the page's language: they may be translated). */
export function recolor(recipe: Recipe, colours: Colours, l: Lang = lang()): Recipe {
  if (Object.keys(colours).length === 0) return recipe;
  return {
    ...recipe,
    thread: colours.thread ? { ...recipe.thread, color: colours.thread } : recipe.thread,
    // A label names the material as tied ("Red game cock hackle"): in another colour it goes.
    materials: recipe.materials.map((m) => (colours[m.id] ? { ...m, color: colours[m.id], label: undefined } : m)),
    steps: recipe.steps.map((step) => {
      if (!step.note) return step;
      // A step's note about its own part follows the part's colour ("A short red butt."); the
      // thread's steps are those without a material (the head at the whip finish). A colour
      // named in a note about another part may be that part's own ("black bars" on a tippet
      // tail), so those notes stay as tied.
      const part = "material" in step ? step.material : "thread";
      const own = tiedColour(recipe, part);
      const to = colours[part];
      const note = own && to ? swapColour(step.note, own, to, l) : step.note;
      return note === step.note ? step : { ...step, note };
    }),
  };
}

/**
 * A colour's word in each of its forms in a language, in a fixed order, so a form of one colour
 * can be swapped for the same form of another: English "red"; Swedish röd, rött, röda; German
 * rot, rote, roten, roter, rotes, rotem.
 */
function colourForms(l: Lang, c: NamedColor): string[] {
  if (l === "en") return [c.replace(/-/g, " ")];
  const a = term(l, "colours", c, "adjective");
  if (a.invariable) return [a.text];
  if (l === "sv") return [a.text, a.forms.neuter!, a.forms.plural!];
  return ["", "e", "en", "er", "es", "em"].map((ending) => deAdjective(a, ending));
}

/** The note with the colour `from` (whole words, any case, any form) as `to`; only dyed shades. */
function swapColour(note: string, from: string, to: NamedColor, l: Lang): string {
  // "pheasant tail", "teal" or "partridge" in a note name the material itself.
  if (from === to || !DYE_COLORS.includes(from as NamedColor) || (l !== "en" && !hasTerm(l, "colours", from))) return note;
  const fromForms = colourForms(l, from as NamedColor);
  const toForms = colourForms(l, to);
  const alternatives = [...new Set(fromForms)].sort((a, b) => b.length - a.length).map((f) => f.replace(/[ -]/g, "[ -]"));
  return note.replace(new RegExp(`(?<!\\p{L})(${alternatives.join("|")})(?!\\p{L})`, "giu"), (found) => {
    const index = fromForms.findIndex((f) => f.toLowerCase() === found.toLowerCase().replace(/-/g, " ") || f.toLowerCase() === found.toLowerCase());
    const name = toForms[Math.min(Math.max(index, 0), toForms.length - 1)]!;
    return found[0] === found[0]!.toUpperCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
  });
}

/** "Body yellow, tail red", in the page's language. */
export function coloursText(colours: Colours, recipe: Recipe): string {
  return coloursSpec(colours, recipe)
    .split(",")
    .filter(Boolean)
    .map((pair, i) => {
      const [part = "", colour = ""] = pair.split(":");
      const text = `${partLabel(part)} ${colourWord(colour)}`;
      return i === 0 ? text : inSentence(text);
    })
    .join(", ");
}

/** A fly box entry: a recipe id, with "?colours=…" for a variation. */
export function boxEntry(id: string, spec = ""): string {
  return spec ? `${id}?colours=${spec}` : id;
}

export function parseBoxEntry(entry: string): { id: string; colours: string } {
  const [id = "", query = ""] = entry.split("?");
  return { id, colours: new URLSearchParams(query).get("colours") ?? "" };
}
