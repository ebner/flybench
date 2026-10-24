import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { CatalogSearch, catalogEntries, filtersFromQuery, filtersToQuery } from "./search";

const dir = new URL("../../patterns/", import.meta.url);
const recipes: Recipe[] = readdirSync(dir)
  .filter((f) => f.endsWith(".kdl"))
  .map((f) => {
    const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
    if (!r.ok) throw new Error(f);
    return r.recipe;
  });
const search = new CatalogSearch(catalogEntries(recipes));
const ids = (q: Parameters<CatalogSearch["search"]>[0]) => search.search(q).map((e) => e.recipe.id);

describe("catalog search", () => {
  it("lists main patterns with their variants", () => {
    const ehc = search.entries.find((e) => e.recipe.id === "elk-hair-caddis")!;
    expect(ehc.variants.map((v) => v.id)).toEqual(["elk-hair-caddis-troth"]);
    expect(ids({})).not.toContain("elk-hair-caddis-troth");
  });

  // The catalog grows, so these check membership rather than exact result lists.
  it("finds by name, alias and typo", () => {
    expect(ids({ q: "elk hair" })).toContain("elk-hair-caddis");
    expect(ids({ q: "worcester" })).toContain("red-tag");
    expect(ids({ q: "europa" })).toContain("europea-12");
    expect(ids({ q: "cadis" })).toContain("elk-hair-caddis");
    expect(ids({ q: "worcester" })).not.toContain("elk-hair-caddis");
  });

  it("finds by material, including variants' materials", () => {
    expect(ids({ q: "peacock" })).toContain("red-tag");
    expect(ids({ q: "peacock" })).not.toContain("elk-hair-caddis");
    expect(ids({ materials: ["copper-wire"] })).toContain("elk-hair-caddis");
    expect(ids({ materials: ["copper-wire"] })).not.toContain("europea-12");
    const both = ids({ materials: ["hares-ear-dubbing", "mallard-breast"] });
    expect(both).toContain("europea-12");
    expect(both).not.toContain("red-tag");
  });

  it("filters by facets", () => {
    expect(ids({ imitates: "caddis" })).toEqual(expect.arrayContaining(["elk-hair-caddis", "europea-12"]));
    expect(ids({ imitates: "caddis" })).not.toContain("red-tag");
    expect(ids({ difficulty: "beginner" })).toContain("red-tag");
    expect(ids({ difficulty: "beginner" })).not.toContain("elk-hair-caddis");
    expect(ids({ month: "november" })).toContain("red-tag");
    expect(ids({ month: "november" })).not.toContain("elk-hair-caddis");
    expect(ids({ type: "nymph" })).not.toContain("red-tag");
  });

  it("counts what each facet value would leave", () => {
    const counts = search.facetCounts("imitates", ["caddis", "attractor"], { q: "EHC" });
    expect(counts.get("caddis")).toBe(1);
    expect(counts.get("attractor")).toBe(0);
  });

  it("round-trips filters through the URL", () => {
    const f = { q: "elk hair", type: "dry" as const, materials: ["elk-hair" as const, "gold-wire" as const] };
    expect(filtersFromQuery(filtersToQuery(f))).toEqual(f);
    expect(filtersFromQuery("materials=elk-hair,unicorn")).toEqual({ materials: ["elk-hair"] });
  });
});
