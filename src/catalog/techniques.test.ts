import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { learningPath, patternTechniques, stepTechnique, technique, TECHNIQUES, techniqueExample } from "./techniques";

const dir = new URL("../../patterns/", import.meta.url);
const recipes: Recipe[] = readdirSync(dir)
  .filter((f) => f.endsWith(".kdl"))
  .map((f) => {
    const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
    if (!r.ok) throw new Error(f);
    return r.recipe;
  });
const byId = (id: string) => recipes.find((r) => r.id === id)!;

describe("techniques", () => {
  it("have unique ids and text for every field", () => {
    expect(new Set(TECHNIQUES.map((t) => t.id)).size).toBe(TECHNIQUES.length);
    for (const t of TECHNIQUES) {
      expect(t.summary.length).toBeGreaterThan(10);
      expect(t.how.length).toBeGreaterThan(40);
    }
  });

  it("are recognised from recipe steps", () => {
    const ehc = byId("elk-hair-caddis");
    const at = (op: string, material?: string) =>
      stepTechnique(ehc, ehc.steps.findIndex((s) => s.op === op && (!material || ("material" in s && s.material === material))));
    expect(at("dub")).toBe("dubbing");
    expect(at("wind", "hackle")).toBe("palmering");
    expect(at("wind", "rib")).toBe("ribbing");
    expect(at("tie-in", "wing")).toBe("hair-wing");
    expect(at("whip-finish")).toBe("whip-finish");
  });

  it("recognise a hackle collar and a herl body", () => {
    expect(patternTechniques(byId("red-tag"))).toEqual(
      expect.arrayContaining(["attach-thread", "thread-base", "tail", "herl-body", "hackle-collar", "whip-finish"]),
    );
  });

  it("every technique a pattern uses exists", () => {
    for (const r of recipes) for (const t of patternTechniques(r)) expect(technique(t), `${r.id}: ${t}`).toBeDefined();
  });

  it("finds an example step for techniques in the catalog", () => {
    const ex = techniqueExample(recipes, "palmering")!;
    expect(stepTechnique(ex.recipe, ex.step)).toBe("palmering");
  });
});

describe("learning path", () => {
  const path = learningPath(recipes);

  it("covers every technique used in the catalog, each once", () => {
    const used = new Set(recipes.filter((r) => !r.variantOf).flatMap(patternTechniques));
    const taught = path.flatMap((s) => s.learns);
    expect(new Set(taught)).toEqual(used);
    expect(taught.length).toBe(used.size);
  });

  it("starts with a beginner pattern and never repeats a pattern", () => {
    expect(path[0]!.recipe.difficulty).toBe("beginner");
    expect(new Set(path.map((s) => s.recipe.id)).size).toBe(path.length);
  });
});
