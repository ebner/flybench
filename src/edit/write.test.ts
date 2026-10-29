import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PATTERN_SECTIONS } from "../recipe/kdl";
import { loadRecipe } from "../recipe/load";
import { loadNatural, NATURAL_SECTIONS, NaturalSchema } from "../recipe/natural";
import { RecipeSchema } from "../recipe/schema";
import { formSections } from "./schemaForm";
import { writeKdl } from "./write";

const PATTERN_FORM = formSections(PATTERN_SECTIONS, RecipeSchema);
const NATURAL_FORM = formSections(NATURAL_SECTIONS, NaturalSchema);

describe("writing a recipe as KDL", () => {
  const dir = new URL("../../patterns/", import.meta.url);
  it.each(readdirSync(dir).filter((f) => f.endsWith(".kdl")))("%s loads back as it was", (f) => {
    const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
    if (!r.ok) throw new Error(f);
    const again = loadRecipe(writeKdl(r.recipe as unknown as Record<string, unknown>, PATTERN_FORM));
    expect(again.ok ? again.recipe : again.errors).toEqual(r.recipe);
  });

  const ndir = new URL("../../naturals/", import.meta.url);
  it.each(readdirSync(ndir).filter((f) => f.endsWith(".kdl")))("natural %s loads back as it was", (f) => {
    const r = loadNatural(readFileSync(new URL(f, ndir), "utf8"));
    if (!r.ok) throw new Error(f);
    const again = loadNatural(writeKdl(r.natural as unknown as Record<string, unknown>, NATURAL_FORM));
    expect(again.ok ? again.natural : again.errors).toEqual(r.natural);
  });
});
