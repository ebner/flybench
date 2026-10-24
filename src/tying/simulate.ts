import { MATERIALS, type Archetype } from "../recipe/materials";
import { resolveColor, type Material, type Recipe } from "../recipe/schema";
import { stepText, stepTitle, type StepContext } from "./describe";
import { bendEndX, HOOK_MODELS, threadDiameter, type HookModel } from "./hook";
import { Profile } from "./profile";

/**
 * Turns a validated recipe into a timeline: per step, the pieces of geometry
 * that appear during it and where the thread and loose material ends are.
 * Everything here is plain data in gape units; the renderer turns it into meshes.
 *
 * Coordinates: shank along +X (x = 0 at the start of the bend), Y up, Z towards
 * the viewer. Wraps go up on the near side and over the top, away from the
 * tyer. At wrap angle 0 the thread touches the near side of the shank and hangs
 * straight down; whole turns end there again.
 */

export type Look = "thread" | Archetype;

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
  /** "travel": from x0 to x1. "in-place": out from x0 by up to `width` and back. */
  path: "travel" | "in-place";
  x0: number;
  x1: number;
  width: number;
  turns: number;
  strandRadius: number;
  /** What the wraps lie on. */
  base: Profile;
  /** Hackle barbs, herl flue or dubbing fuzz, in gapes. */
  fibreLength?: number;
}

/** A bunch of fibres or hair sticking out from its tie-in point (tag, tail, hair wing, butts). */
export interface BundlePiece extends PieceBase {
  type: "bundle";
  x: number;
  radius: number;
  length: number;
  /** Radians above the shank. */
  angle: number;
  direction: "back" | "forward";
  /** Radians to each side of the top that the bunch fans out over. */
  spread: number;
  bundleRadius: number;
  count: number;
}

/** A whole feather tied flat on top as a wing. */
export interface FeatherPiece extends PieceBase {
  type: "feather";
  x: number;
  radius: number;
  length: number;
  angle: number;
  width: number;
}

export type Piece = WrapsPiece | BundlePiece | FeatherPiece;

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
  | { kind: "rest"; x: number; radius: number; direction: "back-down" | "back-up" | "out"; hideAfter?: number }
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

/** Position on a wraps piece at progress u (0..1). */
export function wrapAt(p: WrapsPiece, u: number): { x: number; radius: number; angle: number } {
  const angle = 2 * Math.PI * p.turns * u;
  if (p.path === "travel") {
    const x = p.x0 + (p.x1 - p.x0) * u;
    return { x, radius: p.base.radiusAt(x) + p.strandRadius, angle };
  }
  const x = p.x0 + p.width * Math.sin(Math.PI * u);
  // Turns going back pile on top of the ones going out.
  return { x, radius: p.base.radiusAt(x) + p.strandRadius * (1 + 1.2 * u), angle };
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
  /** Fibres in a bundle (tags, tails, hair wings). */
  count: number;
}

// Assumption: rough material dimensions in gapes for a size 12–14 dry fly.
function materialLook(recipe: Recipe, m: Material): MaterialLook {
  const cat = MATERIALS[m.kind];
  const color = resolveColor(m.color ?? ("defaultColor" in cat ? cat.defaultColor : "#808080"));
  const base = { look: cat.archetype, color, freeLength: 1.5, count: 80 };
  switch (cat.archetype) {
    case "yarn":
      return { ...base, strandRadius: 0.05, tieInThickness: 0.025, layerThickness: (c) => 0.1 * Math.min(c, 1.5) };
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
        ...base, strandRadius: 0.012, fibreLength: m.fibre, freeLength: 1.8,
        tieInThickness: 0.024, layerThickness: () => 0.024,
      };
    case "dubbing":
      return {
        ...base, strandRadius: 0.045, fibreLength: 0.12,
        tieInThickness: 0, layerThickness: (c) => 0.075 * Math.min(c, 1.5),
      };
    case "wire":
      return { ...base, strandRadius: 0.011, tieInThickness: 0.015, layerThickness: () => 0.006 };
    case "floss": {
      const r = threadDiameter(recipe, m.size ?? recipe.thread.size) * 0.6;
      return { ...base, strandRadius: r, tieInThickness: r, layerThickness: () => r * 0.6 };
    }
    case "hair":
      return { ...base, strandRadius: 0.08, count: 260, tieInThickness: 0.03, layerThickness: () => 0.03 };
    case "fibres":
      return {
        ...base, strandRadius: 0.02, count: m.count ?? 6,
        tieInThickness: 0.015, layerThickness: (c) => 0.04 * Math.min(c, 1.5),
      };
    case "feather":
      return { ...base, strandRadius: 0.012, tieInThickness: 0.02, layerThickness: () => 0.02 };
  }
}

const DURATION = {
  attach: 2.5,
  tieIn: 2.5,
  tieOff: 2,
  trim: 1.8,
  whip: 3.5,
  perThreadTurn: 0.05,
  perMaterialTurn: 0.45,
  perDubbingTurn: 0.14,
};

const deg = (d: number) => (d * Math.PI) / 180;

// Assumption: how far round the body bunches fan out by default (degrees each side of the top).
const DEFAULT_SPREAD: Partial<Record<Archetype, number>> = { yarn: 35, fibres: 15, hair: 60 };

/** Butts of a hair clump stick forward and up from the tie-in point until trimmed. */
const BUTTS = { length: 0.55, angle: (35 * Math.PI) / 180 };

export function simulate(recipe: Recipe): Build {
  const hook = HOOK_MODELS[recipe.hook.model];
  const L = hook.shankLength;
  const td = threadDiameter(recipe);
  const threadRadius = td / 2;
  // Thread flattens when wrapped, so touching turns are wider than the diameter.
  const pitch = td * 1.3;
  const threadColor = resolveColor(recipe.thread.color);

  let profile = Profile.bare(-0.3, L + 0.2, hook.wireRadius);
  let threadX: number | null = null;
  let nextId = 0;
  let time = 0;
  const looks = new Map(recipe.materials.map((m) => [m.id, materialLook(recipe, m)]));
  const tiedAt = new Map<string, number>();
  const freeEnds = new Map<string, FreeEndPose>();
  /** Untrimmed hair butts, by material. */
  const butts = new Map<string, BundlePiece>();
  /** A palmered material whose tip the next forward wind secures. */
  let palmered: string | null = null;
  const palmeredTips = new Set<string>();
  const steps: SimStep[] = [];

  const threadWraps = (
    path: WrapsPiece["path"], x0: number, x1: number, turns: number, window: [number, number] = [0, 1],
  ): WrapsPiece => ({
    type: "wraps", id: nextId++, material: "thread", look: "thread", color: threadColor, window,
    path, x0, x1, width: path === "in-place" ? x1 - x0 : 0, turns, strandRadius: threadRadius, base: profile,
  });
  /** Turns that bind something down: out and back again, touching each way. */
  const inPlace = (x: number, turns: number, window?: [number, number], maxX = Infinity) => {
    const piece = threadWraps("in-place", x, Math.min(maxX, x + (turns * pitch) / 2), turns, window);
    profile = profile.withLayer(x, piece.x1, td * 0.8);
    return piece;
  };
  const restingEnds = () => [...freeEnds.values()];
  const freeEnd = (id: string, l: MaterialLook): Omit<FreeEndPose, "kind"> => ({
    material: id, look: l.look, color: l.color, length: l.freeLength,
    strandRadius: l.strandRadius, fibreLength: l.fibreLength,
  });

  recipe.steps.forEach((step, index) => {
    const pieces: Piece[] = [];
    let thread: ThreadPose | null = threadX === null ? null : { kind: "rest", x: threadX, radius: profile.radiusAt(threadX) };
    let ends = restingEnds();
    let duration: number;
    const ctx: StepContext = {};

    switch (step.op) {
      case "attach-thread": {
        threadX = step.at * L;
        const piece = inPlace(threadX, 6);
        pieces.push(piece);
        thread = { kind: "follow", piece: piece.id };
        duration = DURATION.attach;
        break;
      }
      case "wrap-thread": {
        const from = threadX!;
        const to = step.to * L;
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
        const to = step.to * L;
        // Dubbing squashes as it is wrapped, so neighbouring turns overlap.
        const turns = step.turns ?? Math.max(2, Math.round(Math.abs(to - from) / (l.strandRadius * 1.3)));
        const piece: WrapsPiece = {
          type: "wraps", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 1],
          path: "travel", x0: from, x1: to, width: 0, turns,
          strandRadius: l.strandRadius, base: profile, fibreLength: l.fibreLength,
        };
        const coverage = (turns * 2 * l.strandRadius) / Math.max(Math.abs(to - from), 0.01);
        profile = profile.withLayer(from, to, l.layerThickness(coverage));
        pieces.push(piece);
        // The dubbing is on the thread, so the bobbin follows it.
        thread = { kind: "follow", piece: piece.id };
        threadX = to;
        duration = Math.max(2.5, turns * DURATION.perDubbingTurn);
        break;
      }
      case "tie-in": {
        const x = threadX!;
        const l = looks.get(step.material)!;
        tiedAt.set(step.material, x);
        const radius = profile.radiusAt(x);
        const angle = deg(step.angle ?? (l.look === "yarn" ? 5 : 3));
        const spread = deg(step.spread ?? DEFAULT_SPREAD[l.look] ?? 30);
        if (step.length) {
          ctx.tipX = x - step.length * Math.cos(angle);
          ctx.bendEnd = bendEndX(hook);
        }
        if (step.length && l.look === "feather") {
          pieces.push({
            type: "feather", id: nextId++, material: step.material, look: l.look, color: l.color,
            window: [0, 0.35], x, radius, length: step.length, angle, width: step.width ?? step.length * 0.5,
          });
        } else if (step.length) {
          pieces.push({
            type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color,
            window: [0, 0.35], x, radius, length: step.length, angle, direction: "back", spread,
            bundleRadius: l.strandRadius, count: l.count,
          });
          if (l.look === "hair") {
            const b: BundlePiece = {
              type: "bundle", id: nextId++, material: step.material, look: l.look, color: l.color,
              window: [0.2, 0.45], x: x + 0.12, radius, length: BUTTS.length, angle: BUTTS.angle,
              direction: "forward", spread, bundleRadius: l.strandRadius, count: l.count,
            };
            pieces.push(b);
            butts.set(step.material, b);
          }
        } else {
          const end: FreeEndPose = {
            ...freeEnd(step.material, l), kind: "rest", x, radius,
            direction: l.look === "hackle" ? "back-up" : "back-down",
          };
          freeEnds.set(step.material, end);
          ends = restingEnds();
        }
        profile = profile.withLayer(x, x + 5 * pitch, l.tieInThickness);
        const wraps = inPlace(x, l.look === "hair" ? 8 : 5, [0.3, 1]);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.tieIn;
        break;
      }
      case "wind": {
        const l = looks.get(step.material)!;
        const from = tiedAt.get(step.material)!;
        const to = step.to * L;
        ctx.rear = to < from;
        if (!ctx.rear && palmered) {
          ctx.through = palmered;
          palmered = null;
        }
        const piece: WrapsPiece = {
          type: "wraps", id: nextId++, material: step.material, look: l.look, color: l.color, window: [0, 1],
          path: "travel", x0: from, x1: to, width: 0, turns: step.turns,
          strandRadius: l.strandRadius, base: profile, fibreLength: l.fibreLength,
        };
        pieces.push(piece);
        const coverage = (step.turns * 2 * l.strandRadius) / Math.max(Math.abs(to - from), 0.01);
        profile = profile.withLayer(from, to, l.layerThickness(coverage));
        freeEnds.delete(step.material);
        ends = [...restingEnds(), { ...freeEnd(step.material, l), kind: "follow", piece: piece.id }];
        if (ctx.rear) {
          // The tip stays at the bend, held until another material is wound over it.
          palmered = step.material;
          palmeredTips.add(step.material);
          freeEnds.set(step.material, {
            ...freeEnd(step.material, l), length: l.freeLength * 0.4, kind: "rest", x: to,
            radius: profile.radiusAt(to), direction: "back-down",
          });
        }
        duration = Math.max(2, step.turns * DURATION.perMaterialTurn);
        break;
      }
      case "tie-off": {
        const l = looks.get(step.material)!;
        const x = threadX!;
        ends = [
          ...restingEnds(),
          { ...freeEnd(step.material, l), length: 0.6, kind: "rest", x, radius: profile.radiusAt(x), direction: "out", hideAfter: 0.7 },
        ];
        profile = profile.withLayer(x, x + 5 * pitch, l.tieInThickness);
        const wraps = inPlace(x, 5);
        pieces.push(wraps);
        thread = { kind: "follow", piece: wraps.id };
        duration = DURATION.tieOff;
        break;
      }
      case "trim": {
        duration = DURATION.trim;
        const cutAt = time + duration * 0.5;
        if (palmeredTips.has(step.material)) {
          ctx.tip = true;
          palmeredTips.delete(step.material);
          const end = freeEnds.get(step.material);
          freeEnds.delete(step.material);
          ends = [...restingEnds(), ...(end && end.kind === "rest" ? [{ ...end, hideAfter: 0.5 }] : [])];
        } else {
          const b = butts.get(step.material)!;
          butts.delete(step.material);
          b.until = cutAt;
          if (step.leave) {
            pieces.push({ ...b, id: nextId++, length: step.leave, window: [0.5, 0.5001], until: undefined });
          }
        }
        break;
      }
      case "whip-finish": {
        // The head is built up in layers between the thread and the eye.
        const piece = inPlace(threadX!, 3 * step.turns, undefined, 0.97 * L);
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
