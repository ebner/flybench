import { describe, expect, it } from "vitest";
import { checkDraft, blankFly } from "./own";
import { compile, dryFly, newPart, type PartsFly } from "./parts";
import { simulate } from "../tying/simulate";

const meta = (() => {
  const { materials: _m, steps: _s, ...rest } = blankFly("Mine");
  return rest;
})();

const problems = (fly: PartsFly) => checkDraft(compile(fly).recipe).problems.map((p) => p.message);

describe("a fly built of parts", () => {
  it("writes a valid recipe for the classic dry fly", () => {
    const fly = dryFly(meta);
    expect(problems(fly)).toEqual([]);
    const { recipe } = compile(fly);
    // Wings first, then the tail at the bend, the body, the hackle in front.
    expect(recipe.steps.filter((s) => s.op === "tie-in").map((s) => "material" in s && s.material)).toEqual(["wing", "tail", "hackle"]);
    expect(() => simulate(recipe)).not.toThrow();
  });

  it("winds a rib over a wound body and lays a hair wing back over it", () => {
    const fly: PartsFly = { meta: { ...meta, type: "dry", hook: { model: "dry-standard", size: 14 } }, parts: [] };
    const add = (...a: Parameters<typeof newPart>) => fly.parts.push(newPart(...a));
    add(fly, "body", "silk-floss", "yellow");
    add(fly, "rib", "gold-wire");
    add(fly, "hackle", "cock-hackle", "brown");
    add(fly, "wing", "elk-hair", "tan");
    fly.parts.find((p) => p.role === "wing")!.angle = 20;
    expect(problems(fly)).toEqual([]);
    const ops = compile(fly).recipe.steps.map((s) => s.op + ("material" in s ? ` ${s.material}` : ""));
    expect(ops.indexOf("wind rib")).toBeGreaterThan(ops.indexOf("tie-off body"));
    expect(ops.indexOf("tie-in wing")).toBeGreaterThan(ops.indexOf("tie-off rib"));
  });

  it("says which steps are each part's", () => {
    const { recipe, spans } = compile(dryFly(meta));
    const [a, b] = spans.get("hackle")!;
    expect(recipe.steps.slice(a, b + 1).every((s) => !("material" in s) || s.material === "hackle")).toBe(true);
  });
});
