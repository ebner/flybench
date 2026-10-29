import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { parseGlossary, SECTIONS } from "./glossary";
import { requiredTerms, unnamedParts } from "./terms";

const recipes: Recipe[] = readdirSync(new URL("../../patterns/", import.meta.url))
  .filter((f) => f.endsWith(".kdl"))
  .flatMap((f) => {
    const r = loadRecipe(readFileSync(new URL(`../../patterns/${f}`, import.meta.url), "utf8"));
    return r.ok ? [r.recipe] : [];
  });

describe("glossary format", () => {
  it("reads nouns, adjectives and phrases with their forms", () => {
    const r = parseGlossary(`
language sv
status draft
materials {
    noun wool "ull" gender=en definite="ullen" mass=#true {
        note "Ull, inte garn: garn är spunnet."
        source "Example" url="https://example.org"
    }
}
colours {
    adjective red "röd" neuter="rött" plural="röda"
    adjective grizzly "grizzly" invariable=#true
}
hooks {
    phrase treble "trekrok"
}
`);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const wool = r.glossary.sections.materials.get("wool")!;
    expect(wool).toMatchObject({ kind: "noun", text: "ull", gender: "en", mass: true, forms: { definite: "ullen" } });
    expect(wool.sources[0]).toEqual({ title: "Example", url: "https://example.org" });
    expect(r.glossary.sections.colours.get("red")).toMatchObject({ forms: { neuter: "rött", plural: "röda" } });
  });

  it("says which forms are missing, on which line", () => {
    const r = parseGlossary(`language de
status draft
materials {
    noun wool "Wolle" gender=x
    noun wire "Draht" gender=m colour="gold"
}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContainEqual({ line: 4, message: "materials wool: gender must be one of m, f, n" });
    expect(r.errors).toContainEqual({ line: 4, message: "materials wool: needs plural=" });
    expect(r.errors).toContainEqual({ line: 5, message: "materials wire: unknown property colour=" });
  });
});

describe.each(["sv", "de"])("the %s glossary", (lang) => {
  const file = new URL(`../../glossary/${lang}.kdl`, import.meta.url);
  it.runIf(existsSync(file))("is well-formed and has every word the site needs", () => {
    const r = parseGlossary(readFileSync(file, "utf8"));
    if (!r.ok) throw new Error(r.errors.map((e) => `line ${e.line}: ${e.message}`).join("\n"));
    expect(r.glossary.lang).toBe(lang);
    const required = requiredTerms(recipes);
    const missing = SECTIONS.flatMap((s) => required[s].filter((id) => !r.glossary.sections[s].has(id)).map((id) => `${s} ${id}`));
    expect(missing).toEqual([]);
    expect(unnamedParts(recipes, (s, id) => r.glossary.sections[s].has(id)).map((id) => `parts ${id}`)).toEqual([]);
    // Tying jargon is where translators disagree: say why, and where it comes from.
    const unsourced = (["materials", "words"] as const).flatMap((s) =>
      [...r.glossary.sections[s].values()].filter((e) => e.sources.length === 0).map((e) => `${s} ${e.id}`),
    );
    expect(unsourced).toEqual([]);
  });
});
