import { z } from "zod";
import type { RecipeError } from "./errors";
import { kdlToObject, KdlMappingError, type Shape } from "./kdl";
import { withLocation } from "./load";
import { Color, MONTHS, Reference, Source } from "./schema";

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
export const SITS = ["feet", "body", "spent"] as const;

/** Markings on a body section, drawn in its `ink`. */
export const MARKS = ["none", "bands", "spots", "mottle", "stripe"] as const;

/** Markings that a `mark` part can put on chosen segments. */
export const MARK_KINDS = ["bands", "spots", "streaks", "rows", "ring", "stripe", "mottle", "patch", "bars"] as const;

/** How a leg is held; without one, from where the natural is found (see the renderer). */
export const LEG_POSES = ["stand", "forward", "raised", "sprawl", "folded", "rowing", "trailing", "jumping"] as const;

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
  segments: z.number().int().min(0).max(120).default(0),
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
  /**
   * Half heights above and below the centre line, as fractions of the body length, where the
   * back and the belly differ (a fish's arched back and flatter belly). They replace the
   * height `radius` and `flatten` give; the width stays.
   */
  top: z.number().positive().max(0.5).optional(),
  bottom: z.number().positive().max(0.5).optional(),
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
    /** With three: the middle one's length relative to the outer two (a Baetis nymph's shorter middle tail). */
    middle: z.number().min(0).max(2).default(1),
    /** Light and dark rings along them. */
    banded: z.boolean().default(false),
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
    /** Degrees an upright wing leans back from straight up (a dun's), or a tent's roof slopes from flat. */
    angle: z.number().min(0).max(90).optional(),
  }),
  /**
   * Legs: all pairs alike, or one pair (`pair`: fore, mid, hind) with its own length and build;
   * a pair given on its own replaces that pair of an all-pairs entry.
   */
  z.strictObject({
    part: z.literal("legs"),
    /** Legs in all (default six); a pair's entry is two. */
    count: z.number().int().min(2).max(14).optional(),
    pair: z.enum(["fore", "mid", "hind"]).optional(),
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
    /** Joints in the foot (tarsal segments), and the claws at its end. */
    tarsi: z.number().int().min(1).max(5).default(3),
    claws: z.boolean().default(true),
    /** How it is held, where it differs from what the natural's place in the water implies. */
    pose: z.enum(LEG_POSES).optional(),
    /** Thickness relative to the usual (a digging leg's, a jumping thigh's). */
    thick: z.number().positive().max(4).default(1),
  }),
  /**
   * `swept`: laid back along the body (a caddis pupa) rather than reaching forward. `shape`:
   * thread-like, elbowed (an ant's), clubbed (a beetle's) or plumed (a male midge's), in
   * `segments` joints.
   */
  z.strictObject({
    part: z.literal("antennae"),
    length: Fraction,
    color: Color,
    swept: z.boolean().default(false),
    shape: z.enum(["thread", "elbowed", "clubbed", "plumed"]).default("thread"),
    segments: z.number().int().min(1).max(60).optional(),
    banded: z.boolean().default(false),
  }),
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
    banded: z.boolean().default(false),
  }),
  /** A burrowing mayfly nymph's mandibular tusks, curving forward from the head. */
  z.strictObject({ part: z.literal("tusks"), length: Fraction, color: Color }),
  /** Wing pads on top of the thorax (nymphs). */
  z.strictObject({ part: z.literal("wingpads"), length: Fraction, color: Color }),
  /** A caddis larva's case, over the abdomen. */
  z.strictObject({ part: z.literal("case"), material: z.enum(["sand", "gravel", "plant"]), length: Fraction, radius: Fraction, color: Color }),
  /** An emerger's shed skin trailing behind. */
  z.strictObject({ part: z.literal("shuck"), length: Fraction, color: Color }),
  /**
   * Eyes: compound eyes, or a fish's with an `iris` round the `pupil`. `turbinate`: a male
   * Baetis's raised upper eyes; `ocelli`: the three small simple eyes between them.
   */
  z.strictObject({
    part: z.literal("eyes"),
    size: Fraction,
    color: Color,
    iris: Color.optional(),
    pupil: Color.optional(),
    turbinate: Color.optional(),
    ocelli: z.boolean().default(false),
  }),
  /**
   * Fish fins: where they start along the body (0 rear, 1 front), their base along the body and
   * height, the rays (and spines, the stiff ones in front) and the edge's shape; or `size` alone
   * for both base and height.
   */
  z.strictObject({
    part: z.literal("fin"),
    kind: z.enum(["dorsal", "caudal", "pectoral", "pelvic", "anal", "adipose"]),
    at: z.number().min(0).max(1),
    size: Fraction.positive().optional(),
    base: Fraction.positive().optional(),
    height: Fraction.positive().optional(),
    rays: z.number().int().min(0).max(60).optional(),
    spines: z.number().int().min(0).max(20).default(0),
    shape: z.enum(["rounded", "pointed", "forked", "truncate", "emarginate"]).optional(),
    /** 0 opaque to 1 clear between the rays. */
    clarity: z.number().min(0).max(1).default(0.4),
    /** Paired fins: degrees out from lying back along the body (a sculpin's spread pectorals: about 70). */
    spread: z.number().min(0).max(90).optional(),
    color: Color,
  }),
  /** A plate over the front of the thorax (a stonefly's, a beetle's pronotum). */
  z.strictObject({ part: z.literal("pronotum"), length: Fraction, width: Fraction, color: Color }),
  /** A larva's stubby false legs: pairs along a section, or at the rear end with hooks (a caddis larva's anal claws). */
  z.strictObject({
    part: z.literal("prolegs"),
    count: z.number().int().min(1).max(10),
    at: z.string().optional(),
    where: z.enum(["along", "front", "rear"]).default("rear"),
    length: Fraction,
    hooks: z.boolean().default(false),
    color: Color,
  }),
  /**
   * A marking on chosen segments of a section (`segments`: "7-9", counted from the front, or
   * "all"): Ephemera's streaks, a beetle's rows of dots, a minnow's bars.
   */
  z.strictObject({
    part: z.literal("mark"),
    section: z.string().min(1),
    kind: z.enum(MARK_KINDS),
    segments: z.string().regex(/^(all|[1-9]\d*(-[1-9]\d*)?)$/, 'segments are "all", a number from 1 or a range like "7-9"').default("all"),
    side: z.enum(["top", "sides", "under", "all"]).default("top"),
    /** Repeats evenly over the chosen range instead of one a segment (a parr's marks along a fish). */
    count: z.number().int().min(1).max(40).optional(),
    /** One mark, centred here within the section (0 rear – 1 front): a spot on a fish's snout. */
    at: z.number().min(0).max(1).optional(),
    /** Shifted along by this fraction of its repeat: 0.5 puts a parr's red spots between its marks. */
    offset: z.number().min(0).max(1).optional(),
    color: Color,
  }),
  /** A pupa's breathing horns: tufts of white filaments on top of the thorax (a midge pupa's). */
  z.strictObject({ part: z.literal("horns"), length: Fraction, color: Color }),
  /** A fish's scales: their size as a fraction of the body length, and how silvery (0 matt – 1 mirror). */
  z.strictObject({ part: z.literal("scales"), size: z.number().positive().max(0.2), shine: z.number().min(0).max(1).default(0.3) }),
  /** A fish's lateral line, at `height` (−1 belly, 0 middle, 1 back) on the flank. */
  z.strictObject({ part: z.literal("lateral-line"), height: z.number().min(-1).max(1).default(0.1), color: Color }),
  /** A fish's gill cover, its rear edge at `at` along the body. */
  z.strictObject({ part: z.literal("gill-cover"), at: z.number().min(0).max(1), color: Color.optional() }),
  /** A fish's mouth: terminal, upturned (superior) or underslung (inferior), `size` its length. */
  z.strictObject({ part: z.literal("mouth"), position: z.enum(["terminal", "superior", "inferior"]).default("terminal"), size: Fraction }),
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
  /**
   * On the surface: what rests on the film. Its feet (a mayfly dun, a midge: the body held
   * above), its body (a caddis, a stonefly, a grasshopper), or all of it spent flat (a spinner).
   */
  sits: z.enum(SITS).optional(),
  /** How far the body curls along its length, in degrees (a shrimp, a pupa). */
  curve: z.number().min(-180).max(180).default(0),
  body: z.array(Section).min(1),
  parts: z.array(Part).default([]),
  hatches: z.array(Hatch).default([]),
  sources: z.array(Source).min(1, "cite at least one source"),
  /** Photos for checking proportions while authoring (pnpm refcheck); never published. */
  references: z.array(Reference).default([]),
});

export type Natural = z.infer<typeof NaturalSchema>;
export type NaturalPart = Natural["parts"][number];

export const NATURAL_SECTIONS: Record<string, Shape> = {
  id: { kind: "scalar" },
  name: { kind: "scalar" },
  group: { kind: "scalar" },
  stage: { kind: "scalar" },
  examples: { kind: "scalar" },
  description: { kind: "scalar" },
  size: { kind: "record", arg: null },
  rides: { kind: "scalar" },
  sits: { kind: "scalar" },
  curve: { kind: "scalar" },
  body: { kind: "list", nameKey: "section", arg: null },
  parts: { kind: "list", nameKey: "part", arg: null },
  hatches: { kind: "list", nameKey: "region", arg: null },
  sources: { kind: "list", nameKey: "title", arg: null },
  references: { kind: "list", nameKey: "image", arg: null },
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
  if (n.sits && n.rides !== "on-surface") err("sits only applies to naturals that ride on the surface", ["sits"]);
  n.body.forEach((b, i) => {
    if (b.marks !== "none" && !b.ink) err(`"${b.section}" has marks but no ink colour`, ["body", i, "marks"]);
  });
  const sections = new Set(n.body.map((b) => b.section));
  n.parts.forEach((p, i) => {
    if (p.part === "legs" && p.length === 0) err("a leg needs a length", ["parts", i, "length"]);
    if (p.part === "legs" && p.femur + p.tibia > 0.9) err("femur and tibia leave no room for the foot (together at most 0.9)", ["parts", i, "tibia"]);
    if (p.part === "legs" && p.pair && p.count !== undefined && p.count !== 2) err(`a pair of legs is two legs, not ${p.count}`, ["parts", i, "count"]);
    if (p.part === "fin" && p.size === undefined && (p.base === undefined || p.height === undefined)) err("a fin needs a size, or a base and a height", ["parts", i, "size"]);
    if (p.part === "mark" && !sections.has(p.section)) err(`no body section "${p.section}"`, ["parts", i, "section"]);
    if (p.part === "prolegs" && p.at && !sections.has(p.at)) err(`no body section "${p.at}"`, ["parts", i, "at"]);
    if (p.part === "legs" && p.at && !sections.has(p.at)) err(`no body section "${p.at}"`, ["parts", i, "at"]);
    if (p.part === "mark") {
      const s = n.body.find((b) => b.section === p.section);
      const range = p.segments.match(/^(\d+)(?:-(\d+))?$/);
      if (s && range && Math.max(Number(range[1]), Number(range[2] ?? range[1])) > Math.max(1, s.segments)) err(`"${p.section}" has ${s.segments} segments`, ["parts", i, "segments"]);
      if (range?.[2] && Number(range[2]) < Number(range[1])) err(`the range "${p.segments}" runs backwards`, ["parts", i, "segments"]);
    }
  });
  const pairs = n.parts.flatMap((p) => (p.part === "legs" && p.pair ? [p.pair] : []));
  pairs.forEach((pair, i) => {
    if (pairs.indexOf(pair) !== i) err(`the ${pair} legs are given more than once`, ["parts"]);
  });
  const total = n.body.reduce((s, b) => s + b.length, 0);
  if (Math.abs(total - 1) > 0.02) err(`the body sections' lengths add up to ${Math.round(total * 100) / 100}, not 1`, ["body"]);
  n.hatches.forEach((h, i) => {
    if (n.hatches.findIndex((o) => o.region === h.region) !== i) err(`"${h.region}" is given more than once`, ["hatches", i, "region"]);
  });
  return errors.length ? { ok: false, errors } : { ok: true, natural: n };
}
