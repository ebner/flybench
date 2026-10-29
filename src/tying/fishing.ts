import { MATERIALS } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";
import { lang, type Lang } from "../i18n/lang";
import { heavyTube } from "./hook";

/** Where a fly fishes: on the surface, in the film, just under it, or deep. */
export type Depth = "surface" | "film" | "below" | "deep";

export interface Fishing {
  depth: Depth;
  /** Drifts with the current, is stripped and swims, or is swung across the current on a tight line. */
  motion: "drift" | "swim" | "swing";
  /** Degrees it hangs tail down from the front of its shank (an emerger in the film). */
  hang: number;
}

/**
 * How a fly is fished, for the water view: from its type, then its materials (a bead or
 * weighting takes a nymph deep), unless the recipe says so with `fishes`.
 */
// Assumption: dry flies and terrestrials float, emergers hang in the film, wet flies and
// unweighted nymphs fish just under the surface, weighted ones (or on a heavy tube) deep; streamers and saltwater
// flies are stripped, salmon flies swung.
export function fishing(recipe: Recipe): Fishing {
  const motion = recipe.type === "salmon" ? "swing" : recipe.type === "streamer" || recipe.type === "saltwater" ? "swim" : "drift";
  const depth = recipe.fishes ?? depthFor(recipe);
  // Assumption: an emerger hangs about 35° tail down from the film; other flies lie level.
  return { depth, motion, hang: depth === "film" && recipe.type === "emerger" ? 35 : 0 };
}

function depthFor(recipe: Recipe): Depth {
  const weighted =
    recipe.steps.some((s) => s.op === "weight" || s.op === "slide-bead") ||
    recipe.materials.some((m) => MATERIALS[m.kind].archetype === "eyes" && m.kind !== "mono-eyes") ||
    heavyTube(recipe.hook);
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
  const w = FISHING_WORDS[lang()];
  const where = f.depth === "film" ? (f.hang > 0 ? w.filmHangs : w.filmLow) : w[f.depth];
  const how =
    f.motion === "swim" ? w.swim : f.motion === "swing" ? w.swing : f.depth === "surface" || f.depth === "film" ? w.driftTop : w.driftUnder;
  return `${where} ${how}`;
}

const FISHING_WORDS: Record<Lang, Record<"surface" | "filmHangs" | "filmLow" | "below" | "deep" | "swim" | "swing" | "driftTop" | "driftUnder", string>> = {
  en: {
    surface: "It floats on the surface, the bend of the hook hanging through the film. From below, a trout sees the dents it makes in the film before the fly itself comes into view.",
    filmHangs: "It hangs in the surface film like an insect hatching: its body down in the water, its wing or post above it.",
    filmLow: "It floats low, half sunk in the surface film.",
    below: "It fishes just under the surface, where its soft fibres move with the water.",
    deep: "It sinks and fishes deep, near the bottom.",
    swim: "It is stripped back in pulls: it darts forward on each one and sinks back a little in the pause after it.",
    swing: "It is swung across the current on a tight line, holding against the flow with its fibres working in it.",
    driftTop: "It drifts with the current, riding the ripples.",
    driftUnder: "It drifts with the current, turning slowly as it goes.",
  },
  sv: {
    surface: "Den flyter på ytan med krokböjen hängande genom ytfilmen. Underifrån ser öringen intrycken den gör i ytfilmen innan själva flugan syns.",
    filmHangs: "Den hänger i ytfilmen som en insekt som kläcks: kroppen nere i vattnet, vingen eller posten ovanför.",
    filmLow: "Den flyter lågt, halvt nedsjunken i ytfilmen.",
    below: "Den fiskar strax under ytan, där de mjuka fibrerna rör sig med vattnet.",
    deep: "Den sjunker och fiskar djupt, nära botten.",
    swim: "Den strippas in i ryck: den rusar framåt i varje ryck och sjunker tillbaka lite i pausen efter.",
    swing: "Den svepas tvärs över strömmen på sträckt lina och håller emot strömmen medan fibrerna arbetar.",
    driftTop: "Den driver med strömmen och rider på krusningarna.",
    driftUnder: "Den driver med strömmen och vänder sig sakta medan den driver.",
  },
  de: {
    surface: "Sie schwimmt auf der Oberfläche, der Hakenbogen hängt durch den Oberflächenfilm. Von unten sieht die Forelle die Dellen, die sie in den Film drückt, bevor die Fliege selbst ins Blickfeld kommt.",
    filmHangs: "Sie hängt im Oberflächenfilm wie ein schlüpfendes Insekt: der Körper unten im Wasser, Flügel oder Post darüber.",
    filmLow: "Sie liegt tief, halb eingesunken im Oberflächenfilm.",
    below: "Sie fischt knapp unter der Oberfläche, wo sich ihre weichen Fibern mit dem Wasser bewegen.",
    deep: "Sie sinkt und fischt tief, nahe am Grund.",
    swim: "Sie wird in Zügen eingestrippt: bei jedem Zug schießt sie vor, in der Pause danach sinkt sie etwas ab.",
    swing: "Sie wird an gestraffter Schnur quer durch die Strömung geschwungen, steht gegen die Strömung, und ihre Fibern arbeiten darin.",
    driftTop: "Sie treibt mit der Strömung und reitet auf den kleinen Wellen.",
    driftUnder: "Sie treibt mit der Strömung und dreht sich dabei langsam.",
  },
};
