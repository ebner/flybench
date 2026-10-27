import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "./load";
import { withoutReferences } from "./publish";

const patternsDir = new URL("../../patterns/", import.meta.url);
const patternFiles = readdirSync(patternsDir).filter((f) => f.endsWith(".kdl"));

describe("withoutReferences", () => {
  it.each(patternFiles)("%s: drops the reference photos and still loads the same", (file) => {
    const text = readFileSync(new URL(file, patternsDir), "utf8");
    const stripped = withoutReferences(text);
    expect(stripped.split("\n")).toHaveLength(text.split("\n").length);
    expect(stripped).not.toMatch(/^references\b|refcheck|reference only/m);
    const before = loadRecipe(text);
    const after = loadRecipe(stripped);
    expect(after.ok).toBe(true);
    if (before.ok && after.ok) expect(after.recipe).toEqual({ ...before.recipe, references: [] });
  });

  const base = readFileSync(new URL("red-tag.kdl", patternsDir), "utf8").replace(/\/\/ Photos[^\n]*\n^references \{[\s\S]*?^\}\n/m, "");
  it.each([
    ["on one line", 'references { "https://example.org/a.jpg" note="side"; }'],
    ["empty, on one line", "references {}"],
    ["indented", '  references {\n      "https://example.org/a.jpg"\n  }'],
  ])("strips a references block written %s", (_, block) => {
    const text = base.replace("\nhook ", `\n${block}\nhook `);
    expect(loadRecipe(text).ok).toBe(true);
    const stripped = withoutReferences(text);
    expect(stripped).not.toMatch(/references|example\.org/);
    expect(stripped.split("\n")).toHaveLength(text.split("\n").length);
    const loaded = loadRecipe(stripped);
    expect(loaded.ok).toBe(true);
  });
});
