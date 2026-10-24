import type { Recipe } from "../recipe/schema";

/**
 * Hook geometry in gape units (world unit = 1 gape). The shank runs along +X
 * from x = 0 (start of the bend) to x = shankLength (where the eye starts);
 * the bend hangs below it in the XY plane.
 */
export interface HookModel {
  label: string;
  shankLength: number;
  wireRadius: number;
  /** Outer radius of the eye ring. */
  eyeRadius: number;
  /** Down-eye angle in degrees. */
  eyeAngle: number;
  /** Length of the point section after the bend. */
  pointLength: number;
}

// Assumption: a standard dry-fly hook (TMC 100 style) has a shank about twice
// the gape, wire about 0.09 gape, and a 30° down eye.
export const HOOK_MODELS: Record<Recipe["hook"]["model"], HookModel> = {
  "dry-standard": {
    label: "Dry fly hook, standard shank",
    shankLength: 2.0,
    wireRadius: 0.045,
    eyeRadius: 0.17,
    eyeAngle: 30,
    pointLength: 0.75,
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

/** x of the rearmost point of the bend (outside of the wire), in gapes. */
export function bendEndX(hook: HookModel): number {
  const R = (1 + 2 * hook.wireRadius) / 2;
  return -(R + hook.wireRadius);
}

export function gapeMm(size: number): number {
  return GAPE_MM[size] ?? 4.5;
}

/** Diameter in gapes of thread of the given size (default: the tying thread) on the recipe's hook. */
export function threadDiameter(recipe: Recipe, size: Recipe["thread"]["size"] = recipe.thread.size): number {
  return THREAD_DIAMETER_MM[size] / gapeMm(recipe.hook.size);
}
