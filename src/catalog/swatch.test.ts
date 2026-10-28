import { describe, expect, it } from "vitest";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { simulate } from "../tying/simulate";
import { swatchRecipe } from "./swatch";

describe("material swatches", () => {
  const kinds = Object.keys(MATERIALS) as MaterialKind[];
  it.each(kinds)("%s: a valid little recipe that simulates", (kind) => {
    // Kinds without a colour of their own always have one given in recipes.
    const m = MATERIALS[kind];
    if ("defaultColor" in m) expect(() => simulate(swatchRecipe(kind, m.defaultColor))).not.toThrow();
    expect(() => simulate(swatchRecipe(kind, "red"))).not.toThrow();
  });
});
