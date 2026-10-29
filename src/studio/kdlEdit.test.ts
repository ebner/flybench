import { describe, expect, it } from "vitest";
import { ARG, editKdl, NAME } from "./kdlEdit";

const text = `// A natural for the tests.
id test
name "Test"
size min=5 max=11
body {
    // The abdomen.
    abdomen length=0.6 radius=0.05 color=olive
    thorax length=0.4 radius=0.06 color=olive
}
parts {
    tails count=2 length=1.0 color=dun
    // Assumption: legs.
    legs length=0.55 color="#6a6040"
}
`;

describe("editing KDL in place", () => {
  it("changes one value and keeps everything else as written", () => {
    const out = editKdl(text, { type: "set", path: ["parts", 1, "length"], value: 0.6 });
    expect(out).toBe(text.replace("legs length=0.55", "legs length=0.6"));
    expect(editKdl(text, { type: "set", path: ["size", "max"], value: 12 })).toBe(text.replace("max=11", "max=12"));
    expect(editKdl(text, { type: "set", path: ["name", ARG], value: "Other" })).toBe(text.replace('name "Test"', 'name "Other"'));
  });

  it("adds and deletes properties, renames list items", () => {
    expect(editKdl(text, { type: "set", path: ["parts", 0, "middle"], value: 0.7 })).toContain("tails count=2 length=1.0 color=dun middle=0.7");
    expect(editKdl(text, { type: "delete", path: ["parts", 0, "count"] })).toContain("    tails length=1.0 color=dun\n");
    expect(editKdl(text, { type: "set", path: ["body", 1, NAME], value: "chest" })).toContain("    chest length=0.4");
    expect(editKdl(text, { type: "set", path: ["parts", 0, "banded"], value: true })).toContain("banded=#true");
  });

  it("adds a node indented like its siblings, without copying their comments", () => {
    const out = editKdl(text, { type: "add", section: "parts", node: "eyes size=0.03 color=black" });
    expect(out).toBe(text.replace('    legs length=0.55 color="#6a6040"\n', '    legs length=0.55 color="#6a6040"\n    eyes size=0.03 color=black\n'));
  });

  it("adds a missing section and a missing top-level value", () => {
    expect(editKdl(text, { type: "add", section: "hatches", node: "british-isles from=may to=june" })).toMatch(/hatches \{\n\s+british-isles from=may to=june\n\}/);
    expect(editKdl(text, { type: "set", path: ["curve", ARG], value: 20 })).toMatch(/\ncurve 20/);
  });

  it("removes and moves list items with the comments above them", () => {
    const removed = editKdl(text, { type: "remove", section: "parts", index: 1 });
    expect(removed).not.toContain("legs");
    expect(removed).not.toContain("Assumption: legs");
    const moved = editKdl(text, { type: "move", section: "parts", index: 1, to: 0 });
    expect(moved.indexOf("// Assumption: legs.")).toBeLessThan(moved.indexOf("tails"));
    expect(moved.indexOf("legs length")).toBeLessThan(moved.indexOf("tails"));
  });

  it("keeps the layout when the first item leaves, moves, or a block is empty or on one line", () => {
    const list = "parts {\n    tails count=2\n    legs length=1\n}\n";
    expect(editKdl(list, { type: "remove", section: "parts", index: 0 })).toBe("parts {\n    legs length=1\n}\n");
    expect(editKdl(list, { type: "move", section: "parts", index: 1, to: 0 })).toBe("parts {\n    legs length=1\n    tails count=2\n}\n");
    expect(editKdl(list, { type: "move", section: "parts", index: 0, to: 1 })).toBe("parts {\n    legs length=1\n    tails count=2\n}\n");
    expect(editKdl("references {\n}\n", { type: "add", section: "references", node: '"https://a/b.jpg" note="n"' })).toBe('references {\n    "https://a/b.jpg" note=n\n}\n'.replace("note=n", 'note="n"'));
    const oneLine = editKdl("one { a x=1 }\n", { type: "add", section: "one", node: "b y=2" });
    expect(oneLine).toMatch(/a x=1\s*\n\s+b y=2/);
  });

  it("keeps a multi-line string multi-line, and quoted values quoted", () => {
    const history = 'history """\n    Line one.\n    Line two.\n    """\n';
    expect(editKdl(history, { type: "set", path: ["history", ARG], value: "Line one.\nLine three." })).toBe('history """\n    Line one.\n    Line three.\n    """\n');
    expect(editKdl('aliases "Foo" "Bar Baz"\n', { type: "args", section: "aliases", values: ["Foo", "Qux"] })).toBe('aliases "Foo" "Qux"\n');
  });

  it("puts a new top-level value where the sections' order puts it", () => {
    const out = editKdl("id x\nrides on-surface\nbody {\n}\n", { type: "set", path: ["curve", ARG], value: 20 }, ["id", "rides", "curve", "body"]);
    expect(out).toBe("id x\nrides on-surface\ncurve 20\nbody {\n}\n");
  });

  it("keeps compact lists and an unterminated last line apart from what is added", () => {
    expect(editKdl("materials { a wool; b wool }\n", { type: "move", section: "materials", index: 1, to: 0 })).toMatch(/b wool;\s*a wool/);
    expect(editKdl("id test", { type: "set", path: ["name", ARG], value: "New" }, ["id", "name"])).toBe('id test\nname New\n');
  });
});
