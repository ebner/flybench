import { loadRecipe } from "../recipe/load";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";

/**
 * A material on a bare hook, the way it is used: the picture beside it on the Materials
 * page. A small recipe of its own, so it is drawn by the same renderer as the flies.
 * `color` is as the inventory has it (a named or hex colour, or "natural").
 */
export function swatchText(kind: MaterialKind, color: string): string {
  const archetype = MATERIALS[kind].archetype;
  const props = [
    color === "natural" ? "" : ` color="${color}"`,
    archetype === "hackle" ? " fibre=1.1" : "",
    archetype === "bead" || archetype === "eyes" ? " mm=3" : "",
  ].join("");
  // A bunch tied in by the middle of the shank, sticking out behind.
  const bunch = ["attach-thread at=0.55", "tie-in m length=1.4 angle=12", ...(archetype === "hair" ? ["trim m leave=0.1"] : [])];
  // Wound along the middle of the shank.
  const wound = (turns: number) => ["attach-thread at=0.2", "tie-in m", "wrap-thread to=0.8", `wind m to=0.8 turns=${turns}`, "tie-off m"];
  const steps: Record<typeof archetype, string[]> = {
    yarn: wound(7),
    herl: wound(9),
    hackle: wound(5),
    wire: wound(6),
    floss: wound(10),
    tinsel: wound(9),
    chenille: wound(7),
    fibres: bunch,
    cdc: wound(5),
    dubbing: ["attach-thread at=0.2", "dub m to=0.8"],
    hair: bunch,
    biot: bunch,
    marabou: bunch,
    flash: bunch,
    feather: bunch,
    legs: ["attach-thread at=0.5", "tie-in m length=0.8 side=across"],
    foam: ["attach-thread at=0.2", "tie-in m", "wrap-thread to=0.8", "pull-over m to=0.8"],
    bead: ["slide-bead m", "attach-thread at=0.85"],
    eyes: ["attach-thread at=0.8", "tie-in m"],
  };
  return [
    `id swatch`,
    `name "${MATERIALS[kind].name}"`,
    `type nymph`,
    `difficulty beginner`,
    `hook dry-standard size=10`,
    `thread black size="8/0"`,
    `materials {`,
    `    m ${kind}${props}`,
    `}`,
    `steps {`,
    ...[...steps[archetype], "whip-finish"].map((s) => `    ${s}`),
    `}`,
    ``,
  ].join("\n");
}

export function swatchRecipe(kind: MaterialKind, color: string): Recipe {
  const result = loadRecipe(swatchText(kind, color));
  if (!result.ok) throw new Error(`swatch for ${kind} (${color}): ${result.errors.map((e) => e.message).join("; ")}`);
  return result.recipe;
}

/** Where a swatch picture is kept: public/renders/materials/<this>.webp. */
export function swatchName(kind: MaterialKind, color: string): string {
  return `${kind}--${color.replace(/^#/, "")}`;
}
