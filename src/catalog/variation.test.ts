import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { simulate } from "../tying/simulate";
import { materialsList } from "../tying/describe";
import { loadGlossaries, loadTranslations } from "../i18n/files";
import { inPageLanguage } from "../i18n/prose";
import { boxEntry, coloursSpec, coloursText, parseBoxEntry, parseColours, recolor } from "./variation";

const recipe = (() => {
  const r = loadRecipe(readFileSync(new URL("../../patterns/red-tag.kdl", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("red-tag");
  return r.recipe;
})();
const tag = recipe.materials[0]!.id;

describe("colour variations", () => {
  it("reads only the recipe's parts, in named colours other than the pattern's", () => {
    const own = recipe.materials[0]!.color;
    expect(parseColours(`${tag}:yellow,thread:olive,nothing:red,${tag}x:blue`, recipe)).toEqual({ [tag]: "yellow", thread: "olive" });
    expect(parseColours(`${tag}:#ff0000`, recipe)).toEqual({});
    if (own) expect(parseColours(`${tag}:${own}`, recipe)).toEqual({});
    expect(parseColours("", recipe)).toEqual({});
    // Gold wire is gold by the catalog's default: choosing gold for it changes nothing.
    const wire = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/partridge-and-orange.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("partridge-and-orange");
      return r.recipe;
    })();
    const gold = wire.materials.find((m) => m.kind === "gold-wire" && m.color === undefined);
    expect(gold).toBeDefined();
    expect(parseColours(`${gold!.id}:gold`, wire)).toEqual({});
  });

  it("writes the parts in the recipe's order", () => {
    expect(coloursSpec({ [tag]: "yellow", thread: "olive" }, recipe)).toBe(`thread:olive,${tag}:yellow`);
    expect(coloursSpec({}, recipe)).toBe("");
  });

  it("recolours the fly, its texts and its materials list", () => {
    const yellow = recolor(recipe, { [tag]: "yellow" });
    expect(yellow.materials[0]!.color).toBe("yellow");
    expect(recipe.materials[0]!.color).not.toBe("yellow");
    expect(materialsList(yellow).find((m) => m.id === tag)!.name.toLowerCase()).toContain("yellow");
    expect(simulate(yellow).steps.some((s) => s.text.toLowerCase().includes("yellow"))).toBe(true);
    expect(recolor(recipe, {})).toBe(recipe);
    // The hackle's label names it as tied; in another colour the name follows the colour.
    expect(materialsList(recolor(recipe, { hackle: "olive" })).find((m) => m.id === "hackle")!.name).toBe("Olive cock hackle");
  });

  it("carries a step's note about its own part into the new colour, and leaves other notes", () => {
    const ullsocken = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/ullsocken.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("ullsocken");
      return r.recipe;
    })();
    const blue = recolor(ullsocken, { butt: "blue", thread: "red" });
    expect(blue.steps.map((s) => s.note)).toContain("A short blue butt.");
    expect(blue.steps.map((s) => s.note)).toContain("A small red head.");
    expect(blue.steps.map((s) => s.note)).toContain("Let the fibres splay out for bulk.");
  });

  it("carries a translated note into the new colour, in its language's forms", () => {
    loadGlossaries();
    loadTranslations();
    const ullsocken = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/ullsocken.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("ullsocken");
      return r.recipe;
    })();
    const step = ullsocken.steps.findIndex((s) => s.note === "A short red butt.");
    for (const l of ["sv", "de"] as const) {
      const translated = inPageLanguage(ullsocken, l);
      const note = translated.steps[step]!.note!;
      const blue = recolor(translated, { butt: "blue" }, l).steps[step]!.note!;
      expect(note, l).not.toBe(blue);
      expect(blue.toLowerCase(), l).toMatch(l === "sv" ? /blå/ : /blau/);
      expect(blue.toLowerCase(), l).not.toMatch(l === "sv" ? /röd/ : /\brot/);
    }
  });

  it("reads a colour link made before a part was renamed", () => {
    const peeping = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/peeping-caddis.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("peeping-caddis");
      return r.recipe;
    })();
    expect(parseColours("case:orange", peeping)).toEqual({ "larva-case": "orange" });
  });

  it("leaves notes about other parts as tied", () => {
    const pennell = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/black-pennell.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("black-pennell");
      return r.recipe;
    })();
    const black = pennell.materials.filter((m) => m.color === "black").map((m) => m.id);
    const blue = recolor(pennell, Object.fromEntries(black.map((id) => [id, "blue" as const])));
    const tail = pennell.steps.findIndex((s) => s.note?.includes("black bars"));
    expect(tail).toBeGreaterThanOrEqual(0);
    expect(blue.steps[tail]!.note).toBe(pennell.steps[tail]!.note);
  });

  it("leaves a note naming a natural material, not its colour", () => {
    const ptn = (() => {
      const r = loadRecipe(readFileSync(new URL("../../patterns/pheasant-tail-nymph.kdl", import.meta.url), "utf8"));
      if (!r.ok) throw new Error("pheasant-tail-nymph");
      return r.recipe;
    })();
    const tail = ptn.materials.find((m) => m.kind === "pheasant-tail")!;
    const notes = (r: typeof ptn) => r.steps.map((s) => s.note ?? "");
    expect(notes(recolor(ptn, { [tail.id]: "purple" }))).toEqual(notes(ptn));
  });

  it("names the changes and round-trips fly box entries", () => {
    expect(coloursText({ thread: "blue-dun" }, recipe)).toBe("Thread blue dun");
    expect(parseBoxEntry(boxEntry("red-tag", "thread:olive"))).toEqual({ id: "red-tag", colours: "thread:olive" });
    expect(parseBoxEntry("red-tag")).toEqual({ id: "red-tag", colours: "" });
  });
});
