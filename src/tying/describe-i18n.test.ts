import { readdirSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { loadGlossaries } from "../i18n/files";
import { setLang } from "../i18n/lang";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { materialsList } from "./describe";
import { simulate } from "./simulate";

loadGlossaries();
const recipes: Recipe[] = readdirSync(new URL("../../patterns/", import.meta.url))
  .filter((f) => f.endsWith(".kdl"))
  .flatMap((f) => {
    const r = loadRecipe(readFileSync(new URL(`../../patterns/${f}`, import.meta.url), "utf8"));
    return r.ok ? [r.recipe] : [];
  });

afterAll(() => setLang("en"));

describe.each(["sv", "de"] as const)("generated texts in %s", (lang) => {
  it("are written for every pattern, from the glossary's words", () => {
    setLang(lang);
    for (const r of recipes) {
      const texts = [...simulate(r).steps.flatMap((s) => [s.title, s.text]), ...materialsList(r).flatMap((m) => [m.role, m.name, m.detail ?? ""])];
      for (const t of texts) expect(t, r.id).not.toMatch(/undefined|NaN|\s{2}|\s[,.]/);
    }
  });
});

describe("Swedish and German steps", () => {
  const adams = recipes.find((r) => r.id === "adams")!;
  it("agree the colour with the material", () => {
    setLang("sv");
    expect(simulate(adams).steps.map((s) => s.text)).toContain("Bind in det bruna tupphacklet med några fasta varv tråd.");
    setLang("de");
    expect(simulate(adams).steps.map((s) => s.text)).toContain("Binde die braune Hahnenhechel mit ein paar festen Windungen ein.");
  });
});
