import { describe, expect, it } from "vitest";
import type { Adjective, Noun } from "./glossary";
import { deContract, deNoun, dePhrase, svPhrase } from "./grammar";

const noun = (text: string, gender: string, forms: Record<string, string>, mass = false): Noun => ({
  kind: "noun", id: text, text, gender, forms, mass, article: false, notes: [], sources: [], line: 1,
});
const adj = (text: string, forms: Record<string, string> = {}, invariable = false, compound = false): Adjective => ({
  kind: "adjective", id: text, text, forms, invariable: invariable || compound, compound, notes: [], sources: [], line: 1,
});

describe("Swedish phrases", () => {
  const ull = noun("ull", "en", { definite: "ullen" }, true);
  const garn = noun("garn", "ett", { definite: "garnet", plural: "garn", "plural-definite": "garnen" });
  const röd = adj("röd", { neuter: "rött", plural: "röda" });
  it("agree the colour with the noun", () => {
    expect(svPhrase(ull, röd, "indefinite")).toBe("röd ull");
    expect(svPhrase(garn, röd, "indefinite")).toBe("rött garn");
    expect(svPhrase(ull, röd, "definite")).toBe("den röda ullen");
    expect(svPhrase(garn, röd, "definite")).toBe("det röda garnet");
    expect(svPhrase(garn, undefined, "definite")).toBe("garnet");
    expect(svPhrase(garn, adj("grizzly", {}, false, true), "definite")).toBe("grizzly-garnet");
    expect(svPhrase(ull, adj("rosa", {}, true), "definite")).toBe("den rosa ullen");
    expect(svPhrase(garn, adj("rosa", {}, true), "indefinite")).toBe("rosa garn");
    expect(svPhrase(garn, röd, "indefinite", true)).toBe("röda garn");
    expect(svPhrase(garn, röd, "definite", true)).toBe("de röda garnen");
    const tinsel = { ...noun("oval tinsel", "en", { definite: "ovala tinseln" }, true), article: true };
    expect(svPhrase(tinsel, undefined, "definite")).toBe("den ovala tinseln");
    expect(svPhrase(tinsel, undefined, "indefinite")).toBe("oval tinsel");
  });
});

describe("German phrases", () => {
  const wolle = noun("Wolle", "f", {}, true);
  const draht = noun("Draht", "m", { plural: "Drähte" });
  const garn = noun("Garn", "n", { plural: "Garne" });
  const rot = adj("rot");
  it("decline the article and the colour", () => {
    expect(dePhrase(wolle, { case: "acc", article: "definite", colour: rot })).toBe("die rote Wolle");
    expect(dePhrase(draht, { case: "acc", article: "definite", colour: rot })).toBe("den roten Draht");
    expect(dePhrase(draht, { case: "dat", article: "definite" })).toBe("dem Draht");
    expect(dePhrase(garn, { case: "nom", article: "none", colour: rot })).toBe("rotes Garn");
    expect(dePhrase(draht, { case: "nom", article: "indefinite", colour: rot })).toBe("ein roter Draht");
    expect(dePhrase(draht, { case: "dat", article: "none", plural: true })).toBe("Drähten");
    expect(dePhrase(wolle, { case: "nom", article: "none", colour: adj("dunkel") })).toBe("dunkle Wolle");
    expect(dePhrase(wolle, { case: "acc", article: "definite", colour: adj("rosa", {}, true) })).toBe("die rosa Wolle");
    expect(dePhrase(draht, { case: "acc", article: "definite", colour: adj("grizzly", {}, false, true) })).toBe("den Grizzly-Draht");
  });
  it("make the genitive and contract prepositions", () => {
    expect(deNoun(noun("Hakenschenkel", "m", { plural: "Hakenschenkel" }), "gen")).toBe("Hakenschenkels");
    expect(deContract("bis zu dem Beginn an dem Öhr")).toBe("bis zum Beginn am Öhr");
  });
});
