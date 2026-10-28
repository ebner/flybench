import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { loadNatural, type Natural } from "../recipe/natural";
import type { Recipe } from "../recipe/schema";
import { activeIn, hatchMonths, imitatedBy, matchingHookSizes, naturalLengthFor, sizeText } from "./naturals";

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
const natural = (id: string) => naturals.find((n) => n.id === id)!;

describe("naturals in the catalog", () => {
  it("every natural is imitated by a pattern, but for the ones no pattern covers yet", () => {
    // The burrowing mayfly nymph is in the hatch calendar; no pattern here imitates it directly.
    const yet = ["mayfly-nymph-burrowing"];
    for (const n of naturals) expect(imitatedBy(recipes, n.id).length > 0, n.id).toBe(!yet.includes(n.id));
  });

  it("lists the patterns naming a natural first before those naming it later", () => {
    const ids = imitatedBy(recipes, "mayfly-dun").map((r) => r.id);
    expect(ids.indexOf("parachute-adams")).toBeLessThan(ids.indexOf("grey-duster"));
    // A variant's natural counts for its family, shown as the main pattern.
    expect(imitatedBy(recipes, "caddis-larva-cased").map((r) => r.id)).toEqual(["peeping-caddis"]);
  });

  it("reads hatch months, also over the new year", () => {
    expect(hatchMonths({ region: "british-isles", from: "november", to: "february" })).toEqual([10, 11, 0, 1]);
    expect(activeIn(naturals, "british-isles", 4).map((a) => a.natural.id)).toContain("mayfly-nymph-burrowing");
    expect(activeIn(naturals, "british-isles", 0).map((a) => a.natural.id)).not.toContain("mayfly-dun");
  });

  it("matches hook sizes and fly sizes to a natural's length", () => {
    expect(matchingHookSizes(natural("mayfly-dun"))).toEqual(expect.arrayContaining([14, 16]));
    const adams = recipes.find((r) => r.id === "adams")!;
    const length = naturalLengthFor(natural("mayfly-dun"), adams);
    expect(length).toBeGreaterThan(1.5);
    expect(length).toBeLessThan(2.5);
    expect(sizeText(natural("prawn"))).toBe("4–10 cm");
  });
});
