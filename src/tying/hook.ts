import { isTube, type HookModelId, type Recipe, type TubeModelId } from "../recipe/schema";

/**
 * Hook geometry in gape units (world unit = 1 gape). See shank.ts for how the shank
 * (straight or curved) and the bend are laid out.
 */
export interface HookModel {
  label: string;
  /** Length of the shank along its curve, from the start of the bend to the eye. */
  shankLength: number;
  /** Total curvature of the shank in degrees; 0 for a straight shank. */
  shankCurve: number;
  wireRadius: number;
  /** Outer radius of the eye ring. */
  eyeRadius: number;
  /** Eye angle in degrees: positive turns down, negative turns up, 0 is straight. */
  eyeAngle: number;
  /** Length of the point section after the bend. */
  pointLength: number;
  /** Bends and points on the one shank: 2 for a double, 3 for a treble. Default 1. */
  points?: 2 | 3;
  /** Jig hooks: the eye sits on a section bent up from the end of the shank. */
  jig?: { length: number; angle: number };
  /**
   * Tubes and Waddingtons: the dressing goes on a tube or wire shank, and a treble hook sits
   * behind it, in a silicone sleeve or through the Waddington's rear loop. `trebleScale` is the
   * treble's gape in this model's units.
   */
  tube?: { kind: "tube" | "waddington"; color: string; trebleScale: number };
  /** Typical model, for the materials list. */
  example: string;
  /**
   * The wire's finish, as the example hook is sold; bronze where not given. From the makers'
   * and dealers' descriptions: Partridge 15BN Klinkhamer "black nickel" (adh-fishing.com);
   * Partridge Bartleet CS10 "black" (acc.umu.se/~widmark/lwhookdl.html); Ahrex HR428 "black
   * nickel" and HR490B "black" (ahrexhooks.com); Hanak H 450 BL "black nickel"
   * (adh-fishing.com); Gamakatsu SC15 "tin plated" (driftoutfitters.com). The Tiemco hooks are
   * sold as bronze (the TMC 3769 not checked).
   */
  finish?: "black" | "black-nickel" | "tin";
  /**
   * The gape in mm by hook size, for a model whose gape is wider (or narrower) than a standard
   * hook's of the same size; other sizes scale with the nearest one given.
   */
  gapeMm?: Partial<Record<number, number>>;
}

// Assumption: proportions in gapes estimated from common hook models (named in
// `example`): shank length, wire thickness, curvature and eye angle.
export const HOOK_MODELS: Record<HookModelId, HookModel> = {
  "dry-standard": {
    label: "Dry fly hook, standard shank",
    shankLength: 2.0, shankCurve: 0, wireRadius: 0.045, eyeRadius: 0.17, eyeAngle: 30, pointLength: 0.75,
    example: "TMC 100",
  },
  "wet-standard": {
    label: "Wet fly hook, standard shank, heavy wire",
    shankLength: 2.1, shankCurve: 0, wireRadius: 0.06, eyeRadius: 0.18, eyeAngle: 30, pointLength: 0.8,
    example: "TMC 3769",
  },
  "nymph-2xl": {
    label: "Nymph hook, 2x long",
    shankLength: 2.8, shankCurve: 0, wireRadius: 0.055, eyeRadius: 0.18, eyeAngle: 30, pointLength: 0.8,
    example: "TMC 5262",
  },
  "dry-3xl-curved": {
    label: "Dry fly hook, 3x long, curved",
    shankLength: 3.0, shankCurve: 25, wireRadius: 0.05, eyeRadius: 0.18, eyeAngle: 0, pointLength: 0.8,
    example: "TMC 200R",
  },
  "streamer-4xl": {
    label: "Streamer hook, 4x long",
    shankLength: 4.0, shankCurve: 0, wireRadius: 0.065, eyeRadius: 0.2, eyeAngle: 20, pointLength: 0.85,
    example: "TMC 9395",
  },
  "emerger-curved": {
    label: "Curved emerger hook",
    shankLength: 2.3, shankCurve: 45, wireRadius: 0.045, eyeRadius: 0.17, eyeAngle: 20, pointLength: 0.6,
    example: "Partridge 15BN Klinkhamer", finish: "black-nickel",
  },
  "scud-curved": {
    label: "Curved scud and pupa hook",
    shankLength: 1.9, shankCurve: 75, wireRadius: 0.055, eyeRadius: 0.17, eyeAngle: 15, pointLength: 0.5,
    example: "TMC 2457",
  },
  "salmon-up-eye": {
    label: "Salmon hook, up eye",
    shankLength: 2.7, shankCurve: 0, wireRadius: 0.07, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.9,
    example: "Partridge Bartleet", finish: "black",
  },
  "salmon-double": {
    label: "Salmon double, up eye",
    shankLength: 2.6, shankCurve: 0, wireRadius: 0.065, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.85, points: 2,
    example: "Partridge Q / Ahrex HR428", finish: "black-nickel",
  },
  "salmon-treble": {
    label: "Long-shank treble, up eye",
    shankLength: 2.6, shankCurve: 0, wireRadius: 0.06, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.8, points: 3,
    example: "Esmond Drury / Ahrex HR490", finish: "black",
  },
  jig: {
    label: "Jig hook, 60° bent eye",
    shankLength: 1.9, shankCurve: 0, wireRadius: 0.05, eyeRadius: 0.17, eyeAngle: 0, pointLength: 0.8,
    jig: { length: 0.35, angle: 60 },
    example: "Hanak 450 / Fulling Mill Jig Force", finish: "black-nickel",
  },
  "saltwater-straight": {
    label: "Saltwater hook, straight eye",
    shankLength: 2.4, shankCurve: 0, wireRadius: 0.07, eyeRadius: 0.21, eyeAngle: 0, pointLength: 0.9,
    example: "Gamakatsu SC15", finish: "tin",
  },
  // From flyhooks.org's measurements of the TMC 8089 (#10: length 28.57 mm, height 11.88 mm,
  // throat 10.1 mm, eye 2.62 mm, wire 0.74 mm; #6: 36.06, 14.86, 11.74, 3.1 and 0.85 mm) and
  // Tiemco's outline of it: the gape is the height less two wires, 10.4 mm on a #10 and 13.2 mm on
  // a #6; the shank is set so the hook is as long overall (2.75 gapes), the point so the throat is.
  "bass-bug": {
    label: "Bass bug hook, wide gape, straight eye",
    shankLength: 1.95, shankCurve: 0, wireRadius: 0.036, eyeRadius: 0.13, eyeAngle: 0, pointLength: 0.25,
    example: "TMC 8089",
    // Assumption: #8 between the two measured sizes, #12 and #2 carried on from them.
    gapeMm: { 2: 16.9, 6: 13.2, 8: 11.8, 10: 10.4, 12: 9.2 },
  },
};

// Assumption: approximate gape in mm per hook size for standard dry-fly hooks.
// Only used to convert real-world thread thickness into gape units.
const GAPE_MM: Record<number, number> = {
  2: 12.5, 4: 10.2, 6: 8.6, 8: 7.2, 10: 6.1, 12: 5.2,
  14: 4.5, 16: 3.9, 18: 3.3, 20: 2.8, 22: 2.4, 24: 2.1,
};

// Assumption: approximate thread diameters in mm.
const THREAD_DIAMETER_MM: Record<Recipe["thread"]["size"], number> = {
  "3/0": 0.2, "6/0": 0.13, "8/0": 0.1, "10/0": 0.08, "12/0": 0.065, "14/0": 0.055,
};

/**
 * Tubes have no gape, so their unit is four times their outer diameter, about the gape of a
 * hook of the same size. A Waddington's twisted shank is taken as 2 mm wide.
 */
// Assumption: typical outer diameters in mm, liner included for plastic tubes; copper and brass
// tubes are the heavy ones, which sink a fly like weighting.
const TUBES: Record<TubeModelId, { label: string; diameter: number; color: string; kind: "tube" | "waddington"; heavy?: boolean }> = {
  "tube-plastic": { label: "Plastic tube", diameter: 3, color: "#2a2a2a", kind: "tube" },
  "tube-aluminium": { label: "Aluminium tube", diameter: 3.5, color: "#c9ccd1", kind: "tube" },
  "tube-copper": { label: "Copper tube", diameter: 3.5, color: "#b87333", kind: "tube", heavy: true },
  "tube-brass": { label: "Brass tube", diameter: 3.5, color: "#c9a23a", kind: "tube", heavy: true },
  "tube-needle": { label: "Needle tube", diameter: 1.8, color: "#c9ccd1", kind: "tube" },
  waddington: { label: "Waddington shank", diameter: 2, color: "#3a2e22", kind: "waddington" },
};

const DEFAULT_TREBLE = 12;

/** A hook model's or tube's English name on its own, without a length. */
export function modelLabel(model: HookModelId | TubeModelId): string {
  return isTube(model) ? TUBES[model].label : HOOK_MODELS[model].label;
}

/** A heavy (copper or brass) tube, which sinks the fly tied on it. */
export function heavyTube(hook: Recipe["hook"]): boolean {
  return isTube(hook.model) && TUBES[hook.model].heavy === true;
}

/** Millimetres in one unit (one gape) of the recipe's hook or tube. */
export function unitMm(hook: Recipe["hook"]): number {
  return isTube(hook.model) ? 4 * TUBES[hook.model].diameter : modelGapeMm(hook.model, hook.size ?? 12);
}

/** A hook model's gape in mm at a size: a standard hook's, or the model's own (a wide-gape hook's). */
export function modelGapeMm(model: HookModelId, size: number): number {
  const own = HOOK_MODELS[model].gapeMm;
  if (!own) return gapeMm(size);
  const given = own[size];
  if (given !== undefined) return given;
  // The nearest size given, and the standard hooks' ratio between the two sizes.
  const nearest = Object.keys(own).map(Number).sort((a, b) => Math.abs(a - size) - Math.abs(b - size))[0]!;
  return own[nearest]! * (gapeMm(size) / gapeMm(nearest));
}

/** The geometry the fly is tied on: a hook model, or a tube or Waddington built to its length. */
export function hookModel(hook: Recipe["hook"]): HookModel {
  if (!isTube(hook.model)) return HOOK_MODELS[hook.model];
  const tube = TUBES[hook.model];
  const unit = unitMm(hook);
  const length = hook.length ?? 25;
  return {
    label: `${tube.label}, ${length} mm`,
    shankLength: length / unit,
    shankCurve: 0,
    // The outer radius, in units of four diameters, is always an eighth.
    wireRadius: tube.diameter / 2 / unit,
    eyeRadius: tube.kind === "waddington" ? 0.17 : 0,
    eyeAngle: tube.kind === "waddington" ? -30 : 0,
    pointLength: 0,
    tube: { kind: tube.kind, color: tube.color, trebleScale: gapeMm(hook.treble ?? DEFAULT_TREBLE) / unit },
    example: tube.kind === "waddington" ? "Waddington shank" : "Pro Tube, Eumer, Frödin",
  };
}

/** The treble that goes behind a tube or Waddington, for the materials list. */
export function trebleSize(hook: Recipe["hook"]): number | null {
  return isTube(hook.model) ? (hook.treble ?? DEFAULT_TREBLE) : null;
}

/** Whether the fly swims hook point up (dumbbell-eyed flies, jig hooks). */
export function ridesPointUp(recipe: Recipe): boolean {
  return (recipe.rides ?? (hookModel(recipe.hook).jig ? "point-up" : "point-down")) === "point-up";
}

export function gapeMm(size: number): number {
  return GAPE_MM[size] ?? 4.5;
}

/** Diameter in gapes of thread of the given size (default: the tying thread) on the recipe's hook. */
export function threadDiameter(recipe: Recipe, size: Recipe["thread"]["size"] = recipe.thread.size): number {
  return THREAD_DIAMETER_MM[size] / unitMm(recipe.hook);
}
