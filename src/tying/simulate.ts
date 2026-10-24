import { MATERIALS, type Archetype } from "../recipe/materials";
import { resolveColor, type Material, type Recipe, type Step } from "../recipe/schema";
import { stepText, stepTitle, type StepContext } from "./describe";
import { gapeMm, HOOK_MODELS, threadDiameter, type HookModel } from "./hook";
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
}

export interface WrapsPiece extends PieceBase {
  type: "wraps";
  /**
   * "travel": from x0 to x1 along the shank. "in-place": out from x0 by up to `width`
   * and back. "post": round an upright parachute post (see `post`).
   */
  path: "travel" | "in-place" | "post";
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
  /** Lies flat as a band when wound (silk floss, flat tinsel, wound fibres) rather than as a round strand. */
  band?: boolean;
  /** Post wraps: the post's x, the heights (above the shank axis) the wraps run between, and its radius. */
  post?: { x: number; y0: number; y1: number; radius: number };
  /** Trimmed hackle: only the fibres at the sides are left, those on top and at the sides, or those underneath and at the sides. */
  keep?: "sides" | "top" | "under";
  /** Where a wing case or back was pulled over these wraps, pressing down the fibres on top. */
  covered?: [number, number];
}

/** A bunch of fibres or hair sticking out from its tie-in point (tag, tail, wing, beard, butts, spun hair). */
export interface BundlePiece extends PieceBase {
  type: "bundle";
  x: number;
  /** Spun hair: the bases spread forward over this length. */
  span?: number;
  radius: number;
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
  /** Trimmed spun hair: a round head, or a wedge flat underneath and deepest at the rear. */
  trimShape?: "round" | "wedge";
  /** Upright and divided: two tufts turned out to either side by this many radians. */
  pair?: number;
}

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
}

export type Piece = WrapsPiece | BundlePiece | FeatherPiece | BeadPiece | EyesPiece | CoverPiece;

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
  | { kind: "rest"; x: number; radius: number; direction: "back-down" | "back-up" | "back-flat" | "out"; hideAfter?: number }
  | { kind: "follow"; piece: number }
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

/** Position on a shank wraps piece at progress u (0..1). */
export function wrapAt(p: WrapsPiece, u: number): { x: number; radius: number; angle: number } {
  const angle = 2 * Math.PI * p.turns * u;
  if (p.path === "travel") {
    const x = p.x0 + (p.x1 - p.x0) * u;
    return { x, radius: p.base.radiusAt(x) + p.strandRadius, angle };
  }
  const x = p.x0 + p.width * Math.sin(Math.PI * u);
  // Turns going back lie over the ones going out, mostly in between them.
  return { x, radius: p.base.radiusAt(x) + p.strandRadius * (1 + 0.6 * u), angle };
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
  return {
    point: [w.x, w.radius * Math.sin(w.angle), w.radius * Math.cos(w.angle)],
    leave: [0, -Math.cos(w.angle), Math.sin(w.angle)],
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
  sweep?: number;
  barred?: boolean;
  /** 0 = plain, 1 = strongly barred. */
  barring: number;
  band?: boolean;
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Colours whose feathers and hackles are barred or mottled. */
const BARRED: Record<string, number> = { grizzly: 1, teal: 1, partridge: 0.8, mallard: 0.6, snipe: 0.5, turkey: 0.6 };

// Assumption: rough material dimensions in gapes for a size 12–14 fly.
function materialLook(recipe: Recipe, m: Material): MaterialLook {
  const cat = MATERIALS[m.kind] as (typeof MATERIALS)[keyof typeof MATERIALS] & { sweep?: number; oval?: boolean };
  const colorName = m.color ?? ("defaultColor" in cat ? cat.defaultColor : "grey");
  const color = resolveColor(colorName);
  const barring = BARRED[colorName] ?? 0;
  const base = { look: cat.archetype, color, freeLength: 1.5, count: 80, barred: barring > 0, barring };
  const mm = (v: number) => v / gapeMm(recipe.hook.size);
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
      return { ...base, strandRadius: 0.08, count: 320, tieInThickness: 0.03, layerThickness: () => 0.03 };
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
        ...base, strandRadius: 0.06, count: 260, fibreLength: 0.6, sweep: deg(45),
        tieInThickness: 0.02, layerThickness: () => 0.05,
      };
    case "flash":
      return { ...base, strandRadius: 0.04, count: m.count ?? 8, tieInThickness: 0.01, layerThickness: () => 0.01 };
    case "feather":
      return { ...base, strandRadius: 0.012, tieInThickness: 0.02, layerThickness: () => 0.02 };
    case "foam":
      return { ...base, strandRadius: 0.05, tieInThickness: 0.06, layerThickness: () => 0.1 };
    case "bead":
    case "eyes":
      return { ...base, strandRadius: mm(m.mm ?? 3) / 2, tieInThickness: 0, layerThickness: () => 0 };
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

/** Feather width as a fraction of length, by shape. */
const FEATHER_WIDTH = { breast: 0.5, tip: 0.28, slip: 0.32 };

export function simulate(recipe: Recipe): Build {
  const hook = HOOK_MODELS[recipe.hook.model];
  const L = hook.shankLength;
  const td = threadDiameter(recipe);
  const threadRadius = td / 2;
  // Thread flattens when wrapped, so touching turns are wider than the diameter.
  const pitch = td * 1.3;
  const threadColor = resolveColor(recipe.thread.color);

  // A double's shank is two wires side by side, so the dressing sits on a wider base.
  let profile = Profile.bare(-0.3, L + 0.2, hook.points === 2 ? hook.wireRadius * 1.8 : hook.wireRadius);
  let threadX: number | null = null;
  let nextId = 0;
  let time = 0;
  const looks = new Map(recipe.materials.map((m) => [m.id, materialLook(recipe, m)]));
  const kinds = new Map(recipe.materials.map((m) => [m.id, m]));
  const tiedAt = new Map<string, number>();
  const freeEnds = new Map<string, FreeEndPose>();
  /** Untrimmed hair butts and spun hair, by material. */
  const butts = new Map<string, BundlePiece>();
  const spun = new Set<string>();
  /** Wound pieces by material, so a hackle can be trimmed after winding. */
  const wound = new Map<string, WrapsPiece>();
  const covers = new Map<string, CoverPiece>();
  /** Upright posts, for parachute hackles. */
  const posts = new Map<string, { x: number; baseY: number; height: number; radius: number }>();
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
    const piece = threadWraps("in-place", x0, x1, turns, window);
    profile = profile.withLayer(x0, x1, td * 0.6, 0.05);
    return piece;
  };
  const restingEnds = () => [...freeEnds.values()];
  const freeEnd = (id: string, l: MaterialLook): Omit<FreeEndPose, "kind"> => ({
    material: id, look: l.look, color: l.color, length: l.freeLength,
    strandRadius: l.strandRadius, fibreLength: l.fibreLength,
  });
  const materialWraps = (id: string, l: MaterialLook, x0: number, x1: number, turns: number): WrapsPiece => ({
    type: "wraps", id: nextId++, material: id, look: l.look, color: l.color, window: [0, 1],
    path: "travel", x0, x1, width: 0, turns, strandRadius: l.strandRadius, base: profile,
    fibreLength: l.fibreLength, sweep: l.sweep, barred: l.barred, band: l.band,
  });

  recipe.steps.forEach((step, index) => {
    const pieces: Piece[] = [];
    let thread: ThreadPose | null = threadX === null ? null : { kind: "rest", x: threadX, radius: profile.radiusAt(threadX) };
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
        pieces.push({ type: "bead", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 1], x, radius: l.strandRadius, cone });
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
        threadX = Math.min(step.at * span, frontLimit);
        const piece = inPlace(threadX, 6);
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id };
        duration = DURATION.attach;
        break;
      }
      case "wrap-thread": {
        const from = threadX!;
        const to = Math.min(step.to * span, frontLimit);
        const turns = step.turns ?? Math.max(1, Math.round(Math.abs(to - from) / pitch));
        const piece = threadWraps("travel", from, to, turns);
        const coverage = (turns * pitch) / Math.max(Math.abs(to - from), pitch);
        profile = profile.withLayer(from, to, td * 0.6 * Math.min(coverage, 2));
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id };
        threadX = to;
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
        // The dubbing is on the thread, so the bobbin follows it.
        thread = { kind: "follow", piece: piece.id };
        threadX = to;
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
        thread = { kind: "rest", x: to, radius: profile.radiusAt(to) };
        threadX = to;
        duration = DURATION.spin;
        break;
      }
      case "tie-in": {
        const x = threadX!;
        const l = looks.get(step.material)!;
        tiedAt.set(step.material, x);
        const radius = profile.radiusAt(x);
        const side: Side = step.side ?? "top";
        const angle = deg(step.angle ?? (l.look === "yarn" ? 5 : 3));
        const upright = step.angle !== undefined && step.angle >= 60;
        // Upright posts are a gathered tuft; an upright wing with a spread is divided in two.
        const spread = deg(upright ? 22 : (step.spread ?? DEFAULT_SPREAD[l.look] ?? 30));
        const pair = upright && step.spread !== undefined ? deg(step.spread) : undefined;
        if (step.length && !upright) {
          ctx.tipX = x - step.length * Math.cos(angle);
          ctx.bendEnd = bendEndX(hook);
        }
        if (l.look === "eyes") {
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
            window: [0, 0.35], x, radius, length: step.length, angle, direction: "back", side, spread,
            bundleRadius: l.strandRadius, count: l.count, pair,
          });
          if (upright) {
            posts.set(step.material, { x, baseY: radius, height: step.length, radius: l.strandRadius * 0.45 });
          }
          if (l.look === "hair") {
            const b: BundlePiece = {
              type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color,
              window: [0.2, 0.45], x: x + 0.12, radius, length: BUTTS.length, angle: BUTTS.angle,
              direction: "forward", side, spread, bundleRadius: l.strandRadius, count: l.count,
            };
            pieces.push(b);
            butts.set(step.material, b);
          }
        } else {
          const next = nextUse(step.material, index);
          const end: FreeEndPose = {
            ...freeEnd(step.material, l), kind: "rest", x, radius,
            direction: next === "pull-over" ? "back-flat" : l.look === "hackle" ? "back-up" : "back-down",
          };
          freeEnds.set(step.material, end);
          ends = restingEnds();
        }
        // The bound-down end tapers out along the shank rather than making a ridge.
        if (l.look !== "eyes") profile = profile.withLayer(x - 2 * pitch, x + 8 * pitch, l.tieInThickness * 0.6, 0.06);
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
          // Each turn goes under the last, so the wraps run down the post from the top of the stack.
          const y1 = post.baseY + 0.05;
          piece = {
            ...materialWraps(step.material, l, post.x, post.x, step.turns),
            path: "post", sweep: deg(4),
            post: { x: post.x, y0: y1 + stack, y1, radius: post.radius },
          };
        } else {
          const to = Math.min(step.to! * span, frontLimit);
          ctx.rear = to < from;
          if (!ctx.rear && palmered) {
            ctx.through = palmered;
            palmered = null;
          }
          piece = materialWraps(step.material, l, from, to, step.turns);
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
          // Each turn over the top of a wing case or back presses it in.
          for (const c of covers.values()) {
            for (let k = 0; k < step.turns; k++) {
              const x = piece.x0 + ((piece.x1 - piece.x0) * (k + 0.25)) / step.turns;
              if (x > c.x0 + 0.02 && x < c.x1 - 0.02) c.dents.push(x);
            }
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
        const from = tiedAt.get(step.material)!;
        const to = Math.min(step.to * span, frontLimit);
        // Assumption: foam backs are thick and cover half the body; wing cases are thin.
        const cat = MATERIALS[kinds.get(step.material)!.kind] as { thickness?: number };
        const thickness = cat.thickness ?? (l.look === "foam" ? 0.09 : 0.035);
        const cover: CoverPiece = {
          type: "cover", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 0.6],
          x0: from, x1: to, base: profile, thickness, lift: fluffUnder(from, to), halfAngle: deg(l.look === "foam" ? 80 : 65),
          dents: [], stub: 0,
        };
        pieces.push(cover);
        covers.set(step.material, cover);
        profile = profile.withLayer(from, to, thickness * 0.8);
        for (const w of wound.values()) {
          if (w.fibreLength && w.path === "travel" && Math.min(w.x0, w.x1) < to && Math.max(w.x0, w.x1) > from) w.covered = [from, to];
        }
        freeEnds.delete(step.material);
        ends = restingEnds();
        const wraps = inPlace(threadX!, 5, [0.6, 1]);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.pullOver;
        break;
      }
      case "tie-off": {
        const l = looks.get(step.material)!;
        const x = threadX!;
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
          pieces.push({ ...w, id: nextId++, keep: step.keep, window: [0.5, 0.5001], until: undefined });
          ctx.keep = true;
        } else if (covers.has(step.material)) {
          // The excess of a foam back, cut flush or left as a stub over the eye.
          ctx.cover = true;
          covers.get(step.material)!.stub = step.leave ?? 0;
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
          const b = butts.get(step.material)!;
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
      case "whip-finish": {
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
export function stepAt(build: Build, t: number): number {
  for (let i = build.steps.length - 1; i >= 0; i--) {
    if (t >= build.steps[i]!.start) return i;
  }
  return 0;
}
