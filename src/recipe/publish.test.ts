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
});
