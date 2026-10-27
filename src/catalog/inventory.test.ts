import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { catalogNeeds, coverage, inventoryKey, match, missingKinds, needs } from "./inventory";

const recipe = (() => {
  const r = loadRecipe(`
id t
name "T"
type dry
difficulty beginner
hook dry-standard size=14
thread black size="8/0"
materials {
    tag wool color=red
    body peacock-herl
    hackle cock-hackle color=brown fibre=1
}
steps {
    attach-thread at=0.8
    whip-finish
}
`);
  if (!r.ok) throw new Error("fixture");
  return r.recipe;
})();

describe("inventory", () => {
  it("lists what a recipe needs, with default colours", () => {
    expect(needs(recipe).map(inventoryKey)).toEqual(["wool:red", "peacock-herl:#26341a", "cock-hackle:brown"]);
  });

  it("matches exactly, as a substitute in another colour, or not at all", () => {
    const owned = new Set(["wool:red", "cock-hackle:grizzly"]);
    expect(match({ kind: "wool", color: "red" }, owned)).toBe("have");
    expect(match({ kind: "cock-hackle", color: "brown" }, owned)).toBe("substitute");
    expect(match({ kind: "peacock-herl", color: "#26341a" }, owned)).toBe("missing");
  });

  it("reports what is missing and what is substituted", () => {
    const c = coverage(recipe, new Set(["wool:red", "cock-hackle:grizzly"]));
    expect(c.missing.map(inventoryKey)).toEqual(["peacock-herl:#26341a"]);
    expect(c.substitutes.map(inventoryKey)).toEqual(["cock-hackle:brown"]);
  });

  it("counts a kind missing in two colours as one material to buy", () => {
    const two = loadRecipe(`id u
name "U"
type streamer
difficulty beginner
hook streamer-4xl size=8
thread black size="8/0"
materials {
    yellow bucktail color=yellow
    red bucktail color=red
}
steps {
    attach-thread at=0.8
    whip-finish
}
`);
    if (!two.ok) throw new Error("fixture");
    const c = coverage(two.recipe, new Set());
    expect(c.missing).toHaveLength(2);
    expect(missingKinds(c)).toBe(1);
  });

  it("collects the catalog's materials by kind", () => {
    expect(catalogNeeds([recipe]).get("wool")).toEqual(["red"]);
  });
});
