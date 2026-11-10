import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "./load";
import { loadNatural } from "./natural";

// The app gets its recipes as JSON made at build time (scripts/catalog-plugin.ts): nothing
// of a loaded recipe may be lost on the way.
describe("recipes as data", () => {
  const dir = (name: string) => new URL(`../../${name}/`, import.meta.url);
  const files = (name: string) => readdirSync(dir(name)).filter((f) => f.endsWith(".kdl"));
  it("patterns survive JSON unchanged", () => {
    for (const f of files("patterns")) {
      const result = loadRecipe(readFileSync(new URL(f, dir("patterns")), "utf8"));
      if (!result.ok) throw new Error(f);
      expect(JSON.parse(JSON.stringify(result.recipe)), f).toStrictEqual(result.recipe);
    }
  });
  it("naturals survive JSON unchanged", () => {
    for (const f of files("naturals")) {
      const result = loadNatural(readFileSync(new URL(f, dir("naturals")), "utf8"));
      if (!result.ok) throw new Error(f);
      expect(JSON.parse(JSON.stringify(result.natural)), f).toStrictEqual(result.natural);
    }
  });
});
