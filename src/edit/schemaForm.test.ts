import { describe, expect, it } from "vitest";
import { PATTERN_SECTIONS } from "../recipe/kdl";
import { loadNatural, NATURAL_SECTIONS, NaturalSchema } from "../recipe/natural";
import { RecipeSchema } from "../recipe/schema";
import { ARG, editKdl, NAME } from "./kdlEdit";
import { formSections, newItemText } from "./schemaForm";

describe("the studio's form, from the schemas", () => {
  const natural = formSections(NATURAL_SECTIONS, NaturalSchema);
  const pattern = formSections(PATTERN_SECTIONS, RecipeSchema);

  it("describes a natural's values with their ranges and choices", () => {
    const size = natural.find((s) => s.node === "size")!;
    expect(size.fields.map((f) => f.key)).toEqual(["min", "max"]);
    const body = natural.find((s) => s.node === "body")!;
    const radius = body.items![0]!.fields.find((f) => f.key === "radius")!;
    expect(radius).toMatchObject({ type: "number", max: 0.5 });
    expect(body.items![0]!.fields.find((f) => f.key === "section")!.kdl).toBe(NAME);
    expect(body.items![0]!.fields.find((f) => f.key === "color")!.type).toBe("color");
    const parts = natural.find((s) => s.node === "parts")!;
    const legs = parts.items!.find((i) => i.name === "legs")!;
    expect(legs.fields.find((f) => f.key === "pose")!.options).toContain("jumping");
    expect(legs.fields.find((f) => f.key === "tarsi")).toMatchObject({ type: "integer", min: 1, max: 5, default: 3 });
    expect(natural.find((s) => s.node === "group")!.fields[0]).toMatchObject({ kdl: ARG, type: "enum" });
  });

  it("describes a pattern's steps by their op and materials with their kind as the argument", () => {
    const steps = pattern.find((s) => s.node === "steps")!;
    expect(steps.items!.map((i) => i.name)).toContain("wind");
    expect(steps.items!.find((i) => i.name === "wind")!.fields.find((f) => f.key === "material")!.kdl).toBe(ARG);
    const materials = pattern.find((s) => s.node === "materials")!;
    expect(materials.items![0]!.fields.find((f) => f.key === "kind")).toMatchObject({ kdl: ARG, type: "enum" });
    expect(pattern.find((s) => s.node === "variant-of")!.key).toBe("variantOf");
  });

  it("starts a new item valid as it is", () => {
    const parts = natural.find((s) => s.node === "parts")!;
    const text = `id test-dun
name "Test"
group mayfly
stage dun
description "x"
size min=5 max=11
rides on-surface
body {
    abdomen length=1 radius=0.05 color=olive
}
sources {
    "Wikipedia" url="https://en.wikipedia.org/wiki/Mayfly"
}
`;
    for (const kind of ["legs", "eyes", "tails", "wings", "pronotum", "horns"]) {
      const added = editKdl(text, { type: "add", section: "parts", node: newItemText(parts.items!.find((i) => i.name === kind)!, kind) });
      const r = loadNatural(added);
      expect(r.ok ? [] : r.errors.map((e) => e.message), kind).toEqual([]);
    }
  });
});
