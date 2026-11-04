import { readdirSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { loadGlossaries } from "../i18n/files";
import { setLang } from "../i18n/lang";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { materialsList } from "./describe";
import { addMaterial, addPart, bareHook, compile, kindsFor, ROLES } from "../edit/parts";
import { blankFly } from "../edit/own";
import { NAMEABLE_PARTS } from "../patterns";
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

describe.each(["sv", "de"] as const)("an own fly's parts in %s", (lang) => {
  it("are named from the glossary's words, however many of a kind and however mixed", () => {
    const { materials: _m, steps: _s, ...meta } = blankFly("Mine");
    let fly = bareHook(meta);
    for (const role of ROLES.filter((r) => r !== "other")) {
      // Three of each kind, the last with two more materials mixed in.
      for (let n = 0; n < 3; n++) {
        const kind = kindsFor(role)[0]!;
        const added = addPart(fly, role, kind);
        fly = added.fly;
        if (n === 2 && ["bunch", "wound"].includes(added.part.how)) fly = addMaterial(addMaterial(fly, added.part.id, kind, "badger"), added.part.id, kind, "#123456");
      }
    }
    const recipe = compile(fly).recipe;
    expect(recipe.materials.every((m) => NAMEABLE_PARTS.has(m.id))).toBe(true);
    setLang(lang);
    for (const t of materialsList(recipe).flatMap((m) => [m.role, m.name])) expect(t).not.toMatch(/undefined|NaN|\s{2}/);
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

describe.each(["sv", "de"] as const)("an extended body's tails in %s", (lang) => {
  it("are said to be there, with or without segments", () => {
    setLang(lang);
    const result = loadRecipe(`id test
name "Test"
type nymph
difficulty advanced
hook nymph-2xl size=12
thread black size="8/0"
materials {
    tail goose-biot color=brown
    body chenille color=olive
}
steps {
    attach-thread at=0.1
    tie-in body length=1.5 extended=#true tails=tail tail-length=0.6
    whip-finish
}
`);
    if (!result.ok) throw new Error("does not load");
    const text = simulate(result.recipe).steps[1]!.text;
    expect(text).toMatch(lang === "sv" ? /förbi änden, där .* bands in i förväg\./ : /über das Ende hinaus, wo .* vorher eingebunden (wurde|wurden)\./);
    expect(text).toMatch(/0,6/);
    // A body made on a needle pointing forward is said to.
    const made = loadRecipe(readFileSync(new URL("../../patterns/mohican-mayfly.kdl", import.meta.url), "utf8"));
    if (!made.ok) throw new Error("does not load");
    const tie = made.recipe.steps.findIndex((s) => s.op === "tie-in" && s.material === "body");
    const forward = { ...made.recipe, steps: made.recipe.steps.map((s, i) => (i === tie ? { ...s, forward: true } : s)) } as Recipe;
    expect(simulate(forward).steps[tie]!.text).toMatch(lang === "sv" ? /framåt över krokögat, med remsans/ : /nach vorn über das Öhr übersteht/);
  });
});

describe("a strip cut to a width", () => {
  const strip = (side: string) => {
    const r = loadRecipe(`id test
name "Test"
type terrestrial
difficulty intermediate
hook bass-bug size=10
thread black size="6/0"
materials {
    belly foam color=black mm=2
    body deer-hair
}
steps {
    attach-thread at=0.85
    wrap-thread to=0.0
    tie-in belly ${side} width=1 taper=#true
    spin body to=0.85
    pull-over belly to=0.85
    whip-finish
}
`);
    if (!r.ok) throw new Error("does not load");
    return simulate(r.recipe).steps[2]!.text;
  };
  it("is said to be tied in on its side of the shank, in every language", () => {
    setLang("en");
    expect(strip("side=under")).toMatch(/tie it in under the shank by the point/);
    expect(strip("")).toMatch(/tie it in on top by the point/);
    setLang("sv");
    expect(strip("side=under")).toMatch(/bind in den med spetsen under krokskaftet/);
    expect(strip("")).toMatch(/bind in den med spetsen ovanpå krokskaftet/);
    setLang("de");
    expect(strip("side=under")).toMatch(/mit der Spitze unter dem Hakenschenkel/);
    expect(strip("")).toMatch(/mit der Spitze oben auf den Hakenschenkel/);
  });
});
