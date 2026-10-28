import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { proportions } from "./proportions";
import { simulate } from "./simulate";

const build = (id: string) => {
  const r = loadRecipe(readFileSync(new URL(`../../patterns/${id}.kdl`, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(id);
  return simulate(r.recipe);
};

describe("proportions", () => {
  it("measures tails, wings, hackle and body, merging parts measured alike", () => {
    expect(proportions(build("adams")).map((d) => d.label)).toEqual([
      "Wings: 1.8× gape",
      "Tail brown, tail grizzly: 1.7× gape",
      "Body: 70% of the shank",
      "Hackle brown fibres, hackle grizzly fibres: 1.5× gape",
    ]);
  });

  it("measures an upright wing standing up and a tail along the shank, behind the tie-in", () => {
    const dims = proportions(build("adams"));
    expect(dims.find((d) => d.label.startsWith("Wings"))?.kind).toBe("out");
    const tail = dims.find((d) => d.label.startsWith("Tail"))!;
    expect(tail.kind === "along" && tail.x1 < tail.x0).toBe(true);
  });

  it("gives each measurement the step that ties the part, in order", () => {
    const steps = proportions(build("woolly-bugger")).map((d) => d.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
