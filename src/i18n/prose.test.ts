import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TECHNIQUES } from "../catalog/techniques";
import { TECHNIQUES_DE } from "../catalog/techniques-de";
import { TECHNIQUES_SV } from "../catalog/techniques-sv";
import { loadNatural } from "../recipe/natural";
import { loadRecipe } from "../recipe/load";
import { inPageLanguage, parseNaturalProse, parsePatternProse, proseMismatches, registerPatternProse } from "./prose";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const files = (dir: string) => (existsSync(new URL(`../../${dir}`, import.meta.url)) ? readdirSync(new URL(`../../${dir}`, import.meta.url)).filter((f) => f.endsWith(".kdl")) : []);

describe("prose translations", () => {
  it("read a pattern's prose and put it into the recipe", () => {
    const r = parsePatternProse(`
id red-tag
status draft
description "En röd tofs."
history """
    Första stycket.

    Andra stycket.
    """
labels {
    hackle "Röd game-tupphackel"
}
notes {
    step 3 "En anteckning."
}
`);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.prose.history).toBe("Första stycket.\n\nAndra stycket.");
    const recipe = loadRecipe(read("patterns/red-tag.kdl"));
    if (!recipe.ok) throw new Error("red-tag");
    registerPatternProse("sv", r.prose);
    const sv = inPageLanguage(recipe.recipe, "sv");
    expect(sv.description).toBe("En röd tofs.");
    expect(sv.materials.find((m) => m.id === "hackle")!.label).toBe("Röd game-tupphackel");
    // An untranslated label goes, so the glossary names the material.
    expect(sv.materials.find((m) => m.id === "tag")!.label).toBeUndefined();
    expect(inPageLanguage(recipe.recipe, "sv")).toBe(sv);
    expect(inPageLanguage(recipe.recipe, "en")).toBe(recipe.recipe);
  });

  it("say where a translation no longer fits its pattern", () => {
    const r = parsePatternProse(`id red-tag\nnotes {\n    step 1 "x"\n}\nlabels {\n    nothing "x"\n}`);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const recipe = loadRecipe(read("patterns/red-tag.kdl"));
    if (!recipe.ok) throw new Error("red-tag");
    const errors = proseMismatches(r.prose, recipe.recipe);
    expect(errors.some((e) => e.startsWith("labels nothing"))).toBe(true);
  });

  for (const lang of ["sv", "de"]) {
    it(`fit their patterns and naturals (${lang})`, () => {
      const problems: string[] = [];
      for (const f of files(`translations/${lang}/patterns/`)) {
        const p = parsePatternProse(read(`translations/${lang}/patterns/${f}`));
        if (!p.ok) {
          problems.push(...p.errors.map((e) => `${f}:${e.line}: ${e.message}`));
          continue;
        }
        if (`${p.prose.id}.kdl` !== f) problems.push(`${f}: id ${p.prose.id} doesn't match the file name`);
        if (!existsSync(new URL(`../../patterns/${f}`, import.meta.url))) {
          problems.push(`${f}: no such pattern`);
          continue;
        }
        const recipe = loadRecipe(read(`patterns/${f}`));
        if (recipe.ok) problems.push(...proseMismatches(p.prose, recipe.recipe).map((e) => `${f}: ${e}`));
      }
      for (const f of files(`translations/${lang}/naturals/`)) {
        const p = parseNaturalProse(read(`translations/${lang}/naturals/${f}`));
        if (!p.ok) {
          problems.push(...p.errors.map((e) => `${f}:${e.line}: ${e.message}`));
          continue;
        }
        if (`${p.prose.id}.kdl` !== f) problems.push(`${f}: id ${p.prose.id} doesn't match the file name`);
        if (!existsSync(new URL(`../../naturals/${f}`, import.meta.url))) problems.push(`${f}: no such natural`);
        else {
          const n = loadNatural(read(`naturals/${f}`));
          if (n.ok) for (const region of Object.keys(p.prose.hatches)) if (!n.natural.hatches.some((h) => h.region === region)) problems.push(`${f}: no hatch in ${region}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }

  it.each([
    ["sv", TECHNIQUES_SV],
    ["de", TECHNIQUES_DE],
  ] as const)("cover every technique once begun (%s)", (_lang, texts) => {
    if (Object.keys(texts).length === 0) return;
    for (const t of TECHNIQUES) {
      expect(texts[t.id], t.id).toBeDefined();
      expect(texts[t.id]!.mistakes.length, t.id).toBe(t.mistakes.length);
    }
    expect(Object.keys(texts).filter((id) => !TECHNIQUES.some((t) => t.id === id))).toEqual([]);
  });
});
