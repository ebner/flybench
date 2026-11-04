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

/**
 * A recipe from a shared header and some steps. The header lists more materials than most
 * tests use, and unused materials are an error: only those the steps mention are kept.
 */
function recipeText(header: string, steps: string): string {
  const mentioned = (line: string) => {
    const id = line.match(/^ {4}([\w-]+) /)?.[1];
    return !id || new RegExp(`\\b${id}\\b`).test(steps);
  };
  const kept = header.replace(
    /(materials \{\n)([\s\S]*?)(\n\})/,
    (_, open: string, body: string, close: string) => open + body.split("\n").filter(mentioned).join("\n") + close,
  );
  return `${kept}\nsteps {\n${steps}\n}\n`;
}

function load(steps: string, header = HEADER): LoadResult {
  return loadRecipe(recipeText(header, steps));
}

/** 1-based line of `needle` in a document built by `load`. */
function lineOf(steps: string, needle: string, header = HEADER): number {
  const text = recipeText(header, steps);
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

/** Every material in HEADER: tag, herl butt, ribbed dubbed body, hackle and hair wing. */
const ALL_STEPS = `
    attach-thread at=0.8
    wrap-thread to=0.0
    tie-in tag length=0.3
    tie-in rib
    tie-in herl
    wrap-thread to=0.3
    wind herl to=0.3 turns=4
    tie-off herl
    dub fur to=0.75
    wind rib to=0.75 turns=5
    tie-off rib
    tie-in hackle
    tie-in wing length=1.5 angle=15
    trim wing leave=0.15
    wrap-thread to=0.85
    wind hackle to=0.85 turns=3
    tie-off hackle
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
    const naturals = new Set(readdirSync(new URL("../../naturals/", import.meta.url)).map((f) => f.replace(/\.kdl$/, "")));
    expect(validateCatalog(entries, naturals)).toEqual([]);
  });

  it("refer only to naturals that exist", () => {
    const entry = { file: "a.kdl", recipe: { ...recipeOf(load(VALID_STEPS)), id: "a", naturals: ["mayfly-dun", "unicorn"] } };
    expect(validateCatalog([entry], new Set(["mayfly-dun"])).map((e) => e.message)).toEqual(['naturals: no natural "unicorn" in naturals/']);
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
    expect(errorsOf(load(VALID_STEPS.replace("tie-off herl", "lasso herl")))[0]).toMatch(/steps\.5\.op/);
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
    expect(errorsOf(load(ALL_STEPS, HEADER.replace("color=red", "color=mauve")))[0]).toMatch(/materials\.1\.color/);
  });

  it("requires a type and difficulty, from fixed lists", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("type dry", "type floaty")))[0]).toMatch(/^line \d+:\d+: type:/);
    expect(errorsOf(load(VALID_STEPS, HEADER.replace("difficulty beginner", "")))[0]).toMatch(/difficulty/);
  });

  it("requires variant and variant-of together", () => {
    expect(errorsOf(load(VALID_STEPS, HEADER + "variant-of other\n"))[0]).toMatch(/variant and variant-of go together/);
  });

  it("rejects unknown materials kinds", () => {
    expect(errorsOf(load(ALL_STEPS, HEADER.replace("hares-ear-dubbing", "unicorn-hair")))[0]).toMatch(/materials\.4\.kind/);
  });

  it("checks material properties against the archetype", () => {
    const errors = (from: string, to: string) => errorsOf(load(ALL_STEPS, HEADER.replace(from, to))).join("\n");
    expect(errors("wool color=red", "wool color=red strands=2")).toMatch(/"strands" does not apply to wool/);
    expect(errors("fibre=1.0", "")).toMatch(/needs its fibre length/);
    expect(errors("tag wool color=red", "tag wool")).toMatch(/wool needs a colour/);
    expect(load(ALL_STEPS, HEADER.replace("fur hares-ear-dubbing", "fur hares-ear-dubbing shaggy=1")).ok).toBe(true);
    expect(errors("fur hares-ear-dubbing", "fur hares-ear-dubbing shaggy=2")).toMatch(/shaggy/);
    expect(errors("wool color=red", "wool color=red shaggy=0.5")).toMatch(/"shaggy" does not apply to wool/);
  });

  it("accepts only web links as sources", () => {
    const withSource = (url: string) => load(VALID_STEPS, `${HEADER}sources {\n    "A source" url="${url}"\n}\n`);
    expect(withSource("https://example.org/fly").ok).toBe(true);
    expect(errorsOf(withSource("javascript:alert(1)")).join("\n")).toMatch(/sources/);
  });
});

describe("rules found in review", () => {
  const head = `id t
name "T"
type nymph
difficulty beginner
hook dry-standard size=14
thread black size="8/0"
materials {
    case turkey-quill
    wing hackle-tips color=grizzly
}
`;
  const run = (steps: string, h = head) => loadRecipe(recipeText(h, steps));

  it("ties a pulled-over strip down where the thread is", () => {
    const steps = (to: number) => `    attach-thread at=0.1\n    tie-in case\n    wrap-thread to=0.9\n    pull-over case to=${to}\n    whip-finish`;
    expect(run(steps(0.9)).ok).toBe(true);
    expect(errorsOf(run(steps(0.3))).join("\n")).toMatch(/the thread is at 0.9; move it to 0.3/);
  });

  it("lays a strip back from the eye, held by the next winding over its end", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    rib gold-wire\n");
    const steps = (next: string) => `    attach-thread at=0.8\n    wrap-thread to=0.05\n    tie-in rib\n    wrap-thread to=0.8\n    tie-in case\n    pull-over case to=0.05\n${next}\n    whip-finish`;
    const held = "    wind rib to=0.8 turns=6\n    tie-off rib";
    expect(run(steps(held), h).ok || errorsOf(run(steps(held), h)).join("\n")).toBe(true);
    expect(errorsOf(run(steps("    wrap-thread to=0.9\n    wind rib to=0.9 turns=6\n    tie-off rib"), h)).join("\n")).toMatch(/laid back over the body and must be held/);
  });

  it("ties feathers in pointing back", () => {
    expect(errorsOf(run("    attach-thread at=0.8\n    tie-in wing length=1 forward=#true\n    whip-finish")).join("\n")).toMatch(/feathers are tied in pointing back/);
  });

  it("lets nothing, not even weighting, come between winding and tying off", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    body floss color=black\n    lead lead-free-wire\n");
    const steps = "    attach-thread at=0.1\n    tie-in body\n    wrap-thread to=0.8\n    wind body to=0.8 turns=5\n    weight lead from=0.3 to=0.6\n    tie-off body\n    whip-finish";
    expect(errorsOf(run(steps, h.replace("floss color", "silk-floss color"))).join("\n")).toMatch(/must be tied off before anything else/);
  });

  it("secures a palmered tip only by winding over it", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    hackle cock-hackle color=brown fibre=1\n    rib gold-wire\n");
    const steps = (ribTo: number) =>
      `    attach-thread at=0.8\n    tie-in hackle\n    wrap-thread to=0.0\n    tie-in rib\n    wrap-thread to=0.8\n    wind hackle to=0.4 turns=4\n    wind rib to=${ribTo} turns=3\n    tie-off rib\n    trim hackle\n    whip-finish`;
    expect(run(steps(0.8), h).ok || errorsOf(run(steps(0.8), h)).join("\n")).toBe(true);
    expect(errorsOf(run(steps(0.2), h)).join("\n")).toMatch(/must be secured by winding another material forward over its tip/);
  });

  it("says how a fly sits only for one that floats", () => {
    const steps = "    attach-thread at=0.1\n    tie-in case\n    wrap-thread to=0.9\n    pull-over case to=0.9\n    tie-in wing length=1\n    whip-finish";
    const sits = (h: string) => h.replace("hook dry", "sits body\nhook dry");
    expect(errorsOf(run(steps, sits(head))).join("\n")).toMatch(/sits only applies to a fly that floats/);
    expect(run(steps, sits(head.replace("type nymph", "type dry"))).ok).toBe(true);
    expect(run(steps, sits(head).replace("sits body", "fishes film\nsits half")).ok).toBe(true);
  });

  it("needs a whip finish even when the thread was never attached", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    lead lead-free-wire\n");
    expect(errorsOf(run("    weight lead from=0.3 to=0.6", h)).join("\n")).toMatch(/must end with a whip finish/);
  });

  it("reports a wind with both `to` and `around` once, and goes no further", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    rib gold-wire\n");
    const errors = errorsOf(run("    attach-thread at=0.8\n    tie-in rib\n    wind rib to=0.9 around=wing turns=3\n    tie-off rib\n    whip-finish", h));
    expect(errors.filter((e) => e.startsWith("line 15:"))).toHaveLength(1);
    expect(errors.join("\n")).toMatch(/give either `to`/);
  });

  it("winds a material forward to the thread, not short of it", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    rib gold-wire\n");
    const steps = (to: number) => `    attach-thread at=0.1\n    tie-in rib\n    wrap-thread to=0.85\n    wind rib to=${to} turns=3\n    tie-off rib\n    whip-finish`;
    expect(run(steps(0.85), h).ok).toBe(true);
    expect(errorsOf(run(steps(0.4), h)).join("\n")).toMatch(/the thread is at 0.85; wind forward to it/);
  });

  it("uses every material listed, and leaves nothing tied in and hanging", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    rib gold-wire\n");
    const hanging = "    attach-thread at=0.8\n    tie-in rib\n    tie-in case\n    pull-over case to=0.8\n    whip-finish";
    expect(errorsOf(run(hanging, h)).join("\n")).toMatch(/"rib" is tied in but never wound or pulled over/);
    const unused = "    attach-thread at=0.8\n    tie-in case\n    pull-over case to=0.8\n    whip-finish";
    expect(errorsOf(loadRecipe(`${h}steps {\n${unused}\n}\n`)).join("\n")).toMatch(/"wing" is listed but never used/);
  });

  it("slides a bead on before weighting", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    bead brass-bead mm=3\n    lead lead-free-wire\n");
    const steps = (first: string, second: string) => `${first}\n${second}\n    attach-thread at=0.8\n    whip-finish`;
    expect(run(steps("    slide-bead bead", "    weight lead from=0.5 to=0.9"), h).ok).toBe(true);
    expect(errorsOf(run(steps("    weight lead from=0.5 to=0.9", "    slide-bead bead"), h)).join("\n")).toMatch(/before weighting/);
  });

  it("doesn't spin or weight with a material that is already on the hook", () => {
    const h = head.replace("    case turkey-quill\n", "    case turkey-quill\n    hair deer-hair\n    lead lead-free-wire\n");
    const spun = "    attach-thread at=0.1\n    tie-in hair length=1.5\n    spin hair to=0.9\n    whip-finish";
    expect(errorsOf(run(spun, h)).join("\n")).toMatch(/"hair" is already on the hook/);
    const weighted = "    weight lead from=0.3 to=0.6\n    attach-thread at=0.8\n    tie-in lead\n    tie-off lead\n    whip-finish";
    expect(errorsOf(run(weighted, h)).join("\n")).toMatch(/"lead" is already tied in/);
  });

  it("places an error about a missing section at the top of the file", () => {
    const errors = errorsOf(run("    attach-thread at=0.8\n    whip-finish", head.replace("difficulty beginner\n", "")));
    expect(errors[0]).toMatch(/^line 1:1: difficulty/);
  });
});

describe("trimming a hackle with keep", () => {
  const head = `id t
name "T"
type dry
difficulty beginner
hook dry-standard size=14
thread black size="8/0"
materials {
    hackle cock-hackle color=brown fibre=1.0
}
`;
  const run = (steps: string) => loadRecipe(`${head}steps {\n${steps}\n}\n`);
  const wound = "    attach-thread at=0.6\n    tie-in hackle\n    wrap-thread to=0.9\n    wind hackle to=0.9 turns=4\n    tie-off hackle\n";

  it("needs a hackle that was wound, not pulled over", () => {
    expect(run(`${wound}    trim hackle keep=top\n    whip-finish`).ok).toBe(true);
    const pulled = "    attach-thread at=0.8\n    wrap-thread to=0.2\n    tie-in hackle\n    wrap-thread to=0.8\n    pull-over hackle to=0.8\n";
    expect(errorsOf(run(`${pulled}    trim hackle keep=top\n    whip-finish`)).join("\n")).toMatch(/keep only applies to a hackle that has been wound/);
  });

  it("allows it once", () => {
    expect(errorsOf(run(`${wound}    trim hackle keep=top\n    trim hackle keep=sides\n    whip-finish`)).join("\n")).toMatch(/already been trimmed with keep/);
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
    ["whip finish last", VALID_STEPS + "\n wrap-thread to=0.5", /nothing but trimming, or starting the thread again, can follow the whip finish/],
    ["whip finish required", VALID_STEPS.replace("whip-finish", ""), /must end with a whip finish/],
    ["dubbing is not tied in", VALID_STEPS.replace("tie-in herl", "tie-in fur"), /dubbing is applied to the thread/],
    ["only dubbing is dubbed", PALMER_STEPS.replace("dub fur", "dub herl"), /only dubbing can be dubbed/],
    ["palmered hackle must be secured", PALMER_STEPS.replace("wind rib to=0.75 turns=5", "wrap-thread to=0.76"), /must be secured by winding another material forward/],
    ["palmered tip must be trimmed", PALMER_STEPS.replace("trim hackle", ""), /tip of "hackle" is still hanging/],
    ["nothing to trim", VALID_STEPS.replace("tie-off herl", "tie-off herl\n trim herl"), /nothing of "herl" to trim/],
    ["hair wings need a length", PALMER_STEPS.replace("length=1.7 angle=15", ""), /elk hair sticks out from where it is tied in, so it needs a length/],
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

describe("beads, weight, posts, wing cases, spun hair and eyes", () => {
  const header = `
id test
name "Test"
type nymph
difficulty beginner
hook nymph-2xl size=12
thread black size="8/0"
materials {
    bead tungsten-bead mm=3.3
    lead lead-free-wire
    post poly-yarn
    hackle cock-hackle color=grizzly fibre=1.0
    case pheasant-tail count=8
    fur hares-ear-dubbing
    head deer-hair
    eyes dumbbell-eyes mm=4
    tail marabou color=black
    wire gold-wire
}
`;
  const steps = `
    slide-bead bead
    weight lead from=0.4 to=0.8
    attach-thread at=0.7
    tie-in post length=0.8 angle=90
    tie-in eyes side=under
    wrap-thread to=0.0
    tie-in tail length=1.2
    tie-in case
    dub fur to=0.6
    tie-in hackle
    wrap-thread to=0.7
    wind hackle around=post turns=4
    tie-off hackle
    pull-over case to=0.7
    spin head to=0.85 collar=0.8
    trim head leave=0.3
    whip-finish
`;
  const run = (s: string) => load(s, header);

  it("accepts all of them in a sensible order", () => {
    expect(recipeOf(run(steps)).steps).toHaveLength(17);
  });

  const cases: [string, string, RegExp][] = [
    ["bead after the thread", steps.replace("slide-bead bead\n", "").replace("attach-thread at=0.7", "attach-thread at=0.7\n slide-bead bead"), /slide the bead on before attaching the thread/],
    ["beads are not tied in", steps.replace("slide-bead bead", "attach-thread at=0.7\n tie-in bead").replace("weight lead from=0.4 to=0.8\n    attach-thread at=0.7", ""), /beads go on with "slide-bead"/],
    ["weight with wire only", steps.replace("weight lead", "weight fur"), /weighting is done with wire/],
    ["weight runs forward", steps.replace("from=0.4 to=0.8", "from=0.8 to=0.4"), /must run forward/],
    ["wind needs to or around", steps.replace("wind hackle around=post turns=4", "wind hackle turns=4"), /either `to`.*or `around`/],
    ["posts stand upright", steps.replace("tie-in post length=0.8 angle=90", "tie-in post length=0.8 angle=20"), /must be a bunch tied in upright/],
    ["posts are bunches, not strands across", steps.replace("tie-in post length=0.8 angle=90", "tie-in post length=0.8 angle=90 side=across"), /must be a bunch tied in upright/],
    ["pull over after tying in", steps.replace("tie-in case\n", ""), /must be tied in \(and not yet used\)/],
    ["pull over up to the thread", steps.replace("pull-over case to=0.7", "pull-over case to=0.9"), /tie the material down there/],
    ["spin only hair", steps.replace("spin head", "spin fur"), /only hair can be spun/],
    ["eyes take no length", steps.replace("tie-in eyes side=under", "tie-in eyes length=1"), /eyes do not take a length/],
    ["marabou needs a length", steps.replace("tie-in tail length=1.2", "tie-in tail"), /marabou sticks out .* needs a length/],
    ["beads need a size", steps, /need a size in millimetres/],
  ];
  for (const [name, s, pattern] of cases) {
    it(name, () => {
      const h = name === "beads need a size" ? header.replace("tungsten-bead mm=3.3", "tungsten-bead") : header;
      expect(errorsOf(load(s, h)).join("\n")).toMatch(pattern);
    });
  }
});

describe("sleeves, fur strips and the thread started again", () => {
  const header = `
id test
name "Test"
type streamer
difficulty beginner
hook streamer-4xl size=4
thread black size="3/0"
materials {
    body mylar-tubing
    wing rabbit-strip color=grey
    fur hares-ear-dubbing
    hackle cock-hackle color=brown fibre=1.0
}
`;
  // A Zonker's order: the rear tied and finished at the bend, the front with the thread started again.
  const steps = `
    attach-thread at=0.8
    wrap-thread to=0.04
    sleeve body to=0.9 fray=1
    tie-in wing length=3.5
    whip-finish turns=3
    attach-thread at=0.9
    tie-off body
    pull-over wing to=0.9
    trim wing
    whip-finish
`;
  const run = (s: string) => load(s, header);

  it("accepts a sleeve tied down at both ends, a strip with a tail pulled over, and a whip finish part-way", () => {
    const recipe = recipeOf(run(steps));
    expect(recipe.steps.find((s) => s.op === "sleeve")).toMatchObject({ material: "body", to: 0.9, fray: 1 });
  });

  const cases: [string, string, RegExp][] = [
    ["only tubing is slid on", steps.replace("sleeve body", "sleeve wing").replace("tie-in wing length=3.5", "").replace("tie-off body", "tie-off wing").replace("pull-over wing to=0.9\n    trim wing", ""), /only tubing is slid over the body/],
    ["tubing is not tied in", steps.replace("sleeve body to=0.9 fray=1", "tie-in body"), /tubing is slid over the body with "sleeve"/],
    ["a sleeve reaches somewhere", steps.replace("sleeve body to=0.9", "sleeve body to=0.05"), /must reach from the thread/],
    ["its other end is tied down where the thread is", steps.replace("attach-thread at=0.9", "attach-thread at=0.6").replace("pull-over wing to=0.9", "pull-over wing to=0.6"), /the thread is at 0.6; move it to 0.9/],
    ["its other end is tied down", steps.replace("tie-off body\n", ""), /"body" is tied down at one end only/],
    ["the thread is attached once at a time", steps.replace("whip-finish turns=3\n", ""), /the thread is already attached/],
    ["a fur strip is no post", steps.replace("tie-in wing length=3.5", "tie-in wing length=3.5 angle=80\n    tie-in hackle\n    wind hackle around=wing turns=4\n    tie-off hackle"), /must be a bunch tied in upright/],
    ["nothing but the thread again after a whip finish", steps.replace("attach-thread at=0.9", "tie-in fur"), /nothing but trimming, or starting the thread again/],
  ];
  for (const [name, s, pattern] of cases) {
    it(name, () => {
      expect(errorsOf(run(s)).join("\n")).toMatch(pattern);
    });
  }
});

describe("a woven body", () => {
  const header = `
id test
name "Test"
type nymph
difficulty intermediate
hook nymph-2xl size=8
thread black size="6/0"
materials {
    back chenille color=black
    belly chenille color=orange
    rib copper-wire
    wing elk-hair
}
`;
  // Kreft's order: the thread cut while weaving, attached again where the weave ends.
  const cut = `
    attach-thread at=0.9
    wrap-thread to=0.0
    tie-in back
    tie-in belly
    wrap-thread to=0.9
    whip-finish turns=3
    weave back under=belly to=0.55
    attach-thread at=0.55
    tie-off back
    tie-off belly
    whip-finish
`;
  // Or the thread half-hitched and parked where the weave ends.
  const parked = `
    attach-thread at=0.0
    tie-in back
    tie-in belly
    wrap-thread to=0.55
    weave back under=belly to=0.55 turns=8
    tie-off belly
    tie-off back
    whip-finish
`;
  const run = (s: string) => load(s, header);

  it("accepts the thread cut and attached again, or parked where the weave ends", () => {
    expect(recipeOf(run(cut)).steps.find((s) => s.op === "weave")).toMatchObject({ material: "back", under: "belly", to: 0.55 });
    expect(recipeOf(run(parked)).steps.find((s) => s.op === "weave")).toMatchObject({ turns: 8 });
  });

  const cases: [string, string, RegExp][] = [
    ["only strands are woven", parked.replace("tie-in belly", "tie-in rib").replace("under=belly", "under=rib").replace("tie-off belly", "tie-off rib"), /only chenille, yarn or floss can be woven, not "rib"/],
    ["both are tied in first", parked.replace("    tie-in belly\n", ""), /"belly" must be tied in \(and not yet used\) before it is woven/],
    ["two different strands", parked.replace("under=belly", "under=back"), /weave two different strands/],
    ["tied in together", parked.replace("    tie-in belly\n", "    wrap-thread to=0.3\n    tie-in belly\n"), /tie in "belly" where the strand woven over it is tied in/],
    ["woven forward", parked.replace("wrap-thread to=0.55", "wrap-thread to=0.5").replace("to=0.55 turns=8", "to=0.0"), /weave forward from where both strands are tied in/],
    ["the parked thread waits where the weave ends", parked.replace("wrap-thread to=0.55", "wrap-thread to=0.4"), /the thread is at 0.4; move it to 0.55/],
    ["the thread attached again there", cut.replace("attach-thread at=0.55", "attach-thread at=0.7"), /the thread is at 0.7; move it to 0.55/],
    ["both tied off next", parked.replace("tie-off belly", "wrap-thread to=0.7\n    tie-off belly"), /the woven strands are held at the front: tie off "back"/],
    ["tied off at all", parked.replace("    tie-off belly\n    tie-off back\n    whip-finish\n", ""), /"back" is wound but never tied off/],
    ["and nothing in between", parked.replace("    tie-off belly\n    tie-off back\n", ""), /the woven strands are held at the front: tie off "back"/],
    ["an unknown strand", parked.replace("under=belly", "under=nothing"), /unknown material "nothing"/],
  ];
  for (const [name, s, pattern] of cases) {
    it(name, () => {
      expect(errorsOf(run(s)).join("\n")).toMatch(pattern);
    });
  }
});

describe("hair folded back and bound past the bend", () => {
  const header = `
id test
name "Test"
type dry
difficulty advanced
hook dry-standard size=10
thread olive size="6/0"
materials {
    tail moose-mane
    body elk-hair color=olive
    rib copper-wire
}
`;
  // A Paradrake's body: tied in forward behind the eye, folded back into a bullet head, bound back
  // past the bend and forward again, the tips trimmed after the whip finish.
  const paradrake = `
    attach-thread at=0.0
    tie-in tail length=3.0
    trim tail
    wrap-thread to=0.95
    tie-in body length=3.3 forward=#true spread=180
    wrap-thread to=0.7
    pull-over body to=0.7
    wrap-thread to=-0.6 turns=6
    wrap-thread to=0.7 turns=6
    whip-finish
    trim body leave=0.2
`;
  const run = (s: string) => load(s, header);

  it("accepts the thread past the bend over the hair, and the tips trimmed", () => {
    expect(recipeOf(run(paradrake)).steps.find((s) => s.op === "wrap-thread" && s.to < 0)).toMatchObject({ to: -0.6, turns: 6 });
  });

  const cases: [string, string, RegExp][] = [
    ["only over hair laid back there", paradrake.replace("    pull-over body to=0.7\n", "    tie-in rib\n    wind rib to=0.95 turns=3\n    tie-off rib\n").replace("tie-in body length=3.3 forward=#true spread=180", "tie-in body length=1"), /past the bend the thread can only bind hair laid back there/],
    ["nothing tied past the bend", paradrake.replace("    wrap-thread to=0.7 turns=6\n", "    tie-in rib\n    wrap-thread to=0.7 turns=6\n"), /the thread is past the bend, round nothing but hair/],
    ["nor finished there", paradrake.replace("    wrap-thread to=0.7 turns=6\n", ""), /the thread is past the bend, round nothing but hair/],
    ["the tips trimmed once", paradrake + "    trim body\n", /there is nothing of "body" to trim/],
    // Tied in at 0.95 of a 2-gape shank, 2 gapes long: the tips end 0.1 gape behind the bend.
    ["only as far as the hair reaches", paradrake.replace("length=3.3", "length=2.0"), /the tips of "body" reach back only far enough for the thread to bind them to 0.03/],
    ["on the shank too", paradrake.replace("length=3.3", "length=1.0").replace("to=-0.6", "to=0.2"), /the tips of "body" reach back only far enough for the thread to bind them to 0.53/],
    ["no further than a shank behind the bend", paradrake.replace("to=-0.6", "to=-1.2"), /too small|greater than or equal to -1|>=-1/],
  ];
  for (const [name, s, pattern] of cases) {
    it(name, () => {
      expect(errorsOf(run(s)).join("\n")).toMatch(pattern);
    });
  }
});

describe("a dyed grizzly", () => {
  const steps = `
    attach-thread at=0.8
    tie-in hackle
    wrap-thread to=0.9
    wind hackle to=0.9 turns=4
    tie-off hackle
    whip-finish
`;
  it("bars a hackle of any colour, and only materials that can be barred", () => {
    const h = (m: string) => `id test\nname "Test"\ntype dry\ndifficulty beginner\nhook dry-standard size=14\nthread black size="8/0"\nmaterials {\n    ${m}\n}\n`;
    expect(recipeOf(load(steps, h("hackle cock-hackle color=olive barred=#true fibre=1")))?.materials[0]).toMatchObject({ barred: true });
    expect(errorsOf(load(steps, h("hackle chenille color=olive barred=#true"))).join("\n")).toMatch(/"barred" does not apply to chenille/);
  });
});

describe("a body made on a needle (a Mohican Mayfly's)", () => {
  const MOHICAN = `
id test
name "Test"
type dry
difficulty advanced
hook dry-standard size=12
thread tan size="8/0"
materials {
    tail moose-mane count=3
    body foam color=tan mm=1.5
    wing deer-hair
    hackle cock-hackle color=ginger fibre=1.3
    thorax hares-ear-dubbing
    rib gold-wire
}
`;
  const STEPS = `
    attach-thread at=0.8
    wrap-thread to=0.2
    tie-in body length=2.3 extended=#true segments=6 width=0.4 tails=tail tail-length=3.3 tail-spread=20
    wrap-thread to=0.62
    tie-in wing length=2.5 angle=85 fan=50
    trim wing
    tie-in hackle
    wrap-thread to=0.25
    dub thorax to=0.85
    wind hackle around=wing turns=5
    tie-off hackle
    pull-over body to=0.85 around=wing
    trim body leave=0.15
    whip-finish
`;
  const errs = (steps: string) => errorsOf(load(steps, MOHICAN));

  it("loads: the tails are used by the body they come out of, the rest of the strip pulled over round the wing", () => {
    expect(recipeOf(load(STEPS, MOHICAN)).steps[2]).toMatchObject({ segments: 6, tails: "tail", "tail-length": 3.3 });
  });

  it("makes segments and tails only of an extended body", () => {
    expect(errs(STEPS.replace("extended=#true ", "").replace(" width=0.4", ""))).toEqual(expect.arrayContaining([expect.stringMatching(/segments and tails only apply to an extended body/)]));
  });

  it("takes tails of hair, fibres or biots only, each with its length", () => {
    expect(errs(STEPS.replace("tails=tail", "tails=rib").replace("tie-in wing", "tie-in tail length=1\n    tie-in wing"))).toEqual(expect.arrayContaining([expect.stringMatching(/only hair, fibres or biots come out of a body's end/)]));
    expect(errs(STEPS.replace(" tail-length=3.3", ""))).toEqual(expect.arrayContaining([expect.stringMatching(/tails need a tail-length/)]));
  });

  it("doesn't tie the tails in again", () => {
    expect(errs(STEPS.replace("tie-in wing", "tie-in tail length=1\n    tie-in wing"))).toEqual(expect.arrayContaining([expect.stringMatching(/"tail" is already tied in/)]));
  });

  it("parts a strip only round an upright post it passes", () => {
    expect(errs(STEPS.replace("pull-over body to=0.85 around=wing", "pull-over body to=0.85 around=tail"))).toEqual(expect.arrayContaining([expect.stringMatching(/can only be parted round "tail"/)]));
    expect(errs(STEPS.replace("dub thorax to=0.85", "dub thorax to=0.5").replace("pull-over body to=0.85", "pull-over body to=0.5"))).toEqual(expect.arrayContaining([expect.stringMatching(/can only be parted round "wing"/)]));
  });

  it("fans out only an upright bunch", () => {
    expect(errs(STEPS.replace("angle=85 fan=50", "angle=30 fan=50").replace("wind hackle around=wing turns=5", "wind hackle to=0.85 turns=5").replace(" around=wing\n", "\n"))).toEqual(
      expect.arrayContaining([expect.stringMatching(/fan only applies to a bunch tied in upright/)]),
    );
  });
});
