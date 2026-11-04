import { MATERIALS, WINDABLE, type Archetype, type MaterialKind } from "../recipe/materials";
import { sampleColour } from "../catalog/swatch";
import { NAMED_COLORS, RecipeSchema, type Material, type Op, type Recipe, type Step } from "../recipe/schema";
import { POSITION_TOLERANCE, validateSemantics } from "../recipe/validate";
import type { RecipeError } from "../recipe/errors";

/**
 * A fly as the visitor sees it: parts (a tail, a body, a rib, a hackle, a wing…) on a hook, each
 * tied a certain way, of one to three materials, with a few measurements. `compile` writes the
 * recipe: the tying order, the thread's moves, tie-ins, windings, tie-offs and trims. `partsOf`
 * reads a recipe back into parts, keeping its order, so a copied pattern ties the same fly.
 */

export const ROLES = [
  "bead", "weight", "eyes", "tag", "tail", "butt", "rib", "body", "thorax", "back", "wing", "hackle", "legs", "antennae", "flash", "head", "other",
] as const;
export type Role = (typeof ROLES)[number];

/** How a part is tied. */
export type How =
  /** A bead or cone slid on before the thread. */
  | "slide"
  /** Weighting wire wound on the shank before the thread. */
  | "weight"
  /** A bunch tied in sticking out (tails, wings, beards, legs, flash, eyes). */
  | "bunch"
  /** Wound forward along the shank and tied off (bodies, ribs, tags, collar hackles). */
  | "wound"
  /** Wound back over the body, its tip held by a winding forward over it (a palmered hackle). */
  | "palmered"
  /** Wound round an upright post. */
  | "parachute"
  /** Dubbed on the thread, in one or more passes. */
  | "dubbed"
  /** Spun round the shank and clipped (deer hair heads and bodies). */
  | "spun"
  /** Pads glued along the shank after the whip finish and clipped (a crab's body). */
  | "glued"
  /** Tied in and folded over the body or thorax (shellbacks, wing cases), or laid back from the eye. */
  | "pulled"
  /**
   * Sticking out as one solid piece (an extended body or larva); made on a needle, in segments
   * with its tails (the part's second material), and the rest of its strip perhaps pulled over.
   */
  | "extended"
  /** Tubing slid over the body as a sleeve, tied down where it starts and later at its other end. */
  | "sleeve"
  /** Two strands woven forward, the first over the top, the second round the belly (a Bitch Creek). */
  | "woven"
  /** The thread itself wound as the body. */
  | "thread";

export interface PartMaterial {
  /** The recipe's material id. */
  id: string;
  kind: MaterialKind;
  color?: string;
  /** The visitor's own name for it ("fine-tipped deer hair"). */
  label?: string;
  /** The material's own settings (a hackle's fibre length, a bunch's count). */
  props?: Record<string, number | string | boolean>;
  /** Turns of this material, when wound; omitted, worked out from the length. */
  turns?: number;
  /** Notes on this material's own steps in a mix (the first material's are the part's), by action. */
  notes?: Record<number, string>;
  mistakes?: Record<number, string>;
}

export interface Part {
  /** Unique in the fly (its first material's id). */
  id: string;
  role: Role;
  how: How;
  mats: PartMaterial[];
  /** Where it is tied in (0 the bend, 1 behind the eye). */
  at?: number;
  /** Where a winding, dubbing, spinning or pull ends, or the weighting runs from–to. */
  from?: number;
  to?: number;
  /** Dubbing or thread passes after the first, each from–to (a thread pass in open turns, or the turns of dubbing, how many). */
  passes?: { from: number; to: number; turns?: number }[];
  /** A thread body's first pass in open turns: how many (spiralled over hair bound past the bend); a dubbed body's turns, when given (fewer for a slim one). */
  turns?: number;
  length?: number;
  angle?: number;
  spread?: number;
  width?: number;
  side?: "top" | "under" | "across";
  forward?: boolean;
  tip?: string;
  counter?: boolean;
  /** A parachute's post: the part (an upright bunch) it is wound round; or a strip pulled over is parted round. */
  post?: string;
  /** An upright bunch, or strands tied across, fanned fore and aft over this many degrees (a Mohican's wing, a crab's legs). */
  fan?: number;
  /** An extended body made on a needle: its segments, and its tails (its second material) past its end and splayed. */
  segments?: number;
  tailLength?: number;
  tailSpread?: number;
  /** Spun hair: tips of the first clump left as a collar, gapes. */
  collar?: number;
  /** A bunch's fibres wound on afterwards as a body to here (a Pheasant Tail's tail). */
  windTo?: number;
  /** Pulled over loose: gapes of air under its middle (a CDC pupa's bubble). */
  bubble?: number;
  /** A strip pulled over, cut to its `width` tapered to a point where it is tied in (a Morrish Mouse's foam). */
  taper?: boolean;
  /** Foam pulled forward, its end folded back over itself as a head this long (gapes). */
  fold?: number;
  /** Hair pulled over, its tips standing up in front as a wing this long (a Humpy). */
  tipWing?: number;
  /** Laid back from the eye and tied down there by the thread (a foam balloon), not held by the next winding. */
  tiedBack?: boolean;
  /** A sleeve's rear end frayed into loose strands this long (gapes). */
  fray?: number;
  /** A trim after it is tied: hair butts (leave, shape), a foam back's head, a wound hackle's fibres (keep), spun hair or glued fibres cut flat (keep, leave) or to a shape. */
  trim?: { leave?: number; shape?: "round" | "wedge" | "cigar" | "cone" | "disc"; keep?: "sides" | "top" | "under" };
  /** The visitor's notes on its steps, by action (0 the first). */
  notes?: Record<number, string>;
  mistakes?: Record<number, string>;
  /** Notes on the thread's move before an action ("Over bare shank: a thin waist"), by action. */
  threadNotes?: Record<number, { note?: string; mistake?: string }>;
  /** Order keys of its actions (see `actionsOf`), so a fly keeps the order it was tied in. */
  keys: number[];
}

export interface PartsFly {
  /** Everything of the recipe but its materials and steps. */
  meta: Omit<Recipe, "materials" | "steps">;
  parts: Part[];
  /** Where the thread is attached, and the note on attaching it. */
  attach: number;
  attachNote?: { note?: string; mistake?: string };
  /** The whip finish: its turns, its order key (trims may come after it), its note. */
  finish: { turns: number; key: number; note?: string; mistake?: string; at?: number; move?: { note?: string; mistake?: string } };
  /**
   * Whip finishes part-way, each at its order key, the thread then started again at `at` (a
   * Zonker's rear finished at the bend, its front tied with the thread started behind the eye).
   */
  restarts?: Restart[];
}

export interface Restart {
  key: number;
  turns: number;
  at: number;
  /** Where the thread is brought to be finished part-way, and the note on that move. */
  finishAt?: number;
  move?: { note?: string; mistake?: string };
  note?: string;
  mistake?: string;
  /** The note on attaching the thread again. */
  attach?: { note?: string; mistake?: string };
}

const arch = (kind: MaterialKind): Archetype => MATERIALS[kind].archetype;
/** Strands that can be tied across the shank (as validate.ts allows). */
const ACROSS_KINDS: readonly Archetype[] = ["legs", "hair", "fibres", "biot", "flash"];
const round = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;
/** The thread's moves can also reach behind the bend, over hair bound there. */
const reach = (x: number) => Math.round(Math.min(1, Math.max(-1, x)) * 1000) / 1000;

// ——— What a part can be tied of ———

/**
 * The materials each part is tied with: those the patterns use for it, and others marked as
 * assumptions. A copied pattern keeps whatever it has.
 */
// Assumption: beyond the patterns' own choices, the usual alternatives in fly-tying books (a
// poly-yarn or CDC wing, a dubbed or herl thorax, biot or hair tails); wool only for tags, butts
// and bodies, never wings.
export const ROLE_KINDS: Record<Role, readonly MaterialKind[]> = {
  bead: ["brass-bead", "tungsten-bead", "brass-cone"],
  weight: ["lead-free-wire"],
  eyes: ["bead-chain-eyes", "dumbbell-eyes", "mono-eyes"],
  tag: ["oval-tinsel", "flat-tinsel", "silk-floss", "wool", "gold-wire", "silver-wire"],
  tail: [
    "rabbit-strip", "hackle-fibres", "golden-pheasant-tippet", "golden-pheasant-crest", "pheasant-tail", "coq-de-leon", "hares-mask-guard-hairs",
    "marabou", "krystal-flash", "hackle-tips", "duck-quill", "turkey-quill", "saddle-feathers", "goose-biot",
    "elk-hair", "moose-mane", "bucktail", "calf-tail", "wool", "silicone-legs", "mylar-tubing",
  ],
  butt: ["peacock-herl", "wool", "silk-floss", "chenille"],
  rib: ["gold-wire", "silver-wire", "copper-wire", "oval-tinsel", "flat-tinsel", "monofilament", "rib-thread"],
  body: [
    "dry-fly-dubbing", "dubbing", "hares-ear-dubbing", "seals-fur", "rabbit-dubbing", "peacock-herl", "silk-floss",
    "flat-tinsel", "oval-tinsel", "copper-wire", "gold-wire", "silver-wire", "chenille", "wool", "cdc", "deer-hair", "pheasant-tail", "mylar-tubing",
    "craft-fur",
  ],
  thorax: ["peacock-herl", "dry-fly-dubbing", "dubbing", "hares-ear-dubbing", "seals-fur", "chenille"],
  back: ["foam", "scud-back", "turkey-quill", "pheasant-tail", "poly-yarn", "chenille", "rabbit-strip"],
  wing: [
    "hackle-tips", "mallard-breast", "teal-flank", "bronze-mallard", "duck-quill", "starling-quill", "turkey-quill", "cdc", "poly-yarn",
    "elk-hair", "deer-hair", "calf-tail", "squirrel-tail", "bucktail", "marabou", "golden-pheasant-tippet", "krystal-flash", "goose-biot",
  ],
  hackle: ["cock-hackle", "hen-hackle", "saddle-hackle", "partridge-hackle", "snipe-hackle", "cdc", "hackle-fibres", "bucktail", "squirrel-tail"],
  legs: ["silicone-legs", "pheasant-tail", "hackle-fibres", "moose-mane", "partridge-hackle", "saddle-hackle", "deer-hair"],
  antennae: ["hackle-fibres", "silicone-legs", "synthetic-hair", "goose-biot"],
  flash: ["krystal-flash"],
  head: ["deer-hair", "peacock-herl", "dry-fly-dubbing", "dubbing"],
  other: [],
};

/** The materials that suit this part, as `ROLE_KINDS` lists them (and only those the catalog has). */
export const kindsFor = (role: Role): MaterialKind[] => ROLE_KINDS[role].filter((k) => k in MATERIALS);

/** What can come out of the end of a body made on a needle as its tails (as the rules allow). */
const TAIL_ARCHETYPES: readonly Archetype[] = ["hair", "fibres", "biot"];

/** Whether a part's material `index` is the tails of a body made on a needle, not the body. */
export const isTails = (p: Part, index: number) => p.how === "extended" && p.tailLength !== undefined && index === 1;

/** Whether a part's material shows colours mixed through it: a bunch (not tied across, nor wound on as well), spun or glued hair, or a needle body's tails. */
export const blends = (p: Part, index: number) => (p.how === "bunch" && p.side !== "across" && p.windTo === undefined) || p.how === "spun" || p.how === "glued" || isTails(p, index);

/**
 * The materials a part's material can be changed to: its role's (a body's tails a tail's that can
 * come out of a body), and in a mix only those tied the way the part is; its own always.
 */
export function materialChoices(part: Part, index: number): MaterialKind[] {
  const own = part.mats[index]!.kind;
  if (isTails(part, index)) return [...new Set([own, ...kindsFor("tail").filter((k) => TAIL_ARCHETYPES.includes(arch(k)))])];
  const only = part.mats.length > 1 ? (k: MaterialKind) => waysFor(part.role, k).includes(part.how) : undefined;
  return [...new Set([own, ...kindsFor(part.role).filter((k) => !only || only(k))])];
}

/** How a part of this role can be tied, with this material. */
export function waysFor(role: Role, kind: MaterialKind): How[] {
  const a = arch(kind);
  if (a === "bead") return ["slide"];
  if (role === "weight") return ["weight"];
  if (a === "dubbing") return ["dubbed"];
  if (a === "eyes") return ["bunch"];
  // (A piece of tubing tied in as a tail is picked apart into strands: a Gotcha's.)
  if (a === "tubing") return role === "tail" ? ["bunch"] : ["sleeve"];
  switch (role) {
    case "tail":
    case "wing":
    case "legs":
    case "antennae":
    case "flash":
      return ["bunch"];
    case "tag":
      return a === "yarn" ? ["bunch", "wound"] : ["wound"];
    case "back":
      return ["pulled"];
    case "hackle":
      return a === "hackle" ? ["wound", "palmered", "parachute"] : a === "cdc" ? ["wound"] : ["bunch"];
    case "head":
      return a === "hair" ? ["spun"] : ["wound"];
    case "body":
      // (Foam can't be wound: as a body it sticks out in one piece. Hair, fibres and yarn can be
      // glued on in pads, a crab's body.)
      return a === "hair" ? ["spun", "glued"] : a === "chenille" ? ["wound", "extended", "woven"] : a === "yarn" ? ["wound", "extended", "woven", "glued"] : a === "foam" ? ["extended"] : a === "fibres" ? ["wound", "glued"] : ["wound"];
    default:
      return ["wound"];
  }
}

// ——— The builder's number fields ———

/** A part's settings the builder edits as numbers. */
export type NumberKey = "length" | "angle" | "spread" | "width" | "collar" | "fray" | "fan" | "segments" | "tailLength" | "tailSpread" | "fold";

/** A number field's range, and the recipe value it is written as (a step's property, a material's, the hook's). */
export interface NumberRange {
  lo: number;
  hi: number;
  writes: { to: "step"; op: Op; prop: string } | { to: "material"; prop: string } | { to: "hook"; prop: string };
}

const stepRange = (lo: number, hi: number, op: Op, prop: string): NumberRange => ({ lo, hi, writes: { to: "step", op, prop } });

/** The range of a part's number setting in the builder: within what the recipe allows for the value it is written as (tested). */
export function partRange(p: Pick<Part, "how">, key: NumberKey): NumberRange {
  switch (key) {
    // Spun hair: how far it stands out before it is trimmed.
    case "length":
      return p.how === "spun" ? stepRange(0.2, 3, "spin", "length") : p.how === "glued" ? stepRange(0.2, 3, "glue", "length") : stepRange(0.1, 10, "tie-in", "length");
    case "angle":
      return stepRange(0, 90, "tie-in", "angle");
    case "spread":
      return stepRange(0, 180, "tie-in", "spread");
    case "width":
      return stepRange(0.05, 3, "tie-in", "width");
    case "collar":
      return stepRange(0.1, 4, "spin", "collar");
    case "fray":
      return stepRange(0.1, 3, "sleeve", "fray");
    case "fan":
      return stepRange(0, 120, "tie-in", "fan");
    case "segments":
      return stepRange(2, 12, "tie-in", "segments");
    case "tailLength":
      return stepRange(0.1, 10, "tie-in", "tail-length");
    case "tailSpread":
      return stepRange(0, 90, "tie-in", "tail-spread");
    case "fold":
      return stepRange(0.2, 2, "pull-over", "fold");
  }
}

/** The ranges of a material's number settings, its turns and the hook's length in the builder (tested against the recipe's). */
export const MATERIAL_RANGES = {
  fibre: { lo: 0.2, hi: 5, writes: { to: "material", prop: "fibre" } },
  count: { lo: 1, hi: 200, writes: { to: "material", prop: "count" } },
  mm: { lo: 0.5, hi: 12, writes: { to: "material", prop: "mm" } },
  tuft: { lo: 0, hi: 3, writes: { to: "material", prop: "tuft" } },
  turns: stepRange(1, 100, "wind", "turns"),
  tubeLength: { lo: 8, hi: 90, writes: { to: "hook", prop: "length" } },
} as const satisfies Record<string, NumberRange>;

// ——— The order things are tied in ———

/** A part's actions, each a group of steps with one order key: tie-in, winding, trim… */
export function actionCount(p: Part): number {
  switch (p.how) {
    case "slide":
    case "weight":
      return 1;
    case "extended":
      // (The rest of its strip pulled over, a Mohican's, and trimmed.)
      return 1 + (p.to !== undefined ? 1 : 0) + (p.trim ? 1 : 0);
    case "bunch":
      return 1 + (p.windTo !== undefined ? 1 : 0) + (p.trim ? 1 : 0);
    case "wound":
    case "parachute":
      return 2 + (p.trim ? 1 : 0);
    case "palmered":
      return p.trim?.keep ? 4 : 3;
    case "dubbed":
    case "thread":
      return 1 + (p.passes?.length ?? 0);
    case "spun":
    case "glued":
      return p.trim ? 2 : 1;
    case "pulled":
      return 2 + (p.trim ? 1 : 0);
    case "sleeve":
    case "woven":
      return 2;
  }
}

/** Upright wings and posts are tied in first, as on a Catskill dry or a parachute. */
const UPRIGHT = 60;

/**
 * Where tying convention puts a part's action (lower first), for a part added to a fly: beads
 * and weighting, eyes, upright wings, the tag, the tail, ribs and backs tied in, the body, a
 * palmered hackle, the rib wound, the thorax and wing case, wings laid back, the hackle, the head.
 */
// Assumption: the usual sequence of tying books and the patterns here.
export function phaseOf(p: Part, action: number): number {
  const front = (p.at ?? p.from ?? 0) > 0.6;
  switch (p.role) {
    case "bead":
      return 0;
    case "weight":
      return 1;
    case "eyes":
      return 5;
    case "antennae":
      return p.forward ? 6 : 21;
    case "tag":
      return 15 + action;
    case "tail":
      return action === 0 ? 20 : 40 + action;
    case "butt":
      return 25 + action;
    case "rib":
      return action === 0 ? 30 : 45;
    case "back":
      return front ? [48, 55, 56][action]! : [31, 47, 47.5][action]!;
    case "body":
      // A sleeve goes on over whatever is wound or dubbed under it.
      if (p.how === "sleeve") return 40.8 + action * 0.1;
      if (p.how === "woven") return [35, 40][action]!;
      // An extended body's strip is pulled over last, after the thorax and hackle.
      if (p.how === "extended") return [35, 65, 65.5][action]!;
      // Glued on after the whip finish (see keysFor).
      if (p.how === "glued") return 80 + action * 0.1;
      return p.how === "dubbed" || p.how === "spun" || p.how === "thread" ? 40 + action * 0.1 : [35, 40, 40.5][action]!;
    case "thorax":
      return 50 + action * 0.1;
    case "legs":
      return 52;
    case "wing":
      return (p.angle ?? 0) >= UPRIGHT ? 10 : action === 0 ? 60 : 60.5;
    case "flash":
      return 59;
    case "hackle":
      if (p.side === "under" || p.how === "bunch") return 58;
      if (p.how === "palmered") return [41, 42, 46, 66][action]!;
      if (p.how === "parachute") return action === 0 ? 11 : 64;
      return front ? 62 + action * 0.5 : [38, 43, 43.5][action]!;
    case "head":
      return 70 + action * 0.1;
    default:
      return 57 + action * 0.1;
  }
}

/** The fly with its order keys renumbered 10, 20, 30…, in the same order, leaving room between them. */
export function renumbered(fly: PartsFly): PartsFly {
  const all: { key: number; set: (k: number) => void }[] = [];
  const parts = fly.parts.map((p) => ({ ...p, keys: [...p.keys] }));
  const finish = { ...fly.finish };
  const restarts = fly.restarts?.map((r) => ({ ...r }));
  for (const p of parts) p.keys.forEach((k, i) => all.push({ key: k, set: (v) => (p.keys[i] = v) }));
  all.push({ key: finish.key, set: (v) => (finish.key = v) });
  for (const r of restarts ?? []) all.push({ key: r.key, set: (v) => (r.key = v) });
  all.sort((x, y) => x.key - y.key).forEach((x, i) => x.set((i + 1) * 10));
  return { ...fly, parts, finish, ...(restarts && { restarts }) };
}

/**
 * Order keys for a part's actions as convention places them in this fly (renumbered first): each
 * after the last action whose phase is no later than its own, and before the next.
 */
export function keysFor(fly: PartsFly, part: Omit<Part, "keys">): number[] {
  const p = { ...part, keys: [] } as Part;
  const others = fly.parts.filter((x) => x.id !== p.id);
  // Glued on with the thread finished: after the whip finish and everything else.
  if (p.how === "glued") {
    const last = Math.max(fly.finish.key, ...others.flatMap((o) => o.keys));
    return Array.from({ length: actionCount(p) }, (_, i) => last + 5 * (i + 1));
  }
  const keys: number[] = [];
  for (let i = 0; i < actionCount(p); i++) {
    const phase = phaseOf(p, i);
    let before = keys.at(-1) ?? -Infinity;
    let after = Infinity;
    for (const o of others) {
      o.keys.forEach((k, j) => {
        // Trims after the whip finish (a Black Ant's hackle) bound nothing new.
        if (k < fly.finish.key && phaseOf(o, j) <= phase) before = Math.max(before, k);
      });
    }
    for (const o of others) o.keys.forEach((k) => k > before && (after = Math.min(after, k)));
    // Nothing tied after it but the whip finish (and trims after that): before the finish.
    if (fly.finish.key > before) after = Math.min(after, fly.finish.key);
    keys.push(before === -Infinity ? (after === Infinity ? phase : after - 5) : after === Infinity ? before + 5 : (before + after) / 2);
  }
  return keys;
}

// ——— Writing the recipe ———

// Assumption: about twelve turns of a wound body per shank, a rib's seven, a collar hackle's
// five over a fifth of the shank.
function turnsOf(p: Part, m: PartMaterial): number {
  if (m.turns) return m.turns;
  const span = Math.max(0.05, Math.abs((p.to ?? 1) - (p.at ?? p.from ?? 0)));
  if (p.role === "rib") return Math.max(3, Math.round(span * 7));
  if (p.role === "hackle" && p.how !== "palmered") return Math.max(2, Math.round(span * 25));
  if (p.how === "parachute") return 4;
  if (p.how === "palmered") return Math.max(3, Math.round(span * 7));
  return Math.max(3, Math.round(span * 12));
}

export interface Compiled {
  recipe: Recipe;
  /** Each part's steps, first to last index. */
  spans: Map<string, [number, number]>;
  /** Which part each step is for (the thread's moves for the part they bring it to); null for the thread's start and finish. */
  owners: (string | null)[];
  /** The tying rules' complaints, if a combination of parts can't be tied (shown on the part). */
  problems: RecipeError[];
}

/** The recipe of a fly built of parts. */
export function compile(fly: PartsFly): Compiled {
  const steps: Step[] = [];
  const spans = new Map<string, [number, number]>();
  let thread: number | null = null;
  const owner: (string | null)[] = [];
  const push = (s: Step, part: string | null) => {
    steps.push(s);
    owner.push(part);
  };
  /** The note for the thread's next move (the action under way's). */
  let threadNote: { note?: string; mistake?: string } | undefined;
  /** Where the thread is attached next: at the start, or again after a whip finish part-way. */
  let attachAt = fly.attach;
  let attachNote = fly.attachNote;
  /** The thread cut after a whip finish part-way, to be attached again. */
  let cut = false;
  const to = (x: number, part: string | null) => {
    const at = reach(x);
    if (thread === null) {
      cut = false;
      push({ op: "attach-thread", at: round(attachAt), ...attachNote }, null);
      thread = round(attachAt);
    }
    // Closer than the rules tell apart, the thread is already there.
    if (Math.abs(thread - at) < POSITION_TOLERANCE) return;
    push({ op: "wrap-thread", to: at, ...threadNote }, part);
    threadNote = undefined;
    thread = at;
  };
  /** A mix's other material's note on an action. */
  const matNote = (m: PartMaterial, action: number) => ({
    ...(m.notes?.[action] && { note: m.notes[action] }),
    ...(m.mistakes?.[action] && { mistake: m.mistakes[action] }),
  });
  const note = (p: Part, action: number) => ({
    ...(p.notes?.[action] && { note: p.notes[action] }),
    ...(p.mistakes?.[action] && { mistake: p.mistakes[action] }),
  });

  type Action = { key: number; part: Part; index: number; restart?: Restart };
  const actions: Action[] = fly.parts.flatMap((part) => part.keys.slice(0, actionCount(part)).map((key, index) => ({ key, part, index })));
  actions.push({ key: fly.finish.key, part: null as unknown as Part, index: -1 });
  for (const r of fly.restarts ?? []) actions.push({ key: r.key, part: null as unknown as Part, index: -1, restart: r });
  // Before the thread: beads, then weighting, whatever their keys.
  actions.sort((a, b) => {
    const pre = (x: Action) => (x.part?.how === "slide" ? 0 : x.part?.how === "weight" ? 1 : 2);
    return pre(a) - pre(b) || a.key - b.key;
  });
  // A palmered hackle's tip is held by the next winding: its rib's, wound right after it.
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]!;
    if (a.part?.how !== "palmered" || a.index !== 1) continue;
    const next = actions[i + 1];
    if (next?.part?.how === "wound" && next.index === 1 && (next.part.at ?? 0) <= (a.part.to ?? 0) + 0.02) continue;
    // Wherever it was: a rib wound before the hackle couldn't hold its tip.
    const j = actions.findIndex((x) => x.part?.role === "rib" && x.part.how === "wound" && x.index === 1);
    if (j < 0) continue;
    const [rib] = actions.splice(j, 1);
    actions.splice(actions.indexOf(a) + 1, 0, rib!);
  }

  for (const [ai, { part: p, index: i, restart }] of actions.entries()) {
    /** The thread taken first to where the next action's winding forward ends, when that winding holds what this one leaves (a palmered tip, a strip laid back). */
    const toHolder = () => {
      const holder = actions[ai + 1];
      if (holder?.part?.how === "wound" && holder.index === 1) to(holder.part.to ?? 1, holder.part.id);
    };
    if (restart) {
      // Finished here (where the thread is) and started again later; nothing to finish before the thread.
      if (thread !== null) {
        threadNote = restart.move;
        if (restart.finishAt !== undefined) to(restart.finishAt, null);
        push({ op: "whip-finish", turns: restart.turns, ...(restart.note && { note: restart.note }), ...(restart.mistake && { mistake: restart.mistake }) }, null);
        thread = null;
        cut = true;
      }
      attachAt = restart.at;
      attachNote = restart.attach;
      continue;
    }
    if (!p) {
      if (thread === null) to(attachAt, null);
      threadNote = fly.finish.move;
      if (fly.finish.at !== undefined) to(fly.finish.at, null);
      push({ op: "whip-finish", turns: fly.finish.turns, ...(fly.finish.note && { note: fly.finish.note }), ...(fly.finish.mistake && { mistake: fly.finish.mistake }) }, null);
      continue;
    }
    const n = note(p, i);
    threadNote = p.threadNotes?.[i];
    const m0 = p.mats[0]!;
    const tieIns = (at: number, extra: Partial<Extract<Step, { op: "tie-in" }>> = {}) => {
      to(at, p.id);
      p.mats.forEach((m, k) => push({ op: "tie-in", material: m.id, ...extra, ...(k === 0 ? n : matNote(m, i)) } as Step, p.id));
    };
    const bunch = {
      ...(p.length !== undefined && { length: p.length }),
      ...(p.angle !== undefined && p.length !== undefined && { angle: p.angle }),
      ...(p.spread !== undefined && p.length !== undefined && { spread: p.spread }),
      ...(p.width !== undefined && { width: p.width }),
      ...(p.side !== undefined && { side: p.side }),
      ...(p.forward && { forward: true }),
      ...(p.fan !== undefined && p.length !== undefined && { fan: p.fan }),
    };
    // A bunch's trim is of hair butts: of the hair in a mix only.
    const trim = () =>
      p.mats
        .filter((m) => p.how !== "bunch" || p.mats.every((x) => arch(x.kind) !== "hair") || arch(m.kind) === "hair")
        .forEach((m, k) => push({ op: "trim", material: m.id, ...p.trim, ...(k === 0 ? n : {}) } as Step, p.id));
    switch (p.how) {
      case "slide":
        p.mats.forEach((m) => push({ op: "slide-bead", material: m.id, ...n }, p.id));
        break;
      case "weight":
        push({ op: "weight", material: m0.id, from: round(p.from ?? 0.3), to: round(p.to ?? 0.75), ...n }, p.id);
        break;
      case "extended": {
        // Made on a needle, its second material is its tails, in it: only the body is tied in.
        const tails = p.tailLength !== undefined ? p.mats[1] : undefined;
        if (i === 0 && tails) {
          to(p.at ?? 0, p.id);
          push({
            op: "tie-in", material: m0.id, ...bunch, extended: true, ...(p.tip && { tip: p.tip }), ...(p.segments !== undefined && { segments: p.segments }),
            tails: tails.id, "tail-length": p.tailLength!, ...(p.tailSpread !== undefined && { "tail-spread": p.tailSpread }), ...n,
          } as Step, p.id);
        } else if (i === 0) tieIns(p.at ?? 0, { ...bunch, extended: true, ...(p.tip && { tip: p.tip }), ...(p.segments !== undefined && { segments: p.segments }) });
        else if (i === 1 && p.to !== undefined) {
          to(p.to, p.id);
          push({ op: "pull-over", material: m0.id, to: round(p.to), ...(p.post !== undefined && { around: postMaterial(fly, p.post) }), ...(p.bubble !== undefined && { bubble: p.bubble }), ...(p.fold !== undefined && { fold: p.fold }), ...n }, p.id);
        } else push({ op: "trim", material: m0.id, ...p.trim, ...n } as Step, p.id);
        break;
      }
      case "bunch":
        if (i === 0) tieIns(p.at ?? 0, bunch);
        else if (i === 1 && p.windTo !== undefined) {
          to(p.windTo, p.id);
          p.mats.forEach((m, k) => {
            push({ op: "wind", material: m.id, to: round(p.windTo!), turns: turnsOf({ ...p, from: p.at, to: p.windTo }, m), ...(k === 0 ? n : {}) }, p.id);
            push({ op: "tie-off", material: m.id, ...(k === 0 ? note(p, i + 0.5) : matNote(m, i + 0.5)) }, p.id);
          });
        } else trim();
        break;
      case "wound":
      case "parachute":
        if (i === 0) tieIns(p.at ?? p.from ?? 0);
        else if (i === 1) {
          if (p.how === "wound") to(p.to ?? 1, p.id);
          p.mats.forEach((m, k) => {
            const turns = turnsOf(p, m);
            push(
              p.how === "parachute"
                ? { op: "wind", material: m.id, around: postMaterial(fly, p.post), turns, ...(k === 0 ? n : matNote(m, i)) }
                : { op: "wind", material: m.id, to: round(p.to ?? 1), turns, ...(p.counter && { counter: true }), ...(k === 0 ? n : matNote(m, i)) },
              p.id,
            );
            push({ op: "tie-off", material: m.id, ...(k === 0 ? note(p, i + 0.5) : matNote(m, i + 0.5)) }, p.id);
          });
        } else trim();
        break;
      case "palmered":
        if (i === 0) tieIns(p.at ?? 0.75);
        else if (i === 1) {
          // Nothing may come between it and the winding forward that holds its tip: the thread
          // goes first to where that winding ends.
          toHolder();
          p.mats.forEach((m, k) => push({ op: "wind", material: m.id, to: round(p.to ?? 0.05), turns: turnsOf(p, m), ...(k === 0 ? n : {}) }, p.id));
        }
        else if (i === 2) p.mats.forEach((m, k) => push({ op: "trim", material: m.id, ...(k === 0 ? n : {}) } as Step, p.id));
        else p.mats.forEach((m, k) => push({ op: "trim", material: m.id, keep: p.trim!.keep!, ...(k === 0 ? n : {}) } as Step, p.id));
        break;
      case "dubbed":
      case "thread": {
        const pass = i === 0 ? { from: p.from ?? 0, to: p.to ?? 0.7, turns: p.turns } : p.passes![i - 1]!;
        to(pass.from, p.id);
        if (p.how === "dubbed") push({ op: "dub", material: m0.id, to: round(pass.to), ...(pass.turns !== undefined && { turns: pass.turns }), ...n }, p.id);
        else if (Math.abs((thread ?? 0) - pass.to) >= POSITION_TOLERANCE) {
          push({ op: "wrap-thread", to: reach(pass.to), ...(pass.turns !== undefined && { turns: pass.turns }), ...n }, p.id);
          thread = reach(pass.to);
        }
        if (p.how === "dubbed") thread = round(pass.to);
        break;
      }
      case "spun":
        if (i === 0) {
          to(p.from ?? 0, p.id);
          push({ op: "spin", material: m0.id, to: round(p.to ?? 0.7), ...(p.collar !== undefined && { collar: p.collar }), ...(p.length !== undefined && { length: p.length }), ...n }, p.id);
          thread = round(p.to ?? 0.7);
        } else trim();
        break;
      case "glued":
        if (i === 0) {
          // No thread: glued on (usually after the whip finish), the thread staying where it is.
          if (thread === null && !cut) to(attachAt, null);
          p.mats.forEach((m, k) => push({ op: "glue", material: m.id, from: round(p.from ?? 0.1), to: round(p.to ?? 0.75), ...(p.length !== undefined && { length: p.length }), ...(k === 0 ? n : matNote(m, i)) }, p.id));
        } else trim();
        break;
      case "sleeve":
        if (i === 0) {
          to(p.at ?? 0, p.id);
          p.mats.forEach((m, k) => push({ op: "sleeve", material: m.id, to: round(p.to ?? 0.7), ...(p.fray !== undefined && { fray: p.fray }), ...(k === 0 ? n : matNote(m, i)) }, p.id));
        } else {
          to(p.to ?? 0.7, p.id);
          p.mats.forEach((m, k) => push({ op: "tie-off", material: m.id, ...(k === 0 ? n : matNote(m, i)) }, p.id));
        }
        break;
      case "woven": {
        if (i === 0) {
          tieIns(p.at ?? 0);
          break;
        }
        const end = round(p.to ?? 0.7);
        const [top, under] = p.mats;
        // With the thread on the hook, it is parked where the weave ends; cut (finished part-way
        // before), it is attached there again to tie both ends off.
        if (!cut) to(end, p.id);
        else attachAt = end;
        // (Its crossings, when given, are the top strand's turns.)
        push({ op: "weave", material: top!.id, under: (under ?? top)!.id, to: end, ...(top!.turns && { turns: top!.turns }), ...n }, p.id);
        to(end, p.id);
        p.mats.forEach((m, k) => push({ op: "tie-off", material: m.id, ...(k === 0 ? note(p, i + 0.5) : matNote(m, i + 0.5)) }, p.id));
        break;
      }
      case "pulled":
        if (i === 0) tieIns(p.at ?? 0, { ...bunch, ...(p.taper && p.width !== undefined && { taper: true }) });
        else if (i === 1) {
          const end = p.to ?? 0.9;
          // Laid back from the eye, the next winding holds it, or the thread ties it down there;
          // folded forward, the thread ties it down.
          if (end > (p.at ?? 0) || p.tiedBack) to(end, p.id);
          else toHolder();
          p.mats.forEach((m, k) => push({ op: "pull-over", material: m.id, to: round(end), ...(p.post !== undefined && { around: postMaterial(fly, p.post) }), ...(p.bubble !== undefined && { bubble: p.bubble }), ...(p.tipWing !== undefined && { wing: p.tipWing }), ...(p.fold !== undefined && { fold: p.fold }), ...(k === 0 ? n : {}) }, p.id));
        } else trim();
        break;
    }
  }

  owner.forEach((id, i) => {
    if (!id) return;
    const s = spans.get(id);
    spans.set(id, s ? [s[0], i] : [i, i]);
  });
  const materials = fly.parts.flatMap((p) =>
    p.mats.map((m, i) => {
      // Colours mixed in show only in a bunch: tied another way, the blend is left out.
      const { mix, ...props } = m.props ?? {};
      return { id: m.id, kind: m.kind, ...(m.color && { color: m.color }), ...(m.label && { label: m.label }), ...props, ...(mix !== undefined && blends(p, i) && { mix }) } as Material;
    }),
  );
  const recipe = { ...fly.meta, materials, steps } as Recipe;
  // The recipe's own form first (ids, sizes, colours), then the tying rules.
  const form = RecipeSchema.safeParse(recipe);
  const formProblems: RecipeError[] = form.success
    ? []
    : form.error.issues.map((i) => ({ message: i.message, path: i.path.map((x) => (typeof x === "symbol" ? String(x) : x)) }));
  return { recipe, spans, owners: owner, problems: [...formProblems, ...validateSemantics(recipe)] };
}

/** The material a parachute is wound round: its post part's first. */
function postMaterial(fly: PartsFly, post: string | undefined): string {
  const p = fly.parts.find((x) => x.id === post);
  return p?.mats[0]?.id ?? post ?? "";
}

// ——— Reading a recipe back into parts ———

/** A recipe's material as a part's, its own settings kept. */
function materialOf(m: Material): PartMaterial {
  const mat: PartMaterial = { id: m.id, kind: m.kind, ...(m.color && { color: m.color }), ...(m.label && { label: m.label }) };
  const { id: _id, kind: _kind, color: _color, label: _label, ...props } = m as Material & Record<string, unknown>;
  if (Object.keys(props).length) mat.props = props as PartMaterial["props"];
  return mat;
}

/** A part's role from its id's words and how it is tied, for an id the builder didn't write. */
function roleOf(id: string, how: How, kind: MaterialKind, step: Step | undefined): Role {
  const words = id.split("-");
  const has = (...w: string[]) => w.some((x) => words.includes(x) || words.includes(`${x}s`));
  const a = arch(kind);
  if (how === "slide") return "bead";
  if (how === "weight") return "weight";
  // Whatever is pulled over the body is its back (a wing case, a Humpy's hump, a foam balloon).
  if (how === "pulled") return "back";
  if (a === "eyes") return "eyes";
  // A hackle named for where it goes (a thorax hackle) is a hackle.
  if (a === "hackle" && !has("legs", "leg", "mouth")) return "hackle";
  if (has("tag", "hotspot")) return "tag";
  // (A crab's claws are tied in at the bend with its tail.)
  if (has("tail", "tails", "claws")) return "tail";
  if (has("butt")) return "butt";
  if (has("rib")) return "rib";
  if (has("thorax")) return "thorax";
  if (has("back", "case", "shellback")) return how === "bunch" ? "wing" : "body";
  if (has("wing", "underwing", "overwing", "post", "topping", "sighter")) return "wing";
  if (has("hackle", "collar", "palmer", "beard", "throat", "mouth")) return "hackle";
  if (has("legs", "leg")) return "legs";
  if (has("antennae", "feelers", "horns")) return "antennae";
  if (has("flash")) return "flash";
  if (has("head")) return "head";
  if (has("body", "abdomen", "larva", "fibres", "hump", "band", "hair")) return a === "hair" && how === "bunch" ? "wing" : "body";
  if (a === "hackle") return "hackle";
  if (how === "bunch") return step && "side" in step && step.side === "under" ? "hackle" : "wing";
  return "body";
}

/**
 * A recipe as parts, keeping its order; null when it has steps the builder can't hold as parts
 * (a material tied in twice, steps out of any part's pattern).
 */
export function partsOf(recipe: Recipe): PartsFly | null {
  const { materials, steps, ...meta } = recipe;
  const kinds = new Map(materials.map((m) => [m.id, m]));
  const groups = new Map<string, { i: number; s: Step; thread: number | null; threadNote?: { note?: string; mistake?: string } }[]>();
  let attachNote: PartsFly["attachNote"];
  let pendingMove: { note?: string; mistake?: string } | undefined;
  const annotation = (s: Step) => (s.note || s.mistake ? { ...(s.note && { note: s.note }), ...(s.mistake && { mistake: s.mistake }) } : undefined);
  const order: string[] = [];
  let thread: number | null = null;
  let attach: number | null = null;
  let finish: PartsFly["finish"] | null = null;
  const restarts: Restart[] = [];
  const threadParts: Part[] = [];
  /** Strands woven round the belly, by id: read with the strand woven over the top, as one part. */
  const wovenUnder = new Set(steps.flatMap((s) => (s.op === "weave" ? [s.under] : [])));
  /** Hair folded back and tied down, by id: where, while its tips trail behind (until trimmed). */
  const trailing = new Map<string, number>();

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    if (s.op === "attach-thread") {
      if (attach !== null) {
        // Started again after a whip finish part-way: that finish is a restart, with the thread
        // brought to where it was finished.
        if (!finish) return null;
        const attachAgain = annotation(s);
        restarts.push({
          key: finish.key, turns: finish.turns, at: s.at,
          ...(finish.at !== undefined && { finishAt: finish.at }), ...(finish.move && { move: finish.move }),
          ...(finish.note && { note: finish.note }), ...(finish.mistake && { mistake: finish.mistake }), ...(attachAgain && { attach: attachAgain }),
        });
        finish = null;
        thread = s.at;
        continue;
      }
      attach = thread = s.at;
      attachNote = annotation(s);
      continue;
    }
    if (s.op === "whip-finish") {
      finish = { turns: s.turns, key: i, ...(s.note && { note: s.note }), ...(s.mistake && { mistake: s.mistake }) };
      // The thread brought to where the head is finished (past a pair of eyes, through the butts).
      if (steps[i - 1]?.op === "wrap-thread" && thread !== null) finish.at = thread;
      if (pendingMove) finish.move = pendingMove;
      pendingMove = undefined;
      continue;
    }
    if (s.op === "wrap-thread") {
      // Two or more moves in a row, with nothing tied between: the thread laid as a body.
      let j = i;
      while (steps[j + 1]?.op === "wrap-thread") j++;
      // A move on its own that binds hair trailing behind its tie-down, or comes back from past the
      // bend, is an action of its own too: as a move to the next action it would be lost.
      const binds = (from: number, to: number) =>
        from < -POSITION_TOLERANCE || to < -POSITION_TOLERANCE || (to < from && [...trailing.values()].some((at) => to < at - POSITION_TOLERANCE));
      if (thread !== null && (j > i || binds(thread, s.to))) {
        const run = steps.slice(i, j + 1) as Extract<Step, { op: "wrap-thread" }>[];
        const passes: { from: number; to: number; turns?: number }[] = [];
        let at: number = thread;
        for (const w of run) {
          passes.push({ from: at, to: w.to, ...(w.turns !== undefined && { turns: w.turns }) });
          at = w.to;
        }
        const id = `thread-body-${threadParts.length}`;
        const notes = Object.fromEntries(run.flatMap((w, k) => (w.note ? [[k, w.note]] : [])));
        const mistakes = Object.fromEntries(run.flatMap((w, k) => (w.mistake ? [[k, w.mistake]] : [])));
        threadParts.push({
          id, role: "body", how: "thread", mats: [], from: passes[0]!.from, to: passes[0]!.to, ...(passes[0]!.turns !== undefined && { turns: passes[0]!.turns }),
          passes: passes.slice(1), keys: run.map((_, k) => i + k),
          ...(Object.keys(notes).length && { notes }), ...(Object.keys(mistakes).length && { mistakes }),
        });
        thread = at;
        i = j;
      } else {
        thread = s.to;
        // A noted move belongs with what it brings the thread to.
        pendingMove = annotation(s);
      }
      continue;
    }
    const id = s.material;
    if (!groups.has(id)) {
      groups.set(id, []);
      order.push(id);
    }
    groups.get(id)!.push({ i, s, thread, ...(pendingMove && { threadNote: pendingMove }) });
    pendingMove = undefined;
    const tiedAt = groups.get(id)![0]!.thread;
    const kind = kinds.get(id)?.kind;
    if (s.op === "pull-over" && kind && arch(kind) === "hair" && thread !== null && tiedAt !== null && s.to < tiedAt - POSITION_TOLERANCE && Math.abs(thread - s.to) <= POSITION_TOLERANCE) trailing.set(id, s.to);
    if (s.op === "trim") trailing.delete(id);
    if (s.op === "dub" || s.op === "spin") thread = s.to;
  }
  if (attach === null && steps.some((s) => s.op !== "slide-bead" && s.op !== "weight")) return null;
  if (!finish) finish = { turns: 5, key: steps.length };

  const parts: Part[] = [];
  for (const id of order) {
    if (wovenUnder.has(id)) continue;
    const g = groups.get(id)!;
    const m = kinds.get(id);
    if (!m) return null;
    const ops = g.map((x) => x.s.op).join(" ");
    const mat = materialOf(m);
    const notes: Record<number, string> = {};
    const mistakes: Record<number, string> = {};
    // A tie-off's note under its winding's action and a half (they are one action).
    const noted = (action: number, s: Step) => {
      // (A sleeve's tie-off is an action of its own.)
      const key = s.op === "tie-off" && part?.how !== "sleeve" ? action + 0.5 : action;
      if (s.note) notes[key] = s.note;
      if (s.mistake) mistakes[key] = s.mistake;
    };
    let part: Omit<Part, "role"> | null = null;
    const tieIn = g[0]!.s.op === "tie-in" ? (g[0]!.s as Extract<Step, { op: "tie-in" }>) : null;
    const bunchOf = (t: Extract<Step, { op: "tie-in" }>) => ({
      ...(t.length !== undefined && { length: t.length }),
      ...(t.angle !== undefined && { angle: t.angle }),
      ...(t.spread !== undefined && { spread: t.spread }),
      ...(t.width !== undefined && { width: t.width }),
      ...(t.side !== undefined && { side: t.side }),
      ...(t.forward && { forward: true }),
      ...(t.fan !== undefined && { fan: t.fan }),
    });
    const trimOf = (s: Step) => {
      const t = s as Extract<Step, { op: "trim" }>;
      return { ...(t.leave !== undefined && { leave: t.leave }), ...(t.shape && { shape: t.shape }), ...(t.keep && { keep: t.keep }) };
    };
    const at = g[0]!.thread ?? 0;
    if (ops === "slide-bead") part = { id, how: "slide", mats: [mat], keys: [g[0]!.i] };
    else if (ops === "tie-in weave tie-off") {
      // The belly's strand tied in and off right after the top's.
      const wv = g[1]!.s as Extract<Step, { op: "weave" }>;
      const ug = groups.get(wv.under);
      const um = kinds.get(wv.under);
      if (!ug || !um || ug.map((x) => x.s.op).join(" ") !== "tie-in tie-off" || ug[0]!.i !== g[0]!.i + 1 || ug[1]!.i !== g[2]!.i + 1 || tieIn?.length !== undefined) return null;
      const under: PartMaterial = { id: wv.under, kind: um.kind, ...(um.color && { color: um.color }), ...(um.label && { label: um.label }) };
      const { id: _i, kind: _k, color: _c, label: _l, ...uprops } = um as Material & Record<string, unknown>;
      if (Object.keys(uprops).length) under.props = uprops as PartMaterial["props"];
      for (const [x, action] of [[ug[0]!.s, 0], [ug[1]!.s, 1.5]] as const) {
        if (x.note) under.notes = { ...under.notes, [action]: x.note };
        if (x.mistake) under.mistakes = { ...under.mistakes, [action]: x.mistake };
      }
      if (wv.turns !== undefined) mat.turns = wv.turns;
      part = { id, how: "woven", mats: [mat, under], at, to: wv.to, keys: [g[0]!.i, g[1]!.i] };
    }
    else if (ops === "sleeve tie-off") {
      const sl = g[0]!.s as Extract<Step, { op: "sleeve" }>;
      part = { id, how: "sleeve", mats: [mat], at, to: sl.to, ...(sl.fray !== undefined && { fray: sl.fray }), keys: g.map((x) => x.i) };
    }
    else if (ops === "weight") {
      const w = g[0]!.s as Extract<Step, { op: "weight" }>;
      part = { id, how: "weight", mats: [mat], from: w.from, to: w.to, keys: [g[0]!.i] };
    } else if (/^dub( dub)*$/.test(ops)) {
      const passes = g.map((x) => {
        const d = x.s as Extract<Step, { op: "dub" }>;
        return { from: x.thread ?? 0, to: d.to, ...(d.turns !== undefined && { turns: d.turns }) };
      });
      part = { id, how: "dubbed", mats: [mat], from: passes[0]!.from, to: passes[0]!.to, ...(passes[0]!.turns !== undefined && { turns: passes[0]!.turns }), passes: passes.slice(1), keys: g.map((x) => x.i) };
    } else if (ops === "spin" || ops === "spin trim") {
      const sp = g[0]!.s as Extract<Step, { op: "spin" }>;
      part = { id, how: "spun", mats: [mat], from: at, to: sp.to, ...(sp.collar !== undefined && { collar: sp.collar }), ...(sp.length !== undefined && { length: sp.length }), ...(g[1] && { trim: trimOf(g[1].s) }), keys: g.map((x) => x.i) };
    } else if (ops === "glue" || ops === "glue trim") {
      const gl = g[0]!.s as Extract<Step, { op: "glue" }>;
      part = { id, how: "glued", mats: [mat], from: gl.from, to: gl.to, ...(gl.length !== undefined && { length: gl.length }), ...(g[1] && { trim: trimOf(g[1].s) }), keys: g.map((x) => x.i) };
    } else if (tieIn && tieIn.extended && /^tie-in( pull-over( trim)?)?$/.test(ops)) {
      // Made on a needle: its tails, in it, are its second material.
      const tm = tieIn.tails !== undefined ? kinds.get(tieIn.tails) : undefined;
      if (tieIn.tails !== undefined && !tm) return null;
      const tails: PartMaterial[] = tm ? [materialOf(tm)] : [];
      const po = g[1]?.s as Extract<Step, { op: "pull-over" }> | undefined;
      part = {
        id, how: "extended", mats: [mat, ...tails], at, ...bunchOf(tieIn), ...(tieIn.tip && { tip: tieIn.tip }),
        ...(tieIn.segments !== undefined && { segments: tieIn.segments }),
        ...(tieIn["tail-length"] !== undefined && { tailLength: tieIn["tail-length"] }), ...(tieIn["tail-spread"] !== undefined && { tailSpread: tieIn["tail-spread"] }),
        ...(po && { to: po.to, ...(po.around !== undefined && { post: po.around }), ...(po.bubble !== undefined && { bubble: po.bubble }), ...(po.fold !== undefined && { fold: po.fold }) }), ...(g[2] && { trim: trimOf(g[2].s) }),
        keys: g.map((x) => x.i),
      };
    } else if (tieIn && (ops === "tie-in" || ops === "tie-in trim")) {
      part = { id, how: "bunch", mats: [mat], at, ...bunchOf(tieIn), ...(g[1] && { trim: trimOf(g[1].s) }), keys: g.map((x) => x.i) };
    } else if (tieIn && /^tie-in pull-over( trim)?$/.test(ops)) {
      const po = g[1]!.s as Extract<Step, { op: "pull-over" }>;
      const tiedBack = po.to < (at ?? 0) - POSITION_TOLERANCE && g[1]!.thread != null && Math.abs(g[1]!.thread - po.to) <= POSITION_TOLERANCE;
      part = { id, how: "pulled", mats: [mat], at, to: po.to, ...(po.around !== undefined && { post: po.around }), ...(po.bubble !== undefined && { bubble: po.bubble }), ...(po.wing !== undefined && { tipWing: po.wing }), ...(po.fold !== undefined && { fold: po.fold }), ...(tieIn.taper && { taper: true }), ...(tiedBack && { tiedBack }), ...bunchOf(tieIn), ...(g[2] && { trim: trimOf(g[2].s) }), keys: g.map((x) => x.i) };
    } else if (tieIn && /^tie-in wind tie-off( trim)?$/.test(ops)) {
      const w = g[1]!.s as Extract<Step, { op: "wind" }>;
      mat.turns = w.turns;
      if (w.around) part = { id, how: "parachute", mats: [mat], at, post: w.around, ...(g[3] && { trim: trimOf(g[3].s) }), keys: [g[0]!.i, g[1]!.i, ...(g[3] ? [g[3].i] : [])] };
      else if (tieIn.length !== undefined)
        part = { id, how: "bunch", mats: [mat], at, ...bunchOf(tieIn), windTo: w.to, keys: [g[0]!.i, g[1]!.i] };
      else part = { id, how: "wound", mats: [mat], at, to: w.to, ...(w.counter && { counter: true }), ...(g[3] && { trim: trimOf(g[3].s) }), keys: [g[0]!.i, g[1]!.i, ...(g[3] ? [g[3].i] : [])] };
    } else if (tieIn && /^tie-in wind trim( trim)?$/.test(ops)) {
      const w = g[1]!.s as Extract<Step, { op: "wind" }>;
      if (w.to === undefined || w.to >= at) return null;
      mat.turns = w.turns;
      if (g[3] && !(g[3].s as Extract<Step, { op: "trim" }>).keep) return null;
      part = { id, how: "palmered", mats: [mat], at, to: w.to, ...(g[3] && { trim: trimOf(g[3].s) }), keys: [g[0]!.i, g[1]!.i, g[2]!.i, ...(g[3] ? [g[3].i] : [])] };
    } else return null;
    const threadNotes: NonNullable<Part["threadNotes"]> = {};
    g.forEach((x) => {
      // Each step's note under the action it belongs to.
      const at = part!.keys.indexOf(x.i);
      const action = at >= 0 ? at : Math.max(0, part!.keys.filter((key) => key < x.i).length - 1);
      noted(action, x.s);
      if (x.threadNote && !threadNotes[action]) threadNotes[action] = x.threadNote;
    });
    if (Object.keys(threadNotes).length) part.threadNotes = threadNotes;
    // Fibres tied in as a tail and wound on as the body: a tail that becomes the body.
    const role = part.windTo !== undefined ? "tail" : roleOf(id, part.how, m.kind, g[0]!.s);
    const full = { ...part, role, ...(Object.keys(notes).length && { notes }), ...(Object.keys(mistakes).length && { mistakes }) } as Part;
    parts.push(full);
  }

  // Materials tied and wound together as one (an Adams's brown and grizzly hackle) are one part.
  const merged: Part[] = [];
  for (const p of parts) {
    const prev = merged.at(-1);
    if (prev && sameWay(prev, p, steps)) {
      // Its notes go with its material.
      prev.mats.push(...p.mats.map((m, k) => (k === 0 ? { ...m, ...(p.notes && { notes: p.notes }), ...(p.mistakes && { mistakes: p.mistakes }) } : m)));
      continue;
    }
    merged.push(p);
  }
  const all = [...merged, ...threadParts];
  // A parachute's post by its part's id.
  for (const p of all) if (p.post) p.post = all.find((x) => x.mats.some((m) => m.id === p.post))?.id ?? p.post;
  return { meta, parts: all, attach: attach ?? 0.85, ...(attachNote && { attachNote }), finish, ...(restarts.length && { restarts }) };
}

/** Two materials tied in one after the other and handled alike, as one part's mix. */
function sameWay(a: Part, b: Part, steps: Step[]): boolean {
  if (a.role !== b.role || a.how !== b.how || a.mats.length >= 3) return false;
  if (!["bunch", "wound", "parachute"].includes(a.how)) return false;
  const geom = (p: Part) => JSON.stringify([p.at, p.to, p.length, p.angle, p.spread, p.width, p.side, p.forward, p.post, p.counter, p.trim, p.windTo, p.fan]);
  if (geom(a) !== geom(b)) return false;
  // The tie-ins next to each other, and each later action right after the other's.
  const lastA = a.keys.length;
  if (lastA !== b.keys.length || a.mats.length * 1 === 0) return false;
  const tieInsAdjacent = b.keys[0] === a.keys[0]! + a.mats.length;
  if (!tieInsAdjacent) return false;
  for (let k = 1; k < a.keys.length; k++) {
    // The other's winding and tie-off follow the first's (two steps each).
    const gap = b.keys[k]! - a.keys[k]!;
    const step = steps[a.keys[k]!];
    const size = step?.op === "wind" && steps[a.keys[k]! + 1]?.op === "tie-off" ? 2 : 1;
    if (gap !== size * a.mats.length) return false;
  }
  return true;
}

// ——— New parts and flies ———

/** A new part's id: its role, or role and colour, or numbered, as the dressing names parts. */
export function partId(fly: PartsFly, base: string, taken = new Set(fly.parts.flatMap((p) => [p.id, ...p.mats.map((m) => m.id)]))): string {
  // Only words the glossaries name (a part, a position, a named colour), so the dressing can
  // name it in every language: never a number.
  for (const id of [base, ...POSITIONS.map((pos) => `${base}-${pos}`), ...POSITIONS.flatMap((a) => POSITIONS.map((b) => `${base}-${a}-${b}`))]) {
    if (!taken.has(id)) return id;
  }
  return `${base}-${POSITIONS[0]}`;
}

/** Position words the glossaries have, for a second (third…) part of a kind. */
const POSITIONS = ["front", "rear", "middle", "upper", "lower"] as const;

/** Proportions a part can be set to at a tap: short, classic and long, as multiples of the classic. */
export const PRESETS = { short: 0.75, classic: 1, long: 1.3 } as const;
export type Preset = keyof typeof PRESETS;

/** The value a preset scales, for this part: a length, a body's end, a hackle's fibres. */
export function presetFor(p: Part): { get: number | undefined; classic: number; set: (v: number) => Partial<Part> } | null {
  const c = CLASSIC[p.role];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  if (p.length !== undefined && c.length !== undefined) return { get: p.length, classic: c.length, set: (v) => ({ length: r2(v) }) };
  // (An extended body's `to` is where the rest of its strip is pulled over to, not its end.)
  if (p.role === "body" && p.to !== undefined && p.how !== "extended") return { get: p.to, classic: c.to!, set: (v) => ({ to: r2(Math.min(1, Math.max((p.at ?? p.from ?? 0) + 0.05, v))) }) };
  const fibre = p.mats[0]?.props?.fibre;
  if (p.role === "hackle" && typeof fibre === "number")
    return { get: fibre, classic: 1.5, set: (v) => ({ mats: p.mats.map((m, i) => (i === 0 ? { ...m, props: { ...m.props, fibre: r2(v) } } : m)) }) };
  return null;
}

/**
 * Classic proportions for a new part, in gapes and shank fractions.
 */
// Assumption: a dry fly's classic proportions (the Catskill school, as in the patterns): a tail
// a shank long (1.7 gapes), the body over the rear seven tenths, upright wings at three quarters
// about 1.8 gapes tall, a collar hackle in front with fibres one and a half gapes; a tag a
// twentieth of the shank; a thorax over the front third; a wing laid back a little longer than
// the body; a beard of a gape.
export const CLASSIC: Record<Role, Partial<Part>> = {
  bead: {},
  weight: { from: 0.3, to: 0.75 },
  eyes: { at: 0.85 },
  tag: { at: 0, to: 0.06 },
  tail: { at: 0, length: 1.7, angle: 0, spread: 15 },
  butt: { at: 0.02, to: 0.12 },
  rib: { at: 0, to: 0.7 },
  body: { at: 0, from: 0, to: 0.7 },
  thorax: { at: 0.6, from: 0.6, to: 0.88 },
  back: { at: 0, to: 0.88 },
  wing: { at: 0.75, length: 1.8, angle: 90, spread: 22 },
  hackle: { at: 0.7, to: 0.9 },
  legs: { at: 0.75, length: 1, angle: 30, side: "under" },
  antennae: { at: 0.9, length: 1, angle: 15, forward: true },
  flash: { at: 0.8, length: 2.5, angle: 5, spread: 20 },
  head: { at: 0.88, from: 0.88, to: 0.95 },
  other: { at: 0.5 },
};

// Assumption: the props the patterns most often give a new material of these archetypes.
function propsFor(kind: MaterialKind): PartMaterial["props"] | undefined {
  const a = arch(kind);
  if (a === "hackle") return { fibre: 1.5 };
  // Assumption: a 3 mm bead or cone, 4 mm eyes, as for a size 12.
  if (a === "bead") return { mm: 3 };
  if (a === "eyes") return { mm: 4 };
  return undefined;
}

/** A new part of this role and material at classic proportions, ordered as convention ties it. */
export function newPart(fly: PartsFly, role: Role, kind: MaterialKind, color?: string, how?: How): Part {
  const id = partId(fly, role);
  const props = propsFor(kind);
  const c = color ?? colourFor(kind);
  const part: Part = { id, role, how: "wound", mats: [{ id, kind, ...(c && { color: c }), ...(props && { props }) }], keys: [] };
  const ways = waysFor(role, kind).filter((w) => !unavailable(fly, part, w));
  return withHow(fly, part, how ?? ways[0] ?? waysFor(role, kind)[0]!);
}

/** A colour for a material that needs one (its own where it has one, which needs none). */
function colourFor(kind: MaterialKind): string | undefined {
  if ((MATERIALS[kind] as { defaultColor?: string }).defaultColor) return undefined;
  const sample = sampleColour(kind);
  return sample === "natural" ? undefined : sample;
}

/** A fly with nothing on its hook yet. */
export function bareHook(meta: PartsFly["meta"]): PartsFly {
  // Assumption: the thread started a little behind the eye, as most patterns start it.
  return { meta, parts: [], attach: 0.85, finish: { turns: 5, key: 100 } };
}

/** A copy of a recipe as parts, its whip finish after everything a new part could add. */
export function fromRecipe(recipe: Recipe): PartsFly | null {
  return partsOf(recipe);
}

// ——— Changing how a part is tied ———

/** Why a part can't be tied this way on this fly, or null when it can. */
export function unavailable(fly: PartsFly, part: Part, how: How): "needsRib" | "needsPost" | "oneMaterial" | "twoMaterials" | null {
  // A top strand and a belly's.
  // (A needle body's tails are not a strand of it.)
  if (how === "woven") return bodyMats(part).length === 2 ? null : "twoMaterials";
  if (how === "palmered") {
    // Each material wound back is held by the next winding: only one can be.
    if (part.mats.length > 1) return "oneMaterial";
    // (One rib holds one palmered tip: not a second hackle's too.)
    if (fly.parts.some((p) => p.id !== part.id && p.how === "palmered")) return "oneMaterial";
    // Its tip is held by a winding forward over it: a rib (or a body wound after it).
    const holds = fly.parts.some((p) => p.id !== part.id && p.role === "rib" && p.how === "wound");
    return holds ? null : "needsRib";
  }
  if (how === "parachute") return fly.parts.some((p) => isPost(p)) ? null : "needsPost";
  return null;
}

/**
 * How far back along the shank a part's positions may go: behind the bend (to -1, a shank length)
 * for the thread's moves on a fly with hair folded back, which the thread binds there (a
 * Paradrake's extended body); otherwise the bend.
 */
export function rearLimit(fly: PartsFly, part: Part): number {
  const folded = fly.parts.some((p) => p.how === "pulled" && p.tiedBack && p.mats.every((m) => arch(m.kind) === "hair"));
  return part.how === "thread" && folded ? -1 : 0;
}

/** An upright bunch a parachute hackle can be wound round. */
export const isPost = (p: Part) =>
  p.how === "bunch" && (p.angle ?? 0) >= UPRIGHT && p.side !== "across" && p.mats.every((m) => !["feather", "strip", "tubing"].includes(arch(m.kind)));

/** The part tied another way, its measurements made to suit, re-ordered as convention ties it. */
export function withHow(fly: PartsFly, part: Part, how: How): Part {
  const body = fly.parts.find((p) => p.role === "body" && p.id !== part.id);
  // (An extended body sticks out behind: it covers no shank to wind along.)
  const [bodyFrom, bodyTo] = body && body.how !== "extended" ? extentOf(body) : [0, 0.7];
  const c = CLASSIC[part.role];
  const next: Omit<Part, "keys"> & { keys?: number[] } = { ...part, how };
  for (const k of ["at", "from", "to", "turns", "length", "angle", "spread", "width", "side", "forward", "post", "collar", "windTo", "trim", "passes", "tip", "counter", "fray", "fan", "segments", "tailLength", "tailSpread", "taper", "fold"] as const) delete next[k];
  switch (how) {
    case "bunch":
      if (part.mats.some((m) => arch(m.kind) === "eyes")) Object.assign(next, { at: c.at ?? 0.85 });
      else if (part.role === "hackle") Object.assign(next, { at: 0.85, length: 1, angle: 30, side: "under" });
      else if (part.role === "tag") Object.assign(next, { at: 0, length: 0.5, spread: 40 });
      else Object.assign(next, { at: c.at ?? 0, length: c.length ?? 1, angle: c.angle ?? 0, spread: c.spread ?? 15, ...(c.side && { side: c.side }), ...(c.forward && { forward: true }) });
      // Hair butts to trim, unless it points forward: its butts then lie back under the turns.
      if (part.mats.some((m) => arch(m.kind) === "hair") && !next.forward) next.trim = {};
      break;
    case "wound":
      Object.assign(next, { at: c.at ?? c.from ?? 0, to: c.to ?? 0.7 });
      if (part.role === "rib") Object.assign(next, { at: bodyFrom, to: bodyTo });
      break;
    case "palmered":
      Object.assign(next, { at: bodyTo, to: Math.min(bodyTo - 0.1, bodyFrom + 0.05) });
      break;
    case "parachute": {
      const post = fly.parts.find(isPost);
      Object.assign(next, { at: post?.at ?? 0.75, post: post?.id });
      break;
    }
    case "dubbed":
    case "spun":
    case "thread":
      Object.assign(next, { from: c.from ?? c.at ?? 0, to: c.to ?? 0.7 });
      if (how === "spun") next.trim = { leave: 0.5, shape: "round" };
      break;
    case "glued":
      // Assumption: a crab's body, from behind the eyes to the bend, about 1.2 gapes across and
      // 0.6 thick, trimmed round (Chicone's Raghead Crab: the size of a dime on a #2).
      Object.assign(next, { from: 0.1, to: 0.75, length: 0.6, trim: { leave: 0.3, shape: "disc" } });
      break;
    case "pulled":
      Object.assign(next, { at: c.at ?? 0, to: c.to ?? 0.88 });
      break;
    case "sleeve":
    case "woven":
      Object.assign(next, { at: c.at ?? c.from ?? 0, to: c.to ?? 0.7 });
      break;
    case "extended":
      Object.assign(next, { at: 0, length: 1 });
      break;
    case "weight":
      Object.assign(next, { from: 0.3, to: 0.75 });
      break;
    case "slide":
      break;
  }
  return { ...next, keys: keysFor(fly, next) } as Part;
}

/** The fly with a new part added where convention ties it. */
export function addPart(fly: PartsFly, role: Role, kind: MaterialKind, color?: string, how?: How): { fly: PartsFly; part: Part } {
  const base = renumbered(fly);
  const part = newPart(base, role, kind, color, how);
  return { fly: { ...base, parts: [...base.parts, part] }, part };
}

/** The fly with one part tied another way. */
export function setHow(fly: PartsFly, id: string, how: How): PartsFly {
  const before = fly.parts.find((p) => p.id === id);
  // Already tied so: as it is.
  if (before?.how === how) return fly;
  // A body made on a needle tied another way: its tails, which were in it, become a tail tied in
  // where it was, reaching as far.
  if (before && before.how === "extended" && before.tailLength !== undefined && how !== "extended" && before.mats[1]) {
    const { tailLength, tailSpread, segments: _s, ...rest } = before;
    const tails = before.mats[1];
    const body = { ...rest, mats: before.mats.filter((_, i) => i !== 1) } as Part;
    const tail: Omit<Part, "keys"> = {
      id: partId({ ...fly, parts: fly.parts.map((p) => (p.id === id ? body : p)) }, "tail"), role: "tail", how: "bunch", mats: [tails], at: before.at ?? 0,
      length: Math.round(((before.length ?? 0) + tailLength) * 100) / 100, angle: before.angle ?? 0, ...(tailSpread !== undefined && { spread: tailSpread }),
      ...(arch(tails.kind) === "hair" && { trim: {} }),
    };
    const moved = { ...fly, parts: fly.parts.map((p) => (p.id === id ? body : p)) };
    const base = renumbered(moved);
    fly = { ...base, parts: [...base.parts, { ...tail, keys: keysFor(base, tail) } as Part] };
  }
  const base = renumbered(fly);
  // The parts that go with it follow (a palmered hackle's rib ends where it is tied in).
  return tidied(constrained({ ...base, parts: base.parts.map((p) => (p.id === id ? withHow(base, p, how) : p)) }));
}

/**
 * The materials a part is made of, without a body's tails: a body made on a needle carries its
 * tails as its second material, tied in with it, not as a material of the body.
 */
export const bodyMats = (p: Part): PartMaterial[] => (p.how === "extended" && p.tailLength !== undefined ? p.mats.slice(0, 1) : p.mats);

/**
 * Settings left over that no longer apply: a fan on a bunch that isn't upright (or is of
 * feathers), a strip parted round a post that is gone or no longer stands upright.
 */
function tidied(fly: PartsFly): PartsFly {
  let changed = false;
  // Behind the bend the thread binds only hair folded back: without it, its passes stop at the bend.
  const folded = fly.parts.some((p) => p.how === "pulled" && p.tiedBack && p.mats.every((m) => arch(m.kind) === "hair"));
  const onShank = (x: number | undefined) => (x === undefined ? x : Math.max(0, x));
  const parts = fly.parts.map((p) => {
    let next = p;
    if (!folded && p.how === "thread" && [p.from, p.to, ...(p.passes ?? []).flatMap((x) => [x.from, x.to])].some((x) => x !== undefined && x < 0)) {
      next = { ...next, from: onShank(p.from), to: onShank(p.to), ...(p.passes && { passes: p.passes.map((x) => ({ ...x, from: Math.max(0, x.from), to: Math.max(0, x.to) })) }) };
    }
    // Feathers are tied in pointing back.
    if (next.forward && p.mats.some((m) => arch(m.kind) === "feather")) {
      const { forward: _f, ...rest } = next;
      next = rest as Part;
    }
    // (Strands tied across fan from leaning back to leaning forward.)
    const fans = p.side === "across" || ((p.angle ?? 0) >= UPRIGHT && !p.mats.some((m) => arch(m.kind) === "feather"));
    if (p.fan !== undefined && (p.how !== "bunch" || p.length === undefined || !fans)) {
      const { fan: _f, ...rest } = next;
      next = rest as Part;
    }
    // Cut tapered only to a width; folded back as a head only of foam pulled forward, straight over.
    if (next.taper && (next.how !== "pulled" || next.width === undefined || next.length !== undefined)) {
      const { taper: _t, ...rest } = next;
      next = rest as Part;
    }
    // (The rest of an extended foam body's strip, pulled over, can be folded too; its tails aside.)
    const folds = next.how === "pulled" || (next.how === "extended" && next.to !== undefined);
    if (next.fold !== undefined && (!folds || !bodyMats(next).every((m) => arch(m.kind) === "foam") || (next.to ?? 0.9) <= (next.at ?? 0) + POSITION_TOLERANCE || next.bubble !== undefined || next.post !== undefined)) {
      const { fold: _f, ...rest } = next;
      next = rest as Part;
    }
    if ((p.how === "pulled" || p.how === "extended") && p.post !== undefined) {
      const post = fly.parts.find((x) => x.id === p.post);
      // Upright, and passed on the strip's way forward.
      const between = post?.at !== undefined && p.to !== undefined && post.at > (p.at ?? 0) + POSITION_TOLERANCE && post.at < p.to - POSITION_TOLERANCE;
      if (!post || !isPost(post) || !between) {
        const { post: _p, ...rest } = next;
        next = rest as Part;
      }
    }
    if (next !== p) changed = true;
    return next;
  });
  return changed ? { ...fly, parts } : fly;
}

// ——— Editing ———

const near = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && Math.abs(a - b) < 0.02;

/**
 * The fly with one part changed, and the parts that go with it following: a rib keeps to its
 * body, a hackle or thorax starting where the body ended moves with that end, a palmered hackle
 * keeps to the body's ends, a parachute stays on its post.
 */
export function setPart(fly: PartsFly, id: string, patch: Partial<Part>): PartsFly {
  const before = fly.parts.find((p) => p.id === id);
  if (!before) return fly;
  // The changed part within its bounds first, so what follows it follows a tieable value.
  const after = constrained({ ...fly, parts: [{ ...before, ...patch } as Part] }).parts[0]!;
  // A post a parachute is wound round stays upright.
  if (fly.parts.some((p) => p.how === "parachute" && p.post === id) && after.angle !== undefined) after.angle = Math.max(UPRIGHT, after.angle);
  const parts = fly.parts.map((p) => {
    if (p.id === id) return after;
    if (before.role === "body") {
      const start = (x: Part) => x.at ?? x.from;
      if (p.role === "rib" && near(start(p), start(before)) && near(p.to, before.to)) return { ...p, at: start(after), to: after.to };
      if ((p.role === "hackle" || p.role === "thorax") && (p.how === "wound" || p.how === "dubbed") && near(start(p), before.to)) {
        const span = (p.to ?? 0) - (start(p) ?? 0);
        const from = Math.min(after.to ?? 0.7, 0.95);
        return p.how === "dubbed" ? { ...p, from, to: Math.min(1, from + span) } : { ...p, at: from, to: Math.min(1, from + span) };
      }
      if (p.how === "palmered" && near(p.at, before.to)) return { ...p, at: after.to };
    }
    if (p.how === "parachute" && p.post === id && after.at !== undefined) return { ...p, at: after.at };
    return p;
  });
  let next = constrained({ ...fly, parts });
  // A trim switched on or off changes the part's actions: its keys follow.
  if (actionCount(after) !== before.keys.length) {
    const base = renumbered(next);
    next = { ...base, parts: base.parts.map((p) => (p.id === id ? { ...p, keys: keysFor(base, p) } : p)) };
  }
  // (A wing laid down no longer fans, nor parts a strip round it.)
  return tidied(next);
}

/**
 * The fly's parts kept tieable: a winding at least a twentieth of the shank long, a palmered
 * hackle's tip where its rib winds over it, a parachute's post upright.
 */
function constrained(fly: PartsFly): PartsFly {
  const ribs = fly.parts.filter((p) => p.role === "rib" && p.how === "wound");
  const parts = fly.parts.map((p) => {
    // Hair turned to point forward has no butts left to trim.
    if (p.how === "bunch" && p.forward && p.trim && p.mats.some((m) => arch(m.kind) === "hair")) {
      const { trim: _t, ...rest } = p;
      return rest as Part;
    }
    const start = p.at ?? p.from;
    // (A thread body may run back and forth: its passes are left as they are. Dubbing may be
    // wound back from the eye, ending at the rear of a thorax.)
    const rearward = p.how === "dubbed" && start !== undefined && p.to !== undefined && p.to <= start - 0.05;
    if (!rearward && (p.how === "wound" || p.how === "woven" || p.how === "dubbed" || p.how === "spun" || p.how === "glued") && start !== undefined && p.to !== undefined && p.to < start + 0.05) {
      // At the eye, its start moves back instead.
      const key = p.at !== undefined ? "at" : "from";
      return start + 0.05 <= 1 ? { ...p, to: start + 0.05 } : { ...p, [key]: 0.95, to: 1 };
    }
    // A sleeve reaches from where it is tied down to somewhere else.
    if (p.how === "sleeve" && p.at !== undefined && p.to !== undefined && Math.abs(p.to - p.at) < 0.05) {
      return p.at + 0.05 <= 1 ? { ...p, to: p.at + 0.05 } : { ...p, to: p.at - 0.05 };
    }
    if (p.how === "palmered" && ribs.length) {
      // Tied in far enough from the bend to wind back over something, its tip on the shank.
      const at = Math.max(p.at ?? 1, 0.1);
      const hi = at - 0.1;
      const lo = Math.max(0, Math.min((ribs[0]!.at ?? 0) + 0.01, hi));
      return { ...p, at, to: Math.max(lo, Math.min(hi, p.to ?? lo)) };
    }
    return p;
  });
  // The rib under a palmered hackle starts behind its tip.
  const tip = parts.find((p) => p.how === "palmered");
  if (tip && ribs[0]) {
    const i = parts.findIndex((x) => x.id === ribs[0]!.id);
    const r = parts[i]!;
    if ((r.at ?? 0) > (tip.to ?? 0) - 0.01) parts[i] = { ...r, at: Math.max(0, (tip.to ?? 0) - 0.01) };
  }
  // A rib that holds a palmered tip is wound up to where the hackle was tied in (where the
  // thread is), straight after it, as on an Elk Hair Caddis.
  const palmered = parts.find((p) => p.how === "palmered");
  if (palmered && ribs[0]) {
    const i = parts.findIndex((x) => x.id === ribs[0]!.id);
    parts[i] = { ...parts[i]!, to: palmered.at };
  }
  return { ...fly, parts };
}

/** Where a part lies along the shank, rear to front, over all its passes. */
export function extentOf(p: Part): [number, number] {
  const ends = [p.at, p.from, p.to, ...(p.passes ?? []).flatMap((x) => [x.from, x.to])].filter((x): x is number => x !== undefined);
  return ends.length ? [Math.min(...ends), Math.max(...ends)] : [0, 0.7];
}

/** The fly without a part; a parachute that was wound round it becomes a collar. */
export function removePart(fly: PartsFly, id: string): PartsFly {
  let next: PartsFly = { ...fly, parts: fly.parts.filter((p) => p.id !== id) };
  for (const p of next.parts) if (p.how === "parachute" && p.post === id) next = setHow(next, p.id, "wound");
  // A palmered hackle with no rib left to hold it is wound forward as a collar instead.
  for (const p of next.parts) if (p.how === "palmered" && unavailable(next, p, "palmered")) next = setHow(next, p.id, "wound");
  // (A strip parted round it is pulled straight over.)
  return tidied(next);
}

/** A part with another material mixed in (up to three), ids naming each by its colour. */
export function addMaterial(fly: PartsFly, id: string, kind: MaterialKind, color?: string): PartsFly {
  const part = fly.parts.find((p) => p.id === id);
  // (Two strands are woven: a top and a belly.)
  if (!part || part.mats.length >= (part.how === "woven" ? 2 : 3)) return fly;
  const others = { ...fly, parts: fly.parts.filter((p) => p.id !== id) };
  const props = propsFor(kind);
  const c = color ?? colourFor(kind);
  const mats = [...part.mats, { id: "", kind, ...(c && { color: c }), ...(props && { props }) }];
  const taken = new Set(others.parts.flatMap((p) => [p.id, ...p.mats.map((m) => m.id)]));
  // Each by its colour where it is a named one ("hackle-grizzly"), else by a position word.
  const named = mats.map((m) => {
    // (A colour of two words, "fluo-red", would read as two parts: a position word instead.)
    const base = m.color && m.color in NAMED_COLORS && !m.color.includes("-") ? `${part.role}-${m.color}` : part.role;
    const mid = partId(others, base, taken);
    taken.add(mid);
    return { ...m, id: mid };
  });
  return { ...fly, parts: fly.parts.map((p) => (p.id === id ? { ...p, mats: named } : p)) };
}

/** A part with one of its mixed materials taken out. */
export function removeMaterial(fly: PartsFly, id: string, index: number): PartsFly {
  const next = {
    ...fly,
    parts: fly.parts.map((p) => {
      if (p.id !== id || p.mats.length < 2) return p;
      const tails = p.how === "extended" && p.tailLength !== undefined;
      // (A body made on a needle is not left as only its tails.)
      if (tails && index === 0) return p;
      const mats = p.mats.filter((_, i) => i !== index);
      // Its tails taken out: a body without them.
      if (tails && index === 1) {
        const { tailLength: _l, tailSpread: _s, ...rest } = p;
        return { ...rest, mats, trim: trimFor(p, mats) } as Part;
      }
      return { ...p, mats, trim: trimFor(p, mats) };
    }),
  };
  // One strand left of a woven body: wound.
  const part = next.parts.find((p) => p.id === id);
  if (part?.how === "woven" && part.mats.length < 2) return setHow(next, id, "wound");
  return tidied(rekeyed(next, id));
}

/**
 * The trim a part can have with these materials: hair butts only where there is hair, a foam
 * back's head only of foam, a hackle cut to shape only of hackle; a palmered tip always.
 */
function trimFor(p: Part, mats: PartMaterial[]): Part["trim"] {
  const all = (a: Archetype) => mats.every((m) => arch(m.kind) === a);
  const any = (a: Archetype) => mats.some((m) => arch(m.kind) === a);
  switch (p.how) {
    case "bunch":
      // (Hair tied in pointing forward, or across the shank as legs, has no butts to trim.)
      return any("hair") && !p.forward && p.side !== "across" ? (p.trim ?? {}) : undefined;
    case "pulled":
      // (And the tips of hair folded back and tied down, a bullet head's.)
      return all("foam") || all("strip") || (all("hair") && p.tiedBack) ? p.trim : undefined;
    case "wound":
    case "palmered":
      return p.trim?.keep && all("hackle") ? { keep: p.trim.keep } : p.how === "palmered" ? {} : undefined;
    case "spun":
      return p.trim;
    case "glued":
      // Pads laid across the shank are clipped to a disc or cut flat, not to a head.
      return p.trim && !p.trim.keep && p.trim.shape !== "disc" ? { leave: p.trim.leave ?? 0.3, shape: "disc" } : p.trim;
    case "extended":
      // The rest of a foam strip pulled over, cut to a head (its tails aside).
      return p.to !== undefined && bodyMats({ ...p, mats }).every((m) => arch(m.kind) === "foam") ? p.trim : undefined;
    default:
      return undefined;
  }
}

/** The fly with a part's order keys made to fit its actions again (a trim come or gone). */
function rekeyed(fly: PartsFly, id: string): PartsFly {
  const part = fly.parts.find((p) => p.id === id);
  if (!part || actionCount(part) === part.keys.length) return fly;
  const base = renumbered(fly);
  return { ...base, parts: base.parts.map((p) => (p.id === id ? { ...p, keys: keysFor(base, p) } : p)) };
}

/** A part's material (one of its mix) changed. */
export function setMaterial(fly: PartsFly, id: string, index: number, patch: Partial<PartMaterial>): PartsFly {
  const parts = fly.parts.map((p) => {
    if (p.id !== id) return p;
    const mats = p.mats.map((m, i) => {
      if (i !== index) return m;
      const next = { ...m, ...patch };
      // A new kind brings its own settings (a hackle's fibres), not the old one's, and a colour
      // if it needs one.
      if (patch.kind && patch.kind !== m.kind) {
        const props = propsFor(patch.kind);
        if (props) next.props = props;
        else delete next.props;
        if (!patch.color && (MATERIALS[patch.kind] as { defaultColor?: string }).defaultColor) delete next.color;
        if (!next.color) {
          const c = colourFor(patch.kind);
          if (c) next.color = c;
        }
      }
      return next;
    });
    const next: Part = { ...p, mats, trim: trimFor(p, mats) };
    // Settings only some materials take: a feather's width, strands tied across, fibres wound on.
    // (An extended body's width is its thickness.)
    // (A strip pulled over keeps the width it is cut to, unless it is hair.)
    const cutStrip = p.how === "pulled" && p.length === undefined && mats.every((m) => arch(m.kind) !== "hair");
    if (!mats.some((m) => arch(m.kind) === "feather") && p.how !== "extended" && !cutStrip) delete next.width;
    if (next.side === "across" && !mats.every((m) => ACROSS_KINDS.includes(arch(m.kind)))) delete next.side;
    if (next.windTo !== undefined && !mats.every((m) => WINDABLE.includes(arch(m.kind)))) delete next.windTo;
    return next;
  });
  let next: PartsFly = { ...fly, parts };
  // A material that can't be tied the way the part is: the first way it can be.
  const part = next.parts.find((p) => p.id === id)!;
  const ways = waysOf(part);
  if (!ways.length) return fly;
  if (!ways.includes(part.how)) next = setHow(next, id, ways.find((w) => !unavailable(next, part, w)) ?? ways[0]!);
  next = rekeyed(next, id);
  // A post that can no longer carry a parachute (hackle tips): its hackle is wound as a collar.
  for (const p of next.parts) if (p.how === "parachute" && p.post === id && !isPost(next.parts.find((x) => x.id === id)!)) next = setHow(next, p.id, "wound");
  return tidied(next);
}

/** The ways a part can be tied with every material in it. */
export function waysOf(part: Part): How[] {
  const mats = bodyMats(part);
  return waysFor(part.role, mats[0]!.kind).filter((w) => mats.every((m) => waysFor(part.role, m.kind).includes(w)));
}

/** The fly styles to start from, each a pattern of that style as parts, without its notes. */
// Assumption: one representative, widely tied pattern for each style.
export const STYLES = {
  dry: "adams",
  parachute: "parachute-adams",
  caddis: "elk-hair-caddis",
  nymph: "gold-ribbed-hares-ear-nymph",
  wet: "black-pennell",
  streamer: "woolly-bugger",
  emerger: "klinkhamer-special",
  terrestrial: "foam-beetle",
  salmon: "stoats-tail",
} as const;
export type Style = keyof typeof STYLES;

/**
 * A recipe's parts as the start of a fly: its dressing and order (a copy of a pattern, made with
 * own.ts's copyOf), without its notes for a style.
 */
export function startFrom(recipe: Recipe, keepNotes = false): PartsFly | null {
  const fly = partsOf(recipe);
  if (!fly) return null;
  if (keepNotes) return fly;
  return {
    ...fly,
    parts: fly.parts.map(({ notes: _n, mistakes: _m, ...p }) => p as Part),
    finish: { turns: fly.finish.turns, key: fly.finish.key },
    ...(fly.restarts && { restarts: fly.restarts.map(({ key, turns, at, finishAt }) => ({ key, turns, at, ...(finishAt !== undefined && { finishAt }) })) }),
  };
}

