import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCatalog } from "./catalog";
import { formatError } from "./errors";
import { loadRecipe, type LoadResult } from "./load";
import { MATERIALS } from "./materials";
import { NAMED_COLORS, type Recipe } from "./schema";

const patternsDir = new URL("../../patterns/", import.meta.url);
const patternFiles = readdirSync(patternsDir).filter((f) => f.endsWith(".kdl"));

const HEADER = `
id test
name "Test"
type dry
difficulty beginner
hook dry-standard size=14
thread black size="8/0"
materials {
    herl peacock-herl
    tag wool color=red
    hackle cock-hackle color=brown fibre=1.0
    rib gold-wire
    fur hares-ear-dubbing
    wing elk-hair
}
`;

function load(steps: string, header = HEADER): LoadResult {
  return loadRecipe(`${header}\nsteps {\n${steps}\n}\n`);
}

/** 1-based line of `needle` in a document built by `load`. */
function lineOf(steps: string, needle: string, header = HEADER): number {
  const text = `${header}\nsteps {\n${steps}\n}\n`;
  return text.slice(0, text.indexOf(needle)).split("\n").length;
}

function errorsOf(result: LoadResult): string[] {
  if (result.ok) throw new Error("expected errors, recipe loaded fine");
  return result.errors.map(formatError);
}

function recipeOf(result: LoadResult): Recipe {
  if (!result.ok) throw new Error(result.errors.map(formatError).join("\n"));
  return result.recipe;
}

const VALID_STEPS = `
    attach-thread at=0.8
    wrap-thread to=0.0
    tie-in herl
    wrap-thread to=0.7
    wind herl to=0.7 turns=8
    tie-off herl
    whip-finish
`;

/** Wire rib, dubbed body, hackle palmered back and secured by the rib, hair wing. */
const PALMER_STEPS = `
    attach-thread at=0.8
    wrap-thread to=0.0
    tie-in rib
    dub fur to=0.75
    tie-in hackle
    wind hackle to=0.05 turns=5
    wind rib to=0.75 turns=5
    tie-off rib
    trim hackle
    tie-in wing length=1.7 angle=15
    trim wing leave=0.15
    whip-finish
`;

describe("pattern files", () => {
  for (const file of patternFiles) {
    it(`${file} loads without errors`, () => {
      const result = loadRecipe(readFileSync(new URL(file, patternsDir), "utf8"));
      expect(result.ok ? [] : result.errors.map(formatError)).toEqual([]);
    });
  }

  it("form a consistent catalog", () => {
    const entries = patternFiles.map((file) => ({
      file,
      recipe: recipeOf(loadRecipe(readFileSync(new URL(file, patternsDir), "utf8"))),
    }));
    expect(validateCatalog(entries)).toEqual([]);
  });
});

describe("mapping KDL onto the recipe model", () => {
  it("maps scalars, records and lists", () => {
    const r = recipeOf(load(VALID_STEPS));
    expect(r.hook).toEqual({ model: "dry-standard", size: 14 });
    expect(r.thread).toEqual({ color: "black", size: "8/0" });
    expect(r.materials[0]).toEqual({ id: "herl", kind: "peacock-herl" });
    expect(r.steps[4]).toEqual({ op: "wind", material: "herl", to: 0.7, turns: 8 });
    expect(r.steps[6]).toEqual({ op: "whip-finish", turns: 5 });
  });

  it("maps catalog metadata", () => {
    const header = HEADER + `
aliases "Testy" "The Test"
variant-of other
variant "Variant"
imitates caddis mayfly
season may june
origin originator="A. Tyer" year=1957 region="Somewhere"
history """
    First line.
    Second line.
    """
sources {
    "A book" url="https://example.com/book"
    "A friend"
}
references {
    "https://example.com/fly.jpg" page="https://example.com/fly" license="CC BY 4.0" flip=#true
}
`;
    const r = recipeOf(load(VALID_STEPS, header));
    expect(r.aliases).toEqual(["Testy", "The Test"]);
    expect(r.variantOf).toBe("other");
    expect(r.imitates).toEqual(["caddis", "mayfly"]);
    expect(r.season).toEqual(["may", "june"]);
    expect(r.origin).toEqual({ originator: "A. Tyer", year: 1957, region: "Somewhere" });
    expect(r.history).toBe("First line.\nSecond line.");
    expect(r.sources).toEqual([{ title: "A book", url: "https://example.com/book" }, { title: "A friend" }]);
    expect(r.references).toEqual([
      { image: "https://example.com/fly.jpg", page: "https://example.com/fly", license: "CC BY 4.0", flip: true },
    ]);
  });

  it("reports KDL syntax errors with their location", () => {
    const errors = errorsOf(loadRecipe(`id test\nthread black size=\n`));
    expect(errors[0]).toMatch(/^line 2:\d+: Expected a value/);
  });

  it("explains unquoted hex colours", () => {
    const errors = errorsOf(loadRecipe(`thread #c8102e size="8/0"`));
    expect(errors[0]).toMatch(/line 1:8: .*quote/);
  });

  it("rejects unknown sections", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER + "colour red\n"))[0]).toMatch(/unknown section "colour"/);
  });

  it("rejects duplicate sections and properties", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER + `name "Again"\n`))[0]).toMatch(/"name" is given more than once/);
    expect(errorsOf(load(VALID_STEPS.replace("at=0.8", "at=0.8 at=0.7")))[0]).toMatch(/"at" is given more than once/);
  });

  it("rejects extra arguments", () => {
    expect(errorsOf(load(VALID_STEPS.replace("tie-in herl", "tie-in herl tag")))[0]).toMatch(/at most one argument/);
    expect(errorsOf(load(VALID_STEPS, HEADER + `origin "x"\n`))[0]).toMatch(/takes no arguments/);
  });
});

describe("schema validation", () => {
  it("points out-of-range positions at their line", () => {
    const steps = VALID_STEPS.replace("to=0.7 turns=8", "to=1.4 turns=8");
    const errors = errorsOf(load(steps));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^line ${lineOf(steps, "wind")}:\\d+: steps\\.4\\.to: `));
  });

  it("rejects unknown operations", () => {
    expect(errorsOf(load(VALID_STEPS.replace("tie-off herl", "spin herl")))[0]).toMatch(/steps\.5\.op/);
  });

  it("rejects unknown properties", () => {
    expect(errorsOf(load(VALID_STEPS.replace("whip-finish", "whip-finish speed=2")))[0]).toMatch(/speed/);
  });

  it("rejects odd hook sizes and unknown thread sizes", () => {
    const errors = errorsOf(load(VALID_STEPS, HEADER.replace("size=14", "size=13").replace("8/0", "7/0")));
    expect(errors.join("\n")).toMatch(/hook sizes are even/);
    expect(errors.join("\n")).toMatch(/thread\.size/);
  });

  it("rejects bad colours", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("color=red", "color=mauve")))[0]).toMatch(/materials\.1\.color/);
  });

  it("requires a type and difficulty, from fixed lists", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("type dry", "type floaty")))[0]).toMatch(/^line \d+:\d+: type:/);
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("difficulty beginner", "")))[0]).toMatch(/difficulty/);
  });

  it("requires variant and variant-of together", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER + "variant-of other\n"))[0]).toMatch(/variant and variant-of go together/);
  });

  it("rejects unknown materials kinds", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("hares-ear-dubbing", "unicorn-hair")))[0]).toMatch(/materials\.4\.kind/);
  });

  it("checks material properties against the archetype", () => {
    const errors = (from: string, to: string) => errorsOf(load(VALID_STEPS, HEADER.replace(from, to))).join("\n");
    expect(errors("wool color=red", "wool color=red strands=2")).toMatch(/"strands" does not apply to wool/);
    expect(errors("fibre=1.0", "")).toMatch(/needs its fibre length/);
    expect(errors("tag wool color=red", "tag wool")).toMatch(/wool needs a colour/);
  });
});

describe("semantic validation", () => {
  const cases: [string, string, RegExp][] = [
    ["thread first", VALID_STEPS.replace("attach-thread at=0.8", "wrap-thread to=0.9"), /thread must be attached first/],
    ["unknown material", VALID_STEPS.replace("tie-in herl", "tie-in hen"), /unknown material "hen"/],
    ["wind before tie-in", VALID_STEPS.replace("tie-in herl", "tie-in tag"), /"herl" must be tied in before/],
    ["wind nowhere", VALID_STEPS.replace("to=0.7 turns=8", "to=0.0 turns=8"), /wind it forward or back from there/],
    ["wind past the thread", VALID_STEPS.replace("to=0.7 turns=8", "to=0.9 turns=8"), /the thread is at 0.7/],
    ["tie off straight after winding", VALID_STEPS.replace("tie-off herl", "wrap-thread to=0.8\n tie-off herl"), /must be tied off before anything else/],
    ["whip finish last", VALID_STEPS + "\n wrap-thread to=0.5", /nothing can follow the whip finish/],
    ["whip finish required", VALID_STEPS.replace("whip-finish", ""), /must end with a whip finish/],
    ["dubbing is not tied in", VALID_STEPS.replace("tie-in herl", "tie-in fur"), /dubbing is applied to the thread/],
    ["only dubbing is dubbed", PALMER_STEPS.replace("dub fur", "dub herl"), /only dubbing can be dubbed/],
    ["palmered hackle must be secured", PALMER_STEPS.replace("wind rib to=0.75 turns=5", "wrap-thread to=0.76"), /must be secured by winding another material forward/],
    ["palmered tip must be trimmed", PALMER_STEPS.replace("trim hackle", ""), /tip of "hackle" is still hanging/],
    ["nothing to trim", VALID_STEPS.replace("tie-off herl", "tie-off herl\n trim herl"), /nothing of "herl" to trim/],
    ["hair wings need a length", PALMER_STEPS.replace("length=1.7 angle=15", ""), /hair wing needs a length/],
    ["angle needs a length", VALID_STEPS.replace("tie-in herl", "tie-in herl angle=20"), /angle only applies/],
    ["leave is for hair", PALMER_STEPS.replace("trim hackle", "trim hackle leave=0.1"), /leave only applies to hair butts/],
    ["spread is for bunches", VALID_STEPS.replace("tie-in herl", "tie-in herl spread=40"), /spread only applies/],
    ["width is for feathers", PALMER_STEPS.replace("angle=15", "angle=15 width=1"), /width only applies to feather wings/],
  ];
  for (const [name, steps, pattern] of cases) {
    it(name, () => {
      expect(errorsOf(load(steps)).join("\n")).toMatch(pattern);
    });
  }

  it("accepts a palmered hackle secured by a rib, and trimmed hair butts", () => {
    expect(recipeOf(load(PALMER_STEPS)).steps).toHaveLength(12);
  });

  it("lets dubbing move the thread", () => {
    // The rib may only go as far forward as the thread, which the dubbing carried to 0.75.
    const errors = errorsOf(load(PALMER_STEPS.replace("wind rib to=0.75", "wind rib to=0.85")));
    expect(errors.join("\n")).toMatch(/the thread is at 0.75/);
  });

  it("locates semantic errors", () => {
    const steps = VALID_STEPS.replace("to=0.7 turns=8", "to=0.9 turns=8");
    expect(errorsOf(load(steps))[0]).toMatch(new RegExp(`^line ${lineOf(steps, "wind")}:\\d+: steps\\.4\\.to:`));
  });
});

describe("catalog validation", () => {
  const recipe = (id: string, extra: Partial<Recipe> = {}) => ({ ...recipeOf(load(VALID_STEPS)), id, ...extra });

  it("requires unique ids that match the file name", () => {
    const errors = validateCatalog([
      { file: "a.kdl", recipe: recipe("a") },
      { file: "b.kdl", recipe: recipe("a") },
    ]).map((e) => e.message);
    expect(errors).toContain('id "a" is also used by a.kdl');
    expect(errors).toContain("file name should match the id: a.kdl");
  });

  it("requires variants to point at an existing main pattern", () => {
    const errors = validateCatalog([
      { file: "a.kdl", recipe: recipe("a") },
      { file: "b.kdl", recipe: recipe("b", { variantOf: "a", variant: "B" }) },
      { file: "c.kdl", recipe: recipe("c", { variantOf: "b", variant: "C" }) },
      { file: "d.kdl", recipe: recipe("d", { variantOf: "zzz", variant: "D" }) },
    ]).map((e) => `${e.file}: ${e.message}`);
    expect(errors).toEqual([
      'c.kdl: variant-of "b" is itself a variant; point at the main pattern',
      'd.kdl: variant-of "zzz": no such pattern',
    ]);
  });
});

describe("materials catalog", () => {
  it("only uses known colours as defaults", () => {
    for (const m of Object.values(MATERIALS)) {
      if ("defaultColor" in m && !m.defaultColor.startsWith("#")) expect(NAMED_COLORS).toHaveProperty(m.defaultColor);
    }
  });
});
