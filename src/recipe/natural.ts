import { z } from "zod";
import type { RecipeError } from "./errors";
import { kdlToObject, KdlMappingError, type Shape } from "./kdl";
import { withLocation } from "./load";
import { Color, MONTHS, Source } from "./schema";

/**
 * A natural: an insect, crustacean or fish that patterns imitate, described like a pattern so
 * the same renderer can draw it (naturals/*.kdl). The body is a row of sections from rear to
 * front; lengths are fractions of the body length (tails and antennae excluded), and the real
 * size is a range in millimetres, so a natural can be shown to scale beside a fly.
 */

export const NATURAL_GROUPS = ["mayfly", "caddis", "stonefly", "chironomid", "damselfly", "terrestrial", "baitfish", "crustacean", "leech"] as const;

export const STAGES = ["nymph", "larva", "pupa", "emerger", "dun", "spinner", "adult", "juvenile"] as const;

/** Where and how a natural is found in the water, for the water view. */
export const RIDES = ["on-surface", "in-film", "drifting", "swimming", "crawling"] as const;

/** Markings on a body section, drawn in its `ink`. */
export const MARKS = ["none", "bands", "spots", "mottle", "stripe"] as const;

export const REGIONS = ["southern-sweden", "northern-scandinavia", "british-isles", "central-europe", "northern-usa"] as const;

const Fraction = z.number().min(0).max(4);

const Section = z.strictObject({
  section: z.string().min(1),
  length: z.number().positive().max(1),
  /** Radius at the section's start, as a fraction of the body length. */
  radius: z.number().positive().max(0.5),
  /** Radius at its end, as a fraction of `radius` (1: a cylinder). */
  taper: z.number().min(0).max(3).default(1),
  /** Visible rings along the section. */
  segments: z.number().int().min(0).max(20).default(0),
  color: Color,
  /** Underside colour, if different. */
  belly: Color.optional(),
  /** Height over width: below 1 flattened top to bottom (a stonefly nymph), above 1 from side to side (a fish, a shrimp). */
  flatten: z.number().positive().max(4).default(1),
  /** 0 opaque to 1 glassy (a midge pupa, a shrimp's shell). */
  translucency: z.number().min(0).max(1).default(0),
  /** 0: a straight taper; 1: rounded like an egg (an ant's gaster, a fish's head). */
  round: z.number().min(0).max(1).default(0),
  /** How hairy: 0 smooth (a mayfly) to 1 furry (a caddis adult's thorax, a stonefly nymph's fringes). */
  hairs: z.number().min(0).max(1).default(0),
  /** Markings: bands across the segments, spots, mottling (a sculpin), a stripe along the back. */
  marks: z.enum(MARKS).default("none"),
  /** The markings' colour. */
  ink: Color.optional(),
});

const Part = z.discriminatedUnion("part", [
  /** `spread`: degrees between the outer tails. */
  z.strictObject({
    part: z.literal("tails"),
    count: z.number().int().min(1).max(3),
    length: Fraction,
    spread: z.number().min(0).max(120).default(25),
    color: Color,
    /** Flat leaves rather than threads (a damselfly nymph's tail gills). */
    leaf: z.boolean().default(false),
    /** Fringes of fine hairs along them (a swimming mayfly nymph's tails), 0–1. */
    hairs: z.number().min(0).max(1).default(0),
  }),
  z.strictObject({
    part: z.literal("wings"),
    count: z.union([z.literal(2), z.literal(4)]),
    /** upright (mayfly dun), tent (caddis, roof-like), flat (stonefly, over the back), spent (spinner, out to the sides), back (swept back along the body: a midge, a beetle's case). */
    shape: z.enum(["upright", "tent", "flat", "spent", "back"]),
    length: Fraction,
    width: Fraction,
    color: Color,
    /** 0 opaque to 1 clear. */
    clarity: z.number().min(0).max(1).default(0.3),
    veins: z.boolean().default(false),
    /** The hind wing's length as a fraction of the fore wing's (a mayfly's small hind wing; 0 none). */
    hind: z.number().min(0).max(1.2).default(0),
    /** Hairy wings, as a caddis's: 0 bare to 1 densely haired. */
    hairs: z.number().min(0).max(1).default(0),
    /** Darker flecks over the wing, if any (a caddis's mottled wing, a stonefly's). */
    mottle: Color.optional(),
  }),
  z.strictObject({
    part: z.literal("legs"),
    count: z.number().int().min(2).max(14),
    length: Fraction,
    color: Color,
    /** The body section they come from (default: the thorax). */
    at: z.string().optional(),
    /** The last pair's length relative to the others (a grasshopper's jumping legs). */
    hind: z.number().positive().max(4).optional(),
    /** The thigh and shin as fractions of the leg's length; the foot (tarsus) is the rest. */
    femur: z.number().min(0.1).max(0.7).default(0.38),
    tibia: z.number().min(0.1).max(0.7).default(0.34),
    /** Fringes of swimming hairs (0–1), and light and dark bands (a crawling mayfly nymph's legs). */
    hairs: z.number().min(0).max(1).default(0),
    banded: z.boolean().default(false),
  }),
  /** `swept`: laid back along the body (a caddis pupa) rather than reaching forward. */
  z.strictObject({ part: z.literal("antennae"), length: Fraction, color: Color, swept: z.boolean().default(false) }),
  /**
   * Gills along the abdomen (mayfly nymphs): plates (over the back or at the sides), feathery
   * plumes (a burrowing nymph's, held over the back) or tufts (at a stonefly nymph's legs).
   */
  z.strictObject({
    part: z.literal("gills"),
    count: z.number().int().min(1).max(10),
    length: Fraction,
    color: Color,
    shape: z.enum(["plate", "feather", "tuft"]).default("plate"),
  }),
  /** A burrowing mayfly nymph's mandibular tusks, curving forward from the head. */
  z.strictObject({ part: z.literal("tusks"), length: Fraction, color: Color }),
  /** Wing pads on top of the thorax (nymphs). */
  z.strictObject({ part: z.literal("wingpads"), length: Fraction, color: Color }),
  /** A caddis larva's case, over the abdomen. */
  z.strictObject({ part: z.literal("case"), material: z.enum(["sand", "gravel", "plant"]), length: Fraction, radius: Fraction, color: Color }),
  /** An emerger's shed skin trailing behind. */
  z.strictObject({ part: z.literal("shuck"), length: Fraction, color: Color }),
  z.strictObject({ part: z.literal("eyes"), size: Fraction, color: Color }),
  /** Fish fins: where along the body (0 rear, 1 front) and how big. */
  z.strictObject({ part: z.literal("fin"), kind: z.enum(["dorsal", "caudal", "pectoral", "pelvic", "anal", "adipose"]), at: z.number().min(0).max(1), size: Fraction, color: Color }),
]);

const Hatch = z.strictObject({
  region: z.enum(REGIONS),
  from: z.enum(MONTHS),
  to: z.enum(MONTHS),
  /** When in the day, if it matters: "morning", "midday", "afternoon", "evening", "night". */
  time: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

export const NaturalSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are lower case words joined by hyphens"),
  name: z.string().min(1),
  group: z.enum(NATURAL_GROUPS),
  stage: z.enum(STAGES),
  /** Examples of the species it stands for, for the text (e.g. "Baetis rhodani, Ephemerella ignita"). */
  examples: z.string().min(1).optional(),
  description: z.string().min(1),
  /** Body length in millimetres, tails and antennae excluded. */
  size: z.strictObject({ min: z.number().positive(), max: z.number().positive() }),
  rides: z.enum(RIDES),
  /** How far the body curls along its length, in degrees (a shrimp, a pupa). */
  curve: z.number().min(-180).max(180).default(0),
  body: z.array(Section).min(1),
  parts: z.array(Part).default([]),
  hatches: z.array(Hatch).default([]),
  sources: z.array(Source).min(1, "cite at least one source"),
});

export type Natural = z.infer<typeof NaturalSchema>;
export type NaturalPart = Natural["parts"][number];

const NATURAL_SECTIONS: Record<string, Shape> = {
  id: { kind: "scalar" },
  name: { kind: "scalar" },
  group: { kind: "scalar" },
  stage: { kind: "scalar" },
  examples: { kind: "scalar" },
  description: { kind: "scalar" },
  size: { kind: "record", arg: null },
  rides: { kind: "scalar" },
  curve: { kind: "scalar" },
  body: { kind: "list", nameKey: "section", arg: null },
  parts: { kind: "list", nameKey: "part", arg: null },
  hatches: { kind: "list", nameKey: "region", arg: null },
  sources: { kind: "list", nameKey: "title", arg: null },
};

export type NaturalResult = { ok: true; natural: Natural } | { ok: false; errors: RecipeError[] };

/** Parses and validates a natural, with errors pointing at their line. */
export function loadNatural(text: string): NaturalResult {
  let mapped;
  try {
    mapped = kdlToObject(text, NATURAL_SECTIONS);
  } catch (e) {
    if (e instanceof KdlMappingError) return { ok: false, errors: e.errors };
    throw e;
  }
  const parsed = NaturalSchema.safeParse(mapped.value);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) =>
      withLocation({ message: issue.message, path: issue.path.map((p) => (typeof p === "symbol" ? String(p) : p)) }, mapped.locations),
    );
    return { ok: false, errors };
  }
  const n = parsed.data;
  const errors: RecipeError[] = [];
  const err = (message: string, path: (string | number)[]) => errors.push(withLocation({ message, path }, mapped.locations));
  if (n.size.min > n.size.max) err("size min is larger than max", ["size", "min"]);
  n.body.forEach((b, i) => {
    if (b.marks !== "none" && !b.ink) err(`"${b.section}" has marks but no ink colour`, ["body", i, "marks"]);
  });
  n.parts.forEach((p, i) => {
    if (p.part === "legs" && p.femur + p.tibia > 0.9) err("femur and tibia leave no room for the foot (together at most 0.9)", ["parts", i, "tibia"]);
  });
  const total = n.body.reduce((s, b) => s + b.length, 0);
  if (Math.abs(total - 1) > 0.02) err(`the body sections' lengths add up to ${Math.round(total * 100) / 100}, not 1`, ["body"]);
  n.hatches.forEach((h, i) => {
    if (n.hatches.findIndex((o) => o.region === h.region) !== i) err(`"${h.region}" is given more than once`, ["hatches", i, "region"]);
  });
  return errors.length ? { ok: false, errors } : { ok: true, natural: n };
}
