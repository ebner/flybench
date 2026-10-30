import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { fishing, fishingText } from "./fishing";

const recipe = (id: string) => {
  const r = loadRecipe(readFileSync(new URL(`../../patterns/${id}.kdl`, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(id);
  return r.recipe;
};

describe("how a fly fishes", () => {
  it("follows the type, the weight and a recipe's own say", () => {
    expect(fishing(recipe("adams"))).toEqual({ depth: "surface", motion: "drift", hang: 0, sits: "hackle" });
    expect(fishing(recipe("klinkhamer-special")).depth).toBe("film");
    expect(fishing(recipe("partridge-and-orange")).depth).toBe("below");
    // A bead takes a nymph deep.
    expect(fishing(recipe("prince-nymph")).depth).toBe("deep");
    expect(fishing(recipe("woolly-bugger"))).toEqual({ depth: "deep", motion: "swim", hang: 0 });
    // A midge pattern that is a dry fly says so.
    expect(fishing(recipe("griffiths-gnat")).depth).toBe("surface");
    // A brass tube sinks it.
    expect(fishing(recipe("willie-gunn-tube")).depth).toBe("deep");
    // Salmon flies are swung, not stripped.
    expect(fishing(recipe("stoats-tail")).motion).toBe("swing");
  });

  it("hangs emergers tail down, and nothing else", () => {
    expect(fishing(recipe("klinkhamer-special")).hang).toBeGreaterThan(0);
    // An ant lies flat in the film.
    expect(fishing(recipe("black-ant"))).toMatchObject({ depth: "film", hang: 0 });
  });

  it("says how a floating fly sits, from its type unless its recipe says", () => {
    const unsaid = (id: string) => ({ ...recipe(id), sits: undefined });
    expect(fishing(unsaid("adams")).sits).toBe("hackle");
    expect(fishing(unsaid("foam-beetle")).sits).toBe("body");
    expect(fishing(unsaid("black-ant")).sits).toBe("half");
    expect(fishing(recipe("foam-beetle")).sits).toBe("half");
    // A hanging emerger doesn't sit; sunk flies don't either.
    expect(fishing(recipe("klinkhamer-special")).sits).toBeUndefined();
    expect(fishing(recipe("woolly-bugger")).sits).toBeUndefined();
    const parachute = { ...recipe("adams"), sits: "body" as const };
    expect(fishing(parachute).sits).toBe("body");
    expect(fishingText(fishing(parachute))).toMatch(/body lying in the surface film/);
    // An emerger that sits lies level instead of hanging.
    expect(fishing({ ...recipe("klinkhamer-special"), sits: "body" })).toMatchObject({ hang: 0, sits: "body" });
  });

  it("says where and how it fishes", () => {
    expect(fishingText(fishing(recipe("adams")))).toMatch(/floats on the surface.*drifts/);
    expect(fishingText(fishing(recipe("woolly-bugger")))).toMatch(/deep.*stripped/);
    expect(fishingText(fishing(recipe("black-ant")))).toMatch(/half sunk/);
    expect(fishingText(fishing(recipe("klinkhamer-special")))).toMatch(/hatching/);
  });
});
