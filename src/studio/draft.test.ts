import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { checkDraft, isPatternFile, newPatternText } from "./draft";

const redTag = readFileSync(new URL("../../patterns/red-tag.kdl", import.meta.url), "utf8");
const loaded = (text: string): Recipe => {
  const r = loadRecipe(text);
  if (!r.ok) throw new Error(r.errors[0]!.message);
  return r.recipe;
};

describe("isPatternFile", () => {
  it("accepts an id with .kdl", () => {
    expect(isPatternFile("red-tag.kdl")).toBe(true);
  });
  it("rejects anything that could leave patterns/", () => {
    for (const name of ["../red-tag.kdl", "red-tag.kdl/..", "a/b.kdl", "Red-Tag.kdl", "red-tag.txt", ".kdl", ""]) {
      expect(isPatternFile(name)).toBe(false);
    }
  });
});

describe("checkDraft", () => {
  it("passes a valid pattern under its own file name", () => {
    const check = checkDraft(redTag, "red-tag.kdl", []);
    expect(check.errors).toEqual([]);
    expect(check.recipe?.id).toBe("red-tag");
  });

  it("reports syntax errors with a line", () => {
    const check = checkDraft("id red-tag\nname\n", "red-tag.kdl", []);
    expect(check.recipe).toBeUndefined();
    expect(check.errors[0]?.line).toBe(2);
  });

  it("applies the catalog rules against the other patterns", () => {
    expect(checkDraft(redTag, "other.kdl", []).errors.map((e) => e.message)).toContain(
      "file name should match the id: red-tag.kdl",
    );
    const others = [{ file: "copy.kdl", recipe: loaded(redTag) }];
    expect(checkDraft(redTag, "red-tag.kdl", others).errors.map((e) => e.message)).toContain(
      'id "red-tag" is also used by copy.kdl',
    );
  });

  it("reports errors the draft causes in other files", () => {
    const read = (id: string) => readFileSync(new URL(`../../patterns/${id}.kdl`, import.meta.url), "utf8");
    const others = ["elk-hair-caddis", "elk-hair-caddis-troth", "red-tag"].map((id) => ({ file: `${id}.kdl`, recipe: loaded(read(id)) }));
    // The main Elk Hair Caddis turned into a variant of the Red Tag: its own variant is left pointing at a variant.
    const draft = read("elk-hair-caddis").replace(/^name .*$/m, '$&\nvariant-of red-tag\nvariant "Test"');
    const messages = checkDraft(draft, "elk-hair-caddis.kdl", others).errors.map((e) => e.message);
    expect(messages.some((m) => m.startsWith("elk-hair-caddis-troth.kdl: "))).toBe(true);
    // Errors that were there before the draft are not the draft's.
    expect(checkDraft(read("elk-hair-caddis"), "elk-hair-caddis.kdl", others).errors).toEqual([]);
  });

  it("checks the draft in place of the saved version of the same file", () => {
    const others = [{ file: "red-tag.kdl", recipe: loaded(redTag) }];
    expect(checkDraft(redTag, "red-tag.kdl", others).errors).toEqual([]);
  });
});

describe("newPatternText", () => {
  it("is a valid pattern for the id it is given", () => {
    const check = checkDraft(newPatternText("my-fly"), "my-fly.kdl", []);
    expect(check.errors).toEqual([]);
  });
});
