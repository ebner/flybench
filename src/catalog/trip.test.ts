import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { loadNatural, type Natural } from "../recipe/natural";
import type { Recipe } from "../recipe/schema";
import { sizesText, suggestBox, type Trip } from "./trip";

const files = (dir: string) =>
  readdirSync(new URL(`../../${dir}/`, import.meta.url))
    .filter((f) => f.endsWith(".kdl"))
    .map((f) => readFileSync(new URL(`../../${dir}/${f}`, import.meta.url), "utf8"));
const recipes: Recipe[] = files("patterns").flatMap((t) => {
  const r = loadRecipe(t);
  return r.ok ? [r.recipe] : [];
});
const naturals: Natural[] = files("naturals").flatMap((t) => {
  const r = loadNatural(t);
  return r.ok ? [r.natural] : [];
});
const ids = (trip: Trip) => suggestBox(recipes, naturals, trip).map((s) => s.recipe.id);

describe("a fly box for a trip", () => {
  it("puts flies for what hatches first, sized to the naturals", () => {
    const june = suggestBox(recipes, naturals, { region: "southern-sweden", month: 5, water: "river", species: "trout" });
    expect(june.length).toBeGreaterThan(5);
    expect(june[0]!.matches.length).toBeGreaterThan(0);
    // Only main patterns, for trout, and no saltwater-only fly.
    for (const s of june) {
      expect(s.recipe.variantOf).toBeUndefined();
      expect(s.recipe.species).toContain("trout");
    }
    expect(june.map((s) => s.recipe.id)).not.toContain("pattegrisen");
    const withHatch = june.filter((s) => s.matches.length > 0);
    for (const s of withHatch) expect(s.sizes.length).toBeGreaterThan(0);
  });

  it("spreads the box over the naturals about", () => {
    const top = suggestBox(recipes, naturals, { region: "southern-sweden", month: 5, water: "river", species: "trout" }).slice(0, 12);
    const mains = top.map((s) => s.matches[0]?.id ?? "none");
    // No natural takes more than three of the twelve places.
    for (const m of new Set(mains)) expect(mains.filter((x) => x === m).length).toBeLessThanOrEqual(3);
    expect(new Set(mains).size).toBeGreaterThanOrEqual(5);
  });

  it("keeps salmon flies to rivers and saltwater flies to the coast", () => {
    expect(ids({ region: "british-isles", month: 6, water: "river", species: "salmon" })).toContain("stoats-tail");
    expect(ids({ region: "british-isles", month: 6, water: "lake", species: "salmon" })).not.toContain("stoats-tail");
    const coast = ids({ region: "southern-sweden", month: 3, water: "coast", species: "sea-trout" });
    expect(coast).toContain("pattegrisen");
    expect(coast).not.toContain("adams");
    // A Clouser is tied for trout too, so it fishes a river for trout.
    expect(ids({ region: "central-europe", month: 7, water: "river", species: "trout" })).toContain("clouser-minnow");
  });

  it("leaves out flies out of season with nothing they imitate about", () => {
    const january = ids({ region: "northern-scandinavia", month: 0, water: "river", species: "trout" });
    expect(january).not.toContain("elk-hair-caddis");
  });

  it("writes sizes as a range", () => {
    expect(sizesText([16, 12, 14])).toBe("12–16");
    expect(sizesText([14])).toBe("14");
    expect(sizesText([])).toBe("");
  });
});
