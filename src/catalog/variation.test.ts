import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { simulate } from "../tying/simulate";
import { materialsList } from "../tying/describe";
import { boxEntry, coloursSpec, coloursText, parseBoxEntry, parseColours, recolor } from "./variation";

const recipe = (() => {
  const r = loadRecipe(readFileSync(new URL("../../patterns/red-tag.kdl", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("red-tag");
  return r.recipe;
})();
const tag = recipe.materials[0]!.id;

describe("colour variations", () => {
  it("reads only the recipe's parts, in named colours other than the pattern's", () => {
    const own = recipe.materials[0]!.color;
    expect(parseColours(`${tag}:yellow,thread:olive,nothing:red,${tag}x:blue`, recipe)).toEqual({ [tag]: "yellow", thread: "olive" });
    expect(parseColours(`${tag}:#ff0000`, recipe)).toEqual({});
    if (own) expect(parseColours(`${tag}:${own}`, recipe)).toEqual({});
    expect(parseColours("", recipe)).toEqual({});
  });

  it("writes the parts in the recipe's order", () => {
    expect(coloursSpec({ [tag]: "yellow", thread: "olive" }, recipe)).toBe(`thread:olive,${tag}:yellow`);
    expect(coloursSpec({}, recipe)).toBe("");
  });

  it("recolours the fly, its texts and its materials list", () => {
    const yellow = recolor(recipe, { [tag]: "yellow" });
    expect(yellow.materials[0]!.color).toBe("yellow");
    expect(recipe.materials[0]!.color).not.toBe("yellow");
    expect(materialsList(yellow).find((m) => m.id === tag)!.name.toLowerCase()).toContain("yellow");
    expect(simulate(yellow).steps.some((s) => s.text.toLowerCase().includes("yellow"))).toBe(true);
    expect(recolor(recipe, {})).toBe(recipe);
    // The hackle's label names it as tied; in another colour the name follows the colour.
    expect(materialsList(recolor(recipe, { hackle: "olive" })).find((m) => m.id === "hackle")!.name).toBe("Olive cock hackle");
  });

  it("carries a step's note about its own part into the new colour, and leaves other notes", () => {
    const ullsocken = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/ullsocken.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("ullsocken");
      return r.recipe;
    })();
    const blue = recolor(ullsocken, { butt: "blue", thread: "red" });
    expect(blue.steps.map((s) => s.note)).toContain("A short blue butt.");
    expect(blue.steps.map((s) => s.note)).toContain("A small red head.");
    expect(blue.steps.map((s) => s.note)).toContain("Let the fibres splay out for bulk.");
  });

  it("names the changes and round-trips fly box entries", () => {
    expect(coloursText({ thread: "blue-dun" }, recipe)).toBe("Thread blue dun");
    expect(parseBoxEntry(boxEntry("red-tag", "thread:olive"))).toEqual({ id: "red-tag", colours: "thread:olive" });
    expect(parseBoxEntry("red-tag")).toEqual({ id: "red-tag", colours: "" });
  });
});
