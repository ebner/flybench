import { MATERIALS, type Archetype } from "../recipe/materials";
import { resolveColor, type Material, type Recipe, type Step } from "../recipe/schema";
import { POSITION_TOLERANCE, TIPS_PAST_TURN } from "../recipe/validate";
import { stepText, stepTitle, type StepContext } from "./describe";
import { hookModel, threadDiameter, unitMm, type HookModel } from "./hook";
import { Profile } from "./profile";
import { bendEndX } from "./shank";

/**
 * Turns a validated recipe into a timeline: per step, the pieces of geometry
 * that appear during it and where the thread and loose material ends are.
 * Everything here is plain data in gape units; the renderer turns it into meshes.
 *
 * Coordinates are shank-local: x is arc length along the shank (0 at the start of
 * the bend), y is up from the shank, z towards the viewer. The renderer bends this
 * onto curved shanks. Wraps go up on the near side and over the top, away from the
 * tyer. At wrap angle 0 the thread touches the near side of the shank and hangs
 * straight down; whole turns end there again.
 */

export type Look = "thread" | Archetype;
export type Side = "top" | "under";

interface PieceBase {
  id: number;
  material: string;
  look: Look;
  color: string;
  /** Part of the step's progress (0..1) during which this piece is drawn. */
  window: [number, number];
  /** Time (seconds) from which the piece is gone again, e.g. trimmed butts. */
  until?: number;
  /** Seeds the piece's random fibres; a piece that replaces another keeps its seed, so nothing jumps. */
  seed?: number;
}

export interface WrapsPiece extends PieceBase {
  type: "wraps";
  /**
   * "travel": from x0 to x1 along the shank. "in-place": out from x0 by up to `width`
   * and back. "post": round an upright parachute post (see `post`).
   */
  path: "travel" | "in-place" | "post";
  /**
   * In-place turns crowded back over the body by the eye or a bead: they bind down what is
   * under them, lying as high as it is at this x (their front) rather than on top of it.
   */
  bindsTo?: number;
  x0: number;
  x1: number;
  width: number;
  turns: number;
  strandRadius: number;
  /** What the wraps lie on. */
  base: Profile;
  /** Hackle barbs, herl flue, dubbing or chenille fuzz, in gapes. */
  fibreLength?: number;
  /** Hackle: how far the barbs lean back from standing straight out, in radians. */
  sweep?: number;
  /** Fibres alternate light and dark (grizzly, partridge). */
  barred?: boolean;
  /** Dubbing: how rough, 0 (fine) to 1 (long guard hairs). */
  shaggy?: number;
  /** Wound the opposite way round to the usual direction (a counter-wound rib). */
  counter?: boolean;
  /** Lies flat as a band when wound (silk floss, flat tinsel, wound fibres) rather than as a round strand. */
  band?: boolean;
  /** Post wraps: the post's x, the heights (above the shank axis) the wraps run between, and its radius. */
  post?: { x: number; y0: number; y1: number; radius: number };
  /** Trimmed hackle: only the fibres at the sides are left, those on top and at the sides, or those underneath and at the sides. */
  keep?: "sides" | "top" | "under";
  /** Where wing cases, backs or sleeves were pulled over these wraps, pressing down the fibres on
   *  top: each from–to, and how far round each side of the top it reaches (radians). */
  covered?: [number, number, number][];
  /**
   * Two strands woven (a Bitch Creek's abdomen): the piece's own colour over the top, this one
   * round underneath, meeting along each side in short teeth of the top colour.
   */
  woven?: { under: Pick<WrapsPiece, "look" | "color" | "fibreLength" | "sweep" | "barred" | "shaggy"> };
}

/** A bunch of fibres or hair sticking out from its tie-in point (tag, tail, wing, beard, butts, spun hair). */
export interface BundlePiece extends PieceBase {
  type: "bundle";
  x: number;
  /** Spun hair: the bases spread forward over this length. */
  span?: number;
  /** From the axis to where the bases lie, on top (or underneath, for side "under"). */
  radius: number;
  /**
   * How far the circle the bases spread round is off the axis, towards their side: what is
   * already tied on top makes a hump there (see Profile.ringAt).
   */
  centre?: number;
  length: number;
  /** Radians above the shank (below, for side "under"); for "radial", how far the fibres lean back. */
  angle: number;
  direction: "back" | "forward" | "radial";
  side: Side;
  /** Radians to each side of the top (or bottom) that the bunch fans out over. */
  spread: number;
  bundleRadius: number;
  count: number;
  /** Trimmed: cut square, all the same length. */
  cut?: boolean;
  /** Trimmed spun hair: a round head, a wedge flat underneath and deepest at the rear, a cigar or a cone. */
  trimShape?: "round" | "wedge" | "cigar" | "cone";
  /** Upright and divided: two tufts turned out to either side by this many radians. */
  pair?: number;
  /** Upright and fanned: the hair splays fore and aft over this many radians in all, narrow across (a Mohican's wing). */
  fan?: number;
  /** Bands along each fibre (tippet bars, barred fibres). */
  marks?: FibreMarks;
  /** Fibres broader than usual, as a multiple of the usual width. */
  fibreWidth?: number;
  /** Fibres with flue along them (peacock sword). */
  flue?: boolean;
}

/** Bands along a fibre, as fractions of its length from base to tip, drawn at `shade` of its colour. */
export type FibreMarks = { from: number; to: number; shade: number }[];

/** A whole feather or a quill slip as a wing; a pair when `pair` > 0. */
export interface FeatherPiece extends PieceBase {
  type: "feather";
  x: number;
  radius: number;
  length: number;
  angle: number;
  width: number;
  shape: "breast" | "tip" | "slip";
  /** Pairs: radians each feather is turned out from the top. */
  pair: number;
  side: Side;
  /** 0 = plain, 1 = strongly barred (grizzly, teal, mallard). */
  barring: number;
}

export interface BeadPiece extends PieceBase {
  type: "bead";
  /** Where the bead's centre ends up, against the eye. */
  x: number;
  radius: number;
  /** A cone head: its length along the shank (radius is at its wide back end). */
  cone?: number;
  /** A split shot with an eye painted on each side. */
  painted?: boolean;
}

export interface EyesPiece extends PieceBase {
  type: "eyes";
  x: number;
  shankRadius: number;
  /** Radius of each eye ball. */
  size: number;
  side: Side;
  chain: boolean;
}

/** A strip pulled forward over the top of the body: wing case, foam back, shellback. */
export interface CoverPiece extends PieceBase {
  type: "cover";
  x0: number;
  x1: number;
  base: Profile;
  thickness: number;
  /** Extra height above the body: fluff (herl, dubbing, hackle) squashed underneath. */
  lift: number;
  /** Radians each side of the top that the cover reaches round the body. */
  halfAngle: number;
  /** Where turns of a rib wound over it press it in, segmenting it (shank-local x). */
  dents: number[];
  /** Length left standing in front of the tie-down when the excess is trimmed (a foam head). */
  stub: number;
  /** Left loose: gapes of air under its middle, arching up between the tie-downs. */
  bubble?: number;
  /** Pulled over the belly instead of the back. */
  side?: "under";
  /** A sparse, translucent veil (sparkle yarn) rather than a solid strip. */
  veil?: boolean;
  /** A fur strip's hide: the fur on top this long (gapes), leaning back. */
  fur?: number;
  /** All round the body, as thick underneath as on top: hair spread round the shank and folded back (a bullet head), or bound along it. */
  round?: boolean;
  /**
   * Parted round an upright post at `x`: two halves, one down each side, turned out from the top
   * by up to `angle` radians there and coming together again towards both ends (a Mohican's foam).
   */
  split?: { x: number; angle: number; reach: number };
  /** 0 = plain, 1 = strongly barred or mottled (turkey). */
  barring: number;
}

/**
 * Braided tubing slid over the body as a sleeve (Mylar tubing), tied down at the thread and,
 * once `open` is gone, at its other end too; its rear end may be frayed into a short tail.
 */
export interface SleevePiece extends PieceBase {
  type: "sleeve";
  x0: number;
  x1: number;
  /** What it is stretched over. */
  base: Profile;
  /** The braid's wall. */
  thickness: number;
  /** The end not yet tied down, a little loose. */
  open?: "front" | "rear";
  /** Length of the loose strands of the frayed rear end. */
  fray?: number;
}

/** Chenille, yarn or foam sticking out from the tie-in as one solid piece: an extended body or larva. */
export interface ExtensionPiece extends PieceBase {
  type: "extension";
  x: number;
  radius: number;
  length: number;
  angle: number;
  side: "top" | "under";
  /** Radius of the extension itself. */
  thickness: number;
  /** Colour of the very end, if different (a larva's burnt head). */
  tip?: string;
  /** Chenille: length of the pile standing out from it. */
  fuzz?: number;
  /** Lies forward towards the eye instead of sticking out behind. */
  forward?: boolean;
  /** A flat strip this wide (a fur strip's hide); `thickness` is then half its thickness. */
  width?: number;
  /** Fur on the strip's top face this long, leaning back towards its end. */
  fur?: number;
  /** Made on a needle and bound into this many segments, each waist pinched by turns of `bands`, the thread's colour. */
  segments?: number;
  bands?: string;
  /** Its radius at the end, as a fraction of `thickness` at the tie-in (a body tapering to its tip). */
  taper?: number;
}

/** A point on an extended body's centre line, `t` from the tie-in (0) to its end (1), shank-local. */
export function extensionCentre(p: Pick<ExtensionPiece, "x" | "radius" | "length" | "angle" | "side" | "thickness" | "forward" | "width">, t: number): { x: number; y: number } {
  const flip = p.side === "under" ? -1 : 1;
  const towards = p.forward ? 1 : -1;
  // A flat strip (a fur strip's hide) lies on top of what it is tied to; a rope is bound along the
  // shank, so its centre sits just above the hook wire. It sags a little along its length.
  const base = p.width !== undefined ? p.radius + p.thickness : p.radius * 0.4 + p.thickness * 0.55;
  return {
    x: p.x + towards * p.length * t * Math.cos(p.angle),
    y: flip * (base + p.length * t * Math.sin(p.angle) - 0.06 * p.length * t * t),
  };
}

/** Strands tied across the shank at their middles, sticking out on both sides: legs. */
export interface LegsPiece extends PieceBase {
  type: "legs";
  x: number;
  radius: number;
  /** Length of each leg, from the body out. */
  length: number;
  /** Radians the legs lean back from straight out. */
  sweep: number;
  /** Legs on each side; they are spaced a little apart along the shank. */
  count: number;
  strandRadius: number;
}

export type Piece = WrapsPiece | BundlePiece | FeatherPiece | BeadPiece | EyesPiece | CoverPiece | ExtensionPiece | LegsPiece | SleevePiece;

export type ThreadPose =
  | { kind: "rest"; x: number; radius: number }
  | { kind: "follow"; piece: number; cut?: boolean };

export type FreeEndPose = {
  material: string;
  look: Look;
  color: string;
  length: number;
  strandRadius: number;
  fibreLength?: number;
} & (
  | { kind: "rest"; x: number; radius: number; direction: "back-down" | "back-up" | "back-flat" | "under-flat" | "forward-flat" | "out"; hideAfter?: number }
  /** `far`: the other strand of a weave, leaving the turns on the far side (mirrored), crossing the first. */
  | { kind: "follow"; piece: number; far?: boolean }
);

export interface SimStep {
  index: number;
  title: string;
  text: string;
  start: number;
  duration: number;
  pieces: Piece[];
  thread: ThreadPose | null;
  freeEnds: FreeEndPose[];
}

export interface Build {
  recipe: Recipe;
  hook: HookModel;
  threadColor: string;
  threadRadius: number;
  steps: SimStep[];
  duration: number;
}

/**
 * Position on a shank wraps piece at progress u (0..1): round a circle of `radius` whose centre
 * is `centre` above the shank's axis (the turns hug the shank underneath and go over what is
 * tied on top).
 */
export function wrapAt(p: WrapsPiece, u: number): { x: number; radius: number; centre: number; angle: number } {
  const angle = (p.counter ? -1 : 1) * 2 * Math.PI * p.turns * u;
  if (p.path === "travel") {
    const x = p.x0 + (p.x1 - p.x0) * u;
    const ring = p.base.ringAt(x);
    return { x, radius: ring.radius + p.strandRadius, centre: ring.centre, angle };
  }
  const x = p.x0 + p.width * Math.sin(Math.PI * u);
  const ring = p.base.ringAt(p.bindsTo !== undefined ? Math.max(x, p.bindsTo) : x);
  // Turns going back lie over the ones going out, mostly in between them.
  return { x, radius: ring.radius + p.strandRadius * (1 + 0.6 * u), centre: ring.centre, angle };
}

export type V3 = [number, number, number];

/**
 * Shank-local point on any wraps piece at progress u, and the direction the material
 * leaves it towards the bobbin or hackle pliers.
 */
export function wrapPoint(p: WrapsPiece, u: number): { point: V3; leave: V3; x: number } {
  if (p.path === "post" && p.post) {
    const a = 2 * Math.PI * p.turns * u;
    const y = p.post.y0 + (p.post.y1 - p.post.y0) * u;
    const r = p.post.radius + p.strandRadius;
    return {
      point: [p.post.x + r * Math.sin(a), y, r * Math.cos(a)],
      leave: [Math.cos(a), -0.3, -Math.sin(a)],
      x: p.post.x,
    };
  }
  const w = wrapAt(p, u);
  const way = p.counter ? -1 : 1;
  return {
    point: [w.x, w.centre + w.radius * Math.sin(w.angle), w.radius * Math.cos(w.angle)],
    leave: [0, -Math.cos(w.angle) * way, Math.sin(w.angle) * way],
    x: w.x,
  };
}

interface MaterialLook {
  look: Archetype;
  color: string;
  strandRadius: number;
  /** Thickness added under the tie-in wraps by the bound-down end. */
  tieInThickness: number;
  /** Thickness a wound layer adds to the body. */
  layerThickness: (coverage: number) => number;
  fibreLength?: number;
  freeLength: number;
  /** Fibres in a bundle (tags, tails, wings). */
  count: number;
  /** The recipe gives the count: drawn as given, not as a clump that grows with its length. */
  counted?: boolean;
  sweep?: number;
  barred?: boolean;
  /** 0 = plain, 1 = strongly barred. */
  barring: number;
  band?: boolean;
  marks?: FibreMarks;
  fibreWidth?: number;
  flue?: boolean;
  veil?: boolean;
  shaggy?: number;
  /** Foam: the sheet's thickness (gapes), when the recipe gives it. */
  sheet?: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

// Assumption: the excess of a pulled-over strip sticks out about 0.8 gape past the
// tie-down until it is trimmed.
const UNTRIMMED = 0.8;

/** Colours whose feathers and hackles are barred or mottled. */
const BARRED: Record<string, number> = { grizzly: 1, teal: 1, partridge: 0.8, mallard: 0.6, snipe: 0.5, turkey: 0.6, guinea: 0.9, "hen-pheasant": 0.5, "wood-duck": 0.6 };

/** Whether a colour is drawn barred of itself (grizzly, teal…), without a material's `barred`. */
export const barredColour = (color: string | undefined): boolean => color !== undefined && color in BARRED;

// Assumption: a golden pheasant tippet fibre is orange with a black bar about three quarters
// of the way out and a black tip.
const TIPPET_MARKS: FibreMarks = [
  { from: 0.7, to: 0.8, shade: 0.08 },
  { from: 0.9, to: 1, shade: 0.08 },
];

/** Dark bars across a barred fibre, more of them and darker the stronger the barring. */
function barMarks(barring: number): FibreMarks {
  const bars = 5;
  return Array.from({ length: bars }, (_, i) => {
    const from = 0.12 + (0.88 * i) / bars;
    return { from, to: from + 0.42 / bars, shade: 1 - 0.75 * barring };
  });
}

// Assumption: rough material dimensions in gapes for a size 12–14 fly.
function materialLook(recipe: Recipe, m: Material): MaterialLook {
  const cat = MATERIALS[m.kind] as (typeof MATERIALS)[keyof typeof MATERIALS] & { sweep?: number; oval?: boolean; fibreWidth?: number; shaggy?: number; flue?: boolean; veil?: boolean };
  const colorName = m.color ?? ("defaultColor" in cat ? cat.defaultColor : "grey");
  const color = resolveColor(colorName);
  // A dyed grizzly (`barred`) is barred in any colour; `barred=#false` makes a barred colour plain.
  const barring = m.barred === undefined ? BARRED[colorName] ?? 0 : m.barred ? BARRED.grizzly! : 0;
  const marks = colorName === "tippet" ? TIPPET_MARKS : barring > 0 ? barMarks(barring) : undefined;
  const base = { look: cat.archetype, color, freeLength: 1.5, count: 80, barred: barring > 0, barring, marks, fibreWidth: cat.fibreWidth, flue: cat.flue, veil: cat.veil, shaggy: m.shaggy ?? cat.shaggy };
  const mm = (v: number) => v / unitMm(recipe.hook);
  switch (cat.archetype) {
    case "yarn":
      return { ...base, strandRadius: 0.05, count: 160, tieInThickness: 0.025, layerThickness: (c) => 0.1 * Math.min(c, 1.5) };
    case "herl": {
      const r = 0.018 * Math.sqrt(m.strands ?? 3);
      return {
        // Assumption: long flue gives the plump body seen in reference photos.
        ...base, strandRadius: r, fibreLength: 0.22, freeLength: 2.2,
        tieInThickness: r, layerThickness: (c) => 2 * r * Math.min(c, 1.5),
      };
    }
    case "hackle":
      return {
        ...base, strandRadius: 0.012, fibreLength: m.fibre, freeLength: 1.8, sweep: deg(m.sweep ?? cat.sweep ?? 7),
        tieInThickness: 0.024, layerThickness: () => 0.024,
      };
    case "dubbing":
      return {
        ...base, strandRadius: 0.045, fibreLength: 0.12,
        tieInThickness: 0, layerThickness: (c) => 0.075 * Math.min(c, 1.5),
      };
    case "wire": {
      // Assumption: fine rib wire about 0.1 mm, weighting wire about 0.4 mm, unless given.
      const r = m.mm !== undefined ? mm(m.mm) / 2 : m.kind === "lead-free-wire" ? mm(0.38) / 2 : 0.011;
      return { ...base, strandRadius: r, tieInThickness: r * 1.4, layerThickness: (c) => 2 * r * Math.min(c, 1) * 0.9 };
    }
    case "floss": {
      // Assumption: 5X monofilament is about 0.15 mm.
      const r = m.kind === "monofilament" ? mm(0.15) / 2 : threadDiameter(recipe, m.size ?? recipe.thread.size) * 0.6;
      return { ...base, strandRadius: r, band: m.kind === "silk-floss", tieInThickness: r, layerThickness: (c) => r * 1.2 * Math.min(c, 1.5) };
    }
    case "tinsel": {
      const r = cat.oval ? 0.02 : 0.024;
      return { ...base, strandRadius: r, band: !cat.oval, tieInThickness: 0.012, layerThickness: (c) => 0.02 * Math.min(c, 1) };
    }
    case "chenille":
      return {
        // Assumption: medium chenille makes a body about half the gape thick.
        ...base, strandRadius: 0.12, fibreLength: 0.08,
        tieInThickness: 0.05, layerThickness: (c) => 0.22 * Math.min(c, 1.2),
      };
    case "hair":
      // A recipe that counts the hairs (a few moose hairs as a tail) gets that many.
      return { ...base, strandRadius: 0.08, count: m.count ?? 320, counted: m.count !== undefined, tieInThickness: 0.03, layerThickness: () => 0.03 };
    case "fibres":
      return {
        // Wound fibres lie side by side as a flat band, about one fibre width each, with a short fringe of flue.
        ...base, strandRadius: 0.012 * Math.min(m.count ?? 8, 10), count: m.count ?? 8, band: true, fibreLength: 0.06,
        tieInThickness: 0.015, layerThickness: (c) => 0.04 * Math.min(c, 1.5),
      };
    case "biot":
      return { ...base, strandRadius: 0.012, count: m.count ?? 2, tieInThickness: 0.012, layerThickness: () => 0.02 };
    case "marabou":
      return { ...base, strandRadius: 0.08, count: 560, tieInThickness: 0.03, layerThickness: () => 0.03 };
    case "cdc":
      // Wound, a CDC feather's barbs are short near the tip and long near the butt.
      return {
        // Assumption: 0.6 gape where the recipe doesn't say.
        ...base, strandRadius: 0.06, count: 260, fibreLength: m.fibre ?? 0.6, sweep: deg(m.sweep ?? 45),
        // Wound, only the stem and the barbs' roots lie on the body, as with a hackle.
        tieInThickness: 0.02, layerThickness: () => 2 * CDC_STEM,
      };
    case "flash":
      return { ...base, strandRadius: 0.04, count: m.count ?? 8, tieInThickness: 0.01, layerThickness: () => 0.01 };
    case "feather":
      return { ...base, strandRadius: 0.012, tieInThickness: 0.02, layerThickness: () => 0.02 };
    case "foam":
      // A sheet's thickness as sold, when the recipe gives it.
      return { ...base, strandRadius: 0.05, tieInThickness: 0.06, layerThickness: () => 0.1, ...(m.mm !== undefined && { sheet: mm(m.mm) }) };
    case "bead":
    case "eyes":
      return { ...base, strandRadius: mm(m.mm ?? 3) / 2, tieInThickness: 0, layerThickness: () => 0 };
    case "legs":
      // Assumption: round rubber legs about 0.6 mm thick, silicone legs about 0.45 mm.
      return {
        ...base, strandRadius: mm(m.kind === "silicone-legs" ? 0.45 : 0.6) / 2, count: m.count ?? 2,
        tieInThickness: 0.02, layerThickness: () => 0.02,
      };
    case "strip": {
      // A strip of hide with its fur: half its width as its "strand", the fur as its fibres.
      const strip = cat as { furMm?: number; widthMm?: number };
      return {
        ...base, strandRadius: mm(m.mm ?? strip.widthMm ?? 3) / 2, fibreLength: m.fibre ?? mm(strip.furMm ?? 18), freeLength: 2.5,
        tieInThickness: 0.05, layerThickness: () => STRIP_HIDE,
      };
    }
    case "tubing":
      // Assumption: the braid's wall is about 0.2 mm, two layers of fine Mylar strands.
      return { ...base, strandRadius: mm(0.2), tieInThickness: mm(0.2), layerThickness: () => mm(0.2) };
  }
}

const DURATION = {
  attach: 2.5,
  tieIn: 2.5,
  tieOff: 2,
  trim: 1.8,
  whip: 3.5,
  bead: 2,
  pullOver: 2.5,
  sleeve: 3,
  perWeaveCrossing: 0.7,
  spin: 3.5,
  perThreadTurn: 0.05,
  perMaterialTurn: 0.45,
  perDubbingTurn: 0.14,
  perWeightTurn: 0.08,
};

// Assumption: how far round the body bunches fan out by default (degrees each side of the top).
const DEFAULT_SPREAD: Partial<Record<Archetype, number>> = {
  yarn: 35, fibres: 15, hair: 60, biot: 25, marabou: 40, cdc: 35, flash: 30,
};

/** Butts of a hair clump stick forward and up from the tie-in point until trimmed. */
const BUTTS = { length: 0.55, angle: deg(35) };
// Assumption: a bunch spread up to 60° each side lies on its side of the shank; from 150°, all round it.
/** How much of a bunch spread `spread` radians to each side lies all round the shank. */
const allRound = (spread: number) => Math.min(1, Math.max(0, (spread - deg(60)) / deg(90)));
// Assumption: a CDC feather's stem is about as thick as a hackle's, 0.024 gape across.
const CDC_STEM = 0.012;
// Assumption: a rabbit hide is about 0.3 mm thick, a thirtieth of a #4's gape.
const STRIP_HIDE = 0.03;
// Assumption: a pencil-thick clump of hair spread round the shank and folded back lies about an
// eighth of a gape thick all round (a Paradrake's body is about 0.4 gape across at the post,
// tapering behind the bend, where there is no wire inside; read from the photos).
const HAIR_SHEATH = 0.12;

/** Feather width as a fraction of length, by shape. */
const FEATHER_WIDTH = { breast: 0.5, tip: 0.28, slip: 0.32 };

export function simulate(recipe: Recipe): Build {
  const hook = hookModel(recipe.hook);
  const L = hook.shankLength;
  const td = threadDiameter(recipe);
  const threadRadius = td / 2;
  // Thread flattens when wrapped, so touching turns are wider than the diameter.
  const pitch = td * 1.3;
  const threadColor = resolveColor(recipe.thread.color);

  // A double's shank is two wires side by side, so the dressing sits on a wider base. Behind the
  // bend there is only what the thread binds there (hair laid back past it): room for that.
  const rearmost = Math.min(0, ...recipe.steps.map((s) => (s.op === "wrap-thread" ? s.to * L : 0)));
  let profile = Profile.bare(Math.min(-0.3, rearmost - 0.3), L + 0.2, hook.points === 2 ? hook.wireRadius * 1.8 : hook.wireRadius);
  let threadX: number | null = null;
  // The thread's recipe position: near the eye, positions a little apart share one x
  // (frontLimit), so which way a wind goes is decided here, as validation does.
  let threadAt = 0;
  let nextId = 0;
  let time = 0;
  const looks = new Map(recipe.materials.map((m) => [m.id, materialLook(recipe, m)]));
  const kinds = new Map(recipe.materials.map((m) => [m.id, m]));
  const tiedAt = new Map<string, number>();
  const tiedAtPosition = new Map<string, number>();
  const freeEnds = new Map<string, FreeEndPose>();
  /** Untrimmed hair butts and spun hair, by material. */
  const butts = new Map<string, BundlePiece>();
  const spun = new Set<string>();
  /** Wound pieces by material, so a hackle can be trimmed after winding. */
  const wound = new Map<string, WrapsPiece>();
  const covers = new Map<string, CoverPiece>();
  /** Sleeves with an end still to tie down, by material. */
  const sleeves = new Map<string, SleevePiece>();
  /** Strips tied in underneath, to be pulled over the belly rather than the back. */
  const underneath = new Set<string>();
  /** Upright posts, for parachute hackles. */
  /** `hackle`: how high above the shank's axis the top of a parachute wound round it is. */
  const posts = new Map<string, { x: number; baseY: number; height: number; radius: number; hackle?: number }>();
  /** How a bunch was tied in: its length and how far round it was spread (radians), for folding it back later. */
  const bunches = new Map<string, { length: number; spread: number }>();
  /**
   * Hair folded back and tied down at `x` (a bullet head), its tips trailing loose to `tipX`, until
   * thread turns spiralled back over it bind it along the body (to `bound`) as a `sheath`.
   */
  const trailing = new Map<string, { x: number; tipX: number; tips: BundlePiece; halfAngle: number; round: boolean; thickness: number; bound?: number; sheath?: CoverPiece }>();
  /** A palmered material whose tip the next forward wind secures. */
  let palmered: string | null = null;
  const palmeredTips = new Set<string>();
  /** The rear edge of a bead at the eye: wraps stop short of it. */
  let frontLimit = 0.97 * L;
  /** Positions run from the bend to just behind the eye, or to the back of a bead when there is one. */
  let span = L;
  const steps: SimStep[] = [];

  /** Fluffy material (herl, dubbing, hackle) wound between a and b so far, which a cover squashes. */
  const fluffy: { x0: number; x1: number; height: number }[] = [];
  /** Every pass of dubbing, which a wing case or back later lies over. */
  const dubbed: WrapsPiece[] = [];
  /**
   * Fibres on what a strip or sleeve now covers, wound or dubbed, pressed flat (`halfAngle` round
   * each side of the top): from this step on, those wraps are replaced by copies without them,
   * so earlier moments still show them.
   */
  const pressUnder = (pieces: Piece[], from: number, to: number, halfAngle: number) => {
    const press = (w: WrapsPiece): WrapsPiece | null => {
      if (!w.fibreLength || w.path !== "travel" || Math.min(w.x0, w.x1) >= to || Math.max(w.x0, w.x1) <= from) return null;
      w.until = time;
      const pressed: WrapsPiece = { ...w, id: nextId++, seed: w.seed ?? w.id, covered: [...(w.covered ?? []), [from, to, halfAngle]], window: [0, 0.0001], until: undefined };
      pieces.push(pressed);
      return pressed;
    };
    for (const [id, w] of wound) {
      const pressed = press(w);
      if (pressed) wound.set(id, pressed);
    }
    dubbed.forEach((w, k) => {
      const pressed = press(w);
      if (pressed) dubbed[k] = pressed;
    });
  };
  const fluffUnder = (a: number, b: number) =>
    Math.max(0, ...fluffy.filter((f) => Math.min(f.x0, f.x1) < b && Math.max(f.x0, f.x1) > a).map((f) => f.height));

  /** How a material is used next, to choose how its loose end lies meanwhile. */
  const nextUse = (material: string, from: number): Step["op"] | undefined =>
    recipe.steps.slice(from + 1).find((s) => "material" in s && s.material === material)?.op;

  const threadWraps = (
    path: WrapsPiece["path"], x0: number, x1: number, turns: number, window: [number, number] = [0, 1],
  ): WrapsPiece => ({
    type: "wraps", id: nextId++, material: "thread", look: "thread", color: threadColor, window,
    path, x0, x1, width: path === "in-place" ? x1 - x0 : 0, turns, strandRadius: threadRadius, base: profile,
  });
  /**
   * Turns that bind something down: out and back again, touching each way. Where the eye or a
   * bead leaves no room in front, they spread back over the body instead of piling up in a ring.
   */
  const inPlace = (x: number, turns: number, window?: [number, number], maxX = frontLimit) => {
    const span = Math.max(pitch, (turns * pitch) / 2);
    const x1 = Math.max(x + pitch * 0.5, Math.min(maxX, x + span));
    const x0 = Math.min(x, x1 - span);
    const piece: WrapsPiece = { ...threadWraps("in-place", x0, x1, turns, window), bindsTo: x0 < x - 1e-6 ? x1 : undefined };
    // Thinner towards its ends, so a head built of several of them tapers into the body.
    profile = profile.withLayer(x0, x1, td * 0.6, Math.min(0.05, (x1 - x0) / 3), true);
    return piece;
  };
  const restingEnds = () => [...freeEnds.values()];
  const freeEnd = (id: string, l: MaterialLook): Omit<FreeEndPose, "kind"> => ({
    material: id, look: l.look, color: l.color, length: l.freeLength,
    strandRadius: l.strandRadius, fibreLength: l.fibreLength,
  });
  const materialWraps = (id: string, l: MaterialLook, x0: number, x1: number, turns: number): WrapsPiece => ({
    type: "wraps", id: nextId++, material: id, look: l.look, color: l.color, window: [0, 1],
    // Wound CDC lies on the body as its stem; the barbs stand out from it.
    path: "travel", x0, x1, width: 0, turns, strandRadius: l.look === "cdc" ? CDC_STEM : l.strandRadius, base: profile,
    fibreLength: l.fibreLength, sweep: l.sweep, barred: l.barred, band: l.band, shaggy: l.shaggy,
  });

  recipe.steps.forEach((step, index) => {
    const pieces: Piece[] = [];
    let thread: ThreadPose | null = threadX === null ? null : { kind: "rest", x: threadX, radius: profile.sideAt(threadX) };
    let ends = restingEnds();
    let duration: number;
    const ctx: StepContext = {};

    switch (step.op) {
      case "slide-bead": {
        const l = looks.get(step.material)!;
        // Assumption: a cone head is a little longer than it is wide, narrowing to under half its width.
        const cone = (MATERIALS[kinds.get(step.material)!.kind] as { cone?: boolean }).cone ? l.strandRadius * 2.3 : undefined;
        const half = cone ? cone / 2 : l.strandRadius * 0.95;
        const x = L - (cone ? cone * 0.45 : l.strandRadius * 0.9);
        const shot = (MATERIALS[kinds.get(step.material)!.kind] as { shot?: boolean }).shot;
        pieces.push({ type: "bead", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 1], x, radius: l.strandRadius, cone, ...(shot ? { painted: true } : {}) });
        frontLimit = Math.min(frontLimit, x - half);
        span = Math.min(span, frontLimit / 0.97);
        duration = DURATION.bead;
        break;
      }
      case "weight": {
        const l = looks.get(step.material)!;
        const from = step.from * span;
        const to = Math.min(step.to * span, frontLimit);
        const turns = Math.max(2, Math.round((to - from) / (l.strandRadius * 2.05)));
        pieces.push(materialWraps(step.material, l, from, to, turns));
        // Tyers taper the ends of the weighting with thread so the body runs smoothly over it.
        profile = profile.withLayer(from, to, l.layerThickness(1), 0.16);
        duration = Math.max(1.5, turns * DURATION.perWeightTurn);
        break;
      }
      case "attach-thread": {
        // Started again after a whip finish part-way (the front of a Zonker).
        if (steps.some((s) => recipe.steps[s.index]!.op === "whip-finish")) ctx.again = true;
        threadX = Math.min(step.at * span, frontLimit);
        threadAt = step.at;
        const piece = inPlace(threadX, 6);
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id };
        duration = DURATION.attach;
        break;
      }
      case "wrap-thread": {
        const from = threadX!;
        let to = Math.min(step.to * span, frontLimit);
        // Spiralled back over hair trailing from a tie-down, the turns bind it along the body (and
        // on past the bend, round the hair alone) as far as they go; its tips stick out behind.
        const binds = [...trailing].filter(([, t]) => to < from && to < (t.bound ?? t.x) - 1e-6);
        for (const [, t] of binds) to = Math.max(to, t.tipX + TIPS_PAST_TURN);
        for (const [id, t] of binds) {
          const l = looks.get(id)!;
          ctx.binds = id;
          t.tips.until = time;
          const old = t.sheath;
          if (old) old.until = time;
          const rear = to;
          const front = t.bound ?? t.x;
          // Behind the bend there is no wire, only the hair and what is bound inside it: it fills
          // out towards the bend, so the body tapers from the shank to its end instead of stepping
          // down at the bend.
          let core = old?.base ?? profile;
          const end = Math.min(0, front);
          if (rear < end) {
            const fill = Math.max(0, profile.radiusAt(Math.min(front, 0.15)) - profile.radiusAt(rear)) * 0.75;
            for (let k = 0; k < 4; k++) {
              const a = rear + ((end - rear) * k) / 4;
              core = core.withLayer(a, end - 0.1, fill / 4, 0.1);
              profile = profile.withLayer(a, end - 0.1, fill / 4, 0.1);
            }
          }
          const sheath: CoverPiece = {
            type: "cover", id: nextId++, material: id, look: l.look, color: l.color, window: [0, 0.0001],
            ...(old && { seed: old.seed ?? old.id }),
            x0: rear, x1: t.x, base: core, thickness: t.thickness, lift: 0, halfAngle: t.halfAngle, dents: [], stub: 0, ...(t.round && { round: true }), barring: l.barring,
          };
          pieces.push(sheath);
          t.sheath = sheath;
          t.bound = rear;
          // Cinched by the last turn and at the tie-down, as the cover is drawn.
          profile = profile.withLayer(rear, front, t.thickness, 0.12, true, t.round ? "round" : "top");
          // Bunches tied in along there pointing back (a tail) are bound inside it now and leave
          // it at its end.
          for (const s of steps) {
            for (const p of s.pieces) {
              if (p.type !== "bundle" || p.material === id || p.direction !== "back" || p.until !== undefined || p.angle >= deg(30)) continue;
              if (p.x < rear || p.x > front || p.x - p.length >= rear) continue;
              p.until = time;
              pieces.push({ ...p, id: nextId++, seed: p.seed ?? p.id, x: rear, radius: Math.max(0.02, p.radius * 0.5), centre: 0, length: p.length - (p.x - rear), window: [0, 0.0001], until: undefined });
            }
          }
          // The tips flare out behind the last turn.
          const tips: BundlePiece = {
            ...t.tips, id: nextId++, seed: t.tips.seed ?? t.tips.id, x: rear, radius: profile.radiusAt(rear) * 0.5, centre: 0,
            length: rear - t.tipX, angle: deg(16), window: [0.6, 0.6001], until: undefined,
          };
          pieces.push(tips);
          t.tips = tips;
          butts.set(id, tips);
        }
        // Open turns spiralled forward again over a bound body cross the first ones.
        if (to > from && step.turns && [...trailing.values()].some((t) => t.bound !== undefined && from < t.x && to > t.bound)) ctx.crossing = true;
        const turns = step.turns ?? Math.max(1, Math.round(Math.abs(to - from) / pitch));
        const piece = threadWraps("travel", from, to, turns);
        const coverage = (turns * pitch) / Math.max(Math.abs(to - from), pitch);
        profile = profile.withLayer(from, to, td * 0.6 * Math.min(coverage, 2));
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id };
        threadX = to;
        threadAt = step.to;
        duration = Math.min(4, Math.max(1.2, turns * DURATION.perThreadTurn));
        break;
      }
      case "dub": {
        const l = looks.get(step.material)!;
        const from = threadX!;
        const to = Math.min(step.to * span, frontLimit);
        // Dubbing squashes as it is wrapped, so neighbouring turns overlap.
        const turns = step.turns ?? Math.max(2, Math.round(Math.abs(to - from) / (l.strandRadius * 1.3)));
        const piece = materialWraps(step.material, l, from, to, turns);
        const coverage = (turns * 2 * l.strandRadius) / Math.max(Math.abs(to - from), 0.01);
        // Each pass thins out at its ends, so passes built on each other round off into a ball.
        profile = profile.withLayer(from, to, l.layerThickness(coverage), Math.min(0.2, Math.abs(to - from) * 0.25), true);
        pieces.push(piece);
        dubbed.push(piece);
        // The dubbing is on the thread, so the bobbin follows it.
        thread = { kind: "follow", piece: piece.id };
        threadX = to;
        ctx.rear = step.to < threadAt;
        threadAt = step.to;
        duration = Math.max(2.5, turns * DURATION.perDubbingTurn);
        break;
      }
      case "spin": {
        const l = looks.get(step.material)!;
        const from = threadX!;
        const to = Math.min(step.to * span, frontLimit);
        const radius = profile.radiusAt(from);
        // Assumption: spun deer hair stands out about 0.7 gape before it is trimmed.
        const head: BundlePiece = {
          type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0.1, 1],
          x: from, span: to - from, radius, length: 0.7, angle: deg(35), direction: "radial", side: "top",
          spread: Math.PI, bundleRadius: l.strandRadius, count: Math.round(420 * Math.max(0.3, to - from)),
        };
        pieces.push(head);
        butts.set(step.material, head);
        spun.add(step.material);
        if (step.collar) {
          pieces.push({
            type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.3],
            // The first clump spins all the way round, so its tips flare back on every side.
            x: from, radius, length: step.collar, angle: deg(22), direction: "back", side: "top",
            spread: deg(170), bundleRadius: l.strandRadius, count: 240,
          });
        }
        profile = profile.withLayer(from, to, 0.08);
        thread = { kind: "rest", x: to, radius: profile.sideAt(to) };
        threadX = to;
        threadAt = step.to;
        duration = DURATION.spin;
        break;
      }
      case "tie-in": {
        const x = threadX!;
        const l = looks.get(step.material)!;
        tiedAt.set(step.material, x);
        tiedAtPosition.set(step.material, threadAt);
        if (step.side === "under" && step.length === undefined) underneath.add(step.material);
        const side: Side = step.side === "under" ? "under" : "top";
        // On its side of what is already there; its bases spread round the circle turns lie on.
        const radius = side === "under" ? profile.underAt(x) : profile.radiusAt(x);
        const centre = profile.ringAt(x).centre * (side === "under" ? -1 : 1);
        const angle = deg(step.angle ?? (l.look === "yarn" ? 5 : 3));
        const upright = step.angle !== undefined && step.angle >= 60;
        const across = step.side === "across";
        // Upright posts are a gathered tuft; an upright wing with a spread is divided in two.
        const spread = deg(upright ? 22 : (step.spread ?? DEFAULT_SPREAD[l.look] ?? 30));
        const pair = upright && step.spread !== undefined ? deg(step.spread) : undefined;
        if (step.length) bunches.set(step.material, { length: step.length, spread });
        if (step.length && !upright && !across && !step.forward) {
          ctx.tipX = x - step.length * Math.cos(angle);
          ctx.bendEnd = bendEndX(hook);
        }
        if ((step.extended || l.look === "strip") && step.length) {
          const cat = MATERIALS[kinds.get(step.material)!.kind] as { thickness?: number };
          // Assumption: chenille keeps its own thickness; yarn is twisted into a rope; foam is a cut cylinder.
          const made = step.segments !== undefined;
          // A recipe's width is the body's thickness at the front.
          const thickness = step.width !== undefined && l.look !== "strip"
            ? step.width / 2
            : l.look === "strip" ? STRIP_HIDE / 2 : l.look === "chenille" ? l.strandRadius * 0.85 : l.look === "foam" ? Math.max(0.08, cat.thickness ?? 0.09) : 0.11;
          const ext: ExtensionPiece = {
            type: "extension", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.35],
            x, radius, length: step.length, angle, side, thickness,
            tip: step.tip === undefined ? undefined : resolveColor(step.tip), fuzz: l.look === "chenille" ? l.fibreLength : undefined,
            forward: step.forward,
            // A fur strip sticks out as its hide, the fur on top (a Zonker's or a Bunny Leech's tail).
            ...(l.look === "strip" ? { width: l.strandRadius * 2, fur: l.fibreLength } : {}),
            // Assumption: a body made on a needle tapers to about two thirds of its front thickness
            // at its tip (read from photos of the Mohican Mayfly).
            ...(made ? { segments: step.segments, bands: threadColor, taper: 0.65 } : {}),
          };
          pieces.push(ext);
          // Tails tied in at its tip beforehand come out of its end, carrying on its line (forward
          // too, out of a body pointing forward over the eye).
          if (step.tails !== undefined && step["tail-length"] !== undefined) {
            const tl = looks.get(step.tails)!;
            const end = extensionCentre(ext, 1);
            const before = extensionCentre(ext, 0.95);
            // On its side's terms (up from the top, down from underneath), signed: a body drooping
            // below the shank's axis keeps its tails there, sloping on down.
            const flip = side === "under" ? -1 : 1;
            const slope = Math.atan2(flip * (end.y - before.y), Math.abs(end.x - before.x));
            pieces.push({
              type: "bundle", id: nextId++, material: step.tails, look: tl.look, color: tl.color, window: [0, 0.35],
              x: end.x, radius: flip * end.y + 0.02, centre: flip * end.y, length: step["tail-length"], angle: slope, direction: step.forward ? "forward" : "back", side,
              spread: deg(step["tail-spread"] ?? 20), bundleRadius: tl.strandRadius, count: tl.count, marks: tl.marks, fibreWidth: tl.fibreWidth, flue: tl.flue,
            });
          }
          // The rest of the strip waits, folded back over the tail, to be pulled over the body.
          if ((l.look === "strip" || step.extended) && nextUse(step.material, index) === "pull-over") {
            freeEnds.set(step.material, { ...freeEnd(step.material, l), kind: "rest", x, radius, direction: "back-flat" });
            ends = restingEnds();
          }
        } else if (across && step.length) {
          pieces.push({
            type: "legs", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.35],
            // Each strand tied across makes one leg on each side.
            x, radius, length: step.length, sweep: deg(step.angle ?? 0), count: kinds.get(step.material)!.count ?? 2,
            strandRadius: l.look === "legs" ? l.strandRadius : 0.012,
          });
        } else if (l.look === "eyes") {
          const kind = kinds.get(step.material)!.kind;
          pieces.push({
            type: "eyes", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.3],
            x, shankRadius: radius, size: l.strandRadius, side, chain: kind === "bead-chain-eyes",
          });
        } else if (step.length && l.look === "feather") {
          const shape = (MATERIALS[kinds.get(step.material)!.kind] as { shape?: FeatherPiece["shape"] }).shape ?? "breast";
          pieces.push({
            type: "feather", id: nextId++, material: step.material, look: l.look, color: l.color,
            window: [0, 0.35], x, radius, length: step.length, angle,
            width: step.width ?? step.length * FEATHER_WIDTH[shape], shape,
            pair: step.spread !== undefined ? deg(step.spread) : 0, side, barring: l.barring,
          });
        } else if (step.length) {
          pieces.push({
            type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color,
            window: [0, 0.35], x, radius, centre, length: step.length, angle, direction: step.forward ? "forward" : "back", side, spread,
            // A long hair wing is a bigger clump: it stays dense as it fans out.
            bundleRadius: l.strandRadius, count: l.look === "hair" && !l.counted ? Math.round(l.count * Math.min(2.5, Math.max(1, step.length / 1.5))) : l.count,
            pair, marks: l.marks, fibreWidth: l.fibreWidth, flue: l.flue,
            ...(upright && step.fan !== undefined ? { fan: deg(step.fan) } : {}),
          });
          if (upright) {
            posts.set(step.material, { x, baseY: radius, height: step.length, radius: l.strandRadius * 0.45 });
          }
          // Tied in pointing forward, the butts lie back along the shank under the turns (cut square
          // first, as for a bullet head).
          if (l.look === "hair" && !step.forward) {
            const b: BundlePiece = {
              type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color,
              window: [0.2, 0.45], x: x + 0.12, radius, centre, length: BUTTS.length, angle: BUTTS.angle,
              direction: "forward", side, spread, bundleRadius: l.strandRadius, count: l.count,
            };
            pieces.push(b);
            butts.set(step.material, b);
          }
        } else {
          const next = nextUse(step.material, index);
          const end: FreeEndPose = {
            ...freeEnd(step.material, l), kind: "rest", x, radius,
            direction: next === "pull-over" ? (step.forward ? "forward-flat" : step.side === "under" ? "under-flat" : "back-flat") : l.look === "hackle" ? "back-up" : "back-down",
          };
          freeEnds.set(step.material, end);
          ends = restingEnds();
        }
        // The bound-down end tapers out along the shank rather than making a ridge. A bunch (a
        // tail, a wing, a beard) lies on its side of the shank, more of it all round the wider it
        // is spread (a hair wing spread round a tube); a strand to be wound is wrapped round with it.
        if (l.look !== "eyes") {
          const thickness = l.tieInThickness * 0.6;
          const round = step.length && !across ? allRound(spread) : 1;
          profile = profile.withLayer(x - 2 * pitch, x + 8 * pitch, thickness * round, 0.06);
          if (round < 1) profile = profile.withLayer(x - 2 * pitch, x + 8 * pitch, thickness * (1 - round), 0.06, false, side);
        }
        const wraps = inPlace(x, l.look === "hair" || l.look === "eyes" ? 8 : 5, [0.3, 1]);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.tieIn;
        break;
      }
      case "wind": {
        const l = looks.get(step.material)!;
        const from = tiedAt.get(step.material)!;
        let piece: WrapsPiece;
        if (step.around) {
          const post = posts.get(step.around)!;
          const stack = step.turns * l.strandRadius * 2.4;
          // Each turn goes under the last, so the wraps run down the post from the top of the stack,
          // to just above what is wound on the shank there by now (a hair body).
          const y1 = Math.max(post.baseY, profile.radiusAt(post.x)) + 0.05;
          piece = {
            ...materialWraps(step.material, l, post.x, post.x, step.turns),
            path: "post", sweep: deg(4),
            post: { x: post.x, y0: y1 + stack, y1, radius: post.radius },
          };
          post.hackle = Math.max(post.hackle ?? 0, y1 + stack);
        } else {
          const to = Math.min(step.to! * span, frontLimit);
          ctx.rear = step.to! < tiedAtPosition.get(step.material)!;
          if (!ctx.rear && palmered) {
            ctx.through = palmered;
            palmered = null;
          }
          piece = { ...materialWraps(step.material, l, from, to, step.turns), counter: step.counter };
          const coverage = (step.turns * 2 * l.strandRadius) / Math.max(Math.abs(to - from), 0.01);
          profile = profile.withLayer(from, to, l.layerThickness(coverage));
          if (ctx.rear) {
            // The tip stays at the bend, held until another material is wound over it.
            palmered = step.material;
            palmeredTips.add(step.material);
            freeEnds.set(step.material, {
              ...freeEnd(step.material, l), length: l.freeLength * 0.4, kind: "rest", x: to,
              radius: profile.radiusAt(to), direction: "back-down",
            });
          }
        }
        pieces.push(piece);
        wound.set(step.material, piece);
        if (piece.path === "travel") {
          // Each turn over the top of a wing case or back presses it in. The dented case
          // replaces the smooth one from this step on, so earlier moments stay smooth.
          for (const [id, c] of covers) {
            const dents: number[] = [];
            for (let k = 0; k < step.turns; k++) {
              const x = piece.x0 + ((piece.x1 - piece.x0) * (k + 0.25)) / step.turns;
              if (x > c.x0 + 0.02 && x < c.x1 - 0.02) dents.push(x);
            }
            if (dents.length === 0) continue;
            c.until = time;
            const dented: CoverPiece = { ...c, id: nextId++, seed: c.seed ?? c.id, dents: [...c.dents, ...dents], window: [0, 0.0001], until: undefined };
            pieces.push(dented);
            covers.set(id, dented);
          }
        }
        if (piece.fibreLength && piece.path === "travel") {
          // Squashed flat under a cover, fluff still adds some height.
          fluffy.push({ x0: piece.x0, x1: piece.x1, height: Math.min(0.1, piece.fibreLength * 0.4) });
        }
        if (!ctx.rear) freeEnds.delete(step.material);
        ends = [...restingEnds().filter((e) => e.material !== step.material), { ...freeEnd(step.material, l), kind: "follow", piece: piece.id }];
        duration = Math.max(2, step.turns * DURATION.perMaterialTurn);
        break;
      }
      case "pull-over": {
        const l = looks.get(step.material)!;
        const tied = tiedAt.get(step.material)!;
        const end = Math.min(step.to * span, frontLimit);
        // Pulled forward and tied down at the thread, or laid back from where it is tied in (a
        // shellback tied in at the eye), its end held by the next winding, or tied down there by
        // the thread when it is waiting there (a foam balloon folded back over the thorax).
        const back = end < tied;
        // In recipe positions, as the validator decides it.
        const tiedBack = back && threadX !== null && Math.abs(threadAt - step.to) <= POSITION_TOLERANCE;
        ctx.rear = back;
        if (tiedBack) ctx.tiedBack = true;
        const [from, to] = back ? [end, tied] : [tied, end];
        // Assumption: foam backs are thick and cover half the body; wing cases are thin.
        const cat = MATERIALS[kinds.get(step.material)!.kind] as { thickness?: number };
        const strip = l.look === "strip";
        // Hair spread all round the shank is folded over all round it (a bullet head).
        const bunch = bunches.get(step.material);
        const round = l.look === "hair" && bunch !== undefined && allRound(bunch.spread) >= 1;
        const thickness = strip ? STRIP_HIDE : round ? HAIR_SHEATH : l.sheet ?? cat.thickness ?? (l.look === "foam" ? 0.09 : 0.035);
        // A fur strip reaches round the body as far as its width does.
        const stripAngle = strip ? Math.min(1.6, Math.max(0.35, l.strandRadius / Math.max(0.05, profile.radiusAt((from + to) / 2)))) : 0;
        const laterTrim = recipe.steps.slice(index + 1).find((s) => s.op === "trim" && s.material === step.material) as Extract<Step, { op: "trim" }> | undefined;
        const trimmedLater = laterTrim !== undefined;
        // Parted round a post: the halves go down its sides, far enough round the body to clear it.
        const post = step.around !== undefined && !back ? posts.get(step.around) : undefined;
        // Assumption: each half is turned out by about half again the post's width round the body,
        // and comes back together over about a third of a gape either side of the post (read
        // from photos of the Mohican Mayfly from above).
        const split = post
          ? { x: post.x, angle: Math.min(deg(75), Math.max(deg(30), (2.2 * post.radius + 0.06) / Math.max(0.05, profile.radiusAt(post.x)))), reach: Math.max(0.3, Math.min(post.x - from, to - post.x)) }
          : undefined;
        // What sticks out until it is cut is longer than what is left.
        const untrimmed = Math.max(UNTRIMMED, (laterTrim?.leave ?? 0) + 0.4);
        ctx.trimmedLater = trimmedLater;
        const cover: CoverPiece = {
          type: "cover", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.6],
          // A loose bubble wraps further round the sides of what it covers.
          // Pulled forward over a parachute, it lies on the hackle's turns round the post (a Mohican's
          // foam over its hackle), as it does over squashed fluff.
          x0: from, x1: to, base: profile, thickness,
          lift: Math.max(fluffUnder(from, to), ...[...posts.values()].filter((p) => p.hackle !== undefined && p.x > from && p.x < to && !back).map((p) => p.hackle! - profile.radiusAt(p.x))),
          halfAngle: strip ? stripAngle : round ? Math.PI : deg(step.bubble ? 100 : l.look === "foam" ? 80 : l.look === "feather" ? 50 : 65),
          ...(round && { round: true }),
          ...(strip ? { fur: l.fibreLength } : {}),
          ...(step.bubble ? { bubble: step.bubble } : {}),
          ...(underneath.has(step.material) ? { side: "under" as const } : {}),
          ...(l.veil ? { veil: true } : {}),
          ...(split ? { split } : {}),
          // A strip trimmed later sticks out over the eye until then.
          dents: [], stub: trimmedLater && !back ? untrimmed : 0,
          barring: l.barring,
        };
        pieces.push(cover);
        covers.set(step.material, cover);
        const coverSide = underneath.has(step.material) ? "under" : round ? "round" : "top";
        // (Folded all round, it is pinched by the turns at its tie-down, as it is drawn.)
        profile = round ? profile.withLayer(from, to, thickness, 0.1, true, coverSide) : profile.withLayer(from, to, thickness * 0.8, 0.03, false, coverSide);
        // A loose bubble stands off the body in the middle only: nothing at its tie-downs.
        if (step.bubble) {
          const q = (to - from) / 4;
          profile = profile.withLayer(from + q, to - q, step.bubble * 0.5, q, false, coverSide);
        }
        if (coverSide === "under") ctx.under = true;
        // Fibres on top of what it covers are pressed flat; a loose bubble leaves them standing.
        if (!step.bubble && !underneath.has(step.material)) pressUnder(pieces, from, to, cover.halfAngle);
        freeEnds.delete(step.material);
        ends = restingEnds();
        // A bunch tied in pointing back (a Humpy's hair) is folded over now: it no longer sticks out.
        for (const s of steps) for (const p of s.pieces) if (p.type === "bundle" && p.material === step.material && p.until === undefined) p.until = time;
        // Hair folded back and tied down: as long behind where it was tied in as it was in front, its
        // tips trail loose behind the tie-down (to be bound along the body, or trimmed).
        if (tiedBack && l.look === "hair" && bunch && tied - bunch.length < end - TIPS_PAST_TURN) {
          ctx.trailing = true;
          const tips: BundlePiece = {
            type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0.6, 1],
            x: end, radius: profile.radiusAt(end), length: end - (tied - bunch.length), angle: deg(8), direction: "back", side: "top",
            spread: bunch.spread, bundleRadius: l.strandRadius, count: Math.round(l.count * (round ? 3 : 1.5)), marks: l.marks,
          };
          pieces.push(tips);
          butts.set(step.material, tips);
          trailing.set(step.material, { x: end, tipX: tied - bunch.length, tips, halfAngle: cover.halfAngle, round, thickness });
        }
        // The tips that pass the tie-down stand up in front of it as a divided wing (a Humpy).
        if (step.wing && !back) {
          pieces.push({
            type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0.6, 1],
            x: to + pitch, radius: profile.radiusAt(to + pitch), length: step.wing, angle: deg(88), direction: "back", side: "top",
            spread: deg(22), pair: deg(22), bundleRadius: l.strandRadius,
            count: l.look === "hair" ? Math.round(l.count * Math.min(2.5, Math.max(1, step.wing / 1.5))) : l.count,
            marks: l.marks, fibreWidth: l.fibreWidth,
          });
        }
        if (!back || tiedBack) {
          const wraps = inPlace(threadX!, 5, [0.6, 1]);
          pieces.push(wraps);
          thread = { kind: "follow", piece: wraps.id };
        }
        duration = DURATION.pullOver;
        break;
      }
      case "tie-off": {
        const l = looks.get(step.material)!;
        const x = threadX!;
        const sleeve = sleeves.get(step.material);
        if (sleeve) {
          // The sleeve's other end tied down: stretched tight over the body from here on.
          ctx.sleeve = sleeve.open;
          sleeves.delete(step.material);
          sleeve.until = time + DURATION.tieOff * 0.3;
          pieces.push({ ...sleeve, id: nextId++, seed: sleeve.seed ?? sleeve.id, open: undefined, window: [0.3, 0.3001], until: undefined });
          profile = profile.withLayer(x - 2 * pitch, x + 6 * pitch, l.tieInThickness, 0.04);
          const wraps = inPlace(x, 8);
          pieces.push(wraps);
          thread = { kind: "follow", piece: wraps.id };
          duration = DURATION.tieOff;
          break;
        }
        // (A woven strand's end was held there until now.)
        freeEnds.delete(step.material);
        ends = [
          ...restingEnds(),
          { ...freeEnd(step.material, l), length: 0.6, kind: "rest", x, radius: profile.radiusAt(x), direction: "out", hideAfter: 0.7 },
        ];
        profile = profile.withLayer(x - 2 * pitch, x + 8 * pitch, l.tieInThickness * 0.6, 0.06);
        const wraps = inPlace(x, 5);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.tieOff;
        break;
      }
      case "trim": {
        duration = DURATION.trim;
        const cutAt = time + duration * 0.5;
        if (step.keep) {
          // The same hackle, with only its side fibres left.
          const w = wound.get(step.material)!;
          w.until = cutAt;
          const kept: WrapsPiece = { ...w, id: nextId++, seed: w.seed ?? w.id, keep: step.keep, window: [0.5, 0.5001], until: undefined };
          pieces.push(kept);
          wound.set(step.material, kept);
          ctx.keep = true;
        } else if (covers.has(step.material) && !trailing.has(step.material)) {
          // The excess of a foam back, cut flush or left as a stub over the eye: the trimmed
          // back replaces the untrimmed one from the cut on.
          ctx.cover = true;
          const c = covers.get(step.material)!;
          c.until = cutAt;
          const trimmed: CoverPiece = { ...c, id: nextId++, seed: c.seed ?? c.id, stub: step.leave ?? 0, window: [0.5, 0.5001], until: undefined };
          pieces.push(trimmed);
          covers.set(step.material, trimmed);
        } else if (palmeredTips.has(step.material)) {
          ctx.tip = true;
          palmeredTips.delete(step.material);
          const end = freeEnds.get(step.material);
          freeEnds.delete(step.material);
          ends = [...restingEnds(), ...(end && end.kind === "rest" ? [{ ...end, hideAfter: 0.5 }] : [])];
        } else if (spun.has(step.material)) {
          ctx.spun = true;
          spun.delete(step.material);
          const b = butts.get(step.material)!;
          butts.delete(step.material);
          b.until = cutAt;
          // Assumption: a trimmed head is about 0.4 gape from the shank unless the recipe says otherwise.
          pieces.push({
            ...b, id: nextId++, length: step.leave ?? 0.4, angle: deg(10), count: b.count * 4, cut: true,
            trimShape: step.shape ?? "round", window: [0.5, 0.5001], until: undefined,
          });
        } else {
          // Hair butts, or the tips of hair folded back, behind its tie-down or its last turn.
          if (trailing.delete(step.material)) ctx.tips = true;
          const b = butts.get(step.material);
          // (Nothing left sticking out: hair folded back whose tips end at the tie-down, or an
          // unfinished fly's trim of hair tied in pointing forward, its butts bound under.)
          if (!b) break;
          butts.delete(step.material);
          b.until = cutAt;
          if (step.shape) {
            // Butts spun round the shank by the tight turns, then trimmed into a head.
            ctx.spun = true;
            const span = Math.max(0.1, frontLimit - b.x);
            pieces.push({
              ...b, id: nextId++, direction: "radial", span, spread: Math.PI, length: step.leave ?? 0.4, angle: deg(10),
              count: Math.round(1800 * span), cut: true, trimShape: step.shape, window: [0.5, 0.5001], until: undefined,
            });
          } else if (step.leave) {
            pieces.push({ ...b, id: nextId++, length: step.leave, cut: true, window: [0.5, 0.5001], until: undefined });
          }
        }
        break;
      }
      case "sleeve": {
        const l = looks.get(step.material)!;
        const x = threadX!;
        const end = Math.min(step.to * span, frontLimit);
        const [x0, x1] = end > x ? [x, end] : [end, x];
        const piece: SleevePiece = {
          type: "sleeve", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.6],
          x0, x1, base: profile, thickness: l.strandRadius, open: end > x ? "front" : "rear", ...(step.fray ? { fray: step.fray } : {}),
        };
        pieces.push(piece);
        sleeves.set(step.material, piece);
        // Stretched over it, the sleeve flattens the fluff of what is under it all round.
        pressUnder(pieces, x0, x1, Math.PI - 0.2);
        ctx.rear = end > x;
        ctx.from = threadAt;
        profile = profile.withLayer(x0, x1, l.layerThickness(1), 0.02);
        const wraps = inPlace(x, 8, [0.6, 1]);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.sleeve;
        break;
      }
      case "weave": {
        const l = looks.get(step.material)!;
        const lu = looks.get(step.under)!;
        const from = Math.min(tiedAt.get(step.material)!, tiedAt.get(step.under)!);
        const to = Math.min(step.to * span, frontLimit);
        // Assumption: one crossing per strand width, as tyers weave chenille, each strand pulled
        // snug against the last.
        const turns = step.turns ?? Math.max(2, Math.round((to - from) / (l.strandRadius + lu.strandRadius)));
        // Assumption: the belly's strand passing over the top's at each side makes the body deeper
        // than one strand wound on, about a third again (read from photos of the Bitch Creek).
        const piece: WrapsPiece = { ...materialWraps(step.material, l, from, to, turns), strandRadius: Math.max(l.strandRadius, lu.strandRadius) * 1.3,
          woven: { under: { look: lu.look, color: lu.color, fibreLength: lu.fibreLength, sweep: lu.sweep, barred: lu.barred, shaggy: lu.shaggy } },
        };
        const coverage = (turns * (l.strandRadius + lu.strandRadius)) / Math.max(to - from, 0.01);
        // Assumption: as thick as the strands wound in touching turns.
        profile = profile.withLayer(from, to, Math.max(l.layerThickness(coverage), lu.layerThickness(coverage)));
        pieces.push(piece);
        wound.set(step.material, piece);
        const fibres = Math.max(l.fibreLength ?? 0, lu.fibreLength ?? 0);
        if (fibres) fluffy.push({ x0: from, x1: to, height: Math.min(0.1, fibres * 0.4) });
        // Both ends are held at the front, standing out, until they are tied off there.
        for (const [id, look] of [[step.material, l], [step.under, lu]] as const) {
          freeEnds.set(id, { ...freeEnd(id, look), length: look.freeLength * 0.5, kind: "rest", x: to, radius: profile.radiusAt(to), direction: "out" });
        }
        ends = [
          ...restingEnds().filter((e) => e.material !== step.material && e.material !== step.under),
          { ...freeEnd(step.material, l), kind: "follow", piece: piece.id },
          { ...freeEnd(step.under, lu), kind: "follow", piece: piece.id, far: true },
        ];
        // With the thread cut (as Kreft weaves) or parked where the weave ends.
        if (threadX !== null) ctx.parked = true;
        duration = Math.max(3, turns * DURATION.perWeaveCrossing);
        break;
      }
      case "whip-finish": {
        // Part-way: the thread is started again later (a Zonker's rear, finished at the bend).
        if (recipe.steps.slice(index + 1).some((s) => s.op === "attach-thread")) ctx.midway = true;
        // The head is built up in layers between the thread and the eye (or bead).
        const piece = inPlace(threadX!, 3 * step.turns, undefined, frontLimit);
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id, cut: true };
        threadX = null;
        duration = DURATION.whip;
        break;
      }
    }

    steps.push({
      index,
      title: stepTitle(recipe, step, ctx),
      text: stepText(recipe, step, ctx),
      start: time,
      duration,
      pieces,
      thread,
      freeEnds: ends,
    });
    time += duration;
  });

  return { recipe, hook, threadColor, threadRadius, steps, duration: time };
}

/** Index of the step playing at time t (the last step once t reaches the end). */
/** Seconds before a step's end that still count as that step, finished. */
const END_MARGIN = 1e-6;

/**
 * The last moment of a step, showing it finished. At `start + duration` the next step has
 * already begun (see `stepAt`), so stopping or holding at the end of a step uses this.
 */
export function stepEnd(step: SimStep): number {
  return step.start + step.duration - END_MARGIN;
}

/** How far through a step `t` is, from 0 to 1; its last moment (`stepEnd`) counts as done. */
export function stepProgress(step: SimStep, t: number): number {
  const p = (t - step.start) / step.duration;
  return p >= 1 - (2 * END_MARGIN) / step.duration ? 1 : Math.max(0, p);
}

/**
 * How much of a piece is drawn at `t`, from 0 (not yet, or gone) to 1. A piece replaced by
 * a later one (`until`) still shows at that exact moment, while its replacement starts from
 * nothing, so the swap never leaves a gap.
 */
export function pieceProgress(step: SimStep, piece: Pick<Piece, "window" | "until">, t: number): number {
  if (piece.until !== undefined && t > piece.until) return 0;
  const [a, b] = piece.window;
  return Math.min(1, Math.max(0, (stepProgress(step, t) - a) / (b - a)));
}

export function stepAt(build: Build, t: number): number {
  for (let i = build.steps.length - 1; i >= 0; i--) {
    if (t >= build.steps[i]!.start) return i;
  }
  return 0;
}
