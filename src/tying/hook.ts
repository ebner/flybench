import type { Recipe } from "../recipe/schema";

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
  /** Typical model, for the materials list. */
  example: string;
}

// Assumption: proportions in gapes estimated from common hook models (named in
// `example`): shank length, wire thickness, curvature and eye angle.
export const HOOK_MODELS: Record<Recipe["hook"]["model"], HookModel> = {
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
    shankLength: 2.3, shankCurve: 45, wireRadius: 0.045, eyeRadius: 0.17, eyeAngle: 20, pointLength: 0.75,
    example: "Partridge 15BN Klinkhamer",
  },
  "scud-curved": {
    label: "Curved scud and pupa hook",
    shankLength: 1.9, shankCurve: 75, wireRadius: 0.055, eyeRadius: 0.17, eyeAngle: 15, pointLength: 0.75,
    example: "TMC 2457",
  },
  "salmon-up-eye": {
    label: "Salmon hook, up eye",
    shankLength: 2.7, shankCurve: 0, wireRadius: 0.07, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.9,
    example: "Partridge Bartleet",
  },
  "salmon-double": {
    label: "Salmon double, up eye",
    shankLength: 2.6, shankCurve: 0, wireRadius: 0.065, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.85, points: 2,
    example: "Partridge Q / Ahrex HR428",
  },
  "salmon-treble": {
    label: "Long-shank treble, up eye",
    shankLength: 2.6, shankCurve: 0, wireRadius: 0.06, eyeRadius: 0.2, eyeAngle: -30, pointLength: 0.8, points: 3,
    example: "Esmond Drury / Ahrex HR490",
  },
  jig: {
    label: "Jig hook, 60° bent eye",
    shankLength: 1.9, shankCurve: 0, wireRadius: 0.05, eyeRadius: 0.17, eyeAngle: 0, pointLength: 0.8,
    jig: { length: 0.35, angle: 60 },
    example: "Hanak 450 / Fulling Mill Jig Force",
  },
  "saltwater-straight": {
    label: "Saltwater hook, straight eye",
    shankLength: 2.4, shankCurve: 0, wireRadius: 0.07, eyeRadius: 0.21, eyeAngle: 0, pointLength: 0.9,
    example: "Gamakatsu SC15",
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

/** Whether the fly swims hook point up (dumbbell-eyed flies, jig hooks). */
export function ridesPointUp(recipe: Recipe): boolean {
  return (recipe.rides ?? (HOOK_MODELS[recipe.hook.model].jig ? "point-up" : "point-down")) === "point-up";
}

export function gapeMm(size: number): number {
  return GAPE_MM[size] ?? 4.5;
}

/** Diameter in gapes of thread of the given size (default: the tying thread) on the recipe's hook. */
export function threadDiameter(recipe: Recipe, size: Recipe["thread"]["size"] = recipe.thread.size): number {
  return THREAD_DIAMETER_MM[size] / gapeMm(recipe.hook.size);
}
