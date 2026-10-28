import { MATERIALS } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";

/** Where a fly fishes: on the surface, in the film, just under it, or deep. */
export type Depth = "surface" | "film" | "below" | "deep";

export interface Fishing {
  depth: Depth;
  /** Drifts with the current, or is stripped and swims. */
  motion: "drift" | "swim";
  /** Degrees it hangs tail down from the front of its shank (an emerger in the film). */
  hang: number;
}

/**
 * How a fly is fished, for the water view: from its type, then its materials (a bead or
 * weighting takes a nymph deep), unless the recipe says so with `fishes`.
 */
// Assumption: dry flies and terrestrials float, emergers hang in the film, wet flies and
// unweighted nymphs fish just under the surface, weighted ones deep; streamers, salmon and
// saltwater flies are swum rather than drifted.
export function fishing(recipe: Recipe): Fishing {
  const motion = recipe.type === "streamer" || recipe.type === "salmon" || recipe.type === "saltwater" ? "swim" : "drift";
  const depth = recipe.fishes ?? depthFor(recipe);
  // Assumption: an emerger hangs about 35° tail down from the film; other flies lie level.
  return { depth, motion, hang: depth === "film" && recipe.type === "emerger" ? 35 : 0 };
}

function depthFor(recipe: Recipe): Depth {
  const weighted = recipe.steps.some((s) => s.op === "weight" || s.op === "slide-bead") ||
    recipe.materials.some((m) => MATERIALS[m.kind].archetype === "eyes" && m.kind !== "mono-eyes");
  switch (recipe.type) {
    case "dry":
    case "terrestrial":
      return "surface";
    case "emerger":
      return "film";
    default:
      return weighted ? "deep" : "below";
  }
}

/** Materials (archetypes) that hold air under water: CDC, dubbing, and soft fluffy fibres. */
export const HOLDS_AIR = new Set(["cdc", "dubbing", "marabou"]);

/** Soft fibres that lie closer to the body when wet; a swum fly's breathe with each strip. */
// Assumption: hackle, hair, CDC and marabou clump to about 85% of their dry spread under water.
export const CLUMPS = new Set(["cdc", "hackle", "hair", "marabou"]);
export const WET_SPREAD = 0.85;

/** What the water view shows, in words: where the fly fishes and how it moves. */
// Assumption: the usual way each kind of fly is fished, not the only one.
export function fishingText(f: Fishing): string {
  const where = {
    surface: "It rides on the surface, held up by its hackle and tail, with the bend of the hook through the film. From below, a trout sees the dents it makes in the film before the fly itself comes into view.",
    film: "It hangs in the surface film like an insect hatching: its body just under the surface, its wing or post above it.",
    below: "It fishes just under the surface, where its soft fibres move with the water.",
    deep: "Weighted, it sinks and fishes deep, near the bottom.",
  }[f.depth];
  const how =
    f.motion === "swim"
      ? "It is stripped back in pulls: it darts forward on each one and sinks back a little in the pause after it."
      : f.depth === "surface" || f.depth === "film"
        ? "It drifts with the current, riding the ripples."
        : "It drifts with the current, turning slowly as it goes.";
  return `${where} ${how}`;
}
