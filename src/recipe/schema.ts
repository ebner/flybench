import { z } from "zod";
import { ARCHETYPE_PROPS, MATERIAL_KINDS, MATERIALS } from "./materials";

/**
 * The recipe model. KDL files are mapped onto this shape (see kdl.ts) and
 * validated here; everything downstream works with the `Recipe` type.
 *
 * Units: positions are fractions of the hook shank (0 = start of the bend,
 * 1 = just behind the eye). Lengths are multiples of the hook gape.
 */

export const NAMED_COLORS = {
  black: "#141414",
  white: "#f2f0ea",
  cream: "#e9dcc0",
  red: "#c8102e",
  "fluo-red": "#ff2a3d",
  brown: "#5e3214",
  "red-brown": "#6a2a12",
  "red-game": "#a8501f",
  ginger: "#c27a3a",
  tan: "#b08a5a",
  grizzly: "#9a9a96",
  olive: "#6b6b2a",
  grey: "#8a8a8a",
  dun: "#6a655c",
  yellow: "#e8c21c",
  green: "#2f7d32",
  gold: "#d4a537",
  silver: "#c9ccd1",
  copper: "#b87333",
  bleached: "#d8c7a0",
  elk: "#b39466",
  "hares-ear": "#7a6450",
  mallard: "#6e6558",
  "pheasant-tail": "#8a4a22",
  partridge: "#8a7558",
  snipe: "#6f6a64",
  lead: "#6b6e72",
  deer: "#6e5a48",
  squirrel: "#7e6e5e",
  moose: "#2b2622",
  tippet: "#e08a2a",
  crest: "#e8b923",
  pearl: "#e6e2ea",
  teal: "#cfcac0",
  turkey: "#8a6a48",
  badger: "#d9cdb4",
  "blue-dun": "#6e7480",
  purple: "#4b2a6b",
  orange: "#e0731f",
  pink: "#e88aa6",
  claret: "#6a1c2e",
  chartreuse: "#b5d52a",
  coch: "#5a2614",
  muskrat: "#5b5650",
  clear: "#d8dde0",
  "blue-black": "#1d2230",
} as const;

export type NamedColor = keyof typeof NAMED_COLORS;

const Color = z.union([
  z.enum(Object.keys(NAMED_COLORS) as [NamedColor, ...NamedColor[]]),
  z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a named colour or a hex colour like \"#c8102e\""),
]);

const Id = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "expected a lowercase id like \"peacock-herl\"");

/** Fraction of the shank, 0 = start of the bend, 1 = just behind the eye. */
const Position = z.number().min(0).max(1);

/** Multiple of the hook gape. */
const GapeLength = z.number().positive().max(5);

const Note = z.string().min(1).optional();

export const HOOK_MODEL_IDS = [
  "dry-standard", "dry-3xl-curved", "wet-standard", "nymph-2xl", "streamer-4xl",
  "emerger-curved", "scud-curved", "salmon-up-eye", "saltwater-straight",
] as const;
export const THREAD_SIZES = ["3/0", "6/0", "8/0", "10/0", "12/0", "14/0"] as const;

export const FLY_TYPES = [
  "dry", "wet", "nymph", "emerger", "midge", "streamer", "terrestrial", "salmon", "saltwater",
] as const;
export const IMITATES = [
  "mayfly", "caddis", "stonefly", "chironomid", "damselfly", "terrestrial", "baitfish", "crustacean", "attractor",
] as const;
export const SPECIES = ["trout", "grayling", "sea-trout", "salmon", "char", "bass", "panfish", "pike"] as const;
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

const Hook = z.strictObject({
  model: z.enum(HOOK_MODEL_IDS),
  size: z
    .number()
    .int()
    .min(2)
    .max(24)
    .refine((n) => n % 2 === 0, "hook sizes are even numbers"),
});

const Thread = z.strictObject({
  color: Color,
  size: z.enum(THREAD_SIZES),
});

const Material = z
  .strictObject({
    id: Id,
    kind: z.enum(MATERIAL_KINDS),
    color: Color.optional(),
    label: z.string().min(1).optional(),
    /** herl: number of strands wound together. */
    strands: z.number().int().min(1).max(6).optional(),
    /** hackle: fibre (barb) length in gapes. */
    fibre: GapeLength.optional(),
    /** floss: thread size. */
    size: z.enum(THREAD_SIZES).optional(),
    /** fibres, biots, flash: number of fibres or strands in the bunch. */
    count: z.number().int().min(1).max(60).optional(),
    /** hackle: how far the fibres lean back when wound, in degrees (overrides the catalog). */
    sweep: z.number().min(0).max(80).optional(),
    /** beads, eyes and wire: diameter in millimetres, as they are sold. */
    mm: z.number().min(0.05).max(12).optional(),
  })
  .superRefine((m, ctx) => {
    const cat = MATERIALS[m.kind];
    const allowed = ARCHETYPE_PROPS[cat.archetype];
    for (const prop of ["strands", "fibre", "size", "count", "sweep", "mm"] as const) {
      if (m[prop] !== undefined && !allowed.includes(prop)) {
        ctx.addIssue({ code: "custom", path: [prop], message: `"${prop}" does not apply to ${cat.name}` });
      }
    }
    if (cat.archetype === "hackle" && m.fibre === undefined) {
      ctx.addIssue({ code: "custom", path: ["fibre"], message: "a hackle needs its fibre length (in gapes)" });
    }
    if ((cat.archetype === "bead" || cat.archetype === "eyes") && m.mm === undefined) {
      ctx.addIssue({ code: "custom", path: ["mm"], message: `${cat.name} need a size in millimetres (mm=…)` });
    }
    if (m.color === undefined && !("defaultColor" in cat)) {
      ctx.addIssue({ code: "custom", path: ["color"], message: `${cat.name} needs a colour` });
    }
  });

const MaterialRef = Id;

const Side = z.enum(["top", "under"]);

const Step = z.discriminatedUnion("op", [
  /** Before the thread: slide a bead round the bend up to the eye. */
  z.strictObject({ op: z.literal("slide-bead"), material: MaterialRef, note: Note }),
  /** Wrap weighting wire on the shank, in touching turns. Allowed before the thread. */
  z.strictObject({
    op: z.literal("weight"),
    material: MaterialRef,
    from: Position,
    to: Position,
    note: Note,
  }),
  z.strictObject({ op: z.literal("attach-thread"), at: Position, note: Note }),
  z.strictObject({
    op: z.literal("wrap-thread"),
    to: Position,
    /** Omitted: touching turns. */
    turns: z.number().int().positive().optional(),
    note: Note,
  }),
  z.strictObject({
    op: z.literal("tie-in"),
    material: MaterialRef,
    /** How far the material sticks out rearward from the tie-in point (tags, tails, wings). */
    length: GapeLength.optional(),
    /** Degrees above the shank for material that sticks out (0 = straight back). */
    angle: z.number().min(0).max(90).optional(),
    /** Bunches (tags, tails, hair wings): how far round the body they fan out, in degrees to each side of the top. */
    spread: z.number().min(0).max(120).optional(),
    /** Feather wings: width of the feather, in gapes. */
    width: GapeLength.optional(),
    /** On top of the shank (default) or underneath it (beards, throats, under-wings). */
    side: Side.optional(),
    note: Note,
  }),
  z.strictObject({
    op: z.literal("wind"),
    material: MaterialRef,
    /** Along the shank: where the winding ends. Not used when winding around a post. */
    to: Position.optional(),
    /** Parachute: wind horizontally around this upright post instead of the shank. */
    around: MaterialRef.optional(),
    turns: z.number().int().positive(),
    note: Note,
  }),
  /** Fold a material tied in at the rear forward over the top of the body and tie it down at the thread. */
  z.strictObject({ op: z.literal("pull-over"), material: MaterialRef, to: Position, note: Note }),
  /** Spin hair round the shank in clumps from the thread forward to `to`; the thread ends there. */
  z.strictObject({
    op: z.literal("spin"),
    material: MaterialRef,
    to: Position,
    /** Leave the tips of the first clump trailing back as a collar this long (gapes), as on a Muddler. */
    collar: GapeLength.optional(),
    note: Note,
  }),
  z.strictObject({
    op: z.literal("dub"),
    material: MaterialRef,
    to: Position,
    /** Omitted: touching turns. */
    turns: z.number().int().positive().optional(),
    note: Note,
  }),
  z.strictObject({ op: z.literal("tie-off"), material: MaterialRef, note: Note }),
  z.strictObject({
    op: z.literal("trim"),
    material: MaterialRef,
    /** Length left standing, in gapes (hair butts). Default: flush. */
    leave: z.number().min(0).max(2).optional(),
    /**
     * Spun hair or hair butts: trim into a round head (Muddler) or a wedge, flat underneath
     * and rising towards the rear (G&H Sedge). Butts trimmed to a shape are spun round the shank.
     */
    shape: z.enum(["round", "wedge"]).optional(),
    /**
     * A wound hackle: "sides" cuts away the fibres on top and underneath (Superpuppan);
     * "top" cuts away only those underneath, so the fly sits low (Dyret).
     */
    keep: z.enum(["sides", "top"]).optional(),
    note: Note,
  }),
  z.strictObject({
    op: z.literal("whip-finish"),
    turns: z.number().int().positive().default(5),
    note: Note,
  }),
]);

const Origin = z.strictObject({
  originator: z.string().min(1).optional(),
  year: z.number().int().min(1400).max(2100).optional(),
  region: z.string().min(1).optional(),
});

const Source = z.strictObject({
  title: z.string().min(1),
  url: z.url().optional(),
});

/** A photo of the finished fly, used to check proportions while authoring. Never published. */
const Reference = z.strictObject({
  /** Direct link to the image file. */
  image: z.url(),
  /** The page the image is shown on, for attribution. */
  page: z.url().optional(),
  author: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  /** Mirror the photo so the eye points right, as in our renders. */
  flip: z.boolean().optional(),
  note: z.string().min(1).optional(),
});

export const RecipeSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  /** Set on variants: the id of the main pattern. */
  variantOf: Id.optional(),
  /** Short name of this variant, e.g. "Troth original". */
  variant: z.string().min(1).optional(),
  type: z.enum(FLY_TYPES),
  imitates: z.array(z.enum(IMITATES)).default([]),
  difficulty: z.enum(DIFFICULTIES),
  species: z.array(z.enum(SPECIES)).default([]),
  season: z.array(z.enum(MONTHS)).default([]),
  origin: Origin.optional(),
  description: z.string().min(1).optional(),
  history: z.string().min(1).optional(),
  fishing: z.string().min(1).optional(),
  sources: z.array(Source).default([]),
  references: z.array(Reference).default([]),
  hook: Hook,
  thread: Thread,
  materials: z.array(Material).default([]),
  steps: z.array(Step).min(1),
}).superRefine((r, ctx) => {
  if ((r.variantOf === undefined) !== (r.variant === undefined)) {
    ctx.addIssue({ code: "custom", path: ["variant"], message: "variant and variant-of go together" });
  }
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type Material = z.infer<typeof Material>;
export type Step = z.infer<typeof Step>;
export type Op = Step["op"];
export type ColorSpec = z.infer<typeof Color>;

export function resolveColor(color: string): string {
  return color in NAMED_COLORS ? NAMED_COLORS[color as NamedColor] : color;
}
