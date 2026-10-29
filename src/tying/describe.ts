import { hookModel, modelLabel, ridesPointUp, trebleSize, unitMm } from "./hook";
import { MATERIALS, type Archetype } from "../recipe/materials";
import { NAMED_COLORS, type Material, type NamedColor, type Recipe, type Step } from "../recipe/schema";
import type { MaterialKind } from "../recipe/materials";
import { lang, type Lang } from "../i18n/lang";
import { de } from "./describe-de";
import { sv } from "./describe-sv";

/**
 * The texts generated from a recipe: the dressing list, step titles and step instructions.
 * A step is first analysed into what it says (`Said`: which material, where to, how many
 * turns), then written out by the page's language (English here, Swedish and German in
 * describe-sv.ts and describe-de.ts, with their words from the glossary).
 */

function colorName(color: string): string {
  return color.startsWith("#") ? "" : color.replace(/-/g, " ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display name: the label, or the colour (if given in the recipe) plus the catalog name. */
export function materialName(m: Material): string {
  return writer().materialName(m);
}

/** A material kind, as the page's language names it ("Cock hackle", "Tupphackel"). */
export function kindName(kind: MaterialKind): string {
  return writer().materialName({ id: kind, kind });
}

/**
 * A material in a colour, as a shopping list or a gallery card names it ("Red wool", "Röd ull");
 * a hex colour or "natural" is the material's own, left unsaid.
 */
export function needName(kind: MaterialKind, color: string): string {
  return writer().materialName({ id: kind, kind, ...(color in NAMED_COLORS ? { color: color as NamedColor } : {}) });
}

/** A hook model's or tube's name in the page's language, without a size or length (a menu of hooks). */
export function hookModelName(model: Recipe["hook"]["model"]): string {
  return writer().hookName(model, modelLabel(model));
}

/** A colour's word in the page's language ("red", "röd", "rot"); a material's own colour is "natural". */
export function colourWord(color: string, kind?: MaterialKind): string {
  const cat = kind ? MATERIALS[kind] : undefined;
  const own = !(color in NAMED_COLORS) || (cat !== undefined && "defaultColor" in cat && cat.defaultColor === color);
  return writer().colourWord(own ? null : (color as NamedColor));
}

/** A part of a recipe as the dressing names it ("Tail", "Stjärt"); "thread" is the thread. */
export function partLabel(id: string): string {
  return id === "thread" ? writer().role("thread") : writer().partName(id);
}

/** A part and its colour, as a variation is described ("Tail red", "Hackel rött"). */
export function partInColour(id: string, color: NamedColor): string {
  return writer().partInColour(id, color);
}

function englishMaterialName(m: Material): string {
  if (m.label) return m.label;
  const cat = MATERIALS[m.kind];
  const color = m.color ? colorName(m.color) : "";
  return capitalize(`${color} ${cat.name}`.trim());
}

export interface MaterialsListEntry {
  /** The recipe's material id, or "hook" / "thread". */
  id: string;
  role: string;
  name: string;
  detail?: string;
}

/** A material named and used in the plural (hackle fibres, dumbbell eyes): its English name says so. */
export const usedInPlural = (m: Material) => /[^s]s$/.test(MATERIALS[m.kind].name);

/** What a material's `count` counts, where it isn't fibres. */
export const COUNT_UNITS: Partial<Record<Archetype, "strands" | "biots" | "hairs">> = { legs: "strands", flash: "strands", biot: "biots", hair: "hairs" };

/** "1 strand", "6 fibres". */
const countText = (n: number, unit: string) => `${n} ${n === 1 ? unit.replace(/s$/, "") : unit}`;

/** What the dressing list says about one item, before it is put in words. */
export type Detail =
  | { kind: "size"; size: number | undefined }
  | { kind: "strands"; n: number }
  | { kind: "fibre-mm"; mm: number }
  | { kind: "fibre-gape"; gapes: number }
  | { kind: "mm"; mm: number }
  | { kind: "text"; text: string }
  | { kind: "count"; n: number; unit: "strands" | "biots" | "hairs" | "fibres" };

/** The dressing: what to have at hand, hook and thread first. */
export function materialsList(recipe: Recipe): MaterialsListEntry[] {
  const w = writer();
  const hook = hookModel(recipe.hook);
  const treble = trebleSize(recipe.hook);
  const detail = (d: Detail | undefined) => (d ? w.detail(d) : undefined);
  return [
    treble === null
      ? { id: "hook", role: w.role("hook"), name: w.hookName(recipe.hook.model, hook.label), detail: detail({ kind: "size", size: recipe.hook.size }) }
      : { id: "hook", role: w.role(hook.tube?.kind === "waddington" ? "waddington-shank" : "tube"), name: w.hookName(recipe.hook.model, hook.label, recipe.hook.length ?? 25) },
    ...(treble === null ? [] : [{ id: "treble", role: w.role("hook"), name: w.hookName("treble", "Treble hook"), detail: detail({ kind: "size", size: treble }) }]),
    { id: "thread", role: w.role("thread"), name: w.threadName(recipe.thread.color), detail: recipe.thread.size },
    ...recipe.materials.map((m) => ({
      id: m.id,
      role: w.partName(m.id),
      name: w.materialName(m),
      detail: detail(
        m.strands !== undefined
          ? { kind: "strands", n: m.strands }
          : m.fibre !== undefined
            ? hook.tube
              ? { kind: "fibre-mm", mm: Math.round(m.fibre * unitMm(recipe.hook)) }
              : { kind: "fibre-gape", gapes: m.fibre }
            : m.mm !== undefined
              ? { kind: "mm", mm: m.mm }
              : m.size !== undefined
                ? { kind: "text", text: m.size }
                : m.count !== undefined
                  ? { kind: "count", n: m.count, unit: COUNT_UNITS[MATERIALS[m.kind].archetype] ?? "fibres" }
                  : undefined,
      ),
    })),
  ];
}

/** What the fly is dressed on: a hook, a tube, or a Waddington shank (no bend on either). */
export type Mount = "hook" | "tube" | "waddington";

/** Where along the shank a position is, for writing it out in any language. */
export type Place =
  | { kind: "bend-start" }
  | { kind: "rear-end" }
  | { kind: "behind-eye" }
  | { kind: "behind-head"; head: "bead" | "cone" }
  | { kind: "behind-tube-front" }
  | { kind: "halfway" }
  | { kind: "percent"; percent: number };

/** `head`: the bead or cone the front positions are measured to, when there is one. */
export function place(s: number, mount: Mount, head?: "bead" | "cone"): Place {
  if (s <= 0.02) return mount === "hook" ? { kind: "bend-start" } : { kind: "rear-end" };
  if (s >= 0.95) return head ? { kind: "behind-head", head } : mount === "tube" ? { kind: "behind-tube-front" } : { kind: "behind-eye" };
  if (Math.abs(s - 0.5) <= 0.02) return { kind: "halfway" };
  return { kind: "percent", percent: Math.round(s * 100) };
}

const GAPE_WORDS: [number, string][] = [
  [0.25, "a quarter of the gape"],
  [0.5, "half the gape"],
  [0.75, "three quarters of the gape"],
  [1, "the gape"],
  [1.5, "one and a half times the gape"],
  [2, "twice the gape"],
];

/** A length in gapes as a tyer would say it. */
export function gapeText(n: number): string {
  const word = GAPE_WORDS.find(([v]) => Math.abs(v - n) <= 0.05);
  return word ? word[1] : `${n}× the gape`;
}

/** The gape fractions said in words; others are written as a number of gapes. */
export const GAPE_FRACTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
export const gapeFraction = (n: number) => GAPE_FRACTIONS.find((v) => Math.abs(v - n) <= 0.05);

/** A length: in gapes on a hook, in millimetres on a tube or shank (which have no gape). */
export type Length = { kind: "gape"; gapes: number } | { kind: "mm"; mm: number };

/** Where tips end, relative to the bend, or to the rear of a tube or shank. */
export type Reach = "bend-start" | "over-bend" | "past-bend-end" | "well-past-bend" | "rear-end" | "well-past-rear-end";

/** Where tips end, relative to the bend (x in gapes; the bend ends at bendEnd), or to the rear of a tube or shank. */
function reach(tipX: number, bendEnd: number, mount: Mount): Reach | null {
  if (tipX > 0.1) return null;
  if (mount !== "hook") return tipX > -0.15 ? "rear-end" : "well-past-rear-end";
  if (tipX > -0.15) return "bend-start";
  if (tipX > bendEnd + 0.15) return "over-bend";
  if (tipX > bendEnd - 0.2) return "past-bend-end";
  return "well-past-bend";
}

/** What the simulation knows about a step that the text needs. */
export interface StepContext {
  /** wind: winding back towards the bend (palmering); dub: dubbing back towards it; pull-over: laid back from the eye. */
  rear?: boolean;
  /** wind: the palmered material this wind secures. */
  through?: string;
  /** trim: trimming the tip of a palmered material rather than hair butts. */
  tip?: boolean;
  /** trim: shaping a spun-hair head rather than trimming butts. */
  spun?: boolean;
  /** trim: cutting a wound hackle away top and bottom. */
  keep?: boolean;
  /** trim: cutting the excess of a strip pulled over the body (a foam back). */
  cover?: boolean;
  /** pull-over: a later step trims the excess, so it is left for now. */
  trimmedLater?: boolean;
  /** tie-in with a length: where the tips end, and where the bend ends (x in gapes). */
  tipX?: number;
  bendEnd?: number;
}

/** What a tie-in takes: a material, a bunch of it, or strands of herl. */
export type What = { kind: "the"; m: string } | { kind: "bunch"; m: string } | { kind: "strands"; n: number; m: string };

/** What a step says, before it is put in words. Materials are recipe material ids. */
export type Said =
  | { kind: "slide-bead"; m: string; mount: Mount }
  | { kind: "weight"; m: string; from: Place; to: Place }
  | { kind: "attach-thread"; at: Place }
  | { kind: "wrap-thread"; to: Place; turns?: number }
  | { kind: "tie-in-eyes"; m: string; under: boolean }
  | { kind: "tie-in-extended"; m: string; length: Length; forward: boolean; tip?: string }
  | { kind: "tie-in-across"; m: string; strands: number; length: Length }
  | { kind: "tie-in-forward"; m: string; length: Length }
  | { kind: "tie-in-upright"; what: What; length: Length; divide: boolean }
  | { kind: "tie-in-wing-under"; what: What; length: Length }
  | { kind: "tie-in-beard"; what: What; length: Length }
  | { kind: "tie-in-reach"; what: What; width?: Length; reach: Reach; length: Length; angle?: number; flare: boolean }
  | { kind: "tie-in-behind"; what: What; width?: Length; length: Length; angle?: number; flare: boolean }
  | { kind: "tie-in"; what: What }
  | { kind: "wind-around"; m: string; around: string; turns: number }
  | { kind: "palmer"; m: string; to: Place; turns: number; counter: boolean }
  | { kind: "wind-through"; m: string; to: Place; turns: number; counter: boolean; through: string }
  | { kind: "wind"; m: string; to: Place; turns: number; counter: boolean }
  | { kind: "pull-over"; m: string; to: Place; trimmedLater: boolean }
  | { kind: "lay-back"; m: string; to: Place }
  | { kind: "spin"; m: string; to: Place }
  | { kind: "dub"; m: string; to: Place; rear: boolean }
  | { kind: "tie-off"; m: string }
  | { kind: "trim-keep"; m: string; keep: "top" | "under" | "sides" }
  | { kind: "trim-spun"; m: string; leave: Length }
  | { kind: "trim-tip"; m: string }
  | { kind: "trim-cover"; m: string; leave?: Length }
  | { kind: "trim-butts"; m: string; leave?: Length }
  | { kind: "whip-finish"; turns: number };

/** The step analysed: what it says, in no language yet. */
export function analyse(recipe: Recipe, step: Step, ctx: StepContext = {}): Said {
  const mount: Mount = hookModel(recipe.hook).tube?.kind ?? "hook";
  // With a bead or cone, 1 is just behind it rather than the eye.
  const bead = recipe.steps.find((s) => s.op === "slide-bead");
  const headKind = bead && "material" in bead ? recipe.materials.find((m) => m.id === bead.material)?.kind : undefined;
  const head = headKind ? (headKind.endsWith("-cone") ? "cone" : "bead") : undefined;
  const at = (s: number) => place(s, mount, head);
  // A tube has no gape: lengths on one are given in millimetres.
  const len = (n: number): Length => (mount === "hook" ? { kind: "gape", gapes: n } : { kind: "mm", mm: Math.round(n * unitMm(recipe.hook)) });
  const find = (id: string) => recipe.materials.find((m) => m.id === id);
  switch (step.op) {
    case "slide-bead":
      return { kind: "slide-bead", m: step.material, mount };
    case "weight":
      return { kind: "weight", m: step.material, from: at(step.from), to: at(step.to) };
    case "attach-thread":
      return { kind: "attach-thread", at: at(step.at) };
    case "wrap-thread":
      return { kind: "wrap-thread", to: at(step.to), ...(step.turns ? { turns: step.turns } : {}) };
    case "tie-in": {
      const m = find(step.material);
      const archetype = m ? MATERIALS[m.kind].archetype : null;
      const what: What =
        archetype === "herl" && m?.strands
          ? { kind: "strands", n: m.strands, m: step.material }
          : archetype === "hair" || archetype === "marabou" || (archetype === "cdc" && step.length)
            ? { kind: "bunch", m: step.material }
            : { kind: "the", m: step.material };
      const under = step.side === "under";
      if (archetype === "eyes") return { kind: "tie-in-eyes", m: step.material, under };
      if (step.length && step.extended) {
        return { kind: "tie-in-extended", m: step.material, length: len(step.length), forward: Boolean(step.forward), ...(step.tip ? { tip: step.tip } : {}) };
      }
      if (step.length && step.side === "across") return { kind: "tie-in-across", m: step.material, strands: m?.count ?? 2, length: len(step.length) };
      if (step.length && step.forward) return { kind: "tie-in-forward", m: step.material, length: len(step.length) };
      if (step.length && (step.angle ?? 0) >= 60) return { kind: "tie-in-upright", what, length: len(step.length), divide: (step.spread ?? 0) > 0 };
      // Under the shank is on top when the fly swims point-up: there it is the wing.
      if (step.length && under && ridesPointUp(recipe)) return { kind: "tie-in-wing-under", what, length: len(step.length) };
      if (step.length && under) return { kind: "tie-in-beard", what, length: len(step.length) };
      if (step.length) {
        const r = ctx.tipX !== undefined && ctx.bendEnd !== undefined ? reach(ctx.tipX, ctx.bendEnd, mount) : null;
        const wing = archetype === "hair" || archetype === "feather";
        const common = {
          what,
          ...(archetype === "feather" && step.width ? { width: len(step.width) } : {}),
          length: len(step.length),
          ...(step.angle ? { angle: step.angle } : {}),
          flare: (step.spread ?? 0) >= 60,
        };
        return wing && r ? { kind: "tie-in-reach", reach: r, ...common } : { kind: "tie-in-behind", ...common };
      }
      return { kind: "tie-in", what };
    }
    case "wind": {
      const to = at(step.to ?? 0);
      const counter = Boolean(step.counter);
      if (step.around) return { kind: "wind-around", m: step.material, around: step.around, turns: step.turns };
      if (ctx.rear) return { kind: "palmer", m: step.material, to, turns: step.turns, counter };
      if (ctx.through) return { kind: "wind-through", m: step.material, to, turns: step.turns, counter, through: ctx.through };
      return { kind: "wind", m: step.material, to, turns: step.turns, counter };
    }
    case "pull-over":
      if (ctx.rear) return { kind: "lay-back", m: step.material, to: at(step.to) };
      return { kind: "pull-over", m: step.material, to: at(step.to), trimmedLater: Boolean(ctx.trimmedLater) };
    case "spin":
      return { kind: "spin", m: step.material, to: at(step.to) };
    case "dub":
      return { kind: "dub", m: step.material, to: at(step.to), rear: Boolean(ctx.rear) };
    case "tie-off":
      return { kind: "tie-off", m: step.material };
    case "trim":
      if (ctx.keep) return { kind: "trim-keep", m: step.material, keep: step.keep === "top" ? "top" : step.keep === "under" ? "under" : "sides" };
      if (ctx.spun) return { kind: "trim-spun", m: step.material, leave: len(step.leave ?? 0.4) };
      if (ctx.tip) return { kind: "trim-tip", m: step.material };
      if (ctx.cover) return { kind: "trim-cover", m: step.material, ...(step.leave ? { leave: len(step.leave) } : {}) };
      return { kind: "trim-butts", m: step.material, ...(step.leave ? { leave: len(step.leave) } : {}) };
    case "whip-finish":
      return { kind: "whip-finish", turns: step.turns };
  }
}

/** Writes texts in one language. */
export interface Writer {
  /** A material's name in the dressing list ("Red wool"). */
  materialName(m: Material): string;
  threadName(color: string): string;
  /** A hook model's name; `length` is a tube's or Waddington's length in mm. */
  hookName(model: string, english: string, length?: number): string;
  /** The role of hook, thread, tube or shank in the dressing list. */
  role(id: "hook" | "thread" | "tube" | "waddington-shank"): string;
  /** The role of a recipe's part in the dressing list, from its id ("wing-case"). */
  partName(id: string): string;
  detail(d: Detail): string;
  /** A colour on its own ("red"); null is a material's own, natural colour. */
  colourWord(color: NamedColor | null): string;
  /** A part and its colour ("Tail red"): the colour agreeing with the part's noun where the language wants it. */
  partInColour(id: string, color: NamedColor): string;
  /** The step written out; `note` is the step's own note (in this language, or English). */
  text(said: Said, recipe: Recipe, note: string | undefined): string;
  title(op: Step["op"] | "palmer", material: Material | undefined, id: string | undefined): string;
}

const english: Writer = {
  materialName: englishMaterialName,
  colourWord: (c) => (c ? colorName(c) : "natural"),
  partInColour: (id, c) => `${partLabel(id)} ${colorName(c)}`,
  threadName: (color) => capitalize(`${colorName(color)} thread`.trim()),
  // The English label is the hook model's own, a tube's or shank's length included.
  hookName: (_model, label) => label,
  role: (id) => ({ hook: "Hook", thread: "Thread", tube: "Tube", "waddington-shank": "Shank" })[id],
  partName: (id) => capitalize(id.replace(/-/g, " ")),
  detail: (d) => {
    switch (d.kind) {
      case "size":
        return `size ${d.size}`;
      case "strands":
        return `${d.n} strand${d.n === 1 ? "" : "s"}`;
      case "fibre-mm":
        return `fibres ${d.mm} mm`;
      case "fibre-gape":
        return `fibres ${d.gapes}× gape`;
      case "mm":
        return `${d.mm} mm`;
      case "text":
        return d.text;
      case "count":
        return countText(d.n, d.unit);
    }
  },
  text: (said, recipe, note) => {
    const text = englishText(said, recipe);
    return note ? `${text} ${note}` : text;
  },
  title: (op, m, id) => {
    const title = op === "palmer" ? "Palmer" : OP_TITLES[op];
    if (id === undefined) return title;
    return `${title}: ${m ? englishMaterialName(m).toLowerCase() : id}`;
  },
};

function englishText(said: Said, recipe: Recipe): string {
  const mount: Mount = hookModel(recipe.hook).tube?.kind ?? "hook";
  const along = mount === "tube" ? "the tube" : "the shank";
  const at = (p: Place) => {
    switch (p.kind) {
      case "bend-start":
        return "the start of the bend";
      case "rear-end":
        return `the rear end of ${along}`;
      case "behind-eye":
        return "just behind the eye";
      case "behind-head":
        return `just behind the ${p.head}`;
      case "behind-tube-front":
        return "just behind the front of the tube";
      case "halfway":
        return `halfway along ${along}`;
      case "percent":
        return `${p.percent}% of the way along ${along}`;
    }
  };
  const len = (l: Length) => (l.kind === "gape" ? gapeText(l.gapes) : `${l.mm} mm`);
  const body = along;
  const mat = (id: string) => {
    const m = recipe.materials.find((x) => x.id === id);
    return m ? englishMaterialName(m).toLowerCase() : id;
  };
  const what = (w: What) =>
    w.kind === "strands" ? `${w.n === 1 ? "a strand" : `${w.n} strands`} of peacock herl` : w.kind === "bunch" ? `a bunch of ${mat(w.m)}` : `the ${mat(w.m)}`;
  const counter = (c: boolean) => (c ? ", the opposite way round to the turns under it" : "");
  const angle = (a?: number) => (a ? `, angled about ${a}° up from ${body}` : "");
  const pick = (w?: Length) => (w ? `Pick a feather about ${len(w)} wide. ` : "");
  const flare = (f: boolean) => (f ? " Let it flare out round the sides of the body." : "");
  const REACH: Record<Reach, string> = {
    "bend-start": "to the start of the bend",
    "over-bend": "over the bend",
    "past-bend-end": "just past the end of the bend",
    "well-past-bend": "well past the bend",
    "rear-end": `to the rear end of ${along}`,
    "well-past-rear-end": `well past the rear end of ${along}`,
  };
  switch (said.kind) {
    case "slide-bead":
      return said.mount === "tube"
        ? `Slide the ${mat(said.m)} onto the front of the tube.`
        : `Slide the ${mat(said.m)} ${said.mount === "hook" ? "round the bend and " : ""}up to the eye, small hole first.`;
    case "weight":
      return `Wrap the ${mat(said.m)} in touching turns from ${at(said.from)} to ${at(said.to)}.`;
    case "attach-thread":
      return `Attach the thread at ${at(said.at)} with a few turns and trim the tag end.`;
    case "wrap-thread":
      return said.turns ? `Wrap the thread to ${at(said.to)} in ${countText(said.turns, "open turns")}.` : `Wrap the thread to ${at(said.to)} in touching turns.`;
    case "tie-in-eyes":
      return `Tie the ${mat(said.m)} ${said.under ? "under" : "on top of"} the shank with figure-of-eight turns.`;
    case "tie-in-extended": {
      const tip = said.tip ? ` Colour the end ${colorName(said.tip) || "darker"}${said.tip === "black" ? " (singe it with a lighter)" : ""}.` : "";
      return `Tie in the ${mat(said.m)} so it sticks out ${len(said.length)} ${said.forward ? "forward over the eye" : "behind"} as one piece.${tip}`;
    }
    case "tie-in-across":
      return `Tie ${said.strands === 1 ? "a strand" : `${said.strands} strands`} of ${mat(said.m)} across the shank by the middle with figure-of-eight turns, so ${len(said.length)} sticks out on each side as legs.`;
    case "tie-in-forward":
      return `Tie in the ${mat(said.m)} pointing forward over the eye, ${len(said.length)} long.`;
    case "tie-in-upright":
      return `Tie in ${what(said.what)} upright, ${len(said.length)} tall, with turns in front to stand it up.${said.divide ? " Divide them into a V with figure-of-eight turns." : ""}`;
    case "tie-in-wing-under":
      return `Tie in ${what(said.what)} under the shank as the wing (on top when the fly swims point-up), reaching ${len(said.length)} back.`;
    case "tie-in-beard":
      return `Tie in ${what(said.what)} under the shank as a beard, reaching ${len(said.length)} back.`;
    case "tie-in-reach":
      return `${pick(said.width)}Tie in ${what(said.what)} so the tips reach ${REACH[said.reach]} (${len(said.length)} from the tie-in point)${angle(said.angle)}.${flare(said.flare)}`;
    case "tie-in-behind":
      return `${pick(said.width)}Tie in ${what(said.what)}, leaving ${len(said.length)} sticking out behind${angle(said.angle)}.${flare(said.flare)}`;
    case "tie-in":
      return `Tie in ${what(said.what)} with a few firm thread turns.`;
    case "wind-around":
      return `Wind the ${mat(said.m)} round the base of the ${mat(said.around)} in ${countText(said.turns, "turns")}, each one under the last.`;
    case "palmer":
      return `Palmer the ${mat(said.m)} back to ${at(said.to)} in ${countText(said.turns, "open turns")}${counter(said.counter)}.`;
    case "wind-through":
      return `Wind the ${mat(said.m)} forward to ${at(said.to)} in ${countText(said.turns, "turns")} through the ${mat(said.through)}${counter(said.counter)}. The first turn traps its tip.`;
    case "wind":
      return `Wind the ${mat(said.m)} forward to ${at(said.to)} in ${countText(said.turns, "turns")}${counter(said.counter)}.`;
    case "pull-over":
      return `Pull the ${mat(said.m)} forward over the top of the body and tie it down at ${at(said.to)}.${said.trimmedLater ? "" : " Trim the excess."}`;
    case "lay-back":
      return `Lay the ${mat(said.m)} back over the top of the body to ${at(said.to)}. The next winding holds it there.`;
    case "spin":
      return `Spin clumps of ${mat(said.m)} round ${body}, packing each one back against the last, up to ${at(said.to)}.`;
    case "dub":
      return `Twist a thin noodle of ${mat(said.m)} onto the thread and wrap it ${said.rear ? "back" : "forward"} to ${at(said.to)}.`;
    case "tie-off":
      return `Tie off the ${mat(said.m)} with a few thread turns and trim the excess.`;
    case "trim-keep":
      return said.keep === "top"
        ? `Cut away the fibres of the ${mat(said.m)} underneath, so the fly sits low in the film.`
        : said.keep === "under"
          ? `Clip the fibres of the ${mat(said.m)} on top close to the body, leaving a flat seat for the wing.`
          : `Cut away the fibres of the ${mat(said.m)} on top and underneath, leaving two flat rows sticking out at the sides.`;
    case "trim-spun":
      return `Trim the spun ${mat(said.m)} to shape, leaving a head about ${len(said.leave)} thick on each side.`;
    case "trim-tip":
      return `Trim the tip of the ${mat(said.m)} close to the body.`;
    case "trim-cover":
      return said.leave
        ? `Trim the excess ${mat(said.m)}, leaving a stub ${len(said.leave)} long over the eye as the head.`
        : `Trim the excess ${mat(said.m)} flush with the tie-down.`;
    case "trim-butts":
      return said.leave ? `Trim the butts of the ${mat(said.m)}, leaving a short head ${len(said.leave)} long.` : `Trim the butts of the ${mat(said.m)} flush.`;
    case "whip-finish":
      return `Form a small head, whip finish with ${countText(said.turns, "turns")} and cut the thread.`;
  }
}

const OP_TITLES: Record<Step["op"], string> = {
  "slide-bead": "Slide on bead",
  weight: "Add weight",
  "pull-over": "Pull over",
  spin: "Spin",
  "attach-thread": "Attach thread",
  "wrap-thread": "Wrap thread",
  "tie-in": "Tie in",
  wind: "Wind",
  dub: "Dub",
  "tie-off": "Tie off",
  trim: "Trim",
  "whip-finish": "Whip finish",
};

const WRITERS: Record<Lang, () => Writer> = { en: () => english, sv: () => sv, de: () => de };
const writer = () => WRITERS[lang()]();

/** Instruction text for one step, generated from the recipe; the step's note is appended. */
export function stepText(recipe: Recipe, step: Step, ctx: StepContext = {}): string {
  return writer().text(analyse(recipe, step, ctx), recipe, step.note);
}

/** A kind of step on its own ("Tie in", "Wind"), as a menu of steps names it. */
export function opTitle(op: Step["op"]): string {
  return writer().title(op, undefined, undefined);
}

export function stepTitle(recipe: Recipe, step: Step, ctx: StepContext = {}): string {
  const op = step.op === "wind" && ctx.rear ? "palmer" : step.op;
  if (!("material" in step)) return writer().title(op, undefined, undefined);
  return writer().title(op, recipe.materials.find((m) => m.id === step.material), step.material);
}
